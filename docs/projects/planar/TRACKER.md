# Planar System Living Tracker

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
| T3 | active | Prioritize handoff-safe gap registry for first execution slice | Planar Spark | 2026-06-05 | `src/systems/planar/PlanarService.ts`, `PortalSystem.ts`, `InfernalMechanics.ts`, `PlanarHazardSystem.ts`, `rest.ts`, `docs/projects/planar/*` | Keep `GAPS.md` rows limited to in-project, evidence-backed gaps | Start with `GAPS.md` row `P1` when the next implementation slice begins |

## Update Rules

- Update tracker entries when evidence changes.
- Active rows must include owner, evidence, next proof, and next action.
- Move completed rows to `done` when evidence is present and stable.
- Preserve adjacent or out-of-scope work in `GAPS.md` if it does not block
  this slice.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | in_progress | support_needed_now | Planar Spark | `docs/projects/planar/GAPS.md` | Living project refresh | `PlanarService` still uses `currentLocationId` prefix heuristics instead of authoritative location-plane resolution | `src/systems/planar/PlanarService.ts` | Wrong location-plane mapping can silently apply the wrong effects and modifiers | Capture the required location lookup contract and owner slice | Add a unit test with `Location.planeId` and a location id that does not match the prefix |
| G2 | in_progress | in_scope_now | Planar Spark | `docs/projects/planar/GAPS.md` | Living project refresh | `PortalSystem` still treats spell requirements and several time branches as conservative false/unsupported values | `src/systems/planar/PortalSystem.ts` | Portal rules can lock content that depends on spell or temporal triggers | Add a matrix test for all requirement types and source tracking | New portal requirement test proving both fail and succeed paths |
| G3 | in_progress | support_needed_now | Planar Spark | `docs/projects/planar/GAPS.md` | Living project refresh | `activeContracts` in state remains `unknown[]`, weakening infernal contract lifecycle handling | `src/types/state.ts`, `src/systems/planar/InfernalMechanics.ts`, `src/types/infernal.ts` | Contract breach and penalty flow stay brittle while state is untyped | Route to typed contract state and enforce it in sign/check operations | Add compile-time and runtime assertions around active contract payloads |
| G4 | active | adjacent_follow_up | Planar Spark | `docs/projects/planar/GAPS.md` | Living project refresh | Hazard and rest helpers still substitute fallback location or placeholder character IDs when IDs are missing | `src/systems/planar/PlanarHazardSystem.ts`, `src/systems/planar/rest.ts` | Silent fallbacks hide data-quality issues and reduce diagnostics | Track expected strict-id behavior and reporting strategy | Add a failing test when identifiers are missing from minimal state |
| G5 | active | in_scope_now | Planar Spark | `docs/projects/planar/GAPS.md` | Living project refresh | Combat and command paths apply plane context, but non-combat command entry paths are not documented as explicit consumers | `src/hooks/useAbilitySystem.ts`, `src/commands/factory/SpellCommandFactory.ts`, `src/commands/effects/DamageCommand.ts` | Planar modifiers may not apply outside combat casting contexts | Audit all command builders for `currentPlane` propagation | Add a route map and tests for at least one non-combat entry path |

## Dashboard Alignment

- The tracker stays intentionally compact.
- The gap log is the operational queue for the next implementation slice.
- `NORTH_STAR.md` carries the durable resume path and the dashboard card
  schema.
