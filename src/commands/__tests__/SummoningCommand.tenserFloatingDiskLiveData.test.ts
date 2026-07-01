import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MovementCommand } from '../effects/MovementCommand'
import { SummoningCommand } from '../effects/SummoningCommand'
import { useActionExecutor } from '../../hooks/combat/useActionExecutor'
import type { CommandContext } from '../base/SpellCommand'
import type { BattleMapData, CombatAction, CombatCharacter, TurnState } from '@/types/combat'
import type { MovementEffect, SummoningEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import tensersFloatingDisk from '../../../public/data/spells/level-1/tensers-floating-disk.json'

/**
 * This test proves the live Tenser's Floating Disk packet keeps its authored
 * travel metadata when the spell creates its combat summon actor.
 *
 * The current slice stays narrow, but it now proves the live combat runtime
 * can preserve the authored travel contract and consume the explicit disk
 * load/elevation metadata surface without adding inventory or terrain systems.
 */

describe('SummoningCommand live Tenser Floating Disk travel bridge', () => {
  it('preserves travelDetails on the spawned summon metadata', () => {
    // Use the real spell packet so the proof fails if live JSON loses the
    // travel metadata or the summon bridge stops copying it into combat state.
    const summonEffect = tensersFloatingDisk.effects.find(
      (effect): effect is SummoningEffect => effect.type === 'SUMMONING'
    )

    expect(summonEffect).toBeDefined()

    // The caster only needs a valid combat identity and position for the
    // summon command to create the disk actor.
    const caster = createMockCombatCharacter({
      id: 'tenser-caster',
      name: 'Tenser Caster',
      position: { x: 4, y: 4 },
      initiative: 12
    }) as CombatCharacter

    const command = new SummoningCommand(summonEffect!, {
      spellId: tensersFloatingDisk.id,
      spellName: tensersFloatingDisk.name,
      castAtLevel: 1,
      caster,
      targets: [],
      gameState: createMockGameState()
    } satisfies CommandContext)

    const state = createMockCombatState({
      characters: [caster]
    })

    const nextState = command.execute(state)
    const disk = nextState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === tensersFloatingDisk.id &&
      character.summonMetadata?.casterId === caster.id
    )

    // The bridge should keep the authored follow, hover, and travel contract
    // together on the spawned actor so later runtime work can read one source.
    expect(disk?.summonMetadata).toEqual(expect.objectContaining({
      followDistance: 20,
      hoverHeight: 3,
      conditionalEndings: expect.arrayContaining([
        expect.objectContaining({ trigger: 'carried_weight_exceeds_limit' }),
        expect.objectContaining({ trigger: 'beyond_max_distance' })
      ]),
      travelDetails: expect.objectContaining({
        hoverHeightFeet: 3,
        followDistanceFeet: 20,
        immobileWithinFeet: 20,
        maxCasterSeparationFeet: 100,
        maxLoadPounds: 500,
        cannotCrossElevationChangeFeet: 10,
        terrain: 'can move across uneven terrain, stairs, and slopes',
        overload: 'if over 500 pounds, spell ends and contents fall'
      })
    }))
  })

  it('removes the disk when movement puts the caster beyond the authored 100-foot separation limit', () => {
    // Use the real spell packet again so the execution proof depends on the
    // same metadata preservation that the first test guards.
    const summonEffect = tensersFloatingDisk.effects.find(
      (effect): effect is SummoningEffect => effect.type === 'SUMMONING'
    )

    expect(summonEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'tenser-distance-caster',
      name: 'Tenser Distance Caster',
      position: { x: 4, y: 4 },
      initiative: 12
    }) as CombatCharacter

    const summonCommand = new SummoningCommand(summonEffect!, {
      spellId: tensersFloatingDisk.id,
      spellName: tensersFloatingDisk.name,
      castAtLevel: 1,
      caster,
      targets: [],
      gameState: createMockGameState()
    } satisfies CommandContext)

    const summonedState = summonCommand.execute(createMockCombatState({
      characters: [caster]
    }))
    const disk = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === tensersFloatingDisk.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(disk).toBeDefined()
    expect(disk?.summonMetadata?.travelDetails?.maxCasterSeparationFeet).toBe(100)
    expect(disk?.summonMetadata?.conditionalEndings).toEqual(expect.arrayContaining([
      expect.objectContaining({ trigger: 'beyond_max_distance' })
    ]))

    // Teleporting the caster is a compact way to exercise a real movement
    // command that changes caster position and returns the whole combat state.
    // It deliberately proves only the max-distance ending, leaving load,
    // elevation, pit, and follow-path execution for later runtime slices.
    const longMoveEffect: MovementEffect = {
      type: 'MOVEMENT',
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      movementType: 'teleport',
      distance: 200,
      destination: { x: 30, y: 4 },
      description: 'Move the caster far enough to trigger Tenser disk separation.'
    }

    const movementCommand = new MovementCommand(longMoveEffect, {
      spellId: 'tenser-distance-proof',
      spellName: 'Tenser Distance Proof',
      castAtLevel: 1,
      caster,
      targets: [caster],
      gameState: {}
    } satisfies CommandContext)

    const afterMove = movementCommand.execute({
      ...summonedState,
      mapData: null
    })
    const movedCaster = afterMove.characters.find(character => character.id === caster.id)

    expect(movedCaster?.position).toEqual({ x: 30, y: 4 })
    expect(afterMove.characters.some(character => character.id === disk?.id)).toBe(false)
    expect(afterMove.combatLog.some(entry =>
      entry.data?.summonCondition === 'beyond_max_distance' &&
      Array.isArray(entry.data?.removedSummonIds) &&
      entry.data.removedSummonIds.includes(disk?.id)
    )).toBe(true)
  })

  it('keeps an in-limit load and removes the disk when carried weight exceeds the authored limit', () => {
    const summonEffect = tensersFloatingDisk.effects.find(
      (effect): effect is SummoningEffect => effect.type === 'SUMMONING'
    )

    expect(summonEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'tenser-load-caster',
      name: 'Tenser Load Caster',
      position: { x: 4, y: 4 },
      initiative: 12
    }) as CombatCharacter

    const summonCommand = new SummoningCommand(summonEffect!, {
      spellId: tensersFloatingDisk.id,
      spellName: tensersFloatingDisk.name,
      castAtLevel: 1,
      caster,
      targets: [],
      gameState: createMockGameState()
    } satisfies CommandContext)

    const summonedState = summonCommand.execute(createMockCombatState({
      characters: [caster]
    }))
    const disk = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === tensersFloatingDisk.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(disk).toBeDefined()

    const loadedState = {
      ...summonedState,
      characters: summonedState.characters.map(character =>
        character.id === disk?.id
          ? {
              ...character,
              summonMetadata: {
                ...character.summonMetadata!,
                carriedWeightPounds: 400
              }
            }
          : character
      )
    }

    const shortMoveEffect: MovementEffect = {
      type: 'MOVEMENT',
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      movementType: 'teleport',
      distance: 10,
      destination: { x: 5, y: 4 },
      description: 'Move the caster while the disk carries an in-limit load.'
    }

    const shortMoveCommand = new MovementCommand(shortMoveEffect, {
      spellId: 'tenser-load-proof',
      spellName: 'Tenser Load Proof',
      castAtLevel: 1,
      caster,
      targets: [caster],
      gameState: {}
    } satisfies CommandContext)

    const afterInLimitMove = shortMoveCommand.execute({
      ...loadedState,
      mapData: null
    })
    const loadedDisk = afterInLimitMove.characters.find(character => character.id === disk?.id)

    expect(loadedDisk?.summonMetadata?.carriedWeightPounds).toBe(400)

    const overloadedState = {
      ...summonedState,
      characters: summonedState.characters.map(character =>
        character.id === disk?.id
          ? {
              ...character,
              summonMetadata: {
                ...character.summonMetadata!,
                carriedWeightPounds: 501
              }
            }
          : character
      )
    }

    const afterOverloadMove = shortMoveCommand.execute({
      ...overloadedState,
      mapData: null
    })

    expect(afterOverloadMove.characters.some(character => character.id === disk?.id)).toBe(false)
    expect(afterOverloadMove.combatLog.some(entry =>
      entry.data?.summonCondition === 'carried_weight_exceeds_limit' &&
      entry.data?.travelRule === 'maxLoadPounds' &&
      entry.data?.carriedWeightPounds === 501 &&
      entry.data?.maxLoadPounds === 500 &&
      Array.isArray(entry.data?.removedSummonIds) &&
      entry.data.removedSummonIds.includes(disk?.id)
    )).toBe(true)
  })
})

