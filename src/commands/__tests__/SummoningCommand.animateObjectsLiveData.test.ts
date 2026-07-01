import { describe, expect, it } from 'vitest'
import {
  UtilityCommand,
  revertAnimatedObject
} from '../effects/UtilityCommand'
import type { CombatCharacter } from '@/types/combat'
import type { EffectDuration, Spell, UtilityEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import animateObjects from '../../../public/data/spells/level-5/animate-objects.json'

/**
 * This file proves Animate Objects' controlled-entity contract reaches
 * runtime state. The bridge is deliberately bounded: it records animated
 * object control, stat, immunity, and reversion facts without trying to build
 * every size-specific actor and combat action in one slice.
 */

describe('Animate Objects live controlled object bridge', () => {
  it('records active animated object control metadata and reverts the object at 0 HP', () => {
    const spell = animateObjects as unknown as Spell
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')

    expect(utilityEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'animate-caster',
      name: 'Animate Caster',
      position: { x: 4, y: 4 },
      initiative: 16
    }) as CombatCharacter
    const state = createMockCombatState({
      characters: [caster]
    })

    const command = new UtilityCommand(utilityEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [],
      selectedSpellTargets: [
        {
          kind: 'object',
          id: 'bronze-statue',
          name: 'Bronze Statue',
          position: { x: 6, y: 4 },
          object: {
            id: 'bronze-statue',
            name: 'Bronze Statue',
            position: { x: 6, y: 4 },
            size: 'Large',
            isMagical: false,
            isWornOrCarried: false,
            isFixedToSurface: false
          }
        }
      ],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration,
      playerInput: 'size=Large'
    })

    const afterCast = command.execute(state)
    const animatedObject = afterCast.activeAnimatedObjects?.find(record => record.sourceObjectId === 'bronze-statue')

    expect(animatedObject).toEqual(expect.objectContaining({
      spellId: spell.id,
      casterId: caster.id,
      sourceObjectId: 'bronze-statue',
      sourceObjectName: 'Bronze Statue',
      size: 'Large',
      sizeCost: 2,
      creatureType: 'Construct',
      allegiance: 'ally',
      initiativePolicy: 'shared',
      armorClass: 15,
      maxHitPoints: 20,
      currentHitPoints: 20,
      speedFeet: 30,
      command: expect.objectContaining({
        action: 'Bonus Action',
        rangeFeet: 500,
        scope: 'commands one or all animated objects to move and act',
        noCommandBehavior: 'Dodges and avoids danger'
      }),
      immunities: expect.objectContaining({
        damage: ['Poison', 'Psychic'],
        conditions: ['Charmed', 'Exhaustion', 'Frightened', 'Paralyzed', 'Poisoned']
      }),
      slam: expect.objectContaining({
        attackBonusSource: 'caster_spell_attack_modifier',
        damage: '2d6 + 3 + spellcasting ability modifier Force',
        slotScaling: '+1d6 per slot level above 5'
      }),
      lifecycle: expect.objectContaining({
        reversion: 'when the creature drops to 0 hit points, it reverts to object form',
        damageCarryover: 'remaining damage carries over to the original object form'
      })
    }))
    expect(afterCast.combatLog.some(entry =>
      entry.data?.animatedObjectSurface === 'animate_objects' &&
      (entry.data?.animatedObjects as Array<{ sourceObjectId?: string }> | undefined)
        ?.some(record => record.sourceObjectId === 'bronze-statue')
    )).toBe(true)

    const afterReversion = revertAnimatedObject(afterCast, animatedObject!.id, {
      reason: 'created_entity_drops_to_0_hp',
      excessDamage: 7
    })
    const revertedObject = afterReversion.activeAnimatedObjects?.find(record => record.id === animatedObject!.id)

    expect(revertedObject?.active).toBe(false)
    expect(revertedObject?.currentHitPoints).toBe(0)
    expect(revertedObject?.lifecycle).toEqual(expect.objectContaining({
      revertedAtTurn: afterCast.turnState.currentTurn,
      reversionReason: 'created_entity_drops_to_0_hp',
      excessDamageCarriedOver: 7
    }))
    expect(afterReversion.combatLog.some(entry =>
      entry.data?.animatedObjectSurface === 'animate_objects' &&
      entry.data?.revertedAnimatedObjectId === animatedObject!.id &&
      entry.data?.excessDamageCarriedOver === 7
    )).toBe(true)
  })
})
