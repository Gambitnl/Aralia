import { describe, it, expect, beforeEach } from 'vitest'
import { SpellCommandFactory } from '../SpellCommandFactory'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'
import alarm from '../../../../public/data/spells/level-1/alarm.json'
import chromaticOrb from '../../../../public/data/spells/level-1/chromatic-orb.json'
import alterSelf from '../../../../public/data/spells/level-2/alter-self.json'
import blindnessDeafness from '../../../../public/data/spells/level-2/blindness-deafness.json'
import dragonsBreath from '../../../../public/data/spells/level-2/dragons-breath.json'
import enhanceAbility from '../../../../public/data/spells/level-2/enhance-ability.json'
import enlargeReduce from '../../../../public/data/spells/level-2/enlarge-reduce.json'
import plantGrowth from '../../../../public/data/spells/level-3/plant-growth.json'
import { SpellSchool, type Spell, type SpellEffect, type DamageEffect, type StatusConditionEffect } from '@/types/spells'

/**
 * This file protects spells that ask the player to choose a mode, effect, or
 * damage type before combat commands are created.
 *
 * The spell JSON owns the full menu so the UI can show every legal choice.
 * SpellCommandFactory then receives the player's selected label and should only
 * create commands for the matching effect indices. These tests cover both small
 * synthetic spells and the real Package 6 spell files that previously drifted
 * out of range.
 */

type TestCommandWithEffect = {
  effect: SpellEffect
}

type SpellWithPerTargetChoices = Spell & {
  perTargetChoicesByTargetId: Record<string, string>
}

const modeChoiceSpells = [
  alarm,
  alterSelf,
  blindnessDeafness,
  enlargeReduce,
  plantGrowth
] as unknown as Spell[]

const damageChoiceSpells = [
  chromaticOrb,
  dragonsBreath
] as unknown as Spell[]

// Test commands keep the source effect at runtime, but the production command
// interface hides it. This helper exposes that effect only inside tests so the
// selected mode can be verified without executing a full combat turn.
const readEffect = (commands: unknown[], index = 0): SpellEffect =>
  (commands[index] as TestCommandWithEffect).effect

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
    // This synthetic spell mirrors Chromatic Orb and Dragon's Breath: the
    // damage type list is a menu, not simultaneous damage of every listed type.
    const spellWithChoice: Spell = {
      id: 'chromatic-orb-test',
      name: 'Chromatic Orb Test',
      level: 1,
      school: SpellSchool.Evocation,
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
    expect(readEffect(commands).type).toBe('DAMAGE')
  })

  it('should filter effects based on modeChoice and playerInput', async () => {
    // This synthetic spell keeps the two Blindness/Deafness outcomes separate
    // so command creation can prove it only uses the selected option.
    const spellWithMode: Spell = {
      id: 'blindness-deafness-test',
      name: 'Blindness/Deafness Test',
      level: 2,
      school: SpellSchool.Necromancy,
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
        } as StatusConditionEffect,
        {
          type: 'STATUS_CONDITION',
          trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', movementType: 'any' },
          condition: { type: 'save' },
          statusCondition: { name: 'Deafened', duration: { type: 'minutes', value: 1 } }
        } as StatusConditionEffect
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
    expect((readEffect(commandsBlind) as StatusConditionEffect).statusCondition.name).toBe('Blinded')

    const commandsDeaf = await SpellCommandFactory.createCommands(spellWithMode, caster, [target], 2, gameState, 'Deafness')
    expect(commandsDeaf.length).toBe(1)
    expect((readEffect(commandsDeaf) as StatusConditionEffect).statusCondition.name).toBe('Deafened')
  })

  it('should ignore out-of-bounds effect indices in modeChoice without crashing', async () => {
    // The factory should fail softly if a future spell file points at an invalid
    // effect. The real-data test below makes sure Package 6 does not rely on
    // this fallback for the actual shipped spell JSON.
    const spellWithOutOfBounds: Spell = {
      id: 'oob-test',
      name: 'OOB Test',
      level: 1,
      school: SpellSchool.Evocation,
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

  it('keeps real package mode choices pointed at real effects', () => {
    // This is the regression that protects the package repair: every real
    // modeChoice option must point at an existing effects[] entry.
    for (const spell of modeChoiceSpells) {
      expect(spell.modeChoice, `${spell.id} should expose a choice menu`).toBeDefined()

      for (const option of spell.modeChoice?.options ?? []) {
        for (const effectIndex of option.effectIndices ?? []) {
          expect(effectIndex, `${spell.id}:${option.label} should not point below effects[]`).toBeGreaterThanOrEqual(0)
          expect(effectIndex, `${spell.id}:${option.label} should point inside effects[]`).toBeLessThan(spell.effects.length)
        }
      }
    }
  })

  it('marks real chosen-damage spells with damageTypeSource', () => {
    // This keeps spells with a damage-type menu from being read as if every
    // listed damage type applies at once.
    for (const spell of damageChoiceSpells) {
      const damageEffects = spell.effects.filter((effect): effect is DamageEffect => effect.type === 'DAMAGE')
      expect(damageEffects.some(effect => effect.damage.damageTypeSource === 'chosen_damage_type'), `${spell.id} should mark chosen damage typing`).toBe(true)
    }
  })

  it('applies Enhance Ability per-target choices as ability-check advantage', async () => {
    // Enhance Ability is the first per-target-choice spell whose chosen labels
    // need to become real mechanics. This test protects the handoff from the
    // target-indexed prompt payload into the character modifier channel that
    // ability checks already inspect.
    const firstTarget = createMockCombatCharacter({
      id: 'first-target',
      name: 'First Target',
      modifiers: { advantage: [], disadvantage: [], bonuses: [] },
      statusEffects: []
    })
    const secondTarget = createMockCombatCharacter({
      id: 'second-target',
      name: 'Second Target',
      modifiers: { advantage: [], disadvantage: [], bonuses: [] },
      statusEffects: []
    })
    const spellWithChoices: SpellWithPerTargetChoices = {
      ...(enhanceAbility as unknown as Spell),
      perTargetChoicesByTargetId: {
        [firstTarget.id]: 'Strength',
        [secondTarget.id]: 'Wisdom'
      }
    }

    const commands = await SpellCommandFactory.createCommands(
      spellWithChoices,
      caster,
      [firstTarget, secondTarget],
      2,
      gameState
    )

    // Execute every command so this proves the real factory path, not only the
    // presence of a command object. The generic UtilityCommand and concentration
    // command may also run, but only the Enhance Ability command should write
    // ability-check advantage and visible buff statuses.
    let currentState = createMockCombatState({
      characters: [caster, firstTarget, secondTarget],
      combatLog: []
    })
    for (const command of commands) {
      currentState = await command.execute(currentState)
    }

    const updatedFirstTarget = currentState.characters.find(character => character.id === firstTarget.id)!
    const updatedSecondTarget = currentState.characters.find(character => character.id === secondTarget.id)!

    expect(updatedFirstTarget.modifiers?.advantage).toContain('advantage on Strength ability checks from Enhance Ability')
    expect(updatedSecondTarget.modifiers?.advantage).toContain('advantage on Wisdom ability checks from Enhance Ability')
    expect(updatedFirstTarget.statusEffects.some(effect => effect.name === 'Enhance Ability (Strength)')).toBe(true)
    expect(updatedSecondTarget.statusEffects.some(effect => effect.name === 'Enhance Ability (Wisdom)')).toBe(true)
  })
})
