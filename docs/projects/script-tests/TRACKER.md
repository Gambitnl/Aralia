# Script Tests Living Tracker

Status: merged-reference — merged into Scripts: Quality 2026-06-10
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
| T1 | done | Scan `scripts/__tests__` and direct refs, then update project continuity docs | Worker C | 2026-05-31 | `scripts/__tests__`, `scripts/*.ts`, `package.json`, `vitest.config.ts` | Keep NORTH_STAR and GAP tracking aligned with next coverage expansion | `docs/projects/script-tests/NORTH_STAR.md` and `docs/projects/script-tests/GAPS.md` |
| T2 | active | Add follow-up test coverage for uncovered script integration risks | Worker C | 2026-06-05 | See `docs/projects/script-tests/GAPS.md` | Execute the narrowest focused Vitest pass that closes one safe gap per iteration | `npx vitest run scripts/__tests__/spellFieldInventory.test.ts` |
| T3 | done | Decide standalone-vs-merge for this project | Remy (project owner) | 2026-06-10 | `docs/projects/DECISION_BLITZ_2026-06-10.md` (D21); `DECISIONS.md` D2 | **Decision recorded 2026-06-10:** merged into Scripts: Quality; script-tests is now its support surface and this tracker is merged-reference. T2 continues under `docs/projects/scripts-quality`. | scripts-quality tracker carries the ST-GAP work forward |

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
