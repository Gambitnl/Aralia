# Task: Complete Stub Command Implementations

**Status:** Ready to Start
**Priority:** HIGH - Blocks production use of spell system
**Phase:** Phase 1 Cleanup
**Estimated Effort:** 2-3 days
**Source:** Document review of 00-AGENT-COORDINATION.md (2025-12-06)

---

## Problem Statement

During the rapid Phase 1 development, several effect commands were created with **stub implementations** that return placeholder text instead of working logic. This was discovered during the coordination document review (2025-12-06).

**Current State:**
- Command architecture is solid ✅
- DamageCommand is fully working ✅
- HealingCommand, StatusConditionCommand, and parts of DefensiveCommand are **literal stubs** ❌

**Impact:**
- Most healing spells cannot work (Cure Wounds, Healing Word, etc.)
- Status effect spells cannot work (Bless, Bane, Sleep, etc.)
- Defensive spells partially broken (Shield, Mage Armor, etc.)

This is a **blocker** for any meaningful spell usage beyond damage-only spells.

---

## Files to Fix

### 1. HealingCommand.ts - CRITICAL ❌

**Current State:**
```typescript
get description(): string {
  return 'Healing Effect (Stub)'
}
```

**Location:** [src/commands/effects/HealingCommand.ts](../../../src/commands/effects/HealingCommand.ts)

**Issues:**
- Returns stub text instead of actual healing logic
- No HP restoration implemented
- No combat log entry

**Required Implementation:**
```typescript
import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState } from '../../types/combat'
import { isHealingEffect } from '../../types/spells'

export class HealingCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    if (!isHealingEffect(this.effect)) {
      console.warn('HealingCommand received non-healing effect')
      return state
    }

    let currentState = state

    for (const target of this.getTargets(currentState)) {
      // 1. Calculate Healing
      const healingRoll = this.rollHealing(this.effect.healing.dice)

      // 2. Apply Healing (cannot exceed maxHP)
      const newHP = Math.min(
        target.stats.maxHP,
        target.currentHP + healingRoll
      )

      currentState = this.updateCharacter(currentState, target.id, {
        currentHP: newHP
      })

      // 3. Log Entry
      currentState = this.addLogEntry(currentState, {
        type: 'heal',
        message: `${target.name} is healed for ${healingRoll} HP (${target.currentHP} → ${newHP})`,
        characterId: target.id,
        data: { value: healingRoll }
      })
    }

    return currentState
  }

  get description(): string {
    if (isHealingEffect(this.effect)) {
      return `Heals ${this.effect.healing.dice} HP`
    }
    return 'Heals HP'
  }

  private rollHealing(diceString: string): number {
    // Parse dice string (e.g., "2d8+3")
    const match = diceString.match(/(\d+)d(\d+)(?:\+(\d+))?/)

    if (!match) {
      console.warn(`Invalid dice string: ${diceString}`)
      return 0
    }

    const [, numDice, dieSize, modifier] = match
    let total = parseInt(modifier || '0', 10)

    for (let i = 0; i < parseInt(numDice, 10); i++) {
      total += Math.floor(Math.random() * parseInt(dieSize, 10)) + 1
    }

    return total
  }
}
```

**Test Spell: Cure Wounds**
```json
{
  "id": "cure-wounds",
  "name": "Cure Wounds",
  "effects": [
    {
      "type": "HEALING",
      "healing": { "dice": "1d8" },
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" }
    }
  ]
}
```

---

### 2. StatusConditionCommand.ts - CRITICAL ❌

**Current State:**
```typescript
get description(): string {
  return 'Status Condition Effect (Stub)'
}
```

**Location:** [src/commands/effects/StatusConditionCommand.ts](../../../src/commands/effects/StatusConditionCommand.ts)

**Issues:**
- Returns stub text instead of applying status
- No condition tracking
- Requires CombatCharacter interface extension

**Required Implementation:**

**Step 1: Update CombatCharacter interface** in [src/types/combat.ts](../../../src/types/combat.ts):
```typescript
export interface CombatCharacter {
  // ... existing fields ...

  // NEW:
  conditions?: StatusCondition[]
}

export interface StatusCondition {
  type: ConditionType
  name: string
  duration: {
    type: 'rounds' | 'until_save' | 'permanent'
    value?: number
    saveType?: AbilityType
    saveDC?: number
  }
  appliedTurn: number
  source?: string // Spell or effect that caused it
}

export type ConditionType =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious'
  | 'exhaustion'
  | 'custom'
```

