---
schema_version: 1
project: Logic System
slug: logic
category: Systems
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: partial
last_updated: 2026-06-12
iteration: 2
confidence: high
evidence: docs/projects/logic
gap_signal: "6 open gaps; L-G1 through L-G6 remain open"
protocol: living project doc set
next_step: Decide the first runtime callsite for ConditionEvaluator, then bridge the predicate contract and status source.
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-05
workflow_gaps_reviewed: 2026-06-05
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Logic System North Star

Status: active
Last updated: 2026-06-12

## Dashboard Card Schema

Project: Logic System
Slug: logic
Category: Systems
Status: partial
Confidence: high
Evidence: `docs/projects/logic`
Gap signal: 6 open gaps; L-G1 through L-G6 remain open
Protocol: living project doc set
Next step: Decide the first runtime callsite for `ConditionEvaluator`, then bridge the predicate contract and status source.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Why This Project Exists

The Logic System is registered in `docs/projects/PROJECT_TRACKER.md`, but its runtime usage is still split across spell targeting and trigger surfaces. This project preserves the real implementation point (`ConditionEvaluator`) and the current integration gap so future work can continue without losing context.

## Intended Outcome

Keep a concrete handoff for logic-rule ownership: what exists, what is wired, what is not wired yet, and what checks should happen next.

## Current State (Evidence-Backed)

- `src/systems/logic/ConditionEvaluator.ts` is the canonical rule evaluator for composite logic, state leaf checks, target selection, and comparison operators.
- `src/types/logic.ts` defines the condition data model consumed by the evaluator.
- `src/systems/logic/__tests__/ConditionEvaluator.test.ts` covers composite rules, status checks, and creature type checks.
- Repo search still shows no production callsites to `ConditionEvaluator` outside its own test and implementation file.
- Spell targeting and trigger logic still lives in split runtime paths, so the first integration point remains a decision, not an implementation detail.

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

- Intended use in comments suggests spell AI, contingency, and trigger use, but no active runtime wiring is visible in current search output.
- Predicate evaluation today is implemented in runtime split points:
  - `TargetValidationUtils.matchesFilter`
  - `triggerHandler.matchesTargetFilter`
  - manual/ability target logic in `hooks/combat/useTargetValidator.ts` and `TargetResolver`
- `TargetConditionFilter` in spells has broader fields than `Condition` in `types/logic.ts`, so direct reuse would currently lose fidelity.
- The canonical status source is still split between `statusEffects` and `conditions`, which needs a decision before the first runtime bridge lands.

## Active Task

| Field | Value |
|---|---|
| Task | Keep the Logic living-project doc surface current and hand the next agent a clean first-integration decision. |
| Allowed files | `docs/projects/logic/*` |
| Evidence | `docs/projects/logic/NORTH_STAR.md`, `docs/projects/logic/TRACKER.md`, `docs/projects/logic/GAPS.md`, `docs/projects/logic/COLD_START_AGENT_PROMPT.md`, `src/systems/logic/*`, `src/types/logic.ts`, `src/systems/spells/*`, `src/types/spells.ts` |
| Acceptance | `NORTH_STAR.md` carries the dashboard card schema, `TRACKER.md` is compact and status-accurate, and `GAPS.md` keeps the in-scope integration path and follow-ups explicit. |
| Stop condition | All four Logic docs are refreshed and no non-document file edits were made. |
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
2. Read `TRACKER.md` and `GAPS.md`.
3. Decide the first runtime callsite for `ConditionEvaluator`.
4. Keep integration logic inside `src/systems/logic` until the contract mapping is pinned.
5. Route creature-type or spell-schema follow-up work to the owning project instead of widening this slice.

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps in `GAPS.md` before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count

## Required Review Brief

Title: Logic partial due to runtime integration gaps
Question: Which runtime callsite should become the first ConditionEvaluator integration?
Issue: The project has five open gaps, led by deciding the first production callsite for ConditionEvaluator.
Current behavior: GAPS.md lists L-G1 as in_scope_now and L-G2/L-G3 as support-needed contract/type work.
Why blocked: The rule engine exists but should not be broadly wired until predicate mapping and typed lookups are safe.
Option A: Start with one bounded callsite and add the predicate contract before broad usage.
Option B: Delay implementation and first document the evaluator-to-spell/trigger mapping.
Evidence: NORTH_STAR.md next_step; GAPS.md L-G1, L-G2, L-G3.
Decision owner: Logic system owner
Proof after decision: One source-to-evaluator call path and one translated condition are verified without semantic loss.
