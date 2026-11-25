// Package zmkeditor is the root of the Go module. It only holds compile-time
// embedded assets so that sub-packages under internal/ can access them
// (go:embed directives can't reach files above the embedding file).
package zmkeditor

import "embed"

// MigrationsFS holds every SQL file under migrations/, applied by
// internal/db on startup.
//
//go:embed all:migrations
var MigrationsFS embed.FS
