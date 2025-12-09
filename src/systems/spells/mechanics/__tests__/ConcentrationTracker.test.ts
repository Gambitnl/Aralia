import { describe, it, expect, vi } from 'vitest'
import { ConcentrationTracker } from '../ConcentrationTracker'
import { DiceRoller } from '../DiceRoller'
import type { CombatCharacter, CombatState } from '@/types'

const mockCharacter: CombatCharacter = {
    stats: {
        constitution: 14 // Modifier +2
    },
    concentratingOn: undefined
} as unknown as CombatCharacter

describe('ConcentrationTracker', () => {
  describe('rollConcentrationSave', () => {
    it('should calculate DC based on damage (half damage)', () => {
        // Damage 30 -> DC 15
        // Roll 10 -> Total 12 (10 + 2) -> Fail
        vi.spyOn(DiceRoller, 'rollD20').mockReturnValue(10)

        const result = ConcentrationTracker.rollConcentrationSave(mockCharacter, 30)

        expect(result.dc).toBe(15)
        expect(result.success).toBe(false)
        vi.restoreAllMocks()
    })

    it('should use minimum DC of 10', () => {
        // Damage 4 -> Half is 2, but min DC is 10
        // Roll 10 -> Total 12 -> Success
        vi.spyOn(DiceRoller, 'rollD20').mockReturnValue(10)

        const result = ConcentrationTracker.rollConcentrationSave(mockCharacter, 4)

        expect(result.dc).toBe(10)
        expect(result.success).toBe(true)
        vi.restoreAllMocks()
    })
  })

  describe('isConcentrating', () => {
    it('should return true if character has concentratingOn object', () => {
        const concentratingChar = {
            ...mockCharacter,
            concentratingOn: { spellId: '1', spellName: 'Bless' }
        } as unknown as CombatCharacter

        expect(ConcentrationTracker.isConcentrating(concentratingChar, {} as CombatState)).toBe(true)
    })

    it('should return false if character has undefined concentratingOn', () => {
        const notConcentratingChar = {
            ...mockCharacter,
            concentratingOn: undefined
        } as unknown as CombatCharacter

        expect(ConcentrationTracker.isConcentrating(notConcentratingChar, {} as CombatState)).toBe(false)
    })
  })
})
