# Planar System Gap Registry

Status: active
Last updated: 2026-05-31

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | not_started | support_needed_now | Planar Spark | Planar core | `NORTH_STAR` refresh | `PlanarService` does not resolve plane from authoritative `Location` data and falls back to ID-name heuristics | `src/systems/planar/PlanarService.ts` | Wrong location-plane mapping breaks aura, rest, hazard, and combat modifier behavior in any non-standard location ID layout | Replace heuristic with resolver using `gameState.dynamicLocations[currentLocationId]` + static location map and explicit default | Add regression tests for three cases: Material, Feywild, unknown location |
| P2 | not_started | in_scope_now | Planar Spark | Portal mechanics | `NORTH_STAR` refresh | Portal spell requirement path returns stubbed false, and some time cases are closed as unsupported | `src/systems/planar/PortalSystem.ts` | Some portal data is effectively unopenable by design today; players can be blocked incorrectly | Define and implement spell requirement semantics and extend `TimeOfDay` support | Add test cases for `spell`, `time` variants, and reason strings |
| P3 | not_started | support_needed_now | Planar Spark | Infernal mechanics/state typing | `NORTH_STAR` refresh | Infernal contracts are typed in state as `unknown[]`; breach detection and penalties are minimal or placeholder | `src/types/state.ts`, `src/systems/planar/InfernalMechanics.ts`, `src/types/infernal.ts` | Silent type drift on save/load and contract enforcement logic, hard to validate in gameplay | Move `activeContracts` to typed `InfernalContract[]` and close `detectBreach` decision path | Add `infernal` integration test touching active contract mutation and persisted state |
| P4 | not_started | adjacent_follow_up | Planar Spark | Hazard/rest systems | `NORTH_STAR` refresh | Hazard/rest helpers substitute fallback location and placeholder IDs when state is incomplete | `src/systems/planar/PlanarHazardSystem.ts`, `src/systems/planar/rest.ts` | Bugs are hidden and debug signals are reduced when core IDs are missing | Decide strict vs resilient handling and update call sites to enforce required identifiers | Add test that intentionally passes missing `id` and asserts explicit diagnostic behavior |
| P5 | not_started | support_needed_now | Planar Spark | Integration coverage | `NORTH_STAR` refresh | Non-combat spell/casting paths may not consistently pass `currentPlane` into command context | `src/hooks/useAbilitySystem.ts`, `src/commands/factory/SpellCommandFactory.ts`, `src/commands/effects/DamageCommand.ts`, `src/components/Combat/CombatView.tsx` | Users can see inconsistent planar modifiers depending on execution path | Audit all command creation paths and update as needed to ensure plane context coverage | Add route map and tests for at least one non-combat entry path |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task is required to avoid incorrect behavior in existing mechanics |
| `support_needed_now` | Required for safe continuation of current slice or adjacent systems |
| `adjacent_follow_up` | Useful but not required for immediate continuity |
| `out_of_scope` | Not part of Planar slice |
| `blocked_human_decision` | Needs explicit gameplay/design decision |
| `blocked_external_state` | Needs external input, service, or PR state |

## Route Note

These gaps belong to Planar and stay local in `docs/projects/planar/GAPS.md`. No cross-project global gaps were added during this refresh.
