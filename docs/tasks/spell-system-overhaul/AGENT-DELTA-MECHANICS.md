# Agent Delta: Game Mechanics Systems

**Module:** Game Mechanics (`src/systems/spells/mechanics/`)
**Estimated Time:** 2 days
**Dependencies:** Agent Alpha (types only)
**Conflicts:** ZERO - You own the `mechanics/` directory exclusively

---

## Objective

Implement core D&D 5e game mechanics: saving throws, concentration tracking, damage resistances, and spell scaling calculations.

---

## Files You Will Create

### Your Directory Structure

```
src/systems/spells/
└── mechanics/
    ├── index.ts                         # Main export file
    ├── SavingThrowResolver.ts           # Saving throw logic
    ├── ConcentrationTracker.ts          # Concentration management
    ├── ResistanceCalculator.ts          # Resistance/vulnerability/immunity
    ├── ScalingEngine.ts                 # Spell upscaling calculations
    ├── DiceRoller.ts                    # Dice rolling utilities
    └── __tests__/
        ├── SavingThrowResolver.test.ts
        ├── ConcentrationTracker.test.ts
        ├── ResistanceCalculator.test.ts
        ├── ScalingEngine.test.ts
        └── DiceRoller.test.ts
```

**FILES YOU MUST NOT TOUCH:**
- ❌ Anything outside `mechanics/` directory
- ❌ Any existing combat files

---

## API Contract (STRICT)

### File: `src/systems/spells/mechanics/index.ts`

**YOU MUST EXPORT EXACTLY THIS:**

```typescript
export { SavingThrowResolver } from './SavingThrowResolver'
export { ConcentrationTracker } from './ConcentrationTracker'
export { ResistanceCalculator } from './ResistanceCalculator'
export { ScalingEngine } from './ScalingEngine'
export { DiceRoller } from './DiceRoller'
```

---

## Implementation Details

### File: `src/systems/spells/mechanics/SavingThrowResolver.ts`

```typescript
import type { SavingThrow } from '@/systems/spells/types'
import type { CombatCharacter } from '@/types'
import { DiceRoller } from './DiceRoller'

/**
 * Result of a saving throw
 */
export interface SavingThrowResult {
  /** Whether the save succeeded */
  success: boolean
  /** Raw d20 roll (1-20) */
  roll: number
  /** Total after modifiers */
  total: number
  /** DC that was rolled against */
  dc: number
}

/**
 * Resolves saving throw outcomes
 */
export class SavingThrowResolver {
  /**
   * Roll a saving throw for a character
   *
   * @param character - Target making the save
   * @param saveType - Ability to save with (e.g., "Dexterity")
   * @param dc - Difficulty class
   * @returns Save result with success/failure
   *
   * @example
   * const result = SavingThrowResolver.resolveSave(
   *   goblin,
   *   'Dexterity',
   *   15
   * )
   * console.log(result.success) // true if rolled >= 15
   */
  static resolveSave(
    character: CombatCharacter,
    saveType: SavingThrow,
    dc: number
  ): SavingThrowResult {
    const roll = DiceRoller.rollD20()
    const modifier = this.getSaveModifier(character, saveType)
    const total = roll + modifier

    return {
      success: total >= dc,
      roll,
      total,
      dc
    }
  }

  /**
   * Get saving throw modifier for a character
   *
   * Modifier = ability modifier + proficiency (if proficient)
   */
  private static getSaveModifier(
    character: CombatCharacter,
    saveType: SavingThrow
  ): number {
    const abilityScore = this.getAbilityScore(character, saveType)
    const abilityModifier = Math.floor((abilityScore - 10) / 2)

    // TODO: Check if proficient in this save
    // For now, assume not proficient
    const proficiency = 0

    return abilityModifier + proficiency
  }

  /**
   * Get ability score for save type
   */
  private static getAbilityScore(
    character: CombatCharacter,
    saveType: SavingThrow
  ): number {
    switch (saveType) {
      case 'Strength':
        return character.stats.strength ?? 10
      case 'Dexterity':
        return character.stats.dexterity ?? 10
      case 'Constitution':
        return character.stats.constitution ?? 10
      case 'Intelligence':
        return character.stats.intelligence ?? 10
      case 'Wisdom':
        return character.stats.wisdom ?? 10
      case 'Charisma':
        return character.stats.charisma ?? 10
      default:
        const exhaustive: never = saveType
        throw new Error(`Unknown save type: ${exhaustive}`)
    }
  }
}
```

### File: `src/systems/spells/mechanics/ConcentrationTracker.ts`

