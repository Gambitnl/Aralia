# Logic System Living Tracker

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
| L1 | done | Create the initial logic project scaffold docs and link project registry evidence. | Worker A | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` row + prior `logic` docs | Keep the project slice bounded. | Three docs exist and remain within `docs/projects/logic/`. |
| L2 | done | Convert the logic scaffold into a concrete cold-start doc surface with implementation map, integration gaps, and checks. | Worker A | 2026-06-05 | `docs/projects/logic/NORTH_STAR.md`, `docs/projects/logic/GAPS.md`, `docs/projects/logic/COLD_START_AGENT_PROMPT.md` | Preserve the refreshed handoff as the current source of truth. | North Star carries the dashboard card schema and the project docs stay internally aligned. |
| L3 | active | Prepare implementation decision on where `ConditionEvaluator` is first called. | Worker A | 2026-06-05 | `src/systems/logic/ConditionEvaluator.ts`, `src/types/logic.ts`, `src/systems/spells/targeting/TargetValidationUtils.ts`, `src/systems/spells/effects/AreaEffectTracker.ts` | Decide whether the evaluator enters through trigger handling, spell filtering, or AI condition routing first. | Record the chosen callsite and required schema bridge in `GAPS.md` or the task notes before wiring code. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Worker A | `docs/projects/logic/GAPS.md` | Current pass | `ConditionEvaluator` still has no production callsite in the spell or trigger target paths. | `rg -n "ConditionEvaluator" src`; only evaluator implementation and tests found. | Without a runtime entrypoint, the evaluator stays isolated and unproven in live behavior. | Add the first integration plan in the next implementation slice and keep it inside Logic scope. | Confirm at least one runtime callsite before work moves beyond docs. |
| G2 | not_started | support_needed_now | Worker A | `docs/projects/logic/GAPS.md` | Current pass | Logic evaluator and spell condition schema diverge on predicate breadth (`willing`, object, plane, identity rules). | `src/types/logic.ts`, `src/types/spells.ts`, `src/systems/spells/validation/spellValidator.ts` | Direct coupling would drop intent in live effect filters. | Define the minimal shared condition contract before wiring the first integration. | Add a sample translation map in the implementation notes. |
| G3 | not_started | support_needed_now | Worker A | `docs/projects/logic/GAPS.md` | Current pass | Status checks read `statusEffects` while active condition data is also tracked in `conditions`. | `src/systems/logic/ConditionEvaluator.ts`, `src/types/combat.ts`, `src/commands/effects/StatusConditionCommand.ts` | Divergent state sources can produce false negatives or positives across systems. | Decide the canonical status source and add migration notes. | Show evaluator and status command parity for Poisoned/Removable conditions. |
| G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/creatures/` (overlap) | Current pass | Creature-type matching still uses multiple legacy shapes and helpers. | `src/systems/creatures/CreatureTaxonomy.ts`, `src/systems/spells/targeting/TargetValidationUtils.ts`, `src/types/spells.ts` | Duplicate type handling raises drift risk if `ConditionEvaluator` is extended into targeting gates. | Coordinate with creatures before adding shared predicate contracts. | Align with `docs/projects/creatures/GAPS.md` before changing any shared creature-type API. |
| G5 | not_started | adjacent_follow_up | Worker A | `docs/projects/logic/GAPS.md` | Current pass | `AreaEffectTracker` and `triggerHandler` duplicate area trigger logic and both rely on direct target filter checks. | `src/systems/spells/effects/AreaEffectTracker.ts`, `src/systems/spells/effects/triggerHandler.ts` | Duplication increases maintenance cost and can drift trigger semantics. | Decide whether duplication cleanup stays in spells or is normalized through Logic. | Compare behavior parity on one shared area-trigger fixture before cleanup. |

## Update Rules

- Keep one active row with explicit owner and next proof in each active or waiting stage.
- Keep durable in-project gaps here and route cross-project decisions explicitly.
- If a gap is moved out of Logic scope, update status to `out_of_scope` only with explicit destination.
