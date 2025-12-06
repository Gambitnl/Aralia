# Agent Prompts: Stub Command Completion

**Created:** 2025-12-06
**Purpose:** Copy-paste ready prompts for completing stub command implementations
**Parent Task:** [COMPLETE-STUB-COMMANDS.md](COMPLETE-STUB-COMMANDS.md)

---

## Overview

These prompts are designed to be **copied and pasted directly to an AI agent** to complete the stub command implementations discovered during the Phase 1 quality review. Each prompt is self-contained with full context, acceptance criteria, and implementation details.

**Recommended Execution Order:**
1. Day 1: HealingCommand (CRITICAL - needed for combat)
2. Day 2: StatusConditionCommand (CRITICAL - needed for buffs/debuffs)
3. Day 3: DefensiveCommand (HIGH - needed for defensive spells)

---

## Prompt 1: Complete HealingCommand Implementation

**Estimated Time:** 4-6 hours
**Priority:** CRITICAL - Blocker for healing spells

### Copy-Paste Prompt:

```
# Task: Complete HealingCommand Stub Implementation

## Context

During a rapid development session, the HealingCommand was created with a stub implementation that returns "Healing Effect (Stub)" instead of actually healing characters. This is blocking all healing spells (Cure Wounds, Healing Word, etc.) from working.

## Current State

File: src/commands/effects/HealingCommand.ts

The command currently returns a stub description and does not implement any healing logic.

## Your Mission

Replace the stub implementation with full working healing logic that:
1. Parses dice strings (e.g., "1d8", "2d4+3", "4d8+5")
2. Rolls healing dice and calculates total healing
3. Applies healing to target characters (capped at maxHP)
4. Creates combat log entries
5. Handles multiple targets if needed

## Reference Implementation

Use DamageCommand.ts as a reference - it has the correct pattern for:
- Type guards (isDamageEffect)
- Rolling dice
- Updating character state
- Adding combat log entries
- Handling multiple targets

## Acceptance Criteria

### 1. Dice Parsing & Rolling

Implement a `rollHealing(diceString: string): number` method that:
- Parses dice notation: "NdX+M" or "NdX"
- Examples: "1d8" → 1-8, "2d4+3" → 5-11, "4d8+5" → 9-37
- Returns 0 for invalid dice strings with a warning

### 2. Healing Application

Implement `execute(state: CombatState): CombatState` that:
- Uses type guard: `if (!isHealingEffect(this.effect)) return state`
- Iterates over all targets: `for (const target of this.getTargets(currentState))`
- Rolls healing: `const healingRoll = this.rollHealing(this.effect.healing.dice)`
- Calculates new HP: `const newHP = Math.min(target.stats.maxHP, target.currentHP + healingRoll)`
- Updates character: `currentState = this.updateCharacter(currentState, target.id, { currentHP: newHP })`

### 3. Combat Log Entry

Add informative log entry:
```typescript
currentState = this.addLogEntry(currentState, {
  type: 'heal',
  message: `${target.name} is healed for ${healingRoll} HP (${target.currentHP} → ${newHP})`,
  characterId: target.id,
  data: { value: healingRoll }
})
```

### 4. Description Method

Update `get description()` to return meaningful text:
```typescript
get description(): string {
  if (isHealingEffect(this.effect)) {
    return `Heals ${this.effect.healing.dice} HP`
  }
  return 'Heals HP'
}
```

## Implementation Steps

1. Read the current HealingCommand.ts file
2. Read DamageCommand.ts to understand the pattern (it has the correct implementation style)
3. Import necessary types (isHealingEffect from '../../types/spells')
4. Implement rollHealing() method with dice parsing
5. Implement execute() method following DamageCommand pattern
6. Update description() getter
7. Run any existing tests
8. Test manually with a Cure Wounds spell JSON

## Test Cases to Verify

Create or run tests that verify:
1. **Dice parsing**: "1d8" rolls 1-8, "2d4+3" rolls 5-11
2. **HP cap**: Healing a character at 8/10 HP for 5 damage results in 10/10 HP (not 13/10)
3. **Combat log**: Healing generates a log entry with correct format
4. **Multiple targets**: If spell targets multiple characters, all are healed
5. **Invalid dice**: Malformed dice string returns 0 with warning

## Example Spell to Test With

```json
{
  "id": "cure-wounds",
  "name": "Cure Wounds",
  "level": 1,
  "school": "Evocation",
  "effects": [
    {
      "type": "HEALING",
      "healing": {
        "dice": "1d8"
      },
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" }
    }
  ]
}
```

## Success Criteria

- [ ] HealingCommand.ts no longer returns "Stub" text
- [ ] rollHealing() method parses all common dice formats
- [ ] execute() method heals targets correctly
- [ ] Healing is capped at maxHP
- [ ] Combat log entries are created
- [ ] All tests pass
- [ ] Cure Wounds spell works in actual gameplay

## Files to Modify

- `src/commands/effects/HealingCommand.ts` (main implementation)

## Files to Reference

- `src/commands/effects/DamageCommand.ts` (pattern to follow)
- `src/types/spells.ts` (type guards: isHealingEffect)
- `src/types/combat.ts` (CombatState, CombatCharacter)
- `src/commands/base/BaseEffectCommand.ts` (base class methods)

## Important Notes

- Use the EXACT same pattern as DamageCommand for consistency
- Don't create new abstractions - keep it simple
- The BaseEffectCommand class provides: getTargets(), updateCharacter(), addLogEntry(), getCaster()
- This is a critical blocker - healing is essential for combat gameplay

## Verification Command

After implementation, verify by:
1. Running existing tests: `npm test HealingCommand`
2. Loading a character in combat
3. Casting Cure Wounds on a damaged character
4. Confirming HP increases and log entry appears
```

