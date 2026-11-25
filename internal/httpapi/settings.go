package httpapi

import (
	"net/http"
	"strings"

	"github.com/ArekX/zmk-editor/internal/store"
)

type settingsResponse struct {
	GitHubTokenSet    bool   `json:"github_token_set"`
	GitHubTokenSource string `json:"github_token_source"`
	GitAvailable      bool   `json:"git_available"`
	DataDir           string `json:"data_dir"`
	Version           string `json:"version"`
}

func (s *server) getSettings(w http.ResponseWriter, r *http.Request) {
	stored, _ := s.Store.GetSetting(store.SettingGitHubToken)
	_, source := s.GitHub.Token()
	writeJSON(w, http.StatusOK, settingsResponse{
		GitHubTokenSet:    stored != "",
		GitHubTokenSource: source,
		GitAvailable:      s.Git.Available() == nil,
		DataDir:           s.DataDir,
		Version:           s.Version,
	})
}

// putSettings updates settings. The token is write-only: it is never
// returned by any endpoint. A null/absent field is left unchanged, "" clears.
func (s *server) putSettings(w http.ResponseWriter, r *http.Request) {
	var in struct {
		GitHubToken *string `json:"github_token"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if in.GitHubToken != nil {
		if err := s.Store.SetSetting(store.SettingGitHubToken, strings.TrimSpace(*in.GitHubToken)); err != nil {
			s.fail(w, err)
			return
		}
		s.GitHub.ResetCache()
	}
	s.getSettings(w, r)
}
