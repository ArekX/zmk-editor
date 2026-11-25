package git

import (
	"context"
	"strconv"
	"strings"
)

// FileChange is one entry of `git status`.
type FileChange struct {
	Path   string `json:"path"`
	Status string `json:"status"` // modified | added | deleted | renamed | untracked | conflicted
}

// Status summarizes the working tree and its relation to upstream.
type Status struct {
	Branch   string       `json:"branch"`
	Upstream string       `json:"upstream"`
	Ahead    int          `json:"ahead"`
	Behind   int          `json:"behind"`
	Head     string       `json:"head"`
	Files    []FileChange `json:"files"`
}

// Status parses `git status --porcelain=v2 --branch`.
func (r *Runner) Status(ctx context.Context, dir string) (Status, error) {
	out, err := r.Run(ctx, dir, "status", "--porcelain=v2", "--branch", "--untracked-files=all")
	if err != nil {
		return Status{}, err
	}
	return parseStatus(out), nil
}

func parseStatus(out string) Status {
	s := Status{Files: []FileChange{}}
	for _, line := range strings.Split(out, "\n") {
		switch {
		case strings.HasPrefix(line, "# branch.oid "):
			s.Head = strings.TrimPrefix(line, "# branch.oid ")
		case strings.HasPrefix(line, "# branch.head "):
			s.Branch = strings.TrimPrefix(line, "# branch.head ")
		case strings.HasPrefix(line, "# branch.upstream "):
			s.Upstream = strings.TrimPrefix(line, "# branch.upstream ")
		case strings.HasPrefix(line, "# branch.ab "):
			for _, f := range strings.Fields(strings.TrimPrefix(line, "# branch.ab ")) {
				n, _ := strconv.Atoi(f[1:])
				if f[0] == '+' {
					s.Ahead = n
				} else {
					s.Behind = n
				}
			}
		case strings.HasPrefix(line, "1 "):
			f := strings.SplitN(line, " ", 9)
			if len(f) == 9 {
				s.Files = append(s.Files, FileChange{Path: f[8], Status: xyStatus(f[1])})
			}
		case strings.HasPrefix(line, "2 "):
			f := strings.SplitN(line, " ", 10)
			if len(f) == 10 {
				path := strings.SplitN(f[9], "\t", 2)[0]
				s.Files = append(s.Files, FileChange{Path: path, Status: "renamed"})
			}
		case strings.HasPrefix(line, "u "):
			f := strings.SplitN(line, " ", 11)
			if len(f) == 11 {
				s.Files = append(s.Files, FileChange{Path: f[10], Status: "conflicted"})
			}
		case strings.HasPrefix(line, "? "):
			s.Files = append(s.Files, FileChange{Path: strings.TrimPrefix(line, "? "), Status: "untracked"})
		}
	}
	return s
}

func xyStatus(xy string) string {
	switch {
	case strings.ContainsRune(xy, 'D'):
		return "deleted"
	case strings.ContainsRune(xy, 'A'):
		return "added"
	case strings.ContainsRune(xy, 'R'):
		return "renamed"
	default:
		return "modified"
	}
}
