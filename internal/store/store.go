// Package store is the SQLite persistence layer. One file per domain:
// settings.go, repositories.go, layouts.go, firmware.go.
package store

import (
	"database/sql"
	"errors"
)

// ErrNotFound is returned when a looked-up row does not exist.
var ErrNotFound = errors.New("not found")

// Store wraps the shared *sql.DB handle.
type Store struct {
	db *sql.DB
}

// New wraps an open database handle.
func New(db *sql.DB) *Store { return &Store{db: db} }

func notFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	return err
}
