import { describe, it, expect } from 'vitest'
import { ResistanceCalculator } from '../resistanceUtils'
import type { CombatCharacter } from '@/types'

describe('ResistanceCalculator', () => {
  it('should return base damage when no resistances apply (default)', () => {
    const mockCharacter = {
        resistances: [],
        vulnerabilities: [],
        immunities: []
    } as unknown as CombatCharacter
    const damage = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damage).toBe(10)
  })

  it('should apply resistance (half damage)', () => {
    const mockCharacter = {
        resistances: ['Fire'],
        vulnerabilities: [],
        immunities: []
    } as unknown as CombatCharacter

    const damage = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damage).toBe(5) // floor(10 / 2)
  })

  it('should apply vulnerability (double damage)', () => {
    const mockCharacter = {
        resistances: [],
        vulnerabilities: ['Fire'],
        immunities: []
    } as unknown as CombatCharacter

    const damage = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damage).toBe(20) // 10 * 2
  })

  it('should apply both resistance and vulnerability (cancel out effectively)', () => {
    // XGtE Rule: They cancel out, damage is unchanged.
    const mockCharacter = {
        resistances: ['Fire'],
        vulnerabilities: ['Fire'],
        immunities: []
    } as unknown as CombatCharacter

    // Test with even number (previously worked by accident: floor(10/2)*2 = 10)
    const damageEven = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damageEven).toBe(10)

    // Test with odd number (previously failed: floor(25/2)*2 = 24)
    const damageOdd = ResistanceCalculator.applyResistances(25, 'Fire', mockCharacter)
    expect(damageOdd).toBe(25)
  })

  it('should apply immunity (zero damage) regardless of others', () => {
    const mockCharacter = {
        resistances: ['Fire'],
        vulnerabilities: ['Fire'],
        immunities: ['Fire']
    } as unknown as CombatCharacter

    const damage = ResistanceCalculator.applyResistances(100, 'Fire', mockCharacter)
    expect(damage).toBe(0)
  })

  it('should apply temporary resistance from active status effects (e.g. Barbarian Rage)', () => {
    const mockCharacter = {
      resistances: [],
      vulnerabilities: [],
      immunities: [],
      statusEffects: [
        {
          id: 'rage',
          name: 'Rage',
          type: 'buff',
          duration: 10,
          modifiers: {
            resistance: ['Bludgeoning', 'Piercing', 'Slashing']
          }
        }
      ]
    } as unknown as CombatCharacter

    // Barbarian taking physical slashing damage while raging
    const damageSlashing = ResistanceCalculator.applyResistances(10, 'Slashing', mockCharacter)
    expect(damageSlashing).toBe(5) // floor(10 / 2)

    // Barbarian taking physical piercing damage while raging
    const damagePiercing = ResistanceCalculator.applyResistances(15, 'Piercing', mockCharacter)
    expect(damagePiercing).toBe(7) // floor(15 / 2)

    // Fire damage is not resisted by standard Rage
    const damageFire = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damageFire).toBe(10)
  })

  it('should apply temporary immunity from active status effects', () => {
    const mockCharacter = {
      resistances: [],
      vulnerabilities: [],
      immunities: [],
      statusEffects: [
        {
          id: 'death_ward',
          name: 'Death Ward',
          type: 'buff',
          duration: 1,
          modifiers: {
            immunity: ['Necrotic']
          }
        }
      ]
    } as unknown as CombatCharacter

    const damageNecrotic = ResistanceCalculator.applyResistances(50, 'Necrotic', mockCharacter)
    expect(damageNecrotic).toBe(0)
  })

  it('should apply temporary vulnerability from active status effects', () => {
    const mockCharacter = {
      resistances: [],
      vulnerabilities: [],
      immunities: [],
      statusEffects: [
        {
          id: 'curse',
          name: 'Curse',
          type: 'debuff',
          duration: 3,
          modifiers: {
            vulnerability: ['Cold']
          }
        }
      ]
    } as unknown as CombatCharacter

    const damageCold = ResistanceCalculator.applyResistances(10, 'Cold', mockCharacter)
    expect(damageCold).toBe(20) // 10 * 2
  })
})
