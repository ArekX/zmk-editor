package keymap

import (
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/ArekX/zmk-editor/internal/dts"
)

var labelPattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// behaviorNodes maps the label of every behavior node in the file to it.
func behaviorNodes(f *dts.File) map[string]*dts.Node {
	out := map[string]*dts.Node{}
	f.Walk(func(n *dts.Node) {
		if strings.HasPrefix(n.StringProp("compatible"), "zmk,behavior-") && len(n.Labels) > 0 {
			out[n.Labels[0]] = n
		}
	})
	return out
}

// allLabels lists every label in the file.
func allLabels(f *dts.File) map[string]bool {
	out := map[string]bool{}
	f.Walk(func(n *dts.Node) {
		for _, l := range n.Labels {
			out[l] = true
		}
	})
	return out
}

func validateBehaviors(f *dts.File, behaviors []Behavior) error {
	existing := behaviorNodes(f)
	// Labels of other nodes (layouts, kscan, ...) can never be taken.
	others := allLabels(f)
	for label := range existing {
		delete(others, label)
	}
	seen := map[string]bool{}
	for _, b := range behaviors {
		if !labelPattern.MatchString(b.Label) {
			return fmt.Errorf("behavior name %q must start with a letter or '_' and contain only letters, digits and '_'", b.Label)
		}
		if seen[b.Label] {
			return fmt.Errorf("two behaviors are named %q", b.Label)
		}
		seen[b.Label] = true
		if others[b.Label] {
			return fmt.Errorf("the name %q is already used in the keymap", b.Label)
		}
		if !strings.HasPrefix(b.Compatible, "zmk,behavior-") {
			return fmt.Errorf("behavior %q has an invalid compatible %q", b.Label, b.Compatible)
		}
	}
	return nil
}

func behaviorEdits(src string, f *dts.File, kn *dts.Node, behaviors []Behavior) ([]edit, error) {
	if err := validateBehaviors(f, behaviors); err != nil {
		return nil, err
	}
	existing := behaviorNodes(f)
	kept := map[string]bool{}
	var edits []edit
	var added []Behavior
	for _, b := range behaviors {
		if b.ID == "" {
			added = append(added, b)
			continue
		}
		node, ok := existing[b.ID]
		if !ok {
			return nil, fmt.Errorf("behavior %q no longer exists in the file; reload the keymap", b.ID)
		}
		kept[b.ID] = true
		orig, _ := extractBehavior(node, f)
		edits = append(edits, updateBehavior(src, node, orig, b)...)
	}
	for label, n := range existing {
		if !kept[label] {
			edits = append(edits, removeStatement(src, n.Start, n.End))
		}
	}
	if len(added) == 0 {
		return edits, nil
	}
	return append(edits, insertBehaviors(src, f, kn, added)...), nil
}

func updateBehavior(src string, n *dts.Node, orig, b Behavior) []edit {
	unit := detectUnit(src, n)
	indent := childIndent(src, n, unit)
	var edits []edit
	if b.Label != orig.Label {
		edits = append(edits, edit{start: n.Start, end: n.Start + len(orig.Label), text: b.Label})
	}
	if b.Compatible != orig.Compatible {
		edits = append(edits, setProp(src, n, "compatible", " "+dts.QuoteString(b.Compatible), indent, true))
	}
	if b.SensorBindingCells == nil && b.BindingCells != orig.BindingCells {
		edits = append(edits, setProp(src, n, "#binding-cells", " <"+strconv.Itoa(b.BindingCells)+">", indent, false))
	}
	if b.SensorBindingCells != nil && (orig.SensorBindingCells == nil || *orig.SensorBindingCells != *b.SensorBindingCells) {
		edits = append(edits, setProp(src, n, "#sensor-binding-cells", " <"+strconv.Itoa(*b.SensorBindingCells)+">", indent, false))
	}
	if b.DisplayName != orig.DisplayName {
		prop := "display-name"
		if n.Prop("display-name") == nil && n.Prop("label") != nil {
			prop = "label"
		}
		if strings.TrimSpace(b.DisplayName) == "" {
			edits = append(edits, deleteProp(src, n, prop)...)
		} else {
			edits = append(edits, setProp(src, n, prop, " "+dts.QuoteString(b.DisplayName), indent, false))
		}
	}
	if !slices.Equal(orig.Bindings, b.Bindings) {
		if len(b.Bindings) == 0 {
			edits = append(edits, deleteProp(src, n, "bindings")...)
		} else {
			edits = append(edits, setProp(src, n, "bindings", formatBehaviorBindings(src, n.Prop("bindings"), b, indent+unit), indent, false))
		}
	}
	return append(edits, propEdits(src, n, orig.Props, b.Props, indent)...)
}

