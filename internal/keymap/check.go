package keymap

import (
	"encoding/json"
	"fmt"
	"strings"
)

// BuiltinBehavior is an entry of the embedded behavior catalogue
// (internal/zmkdata/behaviors.json).
type BuiltinBehavior struct {
	Code     string   `json:"code"`
	Params   []string `json:"params"`
	Sensor   bool     `json:"sensor"`
	Commands []struct {
		Code             string `json:"code"`
		AdditionalParams []any  `json:"additionalParams"`
	} `json:"commands"`
}

// ParseBuiltins decodes the behavior catalogue keyed by code ("&kp").
func ParseBuiltins(data []byte) (map[string]BuiltinBehavior, error) {
	var list []BuiltinBehavior
	if err := json.Unmarshal(data, &list); err != nil {
		return nil, err
	}
	out := make(map[string]BuiltinBehavior, len(list))
	for _, b := range list {
		out[b.Code] = b
	}
	return out, nil
}

// layerParamBehaviors take a layer index as their first parameter.
var layerParamBehaviors = map[string]bool{"&mo": true, "&lt": true, "&to": true, "&tog": true, "&sl": true}

// Check reports problems that would make ZMK's devicetree build fail or
// misbehave: references to behaviors that do not exist, bindings with the
// wrong number of parameters, layer indexes and key positions out of
// range. external lists references defined outside the file (in included
// .dtsi files); they are accepted without a parameter check.
func Check(km *Keymap, builtins map[string]BuiltinBehavior, external map[string]bool) []string {
	c := checker{km: km, builtins: builtins, external: external, custom: map[string]Behavior{}}
	for _, b := range km.Behaviors {
		c.custom["&"+b.Label] = b
	}
	keys := 0
	if len(km.Layers) > 0 {
		keys = len(km.Layers[0].Bindings)
	}
	for i, l := range km.Layers {
		where := fmt.Sprintf("layer %d (%s)", i, l.Name)
		if len(l.Bindings) != keys {
			c.add("%s has %d bindings, layer 0 has %d", where, len(l.Bindings), keys)
		}
		for k, b := range l.Bindings {
			c.binding(fmt.Sprintf("%s key %d", where, k), b, false)
		}
		for k, b := range l.SensorBindings {
			c.binding(fmt.Sprintf("%s sensor %d", where, k), b, true)
		}
	}
	for _, cb := range km.Combos {
		where := "combo " + cb.Name
		c.binding(where, cb.Binding, false)
		if len(cb.KeyPositions) < 2 && !cb.ReadOnly {
			c.add("%s needs at least two keys", where)
		}
		for _, p := range cb.KeyPositions {
			if p < 0 || p >= keys {
				c.add("%s uses key position %d, the keymap has %d keys", where, p, keys)
			}
		}
		for _, l := range cb.Layers {
			c.layer(where, l)
		}
	}
	for _, cl := range km.ConditionalLayers {
		where := "conditional layer " + cl.Name
		for _, l := range cl.IfLayers {
			c.layer(where, l)
		}
		c.layer(where, cl.Then)
	}
	for _, b := range km.Behaviors {
		c.behavior(b)
	}
	return c.problems
}

type checker struct {
	km       *Keymap
	builtins map[string]BuiltinBehavior
	external map[string]bool
	custom   map[string]Behavior
	problems []string
}

func (c *checker) add(format string, args ...any) {
	c.problems = append(c.problems, fmt.Sprintf(format, args...))
}

func (c *checker) layer(where string, l int) {
	if l < 0 || l >= len(c.km.Layers) {
		c.add("%s refers to layer %d, the keymap has %d layers", where, l, len(c.km.Layers))
	}
}

// expand replaces an object-like #define at the head of a binding.
func (c *checker) expand(binding string) []string {
	fields := strings.Fields(binding)
	for depth := 0; depth < 8 && len(fields) > 0; depth++ {
		def, ok := c.km.Defines[fields[0]]
		if !ok {
			break
		}
		fields = append(strings.Fields(def), fields[1:]...)
	}
	return splitParams(strings.Join(fields, " "))
}

// splitParams splits on spaces outside parentheses.
func splitParams(s string) []string {
	var out []string
	depth := 0
	cur := strings.Builder{}
	for _, r := range s {
		switch {
		case r == '(':
			depth++
		case r == ')':
			depth--
		case (r == ' ' || r == '\t' || r == '\n') && depth == 0:
			if cur.Len() > 0 {
				out = append(out, cur.String())
				cur.Reset()
			}
			continue
		}
		cur.WriteRune(r)
	}
	if cur.Len() > 0 {
		out = append(out, cur.String())
	}
	return out
}

