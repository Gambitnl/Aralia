import { describe, expect, it } from 'vitest'
import { MovementCommand } from '../effects/MovementCommand'
import { TerrainCommand } from '../effects/TerrainCommand'
import type { CommandContext } from '../base/SpellCommand'
import type { CombatCharacter, CombatState, Position } from '@/types/combat'
import type { MovementEffect, TerrainEffect } from '@/types/spells'
import { createMockCombatCharacter, createMockGameState } from '../../utils/factories'

/**
 * This file checks movement-style spell commands.
 *
 * Movement spells are shared by teleport effects, forced movement, and terrain
 * manipulation. These tests keep those runtime contracts visible so spell data
 * can rely on the command layer instead of each spell inventing its own move
 * behavior.
 */

const baseStats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  baseInitiative: 0,
  speed: 30,
  cr: '0'
}

const baseEconomy = {
  action: { used: false, remaining: 1 },
  bonusAction: { used: false, remaining: 1 },
  reaction: { used: false, remaining: 1 },
  legendary: { used: 0, total: 0 },
  movement: { used: 0, total: 30 },
  freeActions: 0
}

const baseClass = createMockCombatCharacter().class

const makeCharacter = (id: string, position: Position): CombatCharacter => ({
  id,
  name: id,
  level: 1,
  class: baseClass,
  position,
  stats: { ...baseStats },
  abilities: [],
  team: 'player',
  currentHP: 10,
  maxHP: 10,
  initiative: 0,
  statusEffects: [],
  actionEconomy: { ...baseEconomy }
})

const makeState = (characters: CombatCharacter[], validMoves: Position[] = []): CombatState => ({
  isActive: true,
  characters,
  turnState: {
    currentTurn: 1,
    turnOrder: characters.map(c => c.id),
    currentCharacterId: characters[0]?.id ?? null,
    phase: 'action',
    actionsThisTurn: []
  },
  selectedCharacterId: null,
  selectedAbilityId: null,
  actionMode: 'select',
  validTargets: [],
  validMoves,
  combatLog: [],
  reactiveTriggers: [],
  activeLightSources: []
})

const makeContext = (caster: CombatCharacter, targets: CombatCharacter[]): CommandContext => ({
  spellId: 'test-spell',
  spellName: 'Test Spell',
  castAtLevel: 1,
  caster,
  targets,
  gameState: createMockGameState()
})

const makeMaplessContext = (caster: CombatCharacter, targets: CombatCharacter[]): CommandContext => ({
  spellId: 'mapless-teleport',
  spellName: 'Mapless Teleport',
  castAtLevel: 2,
  caster,
  targets,
  // Mapless spell execution should not inherit campaign-map dimensions. This
  // keeps the command focused on range and occupied-space rules when no battle
  // map is attached to the combat state.
  gameState: { ...createMockGameState(), mapData: undefined } as ReturnType<typeof createMockGameState>
})