// bindingGroups splits behavior bindings into <...> groups: one binding
// per group, except that a macro's &macro_param_* steps share the group of
// the binding they apply to.
func bindingGroups(b Behavior) []string {
	if b.Kind != "macro" {
		return b.Bindings
	}
	var groups []string
	var pending []string
	for _, step := range b.Bindings {
		pending = append(pending, step)
		if strings.HasPrefix(step, "&macro_param_") {
			continue
		}
		groups = append(groups, strings.Join(pending, " "))
		pending = nil
	}
	if len(pending) > 0 {
		groups = append(groups, strings.Join(pending, " "))
	}
	return groups
}

var leadingComma = regexp.MustCompile(`\n([ \t]*),`)

// formatBehaviorBindings renders a bindings value, following the layout
// of the existing property: inline, one group per line with leading commas
// (`= <a>\n  , <b>\n  ;`), or with trailing commas.
func formatBehaviorBindings(src string, orig *dts.Property, b Behavior, deeper string) string {
	groups := bindingGroups(b)
	wrapped := make([]string, len(groups))
	for i, g := range groups {
		wrapped[i] = "<" + g + ">"
	}
	if orig == nil || !strings.Contains(orig.Value, "\n") || len(wrapped) == 1 {
		return " " + strings.Join(wrapped, ", ")
	}
	if m := leadingComma.FindStringSubmatch(orig.Value); m != nil {
		ind := m[1]
		var sb strings.Builder
		sb.WriteString(" " + wrapped[0])
		for _, w := range wrapped[1:] {
			sb.WriteString("\n" + ind + ", " + w)
		}
		sb.WriteString("\n" + ind)
		return sb.String()
	}
	ind := deeper
	if second := strings.Index(orig.Value[1:], "\n"); second >= 0 {
		ind = lineIndent(src, orig.ValueStart+1+second+1)
	}
	return " " + strings.Join(wrapped, ",\n"+ind)
}

// insertBehaviors adds new behavior nodes to an existing `macros` or
// `behaviors` container under the root node, creating `behaviors` right
// before the keymap node when there is none.
func insertBehaviors(src string, f *dts.File, kn *dts.Node, added []Behavior) []edit {
	byContainer := map[*dts.Node][]Behavior{}
	var order []*dts.Node
	var homeless []Behavior
	for _, b := range added {
		c := behaviorContainer(f, b.Kind == "macro")
		if c == nil {
			homeless = append(homeless, b)
			continue
		}
		if _, ok := byContainer[c]; !ok {
			order = append(order, c)
		}
		byContainer[c] = append(byContainer[c], b)
	}
	var edits []edit
	for _, c := range order {
		unit := detectUnit(src, c)
		indent := childIndent(src, c, unit)
		taken := childNames(c)
		var sb strings.Builder
		for _, b := range byContainer[c] {
			sb.WriteString(newBehaviorText(b, uniqueNodeName(sanitizeNodeName(b.Label), taken), indent, unit))
		}
		edits = append(edits, insertBeforeClose(src, c, sb.String()))
	}
	if len(homeless) > 0 {
		unit := detectUnit(src, kn)
		indent := indentAt(src, kn.Start)
		taken := map[string]bool{}
		var sb strings.Builder
		sb.WriteString(indent + "behaviors {")
		for _, b := range homeless {
			sb.WriteString(newBehaviorText(b, uniqueNodeName(sanitizeNodeName(b.Label), taken), indent+unit, unit))
		}
		sb.WriteString(indent + "};\n\n")
		ls := lineStart(src, kn.Start)
		edits = append(edits, edit{start: ls, end: ls, text: sb.String()})
	}
	return edits
}

