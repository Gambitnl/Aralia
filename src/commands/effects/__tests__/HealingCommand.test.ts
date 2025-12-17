import { describe, it, expect } from 'vitest'
import { HealingCommand } from '../HealingCommand'
import { CombatState, CombatCharacter } from '@/types/combat'
import { HealingEffect } from '@/types/spells'
import { CommandContext } from '../../base/SpellCommand'

// Mock dependencies
const mockCharacter: CombatCharacter = {
  id: 'char-1',
  name: 'Test Character',
  currentHP: 10,
  maxHP: 20,
  tempHP: 0,
  position: { x: 0, y: 0 },
  team: 'player',
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
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    movement: { used: 0, total: 30 },
    freeActions: 1
  },
  abilities: [],
  statusEffects: [],
  level: 1,
  class: {
      name: 'Fighter',
      level: 1,
      hitDie: 'd10',
      proficiencies: [],
      savingThrows: [],
      features: []
  }
}

const mockState: CombatState = {
  isActive: true,
  characters: [mockCharacter],
  turnState: {
    currentTurn: 1,
    turnOrder: ['char-1'],
    currentCharacterId: 'char-1',
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
  activeLightSources: []
}

const mockContext: CommandContext = {
    spellId: 'spell-1',
    spellName: 'Test Heal',
    castAtLevel: 1,
    caster: { ...mockCharacter, id: 'caster-1', name: 'Caster' }, // Needs full CombatCharacter object
    targets: [mockCharacter],
    gameState: {} as any // Minimal mock
}

describe('HealingCommand', () => {
  it('should apply regular healing correctly', () => {
    const effect: HealingEffect = {
      type: 'HEALING',
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      healing: { dice: '1d1+4' } // Always 5
    }

    const command = new HealingCommand(effect, mockContext)
    const newState = command.execute(mockState)
    const target = newState.characters.find(c => c.id === 'char-1')

    expect(target?.currentHP).toBe(15) // 10 + 5
    expect(target?.tempHP).toBe(0)

    // Check log
    const logEntry = newState.combatLog[0]
    expect(logEntry.message).toContain('is healed for')
  })

  it('should cap regular healing at maxHP', () => {
    const effect: HealingEffect = {
      type: 'HEALING',
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      healing: { dice: '1d1+20' } // Large heal
    }

    const command = new HealingCommand(effect, mockContext)
    const newState = command.execute(mockState)
    const target = newState.characters.find(c => c.id === 'char-1')

    expect(target?.currentHP).toBe(20) // Capped at maxHP
  })

  it('should apply temporary HP when flagged', () => {
    const effect: HealingEffect = {
      type: 'HEALING',
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      healing: { dice: '1d1+4', isTemporaryHp: true } // 5 Temp HP
    }

    const command = new HealingCommand(effect, mockContext)
    const newState = command.execute(mockState)
    const target = newState.characters.find(c => c.id === 'char-1')

    expect(target?.currentHP).toBe(10) // HP Unchanged
    expect(target?.tempHP).toBe(5) // New Temp HP
  })

  it('should respect higher temporary HP rule (keep existing higher)', () => {
    const charWithTempHP = { ...mockCharacter, tempHP: 10 }
    const stateWithTempHP = { ...mockState, characters: [charWithTempHP] }

    const effect: HealingEffect = {
      type: 'HEALING',
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      healing: { dice: '1d1+4', isTemporaryHp: true } // 5 Temp HP (lower than 10)
    }

    const command = new HealingCommand(effect, mockContext)
    const newState = command.execute(stateWithTempHP)
    const target = newState.characters.find(c => c.id === 'char-1')

    expect(target?.tempHP).toBe(10) // Should not decrease
  })

  it('should respect higher temporary HP rule (replace with new higher)', () => {
    const charWithTempHP = { ...mockCharacter, tempHP: 3 }
    const stateWithTempHP = { ...mockState, characters: [charWithTempHP] }

    const effect: HealingEffect = {
      type: 'HEALING',
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      healing: { dice: '1d1+4', isTemporaryHp: true } // 5 Temp HP (higher than 3)
    }

    const command = new HealingCommand(effect, mockContext)
    const newState = command.execute(stateWithTempHP)
    const target = newState.characters.find(c => c.id === 'char-1')

    expect(target?.tempHP).toBe(5) // Should increase
  })
})
