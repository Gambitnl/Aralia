---
name: typecheck-preservationist
description: Run typecheck/tests for the Aralia codebase and resolve TypeScript errors without trimming features. Use when asked for "Typecheck Errorstate-0", "preservationist test run", or "Fix all typecheck issues" and when typecheck errors need to reach 0 while leaving TODOs for any/undefined risks.
---

# Typecheck Preservationist

## Overview

Run TypeScript typechecks (and requested tests) and fix errors while following the
**Preservationist Rules** and **Debt Flagging** standards defined in
`.agent/skills/code_commentary/SKILL.md`. That file is the canonical source for:

- Preservationist mentality (minimal impact, no deletion, structural integrity)
- Debt flagging prefixes (`// DEBT:`, `// HACK:`, `// TODO(next-agent):`)
- Red flags checklist (`: any`, `as any`, stubs, etc.)
- Plain-English commenting rules

## Workflow

### 1) Select the right command(s)

Use these defaults for this repo:

- Typecheck only: `npm run typecheck`
- Test run: `npm test`
- Types test: `npm run test:types`
- Lint check (only if requested): `npm run lint`

If the user asks for "errorstate-0" or "typecheck issues", run `npm run typecheck` first.
If they ask for a "test run", run `npm test` after typecheck passes.

### 2) Run the checks and capture the failures

Record the command(s) run and the error count from the output. Treat the output as the TODO list.
Work in phases of **max 10 errors** per run. If there are more than 10 errors, fix the first 10 and stop.

Optional helper script (terminates typecheck after N errors to keep output small):

`scripts/typecheck-top-errors.ps1 -MaxErrors 10`

### 3) Fix with preservationist rules

Prioritize minimal, behavior-preserving changes:

- Add explicit types to values, parameters, and returns.
- Add type guards or runtime checks before access.
- Narrow unions with `in`, `typeof`, or discriminants.
- Confine your fixes to local scopes rather than moving or deleting logic.

Maintain strict architectural boundaries:

- Retain all existing features and working code blocks, even if they currently cause linting or type errors.
- Preserve the existing API shape and structure of data objects.
- Limit module rewrites strictly to paths required to resolve proven bugs or type errors.

### 4) Flag debt and ambiguity where types are risky

If the only safe path is a temporary assertion or loose type, flag it using the
debt prefixes from the Code Commentary skill. Be specific about what the shortcut
is and why the proper fix wasn't possible now.

If the intent of a code block is ambiguous (e.g., determining if an unused variable is dead code to be pruned or a "feature bud" to be preserved), do not guess or autonomously delete it.

- Apply the `// REVIEW_INTENT:` flag directly above the ambiguous code.
- Provide a brief comment explaining the uncertainty (e.g., "Unused state variable, possibly intended for future UX").
- Skip fixing this specific error and include it in your final report for human review and direction.

### 5) Re-run until error count is 0 (phased)

Repeat typecheck in phases of **max 10 errors**. After each phase, stop and report progress.
If a specific error cannot be resolved without behavior change, stop and report it with a debt flag and a brief explanation.

## Reporting Checklist

- List commands executed.
- Confirm error count went to 0 (or explain why it did not).
- List debt flags and any non-obvious comments added with file paths.
- Call out any behavior risks introduced by temporary assertions.

## Codex Worklog (optional)

If you discover a reusable pattern or critical lesson, add a journal entry to
`.jules/worklogs/worklog_codex.md`.

Before adding an entry, run `date` in the terminal and use this template:

```md
## YYYY-MM-DD - [Title]
**Learning:** [What insight did you gain?]
**Action:** [How to apply this next time]
```

For future follow-ups that are not learnings, use:

```md
## TODO: [Brief Title]
**Context:** [Why is this needed?]
**Plan:** [Steps to implement]
**Status:** Pending
```
