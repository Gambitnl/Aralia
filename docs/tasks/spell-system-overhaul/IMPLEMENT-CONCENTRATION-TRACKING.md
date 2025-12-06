# Task: Implement Concentration Tracking System

**Status:** Not Started
**Priority:** High
**Phase:** Phase 2 - Core Mechanics
**Estimated Effort:** 2-3 days
**Source:** Identified in @SPELL-SYSTEM-RESEARCH.md review (2025-12-05)

---

## Problem Statement

D&D 5e concentration mechanics are **defined in types but not enforced** in combat:

- Spells have `duration.concentration: boolean` field ([src/types/spells.ts:151](../../../src/types/spells.ts#L151))
- No system prevents casting multiple concentration spells simultaneously
- No damage → concentration check mechanism exists
- Active concentration spells not tracked in character state

**Impact:** Players can maintain unlimited concentration spells, breaking D&D 5e rules.

---

## D&D 5e Concentration Rules

From [@SPELL-SYSTEM-RESEARCH.md Section 2.3.3](../../architecture/@SPELL-SYSTEM-RESEARCH.md#233-concentration-tracking):

### Rule 1: Only One Concentration Spell
- Casting a new concentration spell **ends** the previous one
- No exceptions

### Rule 2: Damage Breaks Concentration
- Taking damage triggers **Constitution saving throw**
- DC = **10 or half damage taken, whichever is higher**
- Failure → spell ends immediately

### Rule 3: Voluntary End
- Can drop concentration as a **free action** on your turn
- Some spells require action to maintain (rare)

---

## Current State Analysis

### Types Already Defined ✅

[src/types/combat.ts](../../../src/types/combat.ts):
```typescript
export interface CombatCharacter {
  // ... existing fields
  // NEED TO ADD:
  concentratingOn?: ConcentrationState
}
```

[src/types/spells.ts:147-152](../../../src/types/spells.ts#L147-L152):
```typescript
export interface Duration {
  type: "instantaneous" | "timed" | "special" | "until_dispelled" | "until_dispelled_or_triggered";
  value?: number;
  unit?: "round" | "minute" | "hour" | "day";
  concentration: boolean; // Already exists!
}
```

### What's Missing ❌

1. `ConcentrationState` interface
2. Concentration tracking in `CombatCharacter`
3. Logic to break concentration when casting new spell
4. Damage → concentration save logic
5. UI to show active concentration
6. Command to drop concentration

---

## Acceptance Criteria

### 1. Define Concentration Types

Add to [src/types/combat.ts](../../../src/types/combat.ts):

```typescript
export interface ConcentrationState {
  spellId: string
  spellName: string
  spellLevel: number // slot level used to cast
  startedTurn: number // which combat turn it started
  effectIds: string[] // IDs of active effects tied to this concentration
  canDropAsFreeAction: boolean // usually true
}

export interface CombatCharacter {
  // ... existing fields
  concentratingOn?: ConcentrationState
}
```

### 2. Update SpellCommandFactory

Modify [src/commands/factory/SpellCommandFactory.ts](../../../src/commands/factory/SpellCommandFactory.ts):

```typescript
static createCommands(
  spell: Spell,
  caster: CombatCharacter,
  targets: CombatCharacter[],
  castAtLevel: number,
  gameState: GameState
): SpellCommand[] {
  const commands: SpellCommand[] = []

  // NEW: Check if spell requires concentration
  if (spell.duration.concentration) {
    // If caster already concentrating, add BreakConcentrationCommand first
    if (caster.concentratingOn) {
      commands.push(new BreakConcentrationCommand(caster, context))
    }

    // Add StartConcentrationCommand after spell effects
    // This will be added at the end
  }

  // ... existing effect command creation

  // NEW: Add concentration tracking
  if (spell.duration.concentration) {
    commands.push(new StartConcentrationCommand(spell, caster, context))
  }

  return commands
}
```

### 3. Create Concentration Commands

Create `src/commands/effects/ConcentrationCommands.ts`:

```typescript
import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState, ConcentrationState } from '@/types/combat'
import { Spell } from '@/types/spells'

export class StartConcentrationCommand extends BaseEffectCommand {
  constructor(
    private spell: Spell,
    protected context: CommandContext
  ) {
    super({ type: 'UTILITY' } as any, context) // Utility effect type
  }

  execute(state: CombatState): CombatState {
    const caster = this.getCaster(state)

    const concentrationState: ConcentrationState = {
      spellId: this.spell.id,
      spellName: this.spell.name,
      spellLevel: this.context.castAtLevel,
      startedTurn: state.turnState.currentTurn,
      effectIds: [], // TODO: Track which effects are tied to concentration
      canDropAsFreeAction: true
    }

    const updatedState = this.updateCharacter(state, caster.id, {
      concentratingOn: concentrationState
    })

    return this.addLogEntry(updatedState, {
      type: 'status',
      message: `${caster.name} begins concentrating on ${this.spell.name}`,
      characterId: caster.id
    })
  }

  get description(): string {
    return `${this.context.caster.name} starts concentrating on ${this.spell.name}`
  }
}

export class BreakConcentrationCommand extends BaseEffectCommand {
  constructor(
    protected context: CommandContext
  ) {
    super({ type: 'UTILITY' } as any, context)
  }

  execute(state: CombatState): CombatState {
    const caster = this.getCaster(state)

    if (!caster.concentratingOn) {
      return state // Nothing to break
    }

    const previousSpell = caster.concentratingOn.spellName

    // TODO: Remove all active effects tied to this concentration
    // This requires tracking effectIds in ConcentrationState

    const updatedState = this.updateCharacter(state, caster.id, {
      concentratingOn: undefined
    })

    return this.addLogEntry(updatedState, {
      type: 'status',
      message: `${caster.name} stops concentrating on ${previousSpell}`,
      characterId: caster.id
    })
  }

  get description(): string {
    return `${this.context.caster.name} breaks concentration`
  }
}
```

### 4. Add Concentration Save Logic

Create `src/utils/concentrationUtils.ts`:

```typescript
import { CombatCharacter } from '@/types/combat'

export function calculateConcentrationDC(damageDealt: number): number {
  return Math.max(10, Math.floor(damageDealt / 2))
}

export function rollConcentrationSave(character: CombatCharacter): number {
  // Constitution saving throw
  const constitutionMod = Math.floor((character.stats.constitution - 10) / 2)
  const roll = Math.floor(Math.random() * 20) + 1
  return roll + constitutionMod
}

export function checkConcentration(
  character: CombatCharacter,
  damageDealt: number
): { success: boolean; dc: number; roll: number } {
  const dc = calculateConcentrationDC(damageDealt)
  const roll = rollConcentrationSave(character)

  return {
    success: roll >= dc,
    dc,
    roll
  }
}
```

### 5. Update DamageCommand

Modify [src/commands/effects/DamageCommand.ts](../../../src/commands/effects/DamageCommand.ts):

```typescript
import { checkConcentration } from '../../utils/concentrationUtils'
import { BreakConcentrationCommand } from './ConcentrationCommands'

export class DamageCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    // ... existing damage logic

    for (const target of targets) {
      const damage = calculateDamage(/* ... */)

      // Apply damage
      let newState = this.updateCharacter(state, target.id, {
        currentHP: Math.max(0, target.currentHP - damage)
      })

      // NEW: Check concentration if target is concentrating
      if (target.concentratingOn) {
        const concentrationCheck = checkConcentration(target, damage)

        if (!concentrationCheck.success) {
          // Break concentration
          const breakCommand = new BreakConcentrationCommand({
            ...this.context,
            caster: target
          })
          newState = breakCommand.execute(newState)

          newState = this.addLogEntry(newState, {
            type: 'status',
            message: `${target.name} fails concentration save (${concentrationCheck.roll} vs DC ${concentrationCheck.dc})`,
            characterId: target.id
          })
        } else {
          newState = this.addLogEntry(newState, {
            type: 'status',
            message: `${target.name} maintains concentration (${concentrationCheck.roll} vs DC ${concentrationCheck.dc})`,
            characterId: target.id
          })
        }
      }

      state = newState
    }

    return state
  }
}
```

### 6. Add Voluntary Drop Action

Add to [src/hooks/useAbilitySystem.ts](../../../src/hooks/useAbilitySystem.ts):

```typescript
const dropConcentration = useCallback((character: CombatCharacter) => {
  if (!character.concentratingOn) return

  const breakCommand = new BreakConcentrationCommand({
    spellId: character.concentratingOn.spellId,
    spellName: character.concentratingOn.spellName,
    castAtLevel: character.concentratingOn.spellLevel,
    caster: character,
    targets: [],
    gameState: {} as any
  })

  const newState = breakCommand.execute(combatState)
  dispatch({ type: 'UPDATE_COMBAT_STATE', payload: newState })
}, [combatState, dispatch])

return {
  // ... existing exports
  dropConcentration
}
```

### 7. UI Indicator

Add concentration indicator to character status in BattleMap:

```typescript
// In BattleMap.tsx or CharacterToken component
{character.concentratingOn && (
  <div className="concentration-indicator" title={`Concentrating on ${character.concentratingOn.spellName}`}>
    🔮 {/* or custom icon */}
  </div>
)}
```

---

## Implementation Steps

1. **Add `ConcentrationState` interface** to [src/types/combat.ts](../../../src/types/combat.ts)

2. **Create `ConcentrationCommands.ts`**
   - `StartConcentrationCommand`
   - `BreakConcentrationCommand`

3. **Create `concentrationUtils.ts`**
   - `calculateConcentrationDC()`
   - `rollConcentrationSave()`
   - `checkConcentration()`

4. **Update `SpellCommandFactory.ts`**
   - Check `spell.duration.concentration`
   - Add concentration commands

5. **Update `DamageCommand.ts`**
   - Check if target is concentrating
   - Roll concentration save
   - Break concentration on failure

6. **Add `dropConcentration()` to `useAbilitySystem.ts`**
   - Expose to UI
   - Allow voluntary drop

7. **Write Unit Tests**
   - Test concentration save calculation
   - Test break on new spell
   - Test break on damage
   - Test voluntary drop

8. **Add UI Indicator**
   - Visual feedback for active concentration
   - Button to drop concentration

9. **Integration Testing**
   - Cast Bless (concentration), then cast Shield (not concentration) → Bless continues
   - Cast Bless, then cast Haste (concentration) → Bless ends, Haste starts
   - Cast Bless, take 10 damage → roll Con save vs DC 10
   - Cast Bless, take 30 damage → roll Con save vs DC 15

---

## Testing Checklist

- [ ] Unit: Concentration DC calculation (10 vs half damage)
- [ ] Unit: Constitution save roll includes modifier
- [ ] Unit: New concentration spell breaks old one
- [ ] Unit: Non-concentration spell doesn't break concentration
- [ ] Integration: Bless + Shield scenario
- [ ] Integration: Bless + Haste scenario
- [ ] Integration: Damage breaks concentration (fail save)
- [ ] Integration: Damage doesn't break concentration (pass save)
- [ ] Integration: Voluntary drop
- [ ] UI: Concentration indicator visible
- [ ] UI: Drop concentration button works

---

## Success Metrics

1. Only one concentration spell active per character
2. Concentration saves work correctly (DC = max(10, damage/2))
3. UI clearly shows concentration status
4. Combat log records concentration events
5. All D&D 5e concentration rules enforced

---

## Related Tasks

- **After Completion:** Update spell effect tracking to tie to concentration
- **Blocked By:** None (can start immediately)
- **Blocks:** Proper spell duration enforcement

---

## References

- **Research:** [@SPELL-SYSTEM-RESEARCH.md Section 2.3.3](../../architecture/@SPELL-SYSTEM-RESEARCH.md#233-concentration-tracking)
- **D&D 5e Rules:** [How Concentration Works](https://www.dndbeyond.com/posts/1224-how-concentration-works-in-dungeons-dragons)
- **Current Types:** [src/types/spells.ts:147-152](../../../src/types/spells.ts#L147-L152)
- **Command Pattern:** [src/commands/](../../../src/commands/)

---

**Created:** 2025-12-05
**Last Updated:** 2025-12-05
**Assignee:** TBD
