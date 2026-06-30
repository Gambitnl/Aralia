import { describe, expect, it, beforeEach, vi } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import primalSavagery from '../../../../public/data/spells/level-0/primal-savagery.json'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import * as combatUtils from '@/utils/combatUtils'
import type { Spell } from '@/types/spells'

vi.mock('@/utils/combatUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/combatUtils')>()
  return {
    ...actual,
    rollD20: vi.fn(),
    rollDamage: vi.fn()
  }
})

/**
 * This file proves Primal Savagery gets the melee spell attack treatment and
 * does not leave a sharpened-body-state artifact behind after the attack.
 *
 * Called by: the structured-spell-execution G45 verification pass.
 * Depends on: live Primal Savagery JSON, SpellCommandFactory, and combat mocks.
 */
describe('Primal Savagery bridge', () => {
  const spell = primalSavagery as unknown as Spell

  const makeCaster = (level: number) => createMockCombatCharacter({
    id: 'primal-caster',
    name: 'Druid',
    level,
    spellcastingAbility: 'wisdom',
    stats: {
      ...createMockCombatCharacter().stats,
      wisdom: 16
    }
  })

  const makeTarget = (id: string, armorClass = 10) => createMockCombatCharacter({
    id,
    name: 'Target',
    armorClass,
    currentHP: 20,
    maxHP: 20,
    statusEffects: [],
    conditions: []
  })

  beforeEach(() => {
    vi.mocked(combatUtils.rollD20).mockReset()
    vi.mocked(combatUtils.rollDamage).mockReset()
  })

  it('creates a real melee spell attack, applies acid damage on hit, and clears the sharpened state', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(12)
    vi.mocked(combatUtils.rollDamage).mockReturnValue(7)

    const caster = makeCaster(1)
    const target = makeTarget('primal-target', 10)
    const commands = await SpellCommandFactory.createCommands(spell, caster, [target], 0, createMockGameState())
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 5,
        turnOrder: [caster.id, target.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    expect(commands).toHaveLength(1)
    expect(commands[0].constructor.name).toBe('SpellAttackCommand')

    const result = await commands[0].execute(state)
    const targetAfterHit = result.characters.find(character => character.id === target.id)
    const casterAfterHit = result.characters.find(character => character.id === caster.id)

    expect(targetAfterHit?.currentHP).toBe(13)
    expect(result.combatLog.some(entry =>
      entry.data?.spellId === 'primal-savagery' &&
      entry.data?.isHit === true
    )).toBe(true)
    expect(result.combatLog.some(entry =>
      typeof entry.message === 'string' &&
      entry.message.toLowerCase().includes('sharpen')
    )).toBe(true)
    expect(result.combatLog.some(entry =>
      typeof entry.message === 'string' &&
      entry.message.toLowerCase().includes('return to normal')
    )).toBe(true)
    expect(casterAfterHit?.statusEffects?.some(effect =>
      effect.source === 'Primal Savagery' ||
      effect.visualEffect === 'primal_savagery_sharpened'
    )).toBe(false)
  })

  it('skips damage on miss and still clears the sharpened state', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(2)
    vi.mocked(combatUtils.rollDamage).mockReturnValue(7)

    const caster = makeCaster(1)
    const target = makeTarget('primal-miss-target', 18)
    const commands = await SpellCommandFactory.createCommands(spell, caster, [target], 0, createMockGameState())
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 5,
        turnOrder: [caster.id, target.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    const result = await commands[0].execute(state)
    const targetAfterMiss = result.characters.find(character => character.id === target.id)
    const casterAfterMiss = result.characters.find(character => character.id === caster.id)

    expect(targetAfterMiss?.currentHP).toBe(20)
    expect(result.combatLog.some(entry =>
      entry.data?.spellId === 'primal-savagery' &&
      entry.data?.isHit === false
    )).toBe(true)
    expect(result.combatLog.some(entry =>
      typeof entry.message === 'string' &&
      entry.message.toLowerCase().includes('sharpen')
    )).toBe(true)
    expect(result.combatLog.some(entry =>
      typeof entry.message === 'string' &&
      entry.message.toLowerCase().includes('return to normal')
    )).toBe(true)
    expect(casterAfterMiss?.statusEffects?.some(effect =>
      effect.source === 'Primal Savagery' ||
      effect.visualEffect === 'primal_savagery_sharpened'
    )).toBe(false)
  })

  it.each([
    [5, '2d10'],
    [11, '3d10'],
    [17, '4d10']
  ] as const)('scales acid damage to %s at caster level %s', async (level, expectedDice) => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(12)
    vi.mocked(combatUtils.rollDamage).mockReturnValue(7)

    const caster = makeCaster(level)
    const target = makeTarget(`primal-scale-${level}`, 10)
    const commands = await SpellCommandFactory.createCommands(spell, caster, [target], 0, createMockGameState())
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: {
        currentTurn: 5,
        turnOrder: [caster.id, target.id],
        currentCharacterId: caster.id,
        phase: 'action',
        actionsThisTurn: []
      },
      combatLog: [],
      activeLightSources: []
    })

    await commands[0].execute(state)

    expect(vi.mocked(combatUtils.rollDamage)).toHaveBeenCalledWith(expectedDice, false, 1)
  })
})
