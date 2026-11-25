// Package config parses command-line flags and resolves the on-disk storage
// layout (data dir, SQLite file, managed clones, firmware cache).
package config

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

// Flags is the parsed command line.
type Flags struct {
	Addr      string // listen address, host:port
	DataDir   string // root of everything the app writes
	NoBrowser bool   // skip opening the browser on start
	PortFile  string // dev: write the bound URL here once listening
}

// ParseFlags reads os.Args. The data dir defaults to ~/.zmk-editor and can
// be overridden with ZMK_EDITOR_DATA_DIR or --data-dir.
func ParseFlags() (Flags, error) {
	var f Flags
	def, err := defaultDataDir()
	if err != nil {
		return f, err
	}
	fs := flag.NewFlagSet("zmk-editor", flag.ContinueOnError)
	fs.StringVar(&f.Addr, "addr", "127.0.0.1:7373", "listen address (host:port); the port walks forward if taken")
	fs.StringVar(&f.DataDir, "data-dir", def, "directory for the database, clones and firmware cache")
	fs.BoolVar(&f.NoBrowser, "no-browser", false, "do not open the browser on start")
	fs.StringVar(&f.PortFile, "port-file", "", "write the bound URL to this file (used by make dev)")
	if err := fs.Parse(os.Args[1:]); err != nil {
		return f, err
	}
	abs, err := filepath.Abs(f.DataDir)
	if err != nil {
		return f, fmt.Errorf("resolve data dir: %w", err)
	}
	f.DataDir = abs
	return f, nil
}

func defaultDataDir() (string, error) {
	if v := os.Getenv("ZMK_EDITOR_DATA_DIR"); v != "" {
		return v, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home dir: %w", err)
	}
	return filepath.Join(home, ".zmk-editor"), nil
}

// DBPath is the SQLite file.
func (f Flags) DBPath() string { return filepath.Join(f.DataDir, "zmk-editor.db") }

// ReposDir holds clones the app manages itself.
func (f Flags) ReposDir() string { return filepath.Join(f.DataDir, "repos") }

// FirmwareDir caches downloaded firmware artifacts.
func (f Flags) FirmwareDir() string { return filepath.Join(f.DataDir, "firmware") }

// EnsureDirs creates the data dir tree with owner-only permissions.
func (f Flags) EnsureDirs() error {
	for _, d := range []string{f.DataDir, f.ReposDir(), f.FirmwareDir()} {
		if err := os.MkdirAll(d, 0o700); err != nil {
			return fmt.Errorf("create %s: %w", d, err)
		}
	}
	return nil
}
