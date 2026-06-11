---
schema_version: 1
project: Command Effects Runtime
slug: command-effects-runtime
category: Feature Domains and Runtime Support
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-10
confidence: high
evidence: docs/projects/command-effects-runtime; docs/projects/DECISION_BLITZ_2026-06-10.md (D9)
gap_signal: "G1 decision recorded 2026-06-10 (command context owns the delegated payload); implementation lane open; G3/G5 parked; G2/G4 resolved"
protocol: living project doc set
next_step: Implement the G1 decision — expose a safe delegated-payload source-of-truth in the command context and let ReactiveEffectCommand rehydrate sibling effect commands on trigger; resume T2 with focused trigger-path tests.
agent_comments: "G1 cannot safely synthesize delegated payloads from the current command context; the missing source-of-truth needs a decision. Decided 2026-06-10: command context owns the delegated payload (DECISION_BLITZ D9)."
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# NORTH_STAR: Command Effects Runtime

Status: active — G1 decision recorded 2026-06-10; implementation lane open
Last updated: 2026-06-10

## Why This Project Exists

This project owns executable effect logic under `src/commands/effects`. It is the layer that applies spell and ability effects once factories produce `SpellCommand` objects.

## Purpose

Keep a concise cold-start handoff for:

- effect command ownership,
- file map and implemented behavior,
- integration to base/factory runtimes,
- and durable gaps that block full execution parity.

## Current State

- Project ownership is recorded in `docs/projects/PROJECT_TRACKER.md`.
- Source implementations exist in `src/commands/effects` and are active in combat flow.
- Command set includes `DamageCommand`, `HealingCommand`, `StatusConditionCommand`, `MovementCommand`, `ReactiveEffectCommand`, `RegisterRiderCommand`, plus support commands in the same folder.
- Teleport ability effects now keep an explicit command dispatch path through `AbilityCommandFactory` instead of collapsing into the generic push fallback.
- Type guards and no-op warning paths protect bad effect shapes while preserving partial state behavior.
- Reactive trigger registration exists, but the delegated payload source-of-truth is not exposed in the command context, so trigger callbacks remain registration/logging only until the owner decision is recorded.

## Active Task

| Field | Value |
|---|---|
| Task | Resolve the delegated reactive payload ownership question and keep the runtime gap surface explicit |
| Acceptance criteria | G1 is marked review-required in `GAPS.md`, the decision question is captured in a Required Review Brief, G2/G4 remain closed, and the next agent can resume without re-triaging ownership |
| Allowed boundaries | `docs/projects/command-effects-runtime/*`, `src/commands/effects`, `src/commands/factory/*`, `src/commands/base/*`, `src/hooks/combat/useActionExecutor.ts`, `src/hooks/useAbilitySystem.ts`, `src/types/spells.ts`, `src/types/state.ts` |
| Stop condition | the review brief is recorded and the next agent can resume only after the payload-owner decision is answered |
| Verification | docs consistency review against `TRACKER.md`, `GAPS.md`, and source-anchored evidence; scoped tests resume after the decision if implementation is approved |
| Owner | Worker C |
| Next action | decision recorded 2026-06-10 (DECISION_BLITZ D9): command context owns the delegated payload — resume T2/G1 by exposing the delegated-payload source-of-truth in `CommandContext` with focused trigger-path tests |

## Required Review Brief

| Field | Value |
|---|---|
| Title | Reactive delegated payload source-of-truth |
| Question | Which layer owns the spell payload executed when a reactive trigger fires? |
| Issue | `ReactiveEffectCommand` registers listeners, but `CommandContext` and `GameState` do not expose a spell or payload registry that can be safely rehydrated into delegated commands. |
| Current behavior | Reactive spells and defensive loops stay listener-only; the turn executor handles some delayed trigger damage inline, but non-damage delegated payloads do not execute through the command layer. |
| Why blocked | Forward implementation would need to guess where the payload lives or invent a new contract without owner approval. |
| Option A | Add an explicit delegated-payload handle to command context and let `ReactiveEffectCommand` rehydrate sibling effect commands on trigger. |
| Option B | Keep reactive effects registration-only and move execution into the combat/turn executor with an explicit reactive trigger processor. |
| Evidence | `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/types/state.ts`, `src/hooks/combat/useActionExecutor.ts` |
| Decision owner | Human/product owner plus the command runtime owner |
| Proof after decision | Focused unit/integration coverage proving the chosen owner executes a reactive payload and logs the resulting state change. |

