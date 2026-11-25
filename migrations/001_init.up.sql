CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE repositories (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    remote_url     TEXT NOT NULL DEFAULT '',
    local_path     TEXT NOT NULL,
    managed        INTEGER NOT NULL DEFAULT 1,
    default_keymap TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
);

CREATE UNIQUE INDEX repositories_local_path ON repositories(local_path);

CREATE TABLE custom_layouts (
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    keymap_path   TEXT NOT NULL,
    layout_json   TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    PRIMARY KEY (repository_id, keymap_path)
);

CREATE TABLE firmware_downloads (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    artifact_id   INTEGER NOT NULL,
    run_id        INTEGER NOT NULL,
    name          TEXT NOT NULL,
    head_sha      TEXT NOT NULL DEFAULT '',
    dir           TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    UNIQUE (repository_id, artifact_id)
);
