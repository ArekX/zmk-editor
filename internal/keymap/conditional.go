package keymap

import (
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/ArekX/zmk-editor/internal/dts"
)

func conditionalEdits(src string, f *dts.File, kn *dts.Node, layers []ConditionalLayer) ([]edit, error) {
	cn := conditionalNode(f)
	existing := map[string]*dts.Node{}
	taken := map[string]bool{}
	if cn != nil {
		for _, c := range cn.Children {
			existing[c.Name] = c
			taken[c.Name] = true
		}
	}
	var edits []edit
	var added []ConditionalLayer
	kept := map[string]bool{}
	for _, cl := range layers {
		if len(cl.IfLayers) == 0 && !cl.ReadOnly {
			return nil, fmt.Errorf("conditional layer %q needs at least one \"if\" layer", cl.Name)
		}
		if cl.ID == "" {
			added = append(added, cl)
			continue
		}
		node, ok := existing[cl.ID]
		if !ok {
			return nil, fmt.Errorf("conditional layer %q no longer exists in the file; reload the keymap", cl.ID)
		}
		kept[cl.ID] = true
		orig := extractConditional(node, f.Defines)
		if orig.ReadOnly {
			continue
		}
		unit := detectUnit(src, cn)
		indent := childIndent(src, node, unit)
		if !slices.Equal(orig.IfLayers, cl.IfLayers) {
			edits = append(edits, setProp(src, node, "if-layers", FormatCells(cl.IfLayers), indent, false))
		}
		if orig.Then != cl.Then {
			edits = append(edits, setProp(src, node, "then-layer", " <"+strconv.Itoa(cl.Then)+">", indent, false))
		}
		if name := sanitizeNodeName(cl.Name); strings.TrimSpace(cl.Name) != "" && name != node.Name {
			delete(taken, node.Name)
			name = uniqueNodeName(name, taken)
			edits = append(edits, edit{start: node.NameStart, end: node.NameStart + len(node.Name), text: name})
		}
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
		for _, cl := range added {
			b.WriteString(newConditionalText(cl, uniqueNodeName(sanitizeNodeName(cl.Name), taken), indent, unit))
		}
		return append(edits, insertBeforeClose(src, cn, b.String())), nil
	}
	unit := detectUnit(src, kn)
	indent := indentAt(src, kn.Start)
	var b strings.Builder
	b.WriteString(indent + "conditional_layers {\n")
	b.WriteString(indent + unit + "compatible = \"zmk,conditional-layers\";\n")
	for _, cl := range added {
		b.WriteString(newConditionalText(cl, uniqueNodeName(sanitizeNodeName(cl.Name), taken), indent+unit, unit))
	}
	b.WriteString(indent + "};\n\n")
	ls := lineStart(src, kn.Start)
	return append(edits, edit{start: ls, end: ls, text: b.String()}), nil
}

func newConditionalText(cl ConditionalLayer, name, indent, unit string) string {
	inner := indent + unit
	var b strings.Builder
	b.WriteString("\n" + indent + name + " {\n")
	b.WriteString(inner + "if-layers =" + FormatCells(cl.IfLayers) + ";\n")
	b.WriteString(inner + "then-layer = <" + strconv.Itoa(cl.Then) + ">;\n")
	b.WriteString(indent + "};\n")
	return b.String()
}

// defineEdits rewrites the values of single-line #defines that changed,
// e.g. `#define NAV 2` after layers were reordered.
func defineEdits(f *dts.File, defines map[string]string) []edit {
	var edits []edit
	for name, value := range defines {
		old, ok := f.Defines[name]
		span, located := f.DefineSpans[name]
		value = strings.TrimSpace(value)
		if !ok || !located || old == value || value == "" || strings.ContainsAny(value, "\n\r") {
			continue
		}
		edits = append(edits, edit{start: span.Start, end: span.End, text: value})
	}
	return edits
}