describe('MovementCommand', () => {
  it('teleports to a valid UI-provided tile when available', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 })
    const target = makeCharacter('target', { x: 1, y: 1 })

    // validMoves mimics UI-provided legal destinations
    const state = makeState([caster, target], [{ x: 4, y: 1 }, { x: 6, y: 6 }])

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'teleport',
      distance: 30,
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    }

    const cmd = new MovementCommand(effect, makeContext(caster, [target]))
    const result = cmd.execute(state)

    const updated = result.characters.find(c => c.id === 'target')
    expect(updated?.position).toEqual({ x: 4, y: 1 })
    expect(result.combatLog.some(entry => entry.message.includes('teleports'))).toBe(true)
  })

  it('falls back to moving away from the caster when no destinations are provided', () => {
    const caster = makeCharacter('caster', { x: 0, y: 1 })
    const target = makeCharacter('target', { x: 1, y: 1 })
    const state = makeState([caster, target])

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'teleport',
      distance: 10,
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    }

    const cmd = new MovementCommand(effect, makeContext(caster, [target]))
    const result = cmd.execute(state)
    const updated = result.characters.find(c => c.id === 'target')

    expect(updated?.position).toEqual({ x: 3, y: 1 }) // Two tiles away from the caster along the x-axis
  })

  it('fails to teleport when distance is missing (0) even if validMoves exist outside range', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 })
    const target = makeCharacter('target', { x: 0, y: 0 }) // At origin

    // validMoves includes a distant tile (10, 10), which is > 0 distance
    const state = makeState([caster, target], [{ x: 10, y: 10 }])

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'teleport',
      // distance omitted, implies 0
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    }

    const cmd = new MovementCommand(effect, makeContext(caster, [target]))
    const result = cmd.execute(state)

    const updated = result.characters.find(c => c.id === 'target')

    // Expectation: Should stay at 0,0 because distance is 0
    expect(updated?.position).toEqual({ x: 0, y: 0 })

    // We expect it NOT to have moved to 10,10
    expect(updated?.position).not.toEqual({ x: 10, y: 10 })
  })

  // Mapless teleport policy: when no battle map or campaign map is present, the
  // command does not guess battlefield edges. It still enforces the spell's
  // range budget and still rejects occupied landing spaces.
  it('allows an in-range mapless teleport without clamping the coordinates', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 })
    const target = makeCharacter('target', { x: 1, y: 1 })
    const state = makeState([caster, target])

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'teleport',
      distance: 30,
      destination: { x: 7, y: 1 },
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    }

    const result = new MovementCommand(effect, makeMaplessContext(caster, [target])).execute(state)
    const updated = result.characters.find(c => c.id === 'target')
    const teleportLog = result.combatLog.at(-1)

    expect(updated?.position).toEqual({ x: 7, y: 1 })
    expect(teleportLog?.data).toMatchObject({
      requestedDestination: { x: 7, y: 1 },
      actualDistanceTiles: 6,
      actualDistanceFeet: 30,
      clampedByBounds: false,
      usedFallbackDestination: false,
      maplessBoundsPolicy: 'range_bounded_unclamped'
    })
  })

  it('uses an in-range fallback tile when a mapless teleport destination is occupied', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 })
    const target = makeCharacter('target', { x: 1, y: 1 })
    const blocker = makeCharacter('blocker', { x: 3, y: 1 })
    const state = makeState([caster, target, blocker], [{ x: 3, y: 2 }, { x: 10, y: 10 }])

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'teleport',
      distance: 15,
      destination: { x: 3, y: 1 },
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    }

    const result = new MovementCommand(effect, makeMaplessContext(caster, [target])).execute(state)
    const updated = result.characters.find(c => c.id === 'target')
    const teleportLog = result.combatLog.at(-1)

    expect(updated?.position).toEqual({ x: 3, y: 2 })
    expect(teleportLog?.data).toMatchObject({
      requestedDestination: { x: 3, y: 1 },
      usedFallbackDestination: true,
      maplessBoundsPolicy: 'range_bounded_unclamped'
    })
  })

  it('rejects mapless teleport fallback candidates outside the spell range', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 })
    const target = makeCharacter('target', { x: 1, y: 1 })
    const blocker = makeCharacter('blocker', { x: 2, y: 1 })
    const state = makeState([caster, target, blocker], [{ x: 10, y: 10 }])

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'teleport',
      distance: 5,
      destination: { x: 2, y: 1 },
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    }

    const result = new MovementCommand(effect, makeMaplessContext(caster, [target])).execute(state)
    const updated = result.characters.find(c => c.id === 'target')
    const teleportLog = result.combatLog.at(-1)

    expect(updated?.position).toEqual({ x: 1, y: 1 })
    expect(teleportLog?.message).toContain('cannot teleport to a valid space')
  })
})

describe('TerrainCommand', () => {
  it('marks affected tiles using AoE calculations', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 })
    const target = makeCharacter('target', { x: 2, y: 0 })
    const state = makeState([caster, target])

    const effect: TerrainEffect = {
      type: 'TERRAIN',
      terrainType: 'difficult',
      areaOfEffect: { shape: 'Sphere', size: 10 },
      duration: { type: 'rounds', value: 1 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' }
    }

    const cmd = new TerrainCommand(effect, makeContext(caster, [target]))
    const result = cmd.execute(state)

    const terrainLog = result.combatLog.at(-1)
    const affected = (terrainLog?.data as { affectedPositions?: Position[] } | undefined)?.affectedPositions;
    expect((affected?.length ?? 0)).toBeGreaterThan(0)
  })

  it('handles excavate manipulation with deposit distance', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 })
    const target = makeCharacter('target', { x: 2, y: 0 })
    const state = makeState([caster, target])

    const effect: TerrainEffect = {
      type: 'TERRAIN',
      terrainType: 'difficult',
      areaOfEffect: { shape: 'Cube', size: 5 },
      duration: { type: 'special' },
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      manipulation: {
        type: 'excavate',
        volume: { shape: 'Cube', size: 5, depth: 5 },
        depositDistance: 5
      }
    }

    const cmd = new TerrainCommand(effect, makeContext(caster, [target]))
    const result = cmd.execute(state)

    const terrainLog = result.combatLog.at(-1)
    expect(terrainLog?.message).toContain('excavates')
    expect(terrainLog?.message).toContain('deposits it up to 5 feet away')
    const manipulation = (terrainLog?.data as { manipulation?: { type?: string } } | undefined)?.manipulation;
    expect(manipulation?.type).toBe('excavate')
  })

  it('handles difficult terrain manipulation', () => {
    const caster = makeCharacter('caster', { x: 0, y: 0 })
    const target = makeCharacter('target', { x: 2, y: 0 })
    const state = makeState([caster, target])

    const effect: TerrainEffect = {
      type: 'TERRAIN',
      terrainType: 'difficult',
      areaOfEffect: { shape: 'Cube', size: 5 },
      duration: { type: 'minutes', value: 60 },
      trigger: { type: 'immediate' },
      condition: { type: 'always' },
      manipulation: {
        type: 'difficult',
        volume: { shape: 'Cube', size: 5 }
      }
    }

    const cmd = new TerrainCommand(effect, makeContext(caster, [target]))
    const result = cmd.execute(state)

    const terrainLog = result.combatLog.at(-1)
    expect(terrainLog?.message).toContain('turns terrain into difficult terrain')
    const manipulation = (terrainLog?.data as { manipulation?: { type?: string } } | undefined)?.manipulation;
    expect(manipulation?.type).toBe('difficult')
  })
})
