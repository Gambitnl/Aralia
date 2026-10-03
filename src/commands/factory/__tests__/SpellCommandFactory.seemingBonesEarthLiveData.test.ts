import { describe, expect, it, vi, afterEach } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import seeming from '@/data/spells/level-5/seeming.json'
import bonesOfTheEarth from '@/data/spells/level-6/bones-of-the-earth.json'
import type { CombatCharacter, CombatState } from '@/types/combat'
import type { Spell } from '@/types/spells'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/core'
import { ConcentrationTracker } from '@/systems/spells/mechanics/ConcentrationTracker'

// agora-f821.4: this file pins Math.random to make a roll deterministic. Game rolls now
// run on the audit log's own seed stream, so the pin only reaches them
// through the roller's supported injected-source seam. Feeding
// Math.random in as that source keeps every pin below meaning what it
// meant before the migration.
vi.mock('../../../systems/dice/rollers', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../systems/dice/rollers')>()
  return {
    ...actual,
    rollDice: (notation: string, options: { rng?: () => number } = {}) =>
      actual.rollDice(notation, { ...options, rng: options.rng ?? Math.random }),
    rollD20: (options: { rng?: () => number } = {}) =>
      actual.rollD20({ ...options, rng: options.rng ?? Math.random }),
    rollDamage: (
      notation: string,
      isCritical: boolean,
      minRoll = 1,
      rng?: () => number,
    ) => actual.rollDamage(notation, isCritical, minRoll, rng ?? Math.random),
  }
})


/**
 * This file verifies the live data execution bridges for Seeming and Bones of the Earth,
 * as well as the concentration zone teardown link.
 *
 * Covers:
 * - Seeming: willing ally consent vs unwilling enemy Charisma saves and disguise status effects.
 * - Bones of the Earth: voluntary failure, normal Dex saves, and blocked-pillar crushing/restraint.
 * - Concentration: active spell zone cleanup on concentration loss.
 *
 * Called by: Vitest
 * Depends on: seeming.json, bones-of-the-earth.json, SpellCommandFactory, ConcentrationTracker
 */

const makeCharacter = (id: string, overrides: Partial<CombatCharacter> = {}): CombatCharacter =>
  createMockCombatCharacter({
    id,
    name: id,
    level: 11,
    currentHP: 60,
    maxHP: 60,
    team: 'player',
    stats: {
      strength: 10,
      dexterity: 10,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 18,
      baseInitiative: 0,
      speed: 30,
      cr: '1',
      creatureTypes: ['Humanoid'],
      size: 'Medium'
    },
    position: { x: 0, y: 0 },
    ...overrides
  })

const makeState = (characters: CombatCharacter[], extraState: Partial<CombatState> = {}): CombatState =>
  createMockCombatState({
    characters,
    combatLog: [],
    ...extraState
  })

describe('Seeming live data execution bridge', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('applies disguise to willing allies without rolling a saving throw', async () => {
    const caster = makeCharacter('caster', { team: 'player' })
    const ally = makeCharacter('ally', { team: 'player' })

    const commands = await SpellCommandFactory.createCommands(
      seeming as unknown as Spell,
      caster,
      [ally],
      5,
      createMockGameState()
    )

    expect(commands.length).toBe(1)
    expect(commands[0].metadata.effectType).toBe('seeming_disguise')

    const initialState = makeState([caster, ally])
    const finalState = await commands[0].execute(initialState)

    const updatedAlly = finalState.characters.find(c => c.id === 'ally')
    expect(updatedAlly?.statusEffects?.some(s => s.name === 'Disguised (Seeming)')).toBe(true)

    const willingLog = finalState.combatLog.find(log => log.message.includes('willingly accepts the illusory disguise'))
    expect(willingLog).toBeDefined()
  })

  it('unwilling enemies roll Charisma save: resists on success', async () => {
    // Mock high d20 roll so save succeeds
    vi.spyOn(Math, 'random').mockReturnValue(0.95)

    const caster = makeCharacter('caster', { team: 'player' })
    const enemy = makeCharacter('enemy', { team: 'enemy' })

    const commands = await SpellCommandFactory.createCommands(
      seeming as unknown as Spell,
      caster,
      [enemy],
      5,
      createMockGameState()
    )

    const initialState = makeState([caster, enemy])
    const finalState = await commands[0].execute(initialState)

    const updatedEnemy = finalState.characters.find(c => c.id === 'enemy')
    expect(updatedEnemy?.statusEffects?.some(s => s.name === 'Disguised (Seeming)')).toBe(false)

    const resistLog = finalState.combatLog.find(log => log.message.includes('succeeds the Charisma save') && log.message.includes('unaffected'))
    expect(resistLog).toBeDefined()
  })

  it('unwilling enemies roll Charisma save: disguised on failure with Study check DC', async () => {
    // Mock low d20 roll so save fails
    vi.spyOn(Math, 'random').mockReturnValue(0.05)

    const caster = makeCharacter('caster', { team: 'player' })
    const enemy = makeCharacter('enemy', { team: 'enemy' })

    const commands = await SpellCommandFactory.createCommands(
      seeming as unknown as Spell,
      caster,
      [enemy],
      5,
      createMockGameState()
    )

    const initialState = makeState([caster, enemy])
    const finalState = await commands[0].execute(initialState)

    const updatedEnemy = finalState.characters.find(c => c.id === 'enemy')
    const disguise = updatedEnemy?.statusEffects?.find(s => s.name === 'Disguised (Seeming)')
    expect(disguise).toBeDefined()
    expect(disguise?.escapeCheck?.abilityOptions).toContain('Intelligence')

    const failLog = finalState.combatLog.find(log => log.message.includes('fails the Charisma save') && log.message.includes('disguised'))
    expect(failLog).toBeDefined()
  })
})

