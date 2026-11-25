package httpapi

import (
	"net/http"

	"github.com/ArekX/zmk-editor/internal/zmkdata"
)

func (s *server) zmkBehaviors(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write(zmkdata.Behaviors)
}

func (s *server) zmkKeycodes(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write(zmkdata.Keycodes)
}
