# Travel System North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists
Travel movement is partially implemented in multiple directories with separate core,
UI, and action-handler logic. This project protects those partial systems from
being treated as either finished or abandoned.

## Intended Outcome
Preserve concrete Travel System state for cold starts: what exists today, where it
is wired, and which mechanics still need integration.

## Current State
- Core travel math is in `src/systems/travel/TravelCalculations.ts` with tests
  in `src/systems/travel/__tests__/TravelCalculations.test.ts`.
- Navigation check logic is in `src/systems/travel/TravelNavigation.ts` with tests
  in `src/systems/travel/__tests__/TravelNavigation.test.ts`.
- Runtime movement handling is in `src/hooks/actions/handleMovement.ts`, including
  adjacent movement, world crossing, named location movement, and `QUICK_TRAVEL`.
- Quick-travel pathfinding and action payload use are in
  `src/components/Submap/useQuickTravel.ts` and `src/components/Submap/SubmapPane.tsx`.
- `src/services/travelService.ts` offers a reusable route calculator that currently
  is not the sole runtime path for normal movement.
- Quick-travel action type and payload are defined in `src/types/actions.ts`.
- This project documentation started with scaffold-only structure and now tracks
  concrete file-level state and integration gaps.

## Active Task

| Field | Value |
|---|---|
| Task | Turn the travel docs in `docs/projects/travel/` into a concrete cold-start pack. |
| Acceptance criteria | NORTH_STAR, TRACKER, and GAPS contain concrete file map, integration points, and evidence-backed gaps. |
| Allowed boundaries | `docs/projects/travel/` only. Source read-only confirmation in scoped files. |
| Stop condition | Documentation is internally consistent and includes next checks for movement/navi mechanics integration. |
| Verification | Confirm each referenced file path exists and matches current implementation assertions in this pack. |
| Owner | Worker A |
| Next action | Resolve `in_scope_now` gaps in the travel runtime on the next implementation slice. |

## Scope Boundaries

In scope:
- Documenting current travel behavior and wiring for this codebase.
- Recording unresolved but discovered gaps tied to Travel files.
- Defining continuation checkpoints for the next implementation slice.

Adjacent but not in this slice:
- Rebalancing movement numbers.
- Cross-project movement UX redesign.

Out of scope:
- Gameplay refactors outside Travel, Submap, or movement action handlers.
- Unrelated tracker or policy cleanup.

## What Must Not Be Lost
- Split ownership between travel logic, action handling, and submap UI.
- Explicit TODO markers where mechanics are defined but not yet connected:
  forced march, navigation drift in runtime, and vehicle simplifications.
- Contract mismatch risk between fast quick-travel step costs and service-level group
  travel model.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Forced march status is computed but not applied in runtime movement. | in_scope_now | Worker A | `src/systems/travel/TravelCalculations.ts`, `src/hooks/actions/handleMovement.ts` | Add exhaustion check path in movement loop and add movement-level assertions. |
| Navigation drift (`checkNavigation`) is not integrated into travel movement flow. | in_scope_now | Worker A | `src/systems/travel/TravelNavigation.ts`, `src/hooks/actions/handleMovement.ts` | Implement call site and create regression coverage. |
| Quick travel and normal movement use different cost models. | support_needed_now | Worker A | `src/components/Submap/useQuickTravel.ts`, `src/hooks/actions/handleMovement.ts`, `src/services/travelService.ts` | Define one cost contract or document a justified split and align tests. |
| Transport and vehicle edge cases are simplified. | support_needed_now | Worker A | `src/systems/travel/TravelCalculations.ts`, `src/types/travel.ts` | Expand vehicle/puller modeling before adding wagon/heavy-load gameplay tests. |
| Quick travel has no fatigue/resource consumption implementation. | adjacent_follow_up | Worker A | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts` | Decide whether to add fatigue and supply consumption in the same slice as pathfinding. |

## Global Gap Imports

`docs/projects/GLOBAL_GAPS.md` was checked. All identified issues are travel-local.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | No cross-project gaps were identified during this pass. |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Travel calculations + tests | Travel math primitives and edge coverage exist in the codebase | `src/systems/travel/TravelCalculations.ts`, `src/systems/travel/__tests__/TravelCalculations.test.ts` |
| Navigation checks + tests | Navigation outcome model (success/fail + drift/time penalty) is defined and tested | `src/systems/travel/TravelNavigation.ts`, `src/systems/travel/__tests__/TravelNavigation.test.ts` |
| Movement handlers + contract | Move and QUICK_TRAVEL action path exists in action system | `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/actionHandlers.ts`, `src/types/actions.ts` |
| Submap quick-travel UI | Pathfinding-driven UI and dispatch payload are implemented | `src/components/Submap/useQuickTravel.ts`, `src/components/Submap/SubmapPane.tsx` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Repo-level project registry | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project/global gap routing | active |
| `docs/projects/travel/TRACKER.md` | Active task and gap routing slice tracking | active |
| `docs/projects/travel/GAPS.md` | Durable gap registry for travel scope | active |
| `src/systems/travel/TravelCalculations.ts` | Core travel math implementation | active |
| `src/systems/travel/TravelNavigation.ts` | Navigation outcomes and drift | active |
| `src/hooks/actions/handleMovement.ts` | Runtime movement and QUICK_TRAVEL handling | active |
| `src/components/Submap/useQuickTravel.ts` | Quick travel pathfinding and preview metrics | active |
| `src/components/Submap/SubmapPane.tsx` | Quick travel UI and action dispatch | active |
| `src/services/travelService.ts` | Shared travel calculation service | active |

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Should `travelService.ts` be authoritative for all movement time checks? | Prevents inconsistent pacing behavior between quick travel and world/submap movement | Worker A | Next implementation slice |
| Which travel route should own fatigue and encounter checks? | Prevents duplicated or missing side effects across handlers | Worker A | Next implementation slice |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/travel/TRACKER.md`.
3. Read `docs/projects/travel/GAPS.md`.
4. Confirm evidence in these files:
   - `src/systems/travel/TravelCalculations.ts`
   - `src/systems/travel/TravelNavigation.ts`
   - `src/hooks/actions/handleMovement.ts`
   - `src/components/Submap/useQuickTravel.ts`
   - `src/services/travelService.ts`
5. Continue from: close `in_scope_now` gaps with a movement-pass review.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
