package dts

import (
	"fmt"
	"strings"
)

// directives are the preprocessor keywords skipped as whole lines. Anything
// else starting with '#' (e.g. `#binding-cells`) is a property name.
var directives = map[string]bool{
	"include": true, "define": true, "undef": true, "if": true, "ifdef": true,
	"ifndef": true, "else": true, "elif": true, "endif": true, "pragma": true,
	"error": true, "warning": true, "line": true,
}

type parser struct {
	src  string
	pos  int
	file *File
}

// Parse parses src. It returns an error only for structural problems it
// cannot recover from (unbalanced braces); everything else is a warning.
func Parse(src string) (*File, error) {
	p := &parser{src: src, file: &File{Src: src, Defines: map[string]string{}}}
	for {
		p.skipTrivia()
		if p.eof() {
			break
		}
		if p.peek() == '}' {
			return nil, p.errorf("unexpected '}'")
		}
		if err := p.statement(nil); err != nil {
			return nil, err
		}
	}
	return p.file, nil
}

func (p *parser) eof() bool  { return p.pos >= len(p.src) }
func (p *parser) peek() byte { return p.src[p.pos] }

func (p *parser) errorf(format string, args ...any) error {
	return fmt.Errorf("line %d: %s", p.line(p.pos), fmt.Sprintf(format, args...))
}

func (p *parser) line(pos int) int { return strings.Count(p.src[:min(pos, len(p.src))], "\n") + 1 }

func (p *parser) warn(format string, args ...any) {
	p.file.Warnings = append(p.file.Warnings, fmt.Sprintf("line %d: %s", p.line(p.pos), fmt.Sprintf(format, args...)))
}

// skipTrivia skips whitespace, comments and preprocessor lines.
func (p *parser) skipTrivia() {
	for !p.eof() {
		c := p.peek()
		switch {
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			p.pos++
		case strings.HasPrefix(p.src[p.pos:], "//"):
			p.skipLine()
		case strings.HasPrefix(p.src[p.pos:], "/*"):
			end := strings.Index(p.src[p.pos+2:], "*/")
			if end < 0 {
				p.pos = len(p.src)
			} else {
				p.pos += end + 4
			}
		case c == '#' && p.atDirective():
			p.directive()
		default:
			return
		}
	}
}

func (p *parser) skipLine() {
	if i := strings.IndexByte(p.src[p.pos:], '\n'); i >= 0 {
		p.pos += i + 1
	} else {
		p.pos = len(p.src)
	}
}

func (p *parser) atDirective() bool {
	i := p.pos + 1
	for i < len(p.src) && (p.src[i] == ' ' || p.src[i] == '\t') {
		i++
	}
	j := i
	for j < len(p.src) && isIdentChar(p.src[j]) {
		j++
	}
	return directives[p.src[i:j]]
}

// directive consumes a preprocessor line (with '\' continuations) and
// records #include and object-like #define.
func (p *parser) directive() {
	start := p.pos
	for !p.eof() {
		nl := strings.IndexByte(p.src[p.pos:], '\n')
		if nl < 0 {
			p.pos = len(p.src)
			break
		}
		lineEnd := p.pos + nl
		p.pos = lineEnd + 1
		if !strings.HasSuffix(strings.TrimRight(p.src[start:lineEnd], " \t\r"), "\\") {
			break
		}
	}
	text := strings.ReplaceAll(p.src[start:p.pos], "\\\n", " ")
	text = strings.TrimSpace(stripComments(text))
	text = strings.TrimSpace(strings.TrimPrefix(text, "#"))
	switch {
	case strings.HasPrefix(text, "include"):
		p.file.Includes = append(p.file.Includes, strings.TrimSpace(strings.TrimPrefix(text, "include")))
	case strings.HasPrefix(text, "define"):
		rest := strings.TrimSpace(strings.TrimPrefix(text, "define"))
		i := 0
		for i < len(rest) && isIdentChar(rest[i]) {
			i++
		}
		if i == 0 || (i < len(rest) && rest[i] == '(') {
			return // function-like macro
		}
		p.file.Defines[rest[:i]] = strings.TrimSpace(rest[i:])
	}
}

