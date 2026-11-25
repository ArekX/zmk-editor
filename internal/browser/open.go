// Package browser opens a URL in the user's default browser. It is
// best-effort: on failure the caller logs the URL for the user instead.
package browser

import (
	"context"
	"errors"
	"os/exec"
	"runtime"
	"time"
)

// Open starts the platform's URL opener. Launchers normally exit right
// away; one that is still running after a few seconds is assumed to have
// handed the URL over.
func Open(url string) error {
	var errs []error
	for _, argv := range launchers() {
		if _, err := exec.LookPath(argv[0]); err != nil {
			continue
		}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		err := exec.CommandContext(ctx, argv[0], append(argv[1:], url)...).Run()
		timedOut := ctx.Err() != nil
		cancel()
		if err == nil || timedOut {
			return nil
		}
		errs = append(errs, err)
	}
	if len(errs) == 0 {
		return errors.New("no browser launcher found")
	}
	return errors.Join(errs...)
}

func launchers() [][]string {
	switch runtime.GOOS {
	case "darwin":
		return [][]string{{"open"}}
	case "windows":
		// `start` treats its first quoted argument as a window title.
		return [][]string{{"cmd", "/c", "start", ""}}
	default:
		return [][]string{{"xdg-open"}, {"wslview"}, {"cmd.exe", "/c", "start", ""}}
	}
}