// arity returns how many parameters ref takes and whether it is known.
func (c *checker) arity(ref string, sensor bool, params []string) (lo, hi int, known bool) {
	if b, ok := c.custom[ref]; ok {
		if sensor && b.SensorBindingCells != nil {
			return *b.SensorBindingCells, *b.SensorBindingCells, true
		}
		return b.BindingCells, b.BindingCells, true
	}
	if b, ok := c.builtins[ref]; ok {
		if len(b.Params) == 1 && b.Params[0] == "command" && len(params) > 0 {
			for _, cmd := range b.Commands {
				if cmd.Code == params[0] {
					n := 1 + len(cmd.AdditionalParams)
					return n, n, true
				}
			}
			// Commands written as macros (RGB_COLOR_HSB(...)) expand to
			// more cells; accept one or two tokens.
			return 1, 2, true
		}
		return len(b.Params), len(b.Params), true
	}
	return 0, 0, false
}

func (c *checker) binding(where, binding string, sensor bool) {
	toks := c.expand(binding)
	if len(toks) == 0 || !strings.HasPrefix(toks[0], "&") {
		c.add("%s: %q is not a binding", where, binding)
		return
	}
	ref, params := toks[0], toks[1:]
	if c.external[ref] {
		return
	}
	lo, hi, known := c.arity(ref, sensor, params)
	if !known {
		c.add("%s: unknown behavior %s", where, ref)
		return
	}
	if len(params) < lo || len(params) > hi {
		c.add("%s: %s takes %d parameter(s), got %d (%q)", where, ref, lo, len(params), binding)
		return
	}
	if layerParamBehaviors[ref] && len(params) > 0 {
		if v, ok := resolveParam(params[0], c.km.Defines); ok {
			c.layer(where, v)
		}
	}
}

func resolveParam(s string, defines map[string]string) (int, bool) {
	v := resolveInts([]string{s}, defines)
	if len(v) != 1 {
		return 0, false
	}
	return v[0], true
}

func (c *checker) behavior(b Behavior) {
	where := "behavior &" + b.Label
	switch b.Kind {
	case "hold-tap":
		if len(b.Bindings) != 2 {
			c.add("%s needs exactly two bindings (hold and tap), has %d", where, len(b.Bindings))
		}
		c.bareRefs(where, b.Bindings)
	case "mod-morph":
		if len(b.Bindings) != 2 {
			c.add("%s needs exactly two bindings, has %d", where, len(b.Bindings))
		}
		for _, x := range b.Bindings {
			c.binding(where, x, false)
		}
	case "tap-dance":
		if len(b.Bindings) < 1 {
			c.add("%s needs at least one binding", where)
		}
		for _, x := range b.Bindings {
			c.binding(where, x, false)
		}
	case "sticky-key":
		c.bareRefs(where, b.Bindings)
	case "macro":
		c.macro(where, b)
	case "sensor":
		if b.SensorBindingCells != nil && *b.SensorBindingCells > 0 {
			c.bareRefs(where, b.Bindings)
		} else {
			for _, x := range b.Bindings {
				c.binding(where, x, false)
			}
		}
	}
}

// bareRefs checks bindings such as `<&kp>, <&kp>` that name a behavior
// without parameters.
func (c *checker) bareRefs(where string, bindings []string) {
	for _, x := range bindings {
		toks := c.expand(x)
		if len(toks) != 1 || !strings.HasPrefix(toks[0], "&") {
			c.add("%s: %q should be a behavior without parameters", where, x)
			continue
		}
		if _, _, known := c.arity(toks[0], false, nil); !known && !c.external[toks[0]] {
			c.add("%s: unknown behavior %s", where, toks[0])
		}
	}
}

func (c *checker) macro(where string, b Behavior) {
	want := map[string]int{"zmk,behavior-macro": 0, "zmk,behavior-macro-one-param": 1, "zmk,behavior-macro-two-param": 2}
	cells, ok := want[b.Compatible]
	if !ok {
		c.add("%s has unknown compatible %s", where, b.Compatible)
	} else if cells != b.BindingCells {
		c.add("%s is %s but has #binding-cells = <%d>", where, b.Compatible, b.BindingCells)
	}
	for _, step := range b.Bindings {
		toks := c.expand(step)
		if len(toks) == 0 {
			continue
		}
		if strings.HasPrefix(toks[0], "&macro_param_") {
			from := toks[0][len("&macro_param_")]
			if from-'0' > byte(b.BindingCells) {
				c.add("%s uses parameter %c but only takes %d", where, from, b.BindingCells)
			}
		}
		c.binding(where, step, false)
	}
}
