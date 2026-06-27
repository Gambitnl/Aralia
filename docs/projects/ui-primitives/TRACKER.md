# Ui Primitives Living Tracker

Status: active
Last updated: 2026-06-26

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | not_started | Finish z-index registry adoption for remaining runtime hardcoded classes | Codex | 2026-06-26 | `docs/projects/ui-primitives/GAPS.md` G3; `z-index-migration-progress.md`; `z-index-analysis-report.md`; current `rg -n "z-\[\d+\]" src -g "*.tsx" -g "*.ts"` output | Replace or justify the four runtime hardcoded z-index classes, then refresh the stale top-level z-index notes | Source scan has no unowned runtime `z-[number]` classes; focused visual check for touched overlay/popover surfaces |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Keep unresolved long-lived gaps in `docs/projects/ui-primitives/GAPS.md`.
