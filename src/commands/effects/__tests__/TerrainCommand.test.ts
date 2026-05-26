import { describe, it, expect } from 'vitest'
import { TerrainCommand } from '../TerrainCommand'
import { TerrainEffect } from '@/types/spells'
import { CombatState } from '@/types/combat'

const makeCharacter = (id: string, position: { x: number, y: number }): any => ({
  id,
  name: id,
  position,
  hp: 10,
  maxHp: 10,
  initiative: 0,
  speed: 30,
  ac: 10,
  conditions: [],
  level: 1,
  type: 'player' as const,
  faction: 'player' as const
})

const makeState = (characters: ReturnType<typeof makeCharacter>[]): CombatState => {
  const tiles = new Map()
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      tiles.set(`${x}-${y}`, { position: { x, y }, terrain: 'grass', elevation: 0, movementCost: 1, environmentalEffects: [] })
    }
  }

  return {
    status: 'active',
    characters,
    activeCharacterId: characters[0]?.id || '',
    turnOrder: characters.map(c => c.id),
    round: 1,
    combatLog: [],
    mapData: {
      dimensions: { width: 5, height: 5 },
      tiles,
      theme: 'forest',
      seed: 1
    }
  } as any
}

const makeContext = (caster: any, targets: any[]): any => ({
  caster,
  targets,
  spellId: 'test-spell',
  spellName: 'test-spell',
  castAtLevel: 1,
  isAttack: false,
  isCritical: false,
  gameState: {} as any
})

