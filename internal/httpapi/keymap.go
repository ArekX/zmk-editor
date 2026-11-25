package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/ArekX/zmk-editor/internal/keymap"
	"github.com/ArekX/zmk-editor/internal/layout"
	"github.com/ArekX/zmk-editor/internal/repos"
)

func (s *server) listKeymaps(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, repos.FindKeymaps(repo.LocalPath))
}

func (s *server) getKeymap(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	doc, err := s.Repos.Load(repo, r.URL.Query().Get("path"))
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

type saveKeymapInput struct {
	Hash   string         `json:"hash"`
	Keymap *keymap.Keymap `json:"keymap"`
}

func (s *server) saveKeymap(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	var in saveKeymapInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if in.Keymap == nil {
		writeError(w, http.StatusBadRequest, "keymap is required")
		return
	}
	doc, err := s.Repos.Save(repo, r.URL.Query().Get("path"), in.Hash, in.Keymap)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, doc)
}

func (s *server) previewKeymap(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	var in saveKeymapInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if in.Keymap == nil {
		writeError(w, http.StatusBadRequest, "keymap is required")
		return
	}
	before, after, err := s.Repos.Preview(repo, r.URL.Query().Get("path"), in.Keymap)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"before": before, "after": after})
}

// saveLayout stores (or with null clears) the custom layout override.
func (s *server) saveLayout(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	path := r.URL.Query().Get("path")
	if _, err := repos.KeymapPath(repo, path); err != nil {
		s.fail(w, err)
		return
	}
	var in struct {
		Layout json.RawMessage `json:"layout"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	value := ""
	if len(in.Layout) > 0 && string(in.Layout) != "null" {
		if _, err := layout.FromJSON(in.Layout, 0); err != nil {
			writeError(w, http.StatusBadRequest, "invalid layout: "+err.Error())
			return
		}
		value = string(in.Layout)
	}
	if err := s.Store.SetCustomLayout(repo.ID, path, value); err != nil {
		s.fail(w, err)
		return
	}
	s.getKeymap(w, r)
}
