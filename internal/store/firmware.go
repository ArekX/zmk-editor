package store

import "github.com/ArekX/zmk-editor/internal/timeutil"

// FirmwareDownload is a GitHub Actions artifact extracted into the cache.
type FirmwareDownload struct {
	ID           int64  `json:"id"`
	RepositoryID int64  `json:"repository_id"`
	ArtifactID   int64  `json:"artifact_id"`
	RunID        int64  `json:"run_id"`
	Name         string `json:"name"`
	HeadSHA      string `json:"head_sha"`
	Dir          string `json:"-"`
	CreatedAt    string `json:"created_at"`
}

const fwColumns = `id, repository_id, artifact_id, run_id, name, head_sha, dir, created_at`

func scanFirmware(r rowScanner) (FirmwareDownload, error) {
	var f FirmwareDownload
	err := r.Scan(&f.ID, &f.RepositoryID, &f.ArtifactID, &f.RunID, &f.Name, &f.HeadSHA, &f.Dir, &f.CreatedAt)
	return f, err
}

// ListFirmware returns the cached downloads of a repository, newest first.
func (s *Store) ListFirmware(repoID int64) ([]FirmwareDownload, error) {
	rows, err := s.db.Query(`SELECT `+fwColumns+` FROM firmware_downloads WHERE repository_id = ? ORDER BY id DESC`, repoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []FirmwareDownload{}
	for rows.Next() {
		f, err := scanFirmware(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// GetFirmwareByArtifact looks up a cached artifact.
func (s *Store) GetFirmwareByArtifact(repoID, artifactID int64) (FirmwareDownload, error) {
	f, err := scanFirmware(s.db.QueryRow(`SELECT `+fwColumns+` FROM firmware_downloads WHERE repository_id = ? AND artifact_id = ?`, repoID, artifactID))
	return f, notFound(err)
}

// CreateFirmware records an extracted artifact.
func (s *Store) CreateFirmware(f FirmwareDownload) (FirmwareDownload, error) {
	f.CreatedAt = timeutil.NowRFC3339()
	res, err := s.db.Exec(`INSERT INTO firmware_downloads (repository_id, artifact_id, run_id, name, head_sha, dir, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(repository_id, artifact_id) DO UPDATE SET dir = excluded.dir, created_at = excluded.created_at`,
		f.RepositoryID, f.ArtifactID, f.RunID, f.Name, f.HeadSHA, f.Dir, f.CreatedAt)
	if err != nil {
		return f, err
	}
	f.ID, _ = res.LastInsertId()
	return f, nil
}

// DeleteFirmware removes a cache row.
func (s *Store) DeleteFirmware(id int64) error {
	_, err := s.db.Exec(`DELETE FROM firmware_downloads WHERE id = ?`, id)
	return err
}
