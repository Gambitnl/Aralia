import { describe, expect, it } from 'vitest'
import { BreakConcentrationCommand } from '../effects/ConcentrationCommands'
import { DamageCommand } from '../effects/DamageCommand'
import { StatusConditionCommand } from '../effects/StatusConditionCommand'
import type { CombatCharacter } from '@/types/combat'
import type { DamageEffect, EffectDuration, Spell, StatusConditionEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import wrathOfNature from '../../../public/data/spells/level-5/wrath-of-nature.json'

/**
 * Wrath of Nature animates environmental features in a controlled spell area.
 * The proof keeps those tree, root/vine, rock, terrain, ownership, and cleanup
 * facts together without inventing separate summoned creature actors.
 */
describe('Wrath of Nature live environmental-control bridge', () => {
  it('records the animated nature area, controlled options, and concentration cleanup', async () => {
    const spell = wrathOfNature as unknown as Spell
    const damageEffect = spell.effects.find((effect): effect is DamageEffect => effect.type === 'DAMAGE')
    const statusEffects = spell.effects.filter((effect): effect is StatusConditionEffect => effect.type === 'STATUS_CONDITION')
    const rootsEffect = statusEffects.find(effect => effect.statusCondition.name === 'Restrained')
    const rockEffect = statusEffects.find(effect => effect.statusCondition.name === 'Prone')
    const damagePayload = damageEffect as (DamageEffect & {
      controlledEntity?: { entityType?: string; combatEntity?: boolean; components?: string[] }
      createdObjects?: Array<{
        objectType?: string
        affectedVolumeShape?: string
        affectedVolumeSizeFeet?: number
        manipulationOptions?: string[]
        grassUndergrowthDifficultTerrainFor?: string
        treeAttackRadiusFeet?: number
        rootsVinesRestrictGroundedCreature?: boolean
        rockAttackRequiresLooseRock?: boolean
      }>
      areaTiming?: { timing?: string; targetFilter?: string }
    } | undefined)

    expect(damagePayload?.controlledEntity).toEqual(expect.objectContaining({
      entityType: 'animated_nature_area',
      combatEntity: false,
      components: expect.arrayContaining([
        'trees slash enemies',
        'roots restrain',
        'loose rocks launch by Bonus Action'
      ])
    }))
    expect(damagePayload?.createdObjects?.[0]).toEqual(expect.objectContaining({
      objectType: 'animated_nature_cube',
      affectedVolumeShape: 'Cube',
      affectedVolumeSizeFeet: 60,
      grassUndergrowthDifficultTerrainFor: 'enemies'
    }))
    expect(rootsEffect?.statusCondition.name).toBe('Restrained')
    expect(rockEffect?.grantedActions?.[0]).toEqual(expect.objectContaining({
      name: 'Launch Loose Rock',
      actionType: 'bonus_action',
      attackType: 'ranged_spell_attack'
    }))

    const caster = createMockCombatCharacter({
      id: 'wrath-caster',
      name: 'Wrath Caster',
      position: { x: 2, y: 2 },
      initiative: 12,
      concentratingOn: {
        spellId: spell.id,
        spellName: spell.name,
        spellLevel: 5,
        startedTurn: 3,
        effectIds: [],
        canDropAsFreeAction: true
      }
    }) as CombatCharacter
    let state = createMockCombatState({
      characters: [caster],
      turnState: {
        currentTurn: 3,
        turnOrder: [caster.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      }
    })

    state = await new DamageCommand(damageEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [],
      selectedSpellTargets: [
        {
          kind: 'point',
          position: { x: 8, y: 8 },
          purpose: 'ground_target'
        }
      ],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)
    state = await new StatusConditionCommand(rootsEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)
    state = await new StatusConditionCommand(rockEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)

    const control = state.activeEnvironmentalControls?.find(record => record.spellId === spell.id)

    expect(control).toEqual(expect.objectContaining({
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      kind: 'wrath_of_nature',
      entityType: 'animated_nature_area',
      originPosition: { x: 8, y: 8 },
      active: true,
      createdTurn: 3,
      expiresAtRound: 13
    }))
    expect(control?.area).toEqual(expect.objectContaining({
      shape: 'Cube',
      sizeFeet: 60,
      lineOfSightRequired: true
    }))
    expect(control?.terrain).toEqual(expect.objectContaining({
      difficultTerrainFor: 'enemies'
    }))
    expect(control?.treeAttacks).toEqual(expect.objectContaining({
      triggerTiming: 'start_of_each_caster_turn',
      targetFilter: 'enemies_within_10_feet_of_any_tree_in_the_cube',
      radiusFeet: 10,
      saveAbility: 'Dexterity',
      saveOutcome: 'half',
      damageDice: '4d6',
      damageType: 'Slashing'
    }))
    expect(control?.rootsAndVines).toEqual(expect.objectContaining({
      triggerTiming: 'end_of_each_caster_turn',
      targetFilter: 'one_grounded_creature_of_caster_choice_in_the_cube',
      saveAbility: 'Strength',
      saveOutcome: 'negates_condition',
      condition: 'Restrained',
      escapeSkill: 'Athletics'
    }))
    expect(control?.looseRocks).toEqual(expect.objectContaining({
      actionCost: 'bonus_action',
      actionName: 'Launch Loose Rock',
      target: 'visible_creature_in_cube',
      attackType: 'ranged_spell_attack',
      damageDice: '3d8',
      damageType: 'Bludgeoning',
      followupSaveAbility: 'Strength',
      failedSaveCondition: 'Prone'
    }))

    const afterBreak = await new BreakConcentrationCommand({
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 5,
      caster,
      targets: [],
      gameState: createMockGameState()
    }).execute(state)

    expect(afterBreak.activeEnvironmentalControls?.some(record => record.id === control?.id)).toBe(false)
  })
})
