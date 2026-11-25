package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/ArekX/zmk-editor/internal/git"
	"github.com/ArekX/zmk-editor/internal/github"
	"github.com/ArekX/zmk-editor/internal/repos"
	"github.com/ArekX/zmk-editor/internal/store"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeCodedError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]string{"error": msg, "code": code})
}

// fail maps known error kinds onto HTTP statuses.
func (s *server) fail(w http.ResponseWriter, err error) {
	var gitErr *git.Error
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, repos.ErrInvalid):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, repos.ErrConflict):
		writeCodedError(w, http.StatusConflict, "conflict", err.Error())
	case errors.Is(err, github.ErrUnauthorized):
		writeCodedError(w, http.StatusBadRequest, "github_token_required", err.Error())
	case errors.As(err, &gitErr):
		writeCodedError(w, http.StatusUnprocessableEntity, "git", err.Error())
	default:
		s.Log.Error("request failed", "err", err)
		writeError(w, http.StatusInternalServerError, err.Error())
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 8<<20)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return false
	}
	return true
}

func pathInt(r *http.Request, name string) (int64, bool) {
	v, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	return v, err == nil
}

// loadRepo resolves {id} or writes the error.
func (s *server) loadRepo(w http.ResponseWriter, r *http.Request) (store.Repository, bool) {
	id, ok := pathInt(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid repository id")
		return store.Repository{}, false
	}
	repo, err := s.Store.GetRepository(id)
	if err != nil {
		s.fail(w, err)
		return repo, false
	}
	return repo, true
}
