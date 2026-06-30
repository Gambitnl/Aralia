import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import { WeaponAttackCommand } from '../AbilityCommandFactory'
import { createMockCombatCharacter, createMockCombatState, createMockGameState, createMockItem } from '@/utils/factories'
import { ItemType } from '@/types/items'
import type { CombatCharacter, SelectedSpellTarget } from '@/types/combat'
import type { Spell } from '@/types/spells'
import * as combatUtils from '@/utils/combatUtils'
import greenFlameBlade from '../../../../public/data/spells/level-0/green-flame-blade.json'

/**
 * This file proves the durable Green-Flame Blade bridge.
 *
 * The scenarios here focus on the real weapon attack, the primary and
 * secondary fire damage split, the miss gate, and the rejection paths for a
 * missing or invalid secondary target. That keeps the proof narrow while still
 * exercising the production command path.
 */

vi.mock('@/utils/combatUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/combatUtils')>()
  return {
    ...actual,
    rollD20: vi.fn()
  }
})

const spell = greenFlameBlade as unknown as Spell

// ============================================================================
// Shared Green-Flame Blade Fixtures
// ============================================================================
// The helpers below build a caster with a real melee weapon snapshot so the
// spell must go through the same command path as the live blade cantrips.
// ============================================================================

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
        description: 'A melee weapon worth enough to satisfy the spell material.',
        category: 'Martial Weapon',
        damageDice: '1d8',
        damageType: 'slashing',
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

describe('Green-Flame Blade bridge', () => {
  beforeEach(() => {
    vi.mocked(combatUtils.rollD20).mockReset()
  })

  it('turns the cast into a real weapon attack and applies the hit-gated fire leap with live scaling', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(18)
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
        damageType: 'slashing'
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
    vi.mocked(combatUtils.rollD20).mockReturnValue(1)
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
    vi.mocked(combatUtils.rollD20).mockReturnValue(18)
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
    vi.mocked(combatUtils.rollD20).mockReturnValue(18)
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
    vi.mocked(combatUtils.rollD20).mockReturnValue(18)
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
