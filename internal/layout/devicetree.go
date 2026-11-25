package layout

import (
	"strings"

	"github.com/ArekX/zmk-editor/internal/dts"
)

// FromDevicetree returns every `zmk,physical-layout` in src. Key attributes
// are `<&key_physical_attrs w h x y r rx ry>` in hundredths of a key unit
// (rotation in hundredths of a degree).
func FromDevicetree(src string) []*Layout {
	f, err := dts.Parse(src)
	if err != nil {
		return nil
	}
	var out []*Layout
	for _, n := range f.FindCompatible("zmk,physical-layout") {
		p := n.Prop("keys")
		if p == nil {
			continue
		}
		l := &Layout{Keys: []Key{}, Sensors: []Sensor{}, Source: SourceDevicetree, Name: n.StringProp("display-name")}
		if l.Name == "" {
			l.Name = n.Name
		}
		ok := true
		for _, g := range dts.CellGroups(p.Value) {
			toks := dts.Tokenize(g)
			for i := 0; i < len(toks); {
				if !strings.HasPrefix(toks[i].Text, "&") || i+7 >= len(toks) {
					ok = false
					break
				}
				vals := make([]float64, 7)
				for j := 0; j < 7; j++ {
					v, good := dts.ResolveInt(toks[i+1+j].Text, f.Defines)
					if !good {
						ok = false
						break
					}
					vals[j] = float64(v) / 100
				}
				if !ok {
					break
				}
				k := Key{W: vals[0], H: vals[1], X: vals[2], Y: vals[3], R: vals[4]}
				if k.R != 0 {
					rx, ry := vals[5], vals[6]
					k.RX, k.RY = &rx, &ry
				}
				l.Keys = append(l.Keys, k)
				i += 8
			}
			if !ok {
				break
			}
		}
		if ok && len(l.Keys) > 0 {
			out = append(out, l)
		}
	}
	return out
}
