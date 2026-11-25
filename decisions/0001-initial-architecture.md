# 0001 - Initial architecture

**Date:** 2026-11-25

**User request:** "Since this repo is getting sunset - https://github.com/nickcoutsos/keymap-editor - I would like us to build our own version... in golang and react as a single buildable thing in one exe. Instead of api integration with github I would like to have repo integration and you being able to add multiple repositories. It should work with git and be able to pull and push and I would like github integration so that it can pull in latest build of firmware and download it via the app. I want different and more modern design but it should keep the core of how it looks... you can use sqlite for data storage."

## What landed

- Project setup: Go module at the root with `internal/` packages and `cmd/zmk-editor`, `migrations/` embedded via `embed.go`, frontend in `frontend/zmk-editor-ui` embedded via `embed_frontend_prod.go` (`-tags dev` drops it), Makefile (`dev`, `build`, `release`, `check`), `.tool-versions`, nested CLAUDE.md files, `spec/`, `decisions/`, `.claude/commands` (decide, diff-suggest, consolidate).
- Keymaps are read from and written to the `.keymap` devicetree source directly (the open-source keymap-editor relied on a `keymap.json` sidecar; ZMK configs in the wild don't have one). A purpose-built lenient parser keeps byte offsets so the writer only splices what changed.
- Git through the user's git CLI (SSH keys, credential helpers work unchanged), multiple repositories (clone or link), GitHub Actions artifacts through a minimal REST client with a token from Settings or `gh auth token`.
- UF2 flashing to mounted bootloader drives, because the app runs locally and can.
- Frontend: React 19 + Tailwind v4 + shadcn radix-maia + hugeicons, with a dark-first emerald theme and keycap tokens.

## Why

- Splicing instead of regenerating keeps users' comments, formatting and hand-written definitions, which a template-based generator (the original's approach) destroys.
- Shelling out to git avoids reimplementing auth and matches what the user already has working on the command line.
- Optimistic locking by content hash prevents overwriting a file that a pull or an external editor changed.

## Alternatives considered

- go-git: rejected; SSH agent/credential-helper parity and behaviour differences are a long tail.
- tree-sitter devicetree (what keymap-editor experimented with): rejected for a CGO/wasm dependency; a small purpose-built parser is enough for keymap files.
- Encrypting the GitHub token with a passphrase vault: deferred; the token only needs Actions read access and the DB is 0600 in a 0700 directory. `gh auth token` fallback means many users never store one.
