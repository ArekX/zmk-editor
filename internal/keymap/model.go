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
	Ref                string   `json:"ref"` // "&label"
	NodeName           string   `json:"node_name"`
	Compatible         string   `json:"compatible"`
	Kind               string   `json:"kind"` // hold-tap, macro, tap-dance, mod-morph, sensor, other
	DisplayName        string   `json:"display_name"`
	BindingCells       int      `json:"binding_cells"`
	SensorBindingCells *int     `json:"sensor_binding_cells"`
	Bindings           []string `json:"bindings"`
	Source             string   `json:"source"`
}

// ConditionalLayer is a child of `zmk,conditional-layers` (read-only).
type ConditionalLayer struct {
	Name     string `json:"name"`
	IfLayers []int  `json:"if_layers"`
	Then     int    `json:"then_layer"`
}
