package keymap

import (
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/ArekX/zmk-editor/internal/dts"
)

// Apply writes the edited model back into src. Only layers and combos are
// editable: changed properties are replaced in place, removed nodes are
// deleted, new nodes are appended. grid (optional) is the physical layout's
// row/col per key, used to format bindings tables.
func Apply(src string, updated *Keymap, grid []GridPos) (string, error) {
	_, f, err := Parse(src)
	if err != nil {
		return "", err
	}
	kn := keymapNode(f)
	if kn == nil {
		return "", errors.New(`the file has no node with compatible = "zmk,keymap"`)
	}
	var edits []edit
	le, err := layerEdits(src, f, kn, updated.Layers, grid)
	if err != nil {
		return "", err
	}
	edits = append(edits, le...)
	ce, err := comboEdits(src, f, kn, updated.Combos)
	if err != nil {
		return "", err
	}
	edits = append(edits, ce...)
	out, err := applyEdits(src, edits)
	if err != nil {
		return "", err
	}
	// Refuse to write something we cannot read back.
	if _, _, err := Parse(out); err != nil {
		return "", fmt.Errorf("generated keymap does not parse: %w", err)
	}
	return out, nil
}

func layerEdits(src string, f *dts.File, kn *dts.Node, layers []Layer, grid []GridPos) ([]edit, error) {
	unit := detectUnit(src, kn)
	indent := childIndent(src, kn, unit)
	existing := map[string]*dts.Node{}
	var origOrder []string
	for _, c := range kn.Children {
		existing[c.Name] = c
		origOrder = append(origOrder, c.Name)
	}

	var keptOrder []string
	var edits []edit
	var added []Layer
	var shape []int
	for _, l := range layers {
		if l.ID == "" {
			added = append(added, l)
			continue
		}
		node, ok := existing[l.ID]
		if !ok {
			return nil, fmt.Errorf("layer %q no longer exists in the file; reload the keymap", l.ID)
		}
		if len(added) > 0 {
			return nil, errors.New("new layers can only be added after existing ones")
		}
		keptOrder = append(keptOrder, l.ID)
		orig := extractLayer(node, f.Defines)
		if shape == nil {
			shape = orig.Shape
		}
		edits = append(edits, updateLayer(src, node, orig, l, grid, unit)...)
	}
	// Existing layers must keep their relative order: references like
	// `&mo 2` are positional and reordering silently breaks them.
	var remaining []string
	for _, id := range origOrder {
		if slices.Contains(keptOrder, id) {
			remaining = append(remaining, id)
		}
	}
	if !slices.Equal(remaining, keptOrder) {
		return nil, errors.New("reordering existing layers is not supported")
	}
	for _, id := range origOrder {
		if !slices.Contains(keptOrder, id) {
			n := existing[id]
			edits = append(edits, removeStatement(src, n.Start, n.End))
		}
	}
	if len(added) > 0 {
		taken := map[string]bool{}
		for _, id := range origOrder {
			taken[id] = true
		}
		var b strings.Builder
		for _, l := range added {
			name := uniqueNodeName(layerNodeName(l.Name), taken)
			b.WriteString(newLayerText(l, name, indent, unit, grid, shape))
		}
		edits = append(edits, insertBeforeClose(src, kn, b.String()))
	}
	return edits, nil
}

func updateLayer(src string, node *dts.Node, orig, l Layer, grid []GridPos, unit string) []edit {
	var edits []edit
	propIndent := childIndent(src, node, unit)
	if !slices.Equal(orig.Bindings, l.Bindings) {
		opts := FormatOptions{Grid: grid, Shape: orig.Shape, Indent: propIndent + unit, CloseIndent: propIndent}
		value := ""
		if p := node.Prop("bindings"); p != nil {
			opts.CloseIndent = lineIndent(src, p.Start)
			opts.Indent = opts.CloseIndent + unit
			if !strings.Contains(p.Value, "\n") {
				value = " <" + strings.Join(l.Bindings, " ") + ">"
			}
		}
		if value == "" {
			value = FormatBindings(l.Bindings, opts)
		}
		edits = append(edits, setProp(src, node, "bindings", value, propIndent, false))
	}
	switch {
	case l.SensorBindings == nil && orig.SensorBindings != nil:
		edits = append(edits, deleteProp(src, node, "sensor-bindings")...)
	case l.SensorBindings != nil && !slices.Equal(orig.SensorBindings, l.SensorBindings):
		if len(l.SensorBindings) == 0 {
			edits = append(edits, deleteProp(src, node, "sensor-bindings")...)
		} else {
			edits = append(edits, setProp(src, node, "sensor-bindings", FormatInlineGroups(l.SensorBindings), propIndent, false))
		}
	}
	if l.Name != orig.Name && strings.TrimSpace(l.Name) != "" {
		prop := "display-name"
		if node.Prop("display-name") == nil && node.Prop("label") != nil {
			prop = "label" // keep older files consistent with themselves
		}
		edits = append(edits, setProp(src, node, prop, " "+dts.QuoteString(l.Name), propIndent, true))
	}
	return edits
}

func newLayerText(l Layer, name, indent, unit string, grid []GridPos, shape []int) string {
	inner := indent + unit
	var b strings.Builder
	b.WriteString("\n")
	b.WriteString(indent + name + " {\n")
	if l.Name != "" && l.Name != name {
		b.WriteString(inner + "display-name = " + dts.QuoteString(l.Name) + ";\n")
	}
	opts := FormatOptions{Grid: grid, Shape: shape, Indent: inner + unit, CloseIndent: inner}
	b.WriteString(inner + "bindings =" + FormatBindings(l.Bindings, opts) + ";\n")
	if len(l.SensorBindings) > 0 {
		b.WriteString(inner + "sensor-bindings =" + FormatInlineGroups(l.SensorBindings) + ";\n")
	}
	b.WriteString(indent + "};\n")
	return b.String()
}

var nonNameChars = regexp.MustCompile(`[^a-z0-9_]+`)

// sanitizeNodeName turns a display name into a valid node name.
func sanitizeNodeName(s string) string {
	s = nonNameChars.ReplaceAllString(strings.ToLower(strings.TrimSpace(s)), "_")
	s = strings.Trim(s, "_")
	if s == "" || (s[0] >= '0' && s[0] <= '9') {
		s = "n_" + s
	}
	return strings.TrimSuffix(s, "_")
}

func layerNodeName(display string) string {
	s := sanitizeNodeName(display)
	if !strings.HasSuffix(s, "layer") {
		s += "_layer"
	}
	return s
}

func uniqueNodeName(base string, taken map[string]bool) string {
	name := base
	for i := 2; taken[name]; i++ {
		name = fmt.Sprintf("%s_%d", base, i)
	}
	taken[name] = true
	return name
}
