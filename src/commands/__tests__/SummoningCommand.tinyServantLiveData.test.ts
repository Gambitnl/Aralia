import { describe, expect, it } from 'vitest'
import {
  UtilityCommand,
  revertAnimatedObject
} from '../effects/UtilityCommand'
import type { CombatCharacter } from '@/types/combat'
import type { EffectDuration, Spell, UtilityEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import tinyServant from '../../../public/data/spells/level-3/tiny-servant.json'

/**
 * Tiny Servant already carries structured object-reversion and command payload
 * data. This proof keeps that authored packet tied to the live animated-object
 * runtime bridge instead of leaving the spell at schema-only preservation.
 */
describe('Tiny Servant live animated-object bridge', () => {
  it('creates a persistent servant record with command and reversion metadata', () => {
    const spell = tinyServant as unknown as Spell
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')

    expect(utilityEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'tiny-servant-caster',
      name: 'Tiny Servant Caster',
      position: { x: 2, y: 2 },
      initiative: 14
    }) as CombatCharacter
    const state = createMockCombatState({
      characters: [caster]
    })

    const command = new UtilityCommand(utilityEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 3,
      caster,
      targets: [],
      selectedSpellTargets: [
        {
          kind: 'object',
          id: 'tiny-gear',
          name: 'Tiny Gear',
          position: { x: 3, y: 2 },
          object: {
            id: 'tiny-gear',
            name: 'Tiny Gear',
            position: { x: 3, y: 2 },
            size: 'Tiny',
            isMagical: false,
            isWornOrCarried: false,
            isFixedToSurface: false
          }
        }
      ],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    })

    const afterCast = command.execute(state)
    const servant = afterCast.activeAnimatedObjects?.find(record => record.sourceObjectId === 'tiny-gear')

    expect(servant).toEqual(expect.objectContaining({
      spellId: spell.id,
      casterId: caster.id,
      sourceObjectId: 'tiny-gear',
      sourceObjectName: 'Tiny Gear',
      size: 'Tiny',
      sizeCost: 1,
      creatureType: 'Construct',
      allegiance: 'ally',
      initiativePolicy: 'shared',
      armorClass: 15,
      maxHitPoints: 10,
      currentHitPoints: 10,
      speedFeet: 30,
      command: expect.objectContaining({
        action: 'Bonus Action',
        rangeFeet: 120,
        scope: 'can command any or all servants from this spell at once with the same command',
        noCommandBehavior: 'does nothing except defend itself against hostile creatures'
      }),
      lifecycle: expect.objectContaining({
        reversion: 'when it drops to 0 hit points, it reverts to its original object form',
        damageCarryover: 'remaining damage carries over to the original object form'
      }),
      active: true
    }))
    expect(servant?.expiresAtRound).toBeDefined()
    expect(afterCast.combatLog.some(entry =>
      entry.data?.animatedObjectSurface === 'animate_objects' &&
      (entry.data?.animatedObjects as Array<{ sourceObjectId?: string }> | undefined)
        ?.some(record => record.sourceObjectId === 'tiny-gear')
    )).toBe(true)

    const afterReversion = revertAnimatedObject(afterCast, servant!.id, {
      reason: 'spell_ends'
    })
    const revertedServant = afterReversion.activeAnimatedObjects?.find(record => record.id === servant!.id)

    expect(revertedServant?.active).toBe(false)
    expect(revertedServant?.currentHitPoints).toBe(0)
    expect(revertedServant?.lifecycle).toEqual(expect.objectContaining({
      revertedAtTurn: afterCast.turnState.currentTurn,
      reversionReason: 'spell_ends',
      excessDamageCarriedOver: 0
    }))
    expect(afterReversion.combatLog.some(entry =>
      entry.data?.animatedObjectSurface === 'animate_objects' &&
      entry.data?.revertedAnimatedObjectId === servant!.id &&
      entry.data?.reversionReason === 'spell_ends'
    )).toBe(true)
  })
})
