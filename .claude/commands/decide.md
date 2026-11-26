# Decide

Make an ad-hoc change outside the task flow and log it as a decision.

The change requested: $ARGUMENTS

## Step 1: Understand

Read the root `CLAUDE.md`, the nested `CLAUDE.md` for every area you will touch (`internal/CLAUDE.md`, `frontend/zmk-editor-ui/CLAUDE.md`), and the spec files for that area (`spec/README.md` lists them). If the request is ambiguous in a way that changes what you build, ask before writing code.

## Step 2: Implement

Make the change as a vertical slice where it makes sense (backend + frontend together). Follow the clean-code rules in the nested `CLAUDE.md` files.

## Step 3: Verify

Run `make check` from the repo root. Everything must pass: `go build`, `go vet`, `go test`, an empty `gofmt -l`, and the frontend typecheck, lint and build. For user-visible changes, run the app (`make dev` or `make run`) and look at the change in the browser.

## Step 4: Log the decision

**MANDATORY.** Create the next numbered file in `decisions/` (check existing files, including `decisions/consolidated/`, for the highest number):

```markdown
# NNNN - Title

**Date:** YYYY-MM-DD

## What landed
Specific files, behavior, API and schema changes.

## Why
The reasoning, including constraints discovered along the way.

## Alternatives considered
(Only when alternatives were meaningfully weighed.)
```

Record only the implementation: what the code does now and why. No conversation history, quotes, superseded attempts, release or documentation chores, or how the change was checked.

Spec files are not edited here; `/consolidate` folds decisions back into `spec/` and the `CLAUDE.md` files later.
