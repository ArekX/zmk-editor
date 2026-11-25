package layout

import (
	"math"
	"sort"
	"strings"

	"github.com/ArekX/zmk-editor/internal/dts"
)

// FromMatrixTransform returns a layout for every `zmk,matrix-transform`
// in src. RC(row, col) values describe the wiring, not where keys sit
// (many boards wire everything as row 0), so keys are placed the way the
// map is laid out in the source text: one row per line, columns from the
// character position of each entry.
func FromMatrixTransform(src string) []*Layout {
	f, err := dts.Parse(src)
	if err != nil {
		return nil
	}
	var out []*Layout
	for _, n := range f.FindCompatible("zmk,matrix-transform") {
		p := n.Prop("map")
		if p == nil || p.ValueStart < 0 {
			continue
		}
		keys := textGrid(src[p.ValueStart:p.ValueEnd])
		if len(keys) == 0 {
			continue
		}
		name := n.Name
		if len(n.Labels) > 0 {
			name = n.Labels[0]
		}
		out = append(out, &Layout{Keys: keys, Sensors: []Sensor{}, Source: SourceMatrix, Name: name})
	}
	return out
}

type textToken struct {
	line, col int
}

// textGrid positions the RC(...) entries (or any cells) of a <...> value
// by line and character column.
func textGrid(value string) []Key {
	value = dts.StripComments(value)
	start := strings.IndexByte(value, '<')
	end := strings.LastIndexByte(value, '>')
	if start < 0 || end <= start {
		return nil
	}
	body := value[start+1 : end]
	var toks []textToken
	line, col, depth := 0, 0, 0
	inTok := false
	for i := 0; i < len(body); i++ {
		c := body[i]
		switch {
		case c == '\n':
			line++
			col = 0
			inTok = false
			continue
		case c == '(':
			depth++
		case c == ')':
			depth--
		case (c == ' ' || c == '\t' || c == '\r') && depth == 0:
			inTok = false
			if c == '\t' {
				col += 8 - col%8
			} else {
				col++
			}
			continue
		}
		if !inTok {
			toks = append(toks, textToken{line: line, col: col})
			inTok = true
		}
		col++
	}
	if len(toks) == 0 {
		return nil
	}
	// One key unit is the most common distance between neighbours.
	gaps := map[int]int{}
	for i := 1; i < len(toks); i++ {
		if toks[i].line == toks[i-1].line {
			gaps[toks[i].col-toks[i-1].col]++
		}
	}
	unit, best := 0, 0
	for g, n := range gaps {
		if n > best || (n == best && g < unit) {
			unit, best = g, n
		}
	}
	if unit <= 0 {
		unit = 1
	}
	minCol := math.MaxInt
	lines := map[int]bool{}
	for _, t := range toks {
		minCol = min(minCol, t.col)
		lines[t.line] = true
	}
	lineIDs := make([]int, 0, len(lines))
	for l := range lines {
		lineIDs = append(lineIDs, l)
	}
	sort.Ints(lineIDs)
	rowOf := map[int]int{}
	for i, l := range lineIDs {
		rowOf[l] = i
	}
	keys := make([]Key, len(toks))
	for i, t := range toks {
		x := math.Round(float64(t.col-minCol)/float64(unit)*4) / 4
		row, c := rowOf[t.line], int(math.Round(x))
		keys[i] = Key{X: x, Y: float64(row), W: 1, H: 1, Row: &row, Col: &c}
	}
	return keys
}
