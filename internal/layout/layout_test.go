package layout

import (
	"os"
	"path/filepath"
	"testing"
)

func TestFromJSONInfoFile(t *testing.T) {
	data := []byte(`{"layouts":{"LAYOUT":{"layout":[{"x":0,"y":0,"row":0,"col":0},{"x":1,"y":0.5,"u":1.5,"r":15,"rx":2,"ry":3,"row":0,"col":1}]}},"sensors":[{"label":"LEFT"}]}`)
	l, err := FromJSON(data, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(l.Keys) != 2 || l.Keys[1].W != 1.5 || *l.Keys[1].RX != 2 || l.Sensors[0].Label != "LEFT" {
		t.Fatalf("%+v", l)
	}
	if g := l.Grid(); len(g) != 2 || g[1].Col != 1 {
		t.Fatalf("grid %v", g)
	}
}

func TestFromDevicetree(t *testing.T) {
	src := `/ {
    layout: layout_0 {
        compatible = "zmk,physical-layout";
        display-name = "Default";
        keys
            = <&key_physical_attrs 100 100    0  0    0    0   0>
            , <&key_physical_attrs 100 150  100 25 1500 (-50) 300>
            ;
    };
};`
	ls := FromDevicetree(src)
	if len(ls) != 1 || len(ls[0].Keys) != 2 {
		t.Fatalf("%+v", ls)
	}
	k := ls[0].Keys[1]
	if k.H != 1.5 || k.X != 1 || k.Y != 0.25 || k.R != 15 || *k.RX != -0.5 || *k.RY != 3 {
		t.Fatalf("%+v", k)
	}
}

func TestFindPrefersJSONThenGenerates(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "config"), 0o755)
	l, _ := Find(dir, "config/a.keymap", 4, []int{3, 1}, "")
	if l.Source != SourceGenerated || l.Keys[3].X != 1 {
		t.Fatalf("%+v", l)
	}
	os.WriteFile(filepath.Join(dir, "config", "a.json"), []byte(`[{"x":0,"y":0},{"x":1,"y":0},{"x":2,"y":0},{"x":1,"y":1}]`), 0o644)
	l, _ = Find(dir, "config/a.keymap", 4, nil, "")
	if l.Source != SourceJSON || l.Path != "config/a.json" {
		t.Fatalf("%+v", l)
	}
}

func TestFromMatrixTransformUsesTextPositions(t *testing.T) {
	src := `/ {
    transform: keymap_transform_0 {
        compatible = "zmk,matrix-transform";
        map = <
RC(0,0) RC(0,1) RC(0,2)                 RC(0,9) RC(0,10) RC(0,11)
RC(0,3) RC(0,4) RC(0,5)                 RC(0,12) RC(0,13) RC(0,14)
                RC(0,6) RC(0,7) RC(0,15) RC(0,16)
        >;
    };
};`
	ls := FromMatrixTransform(src)
	if len(ls) != 1 || len(ls[0].Keys) != 16 || ls[0].Name != "transform" {
		t.Fatalf("%+v", ls)
	}
	k := ls[0].Keys
	// Every entry is wired as row 0, but rows follow the text lines.
	if k[0].Y != 0 || k[6].Y != 1 || k[12].Y != 2 {
		t.Fatalf("rows: %v %v %v", k[0].Y, k[6].Y, k[12].Y)
	}
	if k[0].X != 0 || k[1].X != 1 || k[2].X != 2 {
		t.Fatalf("left half: %v %v %v", k[0].X, k[1].X, k[2].X)
	}
	// The gap between the halves is kept.
	if k[3].X != 5 {
		t.Fatalf("right half starts at %v, want 5", k[3].X)
	}
	// Thumb row is indented by two keys.
	if k[12].X != 2 {
		t.Fatalf("thumb row starts at %v, want 2", k[12].X)
	}
	if ls[0].Grid() != nil {
		t.Fatal("matrix layouts must not reformat the keymap")
	}
}

func TestFromZMK(t *testing.T) {
	l := FromZMK("corne", 42)
	if l == nil || len(l.Keys) != 42 || l.Source != SourceZMK {
		t.Fatalf("%+v", l)
	}
	if FromZMK("corne", 36) == nil {
		t.Fatal("5 column corne missing")
	}
	if FromZMK("no_such_keyboard", 42) != nil {
		t.Fatal("matched an unknown keyboard")
	}
}
