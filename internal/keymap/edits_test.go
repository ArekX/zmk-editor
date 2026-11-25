package keymap

import (
	"slices"
	"strings"
	"testing"
)

// edit parses a fixture, applies fn to the model and checks the result
// still builds.
func editFixture(t *testing.T, fixture string, fn func(km *Keymap)) (string, *Keymap) {
	t.Helper()
	src := readFixture(t, fixture)
	km, _, err := Parse(src)
	if err != nil {
		t.Fatal(err)
	}
	fn(km)
	out, err := Apply(src, km, nil)
	if err != nil {
		t.Fatal(err)
	}
	return out, assertCompiles(t, fixture, src, out)
}

func behavior(km *Keymap, label string) *Behavior {
	for i := range km.Behaviors {
		if km.Behaviors[i].Label == label {
			return &km.Behaviors[i]
		}
	}
	return nil
}

func prop(b *Behavior, name string) *Prop {
	for i := range b.Props {
		if b.Props[i].Name == name {
			return &b.Props[i]
		}
	}
	return nil
}

func mustContain(t *testing.T, out string, parts ...string) {
	t.Helper()
	for _, p := range parts {
		if !strings.Contains(out, p) {
			t.Fatalf("missing %q in:\n%s", p, out)
		}
	}
}

func mustNotContain(t *testing.T, out string, parts ...string) {
	t.Helper()
	for _, p := range parts {
		if strings.Contains(out, p) {
			t.Fatalf("unexpected %q in:\n%s", p, out)
		}
	}
}

func TestFixturesBuildAndRoundTrip(t *testing.T) {
	for name := range fixtures {
		t.Run(name, func(t *testing.T) {
			src := readFixture(t, name)
			km, _, err := Parse(src)
			if err != nil {
				t.Fatal(err)
			}
			out, err := Apply(src, km, nil)
			if err != nil {
				t.Fatal(err)
			}
			if out != src {
				t.Fatal("unchanged model rewrote the file")
			}
			assertCompiles(t, name, src, out)
		})
	}
}

func TestParseSampleShapes(t *testing.T) {
	km, _, _ := Parse(readFixture(t, "split36.keymap"))
	if len(km.Layers) != 4 || km.Layers[0].ID != "Base" || len(km.Layers[0].Bindings) != 36 {
		t.Fatalf("layers: %+v", km.Layers[0])
	}
	hrl := behavior(km, "hrl")
	if hrl == nil || hrl.Kind != "hold-tap" || hrl.DisplayName != "Home Row Left" {
		t.Fatalf("hrl: %+v", hrl)
	}
	if p := prop(hrl, "flavor"); p == nil || p.Type != "string" || p.Value != "balanced" {
		t.Fatalf("flavor: %+v", p)
	}
	if p := prop(hrl, "hold-trigger-on-release"); p == nil || p.Type != "bool" {
		t.Fatalf("bool prop: %+v", p)
	}
	if p := prop(behavior(km, "bspc_del"), "mods"); p == nil || p.Type != "cells" || p.Value != "(MOD_LSFT|MOD_RSFT)" {
		t.Fatalf("mods: %+v", p)
	}
	if km.Combos[0].Layers[1] != 1 {
		t.Fatalf("combo layers through defines: %v", km.Combos[0].Layers)
	}

	wide, _, _ := Parse(readFixture(t, "wide.keymap"))
	if len(wide.Overrides) != 1 || wide.Overrides[0].Ref != "&mt" || len(wide.Overrides[0].Props) != 2 {
		t.Fatalf("overrides: %+v", wide.Overrides)
	}
	hm := behavior(wide, "hm")
	if hm.DisplayName != "HOMEROW_MODS" || prop(hm, "quick_tap_ms") == nil {
		t.Fatalf("hm: %+v", hm)
	}
}

func TestEditHoldTapProperties(t *testing.T) {
	out, km := editFixture(t, "split36.keymap", func(km *Keymap) {
		b := behavior(km, "hrl")
		prop(b, "tapping-term-ms").Value = "220"
		prop(b, "flavor").Value = "tap-preferred"
		b.Props = slices.DeleteFunc(b.Props, func(p Prop) bool { return p.Name == "quick-tap-ms" || p.Name == "hold-trigger-on-release" })
		b.Props = append(b.Props, Prop{Name: "require-prior-idle-ms", Type: "cells", Value: "125"}, Prop{Name: "retro-tap", Type: "bool"})
		b.DisplayName = "Left Mods"
	})
	mustContain(t, out,
		"tapping-term-ms = <220>;", `flavor = "tap-preferred";`, `display-name = "Left Mods";`,
		"require-prior-idle-ms = <125>;", "retro-tap;",
		"// Keep quick-tap short so repeated letters still type.",
		"// Home row mods, left hand.")
	mustNotContain(t, out, "quick-tap-ms = <150>", "hold-trigger-on-release")
	// The right-hand behavior is untouched.
	mustContain(t, out, "hrr: home_row_right {\n            compatible = \"zmk,behavior-hold-tap\";\n            display-name = \"Home Row Right\";")
	if p := prop(behavior(km, "hrl"), "retro-tap"); p == nil {
		t.Fatal("retro-tap not read back")
	}
}

