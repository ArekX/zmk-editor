# Backend

See [internal/CLAUDE.md](../internal/CLAUDE.md) for the package map and conventions.

## Startup

`cmd/zmk-editor/main.go`: parse flags (`--addr` default `127.0.0.1:7373`, `--data-dir`, `--no-browser`, `--port-file`), create the data dir, open SQLite and migrate, build the git runner, GitHub client and repos service, bind the first free port at or after `--addr`, serve, and open the browser (prod builds only).

## HTTP API

All JSON. Errors are `{"error": string, "code"?: string}`. Non-GET requests need `X-Requested-With: zmk-editor`; only loopback Host headers are accepted.

| method | path | purpose |
| --- | --- | --- |
| GET | /api/health | status + version |
| GET, PUT | /api/settings | token state (`github_token_set`, `github_token_source` settings/gh/none), git availability; PUT `{github_token}` ("" clears) |
| GET | /api/zmk/behaviors, /api/zmk/keycodes | built-in catalogue |
| GET, POST | /api/repos | list (with git status); add `{url, branch?, name?}` (clone) or `{path, name?}` (link) |
| GET, PATCH, DELETE | /api/repos/{id} | details incl. keymaps; PATCH `{name?, default_keymap?}`; DELETE `?delete_files=1` removes a managed clone |
| GET | /api/repos/{id}/status, /diff, /log, /branches | git state |
| POST | /api/repos/{id}/fetch, /pull `{rebase}`, /push, /commit `{message, push}`, /discard `{paths?}`, /checkout `{branch, create}` | git operations |
| GET | /api/repos/{id}/keymaps | `*.keymap` files (config/ first) |
| GET, PUT | /api/repos/{id}/keymap?path= | load document; save `{hash, keymap}` (409 `conflict` on hash mismatch) |
| POST | /api/repos/{id}/keymap/preview?path= | `{before, after}` text without writing |
| PUT | /api/repos/{id}/layout?path= | `{layout}` custom override, `null` clears |
| GET | /api/repos/{id}/builds | `{owner, repo, branch, token_source, runs}` |
| GET | /api/repos/{id}/builds/{run}/artifacts | artifacts of a run |
| POST | /api/repos/{id}/builds/dispatch `{workflow_id, ref?}`, /builds/{run}/rerun | start builds |
| GET, POST | /api/repos/{id}/firmware | cached downloads with files; download `{artifact_id, run_id, name, head_sha}` |
| DELETE | /api/repos/{id}/firmware/{fw} | drop from cache |
| GET | /api/repos/{id}/firmware/{fw}/files/{name...}, /zip | download a file / the zip |
| POST | /api/repos/{id}/firmware/{fw}/flash `{file, device}` | copy a .uf2 to a bootloader drive |
| GET | /api/devices | mounted UF2 bootloader drives |
