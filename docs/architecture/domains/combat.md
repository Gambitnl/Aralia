# Combat

## Purpose

The Combat domain handles tactical encounter execution: turn flow, action resolution, spell and ability use, movement, targeting, damage, conditions, and combat-facing UI state.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/components/Combat/
- src/hooks/useAbilitySystem.ts
- src/hooks/combat/
- src/systems/combat/
- src/systems/events/CombatEvents.ts
- src/utils/combatUtils.ts
- src/utils/combat/deathSaveUtils.ts
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

## Known Limitations

Tracked gaps in the current implementation belong in `docs/projects/combat/GAPS.md` or in the owning child/system project.

### Player-to-Combat Bridge (`createPlayerCombatCharacter`)

`src/utils/combat/combatUtils.ts` is the player-character equivalent of the monster pipeline. Earlier versions of this document listed player armor class mapping, ranged weapon range, class feature generation, Rage resistance, Sneak Attack, and premade martial equipment as open gaps. Those notes are stale in the current repo:

- `createPlayerCombatCharacter` now maps `armorClass` and `baseAC`.
- weapon ability creation reads `range:N` weapon properties for ranged weapons.
- the combat palette includes Barbarian Rage, Monk Flurry of Blows, Bardic Inspiration, Divine Smite, Pact Magic, Fighter Second Wind, and Rogue Cunning Dash.
- `ResistanceCalculator` reads temporary resistance from `statusEffects[].modifiers.resistance`.
- `AbilityCommandFactory` contains Sneak Attack trigger logic.
- `docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md` records `docs/superpowers/plans/2026-05-12-equip-premade-characters.md` as retired/executed, with premade martial equipment proof.

Treat the live combat project docs, tests, and source files as authoritative before reviving any of the older bridge-gap claims.

### Death Saving Throws

Death-saving throws, unconscious recovery, and concentration drop on 0 HP are implemented in `src/utils/combat/deathSaveUtils.ts`, `src/hooks/combat/useTurnManager.ts`, and `src/commands/effects/DamageCommand.ts`. Downed player characters initialize death-save tracking when they hit 0 HP, take failure increments when damaged while downed, revive through healing, and roll at the start of their turn until they stabilize or die. Stable characters stay in the turn loop so round-based cleanup and repeat-save processing can continue, but the old note that the system was absent is stale.

---

## Open Follow-Through Questions

- Which combat utility duplicates should be documented as intentional layering versus technical debt?
- Which combat docs should point to battle-map integration explicitly instead of implying combat owns all map rendering concerns?
- Which combat rule surfaces need tighter current-state documentation for reactions, bonus actions, and sustained actions?

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/architecture/domains/combat.md","sha256WithoutMarker":"9cf3ca8155f893a9866b1311279c496223a821c699e28a43ee618a5ba283735a","markedAtUtc":"2026-06-26T00:12:35.432Z"} -->
