import { afterEach, describe, expect, it, vi } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import { WeaponAttackCommand } from '../AbilityCommandFactory'
import { NarrativeCommand } from '../../effects/NarrativeCommand'
import { createMockCombatCharacter, createMockCombatState, createMockGameState, createMockItem } from '@/utils/factories'
import { ItemType } from '@/types/items'
import type { SelectedSpellTarget } from '@/types/combat'
import trueStrike from '../../../../public/data/spells/level-0/true-strike.json'

/**
 * This file proves the smallest durable True Strike bridge.
 *
 * The scenarios here focus on the new cast-time weapon snapshot path, the
 * selected creature target handoff, the Radiant-versus-normal choice, and the
 * rejection path for an invalid weapon snapshot. That keeps the proof narrow
 * while still exercising the actual weapon attack command used by the runtime.
 *
 * Called by: focused Vitest proof for G58.
 * Depends on: SpellCommandFactory, WeaponAttackCommand, and the shared mock
 * factories used across the command suite.
 */

// ============================================================================
// Shared True Strike Fixtures
// ============================================================================
// The helpers below build a caster with a real weapon snapshot in the main
// hand so the test hits the production-shaped path instead of a fake stub.
// ============================================================================

const createTrueStrikeCaster = (overrides: Partial<ReturnType<typeof createMockCombatCharacter>> = {}) =>
  createMockCombatCharacter({
    id: 'true-strike-caster',
    name: 'True Strike Caster',
    level: 11,
    stats: {
      strength: 10,
      dexterity: 12,
      constitution: 12,
      intelligence: 18,
      wisdom: 10,
      charisma: 10,
      baseInitiative: 0,
      speed: 30,
      cr: '1'
    },
    class: {
      id: 'wizard',
      name: 'Wizard',
      description: 'A spellcaster.',
      hitDie: 6,
      primaryAbility: ['Intelligence'],
      savingThrowProficiencies: ['Intelligence', 'Wisdom'],
      skillProficienciesAvailable: [],
      numberOfSkillProficiencies: 2,
      armorProficiencies: [],
      weaponProficiencies: ['Simple weapons', 'Martial weapons'],
      features: [],
      spellcasting: {
        ability: 'Intelligence',
        knownCantrips: 0,
        knownSpellsL1: 0,
        spellList: []
      }
    } as never,
    weaponProficiencies: ['Simple weapons', 'Martial weapons'],
    equippedItems: {
      MainHand: createMockItem({
        id: 'longsword',
        name: 'Longsword',
        type: ItemType.Weapon,
        description: 'A straightforward weapon for a real combat snapshot.',
        category: 'Martial Weapon',
        damageDice: '1d8',
        damageType: 'slashing',
        costInGp: 1,
        properties: []
      })
    } as never,
    ...overrides
  } as never)

const createTrueStrikeTarget = () =>
  createMockCombatCharacter({
    id: 'true-strike-target',
    name: 'True Strike Target',
    armorClass: 1,
    currentHP: 20,
    maxHP: 20,
    class: {
      id: 'fighter',
      name: 'Fighter',
      description: 'A target dummy with a valid combat sheet.',
      hitDie: 10,
      primaryAbility: ['Strength'],
      savingThrowProficiencies: [],
      skillProficienciesAvailable: [],
      numberOfSkillProficiencies: 0,
      armorProficiencies: [],
      weaponProficiencies: [],
      features: [],
      spellcasting: {
        ability: 'Intelligence',
        knownCantrips: 0,
        knownSpellsL1: 0,
        spellList: []
      }
    } as never
  })

const createTrueStrikeSelectedTarget = (targetId: string): SelectedSpellTarget[] => [
  {
    kind: 'creature',
    id: targetId
  }
]

