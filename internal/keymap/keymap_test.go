package keymap

import (
	"os"
	"strings"
	"testing"
)

func loadFixture(t *testing.T) string {
	t.Helper()
	b, err := os.ReadFile("testdata/corne.keymap")
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestParseCorne(t *testing.T) {
	km, _, err := Parse(loadFixture(t))
	if err != nil {
		t.Fatal(err)
	}
	if len(km.Layers) != 5 {
		t.Fatalf("layers: %d", len(km.Layers))
	}
	base := km.Layers[0]
	if base.ID != "base" || len(base.Bindings) != 42 {
		t.Fatalf("base: %s %d", base.ID, len(base.Bindings))
	}
	if base.Bindings[13] != "&hrm_l LGUI A" {
		t.Fatalf("binding 13: %q", base.Bindings[13])
	}
	if base.Bindings[40] != "&lyr_rgb 2 RGB_COLOR_HSB_VAL(200,80,60)" {
		t.Fatalf("binding 40: %q", base.Bindings[40])
	}
	if got := base.Shape; len(got) != 4 || got[0] != 12 || got[3] != 6 {
		t.Fatalf("shape: %v", got)
	}
	if len(base.SensorBindings) != 2 || base.SensorBindings[1] != "&enc_rgb RGB_HUI RGB_HUD" {
		t.Fatalf("sensor: %v", base.SensorBindings)
	}
	if km.Layers[2].SensorBindings != nil {
		t.Fatal("nav should have no sensor bindings")
	}
	if len(km.Combos) != 7 || km.Combos[0].KeyPositions[1] != 2 || km.Combos[0].Binding != "&kp ESC" {
		t.Fatalf("combos: %+v", km.Combos)
	}
	refs := map[string]Behavior{}
	for _, b := range km.Behaviors {
		refs[b.Ref] = b
	}
	if refs["&hrm_l"].BindingCells != 2 || refs["&hrm_l"].Kind != "hold-tap" {
		t.Fatalf("hrm_l: %+v", refs["&hrm_l"])
	}
	if refs["&enc_rgb"].Kind != "sensor" || refs["&gg"].Kind != "macro" {
		t.Fatal("behavior kinds")
	}
	if len(km.ConditionalLayers) != 1 || km.ConditionalLayers[0].Then != 3 {
		t.Fatalf("cond: %+v", km.ConditionalLayers)
	}
}

func TestApplyNoChangesIsIdentity(t *testing.T) {
	src := loadFixture(t)
	km, _, _ := Parse(src)
	out, err := Apply(src, km, nil)
	if err != nil {
		t.Fatal(err)
	}
	if out != src {
		t.Fatal("unchanged model rewrote the file")
	}
}

func TestApplyEditsAndAdds(t *testing.T) {
	src := loadFixture(t)
	km, _, _ := Parse(src)
	km.Layers[1].Bindings[0] = "&kp ESC"
	km.Layers[2].Name = "Symbols"
	km.Layers[2].SensorBindings = []string{"&enc_vol"}
	km.Layers = append(km.Layers[:4], km.Layers[4:]...) // keep
	km.Layers = append(km.Layers, Layer{Name: "Nav", Bindings: make42("&trans")})
	km.Combos = km.Combos[1:]
	km.Combos[0].KeyPositions = []int{25, 26}
	tm := 40
	km.Combos = append(km.Combos, Combo{Name: "esc combo", KeyPositions: []int{0, 1}, Binding: "&kp ESC", TimeoutMs: &tm})

	out, err := Apply(src, km, nil)
	if err != nil {
		t.Fatal(err)
	}
	re, _, err := Parse(out)
	if err != nil {
		t.Fatalf("reparse: %v\n%s", err, out)
	}
	if len(re.Layers) != 6 || re.Layers[5].Name != "Nav" || re.Layers[5].ID != "nav_layer" || len(re.Layers[5].Bindings) != 42 {
		t.Fatalf("layers after: %+v", re.Layers[5])
	}
	if re.Layers[1].Bindings[0] != "&kp ESC" || re.Layers[1].Bindings[1] != "&kp N1" {
		t.Fatalf("raise: %v", re.Layers[1].Bindings[:2])
	}
	if re.Layers[2].Name != "Symbols" || len(re.Layers[2].SensorBindings) != 1 {
		t.Fatalf("lower: %+v", re.Layers[2])
	}
	if len(re.Combos) != 7 || re.Combos[0].ID != "ent" || re.Combos[0].KeyPositions[0] != 25 {
		t.Fatalf("combos: %+v", re.Combos)
	}
	last := re.Combos[6]
	if last.ID != "esc_combo" || last.TimeoutMs == nil || *last.TimeoutMs != 40 {
		t.Fatalf("new combo: %+v", last)
	}
	// Untouched parts survive byte-for-byte.
	for _, keep := range []string{"// Sample Corne", "hold-trigger-key-positions = <6 7 8", "&kp ESC       &kp Q          &kp W"} {
		if !strings.Contains(out, keep) {
			t.Fatalf("lost %q", keep)
		}
	}
	if strings.Contains(out, "escape {") {
		t.Fatal("deleted combo still present")
	}
	t.Log(out)
}

func TestDeleteLayer(t *testing.T) {
	src := loadFixture(t)
	km, _, _ := Parse(src)
	km.Layers = append(km.Layers[:3], km.Layers[4])
	out, err := Apply(src, km, nil)
	if err != nil {
		t.Fatal(err)
	}
	re, _, _ := Parse(out)
	if len(re.Layers) != 4 || re.Layers[3].ID != "game" {
		t.Fatalf("%+v", re.Layers)
	}
}

func TestGridFormatting(t *testing.T) {
	b := []string{"&kp A", "&kp B", "&kp LONGER", "&kp C"}
	grid := []GridPos{{0, 0}, {0, 2}, {1, 0}, {1, 1}}
	out := FormatBindings(b, FormatOptions{Grid: grid, Indent: "  ", CloseIndent: ""})
	want := " <\n  &kp A              &kp B\n  &kp LONGER  &kp C\n>"
	if out != want {
		t.Fatalf("got\n%q\nwant\n%q", out, want)
	}
}

func TestDefinesAndComments(t *testing.T) {
	src := `#include <behaviors.dtsi>
#define ___ &trans
#define NAV 1
/ {
	keymap {
		compatible = "zmk,keymap";
		default_layer {
			display-name = "Base";
			// a comment
			bindings = <
				&kp A /* inline */ &mo NAV
				___ &kp LC(LS(B))
			>;
		};
		nav { bindings = <___ ___ ___ ___>; };
	};
};
`
	km, _, err := Parse(src)
	if err != nil {
		t.Fatal(err)
	}
	if got := km.Layers[0].Bindings; len(got) != 4 || got[2] != "___" || got[3] != "&kp LC(LS(B))" {
		t.Fatalf("%v", got)
	}
	if km.Layers[0].Name != "Base" || km.Defines["NAV"] != "1" {
		t.Fatal("name/defines")
	}
	km.Layers[1].Bindings[0] = "&kp X"
	km.Layers[1].Name = "Navigation"
	out, err := Apply(src, km, nil)
	if err != nil {
		t.Fatal(err)
	}
	re, _, err := Parse(out)
	if err != nil {
		t.Fatal(err)
	}
	if re.Layers[1].Name != "Navigation" || re.Layers[1].Bindings[0] != "&kp X" {
		t.Fatalf("%s", out)
	}
	t.Log(out)
}

func make42(b string) []string {
	out := make([]string, 42)
	for i := range out {
		out[i] = b
	}
	return out
}