---

## Prompt 2: Complete StatusConditionCommand Implementation

**Estimated Time:** 6-8 hours (includes interface updates)
**Priority:** CRITICAL - Blocker for buff/debuff spells

### Copy-Paste Prompt:

```
# Task: Complete StatusConditionCommand Stub Implementation

## Context

During a rapid development session, StatusConditionCommand was created with a stub that returns "Status Condition Effect (Stub)" instead of applying conditions. This blocks ALL status effect spells (Bless, Bane, Sleep, Charm Person, etc.) from working. This is approximately 60% of all spells.

## Current State

File: src/commands/effects/StatusConditionCommand.ts

The command returns stub text and does not track conditions on characters.

## Your Mission

Implement full status condition tracking that:
1. Extends CombatCharacter interface to support conditions array
2. Applies conditions to target characters
3. Tracks duration and source of conditions
4. Creates combat log entries
5. Supports both D&D standard conditions and custom conditions

## Two-Part Implementation

### Part 1: Extend Character State (REQUIRED FIRST)

**File:** src/types/combat.ts

Add to the CombatCharacter interface:

```typescript
export interface CombatCharacter {
  // ... existing fields ...

  // NEW: Status condition tracking
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
  source?: string // Spell ID or effect that caused it
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
  | 'custom' // For spell-specific conditions like "Blessed" or "Baned"
```

**Why this is needed:** Characters currently have no way to store active conditions.

### Part 2: Implement StatusConditionCommand

**File:** src/commands/effects/StatusConditionCommand.ts

## Acceptance Criteria

### 1. Apply Condition to Character

Implement `execute(state: CombatState): CombatState` that:
- Uses type guard: `if (!isStatusConditionEffect(this.effect)) return state`
- Iterates over targets: `for (const target of this.getTargets(currentState))`
- Creates StatusCondition object:
  ```typescript
  const condition: StatusCondition = {
    type: this.effect.condition as ConditionType,
    name: this.effect.conditionName || this.effect.condition,
    duration: this.effect.duration || { type: 'permanent' },
    appliedTurn: currentState.turnState.currentTurn,
    source: this.context.spellName || this.context.spellId
  }
  ```
- Adds to character's conditions array:
  ```typescript
  const existingConditions = target.conditions || []
  currentState = this.updateCharacter(currentState, target.id, {
    conditions: [...existingConditions, condition]
  })
  ```

### 2. Combat Log Entry

Add clear log message:
```typescript
currentState = this.addLogEntry(currentState, {
  type: 'status',
  message: `${target.name} is ${condition.name}`,
  characterId: target.id,
  data: { condition }
})
```

### 3. Description Method

Update to return meaningful text:
```typescript
get description(): string {
  if (isStatusConditionEffect(this.effect)) {
    return `Applies ${this.effect.conditionName || this.effect.condition} condition`
  }
  return 'Applies status condition'
}
```

## Implementation Steps

1. **First**: Update src/types/combat.ts with new interfaces (Part 1)
2. Read the current StatusConditionCommand.ts
3. Read DamageCommand.ts to understand the implementation pattern
4. Import necessary types (isStatusConditionEffect from '../../types/spells')
5. Import new types (StatusCondition, ConditionType from '../../types/combat')
6. Implement execute() method
7. Update description() getter
8. Run any existing tests
9. Test manually with Bless spell

## Test Cases to Verify

1. **Basic condition**: Applying "Blessed" adds to character's conditions array
2. **Duration tracking**: Condition stores appliedTurn and duration
3. **Multiple conditions**: Character can have multiple active conditions
4. **Combat log**: Condition application appears in combat log
5. **Source tracking**: Condition records which spell caused it
6. **Custom conditions**: "custom" type works for spell-specific effects

## Example Spells to Test With

**Bless (custom condition):**
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

**Charm Person (standard condition):**
```json
{
  "id": "charm-person",
  "name": "Charm Person",
  "effects": [
    {
      "type": "STATUS_CONDITION",
      "condition": "charmed",
      "conditionName": "Charmed",
      "duration": { "type": "rounds", "value": 10 },
      "trigger": { "type": "immediate" },
      "condition": {
        "type": "save",
        "saveType": "Wisdom",
        "saveEffect": "none"
      }
    }
  ]
}
```

## Success Criteria

- [ ] src/types/combat.ts extended with StatusCondition interface
- [ ] StatusConditionCommand.ts no longer returns "Stub" text
- [ ] execute() method applies conditions to characters
- [ ] Conditions array is updated correctly
- [ ] Duration and source are tracked
- [ ] Combat log entries created
- [ ] All tests pass
- [ ] Bless spell works and applies "Blessed" condition
- [ ] Standard D&D conditions (charmed, frightened, etc.) work

## Files to Modify

- `src/types/combat.ts` (add StatusCondition interface)
- `src/commands/effects/StatusConditionCommand.ts` (main implementation)

## Files to Reference

- `src/commands/effects/DamageCommand.ts` (pattern to follow)
- `src/types/spells.ts` (StatusConditionEffect type definition)
- `src/commands/base/BaseEffectCommand.ts` (base class methods)

## Important Notes

- **Breaking change**: Adding `conditions?` field to CombatCharacter is backward compatible (optional field)
- Don't worry about condition REMOVAL yet - that's a future task (turn management)
- Focus on APPLYING conditions correctly
- This unblocks 60%+ of spells - very high impact
- The actual mechanical effects of conditions (e.g., advantage/disadvantage) will be handled later in combat resolution

## Verification Command

After implementation:
1. Run tests: `npm test StatusConditionCommand`
2. Load a character in combat
3. Cast Bless on the character
4. Inspect character state - should have conditions array with "Blessed" entry
5. Confirm combat log shows "${name} is Blessed"
```

---

## Prompt 3: Complete DefensiveCommand TODOs

**Estimated Time:** 6-8 hours (includes interface updates)
**Priority:** HIGH - Needed for defensive spells

### Copy-Paste Prompt:

```
# Task: Complete DefensiveCommand TODO Items

## Context

DefensiveCommand exists but has 4 TODO comments indicating missing functionality:
1. AC tracking - Characters can't track AC bonuses
2. Resistance arrays - Characters can't track damage resistances
3. Temp HP - Characters can't store temporary hit points
4. Advantage tracking - Characters can't track advantage on saves

This blocks defensive spells like Shield, Mage Armor, Protection from Energy, False Life, and Bless from working correctly.

## Current State

File: src/commands/effects/DefensiveCommand.ts

The command has method stubs with TODO comments but doesn't actually modify character state because the required fields don't exist on CombatCharacter.

## Your Mission

Extend character state and complete all 4 TODO methods to make defensive spells fully functional.

## Two-Part Implementation

### Part 1: Extend Character State (REQUIRED FIRST)

**File:** src/types/combat.ts

Add to the CombatCharacter interface:

```typescript
export interface CombatCharacter {
  // ... existing fields ...

