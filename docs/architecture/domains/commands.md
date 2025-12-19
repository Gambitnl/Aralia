# Commands Domain

The Command Pattern implementation for spell effects and actions.

## Purpose

Encapsulates spell effects and game actions as discrete command objects that can be validated, executed, and composed. Enables the spell system to handle complex multi-effect spells with consistent execution.

## Key Entry Points

| File | Description |
|------|-------------|
| `src/commands/factory/SpellCommandFactory.ts` | Creates spell commands from JSON spell definitions |
| `src/commands/base/CommandExecutor.ts` | Executes command sequences with validation |
| `src/commands/index.ts` | Public exports |

## Subcomponents

### Base Classes
| File | Purpose |
|------|---------|
| `src/commands/base/BaseEffectCommand.ts` | Abstract base for all effect commands |
| `src/commands/base/CommandExecutor.ts` | Executes and coordinates command sequences |
| `src/commands/base/SpellCommand.ts` | Spell-specific command base |

### Effect Commands
| File | Purpose |
|------|---------|
| `src/commands/effects/DamageCommand.ts` | Deals damage to targets |
| `src/commands/effects/HealingCommand.ts` | Heals targets |
| `src/commands/effects/DefensiveCommand.ts` | Applies defensive buffs (AC, resistances) |
| `src/commands/effects/MovementCommand.ts` | Forces movement (push, pull, teleport) |
| `src/commands/effects/StatusConditionCommand.ts` | Applies conditions (blinded, prone, etc.) |
| `src/commands/effects/SummoningCommand.ts` | Summons creatures or objects |
| `src/commands/effects/TerrainCommand.ts` | Creates or modifies terrain |
| `src/commands/effects/UtilityCommand.ts` | Miscellaneous utility effects |
| `src/commands/effects/ConcentrationCommands.ts` | Concentration-specific handling |
| `src/commands/effects/NarrativeCommand.ts` | Narrative/flavor effects |
| `src/commands/effects/ReactiveEffectCommand.ts` | Triggered/reactive effects |
| `src/commands/effects/RegisterRiderCommand.ts` | Attack rider registration |

### Factory
| File | Purpose |
|------|---------|
| `src/commands/factory/SpellCommandFactory.ts` | Builds commands from spell JSON |

## Tests

| Test File | Covers |
|-----------|--------|
| `src/commands/__tests__/CommandExecutor.test.ts` | Command execution |
| `src/commands/__tests__/Concentration.test.ts` | Concentration mechanics |
| `src/commands/__tests__/DefensiveCommand.test.ts` | Defensive effects |
| `src/commands/__tests__/HealingCommand.test.ts` | Healing effects |
| `src/commands/__tests__/LightMechanics.test.ts` | Light/darkness effects |
| `src/commands/__tests__/MovementCommand.test.ts` | Forced movement |
| `src/commands/__tests__/SpellCommandFactory.test.ts` | Factory building |
| `src/commands/__tests__/StatusConditionCommand.test.ts` | Conditions |
| `src/commands/__tests__/SummoningCommand.test.ts` | Summoning |
| `src/commands/__tests__/UtilityCommand.test.ts` | Utility effects |
| `src/commands/effects/__tests__/DamageCommand.test.ts` | Damage calculations |
| `src/commands/effects/__tests__/ReactiveEffectCommand.test.ts` | Reactive effects |
| `src/commands/factory/__tests__/SpellCommandFactoryAI.test.ts` | AI integration |

## Dependencies

- **Imports from:** `src/types/spells.ts`, `src/utils/combatUtils.ts`
- **Imported by:** `src/hooks/combat/`, spell resolution systems

## Boundaries

### Owned by this domain
- All files in `src/commands/`

### Shared (modify with care)
- `src/types/spells.ts` - shared with Spells domain

### DO NOT MODIFY
- `src/utils/combatUtils.ts` - owned by Combat domain
