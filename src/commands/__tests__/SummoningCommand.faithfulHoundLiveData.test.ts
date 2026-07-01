import { describe, expect, it } from 'vitest'
import { DamageCommand, moveFaithfulHoundGuardian } from '../effects/DamageCommand'
import type { CombatCharacter } from '@/types/combat'
import type { DamageEffect, EffectDuration, Spell } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import faithfulHound from '../../../public/data/spells/level-4/mordenkainens-faithful-hound.json'

/**
 * Mordenkainen's Faithful Hound creates a phantom watchdog, not a summon actor.
 * This proof keeps the hound's visibility, alarm, bite, movement, and distance
 * ending facts in combat state without giving the invulnerable hound creature HP.
 */

describe("Mordenkainen's Faithful Hound live watchdog bridge", () => {
  it('records active watchdog state, magic-action movement, and separation cleanup', async () => {
    const spell = faithfulHound as unknown as Spell
    const damageEffect = spell.effects.find((effect): effect is DamageEffect => effect.type === 'DAMAGE')

    expect(damageEffect).toBeDefined()
    expect(damageEffect?.trigger.type).toBe('turn_start')
    expect(damageEffect?.damage).toEqual(expect.objectContaining({
      dice: '4d8',
      type: 'Force'
    }))
    expect(damageEffect?.condition).toEqual(expect.objectContaining({
      type: 'save',
      saveType: 'Dexterity',
      saveEffect: 'negates_condition'
    }))

    const caster = createMockCombatCharacter({
      id: 'hound-caster',
      name: 'Hound Caster',
      position: { x: 4, y: 4 },
      initiative: 14
    }) as CombatCharacter
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 5,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      }
    })

    const command = new DamageCommand(damageEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 4,
      caster,
      targets: [],
      selectedSpellTargets: [
        {
          kind: 'point',
          position: { x: 8, y: 5 },
          purpose: 'ground_target'
        }
      ],
      playerInput: 'password=moonrise',
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    })

    const afterCast = await command.execute(state)
    const hound = afterCast.activeSpellGuardians?.find(record => record.spellId === spell.id)

    expect(hound).toEqual(expect.objectContaining({
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      kind: 'faithful_hound',
      position: { x: 8, y: 5 },
      size: 'Medium',
      occupiesSpace: false,
      invulnerable: true,
      threatRadiusFeet: 5,
      active: true,
      createdTurn: 5,
      expiresAtRound: 4805
    }))
    expect(hound?.watchdog).toEqual(expect.objectContaining({
      visibleTo: 'caster_only',
      intangible: true,
      truesightFeet: 30,
      barkingAlarmRadiusFeet: 30,
      barkTrigger: 'Small or larger creature comes within 30 feet without speaking the password',
      password: 'moonrise',
      passwordPreventsBark: true
    }))
    expect(hound?.triggerPolicy).toEqual(expect.objectContaining({
      targets: 'enemy_creatures',
      onEnterTrigger: false,
      turnStartTrigger: true,
      saveAbility: 'Dexterity',
      saveOutcome: 'negates_condition',
      damageAmount: 4,
      damageDice: '4d8',
      damageType: 'Force'
    }))
    expect(hound?.movement).toEqual(expect.objectContaining({
      action: 'Magic action',
      maxDistanceFeet: 30
    }))
    expect(hound?.separationEnding).toEqual(expect.objectContaining({
      maxDistanceFeet: 300,
      scope: 'spell'
    }))
    expect(afterCast.combatLog.some(entry =>
      entry.data?.spellGuardianSurface === 'faithful_hound' &&
      (entry.data?.spellGuardian as { id?: string } | undefined)?.id === hound?.id
    )).toBe(true)

    const afterMove = moveFaithfulHoundGuardian(afterCast, hound!.id, { x: 12, y: 5 }, {
      casterPosition: caster.position
    })
    const movedHound = afterMove.activeSpellGuardians?.find(record => record.id === hound?.id)

    expect(movedHound?.position).toEqual({ x: 12, y: 5 })
    expect(afterMove.combatLog.some(entry =>
      entry.data?.spellGuardianSurface === 'faithful_hound' &&
      entry.data?.moveReason === 'magic_action'
    )).toBe(true)

    const afterSeparation = moveFaithfulHoundGuardian(afterMove, hound!.id, { x: 13, y: 5 }, {
      casterPosition: { x: -60, y: 5 }
    })

    expect(afterSeparation.activeSpellGuardians?.some(record => record.id === hound?.id)).toBe(false)
    expect(afterSeparation.combatLog.some(entry =>
      entry.data?.spellGuardianSurface === 'faithful_hound' &&
      entry.data?.endingReason === 'beyond_max_distance'
    )).toBe(true)
  })
})
