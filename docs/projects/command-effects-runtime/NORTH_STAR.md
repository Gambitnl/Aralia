# NORTH_STAR: Command Effects Runtime

Status: active
Last updated: 2026-05-31

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
- Type guards and no-op warning paths protect bad effect shapes while preserving partial state behavior.

## Active Task

| Field | Value |
|---|---|
| Task | Document command-effects runtime behavior and durable gaps without changing source |
| Acceptance criteria | North Star includes file map, state flow, integration points, and next checks |
| Allowed boundaries | `docs/projects/command-effects-runtime/*`, `src/commands/effects`, `src/commands/factory/*`, `src/commands/base/*`, `src/hooks/useAbilitySystem.ts`, `src/types/spells.ts` |
| Stop condition | source-anchored docs are complete and not overbroad |
| Verification | compare this file with source and current tests |
| Owner | Worker C |
| Next action | keep docs aligned if source changes to effects, factories, or payload types |

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

## Implemented State

- Effect payload contracts are in `src/types/spells.ts`:
  - `SpellEffect` includes DAMAGE, HEALING, STATUS_CONDITION, MOVEMENT, ATTACK_ROLL_MODIFIER, REACTIVE.
  - `MovementEffect.movementType` includes `push`, `pull`, `teleport`, `speed_change`, `stop`.
  - `EffectTrigger` includes `on_target_move`, `on_target_attack`, `on_target_cast`, `on_attack_hit`, `on_caster_action`.
  - `EffectCondition` includes `hit`, `save`, `always`.
- `SpellCommandFactory` and `AbilityCommandFactory` currently map these into concrete command objects.
- `useAbilitySystem.ts` creates command arrays from factories, then runs `CommandExecutor.execute` and applies resulting state, logs, and trigger updates.

## Effect Coverage Notes

- Damage: `DamageCommand` checks `isDamageEffect`, applies rolls, save logic, resistance, concentration checks, and logs with source context.
- Heal: `HealingCommand` checks `isHealingEffect` and applies temporary or normal healing with clamped HP.
- Status: `StatusConditionCommand` validates duration, immunities, save outcomes, and condition remove/refresh behavior.
- Teleport: `MovementCommand` resolves destination, validates bounds and occupancy, and searches a fallback position.
- Reactive: `ReactiveEffectCommand` registers event listeners and sustain records; trigger callback is currently log-only.

## Relationship To Adjacent Runtimes

- `command-base-runtime`: provides `SpellCommand`, `BaseEffectCommand`, and `CommandExecutor`.
- `command-factory-runtime`: builds and selects command objects from spell/ability payloads.
- Data flow is payload -> factory -> command object -> executor -> state updates.

## What Must Not Be Lost

- Immutable execution helpers in `BaseEffectCommand`.
- Current mappings for effect types and supported triggers.
- Existing warning/no-op behavior on unsupported effect shapes.
- Teleport and forced movement fallback semantics.

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Reactive trigger callback does not execute delegated effect commands yet | in_scope_now | Worker C | `src/commands/effects/ReactiveEffectCommand.ts` | implement trigger execution path and add tests |
| Teleport destination and movement budget accounting is still partially TODO documented | support_needed_now | Worker C | `src/commands/effects/MovementCommand.ts` | align runtime with movement budget policy |
| Ability mapper can degrade movement semantics (`teleport` fallback to push logic) | support_needed_now | Worker C | `src/commands/factory/AbilityEffectMapper.ts` | decide explicit movement conversion policy |
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
| Test signals | command coverage for damage/heal/status/movement/reactive registration | `src/commands/effects/__tests__/*`, `src/commands/factory/__tests__/*`, `src/commands/__tests__/CommandExecutor.test.ts` |

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

- Re-check mappings if `src/commands/factory/AbilityEffectMapper.ts`, `MovementCommand.ts`, or `ReactiveEffectCommand.ts` change.
- Confirm G1 and G2 behavior before considering this runtime stable for closed-loop effects.

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/command-effects-runtime/TRACKER.md`.
3. Read `docs/projects/command-effects-runtime/GAPS.md`.
4. Confirm registry row in `docs/projects/PROJECT_TRACKER.md`.
5. Continue from: close the reactive execution and movement/teleport semantics gaps.
