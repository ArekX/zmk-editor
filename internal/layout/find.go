package layout

import (
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// skipDirs are never scanned: VCS data, west workspaces, build output.
var skipDirs = map[string]bool{
	".git": true, "node_modules": true, "zmk": true, "zephyr": true,
	"modules": true, ".west": true, "build": true, "bootloader": true,
}

const (
	maxScanDepth = 6
	maxFileSize  = 512 << 10
)

// Find resolves the layout for the keymap at keymapRel inside repoDir.
// custom is the stored override JSON ("" for none).
func Find(repoDir, keymapRel string, keyCount int, shape []int, custom string) (*Layout, []string) {
	var warnings []string
	if custom != "" {
		l, err := FromJSON([]byte(custom), keyCount)
		if err == nil {
			l.Source = SourceCustom
			return l, warnings
		}
		warnings = append(warnings, "custom layout is invalid: "+err.Error())
	}

	dir := filepath.Dir(keymapRel)
	base := strings.TrimSuffix(filepath.Base(keymapRel), filepath.Ext(keymapRel))
	for _, rel := range jsonCandidates(repoDir, dir, base) {
		data, err := os.ReadFile(filepath.Join(repoDir, rel))
		if err != nil {
			continue
		}
		l, err := FromJSON(data, keyCount)
		if err != nil {
			continue
		}
		if len(l.Keys) != keyCount {
			warnings = append(warnings, rel+" has "+strconv.Itoa(len(l.Keys))+" keys, the keymap has "+strconv.Itoa(keyCount))
			continue
		}
		l.Source, l.Path = SourceJSON, rel
		return l, warnings
	}

	if l := findDevicetree(repoDir, base, keyCount); l != nil {
		return l, warnings
	}
	return Generate(shape, keyCount), warnings
}

// jsonCandidates lists JSON files that may hold a layout, most specific
// first: <keymap>.json, info.json, then any other JSON next to the keymap.
func jsonCandidates(repoDir, dir, base string) []string {
	seen := map[string]bool{}
	var out []string
	add := func(rel string) {
		if !seen[rel] {
			seen[rel] = true
			out = append(out, rel)
		}
	}
	add(filepath.Join(dir, base+".json"))
	add(filepath.Join(dir, "info.json"))
	add(filepath.Join("config", "info.json"))
	entries, _ := os.ReadDir(filepath.Join(repoDir, dir))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") {
			add(filepath.Join(dir, e.Name()))
		}
	}
	return out
}

func findDevicetree(repoDir, base string, keyCount int) *Layout {
	var best *Layout
	bestScore := -1
	_ = filepath.WalkDir(repoDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(repoDir, path)
		if d.IsDir() {
			if path != repoDir && (skipDirs[d.Name()] || strings.Count(rel, string(filepath.Separator)) >= maxScanDepth) {
				return filepath.SkipDir
			}
			return nil
		}
		switch filepath.Ext(path) {
		case ".dtsi", ".overlay", ".dts", ".keymap":
		default:
			return nil
		}
		info, err := d.Info()
		if err != nil || info.Size() > maxFileSize {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil || !strings.Contains(string(data), "zmk,physical-layout") {
			return nil
		}
		for _, l := range FromDevicetree(string(data)) {
			if len(l.Keys) != keyCount {
				continue
			}
			score := 0
			if strings.Contains(strings.ToLower(rel), strings.ToLower(base)) {
				score = 1
			}
			if score > bestScore {
				l.Path = rel
				best, bestScore = l, score
			}
		}
		return nil
	})
	return best
}