### Decision (2026-06-10)

Resolved — **Option A selected: the command context owns the delegated payload.** Expose a safe delegated-payload source-of-truth in the command context so `ReactiveEffectCommand` can rehydrate sibling effect commands on trigger and reactive effects execute through the normal command pipeline.

- Decider: Remy (project owner), batched decision session 2026-06-10.
- Master record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D9); local record: `docs/projects/command-effects-runtime/DECISIONS.md` D-03.
- Status: decision recorded 2026-06-10; implementation lane open. T2/G1 resumes — add the delegated-payload handle to `CommandContext`, rehydrate delegated commands in `ReactiveEffectCommand`, and land the focused trigger-path proof named above. The inline reactive handling in `useActionExecutor.ts` should converge onto the command-context owner as part of the slice.

## Dashboard Card Schema

Project: Command Effects Runtime
Slug: command-effects-runtime
Category: Feature Domains and Runtime Support
Status: active — G1 decision recorded 2026-06-10; implementation lane open
Confidence: high
Evidence: docs/projects/command-effects-runtime; docs/projects/DECISION_BLITZ_2026-06-10.md (D9)
Gap signal: G1 decision recorded 2026-06-10 (command context owns the delegated payload); G3/G5 parked; G2/G4 resolved
Protocol: living project doc set
Next step: Implement the G1 decision — expose the delegated-payload source-of-truth in the command context and resume T2 with focused trigger-path tests.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

## Scope Boundaries

In scope:
- Documentation and evidence of the effects runtime only.
- Durable unresolved behavior records.

Adjacent but not in scope:
- direct runtime refactors and feature expansion in source.

Out of scope:
- edits outside this folder.
- broad gameplay balancing or architecture policy.

## File Map

- `src/commands/effects/DamageCommand.ts`: damage execution and reaction checks.
- `src/commands/effects/HealingCommand.ts`: healing and temporary HP handling.
- `src/commands/effects/StatusConditionCommand.ts`: status/condition add, remove, save, and duration.
- `src/commands/effects/MovementCommand.ts`: push, pull, teleport, speed change, stop, forced movement.
- `src/commands/effects/ReactiveEffectCommand.ts`: reactive/sustain trigger registration.
- `src/commands/effects/RegisterRiderCommand.ts`: damage rider registration in attack flow.
- `src/commands/effects/{ConcentrationCommands,AttackRollModifierCommand,DefensiveCommand,SummoningCommand,TerrainCommand,UtilityCommand,NarrativeCommand}.ts`: supporting effect classes.
- `src/commands/base/SpellCommand.ts`: command-context contract and shared metadata surface.
- `src/hooks/combat/useActionExecutor.ts`: current inline reactive trigger execution path used by the combat turn executor.

## Implemented State

- Effect payload contracts are in `src/types/spells.ts`:
  - `SpellEffect` includes DAMAGE, HEALING, STATUS_CONDITION, MOVEMENT, ATTACK_ROLL_MODIFIER, REACTIVE.
  - `MovementEffect.movementType` includes `push`, `pull`, `teleport`, `speed_change`, `stop`.
  - `EffectTrigger` includes `on_target_move`, `on_target_attack`, `on_target_cast`, `on_attack_hit`, `on_caster_action`.
  - `EffectCondition` includes `hit`, `save`, `always`.
- `SpellCommandFactory` and `AbilityCommandFactory` currently map these into concrete command objects.
- `useAbilitySystem.ts` creates command arrays from factories, then runs `CommandExecutor.execute` and applies resulting state, logs, and trigger updates.
- `useActionExecutor.ts` still handles some delayed reactive trigger effects directly, which keeps the current runtime from having a single delegated-payload owner.

## Effect Coverage Notes

