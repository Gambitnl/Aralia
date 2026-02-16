# Task: Implement Remaining Effect Command Types

**Status:** Completed
**Priority:** Medium
**Phase:** Phase 3 - Advanced Features
**Estimated Effort:** 1 week
*

---

## Completion Log
- 2025-12-08: Implemented teleport destination resolution, AoE-driven terrain marking, and coverage tests; task marked complete.

## Problem Statement

Effect types are **defined in TypeScript** ([src/types/spells.ts:221-389](../../../src/types/spells.ts#L221-L389)) but only **3 of 8 are implemented**:

### Implemented ✅
1. **DamageEffect** → [DamageCommand.ts](../../../src/commands/effects/DamageCommand.ts)
2. **HealingEffect** → [HealingCommand.ts](../../../src/commands/effects/HealingCommand.ts)
3. **StatusConditionEffect** → [StatusConditionCommand.ts](../../../src/commands/effects/StatusConditionCommand.ts)

### Not Implemented ❌
4. **MovementEffect** - Push, pull, teleport, speed changes
5. **SummoningEffect** - Conjure creatures/objects
6. **TerrainEffect** - Create difficult terrain, walls, hazards
7. **UtilityEffect** - Light, communication, detection
8. **DefensiveEffect** - AC bonuses, resistance, immunity

**Impact:** Spells using these effects cannot be implemented (e.g., Thunderwave, Conjure Animals, Wall of Fire, Light, Shield).

---

## Research Reference

See [@SPELL-SYSTEM-RESEARCH.md Section 2.2: Effect Taxonomy](../../architecture/@SPELL-SYSTEM-RESEARCH.md#22-comprehensive-effect-type-taxonomy) for detailed effect definitions.

---

## Acceptance Criteria

### 1. Implement MovementCommand

Create `src/commands/effects/MovementCommand.ts`:

```typescript
import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { MovementEffect } from '@/types/spells'
import { CombatState, Position } from '@/types/combat'

export class MovementCommand extends BaseEffectCommand {
  constructor(
    effect: MovementEffect,
    context: CommandContext
  ) {
    super(effect, context)
  }

  execute(state: CombatState): CombatState {
    const effect = this.effect as MovementEffect
    const targets = this.getTargets(state)
    let newState = state

    for (const target of targets) {
      switch (effect.movementType) {
        case 'push':
          newState = this.applyPush(newState, target, effect)
          break
        case 'pull':
          newState = this.applyPull(newState, target, effect)
          break
        case 'teleport':
          newState = this.applyTeleport(newState, target, effect)
          break
        case 'speed_change':
          newState = this.applySpeedChange(newState, target, effect)
          break
        case 'stop':
          newState = this.applyStop(newState, target, effect)
          break
      }
    }

    return newState
  }

  private applyPush(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
    const caster = this.getCaster(state)
    const distance = effect.distance || 0
    const tiles = Math.floor(distance / 5)

    // Calculate direction away from caster
    const dx = target.position.x - caster.position.x
    const dy = target.position.y - caster.position.y
    const magnitude = Math.sqrt(dx * dx + dy * dy)

    if (magnitude === 0) return state // Same position, can't push

    // Normalize and multiply by tiles
    const newX = target.position.x + Math.round((dx / magnitude) * tiles)
    const newY = target.position.y + Math.round((dy / magnitude) * tiles)

    // TODO: Check if new position is valid (not blocked, not off-map)

    const updatedState = this.updateCharacter(state, target.id, {
      position: { x: newX, y: newY }
    })

    return this.addLogEntry(updatedState, {
      type: 'action',
      message: `${target.name} is pushed ${distance} feet`,
      characterId: target.id
    })
  }

  private applyPull(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
    // Similar to push but toward caster
    // TODO: Implement
    return state
  }

  private applyTeleport(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
    // TODO: Implement - requires UI to select destination
    return state
  }

  private applySpeedChange(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
    if (!effect.speedChange) return state

    const newSpeed = target.stats.speed + effect.speedChange.value

    const updatedState = this.updateCharacter(state, target.id, {
      stats: { ...target.stats, speed: newSpeed }
    })

    return this.addLogEntry(updatedState, {
      type: 'status',
      message: `${target.name}'s speed ${effect.speedChange.value > 0 ? 'increases' : 'decreases'} by ${Math.abs(effect.speedChange.value)} feet`,
      characterId: target.id
    })
  }

  private applyStop(state: CombatState, target: CombatCharacter, effect: MovementEffect): CombatState {
    // Set speed to 0 (Restrained, Paralyzed, etc.)
    return this.updateCharacter(state, target.id, {
      stats: { ...target.stats, speed: 0 }
    })
  }

  get description(): string {
    const effect = this.effect as MovementEffect
    return `${this.context.caster.name} causes ${effect.movementType} movement`
  }
}
```

**Example Spell: Thunderwave**
```json
{
  "effects": [
    {
      "type": "DAMAGE",
      "damage": { "dice": "2d8", "type": "Thunder" },
      "condition": { "type": "save", "saveType": "Constitution", "saveEffect": "half" }
    },
    {
      "type": "MOVEMENT",
      "movementType": "push",
      "distance": 10,
      "condition": { "type": "save", "saveType": "Constitution", "saveEffect": "none" }
    }
  ]
}
```

---

### 2. Implement SummoningCommand

Create `src/commands/effects/SummoningCommand.ts`:

```typescript
export class SummoningCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    const effect = this.effect as SummoningEffect
    const caster = this.getCaster(state)

    // TODO: This requires creature database and enemy/ally spawning system
    // For now, add a placeholder to combat log

    return this.addLogEntry(state, {
      type: 'action',
      message: `${caster.name} summons ${effect.count} ${effect.summonType}(s)`,
      characterId: caster.id,
      data: { summonEffect: effect }
    })
  }

  get description(): string {
    const effect = this.effect as SummoningEffect
    return `${this.context.caster.name} summons ${effect.count} ${effect.summonType}(s)`
  }
}
```

**Note:** Full summoning implementation requires:
- Creature database
- Dynamic character spawning
- AI control for summoned creatures
- This is a **complex feature** - may need separate task

---

### 3. Implement TerrainCommand

Create `src/commands/effects/TerrainCommand.ts`:

```typescript
export class TerrainCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    const effect = this.effect as TerrainEffect

    // TODO: This requires map state modification system
    // BattleMapTile needs to support dynamic terrain effects

    // For now, add to combat log and mark positions
    const affectedTiles = this.calculateTerrainArea(effect)

    return this.addLogEntry(state, {
      type: 'action',
      message: `${this.context.caster.name} creates ${effect.terrainType} terrain`,
      characterId: this.context.caster.id,
      data: {
        terrainEffect: effect,
        affectedPositions: affectedTiles
      }
    })
  }

  private calculateTerrainArea(effect: TerrainEffect): Position[] {
    // Use AoE calculation from IMPLEMENT-AOE-ALGORITHMS task
    // TODO: Import calculateAffectedTiles
    return []
  }

  get description(): string {
    const effect = this.effect as TerrainEffect
    return `${this.context.caster.name} creates ${effect.terrainType} terrain`
  }
}
```

**Note:** Full terrain implementation requires:
- Dynamic BattleMapTile modification
- Visual rendering of terrain effects
- Persistent terrain across turns
- This may need **separate task** for map system update

---

### 4. Implement UtilityCommand

Create `src/commands/effects/UtilityCommand.ts`:

```typescript
export class UtilityCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    const effect = this.effect as UtilityEffect

    // Most utility effects are narrative or UI-based
    // Log to combat log for now

    let message = ''
    switch (effect.utilityType) {
      case 'light':
        message = `${this.context.caster.name} creates a source of light`
        break
      case 'communication':
        message = `${this.context.caster.name} establishes communication`
        break
      case 'detection':
        message = `${this.context.caster.name} detects: ${effect.description}`
        break
      case 'information':
        message = `${this.context.caster.name} gains information: ${effect.description}`
        break
      default:
        message = `${this.context.caster.name}: ${effect.description}`
    }

    return this.addLogEntry(state, {
      type: 'action',
      message,
      characterId: this.context.caster.id,
      data: { utilityEffect: effect }
    })
  }

  get description(): string {
    const effect = this.effect as UtilityEffect
    return `${this.context.caster.name} uses ${effect.utilityType} utility`
  }
}
```

**Example Spell: Light**
```json
{
  "effects": [
    {
      "type": "UTILITY",
      "utilityType": "light",
      "description": "Sheds bright light in a 20-foot radius and dim light for an additional 20 feet",
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" }
    }
  ]
}
```

---

### 5. Implement DefensiveCommand

Create `src/commands/effects/DefensiveCommand.ts`:

```typescript
export class DefensiveCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    const effect = this.effect as DefensiveEffect
    const targets = this.getTargets(state)
    let newState = state

    for (const target of targets) {
      switch (effect.defenseType) {
        case 'ac_bonus':
          newState = this.applyACBonus(newState, target, effect)
          break
        case 'resistance':
          newState = this.applyResistance(newState, target, effect)
          break
        case 'immunity':
          newState = this.applyImmunity(newState, target, effect)
          break
        case 'temporary_hp':
          newState = this.applyTemporaryHP(newState, target, effect)
          break
        case 'advantage_on_saves':
          newState = this.applyAdvantageOnSaves(newState, target, effect)
          break
      }
    }

    return newState
  }

  private applyACBonus(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
    // TODO: Character needs AC tracking separate from stats
    // For now, log to combat log

    return this.addLogEntry(state, {
      type: 'status',
      message: `${target.name} gains +${effect.value} AC bonus`,
      characterId: target.id,
      data: { defensiveEffect: effect }
    })
  }

  private applyResistance(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
    // TODO: Character needs resistance array
    // CombatCharacter interface needs: resistances?: DamageType[]

    return this.addLogEntry(state, {
      type: 'status',
      message: `${target.name} gains resistance to ${effect.damageType?.join(', ')}`,
      characterId: target.id,
      data: { defensiveEffect: effect }
    })
  }

  private applyImmunity(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
    // Similar to resistance
    return state
  }

  private applyTemporaryHP(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
    // TODO: Character needs tempHP field
    // CombatCharacter interface needs: tempHP?: number

    return this.addLogEntry(state, {
      type: 'heal',
      message: `${target.name} gains ${effect.value} temporary HP`,
      characterId: target.id
    })
  }

  private applyAdvantageOnSaves(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
    // TODO: Character needs active effect tracking for advantage
    return state
  }

  get description(): string {
    const effect = this.effect as DefensiveEffect
    return `${this.context.caster.name} grants ${effect.defenseType} defense`
  }
}
```

**Example Spell: Shield**
```json
{
  "effects": [
    {
      "type": "DEFENSIVE",
      "defenseType": "ac_bonus",
      "value": 5,
      "duration": { "type": "rounds", "value": 1 },
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" }
    }
  ]
}
```

---

### 6. Register Commands in Factory

Update [src/commands/factory/SpellCommandFactory.ts](../../../src/commands/factory/SpellCommandFactory.ts):

```typescript
import { MovementCommand } from '../effects/MovementCommand'
import { SummoningCommand } from '../effects/SummoningCommand'
import { TerrainCommand } from '../effects/TerrainCommand'
import { UtilityCommand } from '../effects/UtilityCommand'
import { DefensiveCommand } from '../effects/DefensiveCommand'

