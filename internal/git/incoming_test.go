package git

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func gitCmd(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
}

func TestIncomingAfterFetch(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
	root := t.TempDir()
	remote := filepath.Join(root, "remote.git")
	gitCmd(t, root, "init", "-q", "--bare", "-b", "main", remote)

	other := filepath.Join(root, "other")
	gitCmd(t, root, "clone", "-q", remote, other)
	gitCmd(t, other, "commit", "-q", "--allow-empty", "-m", "first")
	gitCmd(t, other, "push", "-q", "origin", "HEAD:main")

	r := New()
	local := filepath.Join(root, "local")
	ctx := context.Background()
	if err := r.Clone(ctx, remote, local, ""); err != nil {
		t.Fatal(err)
	}
	if in, err := r.Incoming(ctx, local, 20); err != nil || len(in) != 0 {
		t.Fatalf("fresh clone: %v %v", in, err)
	}

	gitCmd(t, other, "commit", "-q", "--allow-empty", "-m", "second")
	gitCmd(t, other, "push", "-q", "origin", "HEAD:main")
	if err := r.Fetch(ctx, local); err != nil {
		t.Fatal(err)
	}
	in, err := r.Incoming(ctx, local, 20)
	if err != nil || len(in) != 1 || in[0].Subject != "second" {
		t.Fatalf("incoming: %+v %v", in, err)
	}
	st, err := r.Status(ctx, local)
	if err != nil || st.Behind != 1 {
		t.Fatalf("status: %+v %v", st, err)
	}
}
