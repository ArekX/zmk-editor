package git

import (
	"regexp"
	"strings"
)

var githubRemote = regexp.MustCompile(`^(?:git@github\.com:|ssh://git@github\.com/|https?://(?:[^@/]+@)?github\.com/)([^/]+)/([^/]+?)(?:\.git)?/?$`)

// GitHubSlug extracts owner and repo from a GitHub remote URL. ok is false
// for any other host.
func GitHubSlug(remote string) (owner, repo string, ok bool) {
	m := githubRemote.FindStringSubmatch(strings.TrimSpace(remote))
	if m == nil {
		return "", "", false
	}
	return m[1], m[2], true
}

// RepoNameFromURL derives a display name from a clone URL or path.
func RepoNameFromURL(url string) string {
	url = strings.TrimRight(strings.TrimSpace(url), "/")
	url = strings.TrimSuffix(url, ".git")
	if i := strings.LastIndexAny(url, "/:"); i >= 0 {
		url = url[i+1:]
	}
	return url
}
