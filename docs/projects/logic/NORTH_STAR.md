# Logic System North Star

Status: active
Last updated: 2026-05-31

## Why This Project Exists

The Logic System is registered in `docs/projects/PROJECT_TRACKER.md`, but its runtime usage is split across spell targeting and trigger surfaces. This project preserves the real implementation point (`ConditionEvaluator`) and the current integration gap so future work can continue without losing context.

## Intended Outcome

Create a concrete handoff for logic-rule ownership: what exists, what is wired, what is not wired yet, and what checks should happen next.

## Current State (Evidence-Backed)

- `src/systems/logic/ConditionEvaluator.ts` implements rule evaluation for:
  - composite logic (`AND`, `OR`, `NOT`)
  - state leaf checks (`status`, `attribute`, `stat`, `creature_type`)
  - target selection (`self`, `target`, `source`) and comparison operators
- `src/types/logic.ts` defines the rule data model consumed by the evaluator.
- `src/systems/logic/__tests__/ConditionEvaluator.test.ts` covers composite rules, status checks, and creature type checks.
- Repo search confirms no production callsites to `ConditionEvaluator` outside its own test and implementation file.

## Concrete File Map

| Surface | Responsibility | Status |
|---|---|---|
| `src/systems/logic/ConditionEvaluator.ts` | Generic condition evaluator | implemented |
| `src/systems/logic/__tests__/ConditionEvaluator.test.ts` | Unit coverage of evaluator behavior | implemented |
| `src/types/logic.ts` | Condition and operator types | implemented |
| `src/systems/spells/targeting/TargetValidationUtils.ts` | Spell target filter checks (`creatureTypes`, `excludeCreatureTypes`, `hasCondition`) | implemented, independent of `ConditionEvaluator` |
| `src/systems/spells/effects/triggerHandler.ts` | Spell trigger gate checks for conditions | implemented, uses `matchesTargetFilter` |
| `src/systems/spells/effects/AreaEffectTracker.ts` | Area trigger processing for entry/exit/end-turn | implemented, duplicates trigger filtering logic |
| `src/systems/spells/validation/spellValidator.ts` | Spell schema for effect conditions and target filters | implemented |
| `src/types/spells.ts` | Runtime data model for `EffectCondition` and `TargetConditionFilter` | implemented |
| `src/systems/spells/targeting/TargetResolver.ts` | Spells target validation entrypoint | implemented |

## Integration Notes

- Intended use in comments suggests spell AI/contingency/trigger use, but no active runtime wiring is visible in current search output.
- Predicate evaluation today is implemented in runtime split points:
  - `TargetValidationUtils.matchesFilter`
  - `triggerHandler.matchesTargetFilter`
  - manual/ability target logic in `hooks/combat/useTargetValidator.ts` and `TargetResolver`
- `TargetConditionFilter` in spells has broader fields than `Condition` in `types/logic.ts`, so direct reuse would currently lose fidelity.

## Active Task

| Field | Value |
|---|---|
| Task | Complete a documentation-only cold-start pass for Logic with concrete state and gap evidence. |
| Allowed files | `docs/projects/logic/*` |
| Evidence | `src/systems/logic/*`, `src/types/logic.ts`, `src/systems/spells/*`, `src/types/spells.ts` |
| Acceptance | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` contain clear scope, integration map, gap inventory, owner routing, and next checks. |
| Stop condition | All three docs updated and no non-document file edits. |
| Owner | Worker A |

## Scope Boundaries

In scope:
- logic runtime ownership capture
- gap inventory and routing
- next-check framing for future implementation slices

Out of scope:
- wiring evaluator callsites into combat/spell runtime
- broad spell schema cleanup
- behavior refactors in unrelated systems

## Known Gaps (Project Scope)

- No production importer path for `ConditionEvaluator` is active yet.
- `types/logic.ts` uses loose stat/attribute strings and permissive casts in evaluator internals.
- Status checks are split between `statusEffects` and `conditions` in `CombatCharacter`, while `ConditionEvaluator` reads only `statusEffects`.
- Spell effect conditions carry fields (`willing`, object flags, plane and identity rules) not modeled in `Condition` today.
- `AreaEffectTracker` and `triggerHandler` overlap trigger processing logic.

## Evidence Links

- `src/systems/logic/ConditionEvaluator.ts`
- `src/systems/logic/__tests__/ConditionEvaluator.test.ts`
- `src/types/logic.ts`
- `src/systems/spells/targeting/TargetValidationUtils.ts`
- `src/systems/spells/effects/triggerHandler.ts`
- `src/systems/spells/effects/AreaEffectTracker.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/systems/spells/validation/spellValidator.ts`
- `src/types/spells.ts`

## Resume Path

1. Read this file.
2. Read `docs/projects/logic/TRACKER.md`.
3. Read `docs/projects/logic/GAPS.md`.
4. Check `docs/projects/PROJECT_TRACKER.md` and `docs/projects/GLOBAL_GAPS.md`.
5. Continue with implementation planning in `src/systems/logic` before touching production wiring.
