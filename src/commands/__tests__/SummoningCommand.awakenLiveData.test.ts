import { describe, expect, it } from 'vitest'
import { StatusConditionCommand } from '../effects/StatusConditionCommand'
import {
  UtilityCommand,
  endAwakenCharmedRelationship
} from '../effects/UtilityCommand'
import type { CombatCharacter } from '@/types/combat'
import type { Spell, StatusConditionEffect, UtilityEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import awaken from '../../../public/data/spells/level-5/awaken.json'

/**
 * This file proves Awaken's long-lived transformation is runtime state, not
 * just JSON prose. It intentionally models the bounded rule facts and leaves
 * full relationship AI, statblock generation, and plant-object spawning to
 * later systems.
 */

describe('Awaken live transformation and relationship bridge', () => {
  it('records awakened creature facts and the post-charm attitude lifecycle', async () => {
    const spell = awaken as unknown as Spell
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')
    const statusEffect = spell.effects.find((effect): effect is StatusConditionEffect => effect.type === 'STATUS_CONDITION')

    expect(utilityEffect).toBeDefined()
    expect(statusEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'awaken-caster',
      name: 'Awaken Caster',
      position: { x: 5, y: 5 },
      initiative: 17
    }) as CombatCharacter
    const awakenedTree = createMockCombatCharacter({
      id: 'old-oak',
      name: 'Old Oak',
      creatureTypes: ['Plant'],
      position: { x: 6, y: 5 },
      initiative: 9
    }) as CombatCharacter

    const state = createMockCombatState({
      characters: [caster, awakenedTree]
    })

    const utilityCommand = new UtilityCommand(utilityEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [awakenedTree],
      gameState: createMockGameState(),
      playerInput: 'language=Sylvan; statProfile=Awakened Tree; targetKind=natural plant'
    })
    const afterUtility = utilityCommand.execute(state)
    const awakened = afterUtility.activeAwakenedCreatures?.find(record => record.targetId === awakenedTree.id)

    expect(awakened).toEqual(expect.objectContaining({
      spellId: spell.id,
      casterId: caster.id,
      targetId: awakenedTree.id,
      targetName: awakenedTree.name,
      creatureType: 'Plant',
      intelligenceScore: 10,
      language: 'Sylvan',
      statProfile: 'Awakened Tree',
      naturalPlantBecameCreature: true,
      movementParts: ['limbs', 'roots', 'vines', 'creepers'],
      humanlikeSenses: true,
      charmedRelationship: expect.objectContaining({
        condition: 'Charmed',
        durationDays: 30,
        endsIfDamagedByCasterOrAllies: true,
        attitudeChosenAfterCharmEnds: true
      })
    }))
    expect(afterUtility.combatLog.some(entry =>
      entry.data?.awakenedCreatureSurface === 'awaken' &&
      (entry.data?.awakenedCreature as { targetId?: string } | undefined)?.targetId === awakenedTree.id
    )).toBe(true)

    const statusCommand = new StatusConditionCommand(statusEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [awakenedTree],
      gameState: createMockGameState()
    })
    const afterStatus = await statusCommand.execute(afterUtility)
    const charmedTarget = afterStatus.characters.find(character => character.id === awakenedTree.id)
    const charmedStatus = charmedTarget?.statusEffects.find(effect => effect.name === 'Charmed')
    const charmedCondition = charmedTarget?.conditions?.find(condition => condition.name === 'Charmed')

    expect(charmedStatus?.duration).toBe(432000)
    expect(charmedStatus?.breakTriggers).toEqual([
      expect.objectContaining({
        trigger: 'caster_or_ally_damages_target',
        scope: 'effect'
      })
    ])
    expect(charmedStatus?.socialLifecycle).toEqual(expect.objectContaining({
      kind: 'awaken_charm',
      durationDays: 30,
      endsIfDamagedByCasterOrAllies: true,
      targetChoosesAttitudeOnEnd: true
    }))
    expect(charmedCondition?.socialLifecycle).toEqual(charmedStatus?.socialLifecycle)

    const afterCharmEnd = endAwakenCharmedRelationship(afterStatus, awakened!.id, {
      attitude: 'friendly but independent',
      reason: 'damage_by_caster_ally'
    })
    const completedAwakened = afterCharmEnd.activeAwakenedCreatures?.find(record => record.id === awakened!.id)

    expect(completedAwakened?.charmedRelationship).toEqual(expect.objectContaining({
      attitude: 'friendly but independent',
      endReason: 'damage_by_caster_ally'
    }))
    expect(afterCharmEnd.combatLog.some(entry =>
      entry.data?.awakenedCreatureSurface === 'awaken' &&
      entry.data?.attitude === 'friendly but independent' &&
      entry.data?.endReason === 'damage_by_caster_ally'
    )).toBe(true)
  })
})
