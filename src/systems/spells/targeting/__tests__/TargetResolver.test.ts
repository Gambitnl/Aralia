import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TargetResolver } from '../TargetResolver'
import * as combatUtils from '../../../../utils/combatUtils'
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
    vi.restoreAllMocks()

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

  describe('resolveTargetCandidates', () => {
    it('applies allocation to an already chosen area candidate list', () => {
      // Area placement happens before this bridge. The resolver must preserve
      // that chosen footprint as the candidate list, then let allocation reduce
      // only the final affected targets.
      const rollSpy = vi.spyOn(combatUtils, 'rollDice').mockReturnValue(12)
      enemyClose.currentHP = 7
      enemyFar.currentHP = 10
      ally.currentHP = 20

      const targeting: SpellTargeting = {
        type: 'area',
        range: 60,
        validTargets: ['creatures'],
        lineOfSight: false,
        areaOfEffect: {
          shape: 'Sphere',
          size: 10
        },
        allocation: {
          type: 'pool',
          pool: {
            resource: 'hp',
            dice: '5d8',
            sortOrder: 'ascending',
            strictLimit: true
          }
        }
      }

      const result = TargetResolver.resolveTargetCandidates(
        targeting,
        [ally, enemyFar, enemyClose],
        { castLevel: 1 }
      )

      // With a 12-point pool, the lowest-HP candidate is affected, then the
      // remaining pool is too small for the next ascending candidate. The
      // original candidate list stays available for audit/UI context.
      expect(rollSpy).toHaveBeenCalledWith('5d8')
      expect(result.candidateTargets).toEqual([ally, enemyFar, enemyClose])
      expect(result.selectedTargets).toEqual([enemyClose])
      expect(result.allocationApplied).toBe(true)
      expect(result.remainingPool).toBe(5)
      expect(result.logs).toContain('Rolled 5d8 for hp pool: 12')
    })
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
      expect(TargetResolver.getTargetRejectionReason(targeting, caster, ally, mockGameState)).toMatchObject({
        code: 'requires_enemy',
        message: 'This spell can only target enemies.'
      })
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

    it('allows Vicious Mockery-style audible targets when sight is blocked', () => {
      const hiddenButAudible = {
        ...createMockChar('heckler', 'enemy', 15, 10),
        audibleTo: [caster.id]
      }
      mockGameState.characters.push(hiddenButAudible)
      mockMapData.tiles.set('12-10', createMockTile(12, 10, true))

      const targeting: SpellTargeting = {
        type: 'single',
        range: 60,
        validTargets: ['creatures'],
        lineOfSight: true,
        acquisition: { mode: 'sight_or_hearing' }
      }

      // Vicious Mockery can acquire a creature the caster can see or hear. The
      // wall blocks normal line of sight here, so this passing result proves the
      // spell-specific hearing route is being consumed.
      expect(TargetResolver.isValidTarget(targeting, caster, hiddenButAudible, mockGameState)).toBe(true)
    })

    it('rejects Vicious Mockery-style hidden targets that are not audible', () => {
      const hiddenAndSilent = createMockChar('silent-heckler', 'enemy', 15, 10)
      mockGameState.characters.push(hiddenAndSilent)
      mockMapData.tiles.set('12-10', createMockTile(12, 10, true))

      const targeting: SpellTargeting = {
        type: 'single',
        range: 60,
        validTargets: ['creatures'],
        lineOfSight: true,
        acquisition: { mode: 'sight_or_hearing' }
      }

      expect(TargetResolver.isValidTarget(targeting, caster, hiddenAndSilent, mockGameState)).toBe(false)
      expect(TargetResolver.getTargetRejectionReason(targeting, caster, hiddenAndSilent, mockGameState)).toMatchObject({
        code: 'line_of_sight_blocked'
      })
    })

    it('keeps ordinary line-of-sight spells blocked even when the target is audible', () => {
      const audibleBehindWall = {
        ...createMockChar('audible-behind-wall', 'enemy', 15, 10),
        audibleTo: [caster.id]
      }
      mockGameState.characters.push(audibleBehindWall)
      mockMapData.tiles.set('12-10', createMockTile(12, 10, true))

      const targeting: SpellTargeting = {
        type: 'single',
        range: 60,
        validTargets: ['creatures'],
        lineOfSight: true
      }

      // The hearing bridge is opt-in. Fire Bolt-style sight-only spells must
      // not become legal through an unrelated audible signal.
      expect(TargetResolver.isValidTarget(targeting, caster, audibleBehindWall, mockGameState)).toBe(false)
    })

    it('rejects line-of-sight targets when map data is missing', () => {
      const targeting: SpellTargeting = {
        type: 'single',
        range: 60,
        validTargets: ['enemies'],
        lineOfSight: true
      }
      const maplessState: CombatState = {
        ...mockGameState,
        mapData: undefined
      }

      // LoS-required spells should not be approved by runtime targeting when
      // there is no map to prove the sight line. This matches the UI validator
      // and prevents hidden runtime casts that the combat map would reject.
      expect(TargetResolver.isValidTarget(targeting, caster, enemyClose, maplessState)).toBe(false)
    })

    it('keeps non-line-of-sight targeting usable when map data is missing', () => {
      const targeting: SpellTargeting = {
        type: 'single',
        range: 60,
        validTargets: ['enemies'],
        lineOfSight: false
      }
      const maplessState: CombatState = {
        ...mockGameState,
        mapData: undefined
      }

      // Only spells that ask for line of sight need map proof. Other targeting
      // rules keep working in mapless combat states so this policy does not
      // accidentally shut down every non-map encounter.
      expect(TargetResolver.isValidTarget(targeting, caster, enemyClose, maplessState)).toBe(true)
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

    it('honors grouped object size and weight eligibility fields', () => {
      const targeting: SpellTargeting = {
        type: 'single',
        range: 60,
        validTargets: ['objects'],
        filter: {
          objectEligibility: {
            wornOrCarried: 'excluded',
            magicalStatus: 'nonmagical',
            fixedToSurface: 'excluded',
            sizeLimit: { maxSize: 'Small' },
            weightLimit: { maxWeightPounds: 5 }
          } as unknown as NonNullable<SpellTargeting['filter']>['objectEligibility']
        }
      }

      // Object-target spell data migrated from flat fields to grouped size and
      // weight blocks. The resolver must read those grouped blocks or spells
      // can incorrectly allow oversized or overweight map objects.
      expect(TargetResolver.isValidObjectTarget(targeting, caster, {
        id: 'tiny-stone',
        name: 'Tiny Stone',
        position: { x: 11, y: 10 },
        size: 'Tiny',
        weightPounds: 2
      }, mockGameState)).toBe(true)
      expect(TargetResolver.isValidObjectTarget(targeting, caster, {
        id: 'heavy-stone',
        name: 'Heavy Stone',
        position: { x: 11, y: 10 },
        size: 'Tiny',
        weightPounds: 30
      }, mockGameState)).toBe(false)
      expect(TargetResolver.getObjectTargetRejectionReason(targeting, caster, {
        id: 'heavy-stone',
        name: 'Heavy Stone',
        position: { x: 11, y: 10 },
        size: 'Tiny',
        weightPounds: 30
      }, mockGameState)).toMatchObject({
        code: 'object_too_heavy'
      })
      expect(TargetResolver.isValidObjectTarget(targeting, caster, {
        id: 'large-stone',
        name: 'Large Stone',
        position: { x: 11, y: 10 },
        size: 'Large',
        weightPounds: 2
      }, mockGameState)).toBe(false)
      expect(TargetResolver.getObjectTargetRejectionReason(targeting, caster, {
        id: 'large-stone',
        name: 'Large Stone',
        position: { x: 11, y: 10 },
        size: 'Large',
        weightPounds: 2
      }, mockGameState)).toMatchObject({
        code: 'object_too_large'
      })
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

    it('rejects line-of-sight object targets when map data is missing', () => {
      const targeting: SpellTargeting = {
        type: 'single',
        range: 60,
        validTargets: ['objects'],
        lineOfSight: true
      }
      const maplessState: CombatState = {
        ...mockGameState,
        mapData: undefined
      }

      // Object targeting uses the same LoS helper as creature targeting, so it
      // must follow the same map-required policy when spell data asks for sight.
      expect(TargetResolver.isValidObjectTarget(targeting, caster, {
        id: 'loose-rock',
        name: 'Loose Rock',
        position: { x: 11, y: 10 }
      }, maplessState)).toBe(false)
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
