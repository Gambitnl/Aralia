import { describe, expect, it } from 'vitest'
import { UtilityCommand, moveMageHandHelper } from '../effects/UtilityCommand'
import type { CombatCharacter, CombatState } from '@/types/combat'
import type { EffectDuration, Spell, UtilityEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import mageHand from '../../../public/data/spells/level-0/mage-hand.json'

/**
 * Mage Hand is a controlled helper, not a creature summon or damaging force.
 * This proof keeps its movement, object-use limits, recast cleanup, and
 * caster-distance ending in combat state so those rules are executable.
 */
describe('Mage Hand live controlled helper bridge', () => {
  it('records active helper state, restrictions, recast cleanup, and distance ending', () => {
    const spell = mageHand as unknown as Spell
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')

    expect(utilityEffect).toBeDefined()
    expect(utilityEffect?.controlledEntity).toEqual(expect.objectContaining({
      entityType: 'spectral_hand',
      controlActionType: 'magic_action',
      movementDistance: 30,
      maxDistanceFromCaster: 30,
      canAttack: false,
      canActivateMagicItems: false,
      carryCapacityPounds: 10
    }))

    const caster = createMockCombatCharacter({
      id: 'mage-hand-caster',
      name: 'Mage Hand Caster',
      position: { x: 5, y: 5 },
      initiative: 13
    }) as CombatCharacter
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 7,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      }
    })
    const context = {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 0,
      caster,
      targets: [],
      selectedSpellTargets: [
        {
          kind: 'point' as const,
          position: { x: 8, y: 5 },
          purpose: 'ground_target'
        }
      ],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }

    const afterCast = new UtilityCommand(utilityEffect!, context).execute(state)
    const helper = afterCast.activeSpellHelpers?.find(record => record.spellId === spell.id)

    expect(helper).toEqual(expect.objectContaining({
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      kind: 'mage_hand',
      entityType: 'spectral_hand',
      position: { x: 8, y: 5 },
      size: 'Tiny',
      creature: false,
      occupiesSpace: false,
      active: true,
      createdTurn: 7,
      expiresAtRound: 17
    }))
    expect(helper?.control).toEqual({
      actionType: 'magic_action',
      initialUseOnCast: true,
      laterControlTiming: 'later_turns',
      movementDistanceFeet: 30
    })
    expect(helper?.restrictions).toEqual(expect.objectContaining({
      canAttack: false,
      canActivateMagicItems: false,
      carryCapacityPounds: 10,
      allowedInteractions: expect.arrayContaining([
        'manipulate_object',
        'open_unlocked_door_or_container',
        'stow_item_in_open_container',
        'retrieve_item_from_open_container',
        'pour_vial_contents'
      ])
    }))
    expect(helper?.separationEnding).toEqual({
      trigger: 'beyond_max_distance',
      scope: 'spell',
      maxDistanceFeet: 30
    })
    expect(helper?.recastEnding).toEqual({
      trigger: 'end_on_recast',
      scope: 'spell'
    })
    expect(afterCast.combatLog.some(entry =>
      entry.data?.spellHelperSurface === 'mage_hand' &&
      (entry.data?.spellHelper as { id?: string } | undefined)?.id === helper?.id
    )).toBe(true)

    const afterLegalMove = moveMageHandHelper(afterCast, helper!.id, { x: 10, y: 5 }, {
      casterPosition: caster.position
    })
    const movedHelper = afterLegalMove.activeSpellHelpers?.find(record => record.id === helper?.id)

    expect(movedHelper?.position).toEqual({ x: 10, y: 5 })
    expect(afterLegalMove.combatLog.some(entry =>
      entry.data?.movedHelperId === helper?.id &&
      entry.data?.movementFeet === 10
    )).toBe(true)

    const afterTooFarMove = moveMageHandHelper(afterLegalMove, helper!.id, { x: 17, y: 5 }, {
      casterPosition: caster.position
    })

    expect(afterTooFarMove.activeSpellHelpers?.find(record => record.id === helper?.id)?.position).toEqual({ x: 10, y: 5 })
    expect(afterTooFarMove.combatLog.some(entry =>
      entry.data?.rejectedHelperMoveId === helper?.id &&
      entry.data?.attemptedMoveFeet === 35
    )).toBe(true)

    const afterSeparation = moveMageHandHelper(afterLegalMove, helper!.id, { x: 11, y: 5 }, {
      casterPosition: { x: 0, y: 5 }
    })

    expect(afterSeparation.activeSpellHelpers?.some(record => record.id === helper?.id)).toBe(false)
    expect(afterSeparation.combatLog.some(entry =>
      entry.data?.endedHelperId === helper?.id &&
      entry.data?.endReason === 'beyond_max_distance' &&
      entry.data?.separationFeet === 55
    )).toBe(true)

    const afterRecast = new UtilityCommand(utilityEffect!, context).execute(afterCast)
    const recastHelpers = afterRecast.activeSpellHelpers?.filter(record => record.spellId === spell.id)

    expect(recastHelpers).toHaveLength(1)
    expect(recastHelpers?.[0]?.id).not.toBe(helper?.id)
    expect(afterRecast.combatLog.some(entry =>
      entry.data?.spellHelperSurface === 'mage_hand' &&
      entry.data?.removedRecastHelpers === 1
    )).toBe(true)
  })
})
