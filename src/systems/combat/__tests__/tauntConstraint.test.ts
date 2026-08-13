/**
 * These tests cover the reusable taunt contract behind Compelled Duel.
 * They verify rule decisions without relying on UI timing or combat AI.
 */
import { describe, expect, it } from 'vitest'
import type { CombatCharacter, StatusEffect } from '@/types/combat'
import {
  breakTauntsForEvent,
  clearInvalidTaunts,
  hasTauntAttackDisadvantage,
  validateTauntWillingMove
} from '../tauntConstraint'

const makeCharacter = (
  id: string,
  team: CombatCharacter['team'],
  x: number,
  overrides: Partial<CombatCharacter> = {}
): CombatCharacter => ({
  id,
  name: id,
  team,
  position: { x, y: 0 },
  statusEffects: [],
  ...overrides
} as CombatCharacter)

const makeTaunt = (casterId: string): StatusEffect => ({
  id: 'taunt-status',
  name: 'Taunted',
  type: 'debuff',
  duration: 10,
  source: 'Compelled Duel',
  sourceSpellId: 'compelled-duel',
  sourceCasterId: casterId,
  taunt: {
    disadvantageAgainstOthers: true,
    leashRangeFeet: 30,
    breakEvents: [
      'caster_attacks_other',
      'caster_casts_spell_on_other_enemy',
      'caster_ally_damages_target',
      'caster_ends_turn_outside_leash'
    ]
  },
  effect: { type: 'condition' }
})

const setup = (targetX = 3) => {
  const caster = makeCharacter('caster', 'player', 0, {
    concentratingOn: {
      spellId: 'compelled-duel',
      spellName: 'Compelled Duel',
      spellLevel: 1,
      startedTurn: 1,
      effectIds: ['taunt-status'],
      canDropAsFreeAction: true
    }
  })
  const compelled = makeCharacter('compelled', 'enemy', targetX, {
    statusEffects: [makeTaunt(caster.id)]
  })
  const otherEnemy = makeCharacter('other-enemy', 'enemy', 2)
  const ally = makeCharacter('ally', 'player', 1)
  return { caster, compelled, otherEnemy, ally, characters: [caster, compelled, otherEnemy, ally] }
}

describe('tauntConstraint', () => {
  it('gives disadvantage only against creatures other than the caster', () => {
    const { caster, compelled, otherEnemy, characters } = setup()
    expect(hasTauntAttackDisadvantage(compelled, caster.id, characters)).toBe(false)
    expect(hasTauntAttackDisadvantage(compelled, otherEnemy.id, characters)).toBe(true)
  })

  it('rejects willing movement beyond the leash but allows movement within it', () => {
    const { compelled, characters } = setup()
    expect(validateTauntWillingMove(compelled, { x: 6, y: 0 }, characters).allowed).toBe(true)
    expect(validateTauntWillingMove(compelled, { x: 7, y: 0 }, characters).allowed).toBe(false)
  })

  it.each([
    ['attack', { event: 'caster_attacks_other', casterId: 'caster', targetIds: ['other-enemy'] }],
    ['enemy spell', { event: 'caster_casts_spell_on_other_enemy', casterId: 'caster', targetIds: ['other-enemy'] }],
    ['ally damage', { event: 'caster_ally_damages_target', casterId: 'ally', targetId: 'compelled' }]
  ] as const)('ends concentration after the %s break event', (_label, event) => {
    const { characters } = setup()
    const result = breakTauntsForEvent(characters, event as any)
    expect(result.breaks).toHaveLength(1)
    expect(result.characters.find(character => character.id === 'caster')?.concentratingOn).toBeUndefined()
    expect(result.characters.find(character => character.id === 'compelled')?.statusEffects).toHaveLength(0)
  })

  it('ends concentration when the caster ends a turn outside the leash', () => {
    const { characters } = setup(7)
    const result = breakTauntsForEvent(characters, {
      event: 'caster_ends_turn_outside_leash',
      casterId: 'caster'
    })
    expect(result.breaks).toHaveLength(1)
    expect(result.characters.find(character => character.id === 'caster')?.concentratingOn).toBeUndefined()
  })

  it('preserves the duel when a break event does not match', () => {
    const { characters } = setup()
    const result = breakTauntsForEvent(characters, {
      event: 'caster_attacks_other',
      casterId: 'caster',
      targetIds: ['compelled']
    })
    expect(result.characters).toBe(characters)
    expect(result.breaks).toHaveLength(0)
  })

  // Source and duration cleanup protects the same live attack/movement
  // contract. These cases are intentionally separate from authored break
  // events because no player action is required for expiry or source loss.
  it.each([
    ['expired', (characters: CombatCharacter[]) => characters.map(character => (
      character.id === 'compelled'
        ? {
            ...character,
            statusEffects: character.statusEffects.map(status => ({ ...status, duration: 0 }))
          }
        : character
    ))],
    ['source_downed', (characters: CombatCharacter[]) => characters.map(character => (
      character.id === 'caster' ? { ...character, currentHP: 0 } : character
    ))],
    ['source_incapacitated', (characters: CombatCharacter[]) => characters.map(character => (
      character.id === 'caster'
        ? {
            ...character,
            conditions: [{
              name: 'Incapacitated',
              duration: { type: 'rounds', value: 1 },
              appliedTurn: 1,
              source: 'test'
            }]
          }
        : character
    ))],
    ['source_missing', (characters: CombatCharacter[]) => characters.filter(character => (
      character.id !== 'caster'
    ))]
  ] as const)('clears the taunt when it is %s', (reason, mutate) => {
    const { characters } = setup()
    const invalidCharacters = mutate(characters)
    const result = clearInvalidTaunts(invalidCharacters)
    const compelled = result.characters.find(character => character.id === 'compelled')
    const caster = result.characters.find(character => character.id === 'caster')

    expect(result.cleanups).toEqual([expect.objectContaining({ reason })])
    expect(compelled?.statusEffects).toHaveLength(0)
    expect(caster?.concentratingOn).toBeUndefined()
  })

  it('stops attack and movement penalties immediately after expiry, source loss, or manual removal', () => {
    const { caster, compelled, otherEnemy, characters } = setup()
    const expired = {
      ...compelled,
      statusEffects: compelled.statusEffects.map(status => ({ ...status, duration: 0 }))
    }
    const sourceDown = characters.map(character => (
      character.id === caster.id ? { ...character, currentHP: 0 } : character
    ))
    const manuallyRemoved = { ...compelled, statusEffects: [] }

    expect(hasTauntAttackDisadvantage(expired, otherEnemy.id, characters)).toBe(false)
    expect(hasTauntAttackDisadvantage(compelled, otherEnemy.id, sourceDown)).toBe(false)
    expect(validateTauntWillingMove(compelled, { x: 7, y: 0 }, sourceDown).allowed).toBe(true)
    expect(hasTauntAttackDisadvantage(manuallyRemoved, otherEnemy.id, characters)).toBe(false)
  })
})
