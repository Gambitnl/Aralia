
import { describe, it, expect } from 'vitest'
import { ConcentrationTracker } from '@/systems/spells/mechanics/ConcentrationTracker'
import type { CombatState, CombatCharacter, ConcentrationState, LightSource, StatusEffect } from '@/types/combat'

describe('ConcentrationTracker', () => {
  const createMockCharacter = (id: string, concentratingOn?: ConcentrationState, statusEffects: StatusEffect[] = []): CombatCharacter => ({
    id,
    name: 'Test Character',
    level: 1,
    class: { name: 'Wizard', subclasses: [] }, // Minimal class
    position: { x: 0, y: 0 },
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      baseInitiative: 0,
      speed: 30,
      cr: '1/4'
    },
    abilities: [],
    team: 'player',
    currentHP: 10,
    maxHP: 10,
    initiative: 10,
    statusEffects,
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      movement: { used: 0, total: 30 },
      freeActions: 1
    },
    concentratingOn
  })

  const createMockState = (characters: CombatCharacter[], activeLightSources: LightSource[] = []): CombatState => ({
    isActive: true,
    characters,
    turnState: {
      currentTurn: 1,
      turnOrder: characters.map(c => c.id),
      currentCharacterId: characters[0]?.id || null,
      phase: 'action',
      actionsThisTurn: []
    },
    selectedCharacterId: null,
    selectedAbilityId: null,
    actionMode: 'select',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: [],
    activeLightSources
  })

  it('should break concentration', () => {
    const concentrationState: ConcentrationState = {
      spellId: 'spell-1',
      spellName: 'Bless',
      spellLevel: 1,
      startedTurn: 1,
      effectIds: ['effect-1'],
      canDropAsFreeAction: true
    }

    const character = createMockCharacter('char-1', concentrationState)
    const gameState = createMockState([character])

    const newState = ConcentrationTracker.breakConcentration(character, gameState)

    const updatedCharacter = newState.characters.find(c => c.id === character.id)
    expect(updatedCharacter?.concentratingOn).toBeUndefined()
  })

  it('should remove associated light sources when concentration breaks', () => {
    const concentrationState: ConcentrationState = {
      spellId: 'spell-light',
      spellName: 'Light',
      spellLevel: 0,
      startedTurn: 1,
      effectIds: [],
      canDropAsFreeAction: true
    }

    const lightSource: LightSource = {
        id: 'light-1',
        sourceSpellId: 'spell-light',
        casterId: 'char-1',
        brightRadius: 20,
        dimRadius: 20,
        attachedTo: 'point',
        createdTurn: 1
    }

    const character = createMockCharacter('char-1', concentrationState)
    const gameState = createMockState([character], [lightSource])

    const newState = ConcentrationTracker.breakConcentration(character, gameState)

    // Light source should be removed because it matches the spell ID
    expect(newState.activeLightSources).toHaveLength(0)
  })

  it('should add a log entry when concentration breaks', () => {
      const concentrationState: ConcentrationState = {
        spellId: 'spell-1',
        spellName: 'Bless',
        spellLevel: 1,
        startedTurn: 1,
        effectIds: ['effect-1'],
        canDropAsFreeAction: true
      }

      const character = createMockCharacter('char-1', concentrationState)
      const gameState = createMockState([character])

      const newState = ConcentrationTracker.breakConcentration(character, gameState)

      expect(newState.combatLog.length).toBeGreaterThan(0)
      expect(newState.combatLog[0].message).toContain('lost concentration')
  })

  it('should remove associated status effects when concentration breaks', () => {
    const concentrationState: ConcentrationState = {
      spellId: 'spell-1',
      spellName: 'Bless',
      spellLevel: 1,
      startedTurn: 1,
      effectIds: ['effect-1', 'effect-2'],
      canDropAsFreeAction: true
    }

    const statusEffect1: StatusEffect = {
        id: 'effect-1',
        name: 'Bless',
        type: 'buff',
        duration: 10,
        effect: { type: 'stat_modifier' }
    }

    const statusEffect2: StatusEffect = {
        id: 'effect-2',
        name: 'Bless',
        type: 'buff',
        duration: 10,
        effect: { type: 'stat_modifier' }
    }

    const unrelatedEffect: StatusEffect = {
        id: 'effect-3',
        name: 'Other',
        type: 'buff',
        duration: 10,
        effect: { type: 'stat_modifier' }
    }

    const caster = createMockCharacter('char-1', concentrationState, [statusEffect1])
    const ally = createMockCharacter('char-2', undefined, [statusEffect2, unrelatedEffect])

    const gameState = createMockState([caster, ally])

    const newState = ConcentrationTracker.breakConcentration(caster, gameState)

    const updatedCaster = newState.characters.find(c => c.id === 'char-1')
    const updatedAlly = newState.characters.find(c => c.id === 'char-2')

    // Caster should lose effect-1
    expect(updatedCaster?.statusEffects).toHaveLength(0)

    // Ally should lose effect-2 but keep effect-3
    expect(updatedAlly?.statusEffects).toHaveLength(1)
    expect(updatedAlly?.statusEffects[0].id).toBe('effect-3')
  })
})
