# CLAUDE.md

This file provides project-wide guidance to Claude Code (claude.ai/code) when working in this repository. For subsystem-specific conventions (stack, tooling, clean-code rules), see the nested CLAUDE.md files:

- [frontend/zmk-editor-ui/CLAUDE.md](frontend/zmk-editor-ui/CLAUDE.md) - React/TS/Tailwind/shadcn frontend.
- [internal/CLAUDE.md](internal/CLAUDE.md) - Go backend (internal packages + cmd entry point).

## What this is

**ZMK Editor** is a single-user local web app for editing [ZMK](https://zmk.dev) keymaps, based on [nickcoutsos/keymap-editor](https://github.com/nickcoutsos/keymap-editor). Instead of a GitHub App integration it works on **git repositories**: the user registers any number of zmk-config repositories (cloned by the app over SSH/HTTPS, or an existing local checkout), edits `.keymap` files visually, saves them to the working tree, and commits / pulls / pushes with their own git. A **GitHub integration** lists GitHub Actions builds of the current branch and downloads their firmware artifacts (and can copy a `.uf2` onto a mounted bootloader drive).

Ships as **one Go binary** with the React frontend embedded via `go:embed`. One SQLite file. One data directory (`~/.zmk-editor`, override with `--data-dir` or `ZMK_EDITOR_DATA_DIR`) holding the database, managed clones (`repos/`) and the firmware cache (`firmware/`). No accounts, no login, binds to loopback only.

The full spec lives in [spec/](spec/): read [spec/README.md](spec/README.md) first, then [spec/overview.md](spec/overview.md) and [spec/architecture.md](spec/architecture.md).

## Current state

- **Backend**: Go module `github.com/ArekX/zmk-editor` at the repo root. Packages under [internal/](internal/): `config`, `db`, `store`, `git`, `dts` (lenient devicetree parser with byte offsets), `keymap` (ZMK model extraction + in-place writer), `layout` (physical layout resolution), `repos` (repository service), `github` (Actions API client), `firmware` (artifact cache, UF2 flashing), `zmkdata` (embedded behavior/keycode catalogue), `httpapi`, `listen`, `browser`, `timeutil`. Entry point [cmd/zmk-editor/main.go](cmd/zmk-editor/main.go).
- **Frontend**: [frontend/zmk-editor-ui/](frontend/zmk-editor-ui/) - Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui (radix-maia) + hugeicons + TanStack Query + react-router. Routes: `/` (repositories) and `/repos/:id` (editor; URL params `keymap`, `tab`, `layer`). Editor tabs: Layers, Combos, Behaviors, Changes; the Firmware sheet opens from the top bar.
- **Tooling**: `.tool-versions` pins `golang 1.26.6` and `nodejs 24.19.0` (asdf). `Makefile` has `make dev`, `make build`, `make release`, `make check`.

Treat the spec as the source of truth when extending an area for the first time. Re-read the relevant spec file before writing code; when implementation has drifted from spec, log a decision and update the spec via `/consolidate`.

## Spec-driven workflow

- **[spec/](spec/)** - design documents, split by domain.
- **[decisions/](decisions/)** - numbered markdown files logging every decision made during implementation. Consolidated back into the spec via `/consolidate` (moved to `decisions/consolidated/`).
- **CLAUDE.md files** - this file and the nested ones carry conventions and cross-cutting rules.

Slash commands in [.claude/commands/](.claude/commands/):

| command            | purpose                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `/decide <change>` | make an ad-hoc change and log it as a decision.                                                                 |
| `/diff-suggest`    | review uncommitted changes for refactoring opportunities.                                                       |
| `/consolidate`     | fold accumulated `decisions/` back into specs and CLAUDE.md files and move them to `decisions/consolidated/`.  |

**Non-negotiable rules:**

- Work in **vertical slices** (backend + frontend together) unless a change is genuinely one-sided.
- **Every decision is logged** as the next numbered file in `decisions/`.
- `/consolidate` never edits code, only specs and CLAUDE.md files. Higher-numbered decisions win conflicts.
- Before calling a change done, `make check` passes and user-visible changes were looked at in the running app.

## Architecture invariants

- **One process, one binary.** The Go server hosts the REST API (`/api/*`) and the embedded frontend (`/`) on one loopback port (default `127.0.0.1:7373`, walking forward if taken). See [spec/architecture.md](spec/architecture.md).
- **Git goes through the user's `git` CLI**, never a library and never the GitHub API: the user's SSH agent, credential helpers and identity apply. Commands run with `GIT_TERMINAL_PROMPT=0` and `ssh -o BatchMode=yes` so nothing can hang on a prompt. One mutex per working directory (`git.Runner.Lock`).
- **Keymap edits are surgical.** `internal/keymap.Apply` re-parses the file on disk and splices only the properties and nodes that changed (layer `bindings` / `sensor-bindings` / `display-name`, combo properties, added/removed nodes). Everything else (comments, includes, macros, behavior definitions, formatting) stays byte-for-byte. An unchanged model writes the identical file. Existing layers cannot be reordered (positional `&mo N` references would silently break). See [spec/keymap-format.md](spec/keymap-format.md).
- **Saves are optimistic-locked.** The client sends the content hash it loaded; a mismatch (pulled, checked out, edited elsewhere) is a 409 `conflict` and nothing is written.
- **The frontend's draft is the editing source of truth.** The keymap document query never refetches on its own while editing; a new document version (new hash) resets the draft. Pull, discard and checkout are disabled while there are unsaved edits.
- **GitHub token is write-only.** Stored in SQLite (`settings.github_token`, file mode 0600), never returned by any endpoint. When absent, `gh auth token` is used if the GitHub CLI is logged in.
- **Request guard.** Only loopback `Host` headers are served (DNS-rebinding defence) and every non-GET request must carry `X-Requested-With: zmk-editor` (blocks cross-site form posts). The frontend's `api()` adds it.
- **SQLite writes are serialized** (`SetMaxOpenConns(1)`); migrations in [migrations/](migrations/) run on startup via golang-migrate.

## Commands

From the repo root:

- `make dev` - Go backend (`-tags dev`, no embedded UI) plus the Vite dev server with hot reload; Vite proxies `/api` to the port the backend bound.
- `make build` - builds the frontend to `dist/`, then `bin/zmk-editor` with it embedded.
- `make release` - cross-compiles single binaries for macOS, Linux and Windows into `bin/release/`.
- `make check` - Go build/vet/test/gofmt plus frontend typecheck/lint/build.

Per-subsystem commands live in the nested CLAUDE.md files.

## Specification index

- [spec/overview.md](spec/overview.md) - goals, scope, stack
- [spec/architecture.md](spec/architecture.md) - components and flows (edit, save, commit, firmware)
- [spec/data-model.md](spec/data-model.md) - SQLite schema and on-disk layout
- [spec/backend.md](spec/backend.md) - Go layout, HTTP API
- [spec/frontend.md](spec/frontend.md) - routes, editor state, components
- [spec/keymap-format.md](spec/keymap-format.md) - what the parser reads and how edits are written back
- [spec/layouts.md](spec/layouts.md) - physical layout sources
- [spec/git-integration.md](spec/git-integration.md) - repositories, git operations
- [spec/github-integration.md](spec/github-integration.md) - Actions builds, artifacts, flashing
- [spec/roadmap.md](spec/roadmap.md) - what is not built yet
