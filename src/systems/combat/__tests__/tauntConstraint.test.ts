/**
 * These tests cover the reusable taunt contract behind Compelled Duel.
 * They verify rule decisions without relying on UI timing or combat AI.
 */
import { describe, expect, it } from 'vitest'
import type { CombatCharacter, StatusEffect } from '@/types/combat'
import {
  breakTauntsForEvent,
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
    const { caster, compelled, otherEnemy } = setup()
    expect(hasTauntAttackDisadvantage(compelled, caster.id)).toBe(false)
    expect(hasTauntAttackDisadvantage(compelled, otherEnemy.id)).toBe(true)
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
})
