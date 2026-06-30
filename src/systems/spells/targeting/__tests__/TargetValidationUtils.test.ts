import { describe, it, expect } from 'vitest'
import { TargetValidationUtils } from '../TargetValidationUtils'
import { SpellValidator } from '../../validation/spellValidator'
import { TargetConditionFilter, type Spell } from '@/types/spells'
import { createMockCombatCharacter } from '@/utils/factories'
import catapult from '../../../../../public/data/spells/level-1/catapult.json'
import cureWounds from '../../../../../public/data/spells/level-1/cure-wounds.json'
import findFamiliar from '../../../../../public/data/spells/level-1/find-familiar.json'
import healingWord from '../../../../../public/data/spells/level-1/healing-word.json'
import gentleRepose from '../../../../../public/data/spells/level-2/gentle-repose.json'
import guidance from '../../../../../public/data/spells/level-0/guidance.json'
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
  cureWounds,
  findFamiliar,
  healingWord,
  gentleRepose,
  guidance,
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

const readEffectTargetFilter = (id: string): TargetConditionFilter => {
  const filter = findSpell(id).effects[0]?.condition?.targetFilter
  if (!filter) {
    throw new Error(`Package 10 representative spell ${id} has no effect target filter`)
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

  it('validates creature type inclusion and exclusion through shared taxonomy', () => {
    const humanGoblin = createMockCombatCharacter({
      currentHP: 10,
      creatureTypes: ['Humanoid', 'Goblin']
    })
    const undead = createMockCombatCharacter({
      currentHP: 10,
      creatureTypes: ['Undead']
    })

    const includeOnlyHumanoid: TargetConditionFilter = {
      creatureTypes: ['humanoid']
    }

    const excludeUndead: TargetConditionFilter = {
      excludeCreatureTypes: ['Undead']
    }

    expect(TargetValidationUtils.matchesFilter(humanGoblin, includeOnlyHumanoid)).toBe(true)
    expect(TargetValidationUtils.matchesFilter(undead, includeOnlyHumanoid)).toBe(false)
    expect(TargetValidationUtils.matchesFilter(undead, excludeUndead)).toBe(false)
    expect(TargetValidationUtils.matchesFilter(humanGoblin, excludeUndead)).toBe(true)
  })

  it('preserves legacy singular creatureType alias on matchesFilter', () => {
    const dragon = createMockCombatCharacter({
      currentHP: 10,
      creatureTypes: ['Dragon']
    })
    const ogre = createMockCombatCharacter({
      currentHP: 10,
      creatureTypes: ['Giant']
    })

    const filter: TargetConditionFilter = {
      creatureType: ['Dragon']
    }

    expect(TargetValidationUtils.matchesFilter(dragon, filter)).toBe(true)
    expect(TargetValidationUtils.matchesFilter(ogre, filter)).toBe(false)
  })

  it('rejects explicitly unwilling targets for willing-creature spells while preserving unknown-consent allies', () => {
    // Guidance is the first level-0 spell using this bridge. Most combatants do
    // not yet carry a consent flag, so unknown ally consent must keep working;
    // explicitly unwilling targets are the scenario that should be rejected.
    const guidanceFilter = readTopLevelFilter('guidance')
    const willingAlly = createMockCombatCharacter({ currentHP: 10 })
    const unwillingAlly = createMockCombatCharacter({
      currentHP: 10,
      isWilling: false
    } as Partial<ReturnType<typeof createMockCombatCharacter>> & { isWilling: false })

    expect(guidanceFilter.willing).toBe('required')
    expect(TargetValidationUtils.matchesFilter(willingAlly, guidanceFilter)).toBe(true)
    expect(TargetValidationUtils.matchesFilter(unwillingAlly, guidanceFilter)).toBe(false)
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

  it('uses real Cure Wounds and Healing Word data to reject Undead and Constructs', () => {
    const livingHumanoid = createMockCombatCharacter({
      currentHP: 4,
      creatureTypes: ['Humanoid']
    })
    const undeadTarget = createMockCombatCharacter({
      currentHP: 4,
      creatureTypes: ['Undead']
    })
    const constructTarget = createMockCombatCharacter({
      currentHP: 4,
      creatureTypes: ['Construct']
    })

    for (const spellId of ['cure-wounds', 'healing-word']) {
      const targetingFilter = readTopLevelFilter(spellId)
      const effectFilter = readEffectTargetFilter(spellId)

      // Healing spell restrictions live in both the UI-facing targeting filter
      // and the command-facing effect filter so selection and execution cannot
      // drift apart for the same live spell record.
      expect(targetingFilter.excludeCreatureTypes).toEqual(['Undead', 'Construct'])
      expect(effectFilter.excludeCreatureTypes).toEqual(['Undead', 'Construct'])
      expect(TargetValidationUtils.matchesFilter(livingHumanoid, targetingFilter)).toBe(true)
      expect(TargetValidationUtils.matchesFilter(undeadTarget, targetingFilter)).toBe(false)
      expect(TargetValidationUtils.matchesFilter(constructTarget, targetingFilter)).toBe(false)
      expect(TargetValidationUtils.matchesFilter(livingHumanoid, effectFilter)).toBe(true)
      expect(TargetValidationUtils.matchesFilter(undeadTarget, effectFilter)).toBe(false)
      expect(TargetValidationUtils.matchesFilter(constructTarget, effectFilter)).toBe(false)
    }
  })
})