func TestRenameBehaviorUpdatesReferences(t *testing.T) {
	out, _ := editFixture(t, "split36.keymap", func(km *Keymap) {
		behavior(km, "hrl").Label = "lhm"
		// The editor rewrites references in the model.
		for li := range km.Layers {
			for k, b := range km.Layers[li].Bindings {
				km.Layers[li].Bindings[k] = strings.Replace(b, "&hrl ", "&lhm ", 1)
			}
		}
	})
	mustContain(t, out, "lhm: home_row_left {", "&lhm LGUI A")
	mustNotContain(t, out, "&hrl", "hrl:")
}

func TestRenameToTakenLabelFails(t *testing.T) {
	src := readFixture(t, "split36.keymap")
	km, _, _ := Parse(src)
	behavior(km, "hrl").Label = "hrr"
	if _, err := Apply(src, km, nil); err == nil {
		t.Fatal("duplicate label accepted")
	}
	km, _, _ = Parse(src)
	behavior(km, "hrl").Label = "1bad"
	if _, err := Apply(src, km, nil); err == nil {
		t.Fatal("invalid label accepted")
	}
}

func TestDeleteBehavior(t *testing.T) {
	out, km := editFixture(t, "split36.keymap", func(km *Keymap) {
		km.Behaviors = slices.DeleteFunc(km.Behaviors, func(b Behavior) bool { return b.Label == "td_caps" })
		km.Layers[0].Bindings[30] = "&kp LSHFT"
	})
	mustNotContain(t, out, "td_caps", "tap_dance_caps")
	if len(km.Behaviors) != 4 {
		t.Fatalf("behaviors: %d", len(km.Behaviors))
	}
}

func TestAddBehaviorsOfEveryKind(t *testing.T) {
	one := 1
	_ = one
	added := []Behavior{
		{Label: "spc_nav", Kind: "hold-tap", Compatible: "zmk,behavior-hold-tap", BindingCells: 2,
			Bindings: []string{"&mo", "&kp"},
			Props:    []Prop{{Name: "flavor", Type: "string", Value: "balanced"}, {Name: "tapping-term-ms", Type: "cells", Value: "200"}, {Name: "hold-trigger-key-positions", Type: "cells", Value: "1 2 3"}}},
		{Label: "dot_colon", Kind: "mod-morph", Compatible: "zmk,behavior-mod-morph", Bindings: []string{"&kp DOT", "&kp COLON"},
			Props: []Prop{{Name: "mods", Type: "cells", Value: "(MOD_LSFT|MOD_RSFT)"}}},
		{Label: "td_q", Kind: "tap-dance", Compatible: "zmk,behavior-tap-dance", Bindings: []string{"&kp Q", "&kp ESC", "&bootloader"}},
		{Label: "shifted", Kind: "macro", Compatible: "zmk,behavior-macro-one-param", BindingCells: 1, DisplayName: "Shifted key",
			Bindings: []string{"&macro_press", "&kp LSHFT", "&macro_tap", "&macro_param_1to1", "&kp MACRO_PLACEHOLDER", "&macro_release", "&kp LSHFT"},
			Props:    []Prop{{Name: "wait-ms", Type: "cells", Value: "10"}}},
		{Label: "skey", Kind: "sticky-key", Compatible: "zmk,behavior-sticky-key", BindingCells: 1, Bindings: []string{"&kp"},
			Props: []Prop{{Name: "release-after-ms", Type: "cells", Value: "1000"}, {Name: "quick-release", Type: "bool"}}},
	}
	use := func(km *Keymap) {
		km.Behaviors = append(km.Behaviors, added...)
		last := len(km.Layers) - 1
		km.Layers[last].Bindings[0] = "&spc_nav 1 SPACE"
		km.Layers[last].Bindings[1] = "&dot_colon"
		km.Layers[last].Bindings[2] = "&td_q"
		km.Layers[last].Bindings[3] = "&shifted A"
		km.Layers[last].Bindings[4] = "&skey LSHFT"
	}

	// Into an existing behaviors node.
	out, _ := editFixture(t, "split36.keymap", use)
	mustContain(t, out,
		"        spc_nav: spc_nav {\n            compatible = \"zmk,behavior-hold-tap\";\n            #binding-cells = <2>;\n            bindings = <&mo>, <&kp>;",
		"bindings = <&macro_press>, <&kp LSHFT>, <&macro_tap>, <&macro_param_1to1 &kp MACRO_PLACEHOLDER>, <&macro_release>, <&kp LSHFT>;",
		`display-name = "Shifted key";`, "quick-release;", "mods = <(MOD_LSFT|MOD_RSFT)>;")

	// A macro goes into the existing macros node of corne.keymap.
	out, _ = editFixture(t, "corne.keymap", use)
	if strings.Index(out, "shifted: shifted") > strings.Index(out, "  behaviors {") {
		t.Fatalf("macro not placed under macros:\n%s", out)
	}

	// A file without any container gets a behaviors node.
	out, _ = editFixture(t, "minimal.keymap", func(km *Keymap) {
		km.Behaviors = append(km.Behaviors, added[0], added[3])
		km.Layers[1].Bindings[0] = "&spc_nav 1 SPACE"
		km.Layers[1].Bindings[1] = "&shifted B"
	})
	mustContain(t, out, "\tbehaviors {\n\t\tspc_nav: spc_nav {\n\t\t\tcompatible")
}

