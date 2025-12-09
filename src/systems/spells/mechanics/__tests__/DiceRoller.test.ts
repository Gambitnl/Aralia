import { describe, it, expect } from 'vitest'
import { DiceRoller } from '../DiceRoller'

describe('DiceRoller', () => {
  describe('rollD20', () => {
    it('should roll between 1 and 20', () => {
      for (let i = 0; i < 100; i++) {
        const roll = DiceRoller.rollD20()
        expect(roll).toBeGreaterThanOrEqual(1)
        expect(roll).toBeLessThanOrEqual(20)
      }
    })
  })

  describe('roll', () => {
    it('should roll simple dice formula (e.g., 3d6)', () => {
      // Mock Math.random to always return 0.5 (which maps to floor(0.5 * 6) + 1 = 4)
      const originalRandom = Math.random
      Math.random = () => 0.5

      const result = DiceRoller.roll('3d6')
      expect(result).toBe(12) // 4 + 4 + 4

      Math.random = originalRandom
    })

    it('should handle formula with bonus (e.g., 1d8+2)', () => {
      const originalRandom = Math.random
      Math.random = () => 0.5 // 1d8 -> 5

      const result = DiceRoller.roll('1d8+2')
      expect(result).toBe(7) // 5 + 2

      Math.random = originalRandom
    })

    it('should handle flat numbers', () => {
      expect(DiceRoller.roll('10')).toBe(10)
    })
  })

  describe('rollD20Advantage', () => {
    it('should take the higher roll', () => {
        // We can't easily deterministic mock two sequential calls without a more complex mock
        // So we just check the property
        const result = DiceRoller.rollD20Advantage()
        expect(result.roll).toBe(Math.max(result.rolls[0], result.rolls[1]))
    })
  })

  describe('rollD20Disadvantage', () => {
    it('should take the lower roll', () => {
        const result = DiceRoller.rollD20Disadvantage()
        expect(result.roll).toBe(Math.min(result.rolls[0], result.rolls[1]))
    })
  })
})
