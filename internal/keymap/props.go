package keymap

import (
	"strings"

	"github.com/ArekX/zmk-editor/internal/dts"
)

// propValue renders a Prop's value as written after '=' (with a leading
// space). Bool props have no value.
func propValue(p Prop) string {
	switch p.Type {
	case "cells":
		return " <" + strings.TrimSpace(p.Value) + ">"
	case "string":
		return " " + dts.QuoteString(p.Value)
	default:
		return " " + strings.TrimSpace(p.Value)
	}
}

// propLine renders a whole property statement without indentation.
func propLine(p Prop) string {
	if p.Type == "bool" {
		return p.Name + ";"
	}
	return p.Name + " =" + propValue(p) + ";"
}

func sameProp(a, b Prop) bool {
	if a.Type != b.Type {
		return false
	}
	switch a.Type {
	case "bool":
		return true
	case "cells":
		return strings.Join(strings.Fields(a.Value), " ") == strings.Join(strings.Fields(b.Value), " ")
	case "raw":
		return strings.TrimSpace(a.Value) == strings.TrimSpace(b.Value)
	}
	return a.Value == b.Value
}

// propEdits turns the difference between orig and next (matched by name)
// into edits on node n: changed values are replaced in place, removed
// properties deleted, new ones appended before the closing brace.
func propEdits(src string, n *dts.Node, orig, next []Prop, indent string) []edit {
	before := map[string]Prop{}
	for _, p := range orig {
		before[p.Name] = p
	}
	after := map[string]bool{}
	var edits []edit
	var added strings.Builder
	for _, p := range next {
		name := strings.TrimSpace(p.Name)
		if name == "" || after[name] {
			continue
		}
		after[name] = true
		p.Name = name
		old, ok := before[name]
		if ok && sameProp(old, p) {
			continue
		}
		dp := n.Prop(name)
		if dp == nil {
			added.WriteString(indent + propLine(p) + "\n")
			continue
		}
		if p.Type == "bool" || dp.ValueStart < 0 {
			edits = append(edits, edit{start: dp.Start, end: dp.End, text: propLine(p)})
			continue
		}
		edits = append(edits, edit{start: dp.ValueStart, end: dp.ValueEnd, text: propValue(p)})
	}
	for _, p := range orig {
		if !after[p.Name] {
			edits = append(edits, deleteProp(src, n, p.Name)...)
		}
	}
	if added.Len() > 0 {
		edits = append(edits, insertBeforeClose(src, n, added.String()))
	}
	return edits
}
