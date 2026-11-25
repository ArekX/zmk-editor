package keymap

import (
	"sort"
	"strconv"
	"strings"
)

// GridPos places a binding in the text table written to the file.
type GridPos struct {
	Row int
	Col int
}

// FormatOptions controls how a bindings table is laid out.
type FormatOptions struct {
	// Grid, when it has one entry per binding, positions bindings by the
	// physical layout's row/col.
	Grid []GridPos
	// Shape is bindings-per-line, used when Grid does not fit.
	Shape []int
	// Indent prefixes every row; CloseIndent prefixes the closing '>'.
	Indent      string
	CloseIndent string
}

const defaultRowLength = 12

// FormatBindings renders ` <\n  rows...\n>` for a bindings property value
// (everything between '=' and ';').
func FormatBindings(bindings []string, o FormatOptions) string {
	rows := gridRows(bindings, o)
	if rows == nil {
		rows = shapeRows(bindings, o.Shape)
	}
	var b strings.Builder
	b.WriteString(" <\n")
	for _, line := range renderTable(rows) {
		if line == "" {
			continue
		}
		b.WriteString(o.Indent)
		b.WriteString(line)
		b.WriteByte('\n')
	}
	b.WriteString(o.CloseIndent)
	b.WriteString(">")
	return b.String()
}

func gridRows(bindings []string, o FormatOptions) [][]string {
	if len(o.Grid) != len(bindings) || len(bindings) == 0 {
		return nil
	}
	rowIDs := map[int]bool{}
	for _, g := range o.Grid {
		if g.Row < 0 || g.Col < 0 || g.Col > 256 {
			return nil
		}
		rowIDs[g.Row] = true
	}
	ids := make([]int, 0, len(rowIDs))
	for id := range rowIDs {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	index := map[int]int{}
	for i, id := range ids {
		index[id] = i
	}
	rows := make([][]string, len(ids))
	for i, g := range o.Grid {
		r := index[g.Row]
		for len(rows[r]) <= g.Col {
			rows[r] = append(rows[r], "")
		}
		if rows[r][g.Col] != "" {
			return nil // two keys in one cell: the grid is unusable
		}
		rows[r][g.Col] = bindings[i]
	}
	return rows
}

// shapeRows chunks bindings by the original per-line counts, centring rows
// shorter than the widest one (typical thumb clusters).
func shapeRows(bindings []string, shape []int) [][]string {
	total := 0
	for _, n := range shape {
		total += n
	}
	if total != len(bindings) || len(shape) == 0 {
		shape = nil
		for i := 0; i < len(bindings); i += defaultRowLength {
			shape = append(shape, min(defaultRowLength, len(bindings)-i))
		}
	}
	widest := 0
	for _, n := range shape {
		widest = max(widest, n)
	}
	var rows [][]string
	i := 0
	for _, n := range shape {
		offset := (widest - n) / 2
		row := make([]string, offset, offset+n)
		row = append(row, bindings[i:i+n]...)
		rows = append(rows, row)
		i += n
	}
	return rows
}

// renderTable left-aligns cells into columns separated by two spaces.
func renderTable(rows [][]string) []string {
	var widths []int
	for _, row := range rows {
		for c, cell := range row {
			if c >= len(widths) {
				widths = append(widths, 0)
			}
			widths[c] = max(widths[c], len(cell))
		}
	}
	out := make([]string, len(rows))
	for r, row := range rows {
		var b strings.Builder
		for c, cell := range row {
			if c > 0 {
				b.WriteString("  ")
			}
			b.WriteString(cell)
			b.WriteString(strings.Repeat(" ", widths[c]-len(cell)))
		}
		out[r] = strings.TrimRight(b.String(), " ")
	}
	return out
}

// FormatInlineGroups renders ` <a>, <b>` (one group per binding), as used
// for sensor-bindings.
func FormatInlineGroups(bindings []string) string {
	parts := make([]string, len(bindings))
	for i, b := range bindings {
		parts[i] = "<" + b + ">"
	}
	return " " + strings.Join(parts, ", ")
}

// FormatCells renders ` <1 2 3>`.
func FormatCells(values []int) string {
	parts := make([]string, len(values))
	for i, v := range values {
		parts[i] = strconv.Itoa(v)
	}
	return " <" + strings.Join(parts, " ") + ">"
}
