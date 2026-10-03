import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import { AbilityCommandFactory, WeaponAttackCommand } from '../AbilityCommandFactory'
import { NarrativeCommand } from '../../effects/NarrativeCommand'
import { UtilityCommand } from '../../effects/UtilityCommand'
import { GrantedActionCommand } from '../../effects/GrantedActionCommand'
import { createAbilityFromSpell } from '@/utils/character/spellAbilityFactory'
import {
  createMockCombatCharacter,
  createMockCombatState,
  createMockGameState,
  createMockItem
} from '@/utils/core'
import { ItemType } from '@/types/items'
import type {
  Ability,
  BattleMapData,
  CombatCharacter,
  CombatState,
  SelectedSpellTarget
} from '@/types/combat'
import type { MovementTriggerDebuff } from '@/systems/spells/effects/triggerHandler'
import type { DamageEffect, MovementEffect, Spell } from '@/types/spells'
import type { PlayerCharacter } from '@/types/character'
import type { Item } from '@/types/items'
import type { CharacterStats } from '@/types/core'
import * as diceRollers from '@/systems/dice/rollers'
import * as savingThrowUtils from '@/utils/character/savingThrowUtils'

// Live Cantrip Data JSON files
import trueStrike from '@/data/spells/level-0/true-strike.json'
import boomingBlade from '@/data/spells/level-0/booming-blade.json'
import greenFlameBlade from '@/data/spells/level-0/green-flame-blade.json'
import primalSavagery from '@/data/spells/level-0/primal-savagery.json'
import lightningLure from '@/data/spells/level-0/lightning-lure.json'
import magicStone from '@/data/spells/level-0/magic-stone.json'
import produceFlame from '@/data/spells/level-0/produce-flame.json'

/**
 * This file verifies the combat execution bridges for all attack-converting and combat-attack cantrips.
 *
 * In Aralia's combat engine, cantrips with attack riders or granted attack actions do not follow a generic
 * one-size-fits-all spell resolution. Instead, each spell bridges into the combat pipeline according to its
 * 5e / 2024 rules:
 * 1. True Strike: Converts a weapon attack to use the spellcasting modifier, with optional Radiant damage and tier scaling.
 * 2. Booming Blade: Executes a melee weapon attack, attaches thunder damage on hit at higher levels, and arms a movement rider.
 * 3. Green-Flame Blade: Executes a melee weapon attack, adds fire damage, and leaps green fire to a nearby secondary target.
 * 4. Primal Savagery: Delivers a melee spell attack with acid damage scaling and transient sharpened bodily weapons.
 * 5. Lightning Lure: Forces a Strength save to pull a target closer and deals lightning damage if the target ends within 5 feet.
 * 6. Magic Stone: Imbues pebbles via a touch utility command that allies or the caster can fling using spellcasting stats.
 * 7. Produce Flame: Creates a persistent flame light source on cast, granting a follow-up ranged spell attack (Hurl Flame).
 *
 * Called by: Vitest combat engine regression suite.
 * Depends on: SpellCommandFactory, AbilityCommandFactory, GrantedActionCommand, UtilityCommand, and live spell JSON fixtures.
 */

// ============================================================================
// Centralized Mocks
// ============================================================================
// Mock combat dice and saving throw utilities so tests can deterministically
// verify hit paths, miss paths, damage numbers, and save resolutions.
// ============================================================================

// agora-f821.4 retired the combatUtils roller family; the modules under
// test roll through systems/dice/rollers now. One hoisted set of mocks
// stands in for BOTH specifiers, so one vi.mocked(...) pins every die.
const diceMocks = vi.hoisted(() => ({
    rollD20: vi.fn(),
    rollDamage: vi.fn((formula: string) => {
      if (formula === '1d6+5') return 11
      if (formula === '1d10+3') return 13
      return 7
    }),
}))


vi.mock('@/systems/dice/rollers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/systems/dice/rollers')>()
  return { ...actual, ...diceMocks }
})

vi.mock('@/utils/combat', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/combat')>()
  return {
    ...actual,
    ...diceMocks,
  }
})

vi.mock('@/utils/character/savingThrowUtils', async importOriginal => {
  const actual = await importOriginal<typeof import('@/utils/character/savingThrowUtils')>()
  return {
    ...actual,
    rollSavingThrow: vi.fn()
  }
})

