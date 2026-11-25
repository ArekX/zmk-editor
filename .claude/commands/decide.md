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

**User request:** the user's words, quoted.

## What landed
Specific files, behavior, API and schema changes.

## Why
The reasoning, including constraints discovered along the way.

## Alternatives considered
(Only when alternatives were meaningfully weighed.)
```

Spec files are not edited here; `/consolidate` folds decisions back into `spec/` and the `CLAUDE.md` files later.
