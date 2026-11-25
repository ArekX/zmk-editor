package github

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
)

// Run is a GitHub Actions workflow run.
type Run struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	DisplayTitle string `json:"display_title"`
	Status       string `json:"status"`     // queued, in_progress, completed
	Conclusion   string `json:"conclusion"` // success, failure, cancelled, ...
	HeadBranch   string `json:"head_branch"`
	HeadSHA      string `json:"head_sha"`
	Event        string `json:"event"`
	HTMLURL      string `json:"html_url"`
	WorkflowID   int64  `json:"workflow_id"`
	RunNumber    int64  `json:"run_number"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// Artifact is a file bundle uploaded by a run.
type Artifact struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	SizeInBytes int64  `json:"size_in_bytes"`
	Expired     bool   `json:"expired"`
	CreatedAt   string `json:"created_at"`
	ExpiresAt   string `json:"expires_at"`
}

// ListRuns returns the latest runs, optionally filtered by branch.
func (c *Client) ListRuns(ctx context.Context, owner, repo, branch string, perPage int) ([]Run, error) {
	q := url.Values{"per_page": {strconv.Itoa(perPage)}}
	if branch != "" {
		q.Set("branch", branch)
	}
	var out struct {
		WorkflowRuns []Run `json:"workflow_runs"`
	}
	if err := c.getJSON(ctx, repoPath(owner, repo)+"/actions/runs?"+q.Encode(), &out); err != nil {
		return nil, err
	}
	if out.WorkflowRuns == nil {
		out.WorkflowRuns = []Run{}
	}
	return out.WorkflowRuns, nil
}

// ListArtifacts returns the artifacts of a run.
func (c *Client) ListArtifacts(ctx context.Context, owner, repo string, runID int64) ([]Artifact, error) {
	var out struct {
		Artifacts []Artifact `json:"artifacts"`
	}
	path := fmt.Sprintf("%s/actions/runs/%d/artifacts?per_page=100", repoPath(owner, repo), runID)
	if err := c.getJSON(ctx, path, &out); err != nil {
		return nil, err
	}
	if out.Artifacts == nil {
		out.Artifacts = []Artifact{}
	}
	return out.Artifacts, nil
}

// DownloadArtifact streams an artifact's zip into w. GitHub always requires
// a token here, even for public repositories.
func (c *Client) DownloadArtifact(ctx context.Context, owner, repo string, artifactID int64, w io.Writer) error {
	if tok, _ := c.Token(); tok == "" {
		return ErrUnauthorized
	}
	// The API answers with a redirect to blob storage; net/http follows it
	// and drops the Authorization header on the cross-host hop.
	resp, err := c.do(ctx, http.MethodGet, fmt.Sprintf("%s/actions/artifacts/%d/zip", repoPath(owner, repo), artifactID), nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, err = io.Copy(w, resp.Body)
	return err
}

// Dispatch triggers a workflow_dispatch run of workflowID on ref.
func (c *Client) Dispatch(ctx context.Context, owner, repo string, workflowID int64, ref string) error {
	body, _ := json.Marshal(map[string]string{"ref": ref})
	resp, err := c.do(ctx, http.MethodPost, fmt.Sprintf("%s/actions/workflows/%d/dispatches", repoPath(owner, repo), workflowID), bytes.NewReader(body))
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// Rerun re-runs a finished run.
func (c *Client) Rerun(ctx context.Context, owner, repo string, runID int64) error {
	resp, err := c.do(ctx, http.MethodPost, fmt.Sprintf("%s/actions/runs/%d/rerun", repoPath(owner, repo), runID), nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}
