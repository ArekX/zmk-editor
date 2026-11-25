package keymap

import (
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/ArekX/zmk-editor/internal/dts"
)

func comboEdits(src string, f *dts.File, kn *dts.Node, combos []Combo) ([]edit, error) {
	cn := combosNode(f)
	existing := map[string]*dts.Node{}
	taken := map[string]bool{}
	if cn != nil {
		for _, c := range cn.Children {
			existing[c.Name] = c
			taken[c.Name] = true
		}
	}
	var edits []edit
	var added []Combo
	kept := map[string]bool{}
	for _, c := range combos {
		if c.ID == "" {
			added = append(added, c)
			continue
		}
		node, ok := existing[c.ID]
		if !ok {
			return nil, fmt.Errorf("combo %q no longer exists in the file; reload the keymap", c.ID)
		}
		kept[c.ID] = true
		orig := extractCombo(node, f.Defines)
		if orig.ReadOnly {
			continue
		}
		edits = append(edits, updateCombo(src, cn, node, orig, c, taken)...)
	}
	for id, n := range existing {
		if !kept[id] {
			edits = append(edits, removeStatement(src, n.Start, n.End))
		}
	}
	if len(added) == 0 {
		return edits, nil
	}

	if cn != nil {
		unit := detectUnit(src, cn)
		indent := childIndent(src, cn, unit)
		var b strings.Builder
		for _, c := range added {
			b.WriteString(newComboText(c, uniqueNodeName(comboNodeName(c.Name), taken), indent, unit))
		}
		return append(edits, insertBeforeClose(src, cn, b.String())), nil
	}

	// No combos node yet: create one right before the keymap node.
	unit := detectUnit(src, kn)
	indent := indentAt(src, kn.Start)
	var b strings.Builder
	b.WriteString(indent + "combos {\n")
	b.WriteString(indent + unit + "compatible = \"zmk,combos\";\n")
	for _, c := range added {
		b.WriteString(newComboText(c, uniqueNodeName(comboNodeName(c.Name), taken), indent+unit, unit))
	}
	b.WriteString(indent + "};\n\n")
	ls := lineStart(src, kn.Start)
	return append(edits, edit{start: ls, end: ls, text: b.String()}), nil
}

func updateCombo(src string, cn, node *dts.Node, orig, c Combo, taken map[string]bool) []edit {
	unit := detectUnit(src, cn)
	indent := childIndent(src, node, unit)
	var edits []edit
	if !slices.Equal(orig.KeyPositions, c.KeyPositions) {
		edits = append(edits, setProp(src, node, "key-positions", FormatCells(c.KeyPositions), indent, false))
	}
	if strings.TrimSpace(orig.Binding) != strings.TrimSpace(c.Binding) {
		edits = append(edits, setProp(src, node, "bindings", " <"+strings.TrimSpace(c.Binding)+">", indent, false))
	}
	if !slices.Equal(orig.Layers, c.Layers) {
		if len(c.Layers) == 0 {
			edits = append(edits, deleteProp(src, node, "layers")...)
		} else {
			edits = append(edits, setProp(src, node, "layers", FormatCells(c.Layers), indent, false))
		}
	}
	edits = append(edits, optionalIntEdits(src, node, "timeout-ms", orig.TimeoutMs, c.TimeoutMs, indent)...)
	edits = append(edits, optionalIntEdits(src, node, "require-prior-idle-ms", orig.RequirePrior, c.RequirePrior, indent)...)
	if orig.SlowRelease != c.SlowRelease {
		edits = append(edits, setBoolProp(src, node, "slow-release", c.SlowRelease, indent)...)
	}
	if name := comboNodeName(c.Name); c.Name != "" && name != node.Name {
		delete(taken, node.Name)
		name = uniqueNodeName(name, taken)
		edits = append(edits, edit{start: node.NameStart, end: node.NameStart + len(node.Name), text: name})
	}
	return edits
}

func optionalIntEdits(src string, node *dts.Node, name string, orig, next *int, indent string) []edit {
	switch {
	case next == nil && orig != nil:
		return deleteProp(src, node, name)
	case next != nil && (orig == nil || *orig != *next):
		return []edit{setProp(src, node, name, " <"+strconv.Itoa(*next)+">", indent, false)}
	}
	return nil
}

func comboNodeName(name string) string {
	s := sanitizeNodeName(name)
	if s == "n_" {
		return "combo"
	}
	return s
}

func newComboText(c Combo, name, indent, unit string) string {
	inner := indent + unit
	var b strings.Builder
	b.WriteString("\n" + indent + name + " {\n")
	b.WriteString(inner + "key-positions =" + FormatCells(c.KeyPositions) + ";\n")
	b.WriteString(inner + "bindings = <" + strings.TrimSpace(c.Binding) + ">;\n")
	if len(c.Layers) > 0 {
		b.WriteString(inner + "layers =" + FormatCells(c.Layers) + ";\n")
	}
	if c.TimeoutMs != nil {
		b.WriteString(inner + "timeout-ms = <" + strconv.Itoa(*c.TimeoutMs) + ">;\n")
	}
	if c.RequirePrior != nil {
		b.WriteString(inner + "require-prior-idle-ms = <" + strconv.Itoa(*c.RequirePrior) + ">;\n")
	}
	if c.SlowRelease {
		b.WriteString(inner + "slow-release;\n")
	}
	b.WriteString(indent + "};\n")
	return b.String()
}
