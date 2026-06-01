import { describe, it, expect, beforeEach } from 'vitest'
import { TargetResolver } from '../TargetResolver'
// TODO(lint-intent): 'Position' is unused in this test; use it in the assertion path or remove it.
import type { SpellTargeting } from '@/types/spells'
import type { BattleMapTile , CombatCharacter, CombatState, Position as _Position, BattleMapData, TurnState } from '@/types/combat'


// Mock Character
const createMockChar = (id: string, team: 'player' | 'enemy', x: number, y: number): CombatCharacter => ({
  id,
  name: id,
  team,
  position: { x, y },
  // Stub other required fields
  // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
  class: {} as unknown,
  // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
  stats: {} as unknown,
  abilities: [],
  currentHP: 10,
  maxHP: 10,
  initiative: 10,
  statusEffects: [],
  // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
  actionEconomy: {} as unknown
} as unknown as CombatCharacter)

const createMockTile = (x: number, y: number, blocksLoS: boolean = false): BattleMapTile => ({
  id: `${x}-${y}`,
  coordinates: { x, y },
  terrain: 'grass',
  elevation: 0,
  movementCost: 1,
  blocksLoS,
  blocksMovement: blocksLoS,
  decoration: null,
  effects: []
})

describe('TargetResolver', () => {
  let caster: CombatCharacter
  let ally: CombatCharacter
  let enemyClose: CombatCharacter
  let enemyFar: CombatCharacter
  let mockGameState: CombatState
  // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
  let mockMapData: BattleMapData

  beforeEach(() => {
    caster = createMockChar('hero', 'player', 10, 10)
    ally = createMockChar('ally', 'player', 12, 10) // 10ft away
    enemyClose = createMockChar('goblin', 'enemy', 11, 10) // 5ft away
    enemyFar = createMockChar('archer', 'enemy', 20, 10) // 50ft away

    mockMapData = {
      dimensions: { width: 30, height: 30 },
      tiles: new Map<string, BattleMapTile>(),
      theme: 'forest' as const,
      seed: 123
    }

    // Populate map tiles
    for (let x = 0; x < 30; x++) {
      for (let y = 0; y < 30; y++) {
        mockMapData.tiles.set(`${x}-${y}`, createMockTile(x, y))
      }
    }

    mockGameState = {
      characters: [caster, ally, enemyClose, enemyFar],
      isActive: true,
      // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
      turnState: {} as unknown as TurnState,
      selectedCharacterId: null,
      selectedAbilityId: null,
      actionMode: 'select',
      validTargets: [],
      validMoves: [],
      mapData: mockMapData,
      combatLog: [],
      reactiveTriggers: [],
      activeLightSources: []
    }
  })

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

    it('should check Line of Sight', () => {
      // Place a wall between caster (10,10) and enemyBlocked (15,10)
      const enemyBlocked = createMockChar('blocked', 'enemy', 15, 10)
      mockGameState.characters.push(enemyBlocked)

      // Wall at 12,10 (blocking the path)
      mockMapData.tiles.set('12-10', createMockTile(12, 10, true))

      const targeting: SpellTargeting = {
        type: 'single',
        range: 60,
        validTargets: ['enemies'],
        lineOfSight: true
      }

      // Should fail due to wall
      expect(TargetResolver.isValidTarget(targeting, caster, enemyBlocked, mockGameState)).toBe(false)

      // Clear wall
      mockMapData.tiles.set('12-10', createMockTile(12, 10, false))

      // Should pass now
      expect(TargetResolver.isValidTarget(targeting, caster, enemyBlocked, mockGameState)).toBe(true)
    })

    it('validates object targets separately from creature targets', () => {
      const targeting: SpellTargeting = {
        type: 'single',
        range: 60,
        validTargets: ['objects'],
        filter: {
          objectEligibility: {
            wornOrCarried: 'excluded',
            magicalStatus: 'nonmagical',
            fixedToSurface: 'excluded',
            maxSize: 'Small',
            maxWeightPounds: 5,
            maxWeightScaling: 'not_applicable'
          }
        }
      }

      expect(TargetResolver.isValidTarget(targeting, caster, enemyClose, mockGameState)).toBe(false)
      expect(TargetResolver.isValidObjectTarget(targeting, caster, {
        id: 'loose-stone',
        name: 'Loose Stone',
        position: { x: 11, y: 10 },
        size: 'Tiny',
        weightPounds: 3,
        isWornOrCarried: false,
        isMagical: false,
        isFixedToSurface: false
      }, mockGameState)).toBe(true)
      expect(TargetResolver.isValidObjectTarget(targeting, caster, {
        id: 'magic-stone',
        name: 'Magic Stone',
        position: { x: 11, y: 10 },
        size: 'Tiny',
        weightPounds: 3,
        isMagical: true
      }, mockGameState)).toBe(false)
      expect(TargetResolver.isValidObjectTarget(targeting, caster, {
        id: 'heavy-stone',
        name: 'Heavy Stone',
        position: { x: 11, y: 10 },
        size: 'Medium',
        weightPounds: 30
      }, mockGameState)).toBe(false)
    })

    it('treats creature and object filters as allowed target categories, not impossible AND filters', () => {
      const targeting: SpellTargeting = {
        type: 'single',
        range: 60,
        validTargets: ['creatures', 'objects', 'enemies']
      }

      expect(TargetResolver.isValidTarget(targeting, caster, enemyClose, mockGameState)).toBe(true)
      expect(TargetResolver.isValidTarget(targeting, caster, ally, mockGameState)).toBe(false)
      expect(TargetResolver.isValidObjectTarget(targeting, caster, {
        id: 'loose-rock',
        name: 'Loose Rock',
        position: { x: 11, y: 10 }
      }, mockGameState)).toBe(true)
    })
  })

  describe('getValidTargets', () => {
    it('should return all valid targets', () => {
        const targeting: SpellTargeting = { 
            type: 'single', 
            range: 60, 
            validTargets: ['enemies'] 
        }
        
        // Since we use beforeEach, mockGameState contains only the initial 4 characters
        const targets = TargetResolver.getValidTargets(targeting, caster, mockGameState)

        expect(targets).toHaveLength(2) // enemyClose and enemyFar
        expect(targets).toContainEqual(enemyClose)
        expect(targets).toContainEqual(enemyFar)
        expect(targets).not.toContainEqual(ally)
    })

    it('aggregates creature and supplied object candidates for mixed targeting callers', () => {
      const targeting: SpellTargeting = {
        type: 'single',
        range: 60,
        validTargets: ['creatures', 'objects', 'enemies'],
        filter: {
          objectEligibility: {
            wornOrCarried: 'excluded',
            magicalStatus: 'nonmagical',
            fixedToSurface: 'excluded',
            maxSize: 'Small',
            maxWeightPounds: 5,
            maxWeightScaling: 'not_applicable'
          }
        }
      }

      const result = TargetResolver.getValidTargetCandidates(targeting, caster, mockGameState, [
        {
          id: 'loose-stone',
          name: 'Loose Stone',
          position: { x: 11, y: 10 },
          size: 'Tiny',
          weightPounds: 3
        },
        {
          id: 'heavy-stone',
          name: 'Heavy Stone',
          position: { x: 11, y: 10 },
          size: 'Medium',
          weightPounds: 30
        }
      ])

      expect(result.creatures).toEqual([enemyClose, enemyFar])
      expect(result.objects.map(targetObject => targetObject.id)).toEqual(['loose-stone'])
    })
  })
})