describe('Tenser Floating Disk runtime follow bridge', () => {
  const mockEndTurn = vi.fn()
  const mockCanAfford = vi.fn()
  const mockConsumeAction = vi.fn()
  const mockRecordAction = vi.fn()
  const mockAddDamageNumber = vi.fn()
  const mockQueueAnimation = vi.fn()
  const mockHandleDamage = vi.fn()
  const mockProcessRepeatSaves = vi.fn()
  const mockProcessTileEffects = vi.fn()
  const mockOnCharacterUpdate = vi.fn()
  const mockOnCharacterRemove = vi.fn()
  const mockOnLogEntry = vi.fn()
  const mockSetMovementDebuffs = vi.fn()

  const mockTurnState: TurnState = {
    currentTurn: 1,
    turnOrder: ['tenser-caster'],
    currentCharacterId: 'tenser-caster',
    phase: 'action',
    actionsThisTurn: []
  }

  const makeTile = (x: number, y: number, elevation = 0) => ({
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation,
    movementCost: 1,
    blocksMovement: false,
    blocksLoS: false,
    decoration: null,
    environmentalEffects: [],
    effects: []
  })

  const makeLineMap = (elevations: number[] = [0, 0, 0, 0, 0, 0, 0]): BattleMapData => ({
    dimensions: { width: 1, height: elevations.length },
    tiles: new Map(elevations.map((elevation, index) => {
      const tile = makeTile(0, index, elevation)
      return [tile.id, tile] as const
    })),
    theme: 'dungeon',
    seed: 1
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAfford.mockReturnValue(true)
    mockConsumeAction.mockImplementation(character => character)
    mockProcessTileEffects.mockImplementation(character => character)
  })

  it('preserves in-limit carried weight on the same disk actor after the caster moves', async () => {
    const summonEffect = tensersFloatingDisk.effects.find(
      (effect): effect is SummoningEffect => effect.type === 'SUMMONING'
    )

    expect(summonEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'tenser-caster',
      name: 'Tenser Caster',
      position: { x: 0, y: 0 },
      initiative: 12
    }) as CombatCharacter

    const summonCommand = new SummoningCommand(summonEffect!, {
      spellId: tensersFloatingDisk.id,
      spellName: tensersFloatingDisk.name,
      castAtLevel: 1,
      caster,
      targets: [],
      gameState: createMockGameState()
    } satisfies CommandContext)

    const summonedState = summonCommand.execute(createMockCombatState({
      characters: [caster]
    }))
    const weightedDisk = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === tensersFloatingDisk.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(weightedDisk).toBeDefined()

    const liveDisk: CombatCharacter = {
      ...weightedDisk!,
      summonMetadata: {
        ...weightedDisk!.summonMetadata,
        carriedWeightPounds: 320
      }
    }

    const { result } = renderHook(() => useActionExecutor({
      characters: [caster, liveDisk],
      turnState: mockTurnState,
      mapData: makeLineMap(),
      onCharacterUpdate: mockOnCharacterUpdate,
      onCharacterRemove: mockOnCharacterRemove,
      onLogEntry: mockOnLogEntry,
      endTurn: mockEndTurn,
      canAfford: mockCanAfford,
      consumeAction: mockConsumeAction,
      recordAction: mockRecordAction,
      addDamageNumber: mockAddDamageNumber,
      queueAnimation: mockQueueAnimation,
      handleDamage: mockHandleDamage,
      processRepeatSaves: mockProcessRepeatSaves,
      processTileEffects: mockProcessTileEffects,
      spellZones: [],
      movementDebuffs: [],
      reactiveTriggers: [],
      setMovementDebuffs: mockSetMovementDebuffs
    }))

    const action: CombatAction = {
      id: 'caster-move-for-disk-follow',
      characterId: caster.id,
      type: 'move',
      targetPosition: { x: 0, y: 6 },
      cost: { type: 'movement-only', movementCost: 30 },
      timestamp: Date.now()
    }

    await result.current.executeAction(action)

    expect(mockOnCharacterUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: liveDisk.id,
      summonMetadata: expect.objectContaining({ carriedWeightPounds: 320 }),
      position: { x: 0, y: 2 }
    }))
  })

  it('removes an overloaded disk and logs carried_weight_exceeds_limit', async () => {
    const summonEffect = tensersFloatingDisk.effects.find(
      (effect): effect is SummoningEffect => effect.type === 'SUMMONING'
    )

    expect(summonEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'tenser-overload-caster',
      name: 'Tenser Overload Caster',
      position: { x: 0, y: 0 },
      initiative: 12
    }) as CombatCharacter

    const summonCommand = new SummoningCommand(summonEffect!, {
      spellId: tensersFloatingDisk.id,
      spellName: tensersFloatingDisk.name,
      castAtLevel: 1,
      caster,
      targets: [],
      gameState: createMockGameState()
    } satisfies CommandContext)

    const summonedState = summonCommand.execute(createMockCombatState({
      characters: [caster]
    }))
    const overloadedDisk = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === tensersFloatingDisk.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(overloadedDisk).toBeDefined()

    const liveDisk: CombatCharacter = {
      ...overloadedDisk!,
      summonMetadata: {
        ...overloadedDisk!.summonMetadata,
        carriedWeightPounds: 520
      }
    }

    const { result } = renderHook(() => useActionExecutor({
      characters: [caster, liveDisk],
      turnState: mockTurnState,
      mapData: makeLineMap(),
      onCharacterUpdate: mockOnCharacterUpdate,
      onCharacterRemove: mockOnCharacterRemove,
      onLogEntry: mockOnLogEntry,
      endTurn: mockEndTurn,
      canAfford: mockCanAfford,
      consumeAction: mockConsumeAction,
      recordAction: mockRecordAction,
      addDamageNumber: mockAddDamageNumber,
      queueAnimation: mockQueueAnimation,
      handleDamage: mockHandleDamage,
      processRepeatSaves: mockProcessRepeatSaves,
      processTileEffects: mockProcessTileEffects,
      spellZones: [],
      movementDebuffs: [],
      reactiveTriggers: [],
      setMovementDebuffs: mockSetMovementDebuffs
    }))

    const action: CombatAction = {
      id: 'caster-move-for-overload',
      characterId: caster.id,
      type: 'move',
      targetPosition: { x: 0, y: 6 },
      cost: { type: 'movement-only', movementCost: 30 },
      timestamp: Date.now()
    }

    await result.current.executeAction(action)

    expect(mockOnCharacterRemove).toHaveBeenCalledWith(liveDisk.id)
    expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'status',
      characterId: caster.id,
      targetIds: [liveDisk.id],
      data: expect.objectContaining({
        summonCondition: 'carried_weight_exceeds_limit',
        removedSummonIds: [liveDisk.id]
      })
    }))
  })

  it('ends a follow attempt across an elevation barrier using existing tile elevation data', async () => {
    const summonEffect = tensersFloatingDisk.effects.find(
      (effect): effect is SummoningEffect => effect.type === 'SUMMONING'
    )

    expect(summonEffect).toBeDefined()

    const caster = createMockCombatCharacter({
      id: 'tenser-elevation-caster',
      name: 'Tenser Elevation Caster',
      position: { x: 0, y: 0 },
      initiative: 12
    }) as CombatCharacter

    const summonCommand = new SummoningCommand(summonEffect!, {
      spellId: tensersFloatingDisk.id,
      spellName: tensersFloatingDisk.name,
      castAtLevel: 1,
      caster,
      targets: [],
      gameState: createMockGameState()
    } satisfies CommandContext)

    const summonedState = summonCommand.execute(createMockCombatState({
      characters: [caster]
    }))
    const disk = summonedState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === tensersFloatingDisk.id &&
      character.summonMetadata?.casterId === caster.id
    )

    expect(disk).toBeDefined()

    const elevatedMap = makeLineMap([0, 0, 0, 12, 12, 12, 12])

    const { result } = renderHook(() => useActionExecutor({
      characters: [caster, disk!],
      turnState: mockTurnState,
      mapData: elevatedMap,
      onCharacterUpdate: mockOnCharacterUpdate,
      onCharacterRemove: mockOnCharacterRemove,
      onLogEntry: mockOnLogEntry,
      endTurn: mockEndTurn,
      canAfford: mockCanAfford,
      consumeAction: mockConsumeAction,
      recordAction: mockRecordAction,
      addDamageNumber: mockAddDamageNumber,
      queueAnimation: mockQueueAnimation,
      handleDamage: mockHandleDamage,
      processRepeatSaves: mockProcessRepeatSaves,
      processTileEffects: mockProcessTileEffects,
      spellZones: [],
      movementDebuffs: [],
      reactiveTriggers: [],
      setMovementDebuffs: mockSetMovementDebuffs
    }))

    const action: CombatAction = {
      id: 'caster-move-for-elevation',
      characterId: caster.id,
      type: 'move',
      targetPosition: { x: 0, y: 6 },
      cost: { type: 'movement-only', movementCost: 30 },
      timestamp: Date.now()
    }

    await result.current.executeAction(action)

    expect(mockOnCharacterRemove).toHaveBeenCalledWith(disk!.id)
    expect(mockOnLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      type: 'status',
      characterId: caster.id,
      targetIds: [disk!.id],
      data: expect.objectContaining({
        summonCondition: 'cannot_cross_elevation_change',
        removedSummonIds: [disk!.id]
      })
    }))
  })
})
