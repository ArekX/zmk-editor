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
