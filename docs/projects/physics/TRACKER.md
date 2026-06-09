# Physics System Tracker

Status: review-required
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

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T1 | done | Replace placeholder project docs with concrete physics state map and evidence. | Physics worker | 2026-05-31 | `src/systems/physics`, `src/utils/combat/physicsUtils.ts`, `src/hooks/combat` | Track runtime integration assumptions and unresolved paths in GAPS.md. | Confirm no edits to non-specified files.
| T2 | done | Verify terrain/environment and movement integration points for handoff continuity. | Physics worker | 2026-05-31 | `src/commands/effects/TerrainCommand.ts`, `src/hooks/combat/engine/useCombatEngine.ts`, `src/hooks/combat/useTurnManager.ts` | Keep gap list current for next implementation slice. | Cross-check with TRACKER row in `docs/projects/PROJECT_TRACKER.md`.
| T3 | done | Validate physics gap priorities and decide routing for each gap type. | Physics worker | 2026-06-05 | `docs/projects/physics/GAPS.md`, `docs/projects/physics/NORTH_STAR.md`, `docs/projects/physics/COLD_START_AGENT_PROMPT.md` | Use the routed gaps as the next handoff source instead of re-deriving scope. | Confirm no workflow-level gap was opened in `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`.
| T4 | active | Wire elemental state transitions into damage/status command flow and add one focused proof check. | Physics worker | 2026-06-05 | `docs/projects/physics/GAPS.md` (G2), `src/commands/effects/DamageCommand.ts`, `src/commands/effects/StatusConditionCommand.ts`, `src/types/elemental.ts`, `src/types/combat.ts` | Implement the command-level state mapping and add one regression path for a physical effect flow. | Add targeted Vitest coverage for the elemental transition path.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | open | in_scope_now | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | One-step elemental interactions stop early even when resulting state could react further. | `src/systems/physics/ElementalInteractionSystem.ts`, `src/systems/physics/Physics_Ralph.md` | Decide whether recursive resolution is a rule requirement or intentional simplification. | Add behavior test if recursion is adopted, or document hard stop policy. | Add regression tests for chained interactions.
| G2 | open | in_scope_now | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | `StateTag` transitions are not connected to damage/status command payload flow. | `src/types/elemental.ts`, `src/types/combat.ts`, `src/commands/effects/DamageCommand.ts` | Combat outcomes miss elemental-state side effects. | Define and document command-level mapping for elemental damage -> `stateTags`. | Add coverage for at least one physical spell/effect flow using elemental transitions.
| G3 | open | in_scope_now | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Tile effect schema is read inconsistently as `environmentalEffects` vs `environmentalEffect`. | `src/commands/effects/TerrainCommand.ts`, `src/hooks/combat/engine/useCombatEngine.ts` | Runtime tick logic and effect expiry may diverge from mutation path. | Add one migration/bridge pass or unify schema in one owned touchpoint. | Run round and movement tests after migration proof.
| G4 | open | adjacent_follow_up | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | LOS ignores elevation and start/end tile blocking exceptions remain non-standard. | `src/utils/spatial/lineOfSight.ts`, `src/utils/spatial/__tests__/lineOfSight.test.ts` | Potential mismatch with tactical vision requirements. | Decide whether elevation-aware LOS is required for this project scope. | Add line-of-sight test cases with elevation contrasts.
| G5 | open | support_needed_now | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Movement opportunity-attack timing is implemented with a retroactive path due to synchronous action executor assumptions. | `src/hooks/combat/useActionExecutor.ts` | Reaction timing can affect balance and reproducibility. | Validate expected order against combat rules and decide if event ordering should be rewritten. | Add deterministic event-order tests around move + OA interaction.
| G6 | open | adjacent_follow_up | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Object-level collision/AC/HP hooks are still utility stubs and are not connected to combat target flow. | `src/utils/physicsUtils.ts`, `src/systems/physics/ElementalInteractionSystem.ts` | Missing behavior may block future rules work and keep combat targeting assumptions implicit. | Classify the object-combat hooks as near-term work or deferred debt. | Add a concrete owner and next proof once the route is chosen.
| G7 | open | blocked_human_decision | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Suffocation remains a TODO in `physicsUtils` and has no tracked integration path into combat or environment resolution. | `src/utils/physicsUtils.ts` | Oxygen and pressure style rules can stay invisible to later tasks if they remain unowned. | Pick an owner and either slot it into near-term scope or explicitly defer it. | Add a narrow task or a documented deferral decision.
| G8 | open | adjacent_follow_up | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Throw-distance integration remains a TODO and is not linked to inventory or forced-movement flow. | `src/utils/physicsUtils.ts` | Future throw and shove rules need a stable distance contract. | Define the distance source and route it to the owning system. | Add one physics or combat proof once the route is chosen.
