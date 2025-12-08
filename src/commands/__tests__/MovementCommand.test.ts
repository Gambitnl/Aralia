import { describe, expect, it } from 'vitest'
import { MovementCommand } from '../effects/MovementCommand'
import { TerrainCommand } from '../effects/TerrainCommand'
import type { CommandContext } from '../base/SpellCommand'
import type { CombatCharacter, CombatState, Position } from '@/types/combat'
import type { MovementEffect, TerrainEffect } from '@/types/spells'

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
  movement: { used: 0, total: 30 },
  freeActions: 0
}

const makeCharacter = (id: string, position: Position): CombatCharacter => ({
  id,
  name: id,
  level: 1,
  class: 'Wizard' as any,
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
  reactiveTriggers: []
})

const makeContext = (caster: CombatCharacter, targets: CombatCharacter[]): CommandContext => ({
  spellId: 'test-spell',
  spellName: 'Test Spell',
  castAtLevel: 1,
  caster,
  targets,
  gameState: {} as any
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
    expect(terrainLog?.data?.affectedPositions?.length).toBeGreaterThan(0)
  })
})
