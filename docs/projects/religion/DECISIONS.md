# Religion System Decisions

Status: active
Last updated: 2026-06-09

This file records stable Religion System decisions that matter to future agents.

## Decisions

| ID | Decision | Status | Evidence | Notes |
|---|---|---|---|---|
| D-01 | Keep the current dual-write religion state behavior until G1 defines a safe migration order. | recorded | `docs/projects/religion/GAPS.md`, `src/state/reducers/religionReducer.ts`, `src/types/state.ts` | This preserves compatibility while making the migration seam explicit instead of deleting the legacy state path. |
| D-02 | Work G1 before broad G2-G5 expansion unless source evidence proves a narrower slice is independent. | recorded | `docs/projects/religion/TRACKER.md`, `docs/projects/religion/GAPS.md` | The state contract affects service effects, combat triggers, ritual consequences, and UI payloads. |
| D-03 | Normalize Religion favor through a reducer compatibility helper that reads canonical `state.religion` first, backfills missing entries from legacy `state.divineFavor`, and writes updates back to both maps. | recorded | `src/state/reducers/religionReducer.ts`, `src/state/reducers/__tests__/religionReducer.test.ts`, `src/state/__tests__/initialState.religion.test.ts` | This keeps old loads readable without deleting the legacy path, and makes the canonical-vs-legacy seam explicit for future passes. |
| D-04 | Keep temple services backward-compatible by resolving legacy string effects through explicit adapter handlers while typed structured effects branch by discriminant, so heal is not the default assumption for every service. | recorded | `src/systems/religion/TempleSystem.ts`, `src/types/religion.ts`, `src/systems/religion/__tests__/TempleSystem.test.ts` | This preserves seeded temple data and older saves while making the service-effect vocabulary explicit for future expansion. |
| D-05 | Prefer deity-authored combat taxonomy labels for combat-to-religion trigger routing, with legacy heuristics retained as fallback coverage for existing fixed triggers. | recorded | `src/systems/religion/CombatReligionAdapter.ts`, `src/data/deities/index.ts`, `src/types/religion.ts`, `src/systems/religion/__tests__/CombatReligionAdapter.test.ts` | This lets new doctrine triggers be added where the data already carries explicit tags while preserving DESTROY_UNDEAD, KILL_ELF, HEAL_ALLY, and necromancy behavior. |

## Open Follow-Ups

- G1 is now fenced and verified; keep the helper in place while G2 takes over the next implementation slice.
- G2 is now resolved; keep the adapter map and structured union in place while G3 took over the next implementation slice.
- G3 is now resolved; keep the combat taxonomy map and legacy fallback triggers in place while G4 took over the next implementation slice.
- G4 is now review-required, so keep the ritual consequence contract paused until the Required Review Brief is answered.
