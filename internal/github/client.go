// Package github talks to the GitHub REST API for the one thing the app
// needs from it: zmk-config build runs (GitHub Actions) and their firmware
// artifacts. Git itself goes through the git CLI, never this client.
package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os/exec"
	"strings"
	"sync"
	"time"
)

const apiBase = "https://api.github.com"

// Token source values reported to the UI.
const (
	TokenFromSettings = "settings"
	TokenFromGH       = "gh"
	TokenNone         = "none"
)

// ErrUnauthorized means GitHub rejected (or required) a token.
var ErrUnauthorized = errors.New("GitHub requires a token for this request; add one in Settings or sign in with `gh auth login`")

// Client is a minimal GitHub REST client.
type Client struct {
	HTTP *http.Client
	// SettingsToken returns the token saved in the app ("" for none).
	SettingsToken func() string

	mu       sync.Mutex
	ghToken  string
	ghLoaded time.Time
}

// New returns a client with sane timeouts.
func New(settingsToken func() string) *Client {
	return &Client{HTTP: &http.Client{Timeout: 5 * time.Minute}, SettingsToken: settingsToken}
}

// Token returns the token to use and where it came from: the app settings
// first, then the GitHub CLI's (`gh auth token`), cached for a few minutes.
func (c *Client) Token() (string, string) {
	if t := strings.TrimSpace(c.SettingsToken()); t != "" {
		return t, TokenFromSettings
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if time.Since(c.ghLoaded) > 5*time.Minute {
		c.ghLoaded = time.Now()
		c.ghToken = ""
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if out, err := exec.CommandContext(ctx, "gh", "auth", "token").Output(); err == nil {
			c.ghToken = strings.TrimSpace(string(out))
		}
	}
	if c.ghToken != "" {
		return c.ghToken, TokenFromGH
	}
	return "", TokenNone
}

// ResetCache forgets the cached gh token (after settings change).
func (c *Client) ResetCache() {
	c.mu.Lock()
	c.ghLoaded = time.Time{}
	c.mu.Unlock()
}

func (c *Client) do(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, apiBase+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "zmk-editor")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if tok, _ := c.Token(); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		defer resp.Body.Close()
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		var e struct {
			Message string `json:"message"`
		}
		_ = json.Unmarshal(msg, &e)
		switch resp.StatusCode {
		case http.StatusUnauthorized, http.StatusForbidden:
			if tok, _ := c.Token(); tok == "" {
				return nil, ErrUnauthorized
			}
		}
		if e.Message == "" {
			e.Message = resp.Status
		}
		return nil, fmt.Errorf("github: %s", e.Message)
	}
	return resp, nil
}

func (c *Client) getJSON(ctx context.Context, path string, out any) error {
	resp, err := c.do(ctx, http.MethodGet, path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return json.NewDecoder(resp.Body).Decode(out)
}

func repoPath(owner, repo string) string {
	return "/repos/" + url.PathEscape(owner) + "/" + url.PathEscape(repo)
}
