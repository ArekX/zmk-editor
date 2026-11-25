// Command zmk-editor serves the keymap editor UI and API from one binary.
package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"
	"time"

	zmkeditor "github.com/ArekX/zmk-editor"
	"github.com/ArekX/zmk-editor/internal/browser"
	"github.com/ArekX/zmk-editor/internal/config"
	"github.com/ArekX/zmk-editor/internal/db"
	"github.com/ArekX/zmk-editor/internal/git"
	"github.com/ArekX/zmk-editor/internal/github"
	"github.com/ArekX/zmk-editor/internal/httpapi"
	"github.com/ArekX/zmk-editor/internal/listen"
	"github.com/ArekX/zmk-editor/internal/repos"
	"github.com/ArekX/zmk-editor/internal/store"
)

func main() {
	flags, err := config.ParseFlags()
	if err != nil {
		fail(err)
	}
	if err := run(flags); err != nil {
		fail(err)
	}
}

func fail(err error) {
	_, _ = os.Stderr.WriteString("zmk-editor: " + err.Error() + "\n")
	os.Exit(1)
}

func run(flags config.Flags) error {
	log := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
	if err := flags.EnsureDirs(); err != nil {
		return err
	}
	conn, err := db.Open(flags.DBPath(), zmkeditor.MigrationsFS)
	if err != nil {
		return err
	}
	defer conn.Close()
	st := store.New(conn)

	runner := git.New()
	if err := runner.Available(); err != nil {
		log.Warn("git not found on PATH; repository operations will fail", "err", err)
	}
	gh := github.New(func() string {
		v, _ := st.GetSetting(store.SettingGitHubToken)
		return v
	})

	var frontend fs.FS
	if zmkeditor.FrontendEmbedded {
		sub, err := fs.Sub(zmkeditor.FrontendFS, zmkeditor.FrontendRoot)
		if err != nil {
			return fmt.Errorf("frontend bundle: %w", err)
		}
		frontend = sub
	}
	handler := httpapi.New(httpapi.Deps{
		Store:       st,
		Git:         runner,
		Repos:       &repos.Service{Store: st, Git: runner, ReposDir: flags.ReposDir()},
		GitHub:      gh,
		FirmwareDir: flags.FirmwareDir(),
		DataDir:     flags.DataDir,
		Version:     version(),
		Log:         log,
		Frontend:    frontend,
	})

	ln, err := listen.WithPortFallback(flags.Addr, 20)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	url := listen.BrowserURL(ln.Addr().String())
	log.Info("zmk-editor listening", "url", url, "data", flags.DataDir, "version", version())
	if flags.PortFile != "" {
		if err := os.WriteFile(flags.PortFile, []byte(url), 0o600); err != nil {
			return err
		}
	}

	srv := &http.Server{Handler: handler, ReadHeaderTimeout: 10 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	errCh := make(chan error, 1)
	go func() { errCh <- srv.Serve(ln) }()

	if !flags.NoBrowser && zmkeditor.FrontendEmbedded {
		if err := browser.Open(url); err != nil {
			log.Info("open the editor in your browser", "url", url)
		}
	}

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func version() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "dev"
	}
	rev, dirty := "", false
	for _, s := range info.Settings {
		switch s.Key {
		case "vcs.revision":
			rev = s.Value
		case "vcs.modified":
			dirty = s.Value == "true"
		}
	}
	if len(rev) > 7 {
		rev = rev[:7]
	}
	if rev == "" {
		return "dev"
	}
	if dirty {
		rev += "-dirty"
	}
	return rev
}
