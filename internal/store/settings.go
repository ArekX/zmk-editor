package store

import (
	"database/sql"
	"errors"

	"github.com/ArekX/zmk-editor/internal/timeutil"
)

// Setting keys.
const (
	SettingGitHubToken = "github_token"
)

// GetSetting returns the stored value, or "" when the key was never set.
func (s *Store) GetSetting(key string) (string, error) {
	var v string
	err := s.db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return v, err
}

// SetSetting upserts a value. An empty value deletes the key.
func (s *Store) SetSetting(key, value string) error {
	if value == "" {
		_, err := s.db.Exec(`DELETE FROM settings WHERE key = ?`, key)
		return err
	}
	_, err := s.db.Exec(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		key, value, timeutil.NowRFC3339())
	return err
}