func isIdentChar(c byte) bool {
	return c == '_' || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
}

func isNameChar(c byte) bool {
	return isIdentChar(c) || strings.IndexByte(",.+-@#?", c) >= 0
}

// statement parses one node, property or skipped construct. parent is nil
// at the top level.
func (p *parser) statement(parent *Node) error {
	start := p.pos
	rest := p.src[p.pos:]
	switch {
	case strings.HasPrefix(rest, "/dts-v1/"), strings.HasPrefix(rest, "/plugin/"),
		strings.HasPrefix(rest, "/delete-node/"), strings.HasPrefix(rest, "/delete-property/"),
		strings.HasPrefix(rest, "/omit-if-no-ref/"), strings.HasPrefix(rest, "/memreserve/"):
		return p.skipToSemicolon()
	case rest[0] == '/':
		p.pos++
		p.skipTrivia()
		if p.eof() || p.peek() != '{' {
			return p.errorf("expected '{' after '/'")
		}
		if err := p.node(parent, start, "/", nil); err != nil {
			return err
		}
		p.lastNode(parent).NameStart = start
		return nil
	}

	var labels []string
	for {
		nameStart := p.pos
		name := p.name()
		if name == "" {
			p.warn("skipped unexpected %q", p.snippet())
			return p.skipToSemicolon()
		}
		p.skipTrivia()
		if p.eof() {
			return p.errorf("unexpected end of file after %q", name)
		}
		switch p.peek() {
		case ':':
			p.pos++
			labels = append(labels, name)
			p.skipTrivia()
			continue
		case '{':
			if err := p.node(parent, start, name, labels); err != nil {
				return err
			}
			last := p.lastNode(parent)
			last.NameStart = nameStart
			return nil
		case '=':
			p.pos++
			return p.property(parent, start, name)
		case ';':
			p.pos++
			if parent != nil {
				parent.Props = append(parent.Props, &Property{Name: name, Start: start, End: p.pos, ValueStart: -1, ValueEnd: -1})
			}
			return nil
		case '(':
			// A helper macro invocation such as ZMK_LAYER(...). We cannot
			// expand it, so skip it and let the caller know.
			p.warn("skipped macro invocation %s(...)", name)
			if err := p.skipBalanced('(', ')'); err != nil {
				return err
			}
			p.skipTrivia()
			if !p.eof() && p.peek() == ';' {
				p.pos++
			}
			return nil
		default:
			p.warn("skipped %q (macros and expressions are not expanded)", name)
			return p.skipToSemicolon()
		}
	}
}

// name reads a node/property name, label, or &reference.
func (p *parser) name() string {
	start := p.pos
	if !p.eof() && p.peek() == '&' {
		p.pos++
		if !p.eof() && p.peek() == '{' {
			if err := p.skipBalanced('{', '}'); err != nil {
				return ""
			}
			return p.src[start:p.pos]
		}
	}
	for !p.eof() && isNameChar(p.peek()) {
		p.pos++
	}
	if p.pos == start || p.src[start:p.pos] == "&" {
		p.pos = start
		return ""
	}
	return p.src[start:p.pos]
}

func (p *parser) snippet() string {
	end := min(p.pos+20, len(p.src))
	if i := strings.IndexByte(p.src[p.pos:end], '\n'); i >= 0 {
		end = p.pos + i
	}
	return p.src[p.pos:end]
}

func (p *parser) node(parent *Node, start int, name string, labels []string) error {
	n := &Node{Name: name, Labels: labels, Start: start, Parent: parent}
	p.pos++ // '{'
	n.BodyStart = p.pos
	for {
		p.skipTrivia()
		if p.eof() {
			return fmt.Errorf("line %d: node %q is never closed", p.line(start), name)
		}
		if p.peek() == '}' {
			n.BodyEnd = p.pos
			p.pos++
			break
		}
		if err := p.statement(n); err != nil {
			return err
		}
	}
	// The ';' after '}' is mandatory in DTS but tolerate its absence.
	save := p.pos
	p.skipInlineSpace()
	if !p.eof() && p.peek() == ';' {
		p.pos++
	} else {
		p.pos = save
	}
	n.End = p.pos
	if parent == nil {
		p.file.Nodes = append(p.file.Nodes, n)
	} else {
		parent.Children = append(parent.Children, n)
	}
	return nil
}

