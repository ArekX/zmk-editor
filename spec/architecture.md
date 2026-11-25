# Architecture

```
browser (React SPA)  --HTTP /api-->  zmk-editor (Go)
                                       |-- SQLite (~/.zmk-editor/zmk-editor.db)
                                       |-- git CLI  -> repos/<name>/ or linked folders
                                       |-- GitHub REST API (Actions runs, artifacts)
                                       '-- firmware cache (~/.zmk-editor/firmware/<repo>/<artifact>/)
```

One process serves the API and the embedded UI on a loopback port. In dev builds (`-tags dev`) the UI is served by Vite, which proxies `/api`.

## Edit and save

1. `GET /api/repos/{id}/keymap?path=...` reads the file, parses it (`keymap.Parse`), resolves the layout (`layout.Find`) and returns `{keymap, layout, hash, source}`.
2. The frontend copies `keymap` into a draft (`useKeymapDraft`). Every edit is an immutable update with undo/redo history.
3. Save sends `PUT /api/repos/{id}/keymap?path=...` with `{hash, keymap}`. The server takes the repo lock, re-reads the file, rejects a hash mismatch with 409, then `keymap.Apply(src, keymap, layout.Grid())` splices the changes into the source, re-parses the result as a sanity check and writes it.
4. The response is the re-parsed document; its new hash resets the draft.

## Commit and push

The Changes tab shows `git status` and `git diff HEAD` (untracked files included via intent-to-add). Commit runs `git add -A && git commit -m`, optionally followed by `git push --set-upstream origin <branch>`. A push failure after a successful commit is reported separately (`push_error`).

## Firmware

1. `GET /api/repos/{id}/builds` resolves `owner/repo` from the origin URL and lists Actions runs for the current branch.
2. Expanding a run lists its artifacts. Download (`POST /api/repos/{id}/firmware`) streams the artifact zip from GitHub into the cache, extracts it (zip-slip and size guarded) and records it.
3. Files can be saved through the browser or flashed: `POST .../flash` copies a `.uf2` onto a mounted volume containing `INFO_UF2.TXT`.
