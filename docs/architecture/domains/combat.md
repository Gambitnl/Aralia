# Combat

Verified: 2026-09-11

## Purpose

The Combat domain handles tactical encounter execution: turn flow, action resolution, spell and ability use, movement, targeting, damage, conditions, and combat-facing UI state.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/components/Combat/
- src/hooks/useAbilitySystem.ts
- src/hooks/combat/
- src/systems/combat/
- src/systems/events/CombatEvents.ts
- src/utils/combat/combatUtils.ts
- src/utils/combat/deathSaveUtils.ts
- src/utils/combat/initiativeUtils.ts
- src/utils/combat/groupTurnUtils.ts
- src/types/combat.ts

## Current Domain Shape

The combat domain currently spans several layers:
- combat UI surfaces under src/components/Combat/
- orchestration hooks under src/hooks/combat/ and src/hooks/useAbilitySystem.ts
- combat subsystems under src/systems/combat/
- supporting event and rules utilities under src/systems/events/ and src/utils/

Verified subsystem names referenced in this pass include:
- AttackEventEmitter
- AttackRiderSystem
- MovementEventEmitter
- SavePenaltySystem
- SustainActionSystem

## Boundaries And Constraints

- Combat state should be updated through the established action and command flow rather than ad hoc component mutation.
- Combat depends heavily on spell, character, and map data, but it should remain the execution layer rather than the owner of those upstream domains.
- Multiple utility paths now exist for movement, line of sight, targeting, saving throws, and area-of-effect math, so path-level ownership claims need to be made carefully instead of assuming one canonical helper file for every rule.

## Historical Drift Corrected

The older version of this file was broadly right about the domain, but it drifted toward a too-neat ownership map:
- several helper names now exist in more than one utility lane
- some file listings were too specific for a system that has continued to branch
- the document read closer to an exhaustive ownership index than a stable domain map

## What Is Materially Implemented

This pass verified that the combat domain already has:
- dedicated combat UI surfaces
- dedicated combat hooks
- a systems/combat subsystem lane
- event infrastructure
- action-economy, line-of-sight, targeting, area-of-effect, and saving-throw utility surfaces
- spell-aware combat orchestration through useAbilitySystem

### Initiative and shared group turns

`initiativeUtils.ts` rolls ordinary initiative and applies Aralia's deterministic
house tie policy: total initiative, Dexterity score, initiative bonus, then stable
authored order. That tie ladder is deliberately deterministic for replays and
network hosts; it is not presented as a canonical 5e tie rule.

`groupTurnUtils.ts` converts the ordered actors into initiative groups. Ordinary
actors are singleton groups. A summon with `initiativePolicy: "shared"` joins
its caster's group in deterministic member order. `useTurnOrder` stores the
group definitions and one active member, while `useTurnManager` runs that
member's start/end effects and economy transition.

The group owns only sequencing and completion. Action, movement, Reaction, and
effect timing remain independently member-owned. Incapacitated members retain
their start/end boundary, missing or dead members are skipped, active removal
continues from the next eligible member without rebuilding initiative, and a
repeated member-end/removal request is an idempotent no-op.

## Known Limitations

Tracked gaps in the current implementation belong on the planmap topic `world-reactions` (combat lane; see `docs/superpowers/specs/2026-07-14-absorbed-combat.md` for the absorbed combat project context) or in the owning child/system project.

### Player-to-Combat Bridge (`createPlayerCombatCharacter`)

`src/utils/combat/combatUtils.ts` is the player-character equivalent of the monster pipeline. Earlier versions of this document listed player armor class mapping, ranged weapon range, class feature generation, Rage resistance, Sneak Attack, and premade martial equipment as open gaps. Those notes are stale in the current repo:

- `createPlayerCombatCharacter` now maps `armorClass` and `baseAC`.
- weapon ability creation reads `range:N` weapon properties for ranged weapons.
- the combat palette includes Barbarian Rage, Monk Flurry of Blows, Bardic Inspiration, Divine Smite, Pact Magic, Fighter Second Wind, and Rogue Cunning Dash.
- `ResistanceCalculator` reads temporary resistance from `statusEffects[].modifiers.resistance`.
- `ResistanceCalculator.applyResistances` applies resistance and vulnerability in sequence (2024 rules: halve, then double) rather than cancelling them; see `docs/adr/0004-resistance-then-vulnerability-order.md`.
- `AbilityCommandFactory` contains Sneak Attack trigger logic.
- `docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md` records `docs/superpowers/plans/2026-05-12-equip-premade-characters.md` as retired/executed, with premade martial equipment proof.

Treat the live combat project docs, tests, and source files as authoritative before reviving any of the older bridge-gap claims.

### Death Saving Throws