**Step 2: Implement StatusConditionCommand**:
```typescript
import { BaseEffectCommand } from '../base/BaseEffectCommand'
import { CombatState, StatusCondition } from '../../types/combat'
import { isStatusConditionEffect } from '../../types/spells'

export class StatusConditionCommand extends BaseEffectCommand {
  execute(state: CombatState): CombatState {
    if (!isStatusConditionEffect(this.effect)) {
      console.warn('StatusConditionCommand received non-status effect')
      return state
    }

    let currentState = state

    for (const target of this.getTargets(currentState)) {
      const condition: StatusCondition = {
        type: this.effect.condition as any,
        name: this.effect.conditionName || this.effect.condition,
        duration: this.effect.duration || { type: 'permanent' },
        appliedTurn: currentState.turnState.currentTurn,
        source: this.context.spellName
      }

      const existingConditions = target.conditions || []

      currentState = this.updateCharacter(currentState, target.id, {
        conditions: [...existingConditions, condition]
      })

      currentState = this.addLogEntry(currentState, {
        type: 'status',
        message: `${target.name} is ${condition.name}`,
        characterId: target.id,
        data: { condition }
      })
    }

    return currentState
  }

  get description(): string {
    if (isStatusConditionEffect(this.effect)) {
      return `Applies ${this.effect.conditionName || this.effect.condition} condition`
    }
    return 'Applies status condition'
  }
}
```

**Test Spell: Bless**
```json
{
  "id": "bless",
  "name": "Bless",
  "effects": [
    {
      "type": "STATUS_CONDITION",
      "condition": "custom",
      "conditionName": "Blessed",
      "description": "Add 1d4 to attack rolls and saving throws",
      "duration": { "type": "rounds", "value": 10 },
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" }
    }
  ]
}
```

---

### 3. DefensiveCommand.ts - PARTIAL ⚠️

**Current State:**
- Has structure but 4 TODOs requiring character state additions
- AC tracking not implemented
- Resistance arrays missing
- Temp HP field missing
- Advantage tracking not implemented

**Location:** [src/commands/effects/DefensiveCommand.ts](../../../src/commands/effects/DefensiveCommand.ts)

**Required Changes:**

**Step 1: Update CombatCharacter interface** in [src/types/combat.ts](../../../src/types/combat.ts):
```typescript
export interface CombatCharacter {
  // ... existing fields ...

  // NEW defensive tracking:
  armorClass?: number // Current AC (may include bonuses)
  baseAC?: number // Base AC before bonuses
  resistances?: DamageType[]
  immunities?: DamageType[]
  tempHP?: number
  activeEffects?: ActiveEffect[]
}

export interface ActiveEffect {
  type: 'ac_bonus' | 'advantage_on_saves' | 'disadvantage_on_attacks' | 'other'
  name: string
  value?: number
  duration: {
    type: 'rounds' | 'until_condition' | 'permanent'
    value?: number
  }
  appliedTurn: number
  source: string
}
```

**Step 2: Complete DefensiveCommand**:
```typescript
private applyACBonus(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
  const bonus = effect.value || 0
  const currentAC = target.armorClass || 10

  const activeEffect: ActiveEffect = {
    type: 'ac_bonus',
    name: `AC Bonus from ${this.context.spellName}`,
    value: bonus,
    duration: effect.duration || { type: 'rounds', value: 1 },
    appliedTurn: state.turnState.currentTurn,
    source: this.context.spellName || 'Unknown'
  }

  const updatedState = this.updateCharacter(state, target.id, {
    armorClass: currentAC + bonus,
    activeEffects: [...(target.activeEffects || []), activeEffect]
  })

  return this.addLogEntry(updatedState, {
    type: 'status',
    message: `${target.name} gains +${bonus} AC (${currentAC} → ${currentAC + bonus})`,
    characterId: target.id,
    data: { defensiveEffect: effect }
  })
}

private applyResistance(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
  const damageTypes = effect.damageType || []
  const currentResistances = target.resistances || []

  return this.updateCharacter(state, target.id, {
    resistances: [...currentResistances, ...damageTypes]
  })
}

private applyTemporaryHP(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
  const tempHPValue = effect.value || 0
  const currentTempHP = target.tempHP || 0

  // Temp HP doesn't stack, take the higher value
  const newTempHP = Math.max(currentTempHP, tempHPValue)

  const updatedState = this.updateCharacter(state, target.id, {
    tempHP: newTempHP
  })

  return this.addLogEntry(updatedState, {
    type: 'status',
    message: `${target.name} gains ${newTempHP} temporary HP`,
    characterId: target.id
  })
}

private applyAdvantageOnSaves(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
  const activeEffect: ActiveEffect = {
    type: 'advantage_on_saves',
    name: `Advantage on saves from ${this.context.spellName}`,
    duration: effect.duration || { type: 'rounds', value: 1 },
    appliedTurn: state.turnState.currentTurn,
    source: this.context.spellName || 'Unknown'
  }

  return this.updateCharacter(state, target.id, {
    activeEffects: [...(target.activeEffects || []), activeEffect]
  })
}
```

