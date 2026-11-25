package layout

import (
	"bytes"
	"compress/gzip"
	_ "embed"
	"encoding/json"
	"io"
	"strings"
	"sync"
)

// zmk_layouts.json.gz holds the physical layouts of the keyboards in ZMK's
// own repository, keyed by shield/board and keymap name. Regenerate with
// `go run ./internal/layout/gen /path/to/zmk`.
//
//go:embed zmk_layouts.json.gz
var zmkLayoutsGz []byte

var zmkLayouts = sync.OnceValue(func() map[string][]Layout {
	r, err := gzip.NewReader(bytes.NewReader(zmkLayoutsGz))
	if err != nil {
		return nil
	}
	data, err := io.ReadAll(r)
	if err != nil {
		return nil
	}
	var out map[string][]Layout
	if json.Unmarshal(data, &out) != nil {
		return nil
	}
	return out
})

// FromZMK returns the layout of a keyboard defined in ZMK itself whose
// name matches the keymap (corne.keymap -> corne) and that has keyCount
// keys.
func FromZMK(keymapBase string, keyCount int) *Layout {
	all := zmkLayouts()
	name := strings.ToLower(keymapBase)
	for _, candidate := range []string{name, strings.TrimSuffix(strings.TrimSuffix(name, "_left"), "_right")} {
		for _, l := range all[candidate] {
			if len(l.Keys) == keyCount {
				out := l
				out.Source = SourceZMK
				out.Path = "zmk: " + candidate
				out.Sensors = []Sensor{}
				return &out
			}
		}
	}
	return nil
}
