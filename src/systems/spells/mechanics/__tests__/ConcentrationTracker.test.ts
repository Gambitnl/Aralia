import { describe, it, expect, vi } from 'vitest'
import { ConcentrationTracker } from '../ConcentrationTracker'
// DiceRoller is no longer used directly by ConcentrationTracker, but savingThrowUtils uses combatUtils which uses Math.random
// We need to mock combatUtils to control the roll
import * as combatUtils from '@/utils/combatUtils'
import type { CombatCharacter, CombatState, ConcentrationState } from '@/types/combat'
import type { Spell } from '@/types/spells'

const mockCharacter: CombatCharacter = {
    id: 'char1',
    name: 'Test Character',
    stats: {
        constitution: 14 // Modifier +2
    },
    concentratingOn: undefined
} as unknown as CombatCharacter

const mockSpell: Spell = {
    id: 'spell1',
    name: 'Test Concentration Spell',
    level: 1,
    duration: {
        concentration: true,
        type: 'timed',
        value: 1,
        unit: 'minute'
    },
    effects: []
} as unknown as Spell

const mockGameState: CombatState = {
    characters: [mockCharacter],
    turnState: {
        currentTurn: 1
    }
} as unknown as CombatState

describe('ConcentrationTracker', () => {
  describe('rollConcentrationSave', () => {
    it('should calculate DC based on damage (half damage)', () => {
        // Damage 30 -> DC 15
        // Roll 10 -> Total 12 (10 + 2) -> Fail

        // Mock rollDice to return 10
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(10)

        const result = ConcentrationTracker.rollConcentrationSave(mockCharacter, 30)

        expect(result.dc).toBe(15)
        expect(result.success).toBe(false)
        vi.restoreAllMocks()
    })

    it('should use minimum DC of 10', () => {
        // Damage 4 -> Half is 2, but min DC is 10
        // Roll 10 -> Total 12 -> Success
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(10)

        const result = ConcentrationTracker.rollConcentrationSave(mockCharacter, 4)

        expect(result.dc).toBe(10)
        expect(result.success).toBe(true)
        vi.restoreAllMocks()
    })

    it('should include proficiency bonus if proficient in Constitution', () => {
        // Character proficient in Constitution saves (+3 PB at lvl 5 implied by system, but here we just check mod logic)
        // We'll mock a character with specific level and proficiency
        const proficientChar = {
            ...mockCharacter,
            level: 5, // PB is +3
            savingThrowProficiencies: ['Constitution']
        } as unknown as CombatCharacter

        // Roll 10
        // Con 14 (+2)
        // PB (+3)
        // Total = 15
        vi.spyOn(combatUtils, 'rollDice').mockReturnValue(10)

        const result = ConcentrationTracker.rollConcentrationSave(proficientChar, 4)

        // DC 10. Total 15. Success.
        expect(result.roll).toBe(15)
        expect(result.success).toBe(true)
        vi.restoreAllMocks()
    })
  })

  describe('isConcentrating', () => {
    it('should return true if character has concentratingOn object', () => {
        const concentratingChar = {
            ...mockCharacter,
            concentratingOn: { spellId: '1', spellName: 'Bless' }
        } as unknown as CombatCharacter

        expect(ConcentrationTracker.isConcentrating(concentratingChar, {} as CombatState)).toBe(true)
    })

    it('should return false if character has undefined concentratingOn', () => {
        const notConcentratingChar = {
            ...mockCharacter,
            concentratingOn: undefined
        } as unknown as CombatCharacter

        expect(ConcentrationTracker.isConcentrating(notConcentratingChar, {} as CombatState)).toBe(false)
    })
  })

  describe('startConcentration', () => {
      it('should set concentratingOn property on the character', () => {
          const newState = ConcentrationTracker.startConcentration(mockCharacter, mockSpell, mockGameState)
          const updatedChar = newState.characters.find(c => c.id === mockCharacter.id)

          expect(updatedChar?.concentratingOn).toBeDefined()
          expect(updatedChar?.concentratingOn?.spellId).toBe(mockSpell.id)
          expect(updatedChar?.concentratingOn?.spellName).toBe(mockSpell.name)
          expect(updatedChar?.concentratingOn?.spellLevel).toBe(mockSpell.level)
          expect(updatedChar?.concentratingOn?.startedTurn).toBe(mockGameState.turnState.currentTurn)
          expect(updatedChar?.concentratingOn?.canDropAsFreeAction).toBe(true)
      })

      it('should break existing concentration if already concentrating', () => {
          const existingConcentration: ConcentrationState = {
              spellId: 'oldSpell',
              spellName: 'Old Spell',
              spellLevel: 1,
              startedTurn: 0,
              effectIds: [],
              canDropAsFreeAction: true
          }
          const charWithConcentration = { ...mockCharacter, concentratingOn: existingConcentration }
          const stateWithConcentration = { ...mockGameState, characters: [charWithConcentration] }

          const newState = ConcentrationTracker.startConcentration(charWithConcentration, mockSpell, stateWithConcentration)
          const updatedChar = newState.characters.find(c => c.id === mockCharacter.id)

          expect(updatedChar?.concentratingOn?.spellId).toBe(mockSpell.id)
      })
  })

  describe('breakConcentration', () => {
      it('should remove concentratingOn property', () => {
          const existingConcentration: ConcentrationState = {
              spellId: 'oldSpell',
              spellName: 'Old Spell',
              spellLevel: 1,
              startedTurn: 0,
              effectIds: [],
              canDropAsFreeAction: true
          }
          const charWithConcentration = { ...mockCharacter, concentratingOn: existingConcentration }
          const stateWithConcentration = { ...mockGameState, characters: [charWithConcentration] }

          const newState = ConcentrationTracker.breakConcentration(charWithConcentration, stateWithConcentration)
          const updatedChar = newState.characters.find(c => c.id === mockCharacter.id)

          expect(updatedChar?.concentratingOn).toBeUndefined()
      })

      it('should remove associated status effects', () => {
          const effectId = 'effect1'
          const existingConcentration: ConcentrationState = {
              spellId: 'oldSpell',
              spellName: 'Old Spell',
              spellLevel: 1,
              startedTurn: 0,
              effectIds: [effectId],
              canDropAsFreeAction: true
          }

          const charWithEffect = {
              ...mockCharacter,
              statusEffects: [{ id: effectId, name: 'Effect', type: 'buff', duration: 1, effect: { type: 'stat_modifier' } }]
          } as unknown as CombatCharacter

           const charWithConcentration = { ...charWithEffect, concentratingOn: existingConcentration }

           const stateWithConcentration = { ...mockGameState, characters: [charWithConcentration] }

           const newState = ConcentrationTracker.breakConcentration(charWithConcentration, stateWithConcentration)
           const updatedChar = newState.characters.find(c => c.id === mockCharacter.id)

           expect(updatedChar?.concentratingOn).toBeUndefined()
           expect(updatedChar?.statusEffects.find(e => e.id === effectId)).toBeUndefined()
      })
  })
})
