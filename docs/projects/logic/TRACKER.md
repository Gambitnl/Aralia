# Logic System Tracker

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
| L1 | done | Create the initial logic project scaffold docs and link project registry evidence. | Worker A | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` row + prior `logic` docs | Keep docs focused to the project slice. | Three docs exist and remain within `docs/projects/logic/`. |
| L2 | active | Convert this logic scaffold into a concrete cold-start doc surface with implementation map, integration gaps, and checks. | Worker A | 2026-05-31 | `src/systems/logic/ConditionEvaluator.ts`, `src/types/logic.ts`, `src/systems/spells/effects/triggerHandler.ts` | Finalize `NORTH_STAR.md`, `GAPS.md`, and task-level check list. | `git diff --check` clean and only logic doc files changed. |
| L3 | waiting | Prepare implementation decision on where `ConditionEvaluator` is first called. | Worker A | 2026-05-31 | `rg -n "ConditionEvaluator" src`, `src/systems/spells/targeting/TargetValidationUtils.ts`, `src/systems/spells/effects/AreaEffectTracker.ts` | Decide whether evaluator is used from trigger handling, spell filtering, or AI condition routing first. | Next pass records one non-doc integration row in `docs/projects/logic/GAPS.md` with owner and proof requirement. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker A | `docs/projects/logic/GAPS.md` | Current pass | Condition evaluator has no production callsites in spell/trigger target paths. | `rg -n "ConditionEvaluator" src`; only evaluator implementation and tests found. | Without callsites, `ConditionEvaluator` stays isolated and unproven in live behavior. | Add integration plan in next implementation slice and align with `NORTH_STAR` scope. | Confirm at least one runtime callsite before work moves beyond docs. |
| G2 | not_started | support_needed_now | Worker A | `docs/projects/logic/GAPS.md` | Current pass | Logic evaluator and spell condition schema diverge on predicate breadth (`willing`, object, plane, identity rules). | `src/types/logic.ts`, `src/types/spells.ts`, `src/systems/spells/validation/spellValidator.ts` | Live effect filters may lose intent if evaluator is used directly without schema bridge. | Define the minimal shared condition contract before wiring first integration. | New row in implementation notes with a sample translation map. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/logic/GAPS.md` | Current pass | Condition evaluator reads `statusEffects` for status checks while active condition data is also tracked in `conditions`. | `src/systems/logic/ConditionEvaluator.ts`, `src/types/combat.ts`, `src/commands/effects/StatusConditionCommand.ts` | Divergent state sources can produce false negatives/positives across systems. | Decide canonical source for status predicate queries and add migration notes. | Add a proof check that evaluator and status command agree on active status for Poisoned/Removable conditions. |
| G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/creatures/` (overlap) | Current pass | Creature-type matching still uses multiple legacy shapes and helpers. | `src/systems/creatures/CreatureTaxonomy.ts`, `src/systems/spells/targeting/TargetValidationUtils.ts`, `src/types/spells.ts` | Duplicate type handling raises drift risk if `ConditionEvaluator` is extended into targeting gates. | Coordinate with creatures project before adding new shared predicate contracts. | Align with `docs/projects/creatures/GAPS.md` before changing any shared creature-type API. |
| G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/logic/GAPS.md` | Current pass | `AreaEffectTracker` and `triggerHandler` duplicate area trigger logic and both rely on direct target filter checks. | `src/systems/spells/effects/AreaEffectTracker.ts`, `src/systems/spells/effects/triggerHandler.ts` | Duplication increases maintenance cost and can drift trigger semantics. | Decide whether duplication cleanup stays in spells package or uses logic system for normalized condition checks. | Compare behavior parity on one shared area-trigger fixture before cleanup. |

## Update Rules

- Keep one active row with explicit owner and next proof in each active/waiting stage.
- Keep durable in-project gaps here and route cross-project decisions explicitly.
- If a gap is moved out of Logic scope, update status to `out_of_scope` only with explicit destination.
