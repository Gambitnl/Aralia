import { describe, expect, it } from 'vitest'
import { BreakConcentrationCommand } from '../effects/ConcentrationCommands'
import { DamageCommand } from '../effects/DamageCommand'
import { TerrainCommand } from '../effects/TerrainCommand'
import { UtilityCommand } from '../effects/UtilityCommand'
import type { CombatCharacter } from '@/types/combat'
import type { DamageEffect, EffectDuration, Spell, TerrainEffect, UtilityEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import conjureMinorElementals from '../../../public/data/spells/level-4/conjure-minor-elementals.json'
import conjureWoodlandBeings from '../../../public/data/spells/level-4/conjure-woodland-beings.json'

/**
 * Conjure Minor Elementals and Conjure Woodland Beings create caster-following
 * spirit emanations, not independent creature actors. These live-data proofs
 * keep the aura, rider damage, terrain/granted-action facts, and concentration
 * cleanup explicit for later map-trigger automation.
 */
describe('Conjure spirit emanation live-data bridge', () => {
  it('records Conjure Minor Elementals as a caster-following elemental emanation', async () => {
    const spell = conjureMinorElementals as unknown as Spell
    const damageEffect = spell.effects.find((effect): effect is DamageEffect => effect.type === 'DAMAGE')
    const terrainEffect = spell.effects.find((effect): effect is TerrainEffect => effect.type === 'TERRAIN')

    const damageEntity = damageEffect as (DamageEffect & {
      controlledEntity?: { entityType?: string; combatEntity?: boolean; followsCaster?: boolean }
    } | undefined)
    const terrainPayload = terrainEffect as (TerrainEffect & {
      createdObjects?: Array<{
        objectType?: string
        createsDifficultTerrain?: boolean
        difficultTerrainAppliesTo?: string
      }>
    } | undefined)

    expect(damageEntity?.controlledEntity).toEqual(expect.objectContaining({
      entityType: 'elemental_spirit_emanation',
      combatEntity: false,
      followsCaster: true
    }))
    expect(terrainPayload?.createdObjects?.[0]).toEqual(expect.objectContaining({
      objectType: 'elemental_spirit_emanation',
      createsDifficultTerrain: true,
      difficultTerrainAppliesTo: 'caster_enemies'
    }))

    const caster = createConjureCaster(spell, 4)
    let state = createEmanationState(caster, 4)

    state = await new DamageCommand(damageEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 4,
      caster,
      targets: [],
      playerInput: 'Lightning',
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)
    state = new TerrainCommand(terrainEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 4,
      caster,
      targets: [],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)

    const emanation = state.activeSpellEmanations?.find(record => record.spellId === spell.id)

    expect(emanation).toEqual(expect.objectContaining({
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      kind: 'elemental_spirit_emanation',
      entityType: 'elemental_spirit_emanation',
      radiusFeet: 15,
      combatEntity: false,
      followsCaster: true,
      createdTurn: 4,
      expiresAtRound: 104,
      active: true
    }))
    expect(emanation?.damageRider).toEqual(expect.objectContaining({
      trigger: 'on_attack_hit',
      dice: '2d8',
      damageTypeChoices: ['Acid', 'Cold', 'Fire', 'Lightning'],
      chosenDamageType: 'Lightning',
      slotScaling: '+1d8'
    }))
    expect(emanation?.terrain).toEqual(expect.objectContaining({
      terrainType: 'difficult',
      appliesTo: 'caster_enemies',
      followsCaster: true,
      createsDifficultTerrain: true
    }))

    const afterBreak = await new BreakConcentrationCommand({
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 4,
      caster,
      targets: [],
      gameState: createMockGameState()
    }).execute(state)

    expect(afterBreak.activeSpellEmanations?.some(record => record.spellId === spell.id)).toBe(false)
  })

  it('records Conjure Woodland Beings as a caster-following damage aura with bonus Disengage', async () => {
    const spell = conjureWoodlandBeings as unknown as Spell
    const damageEffect = spell.effects.find((effect): effect is DamageEffect => effect.type === 'DAMAGE')
    const utilityEffect = spell.effects.find((effect): effect is UtilityEffect => effect.type === 'UTILITY')

    const damageEntity = damageEffect as (DamageEffect & {
      controlledEntity?: { entityType?: string; combatEntity?: boolean; followsCaster?: boolean }
    } | undefined)

    expect(damageEntity?.controlledEntity).toEqual(expect.objectContaining({
      entityType: 'nature_spirit_emanation',
      combatEntity: false,
      followsCaster: true
    }))
    expect(utilityEffect?.grantedActions?.[0]).toEqual(expect.objectContaining({
      type: 'bonus_action',
      action: 'Disengage',
      frequency: 'while_active'
    }))

    const caster = createConjureCaster(spell, 8)
    let state = createEmanationState(caster, 8)

    state = await new DamageCommand(damageEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 4,
      caster,
      targets: [],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)
    state = new UtilityCommand(utilityEffect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 4,
      caster,
      targets: [],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)

    const emanation = state.activeSpellEmanations?.find(record => record.spellId === spell.id)

    expect(emanation).toEqual(expect.objectContaining({
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      kind: 'nature_spirit_emanation',
      entityType: 'nature_spirit_emanation',
      radiusFeet: 10,
      combatEntity: false,
      followsCaster: true,
      createdTurn: 8,
      expiresAtRound: 108,
      active: true
    }))
    expect(emanation?.damageAura).toEqual(expect.objectContaining({
      trigger: 'emanation_entry_or_turn_end',
      dice: '5d8',
      damageType: 'Force',
      saveAbility: 'Wisdom',
      saveOutcome: 'half',
      oncePerTurn: true,
      slotScaling: '+1d8'
    }))
    expect(emanation?.grantedActions).toEqual([
      expect.objectContaining({
        type: 'bonus_action',
        action: 'Disengage',
        frequency: 'while_active'
      })
    ])

    const afterBreak = await new BreakConcentrationCommand({
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 4,
      caster,
      targets: [],
      gameState: createMockGameState()
    }).execute(state)

    expect(afterBreak.activeSpellEmanations?.some(record => record.spellId === spell.id)).toBe(false)
  })
})

function createConjureCaster(spell: Spell, currentTurn: number): CombatCharacter {
  return createMockCombatCharacter({
    id: `${spell.id}-caster`,
    name: `${spell.name} Caster`,
    position: { x: 5, y: 5 },
    initiative: 12,
    concentratingOn: {
      spellId: spell.id,
      spellName: spell.name,
      spellLevel: spell.level,
      startedTurn: currentTurn,
      effectIds: [],
      canDropAsFreeAction: true
    }
  }) as CombatCharacter
}

function createEmanationState(caster: CombatCharacter, currentTurn: number) {
  return createMockCombatState({
    characters: [caster],
    turnState: {
      currentTurn,
      turnOrder: [caster.id],
      currentCharacterId: caster.id,
      phase: 'action',
      actionsThisTurn: []
    }
  })
}
