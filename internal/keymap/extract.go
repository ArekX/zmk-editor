package keymap

import (
	"strings"

	"github.com/ArekX/zmk-editor/internal/dts"
)

// Parse parses keymap source into the editable model.
func Parse(src string) (*Keymap, *dts.File, error) {
	f, err := dts.Parse(src)
	if err != nil {
		return nil, nil, err
	}
	km := &Keymap{
		Layers:            []Layer{},
		Combos:            []Combo{},
		Behaviors:         []Behavior{},
		Overrides:         []Override{},
		ConditionalLayers: []ConditionalLayer{},
		Defines:           f.Defines,
		Includes:          f.Includes,
		Warnings:          append([]string{}, f.Warnings...),
	}
	if km.Includes == nil {
		km.Includes = []string{}
	}

	if node := keymapNode(f); node != nil {
		for _, c := range node.Children {
			km.Layers = append(km.Layers, extractLayer(c, f.Defines))
		}
	} else {
		km.Warnings = append(km.Warnings, `no node with compatible = "zmk,keymap" found`)
	}
	if node := combosNode(f); node != nil {
		for _, c := range node.Children {
			km.Combos = append(km.Combos, extractCombo(c, f.Defines))
		}
	}
	if n := conditionalNode(f); n != nil {
		for _, c := range n.Children {
			km.ConditionalLayers = append(km.ConditionalLayers, extractConditional(c, f.Defines))
		}
	}
	f.Walk(func(n *dts.Node) {
		if b, ok := extractBehavior(n, f); ok {
			km.Behaviors = append(km.Behaviors, b)
		}
	})
	for _, n := range overrideNodes(f) {
		km.Overrides = append(km.Overrides, Override{ID: n.Name, Ref: n.Name, Props: extractProps(n, nil)})
	}
	return km, f, nil
}

func conditionalNode(f *dts.File) *dts.Node {
	if nodes := f.FindCompatible("zmk,conditional-layers"); len(nodes) > 0 {
		return nodes[0]
	}
	return nil
}

func extractConditional(c *dts.Node, defines map[string]string) ConditionalLayer {
	cl := ConditionalLayer{ID: c.Name, Name: c.Name, IfLayers: []int{}}
	cells := propCells(c, "if-layers")
	cl.IfLayers = resolveInts(cells, defines)
	then := propCells(c, "then-layer")
	v := resolveInts(then, defines)
	if len(v) == 1 {
		cl.Then = v[0]
	}
	if len(cl.IfLayers) != len(cells) || len(v) != 1 || len(then) != 1 {
		cl.ReadOnly = true
	}
	return cl
}

// overrideNodes are top-level `&label { ... };` nodes without children.
func overrideNodes(f *dts.File) []*dts.Node {
	var out []*dts.Node
	for _, n := range f.Nodes {
		if strings.HasPrefix(n.Name, "&") && !strings.HasPrefix(n.Name, "&{") && len(n.Children) == 0 {
			out = append(out, n)
		}
	}
	return out
}

// structuralProps are handled by dedicated Behavior fields.
var structuralProps = map[string]bool{
	"compatible": true, "#binding-cells": true, "#sensor-binding-cells": true,
	"bindings": true, "label": true, "display-name": true,
}

// extractProps returns n's properties as Props, skipping names in skip.
func extractProps(n *dts.Node, skip map[string]bool) []Prop {
	props := []Prop{}
	for _, p := range n.Props {
		if skip[p.Name] {
			continue
		}
		props = append(props, propOf(p))
	}
	return props
}

func propOf(p *dts.Property) Prop {
	if p.ValueStart < 0 {
		return Prop{Name: p.Name, Type: "bool"}
	}
	raw := strings.TrimSpace(p.Value)
	clean := strings.TrimSpace(dts.StripComments(raw))
	if groups := dts.CellGroups(clean); len(groups) == 1 && strings.HasPrefix(clean, "<") && strings.HasSuffix(clean, ">") {
		return Prop{Name: p.Name, Type: "cells", Value: joinCells(groups[0])}
	}
	if strings.HasPrefix(clean, `"`) && strings.Count(clean, `"`) == 2 && strings.HasSuffix(clean, `"`) {
		s, _ := dts.ParseString(clean)
		return Prop{Name: p.Name, Type: "string", Value: s}
	}
	return Prop{Name: p.Name, Type: "raw", Value: raw}
}

func joinCells(group string) string {
	toks := dts.Tokenize(group)
	parts := make([]string, len(toks))
	for i, t := range toks {
		parts[i] = t.Text
	}
	return strings.Join(parts, " ")
}

func keymapNode(f *dts.File) *dts.Node {
	if nodes := f.FindCompatible("zmk,keymap"); len(nodes) > 0 {
		return nodes[0]
	}
	return nil
}

func combosNode(f *dts.File) *dts.Node {
	if nodes := f.FindCompatible("zmk,combos"); len(nodes) > 0 {
		return nodes[0]
	}
	return nil
}

func extractLayer(n *dts.Node, defines map[string]string) Layer {
	l := Layer{ID: n.Name, Bindings: []string{}}
	if len(n.Labels) > 0 {
		l.Label = n.Labels[0]
	}
	l.Name = layerName(n)
	if p := n.Prop("bindings"); p != nil {
		l.Bindings, l.Shape = SplitBindings(p.Value, defines)
	}
	if p := n.Prop("sensor-bindings"); p != nil {
		l.SensorBindings, _ = SplitBindings(p.Value, defines)
	}
	return l
}

