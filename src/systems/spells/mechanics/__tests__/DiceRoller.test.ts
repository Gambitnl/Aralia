import { describe, it, expect } from 'vitest'
import { DiceRoller } from '../DiceRoller'

describe('DiceRoller', () => {
  it('supports deterministic RNG for formula roll', () => {
    let values = [0.0, 0.5, 0.9];
    const rng = () => values.shift() as number;

    const result = DiceRoller.roll('2d6', rng)
    expect(result).toBe(5)
  })

  it('supports deterministic RNG for d20 advantage and disadvantage', () => {
    let values = [0.2, 0.8, 0.1, 0.9];
    const rng = () => values.shift() as number;

    expect(DiceRoller.rollD20Advantage(rng)).toMatchObject({
      roll: 17,
      rolls: [5, 17],
    })
    expect(DiceRoller.rollD20Disadvantage(rng)).toMatchObject({
      roll: 3,
      rolls: [3, 19],
    })
  })

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
    // Since agora-f821.4 these rolls go through the audited contract, so a
    // Math.random pin no longer reaches them. The supported way to make a roll
    // deterministic is the injected source the wrapper already forwards.
    it('should roll simple dice formula (e.g., 3d6)', () => {
      const result = DiceRoller.roll('3d6', () => 0.5) // each d6 -> 4
      expect(result).toBe(12) // 4 + 4 + 4
    })

    it('should handle formula with bonus (e.g., 1d8+2)', () => {
      const result = DiceRoller.roll('1d8+2', () => 0.5) // 1d8 -> 5
      expect(result).toBe(7) // 5 + 2
    })

    it('keeps an unpinned roll inside the formula range', () => {
      for (let i = 0; i < 50; i++) {
        const result = DiceRoller.roll('3d6')
        expect(result).toBeGreaterThanOrEqual(3)
        expect(result).toBeLessThanOrEqual(18)
      }
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
