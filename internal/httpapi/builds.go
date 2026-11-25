package httpapi

import (
	"net/http"
	"strconv"

	"github.com/ArekX/zmk-editor/internal/git"
	"github.com/ArekX/zmk-editor/internal/store"
)

// githubRepo resolves owner/repo for a repository or writes a 400.
func (s *server) githubRepo(w http.ResponseWriter, repo store.Repository) (string, string, bool) {
	owner, name, ok := git.GitHubSlug(repo.RemoteURL)
	if !ok {
		writeCodedError(w, http.StatusBadRequest, "not_github", "the repository's origin is not on GitHub")
		return "", "", false
	}
	return owner, name, true
}

func (s *server) listBuilds(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	owner, name, ok := s.githubRepo(w, repo)
	if !ok {
		return
	}
	branch := r.URL.Query().Get("branch")
	if branch == "" {
		branch, _ = s.Git.CurrentBranch(r.Context(), repo.LocalPath)
	}
	runs, err := s.GitHub.ListRuns(r.Context(), owner, name, branch, 15)
	if err != nil {
		s.fail(w, err)
		return
	}
	_, source := s.GitHub.Token()
	writeJSON(w, http.StatusOK, map[string]any{
		"owner": owner, "repo": name, "branch": branch, "token_source": source, "runs": runs,
	})
}

func (s *server) listArtifacts(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	owner, name, ok := s.githubRepo(w, repo)
	if !ok {
		return
	}
	runID, ok := pathInt(r, "run")
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid run id")
		return
	}
	arts, err := s.GitHub.ListArtifacts(r.Context(), owner, name, runID)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, arts)
}

func (s *server) dispatchBuild(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	owner, name, ok := s.githubRepo(w, repo)
	if !ok {
		return
	}
	var in struct {
		WorkflowID int64  `json:"workflow_id"`
		Ref        string `json:"ref"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if in.Ref == "" {
		in.Ref, _ = s.Git.CurrentBranch(r.Context(), repo.LocalPath)
	}
	if in.WorkflowID == 0 {
		writeError(w, http.StatusBadRequest, "workflow_id is required")
		return
	}
	if err := s.GitHub.Dispatch(r.Context(), owner, name, in.WorkflowID, in.Ref); err != nil {
		s.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (s *server) rerunBuild(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	owner, name, ok := s.githubRepo(w, repo)
	if !ok {
		return
	}
	runID, err := strconv.ParseInt(r.PathValue("run"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid run id")
		return
	}
	if err := s.GitHub.Rerun(r.Context(), owner, name, runID); err != nil {
		s.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}
