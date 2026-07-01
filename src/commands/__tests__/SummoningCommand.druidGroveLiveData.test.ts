import { describe, expect, it } from 'vitest'
import {
  UtilityCommand,
  endDruidGroveWard
} from '../effects/UtilityCommand'
import type { CombatCharacter } from '@/types/combat'
import type { Spell, UtilityEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import druidGrove from '../../../public/data/spells/level-6/druid-grove.json'

/**
 * This file proves Druid Grove's guardian trees are not just JSON prose.
 *
 * The runtime bridge stays deliberately bounded: it records the active ward,
 * selected guardian trees, command/boundary rules, and the spell-end reroot
 * cleanup without attempting to simulate every grove terrain effect.
 */

describe('Druid Grove live guardian ward bridge', () => {
  it('creates active guardian tree ward state and reroots guardians when the spell ends', () => {
    const spell = druidGrove as unknown as Spell
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')

    expect(utilityEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'grove-caster',
      name: 'Grove Caster',
      position: { x: 10, y: 10 },
      initiative: 18
    }) as CombatCharacter
    const firstTree = createMockCombatCharacter({
      id: 'tree-oak',
      name: 'Oak Guardian',
      position: { x: 12, y: 10 },
      initiative: 12
    }) as CombatCharacter
    const secondTree = createMockCombatCharacter({
      id: 'tree-ash',
      name: 'Ash Guardian',
      position: { x: 14, y: 10 },
      initiative: 11
    }) as CombatCharacter

    const state = createMockCombatState({
      characters: [caster, firstTree, secondTree]
    })

    const command = new UtilityCommand(utilityEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 6,
      caster,
      targets: [firstTree, secondTree],
      selectedSpellTargets: [{ kind: 'point', position: { x: 20, y: 20 }, purpose: 'grove_ward_origin' }],
      gameState: createMockGameState(),
      playerInput: 'Grove Guardian Trees'
    })

    const afterCast = command.execute(state)
    const ward = afterCast.activeSpellWards?.find(activeWard => activeWard.spellId === spell.id)

    expect(ward).toEqual(expect.objectContaining({
      spellId: spell.id,
      casterId: caster.id,
      kind: 'druid_grove',
      originPosition: { x: 20, y: 20 },
      area: expect.objectContaining({
        shape: 'cube',
        minSizeFeet: 30,
        maxSizeFeet: 90,
        excludesBuildingsAndStructures: true,
        radiatesMagic: true
      }),
      guardianTrees: expect.objectContaining({
        maxCount: 4,
        guardianIds: [firstTree.id, secondTree.id],
        statBlock: 'Awakened Tree except cannot speak',
        cannotSpeak: true,
        barkMarked: true,
        cannotLeaveWardedArea: true,
        obeysSpokenCommandsInArea: true,
        intruderResponse: 'attack intruders designated by grove rules',
        rerootsWhenSpellEndsIfPossible: true
      }),
      ending: expect.objectContaining({
        trigger: 'spell_ends',
        dispelRemovesOneEffectOnly: true,
        endsWhenAllEffectsRemoved: true
      }),
      aftermathState: expect.objectContaining({
        kind: 'guardian_tree_animation_cleanup',
        recovery: 'trees_take_root_again_if_possible'
      })
    }))

    expect(afterCast.combatLog.some(entry =>
      entry.data?.wardSurface === 'druid_grove' &&
      (entry.data?.spellWard as { guardianTrees?: { guardianIds?: string[] } } | undefined)
        ?.guardianTrees?.guardianIds?.includes(firstTree.id)
    )).toBe(true)

    const afterEnd = endDruidGroveWard(afterCast, ward!.id, 'spell_ends')

    expect(afterEnd.activeSpellWards?.some(activeWard => activeWard.id === ward!.id)).toBe(false)
    expect(afterEnd.combatLog.some(entry =>
      entry.data?.wardSurface === 'druid_grove' &&
      entry.data?.removedWardId === ward!.id &&
      (entry.data?.rerootedGuardianIds as string[] | undefined)?.includes(firstTree.id) &&
      entry.data?.rerootReason === 'spell_ends' &&
      entry.data?.rerootsWhenSpellEndsIfPossible === true
    )).toBe(true)
  })
})
