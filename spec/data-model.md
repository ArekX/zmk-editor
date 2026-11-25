# Data model

## Data directory

`~/.zmk-editor` by default (`--data-dir`, `ZMK_EDITOR_DATA_DIR`), created with mode 0700:

- `zmk-editor.db` - SQLite (mode 0600), WAL, foreign keys on, one writer connection.
- `repos/<name>[-N]/` - clones the app manages.
- `firmware/<repository_id>/<artifact_id>.zip` and `.../<artifact_id>/` - downloaded artifacts.

## Tables (migrations/001_init.up.sql)

- `settings(key PK, value, updated_at)` - currently `github_token` (write-only via the API).
- `repositories(id, name, remote_url, local_path UNIQUE, managed, default_keymap, created_at, updated_at)` - `managed=1` for clones in `repos/`, `0` for linked folders (never deleted by the app).
- `custom_layouts(repository_id FK CASCADE, keymap_path, layout_json, updated_at, PK(repository_id, keymap_path))` - user layout overrides.
- `firmware_downloads(id, repository_id FK CASCADE, artifact_id, run_id, name, head_sha, dir, created_at, UNIQUE(repository_id, artifact_id))`.
