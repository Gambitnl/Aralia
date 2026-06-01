---
description: Run Aralia's pre-completion quality gate and report what passed, failed, or was deliberately skipped.
---

# /verify Workflow

This workflow is the agent-facing verification gate for Aralia changes. It wraps
the project scripts with a reporting contract so a future agent or human can
tell exactly what was checked.

## Execution

1. Check Git state with `git status --short --branch`.
2. Run `npm run sync-check`.
3. Run the relevant focused tests for the changed area.
4. Run `npm run test` when the task touched shared logic, test infrastructure,
   workflow gates, or anything with broad behavior risk.
5. Run `npm run verify` when the task needs full typecheck, lint, scan, and
   build coverage.
6. If full verification is too broad for the active task, run
   `npm run quality:debt` and state that broad type/lint/build debt was reviewed
   as visible debt rather than treated as blocking.
7. For UI or visual work, verify rendered output with a browser or screenshot
   workflow before claiming a visual fix.

## Preservation Check

Before marking work complete, confirm that the change did not remove unfinished
intent, future optionality, or embryonic systems merely to make a cleaner diff.
If something was removed, state why that removal is safe.

## Required Output Block

- `Verify: pass|fail|blocked`
- `Git State: <summary>`
- `Sync Check: pass|fail|skipped (with reason)`
- `Focused Tests: <commands and results>`
- `Full Tests: <commands and results or skipped reason>`
- `Build/Type/Lint/Scan: <commands and results or skipped reason>`
- `Visual Verification: <evidence or not applicable>`
- `Preservation Check: <summary>`
- `Open Follow-ups: <list or none>`

If this block is missing, `/verify` is incomplete.
