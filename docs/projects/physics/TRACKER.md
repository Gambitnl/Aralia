# Physics System Living Tracker

Status: review-required
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

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T4 | done | Wire elemental state transitions into damage/status command flow and add one focused proof check. | Physics worker | 2026-06-15 | `src/types/elemental.ts` (`DamageTypeToStateTag`/`getStateTagForDamageType`), `src/commands/effects/DamageCommand.ts` (`applyElementalState`), `src/commands/effects/__tests__/DamageCommand.test.ts` (3 new tests, 26 pass) | Done for the damage path: damage element maps to StateTag and resolves vs target `stateTags` (Wet+Cold→Frozen). Remaining: StatusConditionCommand condition→state mapping (tracked under G2). | Vitest passed 2026-06-15; see `AUDIT_OR_PROOF.md`.
| T5 | done | Wire elemental state mapping into StatusConditionCommand (condition name → StateTag), completing the second half of G2. | Physics worker | 2026-06-15 | `src/types/elemental.ts` (`ConditionToStateTag`), `src/commands/effects/StatusConditionCommand.ts`, `StatusConditionCommand.test.ts` (2 new tests) | Done for the status path: condition element maps to StateTag and resolves vs target `stateTags` (Wet+Chilled→Frozen). | Vitest passed 2026-06-15; see `AUDIT_OR_PROOF.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | open | in_scope_now | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | One-step elemental interactions stop early even when resulting state could react further. | `src/systems/physics/ElementalInteractionSystem.ts`, `src/systems/physics/Physics_Ralph.md` | Decide whether recursive resolution is a rule requirement or intentional simplification. | Add behavior test if recursion is adopted, or document hard stop policy. | Add regression tests for chained interactions.
| G2 | resolved | in_scope_now | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | BOTH PATHS DONE 2026-06-15 (T4 & T5): `DamageCommand` and `StatusConditionCommand` now correctly map elements and conditions to `StateTag` and resolve using `applyStateToTags`. | `src/types/elemental.ts`, `src/types/combat.ts`, `src/commands/effects/DamageCommand.ts`, `src/commands/effects/StatusConditionCommand.ts` | Combat damage and statuses now propagate elemental state correctly. | Done. | Vitest passed 2026-06-15.
| G3 | open | in_scope_now | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Tile effect schema is read inconsistently as `environmentalEffects` vs `environmentalEffect`. | `src/commands/effects/TerrainCommand.ts`, `src/hooks/combat/engine/useCombatEngine.ts` | Runtime tick logic and effect expiry may diverge from mutation path. | Add one migration/bridge pass or unify schema in one owned touchpoint. | Run round and movement tests after migration proof.
| G4 | open | adjacent_follow_up | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | LOS ignores elevation and start/end tile blocking exceptions remain non-standard. | `src/utils/spatial/lineOfSight.ts`, `src/utils/spatial/__tests__/lineOfSight.test.ts` | Potential mismatch with tactical vision requirements. | Decide whether elevation-aware LOS is required for this project scope. | Add line-of-sight test cases with elevation contrasts.
| G5 | open | support_needed_now | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Movement opportunity-attack timing is implemented with a retroactive path due to synchronous action executor assumptions. | `src/hooks/combat/useActionExecutor.ts` | Reaction timing can affect balance and reproducibility. | Validate expected order against combat rules and decide if event ordering should be rewritten. | Add deterministic event-order tests around move + OA interaction.
| G6 | open | adjacent_follow_up | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Object-level collision/AC/HP hooks are still utility stubs and are not connected to combat target flow. | `src/utils/physicsUtils.ts`, `src/systems/physics/ElementalInteractionSystem.ts` | Missing behavior may block future rules work and keep combat targeting assumptions implicit. | Classify the object-combat hooks as near-term work or deferred debt. | Add a concrete owner and next proof once the route is chosen.
| G7 | open | blocked_human_decision | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Suffocation remains a TODO in `physicsUtils` and has no tracked integration path into combat or environment resolution. | `src/utils/physicsUtils.ts` | Oxygen and pressure style rules can stay invisible to later tasks if they remain unowned. | Pick an owner and either slot it into near-term scope or explicitly defer it. | Add a narrow task or a documented deferral decision.
| G8 | open | adjacent_follow_up | Physics worker | `docs/projects/physics/GAPS.md` | Documentation pass | Throw-distance integration remains a TODO and is not linked to inventory or forced-movement flow. | `src/utils/physicsUtils.ts` | Future throw and shove rules need a stable distance contract. | Define the distance source and route it to the owning system. | Add one physics or combat proof once the route is chosen.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
