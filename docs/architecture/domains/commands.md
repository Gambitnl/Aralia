# Commands Domain

Verified: 2026-10-24 for spell-factory dispatch and family ownership below. The older general command inventory retains its previous scope.

## Purpose

This domain covers the command-pattern execution lane that turns spell effects and combat ability effects into validated runtime actions.
It is no longer just a spell-effect subsystem: the current command stack now serves both spell JSON execution and weapon or ability resolution.

## Verified Entry Points

- src/commands/factory/SpellCommandFactory.ts builds command sequences from spell definitions and effect payloads.
- src/commands/factory/AbilityCommandFactory.ts builds command sequences for combat abilities and weapon attacks.
- src/commands/base/CommandExecutor.ts coordinates validation and execution order.
- src/commands/effects/UtilityCommand.ts remains one of the important integration points for cross-cutting mechanics such as light sources, save riders, and terrain manipulation.
- src/commands/index.ts is the public export surface.

## Current Shape

### Base lane

- src/commands/base/BaseEffectCommand.ts
- src/commands/base/SpellCommand.ts
- src/commands/base/CommandExecutor.ts

These files define the shared command contract, execution context, and orchestration flow.

### Factory lane

- src/commands/factory/SpellCommandFactory.ts
- src/commands/factory/AbilityCommandFactory.ts
- src/commands/factory/AbilityEffectMapper.ts

The factory layer is now the clearest sign that this domain spans more than spells. Spell effects and combat ability effects are both normalized into command objects here, even when the downstream execution still depends on combat-specific helpers and systems.

### Effect lane

The effect lane still lives under src/commands/effects/ and includes the current command families for:

- damage
- healing
- status conditions
- movement and teleport handling
- defensive buffs
- summoning
- terrain manipulation
- utility effects
- concentration handling
- reactive effects
- rider registration
- narrative side effects

## Tests Verified In This Pass

The current command test suite includes:

- src/commands/__tests__/CommandExecutor.test.ts
- src/commands/__tests__/Concentration.test.ts
- src/commands/__tests__/DefensiveCommand.test.ts
- src/commands/__tests__/HealingCommand.test.ts
- src/commands/__tests__/LightMechanics.test.ts
- src/commands/__tests__/MovementCommand.test.ts
- src/commands/__tests__/SlasherFeat.test.ts
- src/commands/__tests__/SpellCommandFactory.test.ts
- src/commands/__tests__/StatusConditionCommand.test.ts
- src/commands/__tests__/SummoningCommand.test.ts
- src/commands/__tests__/UtilityCommand.*.test.ts (split by concern 9 ways: control, illusion, information, light, message, minorUtility, objects, riders, summon)
- src/commands/effects/__tests__/DamageCommand.test.ts
- src/commands/effects/__tests__/ReactiveEffectCommand.test.ts
- src/commands/factory/__tests__/SpellCommandFactoryAI.test.ts

## Dependencies And Boundaries

### Owned by this domain

- src/commands/

### Shared dependencies that matter during edits

- src/types/spells.ts
- src/types/combat.ts
- src/utils/combat/combatUtils.ts
- src/systems/combat/AttackRiderSystem.ts

### Boundary note

This domain is reusable infrastructure, but it is not isolated from combat. AbilityCommandFactory.ts already reaches into combat-specific helpers and rider systems, so changes here should be treated as command-plus-combat work rather than as a purely standalone execution layer.

## Current Interpretation

Re-verified on 2026-03-11.
The previous version of this doc had drifted by describing the command lane mainly as spell-effect plumbing. The current repo shape shows a broader command system that now sits between spell data, combat abilities, shared effect mapping, and downstream combat systems.

## Spell factory family dispatch

`SpellCommandFactory.createCommands` remains the public cast-building entry. C3 reduces its file from 2,536 lines to 252 lines, including the refreshed dependency header. It still prepares planar empowerment, target context, per-target choices, AI arbitration and mode selection in the same order. Its argument list is unchanged.

The existing implementations now live under `src/commands/factory/spell/`:

| Owner | Responsibility |
| --- | --- |
| `specialSpellRegistry.ts` | Select the exclusive bridge for Scrying, Elemental Bane, Grasping Vine, Seeming, Bones of the Earth, blade cantrips, Lightning Lure and Thunderwave. An unhandled bridge falls back to ordinary effects. |
| `effectRegistry.ts` | Map damage, healing, conditions, attack modifiers, movement, summons, terrain, utility and defense to the existing effect command classes. |
| `effectRouting.ts` and `targets.ts` | Preserve creature filtering and rich target references, reactive/rider ownership, deferred zones, scheduled effects and conditional endings before family dispatch. |
| `scaling.ts` | Preserve slot/cantrip scaling, nested damage riders and created-object resource scaling. |
| `concentration.ts` | Preserve break/start concentration and taunt lifecycle order. |
| `scrying.ts`, `illusion.ts`, `terrain.ts`, `movement.ts`, `weaponBridges.ts` and `utilityBridges.ts` | Build and execute the existing special-spell paths with their original conditions and early returns. |
| `spellAttack.ts` and `fire.ts` | Preserve attack rolls, beam allocation, hit effects, fire artifacts and object ignition. |
| `bridgeContext.ts` | Carry prepared cast inputs without introducing a second state owner. |

Adding another ordinary effect family extends the typed registry and its effect command. A new exclusive spell bridge belongs to its family and the spell-ID registry. The public factory remains responsible for cast preparation and command sequence assembly. In particular, Scrying retains its save-owned concentration behavior, while Seeming and Bones of the Earth retain their existing direct returns. C3 does not normalize these distinct rules.

Verification: 217 baseline factory/ability tests passed before extraction. After extraction, all 923 tests across 109 affected factory and spell-system files passed. After final type-only refinements, 48 focused bridge/status/mode tests passed again. Explicit scoped typecheck reports zero errors and zero suppressed diagnostics across all 16 changed files. `spells:check` passes for 473 spells and retains its known race-data warnings. Forty-three isolated-emission checks preserve embedded declarations, helper bodies, exclusive bridge conditions, public arguments and cast-dispatch order. These are bounded source and fixture proofs, rather than whole-program semantic or rendered acceptance.

Affected lint has zero errors and one pre-existing `any` warning in the public reaction callback contract. The extracted attack predicate uses its exact inferred non-null type, so new family files introduce no `any` allowance. The staged C10 baseline remains unchanged because the shared index was not staged: publication must lower the old factory allowance when these changes are staged, alongside other pending baseline reductions. A single header-sync wave touched only the 16 owned files; `commands/index.ts` was reported stale and left untouched. The fresh supported import graph remains complete with zero unresolved imports and two previously recorded emitted cycles elsewhere. No build, hosted CI, gameplay or visual acceptance is claimed.

Claude independently accepted the candidate in Agora 8224 and confirmed the final synced version in 8227. The peer reported 189 factory tests passing and compared the opening preparation, ten special-ID fall-through paths, generic tail, effect-routing order, unknown fallback and concentration helper against HEAD. Earlier commands being dropped by certain exclusive early returns is preserved pre-existing behavior, rather than a new lifecycle repair.
