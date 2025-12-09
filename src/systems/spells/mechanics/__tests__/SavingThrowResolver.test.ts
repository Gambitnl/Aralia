import { describe, it, expect, vi } from 'vitest'
import { SavingThrowResolver } from '../SavingThrowResolver'
import { DiceRoller } from '../DiceRoller'
import type { CombatCharacter } from '@/types'
import type { SavingThrowAbility } from '@/types/spells'

// Mock character
const mockCharacter: CombatCharacter = {
  id: 'test-char',
  name: 'Test Character',
  level: 1,
  stats: {
    strength: 10,
    dexterity: 14, // Modifier +2
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  }
  // Add other required fields if strictly needed by types, assuming partial mock for now
} as unknown as CombatCharacter

describe('SavingThrowResolver', () => {
  it('should calculate save success correctly', () => {
    // Mock DiceRoller to roll a 10
    vi.spyOn(DiceRoller, 'rollD20').mockReturnValue(10)

    // Dex save: 10 (roll) + 2 (mod) = 12
    const result = SavingThrowResolver.resolveSave(mockCharacter, 'Dexterity', 12)

    expect(result.success).toBe(true)
    expect(result.total).toBe(12)

    vi.restoreAllMocks()
  })

  it('should calculate save failure correctly', () => {
    vi.spyOn(DiceRoller, 'rollD20').mockReturnValue(5)

    // Dex save: 5 (roll) + 2 (mod) = 7
    const result = SavingThrowResolver.resolveSave(mockCharacter, 'Dexterity', 15)

    expect(result.success).toBe(false)
    expect(result.total).toBe(7)

    vi.restoreAllMocks()
  })

  it('should use correct ability modifiers', () => {
     vi.spyOn(DiceRoller, 'rollD20').mockReturnValue(10)

     // Str save: 10 (roll) + 0 (mod) = 10
     const resultStr = SavingThrowResolver.resolveSave(mockCharacter, 'Strength', 10)
     expect(resultStr.total).toBe(10)

     vi.restoreAllMocks()
  })
})
