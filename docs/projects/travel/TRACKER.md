# Travel Living Tracker

Status: active
Last updated: 2026-06-15

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
| T3 | not_started | Build a stable acceptance matrix for quick-travel vs movement cost model. | Worker A | 2026-05-31 | `src/services/travelService.ts`, `src/hooks/actions/handleMovement.ts`, `src/components/Submap/useQuickTravel.ts` | Define one contract and annotate all dependent handlers. | Confirm no contradictory assumptions in tests. |
| T4 | not_started | Spike a Voronoi-cell-keyed travel/discovery model behind the existing grid, no behavior change yet. | Worker A | 2026-06-15 | `src/components/MapPane.tsx`, `src/hooks/actions/handleMovement.ts` | Spike the `window.__araliaAzgaar` cell-to-grid mapping extension and state storage. | Unit tests verifying that cell-native travel action dispatch successfully updates the cell ID in state alongside fallback grid coordinates without altering existing movement behavior. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Review pass | Forced march state is computed but not consumed in movement. | `src/systems/travel/TravelCalculations.ts`, `src/hooks/actions/handleMovement.ts` | Travel time can exceed safe day rules without fatigue/exhaustion checks. | Add forced march hook in movement event handling. | Add unit/integration test proving 8+ hour travel triggers DC flow. |
| G2 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Travel logic audit | Navigation drift (`checkNavigation`) is not wired into the movement event loop. | `src/systems/travel/TravelNavigation.ts`, TODO in `src/hooks/actions/handleMovement.ts` | Route correctness and encounter behavior can diverge from defined navigation rules. | Add drift resolution path and direction update handling. | Add test coverage with deterministic RNG seed for failed checks. |
| G3 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Audit and tests review | Quick travel and normal movement use different cost models. | `src/components/Submap/useQuickTravel.ts`, `src/hooks/actions/handleMovement.ts`, `src/services/travelService.ts` | Day/night/season and party composition effects can be inconsistent. | Reconcile model ownership and update runtime calls. | Add acceptance test that compares expected travel time under same input route. |
| G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/travel/TRACKER.md` | Runtime audit | Vehicle and transport behavior is simplified in movement math. | `src/systems/travel/TravelCalculations.ts`, `src/types/travel.ts` | Vehicle-heavy routes can produce incorrect or unrealistic speeds/carry constraints. | Expand transport contract (pull force, terrain interactions, fallback rules). | Add explicit test rows for cart/wagon and water vehicle edge cases. |
| G5 | not_started | adjacent_follow_up | Worker A | `src/components/Submap` | Submap UX pass | Quick travel lacks explicit fatigue or food/water consumption in UI dispatch path. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts` | Later systems (rest/resource) may undercount travel costs. | Decide scope inclusion before feature work. | Add a TODO/decision note to `SubmapPane` action comments and tests once planned. |
| G6 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Cell-native audit | Many small adjacent Voronoi cells collapse onto a single grid tile during target coordinates lookup. | `src/components/MapPane.tsx` (`gridTileFromWorld`) | Cell-accurate travel is impossible because coordinates are coerced to rectangular tiles. | Define Voronoi cell-based travel target lookup and route calculation. | Test that two distinct Voronoi cells on the same grid tile can be travelled to separately. |
| G7 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Cell-native audit | Map discovery status (`tile.discovered`) is tracked on rectangular grid tiles instead of Voronoi cells. | `src/components/MapPane.tsx` (`tiles` array discovery lookup) | Discovery resolution is coarse and does not match the actual rendered Voronoi boundaries. | Migrate discovery flags to a cell-native model (e.g. Set of cell IDs). | Test that traveling to a cell only discovers that specific Voronoi cell polygon. |
| G8 | not_started | support_needed_now | Worker A | `docs/projects/travel/TRACKER.md` | Code audit | Map seed generation (`deriveAzgaarSeed`) hashes coordinates of rectangular tiles. | `src/components/MapPane.tsx` (`deriveAzgaarSeed`) | Couples the iframe map loading and generation seed to the legacy grid structure. | Decouple seed generation from grid tiles; use direct seed mapping from `worldSeed`. | Test that seed derivation returns stable seed without traversing grid array. |
| G9 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Cell-native audit | Player marker (`AtlasPlayerMarker`) positioning is coupled to grid coordinates. | `src/components/MapPane.tsx` / `AtlasPlayerMarker` | Marker position snaps to grid tile centers instead of cell centroids. | Calculate player marker position based on current cell centroid coordinates (`cell.c`). | Test marker positions align correctly with actual cell centroids. |
| G10 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Code audit | Compass and travel reducers only accept and track `x, y` grid updates. | `src/state/reducers/worldReducer.ts` | State updates ignore cell-level precision for travel actions. | Add cell ID tracking to movement action payloads and state models. | Unit tests verifying dispatching cell-native travel updates cell ID state. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
