package repos

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/ArekX/zmk-editor/internal/keymap"
	"github.com/ArekX/zmk-editor/internal/layout"
	"github.com/ArekX/zmk-editor/internal/store"
)

var skipDirs = map[string]bool{
	".git": true, "node_modules": true, "zmk": true, "zephyr": true,
	"modules": true, ".west": true, "build": true,
}

// ErrConflict means the file changed on disk since it was loaded.
var ErrConflict = errors.New("the keymap changed on disk since it was loaded (pulled or edited elsewhere); reload it first")

// FindKeymaps lists *.keymap files in a repository (relative,
// slash-separated), files under config/ first.
func FindKeymaps(root string) []string {
	var out []string
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(root, path)
		if d.IsDir() {
			if path != root && (skipDirs[d.Name()] || strings.Count(rel, string(filepath.Separator)) >= 6) {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasSuffix(d.Name(), ".keymap") {
			out = append(out, filepath.ToSlash(rel))
		}
		return nil
	})
	sort.SliceStable(out, func(i, j int) bool {
		ci, cj := strings.HasPrefix(out[i], "config/"), strings.HasPrefix(out[j], "config/")
		if ci != cj {
			return ci
		}
		return out[i] < out[j]
	})
	if out == nil {
		out = []string{}
	}
	return out
}

// KeymapPath validates a user-supplied keymap path and returns it joined
// to the repository root.
func KeymapPath(repo store.Repository, rel string) (string, error) {
	clean := filepath.Clean(filepath.FromSlash(rel))
	if rel == "" || filepath.IsAbs(clean) || strings.HasPrefix(clean, "..") || !strings.HasSuffix(clean, ".keymap") {
		return "", invalid("invalid keymap path %q", rel)
	}
	return filepath.Join(repo.LocalPath, clean), nil
}

// Document is a keymap with everything the editor needs to render it.
type Document struct {
	Path           string         `json:"path"`
	Keymap         *keymap.Keymap `json:"keymap"`
	Layout         *layout.Layout `json:"layout"`
	LayoutWarnings []string       `json:"layout_warnings"`
	Hash           string         `json:"hash"`
	Source         string         `json:"source"`
}

// Load reads and parses a keymap plus its layout.
func (s *Service) Load(repo store.Repository, rel string) (*Document, error) {
	full, err := KeymapPath(repo, rel)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(full)
	if err != nil {
		return nil, err
	}
	return s.document(repo, rel, string(data))
}

func (s *Service) document(repo store.Repository, rel, src string) (*Document, error) {
	km, _, err := keymap.Parse(src)
	if err != nil {
		return nil, invalid("cannot parse %s: %v", rel, err)
	}
	l, warnings := s.layoutFor(repo, rel, km)
	if warnings == nil {
		warnings = []string{}
	}
	return &Document{Path: rel, Keymap: km, Layout: l, LayoutWarnings: warnings, Hash: hash(src), Source: src}, nil
}

func (s *Service) layoutFor(repo store.Repository, rel string, km *keymap.Keymap) (*layout.Layout, []string) {
	keyCount := 0
	var shape []int
	if len(km.Layers) > 0 {
		keyCount = len(km.Layers[0].Bindings)
		shape = km.Layers[0].Shape
	}
	custom, _ := s.Store.GetCustomLayout(repo.ID, rel)
	return layout.Find(repo.LocalPath, filepath.FromSlash(rel), keyCount, shape, custom)
}

// Save writes the edited model back into the file. baseHash must match the
// file currently on disk.
func (s *Service) Save(repo store.Repository, rel, baseHash string, km *keymap.Keymap) (*Document, error) {
	full, err := KeymapPath(repo, rel)
	if err != nil {
		return nil, err
	}
	unlock := s.Git.Lock(repo.LocalPath)
	defer unlock()
	data, err := os.ReadFile(full)
	if err != nil {
		return nil, err
	}
	src := string(data)
	if baseHash != "" && hash(src) != baseHash {
		return nil, ErrConflict
	}
	orig, _, err := keymap.Parse(src)
	if err != nil {
		return nil, invalid("cannot parse %s: %v", rel, err)
	}
	l, _ := s.layoutFor(repo, rel, orig)
	out, err := keymap.Apply(src, km, l.Grid())
	if err != nil {
		return nil, invalid("%v", err)
	}
	if out != src {
		info, err := os.Stat(full)
		if err != nil {
			return nil, err
		}
		if err := os.WriteFile(full, []byte(out), info.Mode().Perm()); err != nil {
			return nil, fmt.Errorf("write %s: %w", rel, err)
		}
	}
	return s.document(repo, rel, out)
}

// Preview returns the file content Save would write, without writing it.
func (s *Service) Preview(repo store.Repository, rel string, km *keymap.Keymap) (string, string, error) {
	full, err := KeymapPath(repo, rel)
	if err != nil {
		return "", "", err
	}
	data, err := os.ReadFile(full)
	if err != nil {
		return "", "", err
	}
	src := string(data)
	orig, _, err := keymap.Parse(src)
	if err != nil {
		return "", "", invalid("cannot parse %s: %v", rel, err)
	}
	l, _ := s.layoutFor(repo, rel, orig)
	out, err := keymap.Apply(src, km, l.Grid())
	if err != nil {
		return "", "", invalid("%v", err)
	}
	return src, out, nil
}

func hash(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:8])
}
