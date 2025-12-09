import { describe, it, expect, vi } from 'vitest'
import { ResistanceCalculator } from '../ResistanceCalculator'
import type { CombatCharacter } from '@/types'

// To test the logic flow without implementing the TODOs (reading from character properties),
// we will mock the private static methods using vi.spyOn but cast to any since they are private.
// Note: Private static mocking in TS is tricky.
// A safer approach for testing logic flow here is to extend the class or modify the prototype,
// OR just accept that for now we are testing the "default" path until the getters are implemented.
//
// However, to verify the FIX (sequential application), we really want to simulate true returns from those methods.
// Let's use `vi.spyOn(ResistanceCalculator as any, 'isResistant')`

describe('ResistanceCalculator', () => {
  it('should return base damage when no resistances apply (default)', () => {
    const mockCharacter = {} as CombatCharacter
    const damage = ResistanceCalculator.applyResistances(10, 'Fire', mockCharacter)
    expect(damage).toBe(10)
  })

  it('should apply resistance (half damage)', () => {
    vi.spyOn(ResistanceCalculator as any, 'isResistant').mockReturnValue(true)
    vi.spyOn(ResistanceCalculator as any, 'isVulnerable').mockReturnValue(false)
    vi.spyOn(ResistanceCalculator as any, 'isImmune').mockReturnValue(false)

    const damage = ResistanceCalculator.applyResistances(10, 'Fire', {} as CombatCharacter)
    expect(damage).toBe(5) // floor(10 / 2)

    vi.restoreAllMocks()
  })

  it('should apply vulnerability (double damage)', () => {
    vi.spyOn(ResistanceCalculator as any, 'isResistant').mockReturnValue(false)
    vi.spyOn(ResistanceCalculator as any, 'isVulnerable').mockReturnValue(true)
    vi.spyOn(ResistanceCalculator as any, 'isImmune').mockReturnValue(false)

    const damage = ResistanceCalculator.applyResistances(10, 'Fire', {} as CombatCharacter)
    expect(damage).toBe(20) // 10 * 2

    vi.restoreAllMocks()
  })

  it('should apply both resistance and vulnerability (cancel out effectively)', () => {
    // Math: floor(10 / 2) * 2 = 5 * 2 = 10.
    // If we did float math: (10 * 0.5) * 2 = 10.
    // D&D 5e: Resistance is applied first.
    vi.spyOn(ResistanceCalculator as any, 'isResistant').mockReturnValue(true)
    vi.spyOn(ResistanceCalculator as any, 'isVulnerable').mockReturnValue(true)
    vi.spyOn(ResistanceCalculator as any, 'isImmune').mockReturnValue(false)

    const damage = ResistanceCalculator.applyResistances(10, 'Fire', {} as CombatCharacter)
    expect(damage).toBe(10)

    vi.restoreAllMocks()
  })

  it('should apply immunity (zero damage) regardless of others', () => {
    vi.spyOn(ResistanceCalculator as any, 'isResistant').mockReturnValue(true)
    vi.spyOn(ResistanceCalculator as any, 'isVulnerable').mockReturnValue(true)
    vi.spyOn(ResistanceCalculator as any, 'isImmune').mockReturnValue(true)

    const damage = ResistanceCalculator.applyResistances(100, 'Fire', {} as CombatCharacter)
    expect(damage).toBe(0)

    vi.restoreAllMocks()
  })
})
