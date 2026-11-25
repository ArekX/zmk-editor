// Package git shells out to the user's git CLI. Using the real binary means
// the user's SSH agent, credential helpers and global identity apply as-is.
package git

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// DefaultTimeout bounds network operations (clone, fetch, pull, push).
const DefaultTimeout = 3 * time.Minute

// Runner executes git commands. One mutex per working directory keeps
// concurrent requests from racing on the same index.
type Runner struct {
	Binary string
	mu     sync.Mutex
	locks  map[string]*sync.Mutex
}

// New returns a runner using `git` from PATH.
func New() *Runner {
	return &Runner{Binary: "git", locks: map[string]*sync.Mutex{}}
}

// Error carries git's stderr so the UI can show what went wrong.
type Error struct {
	Args   []string
	Stderr string
	Err    error
}

func (e *Error) Error() string {
	msg := strings.TrimSpace(e.Stderr)
	if msg == "" {
		msg = e.Err.Error()
	}
	return fmt.Sprintf("git %s: %s", strings.Join(e.Args, " "), msg)
}

func (e *Error) Unwrap() error { return e.Err }

// Available reports whether the git binary can be executed.
func (r *Runner) Available() error {
	_, err := exec.LookPath(r.Binary)
	return err
}

// Lock serializes operations on a working directory. Callers that chain
// several commands hold it for the whole sequence.
func (r *Runner) Lock(dir string) func() {
	r.mu.Lock()
	m, ok := r.locks[dir]
	if !ok {
		m = &sync.Mutex{}
		r.locks[dir] = m
	}
	r.mu.Unlock()
	m.Lock()
	return m.Unlock
}

// Run executes git in dir and returns trimmed stdout.
func (r *Runner) Run(ctx context.Context, dir string, args ...string) (string, error) {
	out, err := r.RunRaw(ctx, dir, args...)
	return strings.TrimRight(out, "\n"), err
}

// RunRaw executes git in dir and returns stdout untouched.
func (r *Runner) RunRaw(ctx context.Context, dir string, args ...string) (string, error) {
	if _, ok := ctx.Deadline(); !ok {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, DefaultTimeout)
		defer cancel()
	}
	cmd := exec.CommandContext(ctx, r.Binary, args...)
	cmd.Dir = dir
	// Never block on an interactive prompt: there is no terminal attached.
	cmd.Env = append(os.Environ(),
		"GIT_TERMINAL_PROMPT=0",
		"GIT_SSH_COMMAND="+sshCommand(),
		"LC_ALL=C",
	)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			err = fmt.Errorf("timed out: %w", ctx.Err())
		}
		return stdout.String(), &Error{Args: args, Stderr: stderr.String(), Err: err}
	}
	return stdout.String(), nil
}

// sshCommand keeps the user's GIT_SSH_COMMAND if set, otherwise runs ssh in
// batch mode so an unknown host key or a passphrase prompt fails fast
// instead of hanging the request.
func sshCommand() string {
	if v := os.Getenv("GIT_SSH_COMMAND"); v != "" {
		return v
	}
	return "ssh -o BatchMode=yes"
}
