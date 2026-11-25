package httpapi

import (
	"net/http"
	"strings"
)

func (s *server) gitStatus(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	st, err := s.Git.Status(r.Context(), repo.LocalPath)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (s *server) gitDiff(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	unlock := s.Git.Lock(repo.LocalPath)
	defer unlock()
	diff, err := s.Git.Diff(r.Context(), repo.LocalPath)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"diff": diff})
}

func (s *server) gitLog(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	commits, err := s.Git.Log(r.Context(), repo.LocalPath, 30)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, commits)
}

func (s *server) gitBranches(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	branches, err := s.Git.Branches(r.Context(), repo.LocalPath)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, branches)
}

func (s *server) gitCheckout(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	var in struct {
		Branch string `json:"branch"`
		Create bool   `json:"create"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	in.Branch = strings.TrimSpace(in.Branch)
	if in.Branch == "" || strings.HasPrefix(in.Branch, "-") {
		writeError(w, http.StatusBadRequest, "invalid branch name")
		return
	}
	unlock := s.Git.Lock(repo.LocalPath)
	defer unlock()
	var err error
	if in.Create {
		err = s.Git.CreateBranch(r.Context(), repo.LocalPath, in.Branch)
	} else {
		err = s.Git.Checkout(r.Context(), repo.LocalPath, in.Branch)
	}
	if err != nil {
		s.fail(w, err)
		return
	}
	s.gitStatus(w, r)
}

func (s *server) gitFetch(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	unlock := s.Git.Lock(repo.LocalPath)
	err := s.Git.Fetch(r.Context(), repo.LocalPath)
	unlock()
	if err != nil {
		s.fail(w, err)
		return
	}
	s.gitStatus(w, r)
}

func (s *server) gitPull(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	var in struct {
		Rebase bool `json:"rebase"`
	}
	if r.ContentLength > 0 && !decodeJSON(w, r, &in) {
		return
	}
	unlock := s.Git.Lock(repo.LocalPath)
	out, err := s.Git.Pull(r.Context(), repo.LocalPath, in.Rebase)
	unlock()
	if err != nil {
		s.fail(w, err)
		return
	}
	st, err := s.Git.Status(r.Context(), repo.LocalPath)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"output": out, "status": st})
}

func (s *server) gitPush(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	unlock := s.Git.Lock(repo.LocalPath)
	_, err := s.Git.Push(r.Context(), repo.LocalPath)
	unlock()
	if err != nil {
		s.fail(w, err)
		return
	}
	s.gitStatus(w, r)
}

func (s *server) gitCommit(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	var in struct {
		Message string `json:"message"`
		Push    bool   `json:"push"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.Message) == "" {
		writeError(w, http.StatusBadRequest, "a commit message is required")
		return
	}
	unlock := s.Git.Lock(repo.LocalPath)
	defer unlock()
	sha, err := s.Git.CommitAll(r.Context(), repo.LocalPath, in.Message)
	if err != nil {
		s.fail(w, err)
		return
	}
	pushErr := ""
	if in.Push {
		if _, err := s.Git.Push(r.Context(), repo.LocalPath); err != nil {
			pushErr = err.Error()
		}
	}
	st, err := s.Git.Status(r.Context(), repo.LocalPath)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sha": sha, "status": st, "push_error": pushErr})
}

func (s *server) gitDiscard(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	var in struct {
		Paths []string `json:"paths"`
	}
	if r.ContentLength > 0 && !decodeJSON(w, r, &in) {
		return
	}
	for _, p := range in.Paths {
		if strings.HasPrefix(p, "-") || strings.HasPrefix(p, "/") || strings.Contains(p, "..") {
			writeError(w, http.StatusBadRequest, "invalid path")
			return
		}
	}
	unlock := s.Git.Lock(repo.LocalPath)
	err := s.Git.Discard(r.Context(), repo.LocalPath, in.Paths...)
	unlock()
	if err != nil {
		s.fail(w, err)
		return
	}
	s.gitStatus(w, r)
}

// gitRemoteCheck fetches origin and reports the commits the current branch
// is missing, so the UI can offer a pull when a repository is opened.
func (s *server) gitRemoteCheck(w http.ResponseWriter, r *http.Request) {
	repo, ok := s.loadRepo(w, r)
	if !ok {
		return
	}
	unlock := s.Git.Lock(repo.LocalPath)
	defer unlock()
	if err := s.Git.Fetch(r.Context(), repo.LocalPath); err != nil {
		s.fail(w, err)
		return
	}
	st, err := s.Git.Status(r.Context(), repo.LocalPath)
	if err != nil {
		s.fail(w, err)
		return
	}
	incoming, err := s.Git.Incoming(r.Context(), repo.LocalPath, 20)
	if err != nil {
		s.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": st, "incoming": incoming})
}
