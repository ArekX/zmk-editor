// Package timeutil holds tiny time helpers shared across packages.
package timeutil

import "time"

// NowRFC3339 returns the current UTC time formatted as RFC 3339, the format
// every timestamp column in SQLite uses.
func NowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}
