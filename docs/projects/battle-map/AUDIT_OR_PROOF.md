# Battle Map Audit / Proof

Status: active
Last updated: 2026-06-19

Use this file for durable proof summaries, scoped verification notes, and acceptance evidence. Do not paste raw logs unless a short excerpt is required for later agents to understand the result.

## Proof Log

| Date | Check | Result | Evidence |
|---|---|---|---|
| 2026-06-10 | Required-doc surface initialized | pass | `docs/projects/battle-map/NORTH_STAR.md` declares this file in `required_docs`; schema migration created the file for audit-clean doc coverage. |
| 2026-06-19 | G6 deterministic tactical spawn scoring | pass | `src/hooks/useBattleMapGeneration.ts` now routes procedural setup through `getTacticalSpawnTiles`, ranking candidates by cover/blocked-line proximity, elevation, chokepoint exits, and enemy distance bands while preserving `MIN_SEP` as the first placement pass. |
| 2026-06-19 | G6 dense-map fallback proof | pass | `src/hooks/__tests__/useBattleMapGeneration.test.ts` mocks a generated dungeon whose preferred spawn zones are fully blocked and proves four characters fall back to unique central walkable tiles with no undefined positions. |
| 2026-06-19 | G6 40x30 budget proof | pass | `npx vitest run src/hooks/__tests__/useBattleMapGeneration.test.ts` passed; the focused budget test asserts default 40x30 forest setup with tactical scoring completes within the documented <=50ms generation budget. |
| 2026-06-20 | D17 utility-contract documentation slice | pass | Read `src/hooks/useBattleMapGeneration.ts`, `src/services/battleMapGenerator.ts`, `docs/projects/battle-map/NORTH_STAR.md`, `docs/projects/battle-map/GAPS.md`, `docs/projects/battle-map/TRACKER.md`, `docs/projects/battle-map/COLD_START_AGENT_PROMPT.md`, `docs/projects/battle-map/DECISIONS.md`, `docs/projects/battle-map/PARITY_CHECKLIST.md`, and `docs/projects/DECISION_BLITZ_2026-06-10.md` D17. Added a dedicated "D17 Utility Contract: `generateBattleSetup`" section to `NORTH_STAR.md` covering signature, determinism order, spawn-zone rectangles, tactical scoring invariants (cover/elevation/chokepoint/enemy-distance), MIN_SEP rule, exhaustion fallback, budget, and contract boundaries. Refreshed frontmatter `gap_signal`, `next_step`, and `last_updated`; dashboard-card schema block; Active Task table; Current State bullets; Known Gaps header alignment; and Resume Path / Cold-Start Gap Routing. Updated `TRACKER.md` with a `T-D17-docs` documentation row and `AUDIT_OR_PROOF.md` with this entry. No source or test changes; scope was documentation only. |

## Standing Verification Notes

- Project folder: `docs/projects/battle-map`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- North Star last updated date during initialization: `2026-06-08`
- Future agents should replace or extend this file with real scoped proof from the active tracker task.
