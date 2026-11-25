package keymap

import (
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/ArekX/zmk-editor/internal/dts"
)

// Apply writes the edited model back into src: changed properties are
// replaced in place, removed nodes deleted, new nodes added. grid
// (optional) is the physical layout's row/col per key, used to format
// bindings tables.
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
	steps := []func() ([]edit, error){
		func() ([]edit, error) { return layerEdits(src, f, kn, updated.Layers, grid) },
		func() ([]edit, error) { return comboEdits(src, f, kn, updated.Combos) },
		func() ([]edit, error) { return behaviorEdits(src, f, kn, updated.Behaviors) },
		func() ([]edit, error) { return overrideEdits(src, f, updated.Overrides) },
		func() ([]edit, error) { return conditionalEdits(src, f, kn, updated.ConditionalLayers) },
		func() ([]edit, error) { return defineEdits(f, updated.Defines), nil },
	}
	for _, step := range steps {
		e, err := step()
		if err != nil {
			return "", err
		}
		edits = append(edits, e...)
	}
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

// layerEdits updates layers in place. Existing layer nodes are "slots":
// when layers were reordered, each slot receives the (edited) text of the
// layer now at that position, so comments and spacing between layers stay
// where they were. Layers beyond the last slot are appended after it.
func layerEdits(src string, f *dts.File, kn *dts.Node, layers []Layer, grid []GridPos) ([]edit, error) {
	unit := detectUnit(src, kn)
	indent := childIndent(src, kn, unit)
	existing := map[string]*dts.Node{}
	var slots []*dts.Node
	taken := map[string]bool{}
	for _, c := range kn.Children {
		existing[c.Name] = c
		taken[c.Name] = true
	}

	used := map[string]bool{}
	var shape []int
	for _, l := range layers {
		if l.ID == "" {
			continue
		}
		node, ok := existing[l.ID]
		if !ok {
			return nil, fmt.Errorf("layer %q no longer exists in the file; reload the keymap", l.ID)
		}
		if used[l.ID] {
			return nil, fmt.Errorf("layer %q appears twice", l.ID)
		}
		used[l.ID] = true
		if shape == nil {
			shape = extractLayer(node, f.Defines).Shape
		}
	}
	var edits []edit
	for _, c := range kn.Children {
		if used[c.Name] {
			slots = append(slots, c)
		} else {
			edits = append(edits, removeStatement(src, c.Start, c.End))
		}
	}

	// text returns the node text for layer l, without leading indentation.
	text := func(l Layer) (string, error) {
		if l.ID == "" {
			name := uniqueNodeName(layerNodeName(l.Name), taken)
			return newLayerNode(l, name, indent, unit, grid, shape), nil
		}
		node := existing[l.ID]
		local := updateLayer(src, node, extractLayer(node, f.Defines), l, grid, unit)
		for i := range local {
			local[i].start -= node.Start
			local[i].end -= node.Start
		}
		return applyEdits(src[node.Start:node.End], local)
	}

	if len(slots) == 0 {
		if len(layers) == 0 {
			return edits, nil
		}
		var b strings.Builder
		for _, l := range layers {
			t, err := text(l)
			if err != nil {
				return nil, err
			}
			b.WriteString("\n" + indent + t + "\n")
		}
		return append(edits, insertBeforeClose(src, kn, b.String())), nil
	}

	inPlace := true
	for i, l := range layers {
		if i >= len(slots) || l.ID != slots[i].Name {
			inPlace = false
			break
		}
	}
	if inPlace {
		// Common case: same order. Edit each layer in place and append
		// new ones after the last existing layer.
		for _, l := range layers[:len(slots)] {
			node := existing[l.ID]
			edits = append(edits, updateLayer(src, node, extractLayer(node, f.Defines), l, grid, unit)...)
		}
		layers = layers[len(slots):]
		var b strings.Builder
		for _, l := range layers {
			t, _ := text(l)
			b.WriteString("\n\n" + indent + t)
		}
		if b.Len() > 0 {
			last := slots[len(slots)-1]
			edits = append(edits, edit{start: last.End, end: last.End, text: b.String()})
		}
		return edits, nil
	}

	for i, slot := range slots {
		var b strings.Builder
		group := layers[i : i+1]
		if i == len(slots)-1 {
			group = layers[i:]
		}
		for j, l := range group {
			t, err := text(l)
			if err != nil {
				return nil, err
			}
			if j > 0 {
				b.WriteString("\n\n" + indent)
			}
			b.WriteString(t)
		}
		edits = append(edits, edit{start: slot.Start, end: slot.End, text: b.String()})
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
			if nl := strings.IndexByte(p.Value, '\n'); nl < 0 {
				value = " <" + strings.Join(l.Bindings, " ") + ">"
			} else if row := p.ValueStart + nl + 1; strings.TrimSpace(src[row:min(row+64, p.ValueEnd)]) != "" {
				// Keep the row indentation the file uses (possibly none).
				opts.Indent = lineIndent(src, row)
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

// newLayerNode renders a layer node from its name to the closing "};",
// for a node whose first line is indented by indent.
func newLayerNode(l Layer, name, indent, unit string, grid []GridPos, shape []int) string {
	inner := indent + unit
	var b strings.Builder
	b.WriteString(name + " {\n")
	if l.Name != "" && l.Name != name {
		b.WriteString(inner + "display-name = " + dts.QuoteString(l.Name) + ";\n")
	}
	opts := FormatOptions{Grid: grid, Shape: shape, Indent: inner + unit, CloseIndent: inner}
	b.WriteString(inner + "bindings =" + FormatBindings(l.Bindings, opts) + ";\n")
	if len(l.SensorBindings) > 0 {
		b.WriteString(inner + "sensor-bindings =" + FormatInlineGroups(l.SensorBindings) + ";\n")
	}
	b.WriteString(indent + "};")
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
