# 0002 - Check the remote when a repository is opened

**Date:** 2026-11-25

**User request:** "could we also add a change that if you go into a repository that we do a check against remote to see if there are some changes not there and warn the user with a dialog that they should pull them?"

## What landed

- **Backend.**
  - `git.Runner.Incoming(ctx, dir, n)`: `git log HEAD..@{upstream}` (up to n commits). No upstream means no incoming commits, not an error. The log parsing is shared with `Log` via `parseLog`.
  - `POST /api/repos/{id}/remote-check`: under the repo lock, `git fetch --prune origin`, then returns `{status, incoming}` (incoming capped at 20).
  - Test `TestIncomingAfterFetch` runs against real temporary repositories (bare remote, two clones).
- **Frontend.**
  - `useRemoteCheck(repoId)` runs the check once each time the editor mounts for a repository: query key `["remote-check", id]` (deliberately outside the `["repo", id]` prefix that saves and git actions invalidate), `staleTime: Infinity`, `gcTime: 0` (so opening the repository again checks again), no retry, no refetch on focus. The returned status is written into the status cache, so the Pull badge updates at once. A failed check (offline, SSH key not loaded) is a warning toast, not a dialog.
  - `PullPromptDialog`: shows when `behind > 0`, titled "N new commits on origin/branch", listing the incoming commits (subject, short sha, author, age) and "and N more" past 20. Notes appear when there are local unpushed commits (the button becomes "Pull and rebase", which pulls with `--rebase --autostash`), uncommitted files, or unsaved editor edits (Pull is disabled). "Not now" hides it until the repository is opened again.

## Why

Editing on top of a stale checkout leads to a rejected push or a rebase with conflicts later. Checking on open catches it before any edit is made, when pulling is still free.
