/**
 * This file proves that difficult ground is written onto a tile as an
 * identifiable status rather than an anonymous placeholder.
 *
 * Before `agora-f423` the status nested inside the `difficult_terrain`
 * environmental effect was an unnamed `{ type: 'condition' }` stub with no
 * description, icon, or source. Anything reading a tile had to re-derive what
 * the debuff was from the wrapper around it. These tests keep the populated
 * record and the shared movement-cost canon executable.
 *
 * Covers: TerrainCommand.
 */

import { describe, expect, it } from 'vitest'
import { TerrainCommand, DIFFICULT_TERRAIN_MOVEMENT_COST } from '../TerrainCommand'
import type { TerrainEffect } from '@/types/spells'
import type { CombatState } from '@/types/combat'

const makeCaster = () => ({
  id: 'terrain-caster',
  name: 'Terrain Caster',
  position: { x: 2, y: 2 },
  // A cube cast on the caster tile extends along the caster facing (ruling Q4, 2026-09-22).
  facing: 'east'
}) as never

const makeState = (terrain = 'grass'): CombatState => {
  const tiles = new Map()
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      tiles.set(`${x}-${y}`, {
        position: { x, y },
        terrain,
        elevation: 0,
        movementCost: 1,
        environmentalEffects: []
      })
    }
  }

  return {
    status: 'active',
    characters: [],
    activeCharacterId: '',
    turnOrder: [],
    round: 1,
    combatLog: [],
    mapData: { dimensions: { width: 5, height: 5 }, tiles, theme: 'forest', seed: 1 }
  } as unknown as CombatState
}

const difficultTerrainEffect: TerrainEffect = {
  type: 'TERRAIN',
  terrainType: 'difficult',
  areaOfEffect: { shape: 'Cube', size: 10, height: 0 },
  duration: { type: 'rounds', value: 3 },
  trigger: {
    type: 'immediate',
    frequency: 'every_time',
    consumption: 'unlimited',
    attackFilter: { weaponType: 'any', attackType: 'any' },
    movementType: 'any',
    sustainCost: { actionType: 'action', optional: false }
  },
  condition: { type: 'always' }
} as unknown as TerrainEffect

const runOnGrass = (terrain = 'grass') => {
  const caster = makeCaster()
  const command = new TerrainCommand(difficultTerrainEffect, {
    caster,
    targets: [],
    spellId: 'entangle',
    spellName: 'Entangle',
    castAtLevel: 1,
    gameState: null as unknown as never
  })

  const tile = command.execute(makeState(terrain)).mapData?.tiles.get('2-2')
  const environmental = tile?.environmentalEffects?.find(effect => effect.type === 'difficult_terrain')

  return { tile, environmental }
}

describe('TerrainCommand difficult-terrain status', () => {
  it('writes an identifiable, source-attributed status instead of a bare condition stub', () => {
    const { environmental } = runOnGrass()

    expect(environmental).toBeDefined()
    expect(environmental?.duration).toBe(3)
    expect(environmental?.sourceSpellId).toBe('entangle')

    const status = environmental?.effect
    expect(status?.name).toBe('Difficult Terrain')
    expect(status?.type).toBe('debuff')
    expect(status?.duration).toBe(3)
    expect(status?.icon).toBe('difficult_terrain')
    expect(status?.source).toBe('Entangle')
    expect(status?.sourceSpellId).toBe('entangle')
    expect(status?.sourceCasterId).toBe('terrain-caster')
    // The movement rule is a tile cost, so `condition` stays the honest union
    // member; the description is what makes the rule readable.
    expect(status?.effect).toEqual({ type: 'condition' })
    expect(status?.description).toContain(`${DIFFICULT_TERRAIN_MOVEMENT_COST} movement per square`)
  })

  it('gives each affected tile its own status id so stacked durations stay distinct', () => {
    const { tile } = runOnGrass()
    const command = new TerrainCommand(difficultTerrainEffect, {
      caster: makeCaster(),
      targets: [],
      spellId: 'entangle',
      spellName: 'Entangle',
      castAtLevel: 1,
      gameState: null as unknown as never
    })

    const otherTile = command.execute(makeState()).mapData?.tiles.get('2-3')
    const firstId = tile?.environmentalEffects?.[0]?.effect?.id
    const otherId = otherTile?.environmentalEffects?.[0]?.effect?.id

    expect(firstId).toBeTruthy()
    expect(otherId).toBeTruthy()
    expect(firstId).not.toBe(otherId)
  })

  it('doubles the movement cost of ordinary ground', () => {
    expect(runOnGrass().tile?.movementCost).toBe(DIFFICULT_TERRAIN_MOVEMENT_COST)
  })

  it('does not stack past the doubled cost on ground that is already difficult', () => {
    // Naturally difficult ground is already the doubled cost; a spell laying
    // difficult terrain over it must not quadruple the square.
    expect(runOnGrass('mud').tile?.movementCost).toBe(DIFFICULT_TERRAIN_MOVEMENT_COST)
  })
})
