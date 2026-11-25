package git

import (
	"context"
	"path/filepath"
	"strconv"
	"strings"
)

// Clone clones url into dest. An empty branch takes the remote default.
func (r *Runner) Clone(ctx context.Context, url, dest, branch string) error {
	args := []string{"clone", "--origin", "origin"}
	if branch != "" {
		args = append(args, "--branch", branch)
	}
	args = append(args, url, dest)
	_, err := r.Run(ctx, filepath.Dir(dest), args...)
	return err
}

// IsRepo reports whether dir is the top level of a git work tree.
func (r *Runner) IsRepo(ctx context.Context, dir string) bool {
	top, err := r.Run(ctx, dir, "rev-parse", "--show-toplevel")
	if err != nil {
		return false
	}
	a, _ := filepath.EvalSymlinks(top)
	b, _ := filepath.EvalSymlinks(dir)
	return a == b
}

// RemoteURL returns origin's URL, or "" when there is no origin.
func (r *Runner) RemoteURL(ctx context.Context, dir string) string {
	out, err := r.Run(ctx, dir, "remote", "get-url", "origin")
	if err != nil {
		return ""
	}
	return out
}

// Fetch updates remote-tracking refs from origin.
func (r *Runner) Fetch(ctx context.Context, dir string) error {
	_, err := r.Run(ctx, dir, "fetch", "--prune", "origin")
	return err
}

// Pull fast-forwards, or rebases local commits onto upstream when rebase.
func (r *Runner) Pull(ctx context.Context, dir string, rebase bool) (string, error) {
	args := []string{"pull", "--ff-only"}
	if rebase {
		args = []string{"pull", "--rebase", "--autostash"}
	}
	return r.Run(ctx, dir, args...)
}

// Push pushes the current branch, setting upstream when missing.
func (r *Runner) Push(ctx context.Context, dir string) (string, error) {
	branch, err := r.CurrentBranch(ctx, dir)
	if err != nil {
		return "", err
	}
	out, err := r.Run(ctx, dir, "push", "--set-upstream", "origin", branch)
	return out, err
}

// CurrentBranch returns the checked-out branch name ("HEAD" when detached).
func (r *Runner) CurrentBranch(ctx context.Context, dir string) (string, error) {
	return r.Run(ctx, dir, "rev-parse", "--abbrev-ref", "HEAD")
}

// Branches lists local and remote branch names (remote ones without "origin/").
func (r *Runner) Branches(ctx context.Context, dir string) ([]string, error) {
	out, err := r.Run(ctx, dir, "for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes/origin")
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	names := []string{}
	for _, line := range strings.Split(out, "\n") {
		name := strings.TrimPrefix(strings.TrimPrefix(line, "refs/heads/"), "refs/remotes/origin/")
		if name == "" || name == "HEAD" || name == "refs/remotes/origin/HEAD" || seen[name] {
			continue
		}
		seen[name] = true
		names = append(names, name)
	}
	return names, nil
}

// Checkout switches to branch, creating a tracking branch from origin when
// only the remote one exists.
func (r *Runner) Checkout(ctx context.Context, dir, branch string) error {
	_, err := r.Run(ctx, dir, "checkout", branch)
	return err
}

// CreateBranch creates and checks out a new branch from HEAD.
func (r *Runner) CreateBranch(ctx context.Context, dir, branch string) error {
	_, err := r.Run(ctx, dir, "checkout", "-b", branch)
	return err
}

// CommitAll stages every change and commits it.
func (r *Runner) CommitAll(ctx context.Context, dir, message string) (string, error) {
	if _, err := r.Run(ctx, dir, "add", "-A"); err != nil {
		return "", err
	}
	if _, err := r.Run(ctx, dir, "commit", "-m", message); err != nil {
		return "", err
	}
	return r.Run(ctx, dir, "rev-parse", "HEAD")
}

// Discard reverts the working tree (tracked and untracked) to HEAD. With
// paths it only reverts those.
func (r *Runner) Discard(ctx context.Context, dir string, paths ...string) error {
	if len(paths) == 0 {
		if _, err := r.Run(ctx, dir, "reset", "--hard", "HEAD"); err != nil {
			return err
		}
		_, err := r.Run(ctx, dir, "clean", "-fd")
		return err
	}
	args := append([]string{"checkout", "HEAD", "--"}, paths...)
	if _, err := r.Run(ctx, dir, args...); err != nil {
		// Untracked files have nothing in HEAD to check out; remove them.
		cargs := append([]string{"clean", "-f", "--"}, paths...)
		_, err2 := r.Run(ctx, dir, cargs...)
		if err2 != nil {
			return err
		}
	}
	return nil
}

// Diff returns the unified diff of the working tree against HEAD,
// including untracked files (shown as new).
func (r *Runner) Diff(ctx context.Context, dir string) (string, error) {
	// Intent-to-add makes untracked files show up in `git diff`.
	if _, err := r.Run(ctx, dir, "add", "-N", "."); err != nil {
		return "", err
	}
	return r.RunRaw(ctx, dir, "diff", "HEAD", "--no-color", "--no-ext-diff")
}

// Commit is one entry of the log.
type Commit struct {
	SHA     string `json:"sha"`
	Short   string `json:"short"`
	Author  string `json:"author"`
	Date    string `json:"date"`
	Subject string `json:"subject"`
}

// Log returns the last n commits on HEAD.
func (r *Runner) Log(ctx context.Context, dir string, n int) ([]Commit, error) {
	out, err := r.Run(ctx, dir, "log", "-n", strconv.Itoa(n), "--format=%H%x1f%h%x1f%an%x1f%cI%x1f%s")
	if err != nil {
		return nil, err
	}
	return parseLog(out), nil
}

// Incoming returns up to n commits on the upstream branch that HEAD does
// not have yet (run Fetch first). No upstream means no incoming commits.
func (r *Runner) Incoming(ctx context.Context, dir string, n int) ([]Commit, error) {
	if _, err := r.Run(ctx, dir, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"); err != nil {
		return []Commit{}, nil
	}
	out, err := r.Run(ctx, dir, "log", "-n", strconv.Itoa(n), "--format=%H%x1f%h%x1f%an%x1f%cI%x1f%s", "HEAD..@{upstream}")
	if err != nil {
		return nil, err
	}
	return parseLog(out), nil
}

func parseLog(out string) []Commit {
	commits := []Commit{}
	for _, line := range strings.Split(out, "\n") {
		f := strings.Split(line, "\x1f")
		if len(f) != 5 {
			continue
		}
		commits = append(commits, Commit{SHA: f[0], Short: f[1], Author: f[2], Date: f[3], Subject: f[4]})
	}
	return commits
}
