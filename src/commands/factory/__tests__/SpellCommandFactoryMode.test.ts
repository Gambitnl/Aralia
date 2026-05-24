import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import { createMockCombatCharacter, createMockGameState } from '@/utils/factories'
import type { Spell, DamageEffect } from '@/types/spells'

describe('SpellCommandFactory - Choice and Mode Integration', () => {
  let caster: ReturnType<typeof createMockCombatCharacter>
  let target: ReturnType<typeof createMockCombatCharacter>
  let gameState: ReturnType<typeof createMockGameState>

  beforeEach(() => {
    caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Test Caster'
    })
    target = createMockCombatCharacter({
      id: 'target',
      name: 'Test Target'
    })
    gameState = createMockGameState()
  })

  it('should parse damageTypeSource when generating commands', async () => {
    const spellWithChoice: Spell = {
      id: 'chromatic-orb-test',
      name: 'Chromatic Orb Test',
      level: 1,
      school: 'Evocation',
      classes: [],
      subClasses: [],
      tags: [],
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'ranged', distance: 90, distanceUnit: 'feet' },
      components: { verbal: true, somatic: true, material: true, materialDescription: '', isConsumed: false, materialCost: 0 },
      duration: { type: 'instantaneous', value: 0, unit: 'round', concentration: false },
      targeting: { type: 'single', range: 90, validTargets: ['creatures'] },
      effects: [
        {
          type: 'DAMAGE',
          trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', movementType: 'any' },
          condition: { type: 'hit' },
          damage: { dice: '3d8', type: 'Acid/Cold/Fire/Lightning/Poison/Thunder', damageTypeSource: 'chosen_damage_type' }
        } as DamageEffect
      ],
      arbitrationType: 'mechanical',
      description: 'Test spell with damage choice.'
    }

    const commands = await SpellCommandFactory.createCommands(spellWithChoice, caster, [target], 1, gameState)
    expect(commands).toBeDefined()
    expect(commands.length).toBeGreaterThan(0)
    expect((commands[0] as any).effect.type).toBe('DAMAGE')
  })

  it('should filter effects based on modeChoice and playerInput', async () => {
    const spellWithMode: Spell = {
      id: 'blindness-deafness-test',
      name: 'Blindness/Deafness Test',
      level: 2,
      school: 'Necromancy',
      classes: [],
      subClasses: [],
      tags: [],
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'ranged', distance: 120, distanceUnit: 'feet' },
      components: { verbal: true, somatic: false, material: false, materialDescription: '', isConsumed: false, materialCost: 0 },
      duration: { type: 'timed', value: 1, unit: 'minute', concentration: false },
      targeting: { type: 'single', range: 120, validTargets: ['creatures'] },
      effects: [
        {
          type: 'STATUS_CONDITION',
          trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', movementType: 'any' },
          condition: { type: 'save' },
          statusCondition: { name: 'Blinded', duration: { type: 'minutes', value: 1 } }
        } as any,
        {
          type: 'STATUS_CONDITION',
          trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', movementType: 'any' },
          condition: { type: 'save' },
          statusCondition: { name: 'Deafened', duration: { type: 'minutes', value: 1 } }
        } as any
      ],
      modeChoice: {
        type: 'choose_one',
        timing: 'on_cast',
        optionCount: 2,
        optionsSource: 'effects',
        options: [
          { label: 'Blindness', summary: 'Blinds target', effectIndices: [0] },
          { label: 'Deafness', summary: 'Deafens target', effectIndices: [1] }
        ]
      },
      arbitrationType: 'mechanical',
      description: 'Test spell with mode choice.'
    }

    const commandsBlind = await SpellCommandFactory.createCommands(spellWithMode, caster, [target], 2, gameState, 'Blindness')
    expect(commandsBlind.length).toBe(1)
    expect((commandsBlind[0] as any).effect.statusCondition.name).toBe('Blinded')

    const commandsDeaf = await SpellCommandFactory.createCommands(spellWithMode, caster, [target], 2, gameState, 'Deafness')
    expect(commandsDeaf.length).toBe(1)
    expect((commandsDeaf[0] as any).effect.statusCondition.name).toBe('Deafened')
  })

  it('should ignore out-of-bounds effect indices in modeChoice without crashing', async () => {
    const spellWithOutOfBounds: Spell = {
      id: 'oob-test',
      name: 'OOB Test',
      level: 1,
      school: 'Evocation',
      classes: [],
      subClasses: [],
      tags: [],
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'ranged', distance: 30, distanceUnit: 'feet' },
      components: { verbal: true, somatic: true, material: false, materialDescription: '', isConsumed: false, materialCost: 0 },
      duration: { type: 'instantaneous', value: 0, unit: 'round', concentration: false },
      targeting: { type: 'single', range: 30, validTargets: ['creatures'] },
      effects: [
        {
          type: 'DAMAGE',
          trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', movementType: 'any' },
          condition: { type: 'hit' },
          damage: { dice: '1d4', type: 'Force' }
        } as DamageEffect
      ],
      modeChoice: {
        type: 'choose_one',
        timing: 'on_cast',
        optionCount: 1,
        optionsSource: 'effects',
        options: [
          { label: 'Out of Bounds', summary: 'Points nowhere', effectIndices: [99] }
        ]
      },
      arbitrationType: 'mechanical',
      description: 'Test spell with OOB index.'
    }

    const commands = await SpellCommandFactory.createCommands(spellWithOutOfBounds, caster, [target], 1, gameState, 'Out of Bounds')
    expect(commands).toBeDefined()
    expect(commands.length).toBe(0)
  })
})