- Damage: `DamageCommand` checks `isDamageEffect`, applies rolls, save logic, resistance, concentration checks, and logs with source context.
- Heal: `HealingCommand` checks `isHealingEffect` and applies temporary or normal healing with clamped HP.
- Status: `StatusConditionCommand` validates duration, immunities, save outcomes, and condition remove/refresh behavior.
- Teleport: `MovementCommand` resolves destination, validates bounds and occupancy, searches a fallback position, and records requested/actual budget metadata in the combat log. `AbilityCommandFactory` now keeps teleport effects on the command path instead of dropping them into the generic movement fallback.
- Reactive: `ReactiveEffectCommand` registers event listeners and sustain records; trigger callback is currently log-only, and the execution owner for delegated payloads is now review-required.

## Relationship To Adjacent Runtimes

- `command-base-runtime`: provides `SpellCommand`, `BaseEffectCommand`, and `CommandExecutor`.
- `command-factory-runtime`: builds and selects command objects from spell/ability payloads.
- `combat-turn-executor`: currently contains some inline reactive trigger handling in `useActionExecutor.ts`; this is the competing execution surface that needs an owner decision before G1 can move forward.
- Data flow is payload -> factory -> command object -> executor -> state updates.

## What Must Not Be Lost

- Immutable execution helpers in `BaseEffectCommand`.
- Current mappings for effect types and supported triggers.
- Existing warning/no-op behavior on unsupported effect shapes.
- Teleport and forced movement fallback semantics.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Reactive trigger callback does not execute delegated effect commands yet | in_scope_now (decision recorded 2026-06-10) | Worker C | `src/commands/effects/ReactiveEffectCommand.ts`, `src/commands/base/SpellCommand.ts`, `src/hooks/combat/useActionExecutor.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` (D9) | decided: the delegated payload lives in command context — expose the source-of-truth handle and rehydrate delegated commands with trigger-path tests |
| Rider registration only supports direct damage riders in command path | adjacent_follow_up | Worker C | `src/commands/effects/RegisterRiderCommand.ts` | route expansion scope for non-damage riders |
| Status effect duration expiry cleanup is not fully command-owned | adjacent_follow_up | Worker C | `src/commands/effects/StatusConditionCommand.ts` | confirm lifetime owner for expiry and cleanup |

## Global Gap Imports

Check `docs/projects/GLOBAL_GAPS.md` before adding cross-project gaps.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | current gaps are owned by this runtime |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Source command classes | implemented effect execution set | `src/commands/effects` |
| Factory mapping | payload-to-command translation path | `src/commands/factory/SpellCommandFactory.ts`, `src/commands/factory/AbilityCommandFactory.ts` |
| Core contract and executor | shared command shape and orchestration | `src/commands/base/SpellCommand.ts`, `src/commands/base/BaseEffectCommand.ts`, `src/commands/base/CommandExecutor.ts` |
| Integration to game loop | command chain executed by hook orchestrator | `src/hooks/useAbilitySystem.ts` |
| Test signals | command coverage for damage/heal/status/movement/reactive registration and teleport budget metadata | `src/commands/effects/__tests__/*`, `src/commands/factory/__tests__/*`, `src/commands/__tests__/CommandExecutor.test.ts` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Registry anchor | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project routing evidence | active |
| `docs/projects/command-effects-runtime/TRACKER.md` | Active queue and checks | active |
| `docs/projects/command-effects-runtime/GAPS.md` | Durable unresolved findings | active |

## Artifact Boundary

Keep durable intent, decisions, and durable gap records here.
Keep raw logs, temporary run state, and test artifacts out unless promoted with rationale.

## Next Checks

- Re-check mappings if `src/commands/factory/AbilityCommandFactory.ts`, `src/commands/factory/AbilityEffectMapper.ts`, `MovementCommand.ts`, or `ReactiveEffectCommand.ts` change.
- Keep G1 as the active slice for T2; leave G3 and G5 parked unless new evidence changes their status.
- Confirm G1 behavior and the teleport budget contract before considering this runtime stable for closed-loop effects.

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/command-effects-runtime/TRACKER.md`.
3. Read `docs/projects/command-effects-runtime/GAPS.md`.
4. Confirm registry row in `docs/projects/PROJECT_TRACKER.md`.
5. Continue from: close the reactive execution gap from T2; G4 is now documented as resolved.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
