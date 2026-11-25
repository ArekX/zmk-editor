package keymap

import (
	"fmt"
	"sort"
	"strings"

	"github.com/ArekX/zmk-editor/internal/dts"
)

// edit replaces src[start:end] with text.
type edit struct {
	start, end int
	text       string
}

func applyEdits(src string, edits []edit) (string, error) {
	type indexed struct {
		edit
		idx int
	}
	list := make([]indexed, len(edits))
	for i, e := range edits {
		list[i] = indexed{e, i}
	}
	// Apply back to front so earlier offsets stay valid. Insertions sharing
	// an offset are applied in reverse so they end up in call order.
	sort.Slice(list, func(i, j int) bool {
		a, b := list[i], list[j]
		if a.start != b.start {
			return a.start > b.start
		}
		if a.end != b.end {
			return a.end > b.end
		}
		return a.idx > b.idx
	})
	limit := len(src)
	for _, e := range list {
		if e.end > limit || e.start > e.end {
			return "", fmt.Errorf("internal error: overlapping edits at offset %d", e.start)
		}
		src = src[:e.start] + e.text + src[e.end:]
		limit = e.start
	}
	return src, nil
}

func lineStart(src string, pos int) int {
	return strings.LastIndexByte(src[:pos], '\n') + 1
}

// indentAt is the whitespace between the start of pos's line and pos, or
// "" when anything else precedes pos on that line.
func indentAt(src string, pos int) string {
	ls := lineStart(src, pos)
	prefix := src[ls:pos]
	if strings.TrimLeft(prefix, " \t") != "" {
		return ""
	}
	return prefix
}

// lineIndent is the leading whitespace of the line containing pos.
func lineIndent(src string, pos int) string {
	ls := lineStart(src, pos)
	i := ls
	for i < len(src) && (src[i] == ' ' || src[i] == '\t') {
		i++
	}
	return src[ls:i]
}

// detectUnit guesses one indentation step from a node and its first child
// or property.
func detectUnit(src string, n *dts.Node) string {
	parent := indentAt(src, n.Start)
	var first int = -1
	if len(n.Props) > 0 {
		first = n.Props[0].Start
	}
	if len(n.Children) > 0 && (first < 0 || n.Children[0].Start < first) {
		first = n.Children[0].Start
	}
	if first >= 0 {
		child := indentAt(src, first)
		if strings.HasPrefix(child, parent) && len(child) > len(parent) {
			return child[len(parent):]
		}
	}
	if strings.Contains(src, "\n\t") {
		return "\t"
	}
	return "    "
}

// childIndent is the indentation used for statements inside n.
func childIndent(src string, n *dts.Node, unit string) string {
	if len(n.Props) > 0 {
		if in := indentAt(src, n.Props[0].Start); in != "" {
			return in
		}
	}
	if len(n.Children) > 0 {
		if in := indentAt(src, n.Children[0].Start); in != "" {
			return in
		}
	}
	return lineIndent(src, n.Start) + unit
}

// removeStatement deletes [start,end) and, when the statement sits on its
// own lines, the surrounding whitespace and one preceding blank line.
func removeStatement(src string, start, end int) edit {
	ls := lineStart(src, start)
	if strings.TrimLeft(src[ls:start], " \t") != "" {
		return edit{start: start, end: end}
	}
	le := end
	for le < len(src) && (src[le] == ' ' || src[le] == '\t' || src[le] == '\r') {
		le++
	}
	if le < len(src) && src[le] != '\n' {
		return edit{start: ls, end: end}
	}
	if le < len(src) {
		le++
	}
	// Swallow one blank line above so deletions do not leave gaps.
	if ls > 0 {
		prev := lineStart(src, ls-1)
		if strings.TrimSpace(src[prev:ls]) == "" && prev < ls {
			ls = prev
		}
	}
	return edit{start: ls, end: le}
}

// insertBeforeClose returns an edit inserting block (already indented,
// ending in '\n') just before the line holding n's closing brace.
func insertBeforeClose(src string, n *dts.Node, block string) edit {
	ls := lineStart(src, n.BodyEnd)
	if strings.TrimLeft(src[ls:n.BodyEnd], " \t") == "" {
		return edit{start: ls, end: ls, text: block}
	}
	return edit{start: n.BodyEnd, end: n.BodyEnd, text: "\n" + block + indentAt(src, n.Start)}
}

// insertAtTop inserts a property line right after n's opening brace.
func insertAtTop(src string, n *dts.Node, line string) edit {
	pos := n.BodyStart
	if nl := strings.IndexByte(src[pos:], '\n'); nl >= 0 && strings.TrimSpace(src[pos:pos+nl]) == "" {
		pos += nl + 1
		return edit{start: pos, end: pos, text: line + "\n"}
	}
	return edit{start: pos, end: pos, text: " " + strings.TrimLeft(line, " \t")}
}

// setProp replaces a property's value (value starts with a space, e.g.
// ` <1 2>`), or inserts the property when missing.
func setProp(src string, n *dts.Node, name, value, indent string, top bool) edit {
	if p := n.Prop(name); p != nil {
		if p.ValueStart < 0 {
			return edit{start: p.Start, end: p.End, text: name + " =" + value + ";"}
		}
		return edit{start: p.ValueStart, end: p.ValueEnd, text: value}
	}
	line := indent + name + " =" + value + ";"
	if top {
		return insertAtTop(src, n, line)
	}
	return insertBeforeClose(src, n, line+"\n")
}

// setBoolProp adds or removes a boolean property.
func setBoolProp(src string, n *dts.Node, name string, on bool, indent string) []edit {
	p := n.Prop(name)
	switch {
	case on && p == nil:
		return []edit{insertBeforeClose(src, n, indent+name+";\n")}
	case !on && p != nil:
		return []edit{removeStatement(src, p.Start, p.End)}
	}
	return nil
}

func deleteProp(src string, n *dts.Node, name string) []edit {
	if p := n.Prop(name); p != nil {
		return []edit{removeStatement(src, p.Start, p.End)}
	}
	return nil
}
