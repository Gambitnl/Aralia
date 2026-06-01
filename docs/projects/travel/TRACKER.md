# Travel System Living Tracker

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
| T1 | done | Create and refresh Travel living project scaffold files with concrete evidence. | Worker A | 2026-05-31 | `docs/projects/travel/NORTH_STAR.md`, `docs/projects/travel/GAPS.md` | Keep docs aligned with implementation discoveries. | Confirm all file links resolve. |
| T2 | active | Establish end-to-end travel implementation gaps from runtime code. | Worker A | 2026-05-31 | `src/hooks/actions/handleMovement.ts`, `src/systems/travel/TravelNavigation.ts`, `src/systems/travel/TravelCalculations.ts`, `src/components/Submap/useQuickTravel.ts` | Resolve G1, G2, and G3 as in-scope next steps before mechanics rewrites. | Add movement-level regression checks for forced march, drift, and time-cost alignment. |
| T3 | not_started | Build a stable acceptance matrix for quick-travel vs movement cost model. | Worker A | 2026-05-31 | `src/services/travelService.ts`, `src/hooks/actions/handleMovement.ts`, `src/components/Submap/useQuickTravel.ts` | Define one contract and annotate all dependent handlers. | Confirm no contradictory assumptions in tests. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Review pass | Forced march state is computed but not consumed in movement. | `src/systems/travel/TravelCalculations.ts`, `src/hooks/actions/handleMovement.ts` | Travel time can exceed safe day rules without fatigue/exhaustion checks. | Add forced march hook in movement event handling. | Add unit/integration test proving 8+ hour travel triggers DC flow. |
| G2 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Travel logic audit | Navigation drift (`checkNavigation`) is not wired into the movement event loop. | `src/systems/travel/TravelNavigation.ts`, TODO in `src/hooks/actions/handleMovement.ts` | Route correctness and encounter behavior can diverge from defined navigation rules. | Add drift resolution path and direction update handling. | Add test coverage with deterministic RNG seed for failed checks. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/travel/TRACKER.md` | Audit and tests review | Quick travel and normal movement use different cost models. | `src/components/Submap/useQuickTravel.ts`, `src/hooks/actions/handleMovement.ts`, `src/services/travelService.ts` | Day/night/season and party composition effects can be inconsistent. | Reconcile model ownership and update runtime calls. | Add acceptance test that compares expected travel time under same input route. |
| G4 | not_started | support_needed_now | Worker A | `docs/projects/travel/TRACKER.md` | Runtime audit | Vehicle and transport behavior is simplified in movement math. | `src/systems/travel/TravelCalculations.ts`, `src/types/travel.ts` | Vehicle-heavy routes can produce incorrect or unrealistic speeds/carry constraints. | Expand transport contract (pull force, terrain interactions, fallback rules). | Add explicit test rows for cart/wagon and water vehicle edge cases. |
| G5 | not_started | adjacent_follow_up | Worker A | `src/components/Submap` | Submap UX pass | Quick travel lacks explicit fatigue or food/water consumption in UI dispatch path. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts` | Later systems (rest/resource) may undercount travel costs. | Decide scope inclusion before feature work. | Add a TODO/decision note to `SubmapPane` action comments and tests once planned. |

