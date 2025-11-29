import { describe, it, expect } from 'vitest'
import { TargetResolver } from '../TargetResolver'
import type { SpellTargeting } from '@/types'
import type { CombatCharacter, CombatState, Position } from '@/types'

// Mock Character
const createMockChar = (id: string, team: 'player' | 'enemy', x: number, y: number): CombatCharacter => ({
  id,
  name: id,
  team,
  position: { x, y },
  // Stub other required fields
  class: {} as any,
  stats: {} as any,
  abilities: [],
  currentHP: 10,
  maxHP: 10,
  initiative: 10,
  statusEffects: [],
  actionEconomy: {} as any
})

const caster = createMockChar('hero', 'player', 10, 10)
const ally = createMockChar('ally', 'player', 12, 10) // 10ft away
const enemyClose = createMockChar('goblin', 'enemy', 11, 10) // 5ft away
const enemyFar = createMockChar('archer', 'enemy', 20, 10) // 50ft away

const mockGameState: CombatState = {
  characters: [caster, ally, enemyClose, enemyFar],
  // Stub other fields
  isActive: true,
  turnState: {} as any,
  selectedCharacterId: null,
  selectedAbilityId: null,
  actionMode: 'select',
  validTargets: [],
  validMoves: []
}

describe('TargetResolver', () => {
  describe('isValidTarget', () => {
    it('should handle Self targeting', () => {
      const targeting: SpellTargeting = { type: 'self', validTargets: ['self'] }
      
      expect(TargetResolver.isValidTarget(targeting, caster, caster, mockGameState)).toBe(true)
      expect(TargetResolver.isValidTarget(targeting, caster, ally, mockGameState)).toBe(false)
    })

    it('should validate Range', () => {
      const targeting: SpellTargeting = { 
        type: 'single', 
        range: 30, 
        validTargets: ['creatures'] 
      }

      expect(TargetResolver.isValidTarget(targeting, caster, enemyClose, mockGameState)).toBe(true) // 5ft
      expect(TargetResolver.isValidTarget(targeting, caster, enemyFar, mockGameState)).toBe(false) // 50ft
    })

    it('should filter by Team (Enemies)', () => {
      const targeting: SpellTargeting = { 
        type: 'single', 
        range: 60, 
        validTargets: ['enemies'] 
      }

      expect(TargetResolver.isValidTarget(targeting, caster, enemyClose, mockGameState)).toBe(true)
      expect(TargetResolver.isValidTarget(targeting, caster, ally, mockGameState)).toBe(false)
    })

    it('should filter by Team (Allies)', () => {
        const targeting: SpellTargeting = { 
          type: 'single', 
          range: 60, 
          validTargets: ['allies'] 
        }
  
        expect(TargetResolver.isValidTarget(targeting, caster, ally, mockGameState)).toBe(true)
        expect(TargetResolver.isValidTarget(targeting, caster, enemyClose, mockGameState)).toBe(false)
    })
  })

  describe('getValidTargets', () => {
    it('should return all valid targets', () => {
        const targeting: SpellTargeting = { 
            type: 'single', 
            range: 60, 
            validTargets: ['enemies'] 
        }
        
        const targets = TargetResolver.getValidTargets(targeting, caster, mockGameState)
        expect(targets).toHaveLength(2) // enemyClose and enemyFar
        expect(targets).toContainEqual(enemyClose)
        expect(targets).toContainEqual(enemyFar)
        expect(targets).not.toContainEqual(ally)
    })
  })
})
