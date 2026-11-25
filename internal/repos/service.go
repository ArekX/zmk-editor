// Package repos holds the repository-level operations behind the HTTP API:
// registering (clone or link) repositories, discovering keymaps, and
// loading/saving a keymap together with its resolved layout.
package repos

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/ArekX/zmk-editor/internal/git"
	"github.com/ArekX/zmk-editor/internal/store"
)

// Store is the subset of *store.Store the service uses.
type Store interface {
	GetRepository(id int64) (store.Repository, error)
	CreateRepository(r store.Repository) (store.Repository, error)
	DeleteRepository(id int64) error
	GetCustomLayout(repoID int64, keymapPath string) (string, error)
}

// Service implements repository operations.
type Service struct {
	Store    Store
	Git      *git.Runner
	ReposDir string
}

// AddInput describes a repository to register: either a remote URL to
// clone into the app's data dir, or an existing local checkout.
type AddInput struct {
	URL    string `json:"url"`
	Path   string `json:"path"`
	Name   string `json:"name"`
	Branch string `json:"branch"`
}

// ErrInvalid wraps user-input problems (mapped to 400).
var ErrInvalid = errors.New("invalid input")

func invalid(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, args...))
}

var dirNameRe = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

// Add clones or links a repository and records it.
func (s *Service) Add(ctx context.Context, in AddInput) (store.Repository, error) {
	in.URL, in.Path, in.Name = strings.TrimSpace(in.URL), strings.TrimSpace(in.Path), strings.TrimSpace(in.Name)
	switch {
	case in.URL != "" && in.Path != "":
		return store.Repository{}, invalid("give either a clone URL or a local path, not both")
	case in.URL != "":
		return s.clone(ctx, in)
	case in.Path != "":
		return s.link(ctx, in)
	default:
		return store.Repository{}, invalid("a clone URL or a local path is required")
	}
}

func (s *Service) clone(ctx context.Context, in AddInput) (store.Repository, error) {
	name := in.Name
	if name == "" {
		name = git.RepoNameFromURL(in.URL)
	}
	base := dirNameRe.ReplaceAllString(git.RepoNameFromURL(in.URL), "-")
	if base == "" {
		base = "repo"
	}
	dest := filepath.Join(s.ReposDir, base)
	for i := 2; exists(dest); i++ {
		dest = filepath.Join(s.ReposDir, fmt.Sprintf("%s-%d", base, i))
	}
	if err := s.Git.Clone(ctx, in.URL, dest, strings.TrimSpace(in.Branch)); err != nil {
		_ = os.RemoveAll(dest)
		return store.Repository{}, err
	}
	repo, err := s.Store.CreateRepository(store.Repository{Name: name, RemoteURL: in.URL, LocalPath: dest, Managed: true})
	if err != nil {
		_ = os.RemoveAll(dest)
		return store.Repository{}, err
	}
	return s.withDefaultKeymap(repo), nil
}

func (s *Service) link(ctx context.Context, in AddInput) (store.Repository, error) {
	path := in.Path
	if strings.HasPrefix(path, "~/") {
		home, _ := os.UserHomeDir()
		path = filepath.Join(home, path[2:])
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return store.Repository{}, invalid("bad path: %v", err)
	}
	if !s.Git.IsRepo(ctx, abs) {
		return store.Repository{}, invalid("%s is not the top level of a git repository", abs)
	}
	name := in.Name
	if name == "" {
		name = filepath.Base(abs)
	}
	repo, err := s.Store.CreateRepository(store.Repository{
		Name: name, RemoteURL: s.Git.RemoteURL(ctx, abs), LocalPath: abs, Managed: false,
	})
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return store.Repository{}, invalid("this folder is already registered")
		}
		return store.Repository{}, err
	}
	return s.withDefaultKeymap(repo), nil
}

func (s *Service) withDefaultKeymap(r store.Repository) store.Repository {
	if km := FindKeymaps(r.LocalPath); len(km) > 0 {
		r.DefaultKeymap = km[0]
	}
	return r
}

// Remove unregisters a repository. Managed clones are deleted from disk
// when deleteFiles is set; linked folders are never touched.
func (s *Service) Remove(id int64, deleteFiles bool) error {
	repo, err := s.Store.GetRepository(id)
	if err != nil {
		return err
	}
	if err := s.Store.DeleteRepository(id); err != nil {
		return err
	}
	if deleteFiles && repo.Managed && strings.HasPrefix(repo.LocalPath, s.ReposDir+string(filepath.Separator)) {
		return os.RemoveAll(repo.LocalPath)
	}
	return nil
}

func exists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}
