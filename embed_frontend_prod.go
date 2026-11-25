//go:build !dev

package zmkeditor

import "embed"

// FrontendFS holds the Vite production build at frontend/zmk-editor-ui/dist.
// `make build` always builds the frontend first so this path exists.
//
//go:embed all:frontend/zmk-editor-ui/dist
var FrontendFS embed.FS

// FrontendRoot is the path inside FrontendFS where index.html lives.
const FrontendRoot = "frontend/zmk-editor-ui/dist"

// FrontendEmbedded reports whether this build was compiled with the real
// frontend bundle.
const FrontendEmbedded = true
