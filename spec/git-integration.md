# Git integration (internal/git, internal/repos)

- **Adding**: clone `{url, branch?}` into `repos/<repo-name>` (suffixed `-2`, `-3` on collision) or link an existing working-tree root `{path}` (`~` expanded; must be the top level of a git repo). The first `.keymap` found becomes the default keymap.
- **Removing**: the row always; the files only for managed clones and only when asked.
- **Environment**: `GIT_TERMINAL_PROMPT=0`, `GIT_SSH_COMMAND=ssh -o BatchMode=yes` unless the user set their own, `LC_ALL=C`; 3 minute timeout per command. Errors carry git's stderr to the UI (HTTP 422, code `git`).
- **Locking**: one mutex per working directory around multi-step operations (save, commit+push, pull, discard, checkout, diff).
- **Operations**: status (porcelain v2 with ahead/behind), diff vs HEAD including untracked files, log (30), branches (local + origin, deduped), checkout / create branch, fetch `--prune`, pull `--ff-only` or `--rebase --autostash`, push `--set-upstream origin <branch>`, commit all, discard all (`reset --hard` + `clean -fd`) or per path.
- **UI rules**: pull, discard and branch switching are disabled while the editor has unsaved edits; after any of them the keymap document is reloaded.
