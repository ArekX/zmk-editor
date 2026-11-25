# Consolidate

Fold the accumulated decision log back into the spec and the CLAUDE.md files.

## Rules

- **Only write what a decision says.** Don't infer requirements or generalize. If it's unclear how a decision maps onto the spec, ask about that point before writing it.
- **Later decisions win.** When two decisions conflict, the higher number is the current truth. Apply them in ascending order.
- **No code changes.** Decisions describe work already done. If the code disagrees with a decision, report it in the summary; don't fix it here.

## Steps

1. **Collect.** Read every file in `decisions/` (not `decisions/consolidated/`) and list each with its number and a one-line summary.
2. **Sort into three groups.**
   - *Process*: about the workflow or numbering itself. Nothing to fold in.
   - *Internal*: refactors, tests, code moves with no change in behavior, API, data model or conventions. Nothing to fold in.
   - *Spec-relevant*: anything that changes behavior, architecture, the data model, the HTTP API, the UI, tooling, or coding conventions.
3. **Update.** For each spec-relevant decision, in order:
   - update the matching files in `spec/` (create one when a new area appears and add it to `spec/README.md`);
   - update the root or nested `CLAUDE.md` when conventions, commands or invariants changed;
   - update `spec/roadmap.md` when something on it was built or a new gap was found.
   Don't delete existing content unless a decision replaces it.
4. **Archive.** Move every processed decision file (all three groups) into `decisions/consolidated/`.
5. **Log.** Write the next numbered decision describing the consolidation: which decisions were folded in, which were skipped and why, which spec and CLAUDE.md files changed, and any code/decision mismatches found.
6. **Report** a short summary to the user, including the mismatches.
