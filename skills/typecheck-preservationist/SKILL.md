---
name: typecheck-preservationist
description: Run typecheck/tests for the Aralia codebase and resolve TypeScript errors without trimming features. Use when asked for "Typecheck Errorstate-0", "preservationist test run", or "Fix all typecheck issues" and when typecheck errors need to reach 0 while leaving TODOs for any/undefined risks.
---

# Typecheck Preservationist

## Overview

Run TypeScript typechecks (and requested tests) and fix errors with a preservationist approach: keep behavior intact, avoid feature removal, and add TODO markers where types are still uncertain.

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
- Prefer local fixes over refactors that move or delete logic.

Avoid these unless explicitly asked:

- Removing features or deleting code to silence errors
- Broad refactors that change API shape
- Rewriting modules without a clear bug or type error driver

### 4) Place TODOs where types are still risky

If the only safe path is a temporary assertion or a loose type, add a TODO at the code block that explains the risk. Use this template:

`// TODO(next-agent): Preserve behavior; refine type for <symbol> (was any/undefined).`

Placement rules:
- Put the TODO immediately above the line or block in question.
- Keep the message short and actionable.
- If you used an assertion (`as unknown as ...`) or a fallback, say so.

### 5) Re-run until error count is 0 (phased)

Repeat typecheck in phases of **max 10 errors**. After each phase, stop and report progress.
If a specific error cannot be resolved without behavior change, stop and report it with TODOs and a brief explanation.

## Reporting Checklist

- List commands executed.
- Confirm error count went to 0 (or explain why it did not).
- List TODOs added with file paths.
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
