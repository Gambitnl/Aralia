/**
 * This file proves that a summoned actor keeps its own creature template
 * instead of wearing a Fighter costume.
 *
 * Before `agora-375e` every summon was handed `CLASSES_DATA['fighter']` as a
 * placeholder class. That is not inert: saving throws read
 * `target.class.savingThrowProficiencies`, so a summoned Bat was proficient in
 * a Fighter's Strength and Constitution saves. Template armour class and
 * creature family were dropped on the floor at the same time, leaving the actor
 * at the default AC 10 and invisible to Beast-only rules.
 *
 * Covers: SummoningCommand.
 */

import { describe, expect, it } from 'vitest'
import { SummoningCommand } from '../SummoningCommand'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/core'
import { SUMMON_TEMPLATES } from '@/data/summonTemplates'
import type { SummoningEffect } from '@/types/spells'

const SUMMON_TRIGGER = {
  type: 'immediate',
  frequency: 'every_time',
  consumption: 'unlimited',
  attackFilter: { weaponType: 'any', attackType: 'any' },
  movementType: 'any',
  sustainCost: { actionType: 'action', optional: false }
}

const makeEffect = (summon: Record<string, unknown>): SummoningEffect => ({
  type: 'SUMMONING',
  trigger: SUMMON_TRIGGER,
  condition: { type: 'always' },
  duration: { type: 'minutes', value: 10 },
  summon
}) as unknown as SummoningEffect

const summonOnce = (effect: SummoningEffect, playerInput?: string) => {
  const caster = createMockCombatCharacter({ id: 'summoner', name: 'Summoner', position: { x: 2, y: 2 } })
  const state = createMockCombatState({ characters: [caster] })

  const command = new SummoningCommand(effect, {
    spellId: 'find-familiar',
    spellName: 'Find Familiar',
    castAtLevel: 1,
    caster,
    targets: [],
    playerInput,
    gameState: createMockGameState()
  })

  return command.execute(state).characters.find(character => character.isSummon)
}

describe('SummoningCommand creature templates', () => {
  it('names the class after the resolved creature family and drops Fighter proficiencies', () => {
    const summon = summonOnce(makeEffect({ count: 1, entityType: 'familiar', formOptions: ['Bat'] }))

    expect(summon).toBeDefined()
    expect(summon?.class.id).toBe('monster')
    expect(summon?.class.id).not.toBe('fighter')
    expect(summon?.class.name).toBe('Beast')
    expect(summon?.class.savingThrowProficiencies).toEqual([])
  })

  it('carries the summon template creature type onto the live actor', () => {
    const summon = summonOnce(makeEffect({ count: 1, entityType: 'familiar', formOptions: ['Bat'] }))

    expect(summon?.creatureTypes).toEqual(['Beast'])
  })

  it('uses the template armour class instead of the unarmoured default', () => {
    const summon = summonOnce(makeEffect({ count: 1, entityType: 'familiar', formOptions: ['Bat'] }))

    expect(SUMMON_TEMPLATES['Bat'].ac).toBe(12)
    expect(summon?.armorClass).toBe(12)
    expect(summon?.baseAC).toBe(12)
  })

  it('honours the chosen form when several templates are offered', () => {
    const effect = makeEffect({ count: 1, entityType: 'familiar', formOptions: ['Bat', 'Octopus'] })
    const summon = summonOnce(effect, 'Octopus')

    expect(summon?.name).toContain('Octopus')
    expect(summon?.armorClass).toBe(SUMMON_TEMPLATES['Octopus'].ac)
    expect(summon?.creatureTypes).toEqual(['Beast'])
  })

  it('reads the creature family and armour class from an inline spell stat block', () => {
    const summon = summonOnce(makeEffect({
      count: 1,
      entityType: 'spirit',
      statBlock: {
        name: 'Fey Spirit',
        type: 'Fey',
        ac: 15,
        hp: 30,
        speed: 40,
        abilities: { str: 13, dex: 16, con: 14, int: 14, wis: 11, cha: 16 }
      }
    }))

    expect(summon?.creatureTypes).toEqual(['Fey'])
    expect(summon?.class.name).toBe('Fey')
    expect(summon?.armorClass).toBe(15)
  })

  it('falls back to a neutral monster class when no template names a family', () => {
    const summon = summonOnce(makeEffect({ count: 1, entityType: 'object', objectDescription: 'Floating Disk' }))

    expect(summon?.class.id).toBe('monster')
    expect(summon?.class.name).toBe('Monster')
    expect(summon?.creatureTypes).toBeUndefined()
    // No template or monster AC is available, so the unarmoured default stands.
    expect(summon?.armorClass).toBe(10)
  })
})
