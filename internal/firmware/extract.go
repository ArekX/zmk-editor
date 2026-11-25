// Package firmware caches downloaded build artifacts on disk and flashes
// UF2 files onto bootloader drives.
package firmware

import (
	"archive/zip"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// maxExtractSize caps the total uncompressed size of one artifact.
const maxExtractSize = 256 << 20

// File is one extracted firmware file.
type File struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
}

// Extract unpacks zipPath into dir, flattening nothing but refusing any
// entry that would escape dir.
func Extract(zipPath, dir string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("open artifact zip: %w", err)
	}
	defer r.Close()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	var total int64
	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}
		name := filepath.Clean(filepath.FromSlash(f.Name))
		if filepath.IsAbs(name) || strings.HasPrefix(name, "..") {
			return fmt.Errorf("artifact entry %q escapes the target directory", f.Name)
		}
		total += int64(f.UncompressedSize64)
		if total > maxExtractSize {
			return errors.New("artifact is larger than 256 MiB uncompressed")
		}
		dest := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(dest), 0o700); err != nil {
			return err
		}
		if err := extractOne(f, dest); err != nil {
			return err
		}
	}
	return nil
}

func extractOne(f *zip.File, dest string) error {
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()
	out, err := os.OpenFile(dest, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, io.LimitReader(rc, maxExtractSize)); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

// List returns the files under dir (relative, slash-separated), sorted.
func List(dir string) ([]File, error) {
	files := []File{}
	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(dir, path)
		files = append(files, File{Name: filepath.ToSlash(rel), Size: info.Size()})
		return nil
	})
	sort.Slice(files, func(i, j int) bool { return files[i].Name < files[j].Name })
	return files, err
}

// Resolve maps a listed file name back to a path inside dir, rejecting
// anything that escapes it.
func Resolve(dir, name string) (string, error) {
	clean := filepath.Clean(filepath.FromSlash(name))
	if filepath.IsAbs(clean) || strings.HasPrefix(clean, "..") {
		return "", errors.New("invalid file name")
	}
	return filepath.Join(dir, clean), nil
}
