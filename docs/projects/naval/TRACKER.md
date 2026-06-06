# Naval System Living Tracker

Status: active
Last updated: 2026-06-05

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
| T1 | done | Document naval baseline and scope in living project docs (files + evidence + integration points). | Worker A | 2026-05-31 | `src/systems/naval`, `src/components/Naval`, `src/state`, `src/types`, `src/data`, `src/utils`, `docs/projects/PROJECT_TRACKER.md` | Keep this tracker as implementation handoff for missing integration work. | Confirm `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md` are present and internally consistent. |
| T2 | active | Finalize voyage + encounter coupling and naval action surface alignment. | Worker A | 2026-06-05 | `src/systems/naval/VoyageManager.ts`, `src/data/naval/voyageEvents/index.ts`, `src/hooks/actions/handleMovement.ts`, `src/state/reducers/navalReducer.ts` | Add action wiring for sea travel start, implement or route `Combat` voyage status, and close `NAVAL_REPAIR_SHIP` contract. | Next proof: a dry-run flow test for voyage start and combat handoff. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | support_needed_now | Worker A | `docs/projects/naval/GAPS.md` | Initial baseline | `NAVAL_REPAIR_SHIP` action is declared but not handled in the reducer. | `src/state/actionTypes.ts`, `src/state/reducers/navalReducer.ts` | Action consumers can dispatch state changes that do nothing, hiding intended repair behavior. | Either implement reducer branch or remove the action contract and related UI expectations. | Add reducer coverage test and confirm no silent no-op path. |
| G2 | active | support_needed_now | Worker A | `docs/projects/naval/GAPS.md` | Baseline scan | Sea travel and quick travel block `water` terrain, so voyages are not started from movement actions. | `src/hooks/actions/handleMovement.ts`, `src/state/reducers/navalReducer.ts`, `src/state/actionTypes.ts` | Naval travel remains isolated from core movement and encounter loops. | Add a transport/voyage entry pathway and confirm action dispatches with distance and destination. | One integration test showing voyage start from non-land transport input. |
| G3 | active | support_needed_now | Worker A | `docs/projects/naval/GAPS.md` | Baseline scan | Voyage events can set status to `Combat` but no combat handoff exists. | `src/systems/naval/VoyageManager.ts`, `src/data/naval/voyageEvents/index.ts` | Encounter/combat loops never consume naval combat triggers. | Wire event status to encounter or dedicated naval-combat flow. | Execute one combat event and verify transition state. |
| G4 | active | support_needed_now | Worker A | `docs/projects/naval/GAPS.md` | Baseline scan | Duplicate event catalogs (`voyageEvents.ts` and `voyageEvents/index.ts`) diverge. | `src/data/naval/voyageEvents.ts`, `src/data/naval/voyageEvents/index.ts` | Shared consumers can apply different event behavior depending on import path. | Consolidate catalog to one source and update imports. | Add a single test fixture that verifies event IDs across all imports. |
| G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/naval/GAPS.md` | Baseline scan | `ShipPane` dashboard is read-only while reducer supports more naval operations. | `src/components/Naval/ShipPane.tsx`, `src/state/reducers/navalReducer.ts` | User cannot trigger existing naval actions from the primary dashboard. | Decide whether the dashboard should gain command controls or remain inspect-only. | Quick manual UI check and reducer integration test for the chosen action path. |
