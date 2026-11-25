package store

import (
	"database/sql"
	"errors"

	"github.com/ArekX/zmk-editor/internal/timeutil"
)

// GetCustomLayout returns the user's layout override for a keymap, or "".
func (s *Store) GetCustomLayout(repoID int64, keymapPath string) (string, error) {
	var v string
	err := s.db.QueryRow(`SELECT layout_json FROM custom_layouts WHERE repository_id = ? AND keymap_path = ?`, repoID, keymapPath).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return v, err
}

// SetCustomLayout stores (or with "" clears) the layout override.
func (s *Store) SetCustomLayout(repoID int64, keymapPath, layoutJSON string) error {
	if layoutJSON == "" {
		_, err := s.db.Exec(`DELETE FROM custom_layouts WHERE repository_id = ? AND keymap_path = ?`, repoID, keymapPath)
		return err
	}
	_, err := s.db.Exec(`INSERT INTO custom_layouts (repository_id, keymap_path, layout_json, updated_at) VALUES (?, ?, ?, ?)
ON CONFLICT(repository_id, keymap_path) DO UPDATE SET layout_json = excluded.layout_json, updated_at = excluded.updated_at`,
		repoID, keymapPath, layoutJSON, timeutil.NowRFC3339())
	return err
}
