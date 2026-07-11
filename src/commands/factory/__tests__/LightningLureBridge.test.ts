import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import lightningLure from '../../../../public/data/spells/level-0/lightning-lure.json'
import { type Spell, type DamageEffect, type MovementEffect } from '@/types/spells'
import * as savingThrowUtils from '@/utils/character/savingThrowUtils'

// Lightning Lure resolves its Strength save through the character-specific
// utility imported by SpellCommandFactory. Mocking the older facade left the
// test at the mercy of real dice and made different cases fail on each run.
vi.mock('@/utils/character/savingThrowUtils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/character/savingThrowUtils')>()
  return {
    ...actual,
    rollSavingThrow: vi.fn()
  }
})

const spell = lightningLure as unknown as Spell

type LightningLureBridge = {
  movementEffect: MovementEffect
  damageEffect: DamageEffect
  execute: (state: ReturnType<typeof createMockCombatState>) => Promise<ReturnType<typeof createMockCombatState>>
}

const makeCaster = (level = 1) =>
  createMockCombatCharacter({
    id: 'caster',
    name: 'Lightning Caster',
    level,
    position: { x: 0, y: 0 }
  })

const makeTarget = (position = { x: 2, y: 0 }) =>
  createMockCombatCharacter({
    id: 'target',
    name: 'Lightning Target',
    position
  })

const makeMap = (blockedTile?: { x: number; y: number }) => {
  const tiles = new Map<string, any>()

  for (let x = 0; x <= 3; x += 1) {
    tiles.set(`${x}-0`, {
      id: `${x}-0`,
      coordinates: { x, y: 0 },
      terrain: 'floor',
      elevation: 0,
      movementCost: 1,
      blocksMovement: blockedTile?.x === x && blockedTile?.y === 0,
      blocksLoS: blockedTile?.x === x && blockedTile?.y === 0,
      decoration: null,
      effects: []
    })
  }

  return {
    id: 'lightning-lure-map',
    name: 'Lightning Lure Map',
    dimensions: { width: 4, height: 1 },
    tiles
  } as const
}

describe('Lightning Lure bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps save success from pulling or damaging the target', async () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 20,
      success: true,
      modifiersApplied: []
    } as any)

    const caster = makeCaster()
    const target = makeTarget({ x: 2, y: 0 })
    const state = createMockCombatState({
      characters: [caster, target],
      mapData: makeMap(),
      combatLog: []
    })

    const commands = await SpellCommandFactory.createCommands(spell, caster, [target], 1, createMockGameState())
    let currentState = state
    for (const command of commands) {
      currentState = await command.execute(currentState)
    }

    const finalTarget = currentState.characters.find(character => character.id === target.id)

    expect(finalTarget?.position).toEqual(target.position)
    expect(finalTarget?.currentHP).toBe(target.currentHP)
  })

  it('pulls on a failed save and damages the target when it ends within 5 feet', async () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 1,
      success: false,
      modifiersApplied: []
    } as any)

    const caster = makeCaster()
    const target = makeTarget({ x: 2, y: 0 })
    const state = createMockCombatState({
      characters: [caster, target],
      mapData: makeMap(),
      combatLog: []
    })

    const commands = await SpellCommandFactory.createCommands(spell, caster, [target], 1, createMockGameState())
    let currentState = state
    for (const command of commands) {
      currentState = await command.execute(currentState)
    }

    const finalTarget = currentState.characters.find(character => character.id === target.id)

    expect(finalTarget?.position).toEqual({ x: 1, y: 0 })
    expect(finalTarget?.currentHP).toBeLessThan(target.currentHP)
  })

  it('does not damage a failed-save target that ends more than 5 feet away', async () => {
    vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
      total: 1,
      success: false,
      modifiersApplied: []
    } as any)

    const caster = makeCaster()
    const target = makeTarget({ x: 3, y: 0 })
    const state = createMockCombatState({
      characters: [caster, target],
      mapData: makeMap({ x: 1, y: 0 }),
      combatLog: []
    })

    const commands = await SpellCommandFactory.createCommands(spell, caster, [target], 1, createMockGameState())
    let currentState = state
    for (const command of commands) {
      currentState = await command.execute(currentState)
    }

    const finalTarget = currentState.characters.find(character => character.id === target.id)

    expect(finalTarget?.position).toEqual({ x: 2, y: 0 })
    expect(finalTarget?.currentHP).toBe(target.currentHP)
  })

  it('keeps Lightning Lure scaling at levels 5, 11, and 17', async () => {
    const casterLevels = [1, 5, 11, 17]
    const expectedDice = ['1d8', '2d8', '3d8', '4d8']

    for (const [index, level] of casterLevels.entries()) {
      const caster = makeCaster(level)
      const target = makeTarget()
      const commands = await SpellCommandFactory.createCommands(spell, caster, [target], 1, createMockGameState())
      const bridge = commands[0] as LightningLureBridge

      expect(bridge.movementEffect.movementType).toBe('pull')
      expect(bridge.damageEffect.damage.dice).toBe(expectedDice[index])
    }
  })
})
