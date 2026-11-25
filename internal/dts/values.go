package dts

import (
	"strconv"
	"strings"
)

// ParseString unquotes the first "string" in a property value.
func ParseString(value string) (string, bool) {
	i := strings.IndexByte(value, '"')
	if i < 0 {
		return "", false
	}
	var b strings.Builder
	for j := i + 1; j < len(value); j++ {
		c := value[j]
		if c == '\\' && j+1 < len(value) {
			j++
			b.WriteByte(value[j])
			continue
		}
		if c == '"' {
			return b.String(), true
		}
		b.WriteByte(c)
	}
	return b.String(), false
}

// QuoteString renders s as a DTS string literal.
func QuoteString(s string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(s) + `"`
}

// stripComments removes // and /* */ comments outside of strings.
func stripComments(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		switch {
		case s[i] == '"':
			j := i + 1
			for j < len(s) && s[j] != '"' {
				if s[j] == '\\' {
					j++
				}
				j++
			}
			end := min(j+1, len(s))
			b.WriteString(s[i:end])
			i = end - 1
		case strings.HasPrefix(s[i:], "//"):
			nl := strings.IndexByte(s[i:], '\n')
			if nl < 0 {
				return b.String()
			}
			b.WriteByte('\n')
			i += nl
		case strings.HasPrefix(s[i:], "/*"):
			e := strings.Index(s[i+2:], "*/")
			if e < 0 {
				return b.String()
			}
			// Keep line structure so callers can still count rows.
			b.WriteString(strings.Repeat("\n", strings.Count(s[i:i+e+4], "\n")))
			b.WriteByte(' ')
			i += e + 3
		default:
			b.WriteByte(s[i])
		}
	}
	return b.String()
}

// StripComments is the exported form of stripComments.
func StripComments(s string) string { return stripComments(s) }

// CellGroups returns the inner text of every <...> group in a value, in
// order, with comments removed.
func CellGroups(value string) []string {
	value = stripComments(value)
	var groups []string
	parens := 0
	start := -1
	for i := 0; i < len(value); i++ {
		c := value[i]
		switch {
		case c == '(':
			parens++
		case c == ')':
			if parens > 0 {
				parens--
			}
		case c == '<' && start < 0 && parens == 0:
			start = i + 1
		case c == '>' && start >= 0 && parens == 0:
			groups = append(groups, value[start:i])
			start = -1
		}
	}
	return groups
}

// Token is one cell of a <...> group with the source line it sits on
// (0-based, relative to the group start).
type Token struct {
	Text string
	Line int
}

// Tokenize splits cell text on whitespace, keeping parenthesized
// expressions such as LC(LS(A)) or RGB_COLOR_HSB(0, 80, 60) whole.
func Tokenize(cells string) []Token {
	var out []Token
	line := 0
	parens := 0
	start := -1
	startLine := 0
	flush := func(i int) {
		if start >= 0 {
			out = append(out, Token{Text: cells[start:i], Line: startLine})
			start = -1
		}
	}
	for i := 0; i < len(cells); i++ {
		c := cells[i]
		if c == '\n' {
			line++
		}
		switch {
		case c == '(':
			parens++
		case c == ')':
			if parens > 0 {
				parens--
			}
		case (c == ' ' || c == '\t' || c == '\n' || c == '\r') && parens == 0:
			flush(i)
			continue
		}
		if start < 0 {
			start = i
			startLine = line
		}
	}
	flush(len(cells))
	return out
}

// ParseCellInt parses a single cell as an integer: decimal, hex, or a
// parenthesized/negative literal like (-1500). ok is false for anything
// that needs expression evaluation.
func ParseCellInt(cell string) (int64, bool) {
	s := strings.TrimSpace(cell)
	for strings.HasPrefix(s, "(") && strings.HasSuffix(s, ")") {
		s = strings.TrimSpace(s[1 : len(s)-1])
	}
	neg := false
	if strings.HasPrefix(s, "-") {
		neg = true
		s = strings.TrimSpace(s[1:])
	}
	v, err := strconv.ParseInt(s, 0, 64)
	if err != nil {
		return 0, false
	}
	if neg {
		v = -v
	}
	return v, true
}

// ResolveInt parses a cell, expanding object-like defines (recursively, up
// to a small depth) when it is a macro name.
func ResolveInt(cell string, defines map[string]string) (int64, bool) {
	for depth := 0; depth < 8; depth++ {
		if v, ok := ParseCellInt(cell); ok {
			return v, true
		}
		next, ok := defines[strings.TrimSpace(cell)]
		if !ok {
			return 0, false
		}
		cell = next
	}
	return 0, false
}
