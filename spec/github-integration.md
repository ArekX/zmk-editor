# GitHub integration (internal/github, internal/firmware)

Used only for build artifacts; git traffic never goes through it.

- **Repository**: owner/repo parsed from the origin URL (`git@github.com:o/r.git`, `ssh://git@github.com/o/r`, `https://github.com/o/r`).
- **Token**: the one saved in Settings, else `gh auth token` (cached 5 minutes). Listing runs of public repositories works without one; downloading artifacts always needs one (GitHub's rule). Missing token -> HTTP 400 code `github_token_required`, and the Firmware sheet explains how to add one.
- **Runs**: `GET /repos/{o}/{r}/actions/runs?branch=<current>&per_page=15`. The top-bar button shows the latest run; it polls every 60 s, every 10 s while a run is queued or in progress.
- **Artifacts**: listed per run; downloaded via `/actions/artifacts/{id}/zip` (redirect to blob storage, Authorization dropped on the cross-host hop) into a temp file, renamed, extracted (no paths escaping the target, 256 MiB cap), recorded in `firmware_downloads`.
- **Builds**: Run build dispatches the latest run's workflow on the current branch (`workflow_dispatch` must be enabled in the workflow, as in ZMK's template); re-run is available via the API.
- **Flashing**: mounted volumes with `INFO_UF2.TXT` are bootloader drives (`/Volumes/*` on macOS, `/media/<user>/*`, `/run/media/<user>/*`, `/media/*`, `/mnt/*` on Linux, drive letters on Windows). Flash copies the `.uf2` to the drive root; the board reboots as soon as the write completes, so a failing close after a full write counts as success.
