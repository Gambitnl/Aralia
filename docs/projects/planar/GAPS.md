# Planar System Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | not_started | support_needed_now | Planar Spark | Planar core | `NORTH_STAR` refresh | `PlanarService` still resolves plane from `currentLocationId` prefix heuristics instead of authoritative `Location` data | `src/systems/planar/PlanarService.ts` | Wrong location-plane mapping breaks aura, rest, hazard, and combat modifier behavior when location ids are not predictable | Replace the heuristic with a resolver that uses `gameState.dynamicLocations[currentLocationId]` plus the static location map | Add regression tests for Material, Feywild, and unknown location cases |
| P2 | not_started | support_needed_now | Planar Spark | Portal mechanics | `NORTH_STAR` refresh | `PortalSystem` still treats spell requirements as stubbed false and closes some time cases as unsupported | `src/systems/planar/PortalSystem.ts` | Some portal data is effectively unopenable by design today, which can block content incorrectly | Define spell requirement semantics and extend `TimeOfDay` support | Add test cases for `spell`, `time` variants, and reason strings |
| P3 | not_started | support_needed_now | Planar Spark | Infernal mechanics/state typing | `NORTH_STAR` refresh | Infernal contracts are typed as `unknown[]` in state; breach detection and penalties stay minimal or placeholder | `src/types/state.ts`, `src/systems/planar/InfernalMechanics.ts`, `src/types/infernal.ts` | Silent type drift on save/load and weak contract enforcement are hard to validate in gameplay | Move `activeContracts` to typed `InfernalContract[]` and close the `detectBreach` decision path | Add an infernal integration test that touches active contract mutation and persisted state |
| P4 | not_started | adjacent_follow_up | Planar Spark | Hazard/rest systems | `NORTH_STAR` refresh | Hazard and rest helpers still substitute fallback location and placeholder IDs when state is incomplete | `src/systems/planar/PlanarHazardSystem.ts`, `src/systems/planar/rest.ts` | Bugs stay hidden and diagnostic signal drops when core ids are missing | Decide strict vs resilient handling and update call sites to enforce required identifiers | Add a test that intentionally passes a missing `id` and asserts explicit diagnostic behavior |
| P5 | not_started | support_needed_now | Planar Spark | Integration coverage | `NORTH_STAR` refresh | Non-combat spell and casting paths may not consistently pass `currentPlane` into command context | `src/hooks/useAbilitySystem.ts`, `src/commands/factory/SpellCommandFactory.ts`, `src/commands/effects/DamageCommand.ts`, `src/components/Combat/CombatView.tsx` | Users can see inconsistent planar modifiers depending on execution path | Audit command creation paths and ensure plane context coverage | Add a route map and tests for at least one non-combat entry path |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task is required to avoid incorrect behavior in existing mechanics |
| `support_needed_now` | Required for safe continuation of the current slice or adjacent systems |
| `adjacent_follow_up` | Useful but not required for immediate continuity |
| `out_of_scope` | Not part of the Planar slice |
| `blocked_human_decision` | Needs an explicit gameplay or design decision |
| `blocked_external_state` | Needs external input, service, or PR state |

## Route Note

These gaps belong to Planar and stay local in `docs/projects/planar/GAPS.md`.
No cross-project global gaps were added during this refresh.

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
