import { describe, it, expect } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import fireBolt from '../../../../public/data/spells/level-0/fire-bolt.json'
import frostbite from '../../../../public/data/spells/level-0/frostbite.json'
import { type Spell, type SpellEffect, type DamageEffect } from '@/types/spells'

type TestCommandWithEffect = {
  effect: SpellEffect
}

const spell = fireBolt as unknown as Spell

function makeCaster(level: number) {
  return {
    ...createMockCombatCharacter(),
    level,
    id: 'caster'
  }
}

const target = { ...createMockCombatCharacter(), id: 'target' }
const gameState = createMockGameState()

function getAttackRollModifierCommand(commands: unknown[]) {
  return commands.find(
    (c): c is TestCommandWithEffect => 'effect' in c && (c as TestCommandWithEffect).effect.type === 'ATTACK_ROLL_MODIFIER'
  )
}

describe('SpellCommandFactory - Cantrip Scaling', () => {
  it('scales Fire Bolt to 2d10 at caster level 5', async () => {
    const caster = makeCaster(5)
    const commands = await SpellCommandFactory.createCommands(
      spell, caster, [target], 0, gameState
    )
    const damageCommand = commands.find(
      (c): c is TestCommandWithEffect => 'effect' in c && (c as TestCommandWithEffect).effect.type === 'DAMAGE'
    )
    expect(damageCommand).toBeDefined()
    expect((damageCommand!.effect as DamageEffect).damage.dice).toBe('2d10')
  })

  it('scales Fire Bolt to 3d10 at caster level 11', async () => {
    const caster = makeCaster(11)
    const commands = await SpellCommandFactory.createCommands(
      spell, caster, [target], 0, gameState
    )
    const damageCommand = commands.find(
      (c): c is TestCommandWithEffect => 'effect' in c && (c as TestCommandWithEffect).effect.type === 'DAMAGE'
    )
    expect(damageCommand).toBeDefined()
    expect((damageCommand!.effect as DamageEffect).damage.dice).toBe('3d10')
  })

  it('scales Fire Bolt to 4d10 at caster level 17', async () => {
    const caster = makeCaster(17)
    const commands = await SpellCommandFactory.createCommands(
      spell, caster, [target], 0, gameState
    )
    const damageCommand = commands.find(
      (c): c is TestCommandWithEffect => 'effect' in c && (c as TestCommandWithEffect).effect.type === 'DAMAGE'
    )
    expect(damageCommand).toBeDefined()
    expect((damageCommand!.effect as DamageEffect).damage.dice).toBe('4d10')
  })

  it('keeps Fire Bolt at 1d10 for caster level 4 (below first tier)', async () => {
    const caster = makeCaster(4)
    const commands = await SpellCommandFactory.createCommands(
      spell, caster, [target], 0, gameState
    )
    const damageCommand = commands.find(
      (c): c is TestCommandWithEffect => 'effect' in c && (c as TestCommandWithEffect).effect.type === 'DAMAGE'
    )
    expect(damageCommand).toBeDefined()
    expect((damageCommand!.effect as DamageEffect).damage.dice).toBe('1d10')
  })

  it.each([
    [5, '2d6'],
    [11, '3d6'],
    [17, '4d6']
  ] as const)('scales Frostbite nested cold damage to %s at caster level %s', async (level, expectedDice) => {
    const caster = makeCaster(level)
    const commands = await SpellCommandFactory.createCommands(
      frostbite as unknown as Spell, caster, [target], 0, gameState
    )
    const attackRollModifierCommand = getAttackRollModifierCommand(commands)

    expect(attackRollModifierCommand).toBeDefined()
    expect((attackRollModifierCommand!.effect as any).damage.dice).toBe(expectedDice)
  })
})
