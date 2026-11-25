// Package httpapi is the REST API under /api plus the embedded frontend.
// One file per area: settings.go, repos.go, gitops.go, keymap.go,
// builds.go, firmware.go, zmk.go; helpers in httputil.go.
package httpapi

import (
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"strings"

	"github.com/ArekX/zmk-editor/internal/git"
	"github.com/ArekX/zmk-editor/internal/github"
	"github.com/ArekX/zmk-editor/internal/repos"
	"github.com/ArekX/zmk-editor/internal/store"
)

// Deps wires the subsystems the handlers use.
type Deps struct {
	Store       *store.Store
	Git         *git.Runner
	Repos       *repos.Service
	GitHub      *github.Client
	FirmwareDir string
	DataDir     string
	Version     string
	Log         *slog.Logger
	// Frontend is the built UI (nil in dev builds, where Vite serves it).
	Frontend fs.FS
}

type server struct{ Deps }

// New builds the root handler.
func New(d Deps) http.Handler {
	s := &server{d}
	mux := http.NewServeMux()
	s.routes(mux)
	if d.Frontend != nil {
		mux.Handle("/", spaHandler(d.Frontend))
	}
	return guard(mux)
}

func (s *server) routes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": s.Version})
	})
	mux.HandleFunc("GET /api/settings", s.getSettings)
	mux.HandleFunc("PUT /api/settings", s.putSettings)
	mux.HandleFunc("GET /api/zmk/behaviors", s.zmkBehaviors)
	mux.HandleFunc("GET /api/zmk/keycodes", s.zmkKeycodes)

	mux.HandleFunc("GET /api/repos", s.listRepos)
	mux.HandleFunc("POST /api/repos", s.createRepo)
	mux.HandleFunc("GET /api/repos/{id}", s.getRepo)
	mux.HandleFunc("PATCH /api/repos/{id}", s.updateRepo)
	mux.HandleFunc("DELETE /api/repos/{id}", s.deleteRepo)

	mux.HandleFunc("GET /api/repos/{id}/status", s.gitStatus)
	mux.HandleFunc("GET /api/repos/{id}/diff", s.gitDiff)
	mux.HandleFunc("GET /api/repos/{id}/log", s.gitLog)
	mux.HandleFunc("GET /api/repos/{id}/branches", s.gitBranches)
	mux.HandleFunc("POST /api/repos/{id}/checkout", s.gitCheckout)
	mux.HandleFunc("POST /api/repos/{id}/fetch", s.gitFetch)
	mux.HandleFunc("POST /api/repos/{id}/pull", s.gitPull)
	mux.HandleFunc("POST /api/repos/{id}/push", s.gitPush)
	mux.HandleFunc("POST /api/repos/{id}/commit", s.gitCommit)
	mux.HandleFunc("POST /api/repos/{id}/discard", s.gitDiscard)

	mux.HandleFunc("GET /api/repos/{id}/keymaps", s.listKeymaps)
	mux.HandleFunc("GET /api/repos/{id}/keymap", s.getKeymap)
	mux.HandleFunc("PUT /api/repos/{id}/keymap", s.saveKeymap)
	mux.HandleFunc("POST /api/repos/{id}/keymap/preview", s.previewKeymap)
	mux.HandleFunc("PUT /api/repos/{id}/layout", s.saveLayout)

	mux.HandleFunc("GET /api/repos/{id}/builds", s.listBuilds)
	mux.HandleFunc("GET /api/repos/{id}/builds/{run}/artifacts", s.listArtifacts)
	mux.HandleFunc("POST /api/repos/{id}/builds/dispatch", s.dispatchBuild)
	mux.HandleFunc("POST /api/repos/{id}/builds/{run}/rerun", s.rerunBuild)

	mux.HandleFunc("GET /api/repos/{id}/firmware", s.listFirmware)
	mux.HandleFunc("POST /api/repos/{id}/firmware", s.downloadFirmware)
	mux.HandleFunc("DELETE /api/repos/{id}/firmware/{fw}", s.deleteFirmware)
	mux.HandleFunc("GET /api/repos/{id}/firmware/{fw}/files/{name...}", s.firmwareFile)
	mux.HandleFunc("GET /api/repos/{id}/firmware/{fw}/zip", s.firmwareZip)
	mux.HandleFunc("POST /api/repos/{id}/firmware/{fw}/flash", s.flashFirmware)
	mux.HandleFunc("GET /api/devices", s.listDevices)
}

// guard rejects requests that could come from another site: the Host must
// be a loopback name (DNS-rebinding defence) and state-changing requests
// must carry the X-Requested-With header, which a cross-origin page cannot
// set without a CORS preflight this server never approves.
func guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		if h, _, err := net.SplitHostPort(host); err == nil {
			host = h
		}
		host = strings.Trim(host, "[]")
		if host != "localhost" && host != "127.0.0.1" && host != "::1" {
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Header.Get("X-Requested-With") != "zmk-editor" {
			writeError(w, http.StatusForbidden, "missing X-Requested-With header")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// spaHandler serves static files and falls back to index.html so client
// routes survive a reload.
func spaHandler(root fs.FS) http.Handler {
	files := http.FileServer(http.FS(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p != "" {
			if _, err := fs.Stat(root, p); err == nil {
				if strings.HasPrefix(p, "assets/") {
					w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
				}
				files.ServeHTTP(w, r)
				return
			}
		}
		w.Header().Set("Cache-Control", "no-cache")
		r2 := r.Clone(r.Context())
		r2.URL.Path = "/"
		files.ServeHTTP(w, r2)
	})
}
