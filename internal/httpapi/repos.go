package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/ArekX/zmk-editor/internal/git"
	"github.com/ArekX/zmk-editor/internal/repos"
	"github.com/ArekX/zmk-editor/internal/store"
)

// repoView is a repository plus live git and GitHub details.
type repoView struct {
	store.Repository
	GitHubOwner string      `json:"github_owner"`
	GitHubRepo  string      `json:"github_repo"`
	Status      *git.Status `json:"status"`
	StatusError string      `json:"status_error,omitempty"`
	Keymaps     []string    `json:"keymaps"`
}

func (s *server) view(ctx context.Context, repo store.Repository, withKeymaps bool) repoView {
	v := repoView{Repository: repo}
	v.GitHubOwner, v.GitHubRepo, _ = git.GitHubSlug(repo.RemoteURL)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if st, err := s.Git.Status(ctx, repo.LocalPath); err == nil {
		v.Status = &st
	} else {
		v.StatusError = err.Error()
	}
	if withKeymaps {
		v.Keymaps = repos.FindKeymaps(repo.LocalPath)
	}
	return v
}

func (s *server) listRepos(w http.ResponseWriter, r *http.Request) {
	list, err := s.Store.ListRepositories()
	if err != nil {
		s.fail(w, err)
		return
	}
	out := make([]repoView, len(list))
	for i, repo := range list {
		out[i] = s.view(r.Context(), repo, false)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *server) createRepo(w http.ResponseWriter, r *http.Request) {
	var in repos.AddInput
	if !decodeJSON(w, r, &in) {
		return
	}
	repo, err := s.Repos.Add(r.Context(), in)
	if err != nil {
		s.fail(w, err)
		return
	}
	if repo.DefaultKeymap != "" {
		_ = s.Store.UpdateRepository(repo)
	}
	writeJSON(w, http.StatusCreated, s.view(r.Context(), repo, true))
}

func (s *server) getRepo(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, s.view(r.Context(), repo, true))
}

func (s *server) updateRepo(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	var in struct {
		Name          *string `json:"name"`
		DefaultKeymap *string `json:"default_keymap"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if in.Name != nil && *in.Name != "" {
		repo.Name = *in.Name
	}
	if in.DefaultKeymap != nil {
		repo.DefaultKeymap = *in.DefaultKeymap
	}
	if err := s.Store.UpdateRepository(repo); err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, s.view(r.Context(), repo, true))
}

func (s *server) deleteRepo(w http.ResponseWriter, r *http.Request) {
	id, ok := pathInt(r, "id")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid repository id")
		return
	}
	if err := s.Repos.Remove(id, r.URL.Query().Get("delete_files") == "1"); err != nil {
		s.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
