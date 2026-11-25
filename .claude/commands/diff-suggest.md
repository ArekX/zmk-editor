# Diff Suggest

Look over the uncommitted changes and propose refactorings before they are committed.

## Steps

1. **Gather.** Run `git status`, `git diff` and `git diff --cached`. Read untracked source files in full.
2. **Read in context.** For each changed file read the whole file, not just the hunks, plus the nested `CLAUDE.md` rules for its area. Look for:
   - logic duplicated across files that belongs in a shared helper or component;
   - names that don't say what something is or does;
   - files mixing several concerns, or past the ~500 line guardrail;
   - loose or missing types, unnecessary casts;
   - leftovers: unused imports, variables, functions, debug output;
   - code that is more complicated than it needs to be;
   - places that ignore an existing pattern or helper in the codebase.
3. **Propose.** Enter plan mode and list each suggestion with a number, grouped by file or theme:
   - **What**: the code and its location (file, function, line);
   - **Why**: the problem it fixes;
   - **How**: the change in a sentence or two.
   Wait for the user to pick which ones to apply.
4. **Apply** only the approved items, then run `make check`.
5. **Log** the applied refactorings as the next numbered file in `decisions/` (related small ones may share a file), using the format from `/decide`.
