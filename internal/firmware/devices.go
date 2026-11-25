package firmware

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"os/user"
	"path/filepath"
	"runtime"
	"strings"
)

// Device is a mounted UF2 bootloader drive (e.g. a nice!nano in
// bootloader mode shows up as NICENANO).
type Device struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Model   string `json:"model"`
	BoardID string `json:"board_id"`
}

// Devices lists mounted volumes that carry an INFO_UF2.TXT.
func Devices() []Device {
	out := []Device{}
	for _, root := range candidateMounts() {
		info := filepath.Join(root, "INFO_UF2.TXT")
		f, err := os.Open(info)
		if err != nil {
			continue
		}
		d := Device{Path: root, Name: filepath.Base(root)}
		sc := bufio.NewScanner(io.LimitReader(f, 4096))
		for sc.Scan() {
			k, v, ok := strings.Cut(sc.Text(), ":")
			if !ok {
				continue
			}
			switch strings.TrimSpace(k) {
			case "Model":
				d.Model = strings.TrimSpace(v)
			case "Board-ID":
				d.BoardID = strings.TrimSpace(v)
			}
		}
		f.Close()
		out = append(out, d)
	}
	return out
}

func candidateMounts() []string {
	var roots []string
	glob := func(pattern string) {
		m, _ := filepath.Glob(pattern)
		roots = append(roots, m...)
	}
	switch runtime.GOOS {
	case "darwin":
		glob("/Volumes/*")
	case "windows":
		for c := 'D'; c <= 'Z'; c++ {
			roots = append(roots, string(c)+`:\`)
		}
	default:
		name := ""
		if u, err := user.Current(); err == nil {
			name = u.Username
		}
		if name != "" {
			glob("/media/" + name + "/*")
			glob("/run/media/" + name + "/*")
		}
		glob("/media/*")
		glob("/mnt/*")
	}
	return roots
}

// Flash copies a UF2 file onto a bootloader drive. The device reboots as
// soon as the write completes, which can make the final close fail; a
// complete write is treated as success.
func Flash(src string, device Device) error {
	if !strings.EqualFold(filepath.Ext(src), ".uf2") {
		return errors.New("only .uf2 files can be flashed")
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	st, err := in.Stat()
	if err != nil {
		return err
	}
	dest := filepath.Join(device.Path, filepath.Base(src))
	out, err := os.Create(dest)
	if err != nil {
		return fmt.Errorf("open %s: %w", dest, err)
	}
	n, err := io.Copy(out, in)
	closeErr := out.Close()
	if err != nil && n < st.Size() {
		return fmt.Errorf("copy to %s: %w", device.Name, err)
	}
	if closeErr != nil && n < st.Size() {
		return fmt.Errorf("finish copy to %s: %w", device.Name, closeErr)
	}
	return nil
}

// FindDevice returns the mounted device at path.
func FindDevice(path string) (Device, bool) {
	for _, d := range Devices() {
		if d.Path == path {
			return d, true
		}
	}
	return Device{}, false
}
