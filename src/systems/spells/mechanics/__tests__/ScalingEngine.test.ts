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

  describe('scaleByTiers', () => {
    const scalingTiers = {
      "5": "2d10",
      "11": "3d10",
      "17": "4d10"
    };

    it('should return base value below first tier', () => {
      const scaled = ScalingEngine.scaleEffect(
        '1d10',
        { type: 'character_level', scalingTiers },
        0,
        1 // Level 1
      )
      expect(scaled).toBe('1d10')
    })

    it('should return correct value at tier 5', () => {
      const scaled = ScalingEngine.scaleEffect(
        '1d10',
        { type: 'character_level', scalingTiers },
        0,
        5 // Level 5
      )
      expect(scaled).toBe('2d10')
    })

    it('should return correct value at tier 11', () => {
      const scaled = ScalingEngine.scaleEffect(
        '1d10',
        { type: 'character_level', scalingTiers },
        0,
        12 // Level 12
      )
      expect(scaled).toBe('3d10')
    })

    it('should return correct value at tier 17', () => {
      const scaled = ScalingEngine.scaleEffect(
        '1d10',
        { type: 'character_level', scalingTiers },
        0,
        20 // Level 20
      )
      expect(scaled).toBe('4d10')
    })
  })
})
