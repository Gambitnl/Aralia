# Script Tests Living Tracker

Status: merged-reference â€” merged into Scripts: Quality 2026-06-10
Last updated: 2026-06-10

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
| T2 | active | Add follow-up test coverage for uncovered script integration risks | Worker C | 2026-06-05 | See `docs/projects/script-tests/GAPS.md` | Execute the narrowest focused Vitest pass that closes one safe gap per iteration | `npx vitest run scripts/__tests__/spellFieldInventory.test.ts` |

## Gap Log

- High-priority gap remains in project GAPS; ST-GAP-001 is the safest local slice to close first.
- Next execution checks are listed as actionable in `docs/projects/script-tests/GAPS.md`.
- Merge note (2026-06-10): gap ownership transferred to `docs/projects/scripts-quality` (DECISION_BLITZ D21); rows here are retained as reference history.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
