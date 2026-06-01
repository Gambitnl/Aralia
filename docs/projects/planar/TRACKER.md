# Planar System Living Tracker

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
| T1 | done | Convert Planar project to living format with scope and evidence files | Planar Spark | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Capture Planar state and gaps in this project folder | `docs/projects/planar/NORTH_STAR.md`, `TRACKER.md`, `GAPS.md` |
| T2 | done | Build concrete file map for Planar systems and utility integration points | Planar Spark | 2026-05-31 | `src/systems/planar`, `src/utils/planar`, `src/commands`, `src/hooks` | Keep map as the source of truth in `NORTH_STAR.md` | Verify all listed files still exist |
| T3 | active | Prioritize handoff-safe gap registry for first execution slice | Planar Spark | 2026-05-31 | `src/systems/planar/PlanarService.ts`, `PortalSystem.ts`, `InfernalMechanics.ts`, `PlanarHazardSystem.ts`, `rest.ts` | Keep `GAPS.md` rows only for in-project, evidence-backed gaps | Confirm each gap has a next proof/check and owner |

## Update Rules

- Update tracker entries when evidence changes.
- Active rows must include owner, evidence, next proof, and next action.
- Move completed rows to `done` when evidence is present and stable.
- Preserve adjacent or out-of-scope work in `GAPS.md` if it does not block this slice.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | in_progress | support_needed_now | Planar Spark | `docs/projects/planar/GAPS.md` | Living project refresh | `PlanarService` uses `currentLocationId` prefix heuristic instead of authoritative location-plane resolution | `src/systems/planar/PlanarService.ts` | Incorrect plane resolution can silently apply wrong effects and casting modifiers | Capture required location lookup contract and owner slice | Add unit test with `Location.planeId` and a location-id not matching prefix |
| G2 | in_progress | in_scope_now | Planar Spark | `docs/projects/planar/GAPS.md` | Living project refresh | `PortalSystem` spells and many time requirement branches return conservative false/unsupported values | `src/systems/planar/PortalSystem.ts` | Portal rules can lock content that depends on spell/temporal triggers | Add matrix tests for all requirement types and a source contract for activation reasons | New portal requirement test proving both fail/succeed paths |
| G3 | in_progress | support_needed_now | Planar Spark | `docs/projects/planar/GAPS.md` | Living project refresh | `activeContracts` in state remains `unknown[]`, weakening infernal contract lifecycle | `src/types/state.ts`, `src/systems/planar/InfernalMechanics.ts`, `src/types/infernal.ts` | Current contract breach/penalty flow is untyped and brittle | Route to typed contract state and enforce in sign/check operations | Add compile-time and runtime assertion around active contract payloads |
| G4 | active | adjacent_follow_up | Planar Spark | `docs/projects/planar/GAPS.md` | Living project refresh | Hazard/rest logic contains fallback location and placeholder character IDs when IDs are missing | `src/systems/planar/PlanarHazardSystem.ts`, `src/systems/planar/rest.ts` | Silent fallbacks hide data-quality issues in state and reduce diagnostic value | Track expected strict-id behavior and reporting strategy | Add failing test when identifiers are missing from minimal state |
| G5 | active | in_scope_now | Planar Spark | `docs/projects/planar/GAPS.md` | Living project refresh | Combat/command path applies plane context, but non-combat command entry paths are not documented as explicit consumers | `src/hooks/useAbilitySystem.ts`, `src/commands/factory/SpellCommandFactory.ts`, `src/commands/effects/DamageCommand.ts` | Planar modifiers may not apply outside combat casting contexts | Audit all command builders for `currentPlane` propagation | Add evidence table for covered vs not covered command paths |
