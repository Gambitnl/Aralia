import { describe, it, expect } from 'vitest'
import { ResistanceCalculator } from '../ResistanceCalculator'
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
})
