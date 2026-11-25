// Package dts is a lenient devicetree source parser for ZMK keymaps. It is
// not a full DTS compiler: it keeps byte offsets for every node and
// property so callers can splice edits back into the original text without
// reformatting anything they did not touch. Preprocessor directives are
// skipped (object-like #defines are recorded), unknown statements such as
// helper macro invocations are skipped and reported.
package dts

// Property is `name = value;` or a boolean `name;`.
type Property struct {
	Name string
	// Start is the offset of the first character of the name, End the
	// offset just past the terminating ';'.
	Start, End int
	// ValueStart/ValueEnd delimit the raw value between '=' and ';'.
	// Both are -1 for boolean properties.
	ValueStart, ValueEnd int
	Value                string
}

// Node is `labels: name { ... };`, the root `/ { ... };` or a reference
// override `&label { ... };`.
type Node struct {
	Name   string // "/" for root, "&label" for overrides
	Labels []string
	// NameStart is the offset of the node name (after any labels).
	NameStart int
	// Start is the offset of the first label (or the name), End just past
	// the ';' after the closing brace.
	Start, End int
	// BodyStart is just past '{', BodyEnd the offset of the closing '}'.
	BodyStart, BodyEnd int
	Props              []*Property
	Children           []*Node
	Parent             *Node
}

// Prop returns the property with the given name, or nil.
func (n *Node) Prop(name string) *Property {
	for _, p := range n.Props {
		if p.Name == name {
			return p
		}
	}
	return nil
}

// Child returns the direct child node with the given name, or nil.
func (n *Node) Child(name string) *Node {
	for _, c := range n.Children {
		if c.Name == name {
			return c
		}
	}
	return nil
}

// StringProp returns the unquoted value of a string property, or "".
func (n *Node) StringProp(name string) string {
	p := n.Prop(name)
	if p == nil {
		return ""
	}
	s, _ := ParseString(p.Value)
	return s
}

// Walk visits n and every descendant depth-first.
func (n *Node) Walk(fn func(*Node)) {
	fn(n)
	for _, c := range n.Children {
		c.Walk(fn)
	}
}

// Define is an object-like `#define NAME value`.
type Define struct {
	Name  string
	Value string
}

// Span is a byte range [Start, End) in the source.
type Span struct {
	Start, End int
}

// File is a parsed source.
type File struct {
	Src     string
	Nodes   []*Node // top-level nodes: roots and &ref overrides
	Defines map[string]string
	// DefineSpans locates the value of single-line object-like #defines.
	DefineSpans map[string]Span
	Includes    []string
	Warnings    []string
}

// Walk visits every node in the file.
func (f *File) Walk(fn func(*Node)) {
	for _, n := range f.Nodes {
		n.Walk(fn)
	}
}

// FindCompatible returns every node whose compatible equals c.
func (f *File) FindCompatible(c string) []*Node {
	var out []*Node
	f.Walk(func(n *Node) {
		if n.StringProp("compatible") == c {
			out = append(out, n)
		}
	})
	return out
}
