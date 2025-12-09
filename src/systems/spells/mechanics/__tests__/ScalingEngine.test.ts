import { describe, it, expect } from 'vitest'
import { ScalingEngine } from '../ScalingEngine'

describe('ScalingEngine', () => {
  describe('scaleBySlotLevel', () => {
    it('should scale Fireball damage correctly (8d6 base + 1d6/level)', () => {
      // Fireball is Level 3 (base). Cast at Level 4.
      // 4 - 3 = 1 level above base.
      // 8d6 + 1d6 = 9d6.

      const scaled = ScalingEngine.scaleEffect(
        '8d6',
        { type: 'slot_level', bonusPerLevel: '+1d6' },
        4, // castAtLevel
        5, // casterLevel (unused)
        3  // baseSpellLevel (Fireball is 3rd level)
      )

      expect(scaled).toBe('9d6')
    })

    it('should NOT scale if cast at base level', () => {
      // Fireball cast at Level 3 (base).
      const scaled = ScalingEngine.scaleEffect(
        '8d6',
        { type: 'slot_level', bonusPerLevel: '+1d6' },
        3,
        5,
        3
      )
      expect(scaled).toBe('8d6')
    })
  })

  describe('scaleByCharacterLevel', () => {
    it('should scale cantrips at level 5 (Tier 2)', () => {
      const scaled = ScalingEngine.scaleEffect(
        '1d10',
        { type: 'character_level', bonusPerLevel: '' },
        0,
        5
      )
      // Tier 2 -> 2d10
      expect(scaled).toBe('2d10')
    })

    it('should scale cantrips at level 1 (Tier 1)', () => {
        const scaled = ScalingEngine.scaleEffect(
          '1d10',
          { type: 'character_level', bonusPerLevel: '' },
          0,
          1
        )
        // Tier 1 -> 1d10
        expect(scaled).toBe('1d10')
      })
  })
})
