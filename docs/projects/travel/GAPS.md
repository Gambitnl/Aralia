# Travel Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that belong to Travel System and are
too important to keep only in temporary notes.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Doc pass + code scan | Forced march exhaustion checks are not applied during movement flow. | `src/systems/travel/TravelCalculations.ts` and TODO in `src/hooks/actions/handleMovement.ts` | Party can remain in long travel loops without fatigue risk; gameplay behavior mismatches travel rules. | Wire `calculateForcedMarchStatus` into movement progression and apply exhaustion effects. | Add assertion in movement test that 9-hour travel triggers DC 11 outcome path. |
| G2 | not_started | in_scope_now | Worker A | `docs/projects/travel/TRACKER.md` | Doc pass + code scan | Navigation drift logic (`checkNavigation`) is defined but not consumed by movement loop. | `src/systems/travel/TravelNavigation.ts`, `src/hooks/actions/handleMovement.ts` TODO marker | Get-lost and reroute behavior remains unused despite available logic. | Add navigation check call in movement or travel service and apply drift direction/time penalties. | Add deterministic drift regression with seeded random in a movement-level test. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/travel/TRACKER.md` | Cross-file behavior scan | Quick travel and regular movement time cost models differ and are not reconciled. | `src/components/Submap/useQuickTravel.ts`, `src/hooks/actions/handleMovement.ts`, `src/services/travelService.ts` | Inconsistent travel duration, encounter checks, and seasonal multipliers depending on path entry point. | Choose one authoritative movement-time source and update both flows. | Add integration check for 10-step quick travel against same route service call. |
| G4 | not_started | support_needed_now | Worker A | `docs/projects/travel/TRACKER.md` | Code review | Transport edge cases (wagon/cart pullers, load limits) are simplified with fallback defaults. | `src/systems/travel/TravelCalculations.ts`, `src/types/travel.ts` | Route realism and balance can drift when transport-based movement is added to narrative tasks. | Expand travel transport schema and validation before introducing new mechanics. | Add unit tests for vehicle with missing speed and heavy load routes. |
| G5 | not_started | adjacent_follow_up | Worker A | `src/components/Submap` | UI review | Quick travel cost currently ignores fatigue/consumption hooks despite TODO note. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts` | Later systems may not model cumulative cost of rapid movement. | Confirm scope; decide whether to add resource drain in this project or open dependency. | Add explicit decision note in TRACKER and tests when implemented. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
