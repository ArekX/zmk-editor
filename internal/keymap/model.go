// Package keymap extracts an editable model (layers, combos, custom
// behaviors) from a ZMK .keymap file and writes edits back by splicing only
// the properties and nodes that changed. Everything else in the file
// (comments, includes, macros, behavior definitions, formatting) is left
// byte-for-byte intact.
package keymap

// Keymap is the editable model of one .keymap file.
type Keymap struct {
	Layers            []Layer            `json:"layers"`
	Combos            []Combo            `json:"combos"`
	Behaviors         []Behavior         `json:"behaviors"`
	Overrides         []Override         `json:"overrides"`
	ConditionalLayers []ConditionalLayer `json:"conditional_layers"`
	Defines           map[string]string  `json:"defines"`
	Includes          []string           `json:"includes"`
	Warnings          []string           `json:"warnings"`
}

// Layer is a child of the `zmk,keymap` node.
type Layer struct {
	// ID is the devicetree node name. Empty for layers created in the UI.
	ID    string `json:"id"`
	Label string `json:"label,omitempty"`
	// Name is display-name, falling back to the legacy label property and
	// then the node name.
	Name     string   `json:"name"`
	Bindings []string `json:"bindings"`
	// SensorBindings is nil when the layer has no sensor-bindings property.
	SensorBindings []string `json:"sensor_bindings"`
	// Shape is the number of bindings on each source line, used to keep the
	// file's row layout when no physical layout with row/col is known.
	Shape []int `json:"shape,omitempty"`
}

// Combo is a child of the `zmk,combos` node.
type Combo struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	KeyPositions []int  `json:"key_positions"`
	Binding      string `json:"binding"`
	// Layers is empty when the combo is active on every layer.
	Layers       []int `json:"layers"`
	TimeoutMs    *int  `json:"timeout_ms"`
	RequirePrior *int  `json:"require_prior_idle_ms"`
	SlowRelease  bool  `json:"slow_release"`
	// ReadOnly is set when positions or layers use expressions the editor
	// cannot resolve; such combos are shown but never rewritten.
	ReadOnly bool `json:"read_only"`
}

// Behavior is a behavior or macro node defined in the keymap itself.
type Behavior struct {
	// ID is the label the node had when the file was read ("" for
	// behaviors created in the UI). Label is the current one; renaming a
	// behavior changes Label and keeps ID.
	ID                 string   `json:"id"`
	Label              string   `json:"label"`
	Ref                string   `json:"ref"` // "&label" as read
	NodeName           string   `json:"node_name"`
	Compatible         string   `json:"compatible"`
	Kind               string   `json:"kind"` // hold-tap, macro, tap-dance, mod-morph, sticky-key, sensor, other
	DisplayName        string   `json:"display_name"`
	BindingCells       int      `json:"binding_cells"`
	SensorBindingCells *int     `json:"sensor_binding_cells"`
	Bindings           []string `json:"bindings"`
	// Props are every other property (flavor, tapping-term-ms, ...).
	Props  []Prop `json:"props"`
	Source string `json:"source"`
}

// Override is a top-level `&label { ... };` node changing properties of a
// node defined elsewhere, typically a built-in behavior (`&mt`).
type Override struct {
	ID    string `json:"id"`  // the reference as read ("" for new)
	Ref   string `json:"ref"` // "&mt"
	Props []Prop `json:"props"`
}

// Prop is one devicetree property in an editable form.
type Prop struct {
	Name string `json:"name"`
	// Type is "bool" (no value), "cells" (one <...> group; Value is its
	// cells separated by single spaces), "string" (Value is unquoted) or
	// "raw" (Value is the devicetree text as written).
	Type  string `json:"type"`
	Value string `json:"value"`
}

// ConditionalLayer is a child of `zmk,conditional-layers`.
type ConditionalLayer struct {
	ID       string `json:"id"` // node name as read ("" for new)
	Name     string `json:"name"`
	IfLayers []int  `json:"if_layers"`
	Then     int    `json:"then_layer"`
	// ReadOnly is set when layers use expressions the editor cannot
	// resolve.
	ReadOnly bool `json:"read_only"`
}