describe('TerrainCommand', () => {
  it('applies difficult terrain and doubles movement cost', () => {
    const caster = makeCharacter('caster', { x: 2, y: 2 })
    const state = makeState([caster])

    const effect: TerrainEffect = {
      type: 'TERRAIN',
      terrainType: 'difficult',
      areaOfEffect: { shape: 'Cube', size: 10, height: 0 },
      duration: { type: 'minutes', value: 10 },
      trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', attackFilter: { weaponType: 'any', attackType: 'any' }, movementType: 'any', sustainCost: { actionType: 'action', optional: false } },
      condition: { type: 'always', targetFilter: { creatureTypes: [], excludeCreatureTypes: [], sizes: [], alignments: [], hasCondition: [], isNativeToPlane: false, willing: 'not_applicable', objectEligibility: { wornOrCarried: 'not_applicable', magicalStatus: 'not_applicable', fixedToSurface: 'not_applicable', maxSize: 'not_applicable', maxWeightPounds: 'not_applicable', maxWeightScaling: 'not_applicable' }, communicationPrerequisites: { canHearCaster: 'not_applicable', canUnderstandCaster: 'not_applicable', canSeeCaster: 'not_applicable' }, abilityThreshold: { ability: 'not_applicable', operator: 'not_applicable', value: 'not_applicable' }, selfRelation: 'not_applicable' }, requiresStatus: [], saveModifiers: [] } as any,
    }

    const cmd = new TerrainCommand(effect, makeContext(caster, []))
    const result = cmd.execute(state)

    // Check center tile (2, 2)
    const tile = result.mapData?.tiles.get('2-2')
    expect(tile).toBeDefined()
    expect(tile?.movementCost).toBe(2)
    expect(tile?.environmentalEffects?.some((e: any) => e.type === 'difficult_terrain')).toBe(true)
  })

  it('handles manipulation like mold earth', () => {
    const caster = makeCharacter('caster', { x: 2, y: 2 })
    const state = makeState([caster])

    const effect: TerrainEffect = {
      type: 'TERRAIN',
      terrainType: 'difficult', // The manipulation type overrides the base type for effect execution
      areaOfEffect: { shape: 'Cube', size: 5, height: 0 },
      duration: { type: 'special', value: 0 },
      trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', attackFilter: { weaponType: 'any', attackType: 'any' }, movementType: 'any', sustainCost: { actionType: 'action', optional: false } },
      condition: { type: 'always', targetFilter: { creatureTypes: [], excludeCreatureTypes: [], sizes: [], alignments: [], hasCondition: [], isNativeToPlane: false, willing: 'not_applicable', objectEligibility: { wornOrCarried: 'not_applicable', magicalStatus: 'not_applicable', fixedToSurface: 'not_applicable', maxSize: 'not_applicable', maxWeightPounds: 'not_applicable', maxWeightScaling: 'not_applicable' }, communicationPrerequisites: { canHearCaster: 'not_applicable', canUnderstandCaster: 'not_applicable', canSeeCaster: 'not_applicable' }, abilityThreshold: { ability: 'not_applicable', operator: 'not_applicable', value: 'not_applicable' }, selfRelation: 'not_applicable' }, requiresStatus: [], saveModifiers: [] } as any,
      manipulation: {
        type: 'excavate',
        volume: { shape: 'Cube', size: 5, depth: 5 },
        depositDistance: 5
      }
    }

    const cmd = new TerrainCommand(effect, makeContext(caster, []))
    const result = cmd.execute(state)

    // Check center tile (2, 2) has lower elevation due to excavate
    const tile = result.mapData?.tiles.get('2-2')
    expect(tile).toBeDefined()
    expect(tile?.elevation).toBeLessThan(0)

    // Check combat log for manipulation message
    const terrainLog = result.combatLog.at(-1)
    expect(terrainLog?.message).toContain('excavates')
    expect(terrainLog?.message).toContain('deposits it up to 5 feet away')
  })

  it('can normalize difficult terrain', () => {
    const caster = makeCharacter('caster', { x: 2, y: 2 })
    const state = makeState([caster])

    // Pre-apply difficult terrain
    const tileBefore = state.mapData?.tiles.get('2-2')
    if (tileBefore) {
      tileBefore.environmentalEffects = [{ id: 'diff', type: 'difficult_terrain', duration: 10, effect: { id: 'eff', name: 'Difficult', type: 'debuff', duration: 10, effect: { type: 'condition' } } as any }]
      tileBefore.movementCost = 2
    }

    const effect: TerrainEffect = {
      type: 'TERRAIN',
      terrainType: 'difficult', // Will be ignored by manipulation
      areaOfEffect: { shape: 'Cube', size: 5, height: 0 },
      duration: { type: 'special', value: 0 },
      trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', attackFilter: { weaponType: 'any', attackType: 'any' }, movementType: 'any', sustainCost: { actionType: 'action', optional: false } },
      condition: { type: 'always', targetFilter: { creatureTypes: [], excludeCreatureTypes: [], sizes: [], alignments: [], hasCondition: [], isNativeToPlane: false, willing: 'not_applicable', objectEligibility: { wornOrCarried: 'not_applicable', magicalStatus: 'not_applicable', fixedToSurface: 'not_applicable', maxSize: 'not_applicable', maxWeightPounds: 'not_applicable', maxWeightScaling: 'not_applicable' }, communicationPrerequisites: { canHearCaster: 'not_applicable', canUnderstandCaster: 'not_applicable', canSeeCaster: 'not_applicable' }, abilityThreshold: { ability: 'not_applicable', operator: 'not_applicable', value: 'not_applicable' }, selfRelation: 'not_applicable' }, requiresStatus: [], saveModifiers: [] } as any,
      manipulation: {
        type: 'normal',
        volume: { shape: 'Cube', size: 5, depth: 0 }
      }
    }

    const cmd = new TerrainCommand(effect, makeContext(caster, []))
    const result = cmd.execute(state)

    // Check center tile (2, 2) has no difficult effect and movement cost is back to 1
    const tile = result.mapData?.tiles.get('2-2')
    expect(tile).toBeDefined()
    expect(tile?.movementCost).toBe(1)
    expect(tile?.environmentalEffects?.some((e: any) => e.type === 'difficult' || e.type === 'difficult_terrain')).toBe(false)
  })
})
