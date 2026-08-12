import { describe, expect, it } from 'vitest'
import { hasPersistentAreaTrigger, isDeferredAreaZoneTrigger } from '../spellEffectUtils'
import type { SpellEffect } from '@/types/spells'
import sleetStorm from '@/data/spells/level-3/sleet-storm.json'
import spiritGuardians from '@/data/spells/level-3/spirit-guardians.json'
import evardsBlackTentacles from '@/data/spells/level-4/evards-black-tentacles.json'
import conjureWoodlandBeings from '@/data/spells/level-4/conjure-woodland-beings.json'
import conjureElemental from '@/data/spells/level-5/conjure-elemental.json'

/**
 * This file protects the boundary that decides whether a spell effect needs a
 * durable area zone and whether its authored row should also run at cast time.
 *
 * Called by: the focused spell utility test suite.
 * Depends on: spellEffectUtils and the source-shaped trigger metadata contract.
 */

describe('composite area trigger routing', () => {
  it('keeps generic composite rows in the area tracker', () => {
    const effect = {
      type: 'STATUS_CONDITION',
      trigger: {
        type: 'area_entry_or_turn_start',
        areaTiming: ['enters_area_first_time_on_turn', 'starts_turn_in_area']
      },
      condition: { type: 'always' }
    } as unknown as SpellEffect

    expect(hasPersistentAreaTrigger(effect)).toBe(true)
    expect(isDeferredAreaZoneTrigger(effect)).toBe(true)
  })

  it('preserves initial-cast and controlled-entity branches', () => {
    const initialCast = {
      type: 'DAMAGE',
      trigger: {
        type: 'area_entry_or_turn_end',
        areaTiming: ['initial_area_creation', 'creature_enters_area']
      },
      condition: { type: 'always' }
    } as unknown as SpellEffect
    const controlledEntity = {
      type: 'DAMAGE',
      trigger: {
        type: 'area_entry_or_turn_start',
        areaTiming: ['visible_creature_enters_spirit_space']
      },
      controlledEntity: { entityType: 'elemental_spirit_eruption' },
      condition: { type: 'always' }
    } as unknown as SpellEffect

    expect(hasPersistentAreaTrigger(initialCast)).toBe(true)
    expect(isDeferredAreaZoneTrigger(initialCast)).toBe(false)
    expect(hasPersistentAreaTrigger(controlledEntity)).toBe(false)
    expect(isDeferredAreaZoneTrigger(controlledEntity)).toBe(false)
  })

  it('classifies the current composite spell records without inventing generic zones', () => {
    const getCompositeEffect = (spell: { effects: unknown[] }): SpellEffect =>
      spell.effects.find((effect) =>
        typeof effect === 'object' &&
        effect !== null &&
        'trigger' in effect &&
        typeof effect.trigger === 'object' &&
        effect.trigger !== null &&
        'type' in effect.trigger &&
        typeof effect.trigger.type === 'string' &&
        effect.trigger.type.includes('_or_')
      ) as SpellEffect

    const sleet = getCompositeEffect(sleetStorm)
    const evards = getCompositeEffect(evardsBlackTentacles)
    const spirit = getCompositeEffect(spiritGuardians)
    const woodland = getCompositeEffect(conjureWoodlandBeings)
    const elemental = getCompositeEffect(conjureElemental)

    expect([sleet, evards, spirit].every(hasPersistentAreaTrigger)).toBe(true)
    expect(isDeferredAreaZoneTrigger(sleet)).toBe(true)
    expect(isDeferredAreaZoneTrigger(evards)).toBe(false)
    expect(hasPersistentAreaTrigger(woodland)).toBe(false)
    expect(hasPersistentAreaTrigger(elemental)).toBe(false)
  })
})
