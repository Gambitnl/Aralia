import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UtilityCommand } from '../../effects/UtilityCommand'
import { WeaponAttackCommand } from '../AbilityCommandFactory'
import magicStone from '../../../../public/data/spells/level-0/magic-stone.json'
import { createMockCombatCharacter, createMockCombatState, createMockItem } from '@/utils/factories'
import { ItemType } from '@/types/items'
import { rollDamage } from '@/utils/combatUtils'
import type { Ability, CombatCharacter, CombatState } from '@/types/combat'
import type { Item } from '@/types/items'

vi.mock('@/utils/combatUtils', async () => {
  const actual = await vi.importActual<typeof import('@/utils/combatUtils')>('@/utils/combatUtils')

  return {
    ...actual,
    rollD20: vi.fn(() => 10),
    rollDamage: vi.fn((formula: string) => (formula === '1d6+5' ? 11 : 1))
  }
})

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
      description: 'An ally who can use the stone.',
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
    }
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
    conditionalEndings: effect.conditionalEndings || (magicStone as never).conditionalEndings
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
  effects: [{ type: 'damage', dice: weapon.damageDice || '1d6', damageType: weapon.damageType || 'bludgeoning' }],
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

describe('Magic Stone bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('lets another creature use a pebble, applies the caster modifier, and consumes it on hit or miss', async () => {
    const caster = createCaster()
    const ally = createAlly()
    const target = createTarget()
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

    expect(rollDamage).toHaveBeenCalledWith('1d6+5', false, 1)
    expect(hitTarget?.currentHP).toBeLessThan(target.currentHP)
    expect(hitState.spellCreatedInventoryItems).toHaveLength(2)
    expect(hitState.temporaryWeaponEnchantments).toHaveLength(2)
  })

  it('still consumes a pebble on a miss', async () => {
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

    expect(rollDamage).not.toHaveBeenCalled()
    expect(missState.spellCreatedInventoryItems).toHaveLength(2)
    expect(missState.temporaryWeaponEnchantments).toHaveLength(2)
  })

  it('does not leak to unrelated stones or weapons and ignores expired pebbles', async () => {
    const caster = createCaster()
    const ally = createAlly()
    const target = createTarget()
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
      damageType: 'bludgeoning',
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

    expect(rollDamage).toHaveBeenCalledWith('1d6', false, 1)

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