```typescript
import type { Spell } from '@/systems/spells/types'
import type { CombatCharacter, CombatState } from '@/types'
import { DiceRoller } from './DiceRoller'

/**
 * Tracks concentration on spells
 *
 * D&D 5e concentration rules:
 * - Only one concentration spell active per character
 * - Broken by: taking damage, casting another concentration spell, being incapacitated, dying
 * - Concentration save DC = 10 or half damage taken (whichever is higher)
 */
export class ConcentrationTracker {
  /**
   * Check if character is concentrating on a spell
   *
   * @param character - Character to check
   * @param gameState - Current game state
   * @returns True if concentrating
   */
  static isConcentrating(
    character: CombatCharacter,
    gameState: CombatState
  ): boolean {
    // TODO: Check gameState for active concentration
    // For now, stub implementation
    return false
  }

  /**
   * Start concentrating on a spell (breaks existing concentration)
   *
   * @param character - Character concentrating
   * @param spell - Spell to concentrate on
   * @param gameState - Current game state
   * @returns New game state with concentration started
   */
  static startConcentration(
    character: CombatCharacter,
    spell: Spell,
    gameState: CombatState
  ): CombatState {
    // TODO: Implement in Phase 2 (Task 06)
    console.warn('ConcentrationTracker.startConcentration not yet implemented')
    return gameState
  }

  /**
   * Break concentration (e.g., took damage, failed save, chose to drop)
   *
   * @param character - Character whose concentration breaks
   * @param gameState - Current game state
   * @returns New game state with concentration broken
   */
  static breakConcentration(
    character: CombatCharacter,
    gameState: CombatState
  ): CombatState {
    // TODO: Implement in Phase 2 (Task 06)
    console.warn('ConcentrationTracker.breakConcentration not yet implemented')
    return gameState
  }

  /**
   * Roll concentration save after taking damage
   *
   * DC = 10 or half damage taken (whichever is higher)
   *
   * @param character - Character making the save
   * @param damage - Damage taken
   * @returns Save result
   */
  static rollConcentrationSave(
    character: CombatCharacter,
    damage: number
  ): { success: boolean; dc: number; roll: number } {
    const dc = Math.max(10, Math.floor(damage / 2))
    const roll = DiceRoller.rollD20()

    // Constitution save
    const constitutionMod = Math.floor(((character.stats.constitution ?? 10) - 10) / 2)
    const total = roll + constitutionMod

    return {
      success: total >= dc,
      dc,
      roll
    }
  }
}
```

### File: `src/systems/spells/mechanics/ResistanceCalculator.ts`

```typescript
import type { DamageType } from '@/systems/spells/types'
import type { CombatCharacter } from '@/types'

/**
 * Applies damage resistance/vulnerability/immunity
 */
export class ResistanceCalculator {
  /**
   * Calculate final damage after resistances
   *
   * @param baseDamage - Damage before resistances
   * @param damageType - Type of damage
   * @param target - Character taking damage
   * @returns Final damage amount
   *
   * @example
   * // Fire Elemental takes cold damage
   * const finalDamage = ResistanceCalculator.applyResistances(
   *   20,
   *   'Cold',
   *   fireElemental
   * )
   * // Returns 40 (vulnerable to cold)
   */
  static applyResistances(
    baseDamage: number,
    damageType: DamageType,
    target: CombatCharacter
  ): number {
    // Check immunity
    if (this.isImmune(target, damageType)) {
      return 0
    }

    // Check resistance
    if (this.isResistant(target, damageType)) {
      return Math.floor(baseDamage / 2)
    }

    // Check vulnerability
    if (this.isVulnerable(target, damageType)) {
      return baseDamage * 2
    }

    return baseDamage
  }

  /**
   * Check if character is immune to damage type
   */
  private static isImmune(
    character: CombatCharacter,
    damageType: DamageType
  ): boolean {
    // TODO: Read from character.damageImmunities
    return false
  }

  /**
   * Check if character is resistant to damage type
   */
  private static isResistant(
    character: CombatCharacter,
    damageType: DamageType
  ): boolean {
    // TODO: Read from character.damageResistances
    return false
  }

  /**
   * Check if character is vulnerable to damage type
   */
  private static isVulnerable(
    character: CombatCharacter,
    damageType: DamageType
  ): boolean {
    // TODO: Read from character.damageVulnerabilities
    return false
  }
}
```

### File: `src/systems/spells/mechanics/ScalingEngine.ts`