describe('Bones of the Earth live data execution bridge', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('allows creatures to voluntarily fail the Dexterity save to be lifted', async () => {
    const caster = makeCharacter('caster', { team: 'player' })
    const ally = makeCharacter('ally', { team: 'player' })

    const commands = await SpellCommandFactory.createCommands(
      bonesOfTheEarth as unknown as Spell,
      caster,
      [ally],
      6,
      createMockGameState(),
      'voluntaryFailure=true'
    )

    expect(commands.length).toBe(1)
    expect(commands[0].metadata.effectType).toBe('bones_of_the_earth_pillar')

    const initialState = makeState([caster, ally])
    const finalState = await commands[0].execute(initialState)

    const liftLog = finalState.combatLog.find(log => log.message.includes('voluntarily fails the Dexterity save') && log.message.includes('lifted'))
    expect(liftLog).toBeDefined()
  })

  it('successful Dexterity save avoids the stone pillar', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.95)

    const caster = makeCharacter('caster', { team: 'player' })
    const enemy = makeCharacter('enemy', { team: 'enemy' })

    const commands = await SpellCommandFactory.createCommands(
      bonesOfTheEarth as unknown as Spell,
      caster,
      [enemy],
      6,
      createMockGameState()
    )

    const initialState = makeState([caster, enemy])
    const finalState = await commands[0].execute(initialState)

    const avoidLog = finalState.combatLog.find(log => log.message.includes('succeeds the Dexterity save') && log.message.includes('avoids'))
    expect(avoidLog).toBeDefined()
  })

  it('failed Dexterity save with blocked pillar deals 6d6 crushing damage and Restrains', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05)

    const caster = makeCharacter('caster', { team: 'player' })
    const enemy = makeCharacter('enemy', { team: 'enemy', currentHP: 50 })

    const commands = await SpellCommandFactory.createCommands(
      bonesOfTheEarth as unknown as Spell,
      caster,
      [enemy],
      6,
      createMockGameState(),
      'blockedPillar=true'
    )

    const initialState = makeState([caster, enemy])
    const finalState = await commands[0].execute(initialState)

    const updatedEnemy = finalState.characters.find(c => c.id === 'enemy')
    expect(updatedEnemy?.currentHP).toBeLessThan(50)
    expect(updatedEnemy?.statusEffects?.some(s => s.name === 'Restrained')).toBe(true)

    const crushLog = finalState.combatLog.find(log => log.message.includes('crushed against an obstacle') && log.message.includes('Restrained'))
    expect(crushLog).toBeDefined()
  })
})

describe('Concentration zone and emanation teardown', () => {
  it('cleans up active spell zones when concentration breaks', () => {
    const caster = makeCharacter('caster', {
      concentratingOn: {
        spellId: 'flaming-sphere',
        spellName: 'Flaming Sphere',
        spellLevel: 2,
        startedTurn: 1,
        effectIds: [],
        canDropAsFreeAction: true
      }
    })

    const initialSpellZones = [
      {
        id: 'zone_flaming_sphere',
        spellId: 'flaming-sphere',
        casterId: 'caster',
        position: { x: 5, y: 5 },
        effects: [],
        triggeredThisTurn: new Set<string>(),
        triggeredEver: new Set<string>()
      },
      {
        id: 'zone_unrelated_spirit_guardians',
        spellId: 'spirit-guardians',
        casterId: 'other_caster',
        position: { x: 10, y: 10 },
        effects: [],
        triggeredThisTurn: new Set<string>(),
        triggeredEver: new Set<string>()
      }
    ]

    const state = makeState([caster], {
      spellZones: initialSpellZones
    })

    const nextState = ConcentrationTracker.breakConcentration(caster, state)

    expect(nextState.spellZones?.length).toBe(1)
    expect(nextState.spellZones?.[0].id).toBe('zone_unrelated_spirit_guardians')
    expect(nextState.characters.find(c => c.id === 'caster')?.concentratingOn).toBeUndefined()
  })
})
