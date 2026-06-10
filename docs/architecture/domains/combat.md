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

Tracked gaps in the current implementation. See `docs/superpowers/plans/` for fix plans.

### Player-to-Combat Bridge (`createPlayerCombatCharacter`)

`src/utils/combat/combatUtils.ts` is the equivalent of the monster pipeline for player characters — it converts a `PlayerCharacter` into a `CombatCharacter`. Unlike the monster pipeline, it has no architecture doc and several gaps:

- **`armorClass` / `baseAC` not mapped.** The `PlayerCharacter.armorClass` field (baked into each character's JSON) is never assigned to `CombatCharacter.armorClass` or `baseAC` in the constructor (~line 738). Every player character enters combat with `armorClass: undefined`. Fix: two-line addition. See `docs/superpowers/plans/2026-05-12-equip-premade-characters.md` Task 1.
- **Ranged weapon range not read.** `createWeaponAbility` sets `range: (reach) ? 2 : 1` with no path for ranged weapons. A longbow equipped in `MainHand` gets range 1 (melee). Fix: parse a `range:N` convention from `weapon.properties`. See same plan, Task 2.
- **Class features not auto-generated (partial).** Only `fighter` (Second Wind) and `rogue` (Cunning Dash) have hardcoded class ability generation. Barbarian Rage, Monk Flurry of Blows, Bardic Inspiration, and Divine Smite are absent from the combat palette for their classes. See `docs/superpowers/plans/` for the class-abilities plan (Plan 2, forthcoming).
- **Rage resistance never applied.** Even if Rage were added as a `StatusEffect` with `modifiers.resistance: ['bludgeoning','piercing','slashing']`, `ResistanceCalculator.applyResistances` (`src/utils/combat/resistanceUtils.ts:126`) only checks `CombatCharacter.resistances[]` — the direct field. It does not inspect `statusEffects[].modifiers.resistance[]`. Rage resistance would be stored but silently ignored.
- **Sneak Attack absent.** No auto-trigger logic exists in `DamageCommand`, `AbilityCommandFactory`, or `useActionExecutor`. The only reference is a placeholder `isSneakAttack: false` in the combat log message factory.

### Premade Character Data

All 13 premade characters in `public/premade-characters/` have `"equippedItems": {}`. Every character falls back to Unarmed Strike (flat `1 + STR mod` bludgeoning, no dice) regardless of class. The three pure casters (Sorcerer, Warlock, Wizard) are intentionally weaponless and unaffected. Fix: JSON data only, no code changes. See `docs/superpowers/plans/2026-05-12-equip-premade-characters.md`.

### Death Saving Throws

Death-saving throws, unconscious recovery, and concentration drop on 0 HP are implemented in `src/utils/combat/deathSaveUtils.ts`, `src/hooks/combat/useTurnManager.ts`, and `src/commands/effects/DamageCommand.ts`. Downed player characters initialize death-save tracking when they hit 0 HP, take failure increments when damaged while downed, revive through healing, and roll at the start of their turn until they stabilize or die. Stable characters stay in the turn loop so round-based cleanup and repeat-save processing can continue, but the old note that the system was absent is stale.

---

## Open Follow-Through Questions

- Which combat utility duplicates should be documented as intentional layering versus technical debt?
- Which combat docs should point to battle-map integration explicitly instead of implying combat owns all map rendering concerns?
- Which combat rule surfaces need tighter current-state documentation for reactions, bonus actions, and sustained actions?
