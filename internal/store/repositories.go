package store

import (
	"github.com/ArekX/zmk-editor/internal/timeutil"
)

// Repository is a zmk-config git checkout the user registered.
type Repository struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	RemoteURL     string `json:"remote_url"`
	LocalPath     string `json:"local_path"`
	Managed       bool   `json:"managed"` // true when the app cloned it into its data dir
	DefaultKeymap string `json:"default_keymap"`
	CreatedAt     string `json:"created_at"`
	UpdatedAt     string `json:"updated_at"`
}

const repoColumns = `id, name, remote_url, local_path, managed, default_keymap, created_at, updated_at`

type rowScanner interface{ Scan(dest ...any) error }

func scanRepo(r rowScanner) (Repository, error) {
	var repo Repository
	var managed int
	err := r.Scan(&repo.ID, &repo.Name, &repo.RemoteURL, &repo.LocalPath, &managed,
		&repo.DefaultKeymap, &repo.CreatedAt, &repo.UpdatedAt)
	repo.Managed = managed != 0
	return repo, err
}

// ListRepositories returns every repository, oldest first.
func (s *Store) ListRepositories() ([]Repository, error) {
	rows, err := s.db.Query(`SELECT ` + repoColumns + ` FROM repositories ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Repository{}
	for rows.Next() {
		r, err := scanRepo(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// GetRepository loads one repository by id.
func (s *Store) GetRepository(id int64) (Repository, error) {
	r, err := scanRepo(s.db.QueryRow(`SELECT `+repoColumns+` FROM repositories WHERE id = ?`, id))
	return r, notFound(err)
}

// CreateRepository inserts a row and returns it with its id.
func (s *Store) CreateRepository(r Repository) (Repository, error) {
	now := timeutil.NowRFC3339()
	res, err := s.db.Exec(`INSERT INTO repositories (name, remote_url, local_path, managed, default_keymap, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)`, r.Name, r.RemoteURL, r.LocalPath, boolToInt(r.Managed), r.DefaultKeymap, now, now)
	if err != nil {
		return r, err
	}
	r.ID, _ = res.LastInsertId()
	r.CreatedAt, r.UpdatedAt = now, now
	return r, nil
}

// UpdateRepository saves the user-editable fields.
func (s *Store) UpdateRepository(r Repository) error {
	res, err := s.db.Exec(`UPDATE repositories SET name = ?, remote_url = ?, local_path = ?, default_keymap = ?, updated_at = ? WHERE id = ?`,
		r.Name, r.RemoteURL, r.LocalPath, r.DefaultKeymap, timeutil.NowRFC3339(), r.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// SetLocalPath records where a managed clone ended up once its id is known.
func (s *Store) SetLocalPath(id int64, path string) error {
	_, err := s.db.Exec(`UPDATE repositories SET local_path = ?, updated_at = ? WHERE id = ?`, path, timeutil.NowRFC3339(), id)
	return err
}

// DeleteRepository removes the row (layouts and firmware rows cascade).
func (s *Store) DeleteRepository(id int64) error {
	_, err := s.db.Exec(`DELETE FROM repositories WHERE id = ?`, id)
	return err
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