```typescript
import type { ScalingFormula } from '@/systems/spells/types'

/**
 * Handles spell upscaling calculations
 *
 * D&D 5e spells scale in two ways:
 * 1. Slot level: Casting at higher spell slot (e.g., Fireball at 4th level)
 * 2. Character level: Cantrips scale with character level
 */
export class ScalingEngine {
  /**
   * Calculate scaled value for a spell effect
   *
   * @param baseValue - Base dice/value (e.g., "3d6", "10")
   * @param scaling - Scaling formula from spell definition
   * @param castAtLevel - Spell slot level used
   * @param casterLevel - Character level (for cantrips)
   * @returns Scaled value (e.g., "5d6")
   *
   * @example
   * // Fireball cast at 4th level (base 3rd)
   * const scaled = ScalingEngine.scaleEffect(
   *   "8d6",
   *   { type: "slot_level", bonusPerLevel: "+1d6" },
   *   4,
   *   5
   * )
   * // Returns "9d6" (8d6 + 1d6 for 4th level)
   */
  static scaleEffect(
    baseValue: string,
    scaling: ScalingFormula | undefined,
    castAtLevel: number,
    casterLevel: number
  ): string {
    if (!scaling) return baseValue

    if (scaling.type === 'slot_level') {
      return this.scaleBySlotLevel(baseValue, scaling, castAtLevel)
    }

    if (scaling.type === 'character_level') {
      return this.scaleByCharacterLevel(baseValue, scaling, casterLevel)
    }

    return baseValue
  }

  /**
   * Scale by spell slot level (e.g., Fireball)
   */
  private static scaleBySlotLevel(
    baseValue: string,
    scaling: ScalingFormula,
    castAtLevel: number
  ): string {
    // Extract base spell level from context (assume it's in the spell definition)
    // For now, assume baseValue is the spell's base level
    // TODO: Pass base spell level explicitly

    // Parse bonusPerLevel (e.g., "+1d6", "+5")
    const bonusMatch = scaling.bonusPerLevel.match(/([+-]?\d+)(d\d+)?/)
    if (!bonusMatch) return baseValue

    const bonusCount = parseInt(bonusMatch[1])
    const bonusDice = bonusMatch[2] // e.g., "d6"

    // Assume castAtLevel > base level
    const levelsAboveBase = Math.max(0, castAtLevel - 1) // TODO: Get actual base level

    if (bonusDice) {
      // Dice scaling (e.g., "8d6" + "+1d6" per level)
      const baseMatch = baseValue.match(/(\d+)(d\d+)/)
      if (baseMatch) {
        const baseDiceCount = parseInt(baseMatch[1])
        const diceType = baseMatch[2]
        const newDiceCount = baseDiceCount + (bonusCount * levelsAboveBase)
        return `${newDiceCount}${diceType}`
      }
    } else {
      // Flat scaling (e.g., "10" + "+5" per level)
      const baseNumber = parseInt(baseValue)
      if (!isNaN(baseNumber)) {
        return String(baseNumber + (bonusCount * levelsAboveBase))
      }
    }

    return baseValue
  }

  /**
   * Scale by character level (e.g., cantrips)
   *
   * Cantrips scale at levels 5, 11, 17
   */
  private static scaleByCharacterLevel(
    baseValue: string,
    scaling: ScalingFormula,
    casterLevel: number
  ): string {
    // Determine tier
    let tier = 1
    if (casterLevel >= 17) tier = 4
    else if (casterLevel >= 11) tier = 3
    else if (casterLevel >= 5) tier = 2

    // Parse base dice
    const baseMatch = baseValue.match(/(\d+)(d\d+)/)
    if (baseMatch) {
      const baseDiceCount = parseInt(baseMatch[1])
      const diceType = baseMatch[2]
      const newDiceCount = baseDiceCount * tier
      return `${newDiceCount}${diceType}`
    }

    return baseValue
  }
}
```

### File: `src/systems/spells/mechanics/DiceRoller.ts`

