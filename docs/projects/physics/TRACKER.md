# Physics System Tracker

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

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T1 | done | Replace placeholder project docs with concrete physics state map and evidence. | Physics worker | 2026-05-31 | `src/systems/physics`, `src/utils/combat/physicsUtils.ts`, `src/hooks/combat` | Track runtime integration assumptions and unresolved paths in GAPS.md. | Confirm no edits to non-specified files.
| T2 | done | Verify terrain/environment and movement integration points for handoff continuity. | Physics worker | 2026-05-31 | `src/commands/effects/TerrainCommand.ts`, `src/hooks/combat/engine/useCombatEngine.ts`, `src/hooks/combat/useTurnManager.ts` | Keep gap list current for next implementation slice. | Cross-check with TRACKER row in `docs/projects/PROJECT_TRACKER.md`.
| T3 | active | Validate physics gap priorities and decide routing for each gap type. | Physics worker | 2026-05-31 | `src/systems/physics/ElementalInteractionSystem.ts`, `src/types/combat.ts`, `src/utils/spatial/lineOfSight.ts` | Push unresolved items into `GAPS.md` with owner and next proof checks. | Confirm no global routing needed from `docs/projects/GLOBAL_GAPS.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | in_progress | structural | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | One-step elemental interactions stop early even when resulting state could react further. | `src/systems/physics/ElementalInteractionSystem.ts`, `src/systems/physics/Physics_Ralph.md` | Decide whether recursive resolution is a rule requirement or intentional simplification. | Add behavior test if recursion is adopted, or document hard stop policy.
| G2 | in_progress | integration | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | `StateTag` transitions are not connected to damage/status command payload flow. | `src/types/elemental.ts`, `src/types/combat.ts`, `src/commands/effects/DamageCommand.ts` | Combat outcomes miss elemental-state side effects. | Define and document command-level mapping for elemental damage -> `stateTags`.
| G3 | in_progress | data-model | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Tile effect schema is read inconsistently as `environmentalEffects` vs `environmentalEffect`. | `src/commands/effects/TerrainCommand.ts`, `src/hooks/combat/engine/useCombatEngine.ts` | Runtime tick logic and effect expiry may diverge from mutation path. | Add one migration/bridge pass or unify schema in one owned touchpoint.
| G4 | in_progress | mechanics | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | LOS ignores elevation and start/end tile blocking exceptions remain non-standard. | `src/utils/spatial/lineOfSight.ts`, `src/utils/spatial/__tests__/lineOfSight.test.ts` | Potential mismatch with tactical vision requirements. | Decide whether elevation-aware LOS is required for this project scope.
| G5 | in_progress | timing | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Movement opportunity-attack timing is implemented with a retroactive path due to synchronous action executor assumptions. | `src/hooks/combat/useActionExecutor.ts` | Reaction timing can affect balance and reproducibility. | Validate expected order against combat rules and decide if event ordering should be rewritten.
| G6 | support_needed_now | deferred | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Object damage/AC/HP, suffocation, throw-distance integration remain TODO placeholders. | `src/utils/physicsUtils.ts`, `src/systems/physics/ElementalInteractionSystem.ts` | Missing behavior may block future feature expansion. | Decide if these remain intentional debt or must move into near-term scope.
