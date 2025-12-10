import { describe, it, expect, vi } from 'vitest'
import { ConcentrationTracker } from '../ConcentrationTracker'
import { DiceRoller } from '../DiceRoller'
import type { CombatCharacter, CombatState, Spell, ConcentrationState } from '@/types'

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
        vi.spyOn(DiceRoller, 'rollD20').mockReturnValue(10)

        const result = ConcentrationTracker.rollConcentrationSave(mockCharacter, 30)

        expect(result.dc).toBe(15)
        expect(result.success).toBe(false)
        vi.restoreAllMocks()
    })

    it('should use minimum DC of 10', () => {
        // Damage 4 -> Half is 2, but min DC is 10
        // Roll 10 -> Total 12 -> Success
        vi.spyOn(DiceRoller, 'rollD20').mockReturnValue(10)

        const result = ConcentrationTracker.rollConcentrationSave(mockCharacter, 4)

        expect(result.dc).toBe(10)
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

          // Spy on breakConcentration to ensure it's called
          // Note: Since breakConcentration is static, spying on it might be tricky depending on how it's called internally.
          // Ideally we check the side effects.

          const newState = ConcentrationTracker.startConcentration(charWithConcentration, mockSpell, stateWithConcentration)
          const updatedChar = newState.characters.find(c => c.id === mockCharacter.id)

          expect(updatedChar?.concentratingOn?.spellId).toBe(mockSpell.id)
          // We can't easily verify breakConcentration was called unless we check side effects like removed status effects.
          // But for now, ensuring the new concentration replaced the old one is good.
      })
  })

  describe('breakConcentration', () => {
      it('should remove concentratingOn property', () => {
          const existingConcentration: ConcentrationState = {
              spellId: 'oldSpell',
              spellName: 'Old Spell',
              spellLevel: 1,
              startedTurn: 0,
              effectIds: [], // We'll test effect removal separately if we decide to implement it now
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
