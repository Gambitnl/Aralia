# TRACKER: Script Tests

Status: active
Last updated: 2026-05-31

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
| T2 | active | Add follow-up test coverage for uncovered script integration risks | Worker C | 2026-05-31 | See `docs/projects/script-tests/GAPS.md` | Execute minimal focused Vitest checks and close one safe gap per pass | `npx vitest run scripts/__tests__/spellFieldInventory.test.ts` |

## Gap Log

- High-priority gap is visible in project GAPS (integration-level assertions still missing for some script consumers).
- Next execution checks are listed as actionable in `docs/projects/script-tests/GAPS.md`.