describe('Cantrip Attack Bridges Consolidated Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // 1. True Strike Bridge
  // ============================================================================
  // True Strike allows a caster to make a weapon strike guided by magic. The attack
  // uses the caster's spellcasting ability modifier for both attack and damage rolls.
  // The player can choose whether to deal Radiant damage or the weapon's normal damage
  // type, and the spell adds extra Radiant dice at levels 5 (1d6), 11 (2d6), and 17 (3d6).
  // ============================================================================

  describe('True Strike bridge', () => {
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
            description: 'A martial blade for True Strike testing.',
            category: 'Martial Weapon',
            damageDice: '1d8',
            damageType: 'Slashing',
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
          description: 'A practice dummy.',
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

    it('turns the cast into a real weapon attack against the selected creature target and applies Radiant scaling at level 11 (2d6)', async () => {
      // Mock attack roll to guarantee a solid hit against target AC
      vi.mocked(diceRollers.rollD20).mockReturnValue(15)
      const caster = createTrueStrikeCaster()
      const target = createTrueStrikeTarget()
      const gameState = createMockGameState()
      const selectedSpellTargets = createTrueStrikeSelectedTarget(target.id)

      const commands = await SpellCommandFactory.createCommands(
        trueStrike as unknown as Spell,
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

      // Base weapon damage uses spellcasting modifier (+4 from 18 INT) and converts to Radiant
      expect(attackCommand.context.selectedSpellTargets).toEqual(selectedSpellTargets)
      expect(attackCommand.ability.effects[0].damageType).toBe('Radiant')
      expect(attackCommand.ability.effects[0].dice).toBe('1d8+4')
      // Level 11 cantrip tier adds 2d6 Radiant damage
      expect(attackCommand.ability.effects[1].damageType).toBe('Radiant')
      expect(attackCommand.ability.effects[1].dice).toBe('2d6')

      const combatState = createMockCombatState({
        characters: [caster, target]
      })
      const resultState = await (commands[0] as WeaponAttackCommand).execute(combatState)
      const updatedTarget = resultState.characters.find(character => character.id === target.id)

      expect(updatedTarget?.currentHP).toBeLessThan(target.currentHP)
    })

    it('applies level 5 (1d6) and level 17 (3d6) scaling tiers correctly', async () => {
      const target = createTrueStrikeTarget()
      const selectedSpellTargets = createTrueStrikeSelectedTarget(target.id)

      // Test level 5 scaling (1d6 Radiant)
      const casterL5 = createTrueStrikeCaster({ level: 5 })
      const commandsL5 = await SpellCommandFactory.createCommands(
        trueStrike as unknown as Spell,
        casterL5,
        [casterL5, target],
        0,
        createMockGameState(),
        'Radiant',
        undefined,
        undefined,
        selectedSpellTargets
      )
      const attackL5 = commandsL5[0] as unknown as { ability: { effects: Array<{ dice?: string; damageType?: string }> } }
      expect(attackL5.ability.effects[1].dice).toBe('1d6')
      expect(attackL5.ability.effects[1].damageType).toBe('Radiant')

      // Test level 17 scaling (3d6 Radiant)
      const casterL17 = createTrueStrikeCaster({
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
      const commandsL17 = await SpellCommandFactory.createCommands(
        trueStrike as unknown as Spell,
        casterL17,
        [casterL17, target],
        0,
        createMockGameState(),
        'Radiant',
        undefined,
        undefined,
        selectedSpellTargets
      )
      const attackL17 = commandsL17[0] as unknown as { ability: { effects: Array<{ dice?: string; damageType?: string }> } }
      expect(attackL17.ability.effects[0].dice).toBe('1d8+5')
      expect(attackL17.ability.effects[1].dice).toBe('3d6')
      expect(attackL17.ability.effects[1].damageType).toBe('Radiant')
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
        trueStrike as unknown as Spell,
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

      // Base weapon retains Slashing damage while rider is Radiant
      expect(attackCommand.ability.effects[0].damageType).toBe('Slashing')
      expect(attackCommand.ability.effects[0].dice).toBe('1d8+5')
      expect(attackCommand.ability.effects[1].damageType).toBe('Radiant')
      expect(attackCommand.ability.effects[1].dice).toBe('3d6')
    })

    it('rejects an invalid weapon snapshot instead of spending the cast on a fake attack', async () => {
      const caster = createTrueStrikeCaster({
        equippedItems: {
          MainHand: createMockItem({
            id: 'worthless-dagger',
            name: 'Worthless Dagger',
            type: ItemType.Weapon,
            description: 'A weapon worth 0 CP failing True Strike material requirements.',
            category: 'Simple Weapon',
            damageDice: '1d4',
            damageType: 'Piercing',
            costInGp: 0
          })
        } as never
      })
      const target = createTrueStrikeTarget()

      const commands = await SpellCommandFactory.createCommands(
        trueStrike as unknown as Spell,
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

  // ============================================================================
  // 2. Booming Blade Bridge
  // ============================================================================
  // Booming Blade wraps a melee weapon attack in thunderous energy. On a hit,
  // the target is sheathed in booming energy. If the target willingly moves before
  // the start of the caster's next turn, it immediately takes thunder damage.
  // At higher levels (5, 11, 17), both the initial hit and the movement rider scale.
  // ============================================================================

  describe('Booming Blade bridge', () => {
    const spell = boomingBlade as unknown as Spell

    const createBoomingBladeCaster = (overrides: Partial<ReturnType<typeof createMockCombatCharacter>> = {}) =>
      createMockCombatCharacter({
        id: 'booming-blade-caster',
        name: 'Booming Blade Caster',
        level: 5,
        spellcastingAbility: 'intelligence',
        position: { x: 0, y: 0 },
        stats: {
          ...createMockCombatCharacter().stats,
          strength: 16,
          intelligence: 14
        },
        class: {
          ...createMockCombatCharacter().class,
          weaponProficiencies: ['Simple weapons', 'Martial weapons']
        },
        weaponProficiencies: ['Simple weapons', 'Martial weapons'],
        equippedItems: {
          MainHand: createMockItem({
            id: 'longsword',
            name: 'Longsword',
            type: ItemType.Weapon,
            description: 'A melee weapon fulfilling the material requirement.',
            category: 'Martial Weapon',
            damageDice: '1d8',
            damageType: 'Slashing',
            costInGp: 1,
            properties: []
          })
        } as never,
        ...overrides
      } as never)

    const createBoomingBladeTarget = () =>
      createMockCombatCharacter({
        id: 'booming-blade-target',
        name: 'Booming Blade Target',
        position: { x: 1, y: 0 },
        armorClass: 10,
        currentHP: 40,
        maxHP: 40
      })

    const createSelectedTarget = (targetId: string): SelectedSpellTarget[] => [
      {
        kind: 'creature',
        id: targetId
      }
    ]

    const findBoomingDebuff = (state: CombatState): MovementTriggerDebuff | undefined =>
      (state as CombatState & { movementDebuffs?: MovementTriggerDebuff[] }).movementDebuffs?.find(debuff =>
        debuff.spellId === 'booming-blade'
      )

    it('turns the cast into a real melee weapon attack and stores the movement rider only after a hit', async () => {
      vi.mocked(diceRollers.rollD20).mockReturnValue(18)
      const caster = createBoomingBladeCaster()
      const target = createBoomingBladeTarget()
      const commands = await SpellCommandFactory.createCommands(
        spell,
        caster,
        [target],
        0,
        createMockGameState(),
        undefined,
        undefined,
        undefined,
        createSelectedTarget(target.id)
      )

      expect(commands).toHaveLength(1)
      expect(commands[0]).toBeInstanceOf(WeaponAttackCommand)
      expect((commands[0] as unknown as { metadata: { targetIds: string[] } }).metadata.targetIds).toEqual([target.id])

      const result = await (commands[0] as WeaponAttackCommand).execute(createMockCombatState({
        characters: [caster, target],
        combatLog: [],
        turnState: {
          currentTurn: 4,
          turnOrder: [caster.id, target.id],
          currentCharacterId: caster.id,
          phase: 'action',
          actionsThisTurn: []
        }
      }))
      const targetAfterHit = result.characters.find(character => character.id === target.id)
      const debuff = findBoomingDebuff(result)

      expect(targetAfterHit?.currentHP).toBeLessThan(target.currentHP)
      expect(debuff).toMatchObject({
        spellId: 'booming-blade',
        casterId: caster.id,
        targetId: target.id,
        expiresAtRound: 5,
        hasTriggered: false
      })
      expect(debuff?.effects[0]).toMatchObject({
        trigger: expect.objectContaining({
          type: 'on_target_move',
          movementType: 'willing'
        }),
        damage: {
          dice: '2d8',
          type: 'Thunder'
        }
      })
    })

    it('does not damage or store the delayed rider when the melee weapon attack misses', async () => {
      vi.mocked(diceRollers.rollD20).mockReturnValue(2)
      const caster = createBoomingBladeCaster()
      const target = createBoomingBladeTarget()
      const commands = await SpellCommandFactory.createCommands(
        spell,
        caster,
        [target],
        0,
        createMockGameState(),
        undefined,
        undefined,
        undefined,
        createSelectedTarget(target.id)
      )

      const result = await (commands[0] as WeaponAttackCommand).execute(createMockCombatState({
        characters: [caster, target],
        combatLog: [],
        turnState: {
          currentTurn: 4,
          turnOrder: [caster.id, target.id],
          currentCharacterId: caster.id,
          phase: 'action',
          actionsThisTurn: []
        }
      }))
      const targetAfterMiss = result.characters.find(character => character.id === target.id)

      expect(targetAfterMiss?.currentHP).toBe(target.currentHP)
      expect(findBoomingDebuff(result)).toBeUndefined()
    })

    it('uses Booming Blade hit and movement scaling from live customFormula tiers at level 17', async () => {
      const caster = createBoomingBladeCaster({ level: 17 })
      const target = createBoomingBladeTarget()
      const commands = await SpellCommandFactory.createCommands(
        spell,
        caster,
        [target],
        0,
        createMockGameState(),
        undefined,
        undefined,
        undefined,
        createSelectedTarget(target.id)
      )

      const attackCommand = commands[0] as unknown as {
        ability: {
          effects: Array<{ dice?: string; damageType?: string }>
        }
      }

      // Level 17 provides 1d8+3 weapon damage plus 3d8 Thunder damage on hit
      expect(attackCommand.ability.effects).toEqual([
        expect.objectContaining({ dice: '1d8+3', damageType: 'Slashing' }),
        expect.objectContaining({ dice: '3d8', damageType: 'Thunder' })
      ])
    })

    it('rejects a non-weapon material snapshot instead of inventing a fake melee attack', async () => {
      const caster = createBoomingBladeCaster({
        equippedItems: {
          MainHand: createMockItem({
            id: 'ruby',
            name: 'Ruby',
            type: ItemType.Treasure,
            description: 'A shiny gemstone that is not a melee weapon.'
          })
        } as never
      } as never)
      const target = createBoomingBladeTarget()

      const commands = await SpellCommandFactory.createCommands(
        spell,
        caster,
        [target],
        0,
        createMockGameState(),
        undefined,
        undefined,
        undefined,
        createSelectedTarget(target.id)
      )

      expect(commands).toHaveLength(1)
      expect(commands[0]).toBeInstanceOf(NarrativeCommand)
    })
  })

  // ============================================================================
  // 3. Green-Flame Blade Bridge
  // ============================================================================
  // Green-Flame Blade executes a melee weapon attack and sweeps green flame toward
  // a second target within 5 feet of the primary target. The leap damage only triggers
  // on a successful primary hit. At higher levels (5, 11, 17), both the primary strike
  // and the leap damage gain extra d8 fire dice.
  // ============================================================================

  describe('Green-Flame Blade bridge', () => {
    const spell = greenFlameBlade as unknown as Spell

    const createGreenFlameBladeCaster = (overrides: Partial<ReturnType<typeof createMockCombatCharacter>> = {}) =>
      createMockCombatCharacter({
        id: 'gfb-caster',
        name: 'Green-Flame Blade Caster',
        level: 17,
        spellcastingAbility: 'intelligence',
        position: { x: 0, y: 0 },
        stats: {
          ...createMockCombatCharacter().stats,
          strength: 16,
          intelligence: 18
        },
        class: {
          ...createMockCombatCharacter().class,
          weaponProficiencies: ['Simple weapons', 'Martial weapons']
        },
        weaponProficiencies: ['Simple weapons', 'Martial weapons'],
        equippedItems: {
          MainHand: createMockItem({
            id: 'longsword',
            name: 'Longsword',
            type: ItemType.Weapon,
            description: 'A melee weapon fulfilling the material requirement.',
            category: 'Martial Weapon',
            damageDice: '1d8',
            damageType: 'Slashing',
            costInGp: 1,
            properties: []
          })
        } as never,
        ...overrides
      } as never)

    const createGreenFlameBladeTarget = (id: string, name: string, x: number, y: number): CombatCharacter =>
      createMockCombatCharacter({
        id,
        name,
        position: { x, y },
        armorClass: 10,
        currentHP: 40,
        maxHP: 40
      })

    const createSelectedTargets = (primaryTargetId: string, secondaryTargetId?: string): SelectedSpellTarget[] => [
      {
        kind: 'creature',
        id: primaryTargetId
      },
      ...(secondaryTargetId
        ? [{
            kind: 'creature' as const,
            id: secondaryTargetId
          }]
        : [])
    ]

    it('turns the cast into a real weapon attack and applies the hit-gated fire leap with live scaling (level 17)', async () => {
      vi.mocked(diceRollers.rollD20).mockReturnValue(18)
      const caster = createGreenFlameBladeCaster()
      const primaryTarget = createGreenFlameBladeTarget('gfb-primary', 'Primary Target', 1, 0)
      const secondaryTarget = createGreenFlameBladeTarget('gfb-secondary', 'Secondary Target', 2, 0)

      const commands = await SpellCommandFactory.createCommands(
        spell,
        caster,
        [caster, primaryTarget, secondaryTarget],
        0,
        createMockGameState(),
        undefined,
        undefined,
        undefined,
        createSelectedTargets(primaryTarget.id, secondaryTarget.id)
      )

      expect(commands).toHaveLength(1)
      expect(commands[0]).toBeInstanceOf(WeaponAttackCommand)

      const attackCommand = commands[0] as unknown as {
        ability: {
          effects: Array<{ dice?: string; damageType?: string }>
          greenFlameBladeSecondaryTargetId?: string
          greenFlameBladeSecondaryEffect?: { damage?: { dice?: string; type?: string } }
        }
      }

      expect(attackCommand.ability.effects[0]).toEqual(
        expect.objectContaining({
          dice: '1d8+3',
          damageType: 'Slashing'
        })
      )
      expect(attackCommand.ability.effects[1]).toEqual(
        expect.objectContaining({
          dice: '3d8',
          damageType: 'Fire'
        })
      )
      expect(attackCommand.ability.greenFlameBladeSecondaryTargetId).toBe(secondaryTarget.id)
      expect(attackCommand.ability.greenFlameBladeSecondaryEffect).toEqual(
        expect.objectContaining({
          damage: expect.objectContaining({
            dice: '3d8+4',
            type: 'Fire'
          })
        })
      )

      const result = await (commands[0] as WeaponAttackCommand).execute(createMockCombatState({
        characters: [caster, primaryTarget, secondaryTarget],
        combatLog: [],
        turnState: {
          currentTurn: 4,
          turnOrder: [caster.id, primaryTarget.id, secondaryTarget.id],
          currentCharacterId: caster.id,
          phase: 'action',
          actionsThisTurn: []
        }
      }))

      const updatedPrimary = result.characters.find(character => character.id === primaryTarget.id)
      const updatedSecondary = result.characters.find(character => character.id === secondaryTarget.id)

      expect(updatedPrimary?.currentHP).toBeLessThan(primaryTarget.currentHP)
      expect(updatedSecondary?.currentHP).toBeLessThan(secondaryTarget.currentHP)
    })

    it('does not apply the primary fire rider or the leap when the melee weapon attack misses', async () => {
      vi.mocked(diceRollers.rollD20).mockReturnValue(1)
      const caster = createGreenFlameBladeCaster()
      const primaryTarget = createGreenFlameBladeTarget('gfb-primary', 'Primary Target', 1, 0)
      const secondaryTarget = createGreenFlameBladeTarget('gfb-secondary', 'Secondary Target', 2, 0)

      const commands = await SpellCommandFactory.createCommands(
        spell,
        caster,
        [caster, primaryTarget, secondaryTarget],
        0,
        createMockGameState(),
        undefined,
        undefined,
        undefined,
        createSelectedTargets(primaryTarget.id, secondaryTarget.id)
      )

      const result = await (commands[0] as WeaponAttackCommand).execute(createMockCombatState({
        characters: [caster, primaryTarget, secondaryTarget],
        combatLog: [],
        turnState: {
          currentTurn: 4,
          turnOrder: [caster.id, primaryTarget.id, secondaryTarget.id],
          currentCharacterId: caster.id,
          phase: 'action',
          actionsThisTurn: []
        }
      }))

      const updatedPrimary = result.characters.find(character => character.id === primaryTarget.id)
      const updatedSecondary = result.characters.find(character => character.id === secondaryTarget.id)

      expect(updatedPrimary?.currentHP).toBe(primaryTarget.currentHP)
      expect(updatedSecondary?.currentHP).toBe(secondaryTarget.currentHP)
    })

    it('keeps the cast valid when no secondary target is selected', async () => {
      vi.mocked(diceRollers.rollD20).mockReturnValue(18)
      const caster = createGreenFlameBladeCaster()
      const primaryTarget = createGreenFlameBladeTarget('gfb-primary', 'Primary Target', 1, 0)
      const bystander = createGreenFlameBladeTarget('gfb-bystander', 'Bystander', 2, 0)

      const commands = await SpellCommandFactory.createCommands(
        spell,
        caster,
        [caster, primaryTarget, bystander],
        0,
        createMockGameState(),
        undefined,
        undefined,
        undefined,
        createSelectedTargets(primaryTarget.id)
      )

      const attackCommand = commands[0] as unknown as {
        ability: {
          greenFlameBladeSecondaryTargetId?: string
        }
      }

      expect(attackCommand.ability.greenFlameBladeSecondaryTargetId).toBeUndefined()
    })

    it('rejects a same-target secondary selection instead of leaping back onto the primary target', async () => {
      vi.mocked(diceRollers.rollD20).mockReturnValue(18)
      const caster = createGreenFlameBladeCaster()
      const primaryTarget = createGreenFlameBladeTarget('gfb-primary', 'Primary Target', 1, 0)
      const bystander = createGreenFlameBladeTarget('gfb-bystander', 'Bystander', 2, 0)

      const commands = await SpellCommandFactory.createCommands(
        spell,
        caster,
        [caster, primaryTarget, bystander],
        0,
        createMockGameState(),
        undefined,
        undefined,
        undefined,
        createSelectedTargets(primaryTarget.id, primaryTarget.id)
      )

      const attackCommand = commands[0] as unknown as {
        ability: {
          greenFlameBladeSecondaryTargetId?: string
        }
      }

      expect(attackCommand.ability.greenFlameBladeSecondaryTargetId).toBeUndefined()
    })

    it('rejects a secondary target beyond the 5-foot leap range', async () => {
      vi.mocked(diceRollers.rollD20).mockReturnValue(18)
      const caster = createGreenFlameBladeCaster()
      const primaryTarget = createGreenFlameBladeTarget('gfb-primary', 'Primary Target', 1, 0)
      const farTarget = createGreenFlameBladeTarget('gfb-far', 'Far Target', 3, 0)

      const commands = await SpellCommandFactory.createCommands(
        spell,
        caster,
        [caster, primaryTarget, farTarget],
        0,
        createMockGameState(),
        undefined,
        undefined,
        undefined,
        createSelectedTargets(primaryTarget.id, farTarget.id)
      )

      const attackCommand = commands[0] as unknown as {
        ability: {
          greenFlameBladeSecondaryTargetId?: string
        }
      }

      expect(attackCommand.ability.greenFlameBladeSecondaryTargetId).toBeUndefined()
    })
  })

  // ============================================================================
  // 4. Primal Savagery Bridge
  // ============================================================================
  // Primal Savagery turns teeth or fingernails into acid-dripping weapons to make
  // a melee spell attack. The acid damage scales at levels 5 (2d10), 11 (3d10),
  // and 17 (4d10). The transient sharpened state is cleaned up immediately after
  // attack resolution whether the strike hits or misses.
  // ============================================================================

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

    it('creates a real melee spell attack, applies acid damage on hit, and clears the sharpened state', async () => {
      vi.mocked(diceRollers.rollD20).mockReturnValue(12)
      vi.mocked(diceRollers.rollDamage).mockReturnValue(7)

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
      vi.mocked(diceRollers.rollD20).mockReturnValue(2)
      vi.mocked(diceRollers.rollDamage).mockReturnValue(7)

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
      vi.mocked(diceRollers.rollD20).mockReturnValue(12)
      vi.mocked(diceRollers.rollDamage).mockReturnValue(7)

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

      expect(vi.mocked(diceRollers.rollDamage)).toHaveBeenCalledWith(expectedDice, false, 1, undefined)
    })
  })

  // ============================================================================
  // 5. Lightning Lure Bridge
  // ============================================================================
  // Lightning Lure creates a lash of lightning energy. The target must succeed on
  // a Strength saving throw or be pulled up to 10 feet toward the caster in a
  // straight line. If the target ends within 5 feet (adjacent tile) of the caster,
  // it takes lightning damage scaling at levels 5 (2d8), 11 (3d8), and 17 (4d8).
  // ============================================================================

  describe('Lightning Lure bridge', () => {
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
      const tiles = new Map<string, unknown>()

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
      } as unknown as BattleMapData
    }

    it('keeps save success from pulling or damaging the target', async () => {
      vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
        total: 20,
        success: true,
        modifiersApplied: []
      } as never)

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
      } as never)

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

    it('does not damage a failed-save target that ends more than 5 feet away due to an obstacle', async () => {
      vi.mocked(savingThrowUtils.rollSavingThrow).mockReturnValue({
        total: 1,
        success: false,
        modifiersApplied: []
      } as never)

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
        const bridge = commands[0] as unknown as LightningLureBridge

        expect(bridge.movementEffect.movementType).toBe('pull')
        expect(bridge.damageEffect.damage.dice).toBe(expectedDice[index])
      }
    })
  })

  // ============================================================================
  // 6. Magic Stone Bridge
  // ============================================================================
  // Magic Stone touches up to three pebbles, imbuing them with magical energy for
  // 1 minute. The caster or an ally can fling the pebbles as ranged attacks (range 60),
  // substituting the caster's spellcasting ability modifier for attack and damage.
  // Flinging a pebble consumes it on a hit or miss.
  // ============================================================================

  describe('Magic Stone bridge', () => {
    const createCaster = (): CombatCharacter =>
      createMockCombatCharacter({
        id: 'magic-stone-caster',
        name: 'Pebble Caster',
        level: 5,
        stats: {
          strength: 10,
          dexterity: 10,
          constitution: 12,
          intelligence: 20,
          wisdom: 10,
          charisma: 10
        },
        spellcastingAbility: 'intelligence',
        class: {
          id: 'druid',
          name: 'Druid',
          description: 'A spellcaster.',
          hitDie: 8,
          primaryAbility: ['Wisdom'],
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
        } as never,
        equippedItems: {}
      } as never)

    const createAlly = (): CombatCharacter =>
      createMockCombatCharacter({
        id: 'magic-stone-ally',
        name: 'Pebble Ally',
        level: 5,
        stats: {
          strength: 10,
          dexterity: 10,
          constitution: 12,
          intelligence: 10,
          wisdom: 10,
          charisma: 10
        },
        spellcastingAbility: undefined,
        class: {
          id: 'fighter',
          name: 'Fighter',
          description: 'An ally who can fling the enchanted stone.',
          hitDie: 10,
          primaryAbility: ['Strength'],
          savingThrowProficiencies: [],
          skillProficienciesAvailable: [],
          numberOfSkillProficiencies: 0,
          armorProficiencies: [],
          weaponProficiencies: [],
          features: [],
          spellcasting: {
            ability: 'Wisdom',
            knownCantrips: 0,
            knownSpellsL1: 0,
            spellList: []
          }
        } as never,
        equippedItems: {}
      } as never)

    const createTarget = (armorClass = 14): CombatCharacter =>
      createMockCombatCharacter({
        id: 'magic-stone-target',
        name: 'Pebble Target',
        armorClass,
        currentHP: 20,
        maxHP: 20,
        stats: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10
        } as unknown as CharacterStats
      })

    const createMagicStoneCommand = (caster: CombatCharacter): UtilityCommand => {
      const effect = magicStone.effects[0] as never
      return new UtilityCommand(effect, {
        spellId: magicStone.id,
        spellName: magicStone.name,
        castAtLevel: 0,
        caster,
        targets: [caster],
        gameState: {} as never,
        effectDuration: magicStone.duration as never,
        conditionalEndings: (effect as { conditionalEndings?: import('@/types/spells').ConditionalEnding[] }).conditionalEndings || (magicStone as { conditionalEndings?: import('@/types/spells').ConditionalEnding[] }).conditionalEndings
      })
    }

    const createPebbleAttack = (weapon: Item): Ability => ({
      id: 'attack_main',
      name: weapon.name,
      description: `Attack with ${weapon.name}.`,
      type: 'attack',
      cost: { type: 'action' },
      targeting: 'single_enemy',
      range: 60,
      effects: [{ type: 'damage', dice: weapon.damageDice || '1d6', damageType: (weapon.damageType || 'Bludgeoning') as Ability['effects'][number]['damageType'] }],
      weapon,
      isProficient: true
    } as Ability)

    const createState = (caster: CombatCharacter, ally: CombatCharacter, target: CombatCharacter): CombatState => ({
      ...createMockCombatState({
        characters: [caster, ally, target],
        combatLog: [],
        turnState: {
          currentTurn: 1,
          turnOrder: [caster.id, ally.id, target.id],
          currentCharacterId: caster.id,
          phase: 'action',
          actionsThisTurn: []
        }
      })
    })

    it('creates three pebbles with spellcasting substitution and a one-minute lifecycle', () => {
      const caster = createCaster()
      const ally = createAlly()
      const target = createTarget(12)
      const state = createState(caster, ally, target)

      const result = createMagicStoneCommand(caster).execute(state)

      expect(result.spellCreatedInventoryItems).toHaveLength(3)
      expect(result.temporaryWeaponEnchantments).toHaveLength(3)
      expect(result.spellCreatedInventoryItems?.every(item => item.type === ItemType.Ammunition)).toBe(true)
      expect(result.temporaryWeaponEnchantments?.every(enchantment => enchantment.spellId === magicStone.id)).toBe(true)
      expect(result.temporaryWeaponEnchantments?.every(enchantment => enchantment.heldWeaponAugment.useSpellcastingAbilityForAttack)).toBe(true)
      expect(result.temporaryWeaponEnchantments?.every(enchantment => enchantment.heldWeaponAugment.useSpellcastingAbilityForDamage)).toBe(true)
      expect(result.temporaryWeaponEnchantments?.every(enchantment => enchantment.heldWeaponAugment.sourceSpellcastingAbilityModifier === 5)).toBe(true)
    })

    it('lets another creature use a pebble, applies the caster modifier, and consumes it on hit', async () => {
      vi.mocked(diceRollers.rollD20).mockReturnValue(10)
      const caster = createCaster()
      const ally = createAlly()
      const target = createTarget(10)
      const castState = createMagicStoneCommand(caster).execute(createState(caster, ally, target))
      const pebble = castState.spellCreatedInventoryItems?.[0]

      expect(pebble).toBeDefined()
      if (!pebble) throw new Error('Expected a magic-stone pebble to exist.')

      const attack = new WeaponAttackCommand(createPebbleAttack(pebble), ally, [target], {
        spellId: 'attack_main',
        spellName: pebble.name,
        castAtLevel: 0,
        caster: ally,
        targets: [target],
        gameState: {} as never,
        playerInput: 'weapon_normal'
      })

      const hitState = await attack.execute(castState)
      const hitTarget = hitState.characters.find(character => character.id === target.id)

      expect(diceRollers.rollDamage).toHaveBeenCalledWith('1d6+5', false, 1, undefined)
      expect(hitTarget?.currentHP).toBeLessThan(target.currentHP)
      expect(hitState.spellCreatedInventoryItems).toHaveLength(2)
      expect(hitState.temporaryWeaponEnchantments).toHaveLength(2)
    })

    it('still consumes a pebble on a miss', async () => {
      vi.mocked(diceRollers.rollD20).mockReturnValue(1)
      const caster = createCaster()
      const ally = createAlly()
      const target = createTarget(30)
      const castState = createMagicStoneCommand(caster).execute(createState(caster, ally, target))
      const pebble = castState.spellCreatedInventoryItems?.[0]

      expect(pebble).toBeDefined()
      if (!pebble) throw new Error('Expected a magic-stone pebble to exist.')

      const attack = new WeaponAttackCommand(createPebbleAttack(pebble), ally, [target], {
        spellId: 'attack_main',
        spellName: pebble.name,
        castAtLevel: 0,
        caster: ally,
        targets: [target],
        gameState: {} as never,
        playerInput: 'weapon_normal'
      })

      const missState = await attack.execute(castState)

      expect(missState.spellCreatedInventoryItems).toHaveLength(2)
      expect(missState.temporaryWeaponEnchantments).toHaveLength(2)
    })

    it('does not leak to unrelated stones or weapons and ignores expired pebbles', async () => {
      vi.mocked(diceRollers.rollD20).mockReturnValue(10)
      const caster = createCaster()
      const ally = createAlly()
      const target = createTarget(10)
      const castState = createMagicStoneCommand(caster).execute(createState(caster, ally, target))
      const expiredState = {
        ...castState,
        turnState: {
          ...castState.turnState,
          currentTurn: 50
        }
      } as CombatState
      const stone = createMockItem({
        id: 'smooth-stone',
        name: 'Smooth Stone',
        type: ItemType.Weapon,
        description: 'A plain stone that should not inherit Magic Stone.',
        damageDice: '1d4',
        damageType: 'Bludgeoning',
        properties: []
      })

      const expiredWeapon = createPebbleAttack(castState.spellCreatedInventoryItems?.[0] as Item)
      expiredWeapon.attackBonus = 10

      const expiredAttack = new WeaponAttackCommand(expiredWeapon, ally, [target], {
        spellId: 'attack_main',
        spellName: 'Magic Stone Pebble',
        castAtLevel: 0,
        caster: ally,
        targets: [target],
        gameState: {} as never,
        playerInput: 'weapon_normal'
      })

      await expiredAttack.execute(expiredState)

      expect(diceRollers.rollDamage).toHaveBeenCalledWith('1d6', false, 1, undefined)

      const unrelatedAttack = new WeaponAttackCommand(createPebbleAttack(stone), ally, [target], {
        spellId: 'attack_main',
        spellName: stone.name,
        castAtLevel: 0,
        caster: ally,
        targets: [target],
        gameState: {} as never,
        playerInput: 'weapon_normal'
      })

      const unrelatedState = await unrelatedAttack.execute(castState)

      expect(unrelatedState.spellCreatedInventoryItems).toHaveLength(3)
      expect(unrelatedState.temporaryWeaponEnchantments).toHaveLength(3)
    })
  })

  // ============================================================================
  // 7. Produce Flame Bridge
  // ============================================================================
  // Produce Flame manifests a flickering flame in the caster's hand, illuminating
  // the area. The spell grants a follow-up action ("Hurl Flame") allowing the caster
  // to throw the flame as a ranged spell attack (range 60 / 12 tiles) at a creature
  // or object, dealing 1d8 fire damage and extinguishing the flame.
  // ============================================================================

  describe('Produce Flame bridge', () => {
    const spell = produceFlame as unknown as Spell
    const caster = createMockCombatCharacter({
      id: 'produce-flame-caster',
      name: 'Druid',
      level: 5,
      spellcastingAbility: 'wisdom',
      stats: {
        ...createMockCombatCharacter().stats,
        wisdom: 16
      }
    })

    const creatureTarget = createMockCombatCharacter({
      id: 'produce-flame-target',
      name: 'Goblin',
      armorClass: 10,
      currentHP: 18,
      maxHP: 18,
      statusEffects: []
    })

    const objectTarget: SelectedSpellTarget = {
      kind: 'object',
      id: 'produce-flame-statue',
      name: 'Training Statue',
      position: { x: 8, y: 6 },
      object: {
        id: 'produce-flame-statue',
        name: 'Training Statue',
        position: { x: 8, y: 6 },
        size: 'Large',
        isWornOrCarried: false,
        isMagical: false,
        isFixedToSurface: true
      }
    }

    const createProduceFlameAbility = (): Ability => {
      const baseAbility = createAbilityFromSpell(spell, caster as unknown as PlayerCharacter)
      const grantedAction = baseAbility.grantedActions?.[0]
      if (!grantedAction) {
        throw new Error('Produce Flame is expected to expose one granted action.')
      }

      return {
        id: `${baseAbility.id}_granted_0_hurl_flame`,
        sourceSpellId: baseAbility.sourceSpellId ?? baseAbility.spell?.id ?? baseAbility.id,
        name: grantedAction.action,
        description: grantedAction.notes ?? `Follow-up action granted by ${baseAbility.name}.`,
        type: 'utility',
        icon: '+',
        cost: { type: grantedAction.type === 'bonus_action' ? 'bonus' : grantedAction.type },
        targeting: grantedAction.prerequisites?.includes('target_object_within_spell_range') ? 'single_any' : 'single_enemy',
        range: grantedAction.rangeLimit ? Math.floor(grantedAction.rangeLimit / 5) : 0,
        attackType: grantedAction.attackType === 'ranged_spell_attack' || grantedAction.attackType === 'melee_spell_attack'
          ? 'spell'
          : undefined,
        effects: [{
          type: 'granted_action',
          grantedActionLabel: grantedAction.action,
          grantedActionCost: grantedAction.type,
          grantedActionFrequency: grantedAction.frequency,
          grantedActionRangeLimit: grantedAction.rangeLimit,
          grantedActionPrerequisites: grantedAction.prerequisites,
          grantedActionAttackType: grantedAction.attackType,
          grantedActionDamageDice: grantedAction.damageDice ?? grantedAction.damage?.dice,
          grantedActionDamageType: (grantedAction.damageType ?? grantedAction.damage?.type)?.toLowerCase() as Ability['effects'][number]['damageType'],
          grantedActionNotes: grantedAction.notes
        }],
        tags: ['spell-granted-action', baseAbility.id],
        spell: baseAbility.spell
      }
    }

    it('keeps Produce Flame attached to the caster when it is cast and preserves the self-cast light payload', () => {
      const ability = createAbilityFromSpell(spell, caster as unknown as PlayerCharacter)

      expect(ability.grantedActions).toHaveLength(1)
      expect(ability.grantedActions?.[0]).toMatchObject({
        action: 'Hurl Flame',
        frequency: 'while_active',
        actor: 'caster',
        actionKind: 'magic_action',
        rangeLimit: 60,
        attackType: 'ranged_spell_attack',
        damage: {
          dice: '1d8',
          type: 'Fire'
        }
      })
    })

    it('turns the later Hurl Flame into a real spell attack that hits a creature and misses cleanly', async () => {
      const ability = createProduceFlameAbility()
      expect(ability).toMatchObject({
        targeting: 'single_any',
        range: 12
      })

      const commands = AbilityCommandFactory.createCommands(
        ability,
        caster,
        [creatureTarget],
        createMockGameState(),
        [{ kind: 'creature', id: creatureTarget.id }]
      )

      expect(commands).toHaveLength(1)
      expect(commands[0]).toBeInstanceOf(GrantedActionCommand)

      const attackCommand = commands[0] as GrantedActionCommand

      vi.mocked(diceRollers.rollD20).mockReturnValueOnce(12)
      const hitState = await attackCommand.execute(createMockCombatState({
        characters: [caster, creatureTarget],
        combatLog: []
      }))
      const hitTarget = hitState.characters.find(character => character.id === creatureTarget.id)
      const hitLog = hitState.combatLog.find(entry =>
        entry.data?.grantedActionName === 'Hurl Flame' || entry.data?.grantedAction === 'Hurl Flame'
      )

      expect(hitTarget?.currentHP).toBeLessThan(creatureTarget.currentHP)
      expect(hitLog?.data).toMatchObject({
        grantedActionName: 'Hurl Flame',
        grantedActionRangeLimit: 60,
        grantedActionDamageType: 'fire',
        isHit: true
      })
      expect(hitState.combatLog.some(entry => entry.type === 'damage' && entry.message.includes('Hurl Flame'))).toBe(true)

      vi.mocked(diceRollers.rollD20).mockReturnValueOnce(1)
      const missState = await attackCommand.execute(createMockCombatState({
        characters: [caster, creatureTarget],
        combatLog: []
      }))
      const missTarget = missState.characters.find(character => character.id === creatureTarget.id)
      const missLog = missState.combatLog.find(entry =>
        entry.data?.grantedActionName === 'Hurl Flame' || entry.data?.grantedAction === 'Hurl Flame'
      )

      expect(missTarget?.currentHP).toBe(creatureTarget.currentHP)
      expect(missLog?.data).toMatchObject({
        grantedActionName: 'Hurl Flame',
        grantedActionDamageType: 'fire',
        isHit: false
      })
      expect(missState.combatLog.some(entry => entry.type === 'damage' && entry.message.includes('Hurl Flame'))).toBe(false)
    })

    it('records a Fire object impact when the later throw hits an object', async () => {
      const ability = createProduceFlameAbility()
      const commands = AbilityCommandFactory.createCommands(
        ability,
        caster,
        [],
        createMockGameState(),
        [objectTarget]
      )

      expect(commands).toHaveLength(1)
      expect(commands[0]).toBeInstanceOf(GrantedActionCommand)

      vi.mocked(diceRollers.rollD20).mockReturnValueOnce(12)
      const resultState = await commands[0].execute(createMockCombatState({
        characters: [caster],
        combatLog: []
      }))

      expect(resultState.spellObjectImpacts).toHaveLength(1)
      expect(resultState.spellObjectImpacts?.[0]).toMatchObject({
        objectId: objectTarget.id,
        objectName: objectTarget.name,
        casterId: caster.id,
        damage: {
          dice: '1d8',
          type: 'fire'
        }
      })
      expect(resultState.combatLog.some(entry => entry.type === 'damage' && entry.data?.objectImpact?.objectId === objectTarget.id)).toBe(true)
    })
  })
})
