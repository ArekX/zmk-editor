# Backend conventions

This file applies to Go code under [internal/](.) and [cmd/](../cmd/). For project-wide context see the [root CLAUDE.md](../CLAUDE.md).

## Stack

Module path is `github.com/ArekX/zmk-editor` at the repo root. Endpoint list and package layout live in [spec/backend.md](../spec/backend.md).

- `net/http` stdlib mux (Go 1.22+ method+path patterns), no framework.
- `modernc.org/sqlite` (pure Go, no CGO, so `CGO_ENABLED=0` cross-compiles work). Hand-written `database/sql`.
- `golang-migrate` for `migrations/*.sql`, embedded via the root `embed.go`.
- Git: shell out to the user's `git` CLI ([git/](git/)). No library.
- GitHub: a small REST client in [github/](github/) (stdlib `net/http`).
- No other runtime dependencies. Think twice before adding one.

## Commands

Run from the repo root:

```bash
go build ./...                 # compile all packages
go vet ./...                   # static analysis
go test ./...                  # run all tests
gofmt -l internal/ cmd/        # must print nothing
```

After any change, all four must pass (`make check` runs them plus the frontend checks).

## Package map

- [dts/](dts/) - lenient devicetree parser. `ast.go` (Node/Property with byte offsets), `parser.go` (statements, preprocessor skipping, recovery), `values.go` (strings, `<cell>` groups, tokenizing, int parsing with `#define` resolution). It never evaluates macros; unknown constructs become `File.Warnings`.
- [keymap/](keymap/) - ZMK model on top of `dts`. `model.go` (JSON types), `extract.go` (Parse: layers, combos, custom behaviors, conditional layers), `format.go` (bindings tables), `edits.go` (offset edit primitives), `apply.go` (layers), `combos.go` (combos). Test fixture: [keymap/testdata/corne.keymap](keymap/testdata/corne.keymap).
- [layout/](layout/) - `layout.go` (types, JSON parsing, generated grid), `devicetree.go` (`zmk,physical-layout`), `find.go` (source resolution order).
- [repos/](repos/) - `service.go` (add/clone/link/remove), `keymaps.go` (discovery, load, save with hash check, preview).
- [httpapi/](httpapi/) - one file per area: `server.go` (routes, guard, SPA), `httputil.go` (JSON + error mapping), `settings.go`, `zmk.go`, `repos.go`, `gitops.go`, `keymap.go`, `builds.go`, `firmware.go`.
- [store/](store/) - `store.go`, `settings.go`, `repositories.go`, `layouts.go`, `firmware.go`.

## Clean code rules

- **One responsibility per file.** Split packages by concern; follow the package map above when adding code.
- **Consumer-side interfaces at layer boundaries.** When package A consumes B, A declares the interface with only the methods it calls (see `repos.Store`).
- **Keep the keymap writer surgical.** New editable properties go through `setProp` / `deleteProp` / `removeStatement` / `insertBeforeClose` in `keymap/edits.go`, and `Apply` must keep writing an identical file for an unchanged model (covered by `TestApplyNoChangesIsIdentity`). Add a fixture-based test for every new kind of edit.
- **Errors map to statuses in one place** (`httpapi/httputil.go` `fail`): `store.ErrNotFound` 404, `repos.ErrInvalid` 400, `repos.ErrConflict` 409, `github.ErrUnauthorized` 400 `github_token_required`, `*git.Error` 422 `git`.
- **Never log or return the GitHub token.**
- **~500 line guardrail.** A file past ~500 lines has usually leaked several concerns; split it.
