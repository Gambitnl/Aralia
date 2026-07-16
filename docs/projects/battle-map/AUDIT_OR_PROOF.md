# Battle Map Audit / Proof

Status: active
Last updated: 2026-07-15

Use this file for durable proof summaries, scoped verification notes, and acceptance evidence. Do not paste raw logs unless a short excerpt is required for later agents to understand the result.

## Proof Log

| Date | Check | Result | Evidence |
|---|---|---|---|
| 2026-06-10 | Required-doc surface initialized | pass | `docs/projects/battle-map/NORTH_STAR.md` declares this file in `required_docs`; schema migration created the file for audit-clean doc coverage. |
| 2026-06-19 | G6 deterministic tactical spawn scoring | pass | `src/hooks/useBattleMapGeneration.ts` now routes procedural setup through `getTacticalSpawnTiles`, ranking candidates by cover/blocked-line proximity, elevation, chokepoint exits, and enemy distance bands while preserving `MIN_SEP` as the first placement pass. |
| 2026-06-19 | G6 dense-map fallback proof | pass | `src/hooks/__tests__/useBattleMapGeneration.test.ts` mocks a generated dungeon whose preferred spawn zones are fully blocked and proves four characters fall back to unique central walkable tiles with no undefined positions. |
| 2026-06-19 | G6 40x30 budget proof | pass | `npx vitest run src/hooks/__tests__/useBattleMapGeneration.test.ts` passed; the focused budget test asserts default 40x30 forest setup with tactical scoring completes within the documented <=50ms generation budget. |
| 2026-06-20 | D17 utility-contract documentation slice | pass | Read `src/hooks/useBattleMapGeneration.ts`, `src/services/battleMapGenerator.ts`, `docs/projects/battle-map/NORTH_STAR.md`, `docs/projects/battle-map/GAPS.md`, `docs/projects/battle-map/TRACKER.md`, `docs/projects/battle-map/COLD_START_AGENT_PROMPT.md`, `docs/projects/battle-map/DECISIONS.md`, `docs/projects/battle-map/PARITY_CHECKLIST.md`, and `docs/projects/DECISION_BLITZ_2026-06-10.md` D17. Added a dedicated "D17 Utility Contract: `generateBattleSetup`" section to `NORTH_STAR.md` covering signature, determinism order, spawn-zone rectangles, tactical scoring invariants (cover/elevation/chokepoint/enemy-distance), MIN_SEP rule, exhaustion fallback, budget, and contract boundaries. Refreshed frontmatter `gap_signal`, `next_step`, and `last_updated`; dashboard-card schema block; Active Task table; Current State bullets; Known Gaps header alignment; and Resume Path / Cold-Start Gap Routing. Updated `TRACKER.md` with a `T-D17-docs` documentation row and `AUDIT_OR_PROOF.md` with this entry. No source or test changes; scope was documentation only. |
| 2026-07-15 | Production battlefield authority boundary | pass | `CombatView` now requires an extracted WorldForge map for production play. Missing terrain mounts `BattlefieldSourceGap`, suppresses the board/initiative/AI actor list, and exposes only safe return. Procedural setup is isolated behind explicit developer sandbox paths. Rendered 1600x1000 and 390x844 proof found no clipping, overlap, or leaked combat affordance. |
| 2026-07-15 | Road-backed land-travel production handoff | pass | Committed travel retains encounter kind and route cells; `App` rebuilds the exact destination GroundWorld from saved seed/time/deltas, selects a real source road, preserves cell/crop provenance, and enters the normal encounter action/reducer/`CombatView` path. No-road destinations fail closed. The focused matrix passed 61/61, including the separate sea-event withholding route; 1600x1000 and 1353x1272 rendered review showed party-on-road and enemy-flank composition without material visual defect. |
| 2026-07-15 | Production encounter source inventory | pass | `WORLDFORGE_SOURCE_INVENTORY.md` audits every known tactical entry path. Four production classes are migrated; hostile openings, static authored-town watch, sea encounters, and location-free encounter simulation are routed as G8-G11 and remain visibly withheld. |
| 2026-07-16 | Hostile opening and failed-de-escalation WorldForge handoff | pass with explicit partial semantics | The generated opening location now freezes a game-authored world seed/cell/site receipt; de-escalation asks the mounted GroundWorld provider for the exact player-position crop and rejects missing, stale, or mismatched sources. The production projector labels enemy world positions and approach direction as unauthored. A 64/64 focused integration/projection/parity matrix passed. Adversarial 1600x1000 and 1353x1272 review rejected the first compass-perfect enemy ring, replaced it with a deterministic terrain-fit constellation, verified bestiary loading without fallback warnings, and retained G12-G13 for enemy spatial authority and monster ecology/readability. |

## Standing Verification Notes

- Project folder: `docs/projects/battle-map`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- North Star last updated date during initialization: `2026-06-08`
- Future agents should replace or extend this file with real scoped proof from the active tracker task.
- `WORLDFORGE_SOURCE_INVENTORY.md` is the authoritative production-launcher ledger; update it whenever a new tactical transition is added or an existing source bridge changes.
