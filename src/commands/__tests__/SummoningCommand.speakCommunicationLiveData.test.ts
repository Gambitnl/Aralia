import { describe, expect, it } from 'vitest'
import { UtilityCommand } from '../effects/UtilityCommand'
import type { CombatCharacter } from '@/types/combat'
import type { EffectDuration, Spell, UtilityEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import speakWithDead from '../../../public/data/spells/level-3/speak-with-dead.json'
import speakWithPlants from '../../../public/data/spells/level-3/speak-with-plants.json'

/**
 * Speak with Dead and Speak with Plants create bounded communication/control
 * interfaces. They are not combat summons, but their counters, eligibility,
 * simple-command, terrain, and expiry facts still need durable runtime state.
 */
describe('Speak communication live control bridge', () => {
  it('records Speak with Dead corpse interrogation state from live data', () => {
    const spell = speakWithDead as unknown as Spell
    const effect = spell.effects.find((candidate): candidate is UtilityEffect => candidate.type === 'UTILITY')
    const payload = effect as (UtilityEffect & {
      corpseEligibility?: {
        requiresMouth?: boolean
        failsIfCreatureWasUndeadWhenItDied?: boolean
        failsIfTargetedWithinPastDays?: number
        questionLimit?: number
      }
      knowledgeEffect?: {
        questionLimit?: number
        answerWindowMinutes?: number
        corpseKnowsOnlyLifeKnowledge?: boolean
        includesKnownLanguages?: boolean
        cannotLearnNewInformation?: boolean
        cannotComprehendPostDeathEvents?: boolean
        cannotSpeculateAboutFuture?: boolean
        answersMayBeBriefCrypticOrRepetitive?: boolean
        noTruthCompulsionIfAntagonisticOrRecognizesEnemy?: boolean
      }
      communicationDetails?: {
        mode?: string
        answerQuality?: string[]
        truthCompulsion?: string
      }
      controlledEntity?: {
        entityType?: string
        combatEntity?: boolean
        soulReturned?: boolean
        animatingSpiritOnly?: boolean
      }
      targetCooldown?: {
        cooldownDays?: number
      }
    } | undefined)

    expect(payload?.controlledEntity).toEqual(expect.objectContaining({
      entityType: 'animated_corpse_spirit_interface',
      combatEntity: false,
      soulReturned: false,
      animatingSpiritOnly: true
    }))
    expect(payload?.corpseEligibility).toEqual(expect.objectContaining({
      requiresMouth: true,
      failsIfCreatureWasUndeadWhenItDied: true,
      failsIfTargetedWithinPastDays: 10,
      questionLimit: 5
    }))

    const caster = createCaster(spell, 12)
    const state = createState(caster, 12)
    const afterCast = new UtilityCommand(effect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 3,
      caster,
      targets: [],
      selectedSpellTargets: [
        {
          kind: 'object',
          id: 'corpse-1',
          name: 'Old Knight Corpse',
          position: { x: 4, y: 5 }
        }
      ],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)
    const control = afterCast.activeCommunicationControls?.find(record => record.spellId === spell.id)

    expect(control).toEqual(expect.objectContaining({
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      kind: 'speak_with_dead',
      entityType: 'animated_corpse_spirit_interface',
      targetId: 'corpse-1',
      targetName: 'Old Knight Corpse',
      active: true,
      createdTurn: 12,
      expiresAtRound: 112
    }))
    expect(control?.corpseInterrogation).toEqual(expect.objectContaining({
      requiresMouth: true,
      failsIfCreatureWasUndeadWhenItDied: true,
      cooldownDays: 10,
      questionLimit: 5,
      questionsRemaining: 5,
      answerWindowMinutes: 10,
      corpseKnowsOnlyLifeKnowledge: true,
      includesKnownLanguages: true,
      cannotLearnNewInformation: true,
      cannotComprehendPostDeathEvents: true,
      cannotSpeculateAboutFuture: true,
      answersMayBeBriefCrypticOrRepetitive: true,
      noTruthCompulsionIfAntagonisticOrRecognizesEnemy: true
    }))
  })

  it('records Speak with Plants sentience, commands, terrain, and expiry from live data', () => {
    const spell = speakWithPlants as unknown as Spell
    const effect = spell.effects.find((candidate): candidate is UtilityEffect => candidate.type === 'UTILITY')
    const payload = effect as (UtilityEffect & {
      plantInteraction?: {
        emanationRadiusFeet?: number
        plantsGainLimitedSentience?: boolean
        plantsCanCommunicateWithCaster?: boolean
        plantsCanFollowSimpleCommands?: boolean
        canQuestionAboutPastDayEvents?: boolean
        eventKnowledgeIncludes?: string[]
        canTurnPlantDifficultTerrainToOrdinary?: boolean
        canTurnOrdinaryPlantTerrainToDifficult?: boolean
        plantsCannotUprootThemselves?: boolean
        plantsCanMoveParts?: string[]
        plantCreaturesShareLanguageWithCaster?: boolean
        releasesEntangleRestrainedCreatures?: boolean
      }
      terrainConversion?: {
        areaShape?: string
        areaRadiusFeet?: number
        durationMinutes?: number
        conversions?: string[]
        requiresPlantsPresent?: boolean
      }
      communicationDetails?: {
        mode?: string
        targets?: string
        questionScope?: string
        simpleCommands?: boolean
      }
      controlledEntity?: {
        entityType?: string
        combatEntity?: boolean
        simpleCommands?: boolean
        communication?: boolean
        cannotUprootOrMove?: boolean
        allowedMotion?: string
        terrainControl?: string
      }
    } | undefined)

    expect(payload?.controlledEntity).toEqual(expect.objectContaining({
      entityType: 'limited_sentient_plants',
      combatEntity: false,
      simpleCommands: true,
      communication: true,
      cannotUprootOrMove: true
    }))
    expect(payload?.plantInteraction).toEqual(expect.objectContaining({
      emanationRadiusFeet: 30,
      plantsGainLimitedSentience: true,
      plantsCanCommunicateWithCaster: true,
      plantsCanFollowSimpleCommands: true,
      canQuestionAboutPastDayEvents: true,
      plantCreaturesShareLanguageWithCaster: true
    }))

    const caster = createCaster(spell, 6)
    const state = createState(caster, 6)
    const afterCast = new UtilityCommand(effect!, {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: 3,
      caster,
      targets: [],
      gameState: createMockGameState(),
      effectDuration: spell.duration as EffectDuration
    }).execute(state)
    const control = afterCast.activeCommunicationControls?.find(record => record.spellId === spell.id)

    expect(control).toEqual(expect.objectContaining({
      spellId: spell.id,
      spellName: spell.name,
      casterId: caster.id,
      kind: 'speak_with_plants',
      entityType: 'limited_sentient_plants',
      originPosition: caster.position,
      active: true,
      createdTurn: 6,
      expiresAtRound: 106
    }))
    expect(control?.plantCommunication).toEqual(expect.objectContaining({
      radiusFeet: 30,
      areaShape: 'Emanation',
      plantsGainLimitedSentience: true,
      plantsCanCommunicateWithCaster: true,
      plantsCanFollowSimpleCommands: true,
      canQuestionAboutPastDayEvents: true,
      plantCreaturesShareLanguageWithCaster: true,
      cannotUprootOrMove: true,
      allowedMotion: 'branches, tendrils, and stalks can move',
      releasesEntangleRestrainedCreatures: true
    }))
    expect(control?.plantCommunication?.terrainConversion).toEqual(expect.objectContaining({
      canTurnPlantDifficultTerrainToOrdinary: true,
      canTurnOrdinaryPlantTerrainToDifficult: true,
      requiresPlantsPresent: true,
      conversions: [
        'plant_growth_difficult_terrain_to_ordinary_terrain',
        'ordinary_plant_terrain_to_difficult_terrain'
      ]
    }))
  })
})

function createCaster(spell: Spell, currentTurn: number): CombatCharacter {
  return createMockCombatCharacter({
    id: `${spell.id}-caster`,
    name: `${spell.name} Caster`,
    position: { x: 3, y: 3 },
    initiative: 12
  }) as CombatCharacter
}

function createState(caster: CombatCharacter, currentTurn: number) {
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