describe('True Strike bridge', () => {
  afterEach(() => {
    // Each bridge case owns any random-source pin it creates; restoring here
    // prevents that deterministic proof from leaking into neighboring cases.
    vi.restoreAllMocks()
  })

  it('turns the cast into a real weapon attack against the selected creature target and applies Radiant scaling', async () => {
    // Armor Class 1 still allows a natural-one miss. Pin a normal roll because
    // this test proves target handoff and damage scaling, not miss behavior.
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const caster = createTrueStrikeCaster()
    const target = createTrueStrikeTarget()
    const gameState = createMockGameState()
    const selectedSpellTargets = createTrueStrikeSelectedTarget(target.id)

    const commands = await SpellCommandFactory.createCommands(
      trueStrike,
      caster,
      [caster, target],
      0,
      gameState,
      'Radiant',
      undefined,
      undefined,
      selectedSpellTargets
    )

    expect(commands).toHaveLength(1)
    expect(commands[0]).toBeInstanceOf(WeaponAttackCommand)
    expect((commands[0] as unknown as { metadata: { targetIds: string[] } }).metadata.targetIds).toEqual([target.id])

    const attackCommand = commands[0] as unknown as {
      targets: typeof selectedSpellTargets
      context: { selectedSpellTargets?: SelectedSpellTarget[] }
      ability: {
        effects: Array<{ dice?: string; damageType?: string }>
      }
    }

    expect(attackCommand.context.selectedSpellTargets).toEqual(selectedSpellTargets)
    expect(attackCommand.ability.effects[0].damageType).toBe('Radiant')
    expect(attackCommand.ability.effects[0].dice).toBe('1d8+4')
    expect(attackCommand.ability.effects[1].damageType).toBe('Radiant')
    expect(attackCommand.ability.effects[1].dice).toBe('2d6')

    const combatState = createMockCombatState({
      characters: [caster, target]
    })
    const resultState = await (commands[0] as WeaponAttackCommand).execute(combatState)
    const updatedTarget = resultState.characters.find(character => character.id === target.id)

    expect(updatedTarget?.currentHP).toBeLessThan(target.currentHP)
  })

  it('keeps the chosen weapon damage type when the player asks for the normal weapon damage packet', async () => {
    const caster = createTrueStrikeCaster({
      level: 17,
      stats: {
        strength: 10,
        dexterity: 12,
        constitution: 12,
        intelligence: 20,
        wisdom: 10,
        charisma: 10,
        baseInitiative: 0,
        speed: 30,
        cr: '1'
      }
    })
    const target = createTrueStrikeTarget()
    const selectedSpellTargets = createTrueStrikeSelectedTarget(target.id)

    const commands = await SpellCommandFactory.createCommands(
      trueStrike,
      caster,
      [caster, target],
      0,
      createMockGameState(),
      'Weapon normal damage type',
      undefined,
      undefined,
      selectedSpellTargets
    )

    expect(commands).toHaveLength(1)
    expect(commands[0]).toBeInstanceOf(WeaponAttackCommand)

    const attackCommand = commands[0] as unknown as {
      ability: {
        effects: Array<{ dice?: string; damageType?: string }>
      }
    }

    expect(attackCommand.ability.effects[0].damageType).toBe('slashing')
    expect(attackCommand.ability.effects[0].dice).toBe('1d8+5')
    expect(attackCommand.ability.effects[1].damageType).toBe('Radiant')
    expect(attackCommand.ability.effects[1].dice).toBe('3d6')
  })

  it('rejects an invalid weapon snapshot instead of spending the cast on a fake attack', async () => {
    const caster = createTrueStrikeCaster({
      equippedItems: {
        MainHand: createMockItem({
          id: 'rusty-dagger',
          name: 'Rusty Dagger',
          type: ItemType.Weapon,
          description: 'A weapon that intentionally fails the True Strike requirements.',
          category: 'Simple Weapon',
          damageDice: '1d4',
          damageType: 'piercing',
          costInGp: 0
        })
      } as never
    })
    const target = createTrueStrikeTarget()

    const commands = await SpellCommandFactory.createCommands(
      trueStrike,
      caster,
      [caster, target],
      0,
      createMockGameState(),
      undefined,
      undefined,
      undefined,
      createTrueStrikeSelectedTarget(target.id)
    )

    expect(commands).toHaveLength(1)
    expect(commands[0]).toBeInstanceOf(NarrativeCommand)

    const rejectedState = await (commands[0] as NarrativeCommand).execute(createMockCombatState({
      characters: [caster, target]
    }))

    expect(rejectedState.combatLog.at(-1)?.message).toContain('worth at least 1 CP')
  })
})