func (p *parser) skipInlineSpace() {
	for !p.eof() && (p.peek() == ' ' || p.peek() == '\t' || p.peek() == '\n' || p.peek() == '\r') {
		p.pos++
	}
}

func (p *parser) property(parent *Node, start int, name string) error {
	valueStart := p.pos
	end, err := scanValue(p.src, p.pos)
	if err != nil {
		return fmt.Errorf("line %d: property %q: %w", p.line(start), name, err)
	}
	p.pos = end + 1
	if parent != nil {
		parent.Props = append(parent.Props, &Property{
			Name: name, Start: start, End: p.pos,
			ValueStart: valueStart, ValueEnd: end, Value: p.src[valueStart:end],
		})
	}
	return nil
}

// scanValue returns the offset of the ';' that terminates a property value
// starting at pos, honouring <cells>, (expressions), "strings" and comments.
func scanValue(src string, pos int) (int, error) {
	inAngle := false
	parens := 0
	for i := pos; i < len(src); i++ {
		c := src[i]
		switch {
		case c == '"':
			j := i + 1
			for j < len(src) && src[j] != '"' {
				if src[j] == '\\' {
					j++
				}
				j++
			}
			i = j
		case strings.HasPrefix(src[i:], "//"):
			nl := strings.IndexByte(src[i:], '\n')
			if nl < 0 {
				return 0, fmt.Errorf("unterminated value")
			}
			i += nl
		case strings.HasPrefix(src[i:], "/*"):
			e := strings.Index(src[i+2:], "*/")
			if e < 0 {
				return 0, fmt.Errorf("unterminated comment")
			}
			i += e + 3
		case c == '(':
			parens++
		case c == ')':
			if parens > 0 {
				parens--
			}
		case c == '<' && !inAngle && parens == 0:
			inAngle = true
		case c == '>' && inAngle && parens == 0:
			inAngle = false
		case c == ';' && !inAngle && parens == 0:
			return i, nil
		case c == '{' || c == '}':
			if !inAngle && parens == 0 {
				return 0, fmt.Errorf("missing ';'")
			}
		}
	}
	return 0, fmt.Errorf("unterminated value")
}

func (p *parser) skipToSemicolon() error {
	for !p.eof() {
		c := p.peek()
		switch {
		case c == ';':
			p.pos++
			return nil
		case c == '{':
			if err := p.skipBalanced('{', '}'); err != nil {
				return err
			}
		case c == '(':
			if err := p.skipBalanced('(', ')'); err != nil {
				return err
			}
		case c == '}':
			return nil // let the enclosing node close
		case c == '\n':
			p.pos++
			// a statement that never ends with ';' on its own line: give up
			// on it rather than swallowing the next statement.
			return nil
		default:
			p.pos++
		}
	}
	return nil
}

func (p *parser) skipBalanced(open, close byte) error {
	start := p.pos
	depth := 0
	for !p.eof() {
		c := p.peek()
		switch {
		case strings.HasPrefix(p.src[p.pos:], "//"):
			p.skipLine()
			continue
		case strings.HasPrefix(p.src[p.pos:], "/*"):
			e := strings.Index(p.src[p.pos+2:], "*/")
			if e < 0 {
				p.pos = len(p.src)
				continue
			}
			p.pos += e + 4
			continue
		case c == '"':
			p.pos++
			for !p.eof() && p.peek() != '"' {
				if p.peek() == '\\' {
					p.pos++
				}
				p.pos++
			}
		case c == open:
			depth++
		case c == close:
			depth--
			if depth == 0 {
				p.pos++
				return nil
			}
		}
		p.pos++
	}
	return fmt.Errorf("line %d: unbalanced %q", p.line(start), string(open))
}

func (p *parser) lastNode(parent *Node) *Node {
	if parent == nil {
		return p.file.Nodes[len(p.file.Nodes)-1]
	}
	return parent.Children[len(parent.Children)-1]
}