func layerName(n *dts.Node) string {
	if v := n.StringProp("display-name"); v != "" {
		return v
	}
	if v := n.StringProp("label"); v != "" {
		return v
	}
	return n.Name
}

func extractCombo(n *dts.Node, defines map[string]string) Combo {
	c := Combo{ID: n.Name, Name: n.Name, KeyPositions: []int{}, Layers: []int{}}
	positions := propCells(n, "key-positions")
	c.KeyPositions = resolveInts(positions, defines)
	if len(c.KeyPositions) != len(positions) {
		c.ReadOnly = true
	}
	if p := n.Prop("bindings"); p != nil {
		b, _ := SplitBindings(p.Value, defines)
		c.Binding = strings.Join(b, " ")
	}
	if cells := propCells(n, "layers"); len(cells) > 0 {
		c.Layers = resolveInts(cells, defines)
		if len(c.Layers) != len(cells) {
			c.ReadOnly = true
		}
	}
	c.TimeoutMs = optionalInt(n, "timeout-ms", defines)
	c.RequirePrior = optionalInt(n, "require-prior-idle-ms", defines)
	c.SlowRelease = n.Prop("slow-release") != nil
	return c
}

func optionalInt(n *dts.Node, name string, defines map[string]string) *int {
	v := resolveInts(propCells(n, name), defines)
	if len(v) != 1 {
		return nil
	}
	return &v[0]
}

// propCells returns every cell token of a property (all groups).
func propCells(n *dts.Node, name string) []string {
	p := n.Prop(name)
	if p == nil {
		return nil
	}
	var out []string
	for _, g := range dts.CellGroups(p.Value) {
		for _, t := range dts.Tokenize(g) {
			out = append(out, t.Text)
		}
	}
	return out
}

func resolveInts(cells []string, defines map[string]string) []int {
	out := []int{}
	for _, c := range cells {
		v, ok := dts.ResolveInt(c, defines)
		if !ok {
			continue
		}
		out = append(out, int(v))
	}
	return out
}

func extractBehavior(n *dts.Node, f *dts.File) (Behavior, bool) {
	compatible := n.StringProp("compatible")
	if !strings.HasPrefix(compatible, "zmk,behavior-") || len(n.Labels) == 0 {
		return Behavior{}, false
	}
	b := Behavior{
		ID:          n.Labels[0],
		Label:       n.Labels[0],
		Ref:         "&" + n.Labels[0],
		NodeName:    n.Name,
		Compatible:  compatible,
		Kind:        behaviorKind(compatible),
		DisplayName: n.StringProp("display-name"),
		Bindings:    []string{},
		Props:       extractProps(n, structuralProps),
		Source:      f.Src[n.Start:n.End],
	}
	if b.DisplayName == "" {
		b.DisplayName = n.StringProp("label")
	}
	if v := resolveInts(propCells(n, "#binding-cells"), f.Defines); len(v) == 1 {
		b.BindingCells = v[0]
	}
	if v := resolveInts(propCells(n, "#sensor-binding-cells"), f.Defines); len(v) == 1 {
		b.SensorBindingCells = &v[0]
		b.Kind = "sensor"
	}
	if p := n.Prop("bindings"); p != nil {
		b.Bindings, _ = SplitBindings(p.Value, f.Defines)
	}
	return b, true
}

func behaviorKind(compatible string) string {
	switch {
	case compatible == "zmk,behavior-hold-tap":
		return "hold-tap"
	case strings.HasPrefix(compatible, "zmk,behavior-macro"):
		return "macro"
	case compatible == "zmk,behavior-tap-dance":
		return "tap-dance"
	case compatible == "zmk,behavior-mod-morph":
		return "mod-morph"
	case compatible == "zmk,behavior-sticky-key":
		return "sticky-key"
	case strings.HasPrefix(compatible, "zmk,behavior-sensor-rotate"):
		return "sensor"
	default:
		return "other"
	}
}

// SplitBindings splits a bindings value into one string per binding
// ("&kp A", "&mt LSHIFT B") and reports how many bindings start on each
// source line of the first cell group. A new binding starts at every
// &reference, or at a macro name that expands to one (e.g. `___` for
// &trans).
func SplitBindings(value string, defines map[string]string) ([]string, []int) {
	bindings := []string{}
	var shape []int
	for gi, group := range dts.CellGroups(value) {
		var cur []string
		lastLine := -1
		flush := func() {
			if len(cur) > 0 {
				bindings = append(bindings, strings.Join(cur, " "))
				cur = nil
			}
		}
		for _, t := range dts.Tokenize(group) {
			if len(cur) == 0 || startsBinding(t.Text, defines) {
				flush()
				if gi == 0 {
					if t.Line != lastLine {
						shape = append(shape, 0)
						lastLine = t.Line
					}
					shape[len(shape)-1]++
				}
			}
			cur = append(cur, t.Text)
		}
		flush()
	}
	return bindings, shape
}

func startsBinding(tok string, defines map[string]string) bool {
	for depth := 0; depth < 8; depth++ {
		if strings.HasPrefix(tok, "&") {
			return true
		}
		next, ok := defines[tok]
		if !ok {
			return false
		}
		tok = strings.TrimSpace(next)
	}
	return false
}
