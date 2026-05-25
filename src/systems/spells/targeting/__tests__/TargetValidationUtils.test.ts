import { describe, it, expect } from 'vitest'
import { TargetValidationUtils } from '../TargetValidationUtils'
import { SpellValidator } from '../../validation/spellValidator'
import { TargetConditionFilter, type Spell } from '@/types/spells'
import { createMockCombatCharacter } from '@/utils/factories'
import catapult from '../../../../../public/data/spells/level-1/catapult.json'
import findFamiliar from '../../../../../public/data/spells/level-1/find-familiar.json'
import gentleRepose from '../../../../../public/data/spells/level-2/gentle-repose.json'
import mistyStep from '../../../../../public/data/spells/level-2/misty-step.json'

/**
 * This file protects the small targeting bridge used by Package 10.
 *
 * The first tests check the runtime helper directly because combat targeting
 * calls this class when deciding whether a creature is a legal target. The
 * later tests load real spell JSON so Package 10 proves the new eligibility
 * facts are present in committed spell data and still pass the live spell
 * schema, not only in hand-built test objects.
 */

// ============================================================================
// Real Spell Data Used By The Package 10 Proof
// ============================================================================
// These imports are deliberately limited to representative Package 10 rows:
// Catapult covers object eligibility, Find Familiar and Misty Step cover
// placement eligibility, and Gentle Repose covers special target identity.
// ============================================================================

const representativeSpells = [
  catapult,
  findFamiliar,
  gentleRepose,
  mistyStep
] as unknown as Spell[]

const findSpell = (id: string): Spell => {
  const spell = representativeSpells.find(candidate => candidate.id === id)
  if (!spell) {
    throw new Error(`Missing Package 10 representative spell: ${id}`)
  }
  return spell
}

const readTopLevelFilter = (id: string): TargetConditionFilter => {
  const filter = findSpell(id).targeting.filter
  if (!filter) {
    throw new Error(`Package 10 representative spell ${id} has no targeting filter`)
  }
  return filter
}

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

  it('keeps the representative Package 10 spell data valid under the live spell schema', () => {
    // Validating the committed spell JSON guards against a false-positive
    // repair where the TypeScript types compile but the data loader rejects the
    // new eligibility fields at runtime.
    representativeSpells.forEach(spell => {
      const result = SpellValidator.safeParse(spell)
      expect(result.success, spell.id).toBe(true)
    })
  })

  it('exposes representative object and placement eligibility from real spell data', () => {
    // These assertions prove the selected object and placement rows are present
    // in the data shape that future UI/combat targeting code will read.
    expect(readTopLevelFilter('catapult').objectEligibility).toMatchObject({
      wornOrCarried: 'excluded',
      magicalStatus: 'any',
      maxWeightPounds: 5,
      maxWeightScaling: '+5 pounds per slot above 1'
    })

    expect(readTopLevelFilter('find-familiar').placementEligibility).toMatchObject({
      unoccupied: 'required'
    })

    expect(readTopLevelFilter('misty-step').placementEligibility).toMatchObject({
      unoccupied: 'required',
      destination: 'caster_choice'
    })
  })

  it('uses real Gentle Repose data for the corpse-or-remains runtime bridge', () => {
    // Gentle Repose is the selected special-identity proof. Loading its real
    // filter here connects the committed JSON to the runtime helper instead of
    // only testing an artificial in-memory filter.
    const gentleReposeFilter = readTopLevelFilter('gentle-repose')
    const livingChar = createMockCombatCharacter({ currentHP: 10 })
    const deadChar = createMockCombatCharacter({ currentHP: 0 })

    expect(gentleReposeFilter.specialIdentity).toMatchObject({
      corpseOrRemains: 'required'
    })
    expect(TargetValidationUtils.matchesFilter(livingChar, gentleReposeFilter)).toBe(false)
    expect(TargetValidationUtils.matchesFilter(deadChar, gentleReposeFilter)).toBe(true)
  })
})