private static createCommand(
  effect: SpellEffect,
  context: CommandContext
): SpellCommand | null {
  switch (effect.type) {
    case 'DAMAGE':
      return new DamageCommand(effect, context)
    case 'HEALING':
      return new HealingCommand(effect, context)
    case 'STATUS_CONDITION':
      return new StatusConditionCommand(effect, context)

    // NEW:
    case 'MOVEMENT':
      return new MovementCommand(effect, context)
    case 'SUMMONING':
      return new SummoningCommand(effect, context)
    case 'TERRAIN':
      return new TerrainCommand(effect, context)
    case 'UTILITY':
      return new UtilityCommand(effect, context)
    case 'DEFENSIVE':
      return new DefensiveCommand(effect, context)

    default:
      console.warn(`Unknown effect type: ${(effect as any).type}`)
      return null
  }
}
```

---

## Implementation Priority

### High Priority (Do First)
1. **MovementCommand** - Needed for Thunderwave, Gust of Wind
2. **DefensiveCommand** - Needed for Shield, Mage Armor, Protection from Energy

### Medium Priority
3. **UtilityCommand** - Needed for Light, Detect Magic, Message

### Low Priority (Complex, can defer)
4. **SummoningCommand** - Requires creature system
5. **TerrainCommand** - Requires map modification system

---

## Testing Checklist

### MovementCommand
- [ ] Unit: Push calculation (distance + direction)
- [ ] Unit: Pull calculation
- [ ] Unit: Speed change (increase/decrease)
- [ ] Integration: Thunderwave pushes enemies
- [ ] Integration: Misty Step teleports caster

### DefensiveCommand
- [ ] Unit: AC bonus tracking
- [ ] Unit: Resistance application
- [ ] Unit: Temporary HP
- [ ] Integration: Shield gives +5 AC
- [ ] Integration: Mage Armor sets base AC

### UtilityCommand
- [ ] Unit: Light effect logged
- [ ] Unit: Detection effect logged
- [ ] Integration: Light spell in combat log

### SummoningCommand
- [ ] Unit: Summon event logged
- [ ] Integration: (Defer until creature system exists)

### TerrainCommand
- [ ] Unit: Terrain area calculation
- [ ] Integration: (Defer until map modification exists)

---

## Success Metrics

1. All 8 effect types have command implementations
2. MovementCommand works for push/pull/teleport
3. DefensiveCommand works for AC/resistance/temp HP
4. UtilityCommand logs narrative effects
5. SummoningCommand and TerrainCommand have placeholder implementations
6. All tests pass (unit + integration)

---

## Related Tasks

- **Prerequisite:** IMPLEMENT-AOE-ALGORITHMS.md (for terrain area calculation)
- **Blocks:** Batch conversion of advanced spell types
- **Future:** Full summoning system (separate epic task)
- **Future:** Dynamic terrain modification (separate task)

---

## References

- **Research:** [@SPELL-SYSTEM-RESEARCH.md Section 2.2](../../architecture/@SPELL-SYSTEM-RESEARCH.md#22-comprehensive-effect-type-taxonomy)
- **Type Definitions:** [src/types/spells.ts:221-389](../../../src/types/spells.ts#L221-L389)
- **Existing Commands:** [src/commands/effects/](../../../src/commands/effects/)
- **Command Factory:** [src/commands/factory/SpellCommandFactory.ts](../../../src/commands/factory/SpellCommandFactory.ts)

---

**Created:** 2025-12-05
**Last Updated:** 2025-12-05
**Assignee:** TBD