func TestEditMacroKeepsBindingStyle(t *testing.T) {
	// Leading-comma multi-line style.
	out, _ := editFixture(t, "corne.keymap", func(km *Keymap) {
		b := behavior(km, "shift")
		b.Bindings = append(b.Bindings[:3], "&macro_param_1to1", "&kp MACRO_PLACEHOLDER", "&macro_wait_time 20", "&macro_release", "&kp LSHFT")
	})
	mustContain(t, out, "      bindings\n        = <&macro_press>\n        , <&kp LSHFT>\n        , <&macro_tap>\n        , <&macro_param_1to1 &kp MACRO_PLACEHOLDER>\n        , <&macro_wait_time 20>\n        , <&macro_release>\n        , <&kp LSHFT>\n        ;")

	// Inline style, and switching a macro to take a parameter.
	out, _ = editFixture(t, "wide.keymap", func(km *Keymap) {
		b := behavior(km, "wrap_parens")
		b.Compatible = "zmk,behavior-macro-one-param"
		b.BindingCells = 1
		b.Bindings = []string{"&kp LPAR", "&macro_param_1to1", "&kp MACRO_PLACEHOLDER", "&kp RPAR"}
		km.Layers[0].Bindings[slices.Index(km.Layers[0].Bindings, "&wrap_parens")] = "&wrap_parens SPACE"
	})
	mustContain(t, out, `compatible = "zmk,behavior-macro-one-param";`, "#binding-cells = <1>;",
		"bindings = <&kp LPAR>, <&macro_param_1to1 &kp MACRO_PLACEHOLDER>, <&kp RPAR>;", "&wrap_parens SPACE")
}

func TestOverrides(t *testing.T) {
	out, km := editFixture(t, "wide.keymap", func(km *Keymap) {
		km.Overrides[0].Props[0].Value = "180"
		km.Overrides = append(km.Overrides, Override{Ref: "&sk", Props: []Prop{{Name: "release-after-ms", Type: "cells", Value: "900"}}})
	})
	mustContain(t, out, "&mt {\n    tapping-term-ms = <180>;", "&sk {\n    release-after-ms = <900>;\n};\n\n/ {")
	if len(km.Overrides) != 2 {
		t.Fatalf("%+v", km.Overrides)
	}

	out, km = editFixture(t, "wide.keymap", func(km *Keymap) { km.Overrides = nil })
	mustNotContain(t, out, "&mt {")
	if len(km.Overrides) != 0 {
		t.Fatal("override kept")
	}

	// An override whose body is on one line (/delete-property/ only).
	out, _ = editFixture(t, "corne.keymap", func(km *Keymap) {
		km.Overrides[0].Props = append(km.Overrides[0].Props, Prop{Name: "lazy", Type: "bool"})
	})
	mustContain(t, out, "/delete-property/ ignore-modifiers;", "lazy;")
}

