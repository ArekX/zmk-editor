package keymap

import (
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/ArekX/zmk-editor/internal/dts"
	"github.com/ArekX/zmk-editor/internal/zmkdata"
)

// fixtures are sample keymaps written for the tests. Each lists the
// behavior references it takes from files it includes.
var fixtures = map[string][]string{
	"corne.keymap":   nil,
	"split36.keymap": nil,
	"wide.keymap":    {"&ext_macro"},
	"minimal.keymap": nil,
}

func readFixture(t *testing.T, name string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func builtins(t *testing.T) map[string]BuiltinBehavior {
	t.Helper()
	b, err := ParseBuiltins(zmkdata.Behaviors)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func externalRefs(name string) map[string]bool {
	out := map[string]bool{}
	for _, r := range fixtures[name] {
		out[r] = true
	}
	return out
}

// assertCompiles checks that out is a keymap ZMK would build: it parses
// without new warnings, applying the parsed model again changes nothing,
// and every binding refers to an existing behavior with the right number
// of parameters (see Check). When ZMK_EDITOR_DTC and ZMK_EDITOR_ZMK are
// set it is also run through cpp and dtc against ZMK's headers.
func assertCompiles(t *testing.T, fixture, before, out string) *Keymap {
	t.Helper()
	_, fb, err := Parse(before)
	if err != nil {
		t.Fatal(err)
	}
	km, fa, err := Parse(out)
	if err != nil {
		t.Fatalf("output does not parse: %v\n%s", err, out)
	}
	if len(fa.Warnings) > len(fb.Warnings) {
		t.Fatalf("output has new parser warnings: %v\n%s", fa.Warnings, out)
	}
	if problems := Check(km, builtins(t), externalRefs(fixture)); len(problems) > 0 {
		t.Fatalf("output would not build:\n  %s\n%s", strings.Join(problems, "\n  "), out)
	}
	again, err := Apply(out, km, nil)
	if err != nil {
		t.Fatalf("re-applying the parsed output: %v", err)
	}
	if again != out {
		t.Fatalf("re-applying the parsed output changed it:\n%s", again)
	}
	compileWithDTC(t, fixture, out)
	return km
}

// compileWithDTC runs the real devicetree toolchain when configured:
//
//	ZMK_EDITOR_DTC=/path/to/dtc ZMK_EDITOR_ZMK=/path/to/zmk go test ./internal/keymap
//
// ZMK_EDITOR_ZMK is a zmk checkout (app/include and app/dts are used).
// ZMK_EDITOR_ZEPHYR (optional) is a zephyr checkout for headers ZMK
// includes from Zephyr.
func compileWithDTC(t *testing.T, fixture, src string) {
	t.Helper()
	dtc, zmk := os.Getenv("ZMK_EDITOR_DTC"), os.Getenv("ZMK_EDITOR_ZMK")
	if dtc == "" || zmk == "" {
		return
	}
	dir := t.TempDir()
	km, _, _ := Parse(src)
	// Stub every label the keymap references but does not define
	// (physical layouts, behaviors from included files).
	var stubs strings.Builder
	for _, ref := range unresolvedLabels(t, src) {
		stubs.WriteString("\t" + ref + ": " + strings.ReplaceAll(ref, "_", "-") + "-stub { #binding-cells = <0>; };\n")
	}
	for _, inc := range km.Includes {
		if strings.HasPrefix(inc, `"`) {
			_ = os.WriteFile(filepath.Join(dir, strings.Trim(inc, `"`)), nil, 0o600)
		}
	}
	wrapper := "/dts-v1/;\n/ {\n" + stubs.String() + "};\n#include \"keymap.keymap\"\n"
	must(t, os.WriteFile(filepath.Join(dir, "keymap.keymap"), []byte(src), 0o600))
	must(t, os.WriteFile(filepath.Join(dir, "board.dts"), []byte(wrapper), 0o600))
	args := []string{"-nostdinc", "-undef", "-x", "assembler-with-cpp", "-P",
		"-I", dir, "-I", filepath.Join(zmk, "app", "include"), "-I", filepath.Join(zmk, "app", "dts")}
	if z := os.Getenv("ZMK_EDITOR_ZEPHYR"); z != "" {
		args = append(args, "-I", filepath.Join(z, "include"), "-I", filepath.Join(z, "dts"))
	}
	args = append(args, "-o", filepath.Join(dir, "out.dts"), filepath.Join(dir, "board.dts"))
	if b, err := exec.Command("cpp", args...).CombinedOutput(); err != nil {
		t.Fatalf("%s: cpp failed: %v\n%s", fixture, err, b)
	}
	if b, err := exec.Command(dtc, "-q", "-I", "dts", "-O", "dtb", "-o", os.DevNull, filepath.Join(dir, "out.dts")).CombinedOutput(); err != nil {
		t.Fatalf("%s: dtc failed: %v\n%s", fixture, err, b)
	}
}

func unresolvedLabels(t *testing.T, src string) []string {
	_, f, _ := Parse(src)
	defined := allLabels(f)
	var out []string
	for _, n := range f.Nodes {
		n.Walk(func(n *dts.Node) {
			for _, p := range n.Props {
				for _, tok := range strings.FieldsFunc(p.Value, func(r rune) bool { return strings.ContainsRune(" \t\n<>,;()", r) }) {
					if strings.HasPrefix(tok, "&") && !defined[tok[1:]] && !slices.Contains(out, tok[1:]) && labelPattern.MatchString(tok[1:]) {
						out = append(out, tok[1:])
					}
				}
			}
		})
	}
	// Built-in behaviors come from behaviors.dtsi.
	return slices.DeleteFunc(out, func(l string) bool {
		_, builtin := builtins(t)["&"+l]
		return builtin
	})
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

// TestExternalKeymaps runs the round-trip and build checks over real
// configs when ZMK_EDITOR_SAMPLES points at a directory of zmk-config
// checkouts. For each keymap it also renames a behavior, edits a hold-tap
// property, swaps two keys across layers and moves the last layer first.
func TestExternalKeymaps(t *testing.T) {
	root := os.Getenv("ZMK_EDITOR_SAMPLES")
	if root == "" {
		t.Skip("set ZMK_EDITOR_SAMPLES to a directory of zmk-config checkouts")
	}
	var files []string
	_ = filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err == nil && !d.IsDir() && strings.HasSuffix(path, ".keymap") && !strings.Contains(path, "/.git/") {
			files = append(files, path)
		}
		return nil
	})
	for _, path := range files {
		t.Run(filepath.Base(filepath.Dir(path))+"/"+filepath.Base(path), func(t *testing.T) {
			data, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			src := string(data)
			km, _, err := Parse(src)
			if err != nil {
				t.Fatal(err)
			}
			if len(km.Layers) == 0 {
				t.Skip("no editable layers")
			}
			out, err := Apply(src, km, nil)
			if err != nil || out != src {
				t.Fatalf("round trip changed the file (err %v)", err)
			}
			// References this file cannot resolve come from includes.
			external := map[string]bool{}
			for _, p := range Check(km, builtins(t), nil) {
				if i := strings.Index(p, "unknown behavior "); i >= 0 {
					external[p[i+len("unknown behavior "):]] = true
				}
			}
			t.Logf("behaviors from other files: %v", external)

			for _, b := range km.Behaviors {
				if b.Kind == "hold-tap" {
					bb := behavior(km, b.Label)
					bb.Props = append(bb.Props, Prop{Name: "require-prior-idle-ms", Type: "cells", Value: "111"})
					old := bb.Label
					bb.Label = old + "_x"
					for li := range km.Layers {
						for k, x := range km.Layers[li].Bindings {
							if strings.HasPrefix(x, "&"+old+" ") || x == "&"+old {
								km.Layers[li].Bindings[k] = "&" + bb.Label + x[len(old)+1:]
							}
						}
					}
					break
				}
			}
			last := len(km.Layers) - 1
			a, b := km.Layers[0].Bindings[0], km.Layers[last].Bindings[1]
			km.Layers[0].Bindings[0], km.Layers[last].Bindings[1] = b, a
			km.Layers = append([]Layer{km.Layers[last]}, km.Layers[:last]...)
			out, err = Apply(src, km, nil)
			if err != nil {
				t.Fatal(err)
			}
			km2, _, err := Parse(out)
			if err != nil {
				t.Fatal(err)
			}
			if problems := Check(km2, builtins(t), external); len(problems) > 0 {
				// Layer references are not renumbered here, so only
				// structural problems count.
				for _, p := range problems {
					if !strings.Contains(p, "refers to layer") {
						t.Errorf("%s", p)
					}
				}
			}
			if again, _ := Apply(out, km2, nil); again != out {
				t.Fatal("output does not round-trip")
			}
		})
	}
}