```typescript
/**
 * Dice rolling utilities
 */
export class DiceRoller {
  /**
   * Roll a d20 (1-20)
   */
  static rollD20(): number {
    return Math.floor(Math.random() * 20) + 1
  }

  /**
   * Roll dice from a string formula
   *
   * @param formula - Dice formula (e.g., "3d6", "1d8+2")
   * @returns Total rolled
   *
   * @example
   * const damage = DiceRoller.roll("3d6+2")
   * // Returns 5-20 (3d6 + 2)
   */
  static roll(formula: string): number {
    const match = formula.match(/(\d+)d(\d+)(?:([+-]\d+))?/)
    if (!match) {
      // Flat number (e.g., "5")
      const flat = parseInt(formula)
      return isNaN(flat) ? 0 : flat
    }

    const numDice = parseInt(match[1])
    const diceSize = parseInt(match[2])
    const bonus = match[3] ? parseInt(match[3]) : 0

    let total = bonus

    for (let i = 0; i < numDice; i++) {
      total += Math.floor(Math.random() * diceSize) + 1
    }

    return total
  }

  /**
   * Roll with advantage (roll twice, take higher)
   */
  static rollD20Advantage(): { roll: number; rolls: [number, number] } {
    const roll1 = this.rollD20()
    const roll2 = this.rollD20()
    return {
      roll: Math.max(roll1, roll2),
      rolls: [roll1, roll2]
    }
  }

  /**
   * Roll with disadvantage (roll twice, take lower)
   */
  static rollD20Disadvantage(): { roll: number; rolls: [number, number] } {
    const roll1 = this.rollD20()
    const roll2 = this.rollD20()
    return {
      roll: Math.min(roll1, roll2),
      rolls: [roll1, roll2]
    }
  }
}
```

---

## Spell JSON Workflow (NOT Your Responsibility)

You **don't create spell JSON files** - your utilities are used by Agent Gamma's commands.

Your job: Provide **reliable game mechanics** (saves, scaling, resistances, concentration).

### If You Need Test Data

Use simple in-memory objects:

```typescript
const testCharacter: CombatCharacter = {
  id: 'test-wizard',
  name: 'Test Wizard',
  level: 5,
  stats: {
    strength: 10,
    dexterity: 14,
    constitution: 12,
    intelligence: 16,
    wisdom: 10,
    charisma: 8
  }
}

// Test saving throw
const result = SavingThrowResolver.resolveSave(testCharacter, 'Dexterity', 15)
console.log(result.success)
```

**See:** [SPELL-WORKFLOW-QUICK-REF.md](SPELL-WORKFLOW-QUICK-REF.md) for the full spell creation workflow

---

## Testing Requirements

### Unit Test: `src/systems/spells/mechanics/__tests__/ScalingEngine.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { ScalingEngine } from '../ScalingEngine'

describe('ScalingEngine', () => {
  describe('scaleBySlotLevel', () => {
    it('should scale Fireball damage', () => {
      const scaled = ScalingEngine.scaleEffect(
        '8d6',
        { type: 'slot_level', bonusPerLevel: '+1d6' },
        4, // Cast at 4th level
        5  // Caster level
      )

      // Base 8d6 + 1d6 for 4th level
      expect(scaled).toBe('9d6')
    })

    it('should handle flat scaling', () => {
      const scaled = ScalingEngine.scaleEffect(
        '10',
        { type: 'slot_level', bonusPerLevel: '+5' },
        3,
        5
      )

      expect(scaled).toBe('20') // 10 + (5 * 2)
    })
  })

  describe('scaleByCharacterLevel', () => {
    it('should scale cantrips at level 5', () => {
      const scaled = ScalingEngine.scaleEffect(
        '1d10',
        { type: 'character_level', bonusPerLevel: '' },
        0,
        5
      )

      expect(scaled).toBe('2d10')
    })

    it('should scale cantrips at level 11', () => {
      const scaled = ScalingEngine.scaleEffect(
        '1d10',
        { type: 'character_level', bonusPerLevel: '' },
        0,
        11
      )

      expect(scaled).toBe('3d10')
    })
  })
})
```

---

## Acceptance Criteria

- [ ] SavingThrowResolver calculates saves with modifiers
- [x] ConcentrationTracker (`breakConcentration` implemented, others pending)
- [ ] ResistanceCalculator applies resistance/vulnerability/immunity
- [ ] ScalingEngine scales by slot level and character level
- [ ] DiceRoller rolls dice with advantage/disadvantage
- [ ] Unit tests pass (>80% coverage)
- [ ] TypeScript compiles with zero errors
- [ ] No modifications to files outside `mechanics/`

---

## Integration Points

**Agent Gamma (Commands) will use your code:**

```typescript
import { ScalingEngine, SavingThrowResolver, ResistanceCalculator } from '@/systems/spells/mechanics'
```

---

## Definition of "Done"

1. ✅ All files created
2. ✅ All classes export correct APIs
3. ✅ Tests pass
4. ✅ Agent Gamma can use your utilities
5. ✅ PR merged to `task/spell-system-mechanics` branch

---

## Estimated Timeline

- **Day 1 (8h):** SavingThrowResolver, DiceRoller, ScalingEngine
- **Day 2 (6h):** ResistanceCalculator, ConcentrationTracker stub, tests
- **Buffer:** 2h

**Total:** 16 hours over 2 days

---

**Last Updated:** November 28, 2025
