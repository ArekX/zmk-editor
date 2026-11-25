// Command gen builds zmk_layouts.json.gz, the physical layouts of the
// keyboards in ZMK's own repository, embedded so keymaps for those
// keyboards are drawn correctly without a layout file in the repository.
//
//	go run ./internal/layout/gen /path/to/zmk > /dev/null
//
// It reads app/boards (shields and boards) and app/dts/layouts, and writes
// internal/layout/zmk_layouts.json.gz.
package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/ArekX/zmk-editor/internal/layout"
)

var includeRe = regexp.MustCompile(`#include\s*[<"]([^>"]+)[>"]`)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: gen /path/to/zmk")
		os.Exit(2)
	}
	app := filepath.Join(os.Args[1], "app")
	dtsRoot := filepath.Join(app, "dts")
	out := map[string][]layout.Layout{}

	// Every directory that holds a .keymap is one keyboard.
	dirs := map[string][]string{}
	_ = filepath.WalkDir(filepath.Join(app, "boards"), func(path string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() && strings.HasSuffix(path, ".keymap") {
			dirs[filepath.Dir(path)] = append(dirs[filepath.Dir(path)], strings.TrimSuffix(filepath.Base(path), ".keymap"))
		}
		return nil
	})
	for dir, keymaps := range dirs {
		layouts := collect(dir, dtsRoot)
		if len(layouts) == 0 {
			continue
		}
		names := append([]string{filepath.Base(dir)}, keymaps...)
		for _, n := range names {
			out[n] = merge(out[n], layouts)
		}
	}

	keys := make([]string, 0, len(out))
	for k := range out {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var raw bytes.Buffer
	enc := json.NewEncoder(&raw)
	if err := enc.Encode(out); err != nil {
		panic(err)
	}
	var gz bytes.Buffer
	w, _ := gzip.NewWriterLevel(&gz, gzip.BestCompression)
	_, _ = w.Write(raw.Bytes())
	_ = w.Close()
	if err := os.WriteFile(filepath.Join("internal", "layout", "zmk_layouts.json.gz"), gz.Bytes(), 0o644); err != nil {
		panic(err)
	}
	fmt.Fprintf(os.Stderr, "%d keyboards, %d bytes (%d uncompressed)\n", len(keys), gz.Len(), raw.Len())
}

// collect returns the physical layouts of the keyboard in dir (following
// #includes into app/dts), or layouts derived from its matrix transforms
// when it has none.
func collect(dir, dtsRoot string) []layout.Layout {
	var sources []string
	seen := map[string]bool{}
	var visit func(path string)
	visit = func(path string) {
		if seen[path] {
			return
		}
		seen[path] = true
		data, err := os.ReadFile(path)
		if err != nil {
			return
		}
		src := string(data)
		sources = append(sources, src)
		for _, m := range includeRe.FindAllStringSubmatch(src, -1) {
			for _, base := range []string{filepath.Dir(path), dtsRoot} {
				p := filepath.Join(base, m[1])
				if _, err := os.Stat(p); err == nil {
					visit(p)
					break
				}
			}
		}
	}
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		switch filepath.Ext(e.Name()) {
		case ".dtsi", ".overlay", ".dts":
			visit(filepath.Join(dir, e.Name()))
		}
	}
	var physical, matrix []layout.Layout
	for _, src := range sources {
		for _, l := range layout.FromDevicetree(src) {
			physical = append(physical, *l)
		}
		for _, l := range layout.FromMatrixTransform(src) {
			matrix = append(matrix, *l)
		}
	}
	if len(physical) > 0 {
		return physical
	}
	return matrix
}

func merge(a, b []layout.Layout) []layout.Layout {
	have := map[string]bool{}
	for _, l := range a {
		have[fingerprint(l)] = true
	}
	for _, l := range b {
		if !have[fingerprint(l)] {
			a = append(a, l)
			have[fingerprint(l)] = true
		}
	}
	return a
}

func fingerprint(l layout.Layout) string {
	b, _ := json.Marshal(l.Keys)
	return string(b)
}
