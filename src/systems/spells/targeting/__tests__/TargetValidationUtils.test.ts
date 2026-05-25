import { describe, it, expect } from 'vitest'
import { TargetValidationUtils } from '../TargetValidationUtils'
import { CombatCharacter } from '@/types/combat'
import { TargetConditionFilter } from '@/types/spells'
import { createMockCombatCharacter } from '@/utils/factories'

describe('TargetValidationUtils', () => {
  it('passes generic filters with no special identity constraints', () => {
    const character = createMockCombatCharacter({ currentHP: 10 })
    const filter: TargetConditionFilter = {
      willing: "not_applicable",
    }
    expect(TargetValidationUtils.matchesFilter(character, filter)).toBe(true)
  })

  it('rejects living characters when corpseOrRemains is required', () => {
    const livingChar = createMockCombatCharacter({ currentHP: 10 })
    const filter: TargetConditionFilter = {
      willing: "not_applicable",
      specialIdentity: {
        corpseOrRemains: "required"
      }
    }
    expect(TargetValidationUtils.matchesFilter(livingChar, filter)).toBe(false)
  })

  it('accepts dead characters when corpseOrRemains is required', () => {
    const deadChar = createMockCombatCharacter({ currentHP: 0 })
    const filter: TargetConditionFilter = {
      willing: "not_applicable",
      specialIdentity: {
        corpseOrRemains: "required"
      }
    }
    expect(TargetValidationUtils.matchesFilter(deadChar, filter)).toBe(true)
  })
})
