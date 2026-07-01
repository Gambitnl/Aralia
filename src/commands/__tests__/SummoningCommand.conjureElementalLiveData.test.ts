import { describe, expect, it } from 'vitest'
import { BreakConcentrationCommand } from '../effects/ConcentrationCommands'
import {
  DamageCommand,
  recordConjureElementalRestraint,
  resolveConjureElementalRepeatSave
} from '../effects/DamageCommand'
import type { CombatCharacter } from '@/types/combat'
import type { DamageEffect, EffectDuration, Spell } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import conjureElemental from '../../../public/data/spells/level-5/conjure-elemental.json'

/**
 * Conjure Elemental creates an intangible elemental spirit, not a normal actor.
 * This proof keeps the chosen element, trigger rules, restrained target slot,
 * repeat-save behavior, and concentration cleanup in combat state.
 */
describe('Conjure Elemental live spirit bridge', () => {
  it('records active elemental spirit state, restrained-target lifecycle, and concentration cleanup', async () => {
    const spell = conjureElemental as unknown as Spell
    const damageEffect = spell.effects.find((effect): effect is DamageEffect => effect.type === 'DAMAGE')

    expect(damageEffect).toBeDefined()
    expect(damageEffect?.trigger.type).toBe('area_entry_or_turn_start')
    expect(damageEffect?.damage).toEqual({
      dice: '8d8',
      type: 'variable'
    })
    expect(spell.modeChoice?.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Air', damageType: 'Lightning' }),
      expect.objectContaining({ label: 'Earth', damageType: 'Thunder' }),
      expect.objectContaining({ label: 'Fire', damageType: 'Fire' }),
      expect.objectContaining({ label: 'Water', damageType: 'Cold' })
    ]))

    const caster = createMockCombatCharacter({
      id: 'elemental-caster',
      name: 'Elemental Caster',
      position: { x: 4, y: 4 },
      initiative: 12,
      concentratingOn: {
        spellId: spell.id,
        spellName: spell.name,
        spellLevel: 5,
        startedTurn: 6,
        effectIds: [],
        canDropAsFreeAction: true
      }
    }) as CombatCharacter
    const state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 6,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      }
    })

    const afterCast = await new DamageCommand(damageEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [],
      selectedSpellTargets: [
        {
          kind: 'point',
          position: { x: 9, y: 5 },
          purpose: 'ground_target'
        }
      ],
      playerInput: 'element=earth',
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)
    const spirit = afterCast.activeSpellGuardians?.find(record => record.spellId === spell.id)

    expect(spirit).toEqual(expect.objectContaining({
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      kind: 'conjure_elemental',
      position: { x: 9, y: 5 },
      size: 'Large',
      occupiesSpace: false,
      invulnerable: true,
      threatRadiusFeet: 5,
      active: true,
      createdTurn: 6,
      expiresAtRound: 106
    }))
    expect(spirit?.triggerPolicy).toEqual(expect.objectContaining({
      targets: 'visible_creatures',
      onEnterTrigger: true,
      onEnterFrequency: 'every_time',
      turnStartTrigger: true,
      saveAbility: 'Dexterity',
      saveOutcome: 'negates_condition',
      damageDice: '8d8',
      damageType: 'Thunder'
    }))
    expect(spirit?.elementalSpirit).toEqual(expect.objectContaining({
      origin: 'Elemental Planes',
      element: 'earth',
      damageType: 'Thunder',
      initialDamageDice: '8d8',
      repeatDamageDice: '4d8',
      intangible: true,
      restrainedTargetId: undefined
    }))
    expect(afterCast.combatLog.some(entry =>
      entry.data?.spellGuardianSurface === 'conjure_elemental' &&
      (entry.data?.spellGuardian as { id?: string } | undefined)?.id === spirit?.id
    )).toBe(true)

    const afterFailedSave = recordConjureElementalRestraint(afterCast, spirit!.id, {
      targetId: 'enemy-1',
      failedSave: true
    })
    const restrainingSpirit = afterFailedSave.activeSpellGuardians?.find(record => record.id === spirit?.id)

    expect(restrainingSpirit?.elementalSpirit?.restrainedTargetId).toBe('enemy-1')
    expect(afterFailedSave.combatLog.some(entry =>
      entry.data?.restrainedTargetId === 'enemy-1' &&
      entry.data?.damageDice === '8d8' &&
      entry.data?.damageType === 'Thunder'
    )).toBe(true)

    const afterRepeatFailure = resolveConjureElementalRepeatSave(afterFailedSave, spirit!.id, {
      targetId: 'enemy-1',
      failedSave: true
    })

    expect(afterRepeatFailure.activeSpellGuardians?.find(record => record.id === spirit?.id)?.elementalSpirit?.restrainedTargetId).toBe('enemy-1')
    expect(afterRepeatFailure.combatLog.some(entry =>
      entry.data?.repeatSaveOutcome === 'failed' &&
      entry.data?.damageDice === '4d8' &&
      entry.data?.damageType === 'Thunder'
    )).toBe(true)

    const afterRepeatSuccess = resolveConjureElementalRepeatSave(afterRepeatFailure, spirit!.id, {
      targetId: 'enemy-1',
      failedSave: false
    })

    expect(afterRepeatSuccess.activeSpellGuardians?.find(record => record.id === spirit?.id)?.elementalSpirit?.restrainedTargetId).toBeUndefined()
    expect(afterRepeatSuccess.combatLog.some(entry =>
      entry.data?.repeatSaveOutcome === 'succeeded' &&
      entry.data?.releasedTargetId === 'enemy-1'
    )).toBe(true)

    const afterBreak = await new BreakConcentrationCommand({
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [],
      gameState: createMockGameState()
    }).execute(afterRepeatSuccess)

    expect(afterBreak.activeSpellGuardians?.some(record => record.id === spirit?.id)).toBe(false)
  })
})
