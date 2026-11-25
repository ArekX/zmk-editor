# ZMK Editor - Spec

A local, single-binary visual editor for ZMK keymaps that works on git repositories (clone, pull, commit, push) and fetches firmware built by GitHub Actions. Successor to the sunset nickcoutsos/keymap-editor, keeping its core look (layer list on the left, keyboard drawn from the physical layout, small behavior tag plus big legend on every key) with a modernized UI.

## How to read this spec

Start with [overview.md](overview.md), then [architecture.md](architecture.md). The rest are deep dives.

## Index

- [overview.md](overview.md) - goals, non-goals, stack
- [architecture.md](architecture.md) - components and the edit / save / commit / firmware flows
- [data-model.md](data-model.md) - SQLite schema and data directory layout
- [backend.md](backend.md) - Go packages and the HTTP API
- [frontend.md](frontend.md) - routes, URL params, editor state, components
- [keymap-format.md](keymap-format.md) - what is read from a `.keymap` and how edits are written back
- [layouts.md](layouts.md) - where physical key positions come from
- [git-integration.md](git-integration.md) - repositories and git operations
- [github-integration.md](github-integration.md) - Actions builds, artifacts, flashing UF2 drives
- [roadmap.md](roadmap.md) - known gaps and next steps
