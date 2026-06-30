import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import { WeaponAttackCommand } from '../AbilityCommandFactory'
import { NarrativeCommand } from '../../effects/NarrativeCommand'
import { createMockCombatCharacter, createMockCombatState, createMockGameState, createMockItem } from '@/utils/factories'
import { ItemType } from '@/types/items'
import type { CombatState, SelectedSpellTarget } from '@/types/combat'
import type { MovementTriggerDebuff } from '@/systems/spells/effects/triggerHandler'
import type { Spell } from '@/types/spells'
import * as combatUtils from '@/utils/combatUtils'
import boomingBlade from '../../../../public/data/spells/level-0/booming-blade.json'

/**
 * This file proves Booming Blade's blade-cantrip bridge.
 *
 * Booming Blade is not a normal spell attack. The cast makes a real melee
 * weapon attack, adds thunder damage only after a hit at higher levels, and
 * stores a one-round movement rider on the hit target. These tests guard that
 * complete contract without widening the older True Strike bridge.
 *
 * Called by: focused Spells G26 proof.
 * Depends on: live Booming Blade JSON, SpellCommandFactory, WeaponAttackCommand,
 * the movement-trigger runtime, and shared combat test factories.
 */

vi.mock('@/utils/combatUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/combatUtils')>()
  return {
    ...actual,
    rollD20: vi.fn()
  }
})

const spell = boomingBlade as unknown as Spell

// ============================================================================
// Shared Booming Blade Fixtures
// ============================================================================
// The helpers below use a real weapon snapshot in the caster's main hand so the
// spell must go through the same command path as ordinary melee attacks.
// ============================================================================

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

describe('Booming Blade bridge', () => {
  beforeEach(() => {
    vi.mocked(combatUtils.rollD20).mockReset()
  })

  it('turns the cast into a real melee weapon attack and stores the movement rider only after a hit', async () => {
    vi.mocked(combatUtils.rollD20).mockReturnValue(18)
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
    vi.mocked(combatUtils.rollD20).mockReturnValue(2)
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

  it('uses Booming Blade hit and movement scaling from the live customFormula tiers', async () => {
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

    expect(attackCommand.ability.effects).toEqual([
      expect.objectContaining({ dice: '1d8+3', damageType: 'slashing' }),
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
          description: 'Not a melee weapon.'
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
