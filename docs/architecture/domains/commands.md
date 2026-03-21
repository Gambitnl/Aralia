# Commands Domain

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
- src/commands/__tests__/UtilityCommand.test.ts
- src/commands/effects/__tests__/DamageCommand.test.ts
- src/commands/effects/__tests__/ReactiveEffectCommand.test.ts
- src/commands/factory/__tests__/SpellCommandFactoryAI.test.ts

## Dependencies And Boundaries

### Owned by this domain

- src/commands/

### Shared dependencies that matter during edits

- src/types/spells.ts
- src/types/combat.ts
- src/utils/combatUtils.ts
- src/systems/combat/AttackRiderSystem.ts

### Boundary note

This domain is reusable infrastructure, but it is not isolated from combat. AbilityCommandFactory.ts already reaches into combat-specific helpers and rider systems, so changes here should be treated as command-plus-combat work rather than as a purely standalone execution layer.

## Current Interpretation

Re-verified on 2026-03-11.
The previous version of this doc had drifted by describing the command lane mainly as spell-effect plumbing. The current repo shape shows a broader command system that now sits between spell data, combat abilities, shared effect mapping, and downstream combat systems.
