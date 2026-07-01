import { describe, expect, it } from 'vitest'
import { UtilityCommand } from '../effects/UtilityCommand'
import type { CommandContext } from '../base/SpellCommand'
import type { CombatCharacter, CombatState, SelectedSpellTarget } from '../../types/combat'
import type { UtilityEffect } from '../../types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import truePolymorph from '../../../public/data/spells/level-9/true-polymorph.json'

/**
 * This proof keeps True Polymorph's object-into-creature mode from being only
 * metadata prose.
 *
 * The live spell packet says an unattended object can become a friendly
 * creature that acts after the caster and obeys commands while controlled. The
 * command runtime should therefore create a live controlled actor and preserve
 * the transformation/control facts instead of only writing a generic utility
 * log entry.
 */

describe('UtilityCommand live True Polymorph object-to-creature bridge', () => {
  it('creates a controlled creature actor from the selected object target', () => {
    const utilityEffect = truePolymorph.effects.find(effect => effect.type === 'UTILITY') as unknown as UtilityEffect

    expect(utilityEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'true-polymorph-caster',
      name: 'True Polymorph Caster',
      position: { x: 4, y: 4 },
      initiative: 15
    }) as CombatCharacter

    const selectedObject: SelectedSpellTarget = {
      kind: 'object',
      id: 'loose-boulder',
      name: 'Loose Boulder',
      position: { x: 7, y: 4 },
      object: {
        id: 'loose-boulder',
        name: 'Loose Boulder',
        position: { x: 7, y: 4 },
        size: 'Large',
        weightPounds: 1200,
        isMagical: false,
        isWornOrCarried: false,
        isFixedToSurface: false
      }
    }

    const command = new UtilityCommand(utilityEffect, {
      spellId: truePolymorph.id,
      spellName: truePolymorph.name,
      castAtLevel: 9,
      caster,
      targets: [],
      playerInput: 'Object into creature',
      selectedSpellTargets: [selectedObject],
      gameState: createMockGameState()
    } satisfies CommandContext)

    const state = createMockCombatState({
      characters: [caster]
    })

    const nextState = command.execute(state)
    const transformedCreature = nextState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === truePolymorph.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(transformedCreature).toEqual(expect.objectContaining({
      name: 'Loose Boulder (True Polymorph)',
      team: caster.team,
      position: selectedObject.position
    }))
    expect(transformedCreature?.summonMetadata).toEqual(expect.objectContaining({
      entityType: 'object_to_creature_or_transformed_creature',
      sourceName: truePolymorph.name,
      persistent: true,
      initiativePolicy: 'immediate',
      commandCost: 'none',
      commandsPerTurn: 1,
      control: expect.objectContaining({
        entityType: 'object_to_creature_or_transformed_creature',
        allegiance: 'friendly to caster and allies while controlled',
        obedience: 'obeys caster commands while controlled',
        initiative: 'acts immediately after caster'
      }),
      lifecycle: expect.objectContaining({
        recastEnding: 'transformation ends when target dies, is destroyed, spell ends, or full-duration permanence changes control state'
      })
    }))
    expect(nextState.activeTruePolymorphTransformations?.[0]).toEqual(expect.objectContaining({
      sourceObjectId: selectedObject.id,
      sourceObjectName: selectedObject.name,
      transformedCreatureId: transformedCreature?.id,
      controlledUntilFullDuration: true,
      controlAfterOneHour: 'caster no longer controls the creature, though it might remain friendly'
    }))
    expect(nextState.combatLog.some(entry =>
      entry.data?.truePolymorphTransformation !== undefined &&
      entry.data?.transformedCreatureId === transformedCreature?.id
    )).toBe(true)
  })
})
