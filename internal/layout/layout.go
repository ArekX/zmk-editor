// Package layout resolves the physical key positions for a keymap. Sources,
// in priority order: a user override stored in SQLite, a keymap-editor /
// QMK style JSON file next to the keymap, a ZMK `zmk,physical-layout`
// devicetree node anywhere in the repository, and finally a grid generated
// from the line shape of the keymap's first layer.
package layout

import (
	"encoding/json"
	"errors"
	"fmt"

	"github.com/ArekX/zmk-editor/internal/keymap"
)

// Key is one physical key in key units (1u = one standard key).
type Key struct {
	X     float64  `json:"x"`
	Y     float64  `json:"y"`
	W     float64  `json:"w"`
	H     float64  `json:"h"`
	R     float64  `json:"r,omitempty"`
	RX    *float64 `json:"rx,omitempty"`
	RY    *float64 `json:"ry,omitempty"`
	Row   *int     `json:"row,omitempty"`
	Col   *int     `json:"col,omitempty"`
	Label string   `json:"label,omitempty"`
}

// Sensor is an encoder (or other sensor) slot shown under the keyboard.
type Sensor struct {
	Label string `json:"label"`
}

// Source values.
const (
	SourceCustom     = "custom"
	SourceJSON       = "json"
	SourceDevicetree = "devicetree"
	SourceMatrix     = "matrix"
	SourceZMK        = "zmk"
	SourceGenerated  = "generated"
)

// Layout is the resolved key geometry.
type Layout struct {
	Keys    []Key    `json:"keys"`
	Sensors []Sensor `json:"sensors"`
	Source  string   `json:"source"`
	Path    string   `json:"path,omitempty"` // file it came from, relative to the repo
	Name    string   `json:"name,omitempty"`
}

// Grid returns row/col per key when every key has both, else nil.
func (l *Layout) Grid() []keymap.GridPos {
	// Generated and matrix-derived positions only mirror text, so they
	// must not reformat the keymap.
	if l == nil || l.Source == SourceGenerated || l.Source == SourceMatrix {
		return nil
	}
	out := make([]keymap.GridPos, len(l.Keys))
	for i, k := range l.Keys {
		if k.Row == nil || k.Col == nil {
			return nil
		}
		out[i] = keymap.GridPos{Row: *k.Row, Col: *k.Col}
	}
	return out
}

// jsonKey accepts both `w` and keymap-editor's `u` for width.
type jsonKey struct {
	X     *float64 `json:"x"`
	Y     *float64 `json:"y"`
	W     *float64 `json:"w"`
	U     *float64 `json:"u"`
	H     *float64 `json:"h"`
	R     float64  `json:"r"`
	RX    *float64 `json:"rx"`
	RY    *float64 `json:"ry"`
	Row   *int     `json:"row"`
	Col   *int     `json:"col"`
	Label string   `json:"label"`
}

type jsonFile struct {
	Layouts map[string]struct {
		Layout []jsonKey `json:"layout"`
	} `json:"layouts"`
	Layout  []jsonKey `json:"layout"`
	Sensors []struct {
		Label      string `json:"label"`
		Name       string `json:"name"`
		Identifier string `json:"identifier"`
	} `json:"sensors"`
}

// ErrNoLayout means the JSON held no layout usable for the key count.
var ErrNoLayout = errors.New("no layout in file")

// FromJSON parses an info.json-style file ({"layouts": {NAME: {"layout":
// [...]}}}), a bare {"layout": [...]}, or a bare array of keys. When there
// are several named layouts the one matching keyCount wins.
func FromJSON(data []byte, keyCount int) (*Layout, error) {
	var keys []jsonKey
	var f jsonFile
	name := ""
	if err := json.Unmarshal(data, &keys); err != nil {
		if err := json.Unmarshal(data, &f); err != nil {
			return nil, err
		}
		keys = f.Layout
		for n, l := range f.Layouts {
			if keys == nil || len(l.Layout) == keyCount {
				keys, name = l.Layout, n
			}
			if len(l.Layout) == keyCount {
				break
			}
		}
	}
	if len(keys) == 0 {
		return nil, ErrNoLayout
	}
	out := &Layout{Keys: make([]Key, len(keys)), Sensors: []Sensor{}, Name: name}
	for i, k := range keys {
		if k.X == nil || k.Y == nil {
			return nil, fmt.Errorf("key %d is missing x or y", i)
		}
		key := Key{X: *k.X, Y: *k.Y, W: 1, H: 1, R: k.R, RX: k.RX, RY: k.RY, Row: k.Row, Col: k.Col, Label: k.Label}
		if k.W != nil {
			key.W = *k.W
		} else if k.U != nil {
			key.W = *k.U
		}
		if k.H != nil {
			key.H = *k.H
		}
		out.Keys[i] = key
	}
	for _, s := range f.Sensors {
		label := s.Label
		if label == "" {
			label = s.Name
		}
		out.Sensors = append(out.Sensors, Sensor{Label: label})
	}
	return out, nil
}

// Generate lays keys out from bindings-per-line, centring shorter rows the
// same way the keymap writer does.
func Generate(shape []int, keyCount int) *Layout {
	total := 0
	for _, n := range shape {
		total += n
	}
	if total != keyCount || len(shape) == 0 {
		shape = nil
		for i := 0; i < keyCount; i += 12 {
			shape = append(shape, min(12, keyCount-i))
		}
	}
	widest := 0
	for _, n := range shape {
		widest = max(widest, n)
	}
	out := &Layout{Keys: []Key{}, Sensors: []Sensor{}, Source: SourceGenerated}
	for r, n := range shape {
		offset := (widest - n) / 2
		for c := 0; c < n; c++ {
			row, col := r, offset+c
			out.Keys = append(out.Keys, Key{X: float64(col), Y: float64(r), W: 1, H: 1, Row: &row, Col: &col})
		}
	}
	return out
}