**Test Spell: Shield**
```json
{
  "id": "shield",
  "name": "Shield",
  "effects": [
    {
      "type": "DEFENSIVE",
      "defenseType": "ac_bonus",
      "value": 5,
      "duration": { "type": "rounds", "value": 1 },
      "trigger": { "type": "reaction" },
      "condition": { "type": "always" }
    }
  ]
}
```

---

## Implementation Order

### Day 1: HealingCommand (HIGHEST PRIORITY)
1. Implement healing calculation logic
2. Add HP restoration with max HP cap
3. Add combat log entries
4. Write unit tests
5. Test with Cure Wounds spell

**Why first:** Healing is essential for any combat encounter. Without it, characters die quickly.

### Day 2: StatusConditionCommand
1. Extend CombatCharacter interface with conditions array
2. Implement condition application
3. Add condition tracking
4. Write unit tests
5. Test with Bless spell

**Why second:** Many control and buff spells depend on this. Blocks a lot of spell variety.

### Day 3: DefensiveCommand
1. Extend CombatCharacter interface with defensive fields
2. Complete all 4 TODO methods
3. Implement AC bonus tracking
4. Implement resistance/immunity arrays
5. Implement temp HP
6. Implement active effects for advantage
7. Write unit tests
8. Test with Shield and Mage Armor

**Why third:** Less critical than healing/conditions but needed for defensive spells.

---

## Testing Checklist

### HealingCommand
- [ ] Unit: Parse dice strings (1d8, 2d4+3, etc.)
- [ ] Unit: Roll healing within valid range
- [ ] Unit: HP capped at maxHP
- [ ] Unit: Combat log entry created
- [ ] Integration: Cure Wounds heals target
- [ ] Integration: Healing Word heals multiple targets

### StatusConditionCommand
- [ ] Unit: Condition added to character
- [ ] Unit: Duration tracked correctly
- [ ] Unit: Multiple conditions stack
- [ ] Unit: Combat log entry created
- [ ] Integration: Bless applies condition
- [ ] Integration: Bane applies condition

### DefensiveCommand
- [ ] Unit: AC bonus applied
- [ ] Unit: Resistance added to array
- [ ] Unit: Temp HP applied (higher value wins)
- [ ] Unit: Active effects tracked
- [ ] Integration: Shield gives +5 AC
- [ ] Integration: Mage Armor sets base AC
- [ ] Integration: False Life gives temp HP

---

## Acceptance Criteria

**All tests pass:**
- [ ] HealingCommand unit tests (5+)
- [ ] StatusConditionCommand unit tests (5+)
- [ ] DefensiveCommand unit tests (8+)
- [ ] Integration tests for all three commands

**Example spells work:**
- [ ] Cure Wounds heals damage
- [ ] Bless applies buff condition
- [ ] Shield increases AC by 5
- [ ] False Life grants temp HP

**No stubs remain:**
- [ ] HealingCommand has real implementation
- [ ] StatusConditionCommand has real implementation
- [ ] DefensiveCommand TODOs removed

**Code quality:**
- [ ] All TypeScript types correct
- [ ] No `any` types used
- [ ] Combat log entries informative
- [ ] Error handling for edge cases

---

## Success Metrics

1. **Zero stub implementations** - All commands have working logic
2. **Core spell categories work** - Healing, buffs, defensive spells all functional
3. **Tests pass** - 18+ tests passing
4. **Production ready** - Can ship basic spell system

---

## Related Tasks

- **Prerequisite:** None - this IS the prerequisite for everything else
- **Blocks:** All spell migration work (cantrips, Level 1, Level 2+)
- **Blocks:** Combat testing with healing
- **Related:** IMPLEMENT-REMAINING-EFFECT-COMMANDS.md (for Movement, Summoning, Terrain, Utility)

---

## Notes

### Why This Is Critical

The rapid development session created excellent **architecture** but left **critical functionality** incomplete. Without healing and status conditions:
- Combat is lethal with no recovery
- 60%+ of spells cannot work (all buffs, debuffs, controls)
- Cannot test real spell usage scenarios

This is a **3-day blocker** that must be completed before:
- Migrating more spells from old format
- Testing combat with spell system
- Demonstrating spell system to stakeholders

### Quality Assurance

Since this work fixes rushed code, **extra care needed:**
1. Review DamageCommand implementation as reference (it's done right)
2. Add comprehensive tests before claiming "done"
3. Validate with real spell JSON examples
4. Check edge cases (maxHP cap, condition stacking, etc.)

---

**Created:** 2025-12-06
**Last Updated:** 2025-12-06
**Priority:** HIGH - BLOCKER
**Estimated Completion:** 2025-12-09 (3 working days)