Death-saving throws, unconscious recovery, and concentration drop on 0 HP are implemented in `src/utils/combat/deathSaveUtils.ts`, `src/hooks/combat/useTurnManager.ts`, and `src/commands/effects/DamageCommand.ts`. Downed player characters initialize death-save tracking when they hit 0 HP, take failure increments when damaged while downed, revive through healing, and roll at the start of their turn until they stabilize or die. Stable characters stay in the turn loop so round-based cleanup and repeat-save processing can continue, but the old note that the system was absent is stale.

---

## Combat Invariants And Modularization Split Plan

This plan records the safe seam for the claimed CMA-G18/G30 work. It is intentionally documentation-first: preserve the current public hook contracts and move one responsibility at a time only after the regression boundaries below are green.

### Invariants to preserve

- `useAbilitySystem` remains the UI-facing composite boundary. Targeting, validation, reaction prompts, concentration cleanup, and ability execution retain their existing return shapes and callback behavior.
- `useCombatEngine` remains the simulation boundary. Turn-phase processing must preserve ordering: scheduled effects, movement/area triggers, damage/healing resolution, repeat saves, downed/death-save state, and log emission.
- Every character update is based on the latest character snapshot; a multi-effect action must not overwrite an earlier HP/status/position mutation with stale state.
- Damage flows through the shared damage calculator so resistance, vulnerability, immunity, temporary HP, source metadata, and on-damage riders remain consistent for immediate and delayed packets.
- Reactions are requested at the established trigger boundary and are idempotent by event identity; replaying a post-damage event must not apply damage or a reaction twice.
- Scheduled effects are claimed by `(effect, round, phase)` before resolution, expire at their exclusive round boundary, and are removed when their target leaves combat.
- Repeat saves consume eligible save penalties, update progression counters atomically, and remove all linked status/condition mirrors only when the configured success or failure outcome is reached.
- Initiative/group sequencing belongs to turn management; action execution and effect resolution must not silently assume singleton turns or mutate turn order.

### Proposed ownership seams

1. **Pure combat resolution helpers**: extract stateless functions for damage packet resolution, repeat-save progression, scheduled-effect eligibility/claim keys, and linked-effect cleanup. Inputs/outputs should be explicit and independently testable.
2. **Scheduled-effect processor**: move turn-start/turn-end scheduled payload orchestration behind a narrow engine-local service. Keep React state setters and phase-claim storage at the hook boundary until behavior is proven.
3. **Reaction/effect bridges**: keep reaction prompting and spell/ability materialization separate from generic damage and turn processing; preserve the existing `useReactionSystem` and `useAbilityExecution` seams rather than creating a second executor.
4. **Composite hook facade**: after helper extraction, retain `useAbilitySystem` as a compatibility facade and re-export existing utility types/functions. Do not move targeting UI state or change callback signatures in the same pass.

### Regression-test boundaries

- `src/hooks/__tests__/useAbilitySystem.*`: targeting, self/multi-target teleports, object refs, AI/per-target input, reactions, concentration, and selected-target propagation.
- `src/hooks/combat/__tests__/useTurnOrder.familiarPocket.test.ts` plus turn-manager suites: shared initiative, skipped/off-map actors, group completion, and phase ordering.
- `src/hooks/combat/__tests__/useActionExecutor.test.ts`: attack-result delivery, reactive effects, Armor of Agathys, and opportunity-attack hit/miss behavior.
- `src/commands/effects/__tests__/DamageCommand.test.ts` and `src/utils/combat/__tests__/combatUtils_damage*.test.ts`: resistance/vulnerability/immunity, temporary HP, downed state, and save-penalty consumption.
- `src/systems/spells/effects/__tests__/triggerHandler.test.ts`: movement-trigger timing, forced-movement suppression, and source context.
- Add focused pure-helper tests beside each extracted module before changing hook wiring. Required cases are success/failure progression, duplicate scheduled phase calls, expiry cleanup, stale-snapshot protection, reaction replay idempotency, and linked-status cleanup.

### Sequencing and stop conditions

Extract pure helpers first, then scheduled processing, then facade cleanup. Each step must preserve the existing focused suites and pass typechecking for touched modules. Stop and revert the split at any point where logs, callback counts, target IDs, HP/status mirrors, or phase order differ; do not compensate with broad type casts or unrelated cleanup.

## Open Follow-Through Questions

- Which combat utility duplicates should be documented as intentional layering versus technical debt?
- Which combat docs should point to battle-map integration explicitly instead of implying combat owns all map rendering concerns?
- Which combat rule surfaces need tighter current-state documentation for reactions, bonus actions, and sustained actions?

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/architecture/domains/combat.md","sha256WithoutMarker":"7be8a201694574b322e2ea06afe9477155be3aba7764cad941367ed91ef18b33","markedAtUtc":"2026-08-09T20:14:15.936Z"} -->
