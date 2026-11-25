//go:build dev

package zmkeditor

import "embed"

// FrontendFS is empty in dev builds: Vite serves the UI on 5173 and proxies
// /api to the Go server.
var FrontendFS embed.FS

// FrontendRoot is unused in dev builds.
const FrontendRoot = ""

// FrontendEmbedded is false: the dev build has no bundled frontend.
const FrontendEmbedded = false
