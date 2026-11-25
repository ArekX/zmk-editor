// Package db opens the SQLite database and applies migrations.
package db

import (
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/sqlite"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "modernc.org/sqlite"
)

// Open opens (creating if needed) the database at path with WAL, foreign
// keys and a busy timeout, restricts the file to the owner, and runs every
// pending migration found under "migrations/" in migrations.
func Open(path string, migrations fs.FS) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}
	conn, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	// One connection: SQLite has a single writer anyway, and this keeps
	// writes from ever contending.
	conn.SetMaxOpenConns(1)
	if err := conn.Ping(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := os.Chmod(path, 0o600); err != nil {
		conn.Close()
		return nil, err
	}
	if err := migrateUp(path, migrations); err != nil {
		conn.Close()
		return nil, err
	}
	return conn, nil
}

func migrateUp(path string, migrations fs.FS) error {
	src, err := iofs.New(migrations, "migrations")
	if err != nil {
		return err
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, "sqlite://"+path)
	if err != nil {
		return err
	}
	defer m.Close()
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
