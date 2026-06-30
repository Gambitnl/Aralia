import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AbilityCommandFactory } from '../AbilityCommandFactory'
import { GrantedActionCommand } from '../../effects/GrantedActionCommand'
import { createAbilityFromSpell } from '@/utils/character/spellAbilityFactory'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import { Ability, SelectedSpellTarget } from '@/types/combat'
import type { Spell } from '@/types/spells'
import * as combatUtils from '@/utils/combatUtils'
import produceFlame from '../../../../public/data/spells/level-0/produce-flame.json'

vi.mock('@/utils/combatUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/combatUtils')>()
  return {
    ...actual,
    rollD20: vi.fn()
  }
})

/**
 * This file proves the smallest durable Produce Flame bridge.
 *
 * The spell data keeps the carried light on cast, the granted action turns the
 * flame into a real later spell attack, and the later attack can hit either a
 * creature or a map object without inventing a separate durability model.
 */
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
    const baseAbility = createAbilityFromSpell(spell, caster)
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

  beforeEach(() => {
    vi.mocked(combatUtils.rollD20).mockReset()
  })

  it('keeps Produce Flame attached to the caster when it is cast and preserves the self-cast light payload', async () => {
    const ability = createAbilityFromSpell(spell, caster)

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

    vi.mocked(combatUtils.rollD20).mockReturnValueOnce(12)
    const hitState = await attackCommand.execute(createMockCombatState({
      characters: [caster, creatureTarget],
      combatLog: []
    }))
    const hitTarget = hitState.characters.find(character => character.id === creatureTarget.id)
    const hitLog = hitState.combatLog.find(entry => entry.data?.grantedAction === 'Hurl Flame')

    expect(hitTarget?.currentHP).toBeLessThan(creatureTarget.currentHP)
    expect(hitLog?.data).toMatchObject({
      spellId: 'produce-flame',
      grantedAction: 'Hurl Flame',
      grantedActionRangeLimit: 60,
      grantedActionDamageType: 'fire',
      isHit: true
    })
    expect(hitState.combatLog.some(entry => entry.type === 'damage' && entry.message.includes('Hurl Flame'))).toBe(true)

    vi.mocked(combatUtils.rollD20).mockReturnValueOnce(1)
    const missState = await attackCommand.execute(createMockCombatState({
      characters: [caster, creatureTarget],
      combatLog: []
    }))
    const missTarget = missState.characters.find(character => character.id === creatureTarget.id)
    const missLog = missState.combatLog.find(entry => entry.data?.grantedAction === 'Hurl Flame')

    expect(missTarget?.currentHP).toBe(creatureTarget.currentHP)
    expect(missLog?.data).toMatchObject({
      spellId: 'produce-flame',
      grantedAction: 'Hurl Flame',
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

    vi.mocked(combatUtils.rollD20).mockReturnValueOnce(12)
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
