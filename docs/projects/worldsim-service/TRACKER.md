# Worldsim Service Living Tracker

Status: active (WSS-005 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-19

North Star: `docs/projects/worldsim-service/NORTH_STAR.md`
Scope (clarified 2026-06-01): world **generation + simulation** â€” the geometry pipeline
(`src/services/worldSim`, built) AND first-build world history/story/events
(`src/services/WorldHistoryService.ts`, growth area). Boundary: this surface owns world
**birth**; `docs/projects/world` owns ongoing world **runtime**.

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
| T7 | active | WSS-005 proof and review gate â€” 2D atlas and 3D WorldData feature sources diverge | Codex worker | 2026-06-19 | `src/services/worldSim/__tests__/featureSourceTruth.test.ts`, `src/services/azgaarDerivedMapService.ts`, `src/services/worldSim/index.ts`, `src/services/worldSim/types.ts`, `docs/projects/worldsim-service/AUDIT_OR_PROOF.md` | First WSS-005a bridge step implemented: `WorldData.featureHints` now carries Azgaar-labeled rivers/sites/roads hints, and `generateAzgaarDerivedMap` passes the Azgaar river mask into WorldData while leaving generated geometry unchanged. Legacy migration bridge deferred because `src/state/migrations/worldDataMigration.ts` was already dirty and outside this slice's edit scope. | Add the migration/backfill path once migration files are clean, then grow Azgaar-derived site/road hints beyond the current empty channels. |
## Gap Log

- World snapshot generation is synchronous and has no measured frame-time budget for large maps. (WSS-001)
- WorldData version migration policy for v3+ is not yet documented. (WSS-002)
- `WorldData` feature output (roads/rivers/sites) and 3D visual rendering are partially coupled; compatibility constraints are not fully codified. (WSS-003)
- ~~Silent flat-world fallback (WSS-004)~~ â€” REMEDIATED 2026-06-02 via biome-derived heightfield (T4).
- 2D-atlas vs 3D river/site/road divergence at the source (WSS-005) â€” review-required; source of truth undecided and proven by `featureSourceTruth.test.ts`. Update (2026-06-10): decided â€” Azgaar is canonical; feature hints flow into `WorldData` (DECISION_BLITZ D1). Update (2026-06-19): first WSS-005a bridge step landed with `WorldData.featureHints` and a fixed-seed acceptance check; migration/backfill and richer site/road hint producers remain open.
- Biome-fallback climate fields (temp/moisture) were remediated (WSS-006).
- Biome-derived heightfield seam cliffs were remediated with deterministic smoothing (WSS-007).

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