func behaviorContainer(f *dts.File, macro bool) *dts.Node {
	names := []string{"behaviors", "macros"}
	if macro {
		names = []string{"macros", "behaviors"}
	}
	for _, name := range names {
		for _, root := range f.Nodes {
			if root.Name != "/" {
				continue
			}
			if c := root.Child(name); c != nil {
				return c
			}
		}
	}
	return nil
}

func childNames(n *dts.Node) map[string]bool {
	out := map[string]bool{}
	for _, c := range n.Children {
		out[c.Name] = true
	}
	return out
}

func newBehaviorText(b Behavior, name, indent, unit string) string {
	inner := indent + unit
	var sb strings.Builder
	sb.WriteString("\n" + indent + b.Label + ": " + name + " {\n")
	sb.WriteString(inner + "compatible = " + dts.QuoteString(b.Compatible) + ";\n")
	if b.SensorBindingCells != nil {
		sb.WriteString(inner + "#sensor-binding-cells = <" + strconv.Itoa(*b.SensorBindingCells) + ">;\n")
	} else {
		sb.WriteString(inner + "#binding-cells = <" + strconv.Itoa(b.BindingCells) + ">;\n")
	}
	if strings.TrimSpace(b.DisplayName) != "" {
		sb.WriteString(inner + "display-name = " + dts.QuoteString(b.DisplayName) + ";\n")
	}
	if len(b.Bindings) > 0 {
		sb.WriteString(inner + "bindings =" + formatBehaviorBindings("", nil, b, inner+unit) + ";\n")
	}
	for _, p := range b.Props {
		if strings.TrimSpace(p.Name) == "" || structuralProps[p.Name] {
			continue
		}
		sb.WriteString(inner + propLine(p) + "\n")
	}
	sb.WriteString(indent + "};\n")
	return sb.String()
}

// overrideEdits updates, removes and adds top-level `&ref { ... };` nodes.
func overrideEdits(src string, f *dts.File, overrides []Override) ([]edit, error) {
	existing := map[string]*dts.Node{}
	for _, n := range overrideNodes(f) {
		existing[n.Name] = n
	}
	kept := map[string]bool{}
	var edits []edit
	var added []Override
	refs := map[string]bool{}
	for _, o := range overrides {
		if !strings.HasPrefix(o.Ref, "&") || !labelPattern.MatchString(o.Ref[1:]) {
			return nil, fmt.Errorf("invalid behavior reference %q", o.Ref)
		}
		if o.ID == "" {
			if refs[o.Ref] || existing[o.Ref] != nil && !slices.ContainsFunc(overrides, func(x Override) bool { return x.ID == o.Ref }) {
				// Adding a second override for the same node: fine in DTS,
				// but keep one per node so the editor stays unambiguous.
				return nil, fmt.Errorf("%s already has settings in this keymap", o.Ref)
			}
			refs[o.Ref] = true
			added = append(added, o)
			continue
		}
		refs[o.Ref] = true
		n, ok := existing[o.ID]
		if !ok {
			return nil, fmt.Errorf("settings for %s no longer exist in the file; reload the keymap", o.ID)
		}
		kept[o.ID] = true
		unit := detectUnit(src, n)
		edits = append(edits, propEdits(src, n, extractProps(n, nil), o.Props, childIndent(src, n, unit))...)
	}
	for id, n := range existing {
		if !kept[id] {
			edits = append(edits, removeStatement(src, n.Start, n.End))
		}
	}
	if len(added) == 0 {
		return edits, nil
	}
	var root *dts.Node
	for _, n := range f.Nodes {
		if n.Name == "/" {
			root = n
			break
		}
	}
	unit := "    "
	pos := len(src)
	if root != nil {
		unit = detectUnit(src, root)
		pos = lineStart(src, root.Start)
	}
	var sb strings.Builder
	for _, o := range added {
		sb.WriteString(o.Ref + " {\n")
		for _, p := range o.Props {
			if strings.TrimSpace(p.Name) != "" {
				sb.WriteString(unit + propLine(p) + "\n")
			}
		}
		sb.WriteString("};\n\n")
	}
	text := sb.String()
	if root == nil {
		text = "\n" + text
	}
	return append(edits, edit{start: pos, end: pos, text: text}), nil
}