  // NEW: Defensive tracking
  armorClass?: number      // Current AC (including bonuses)
  baseAC?: number         // Base AC before temporary bonuses
  resistances?: DamageType[]
  immunities?: DamageType[]
  tempHP?: number         // Temporary hit points
  activeEffects?: ActiveEffect[]  // Active spell effects
}

export interface ActiveEffect {
  type: 'ac_bonus' | 'advantage_on_saves' | 'disadvantage_on_attacks' | 'other'
  name: string
  value?: number  // For numeric effects like AC bonus
  duration: {
    type: 'rounds' | 'until_condition' | 'permanent'
    value?: number
  }
  appliedTurn: number
  source: string  // Spell ID or effect name
  description?: string
}

// DamageType should already exist from DamageCommand, but verify it's exported
export type DamageType =
  | 'Acid'
  | 'Bludgeoning'
  | 'Cold'
  | 'Fire'
  | 'Force'
  | 'Lightning'
  | 'Necrotic'
  | 'Piercing'
  | 'Poison'
  | 'Psychic'
  | 'Radiant'
  | 'Slashing'
  | 'Thunder'
```

### Part 2: Complete DefensiveCommand Methods

**File:** src/commands/effects/DefensiveCommand.ts

## Acceptance Criteria

### 1. Complete applyACBonus()

**Current TODO:** "Character needs AC tracking separate from stats"

**Implementation:**
```typescript
private applyACBonus(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
  const bonus = effect.value || 0
  const currentAC = target.armorClass || 10

  // Create active effect for tracking
  const activeEffect: ActiveEffect = {
    type: 'ac_bonus',
    name: `AC Bonus from ${this.context.spellName}`,
    value: bonus,
    duration: effect.duration || { type: 'rounds', value: 1 },
    appliedTurn: state.turnState.currentTurn,
    source: this.context.spellName || this.context.spellId || 'Unknown'
  }

  // Update character state
  const updatedState = this.updateCharacter(state, target.id, {
    armorClass: currentAC + bonus,
    activeEffects: [...(target.activeEffects || []), activeEffect]
  })

  // Log entry
  return this.addLogEntry(updatedState, {
    type: 'status',
    message: `${target.name} gains +${bonus} AC (${currentAC} → ${currentAC + bonus})`,
    characterId: target.id,
    data: { defensiveEffect: effect }
  })
}
```

### 2. Complete applyResistance()

**Current TODO:** "Character needs resistance array"

**Implementation:**
```typescript
private applyResistance(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
  const damageTypes = effect.damageType || []
  const currentResistances = target.resistances || []

  // Add new resistances (avoid duplicates)
  const newResistances = [...currentResistances]
  for (const type of damageTypes) {
    if (!newResistances.includes(type)) {
      newResistances.push(type)
    }
  }

  // Update character
  const updatedState = this.updateCharacter(state, target.id, {
    resistances: newResistances
  })

  // Log entry
  return this.addLogEntry(updatedState, {
    type: 'status',
    message: `${target.name} gains resistance to ${damageTypes.join(', ')}`,
    characterId: target.id,
    data: { defensiveEffect: effect }
  })
}
```

### 3. Complete applyTemporaryHP()

**Current TODO:** "Character needs tempHP field"

**Implementation:**
```typescript
private applyTemporaryHP(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
  const tempHPValue = effect.value || 0
  const currentTempHP = target.tempHP || 0

  // D&D Rule: Temporary HP doesn't stack, take the higher value
  const newTempHP = Math.max(currentTempHP, tempHPValue)

  const updatedState = this.updateCharacter(state, target.id, {
    tempHP: newTempHP
  })

  return this.addLogEntry(updatedState, {
    type: 'status',
    message: `${target.name} gains ${newTempHP} temporary HP`,
    characterId: target.id,
    data: { defensiveEffect: effect }
  })
}
```

### 4. Complete applyAdvantageOnSaves()

**Current TODO:** "Character needs active effect tracking for advantage"

**Implementation:**
```typescript
private applyAdvantageOnSaves(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
  const activeEffect: ActiveEffect = {
    type: 'advantage_on_saves',
    name: `Advantage on saves from ${this.context.spellName}`,
    duration: effect.duration || { type: 'rounds', value: 1 },
    appliedTurn: state.turnState.currentTurn,
    source: this.context.spellName || this.context.spellId || 'Unknown',
    description: effect.description || 'Advantage on saving throws'
  }

  const updatedState = this.updateCharacter(state, target.id, {
    activeEffects: [...(target.activeEffects || []), activeEffect]
  })

  return this.addLogEntry(updatedState, {
    type: 'status',
    message: `${target.name} gains advantage on saving throws`,
    characterId: target.id,
    data: { defensiveEffect: effect }
  })
}
```

### 5. Complete applyImmunity()

**Current stub:** Returns state without doing anything

**Implementation:**
```typescript
private applyImmunity(state: CombatState, target: CombatCharacter, effect: DefensiveEffect): CombatState {
  const damageTypes = effect.damageType || []
  const currentImmunities = target.immunities || []

  // Add new immunities (avoid duplicates)
  const newImmunities = [...currentImmunities]
  for (const type of damageTypes) {
    if (!newImmunities.includes(type)) {
      newImmunities.push(type)
    }
  }

  const updatedState = this.updateCharacter(state, target.id, {
    immunities: newImmunities
  })

  return this.addLogEntry(updatedState, {
    type: 'status',
    message: `${target.name} gains immunity to ${damageTypes.join(', ')}`,
    characterId: target.id,
    data: { defensiveEffect: effect }
  })
}
```

## Implementation Steps

1. **First**: Update src/types/combat.ts with new fields (Part 1)
2. Read current DefensiveCommand.ts to understand structure
3. Read DamageCommand.ts for implementation pattern
4. Import new types (ActiveEffect, DamageType from '../../types/combat')
5. Complete applyACBonus() - remove TODO
6. Complete applyResistance() - remove TODO
7. Complete applyTemporaryHP() - remove TODO
8. Complete applyAdvantageOnSaves() - remove TODO
9. Complete applyImmunity() - currently just returns state
10. Run any existing tests
11. Test manually with Shield, Mage Armor, False Life spells

## Test Cases to Verify

1. **AC Bonus**: Shield spell increases AC by 5
2. **AC Tracking**: Active effect records AC bonus with duration
3. **Resistance**: Protection from Energy adds resistance to fire damage
4. **No duplicate resistances**: Applying fire resistance twice doesn't create duplicates
5. **Temp HP (higher)**: Character with 5 temp HP receiving 10 temp HP gets 10 (not 15)
6. **Temp HP (lower)**: Character with 10 temp HP receiving 5 temp HP keeps 10
7. **Advantage**: Bless grants advantage on saves
8. **Immunity**: Immunity spell prevents damage of specific type

## Example Spells to Test With

**Shield (+5 AC):**
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

**False Life (temp HP):**
```json
{
  "id": "false-life",
  "name": "False Life",
  "effects": [
    {
      "type": "DEFENSIVE",
      "defenseType": "temporary_hp",
      "value": 8,
      "duration": { "type": "rounds", "value": 10 },
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" }
    }
  ]
}
```

**Protection from Energy (resistance):**
```json
{
  "id": "protection-from-energy",
  "name": "Protection from Energy",
  "effects": [
    {
      "type": "DEFENSIVE",
      "defenseType": "resistance",
      "damageType": ["Fire"],
      "duration": { "type": "rounds", "value": 10 },
      "trigger": { "type": "immediate" },
      "condition": { "type": "always" }
    }
  ]
}
```

## Success Criteria

- [ ] src/types/combat.ts extended with defensive fields
- [ ] All 4 TODO comments removed from DefensiveCommand.ts
- [ ] applyACBonus() fully implemented
- [ ] applyResistance() fully implemented
- [ ] applyTemporaryHP() fully implemented
- [ ] applyAdvantageOnSaves() fully implemented
- [ ] applyImmunity() fully implemented
- [ ] All tests pass
- [ ] Shield spell increases AC
- [ ] False Life grants temp HP
- [ ] Protection from Energy grants resistance
- [ ] Temp HP follows D&D rules (higher value wins, doesn't stack)

## Files to Modify

- `src/types/combat.ts` (add defensive tracking fields)
- `src/commands/effects/DefensiveCommand.ts` (complete all TODO methods)

## Files to Reference

- `src/commands/effects/DamageCommand.ts` (implementation pattern)
- `src/types/spells.ts` (DefensiveEffect type definition)
- `src/commands/base/BaseEffectCommand.ts` (base class methods)

## Important Notes

- **Temp HP D&D Rule**: Temporary HP doesn't stack - always take the higher value
- **Resistances**: Don't allow duplicates in the array
- **AC Bonus**: Store both current AC and track the bonus separately via activeEffects
- **Active Effects**: Used for tracking spell effects that have durations
- This unblocks critical defensive spells needed for survival
- The actual application of resistances/immunities in damage calculation happens in DamageCommand - this just tracks them

## Integration Note

After this is complete, you may want to update DamageCommand to respect resistances:
```typescript
// In DamageCommand, before applying damage:
const resistances = target.resistances || []
const immunities = target.immunities || []

if (immunities.includes(this.effect.damage.type)) {
  finalDamage = 0  // Immune
} else if (resistances.includes(this.effect.damage.type)) {
  finalDamage = Math.floor(finalDamage / 2)  // Resistant
}
```

But that's a FUTURE enhancement - focus on DefensiveCommand first.

## Verification Commands

After implementation:
1. Run tests: `npm test DefensiveCommand`
2. Load character in combat with AC 15
3. Cast Shield - verify AC becomes 20
4. Cast False Life (8 temp HP) - verify tempHP field is 8
5. Cast it again - verify tempHP stays 8 (doesn't become 16)
6. Cast Protection from Energy (Fire) - verify resistances includes "Fire"
7. Inspect activeEffects array - should have AC bonus entry
```

---

## Quick Reference: Prompt Usage

### For Task Orchestrators

1. **Copy the entire prompt** from the section above
2. **Paste to your AI agent** (Claude, GPT-4, etc.)
3. **Agent has full context** and can complete the task autonomously
4. **Review the output** when agent reports completion

### Prompt Features

Each prompt includes:
- ✅ Full context and background
- ✅ Current state description
- ✅ Clear acceptance criteria
- ✅ Step-by-step implementation guide
- ✅ Code examples and patterns to follow
- ✅ Test cases to verify
- ✅ Example spell JSON for testing
- ✅ Success checklist
- ✅ Files to modify and reference

### Execution Notes

**Sequential Execution Recommended:**
- Prompt 1 (HealingCommand) has no dependencies - can start immediately
- Prompt 2 (StatusConditionCommand) has no dependencies - can start immediately
- Prompt 3 (DefensiveCommand) has no dependencies - can start immediately

**Parallel Execution Possible:**
All three prompts can be given to different agents simultaneously since they modify different files and have no conflicts.

**Verification:**
After each task, run the verification commands listed in the prompt to confirm success before moving to next task.

---

**Created:** 2025-12-06
**Last Updated:** 2025-12-06
**Parent Task:** [COMPLETE-STUB-COMMANDS.md](COMPLETE-STUB-COMMANDS.md)
**Related:** [00-AGENT-COORDINATION.md](00-AGENT-COORDINATION.md)