func TestConditionalLayers(t *testing.T) {
	out, km := editFixture(t, "corne.keymap", func(km *Keymap) {
		km.ConditionalLayers[0].Then = 4
		km.ConditionalLayers = append(km.ConditionalLayers, ConditionalLayer{Name: "auto", IfLayers: []int{0, 3}, Then: 4})
	})
	mustContain(t, out, "then-layer = <4>;", "    auto {\n      if-layers = <0 3>;\n      then-layer = <4>;\n    };")
	if len(km.ConditionalLayers) != 2 {
		t.Fatal(km.ConditionalLayers)
	}

	out, _ = editFixture(t, "minimal.keymap", func(km *Keymap) {
		km.Layers = append(km.Layers, Layer{Name: "Adjust", Bindings: slices.Repeat([]string{"&trans"}, 6)})
		km.ConditionalLayers = []ConditionalLayer{{Name: "tri", IfLayers: []int{0, 1}, Then: 2}}
	})
	mustContain(t, out, "\tconditional_layers {\n\t\tcompatible = \"zmk,conditional-layers\";\n\n\t\ttri {")

	out, _ = editFixture(t, "corne.keymap", func(km *Keymap) { km.ConditionalLayers = nil })
	mustNotContain(t, out, "tri_layer")
}

func TestReorderLayersKeepsComments(t *testing.T) {
	out, km := editFixture(t, "split36.keymap", func(km *Keymap) {
		// Move Navigation (2) before Numbers (1), as the editor does:
		// reorder, then renumber references and layer defines.
		km.Layers[1], km.Layers[2] = km.Layers[2], km.Layers[1]
		km.Defines["NUM"] = "2"
		km.Defines["NAV"] = "1"
	})
	ids := []string{}
	for _, l := range km.Layers {
		ids = append(ids, l.ID)
	}
	if !slices.Equal(ids, []string{"Base", "Navigation", "Numbers", "System"}) {
		t.Fatalf("order: %v", ids)
	}
	mustContain(t, out, "#define NUM 2\n#define NAV 1", "// | Q | W | E | R | T |", "&tlt NUM TAB")
	if km.Combos[0].Layers[1] != 2 {
		t.Fatalf("combo layer through define: %v", km.Combos[0].Layers)
	}
}

func TestReorderWithNumericReferencesAndNewLayers(t *testing.T) {
	out, km := editFixture(t, "wide.keymap", func(km *Keymap) {
		// [Base, Keypad, Fn, Mod] -> [Base, New, Mod, Fn] with Keypad
		// deleted; references renumbered by the caller.
		base, fn, mod := km.Layers[0], km.Layers[2], km.Layers[3]
		renumber := map[string]string{"&tog 1": "&tog 0", "&mo 3": "&mo 2", "&mo 2": "&mo 3"}
		for _, l := range []*Layer{&base, &fn, &mod} {
			for i, b := range l.Bindings {
				if r, ok := renumber[b]; ok {
					l.Bindings[i] = r
				}
			}
		}
		fresh := Layer{Name: "Mouse", Bindings: slices.Repeat([]string{"&trans"}, len(base.Bindings))}
		km.Layers = []Layer{base, fresh, mod, fn}
	})
	names := []string{}
	for _, l := range km.Layers {
		names = append(names, l.Name)
	}
	if !slices.Equal(names, []string{"Base", "Mouse", "Mod", "Fn"}) {
		t.Fatalf("order: %v", names)
	}
	mustNotContain(t, out, "keypad {")
	mustContain(t, out, "mouse_layer {")
}

func TestSwapAcrossLayers(t *testing.T) {
	out, km := editFixture(t, "split36.keymap", func(km *Keymap) {
		a, b := km.Layers[0].Bindings[0], km.Layers[3].Bindings[9]
		km.Layers[0].Bindings[0], km.Layers[3].Bindings[9] = b, a
	})
	if km.Layers[0].Bindings[0] != "&bootloader" || km.Layers[3].Bindings[9] != "&kp Q" {
		t.Fatalf("%v %v", km.Layers[0].Bindings[0], km.Layers[3].Bindings[9])
	}
	// Single-line layers stay on one line.
	mustContain(t, out, "\n&bootloader  &kp W  &kp E")
}

func TestCheckFindsProblems(t *testing.T) {
	km, _, _ := Parse(readFixture(t, "split36.keymap"))
	km.Layers[0].Bindings[0] = "&kp"
	km.Layers[0].Bindings[1] = "&nope A"
	km.Layers[0].Bindings[2] = "&mo 9"
	km.Layers[0].Bindings[3] = "&hrl A"
	km.Combos[0].KeyPositions = []int{0, 99}
	behavior(km, "bspc_del").Bindings = []string{"&kp BSPC"}
	problems := Check(km, builtins(t), nil)
	want := []string{"&kp takes 1", "unknown behavior &nope", "refers to layer 9", "&hrl takes 2", "key position 99", "exactly two bindings"}
	for _, w := range want {
		if !slices.ContainsFunc(problems, func(p string) bool { return strings.Contains(p, w) }) {
			t.Errorf("no problem mentioning %q in %v", w, problems)
		}
	}
}
