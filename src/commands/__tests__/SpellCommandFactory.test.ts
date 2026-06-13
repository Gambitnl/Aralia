import { describe, it, expect } from 'vitest'
import { SpellCommandFactory } from '../factory/SpellCommandFactory'
import { DamageCommand } from '../effects/DamageCommand'
import { DamageEffect, Spell, SpellSchool } from '@/types/spells'
import type { CombatCharacter, SelectedSpellTarget } from '@/types/combat'
import { createMockGameState } from '@/utils/factories'

/**
 * This file protects command creation for structured spell effects.
 *
 * The factory is the bridge between spell JSON and executable combat commands:
 * it applies scaling, narrows choice-driven effects, filters creature targets,
 * and now keeps rich selected-target refs available for object and point spells.
 *
 * Called by: focused SpellCommandFactory Vitest runs.
 * Depends on: SpellCommandFactory, command context types, and the lightweight
 * mock game-state factories used by command tests.
 */

// Mocks
const mockCaster = { id: 'c1', name: 'Caster', level: 5 } as CombatCharacter
const mockTarget = { id: 't1', name: 'Target' } as CombatCharacter
const getContextTargets = (command: unknown): CombatCharacter[] =>
  (command as { context: { targets: CombatCharacter[] } }).context.targets
const getContextSelectedTargets = (command: unknown): SelectedSpellTarget[] | undefined =>
  (command as { context: { selectedSpellTargets?: SelectedSpellTarget[] } }).context.selectedSpellTargets

const createMockSpell = (id: string, overrides: Partial<Spell> = {}): Spell => ({
  id,
  name: id,
  level: 1,
  school: SpellSchool.Evocation,
  classes: ['Wizard'],
  subClasses: [],
  subClassesVerification: 'unverified',
  castingTime: { value: 1, unit: 'action' },
  range: { type: 'ranged', distance: 60 },
  components: { verbal: true, somatic: true, material: false },
  duration: { type: 'instantaneous', concentration: false },
  targeting: { type: 'single', range: 60, validTargets: ['creatures'] },
  effects: [],
  description: 'Test spell',
  ...overrides
})

describe('SpellCommandFactory', () => {
  describe('createCommands', () => {
    it('should create commands for simple damage spell', async () => {
      const fireball = createMockSpell('fireball', {
        effects: [{ type: 'DAMAGE', damage: { dice: '8d6', type: 'Fire' }, trigger: { type: 'immediate' }, condition: { type: 'hit' } }]
      })

      const commands = await SpellCommandFactory.createCommands(
        fireball,
        mockCaster,
        [mockTarget],
        3,
        createMockGameState()
      )

      expect(commands).toHaveLength(1)
      expect(commands[0]).toBeInstanceOf(DamageCommand)
    })

    it('should apply slot level scaling for Damage', async () => {
      const spellSimple = createMockSpell('burning_hands', {
        level: 1,
        effects: [{
          type: 'DAMAGE',
          damage: { dice: '3d6', type: 'Fire' },
          trigger: { type: 'immediate' },
          condition: { type: 'save' },
          scaling: { type: 'slot_level', bonusPerLevel: '+1d6' }
        }]
      })

      const commands = await SpellCommandFactory.createCommands(
        spellSimple,
        mockCaster,
        [mockTarget],
        2, // Cast at level 2 (+1 level)
        createMockGameState()
      )

      const cmd = commands[0] as DamageCommand
      const effect = (cmd as unknown as { effect: DamageEffect }).effect;
      expect(effect.damage.dice).toBe('4d6') // 3d6 + 1d6
    })

    it('should filter targets based on creatureTypes', async () => {
      const spell = createMockSpell('turn_undead', {
        effects: [{
          type: 'DAMAGE',
          damage: { dice: '1d6', type: 'Radiant' },
          trigger: { type: 'immediate' },
          condition: {
            type: 'hit',
            targetFilter: { creatureTypes: ['Undead'] }
          }
        }]
      })

      const undeadTarget = { ...mockTarget, id: 'undead', creatureTypes: ['Undead'] }
      const humanTarget = { ...mockTarget, id: 'human', creatureTypes: ['Humanoid'] }

      // We explicitly pass multiple targets. The factory iterates context targets.
      // But SpellCommandFactory.createCommands takes `targets: CombatCharacter[]`.
      // It iterates `spell.effects` and calls `createCommand`.
      // `createCommand` uses `context.targets`.
      // My implementation FILTERS `context.targets` inside `createCommand` if a filter exists.
      // So the command created should use a filtered context.

      const commands = await SpellCommandFactory.createCommands(
        spell,
        mockCaster,
        [undeadTarget, humanTarget],
        1,
        createMockGameState()
      )

      expect(commands).toHaveLength(1)
      const cmd = commands[0]
      // We can check if the command context targets were filtered.
      // Since context is protected/private, we can't check directly without casting.

      const contextTargets = getContextTargets(cmd);
      expect(contextTargets).toHaveLength(1);
      expect(contextTargets[0].id).toBe('undead');
    })

    it('should return no commands if all targets are filtered out', async () => {
      const spell = createMockSpell('turn_undead', {
        effects: [{
          type: 'DAMAGE',
          damage: { dice: '1d6', type: 'Radiant' },
          trigger: { type: 'immediate' },
          condition: {
            type: 'hit',
            targetFilter: { creatureTypes: ['Undead'] }
          }
        }]
      })

      const humanTarget = { ...mockTarget, id: 'human', creatureTypes: ['Humanoid'] }

      const commands = await SpellCommandFactory.createCommands(
        spell,
        mockCaster,
        [humanTarget],
        1,
        createMockGameState()
      )

      expect(commands).toHaveLength(0)
    })
    it('should filter targets based on size', async () => {
      const spell = createMockSpell('giant_insects', {
        effects: [{
          type: 'DAMAGE',
          damage: { dice: '1d6', type: 'Poison' },
          trigger: { type: 'immediate' },
          condition: {
            type: 'hit',
            targetFilter: { sizes: ['Small'] } // Only affects Small creatures
          }
        }]
      })

      const smallTarget = { ...mockTarget, id: 'small', stats: { ...mockTarget.stats, size: 'Small' } } as CombatCharacter
      const mediumTarget = { ...mockTarget, id: 'medium', stats: { ...mockTarget.stats, size: 'Medium' } } as CombatCharacter

      const commands = await SpellCommandFactory.createCommands(
        spell,
        mockCaster,
        [smallTarget, mediumTarget],
        1,
        createMockGameState()
      )

      expect(commands).toHaveLength(1)
      const cmd = commands[0]
      const contextTargets = getContextTargets(cmd);
      expect(contextTargets).toHaveLength(1);
      expect(contextTargets[0].id).toBe('small');
    })

    it('should filter targets based on alignment', async () => {
      const spell = createMockSpell('holy_smite', {
        effects: [{
          type: 'DAMAGE',
          damage: { dice: '2d6', type: 'Radiant' },
          trigger: { type: 'immediate' },
          condition: {
            type: 'hit',
            targetFilter: { alignments: ['Chaotic Evil'] }
          }
        }]
      })

      const evilTarget = { ...mockTarget, id: 'evil', alignment: 'Chaotic Evil' } as CombatCharacter
      const goodTarget = { ...mockTarget, id: 'good', alignment: 'Lawful Good' } as CombatCharacter

      const commands = await SpellCommandFactory.createCommands(
        spell,
        mockCaster,
        [evilTarget, goodTarget],
        1,
        createMockGameState()
      )

      expect(commands).toHaveLength(1)
      const contextTargets = getContextTargets(commands[0]);
      expect(contextTargets).toHaveLength(1);
      expect(contextTargets[0].id).toBe('evil');
    })

    it('should filter targets based on conditions', async () => {
      const spell = createMockSpell('shatter_frozen', {
        effects: [{
          type: 'DAMAGE',
          damage: { dice: '2d8', type: 'Cold' },
          trigger: { type: 'immediate' },
          condition: {
            type: 'hit',
            targetFilter: { hasCondition: ['Frozen'] }
          }
        }]
      })

      const frozenTarget = {
        ...mockTarget,
        id: 'frozen',
        conditions: [{ name: 'Frozen', duration: { type: 'rounds', value: 1 }, appliedTurn: 1 }]
      } as CombatCharacter

      const normalTarget = { ...mockTarget, id: 'normal', conditions: [] } as CombatCharacter

      const commands = await SpellCommandFactory.createCommands(
        spell,
        mockCaster,
        [frozenTarget, normalTarget],
        1,
        createMockGameState()
      )

      expect(commands).toHaveLength(1)
      const contextTargets = getContextTargets(commands[0]);
      expect(contextTargets).toHaveLength(1);
      expect(contextTargets[0].id).toBe('frozen');
    })


    it('preserves selected object and point targets in command context without creature targets', async () => {
      const spell = createMockSpell('object-context-test', {
        targeting: { type: 'single', range: 60, validTargets: ['objects', 'point'] },
        effects: [{
          type: 'UTILITY',
          utilityType: 'object_interaction',
          description: 'Moves a loose object from a chosen point.',
          trigger: { type: 'immediate' },
          condition: { type: 'always' }
        }]
      })
      const selectedSpellTargets: SelectedSpellTarget[] = [
        {
          kind: 'object',
          id: 'loose-stone',
          name: 'Loose Stone',
          position: { x: 2, y: 1 },
          object: {
            id: 'loose-stone',
            name: 'Loose Stone',
            position: { x: 2, y: 1 },
            weightPounds: 3,
            isWornOrCarried: false
          }
        },
        { kind: 'point', position: { x: 3, y: 1 }, purpose: 'ground_target' }
      ]

      const commands = await SpellCommandFactory.createCommands(
        spell,
        mockCaster,
        [],
        1,
        createMockGameState(),
        undefined,
        undefined,
        undefined,
        selectedSpellTargets
      )

      expect(commands).toHaveLength(1)
      expect(getContextTargets(commands[0])).toEqual([])
      expect(getContextSelectedTargets(commands[0])).toEqual(selectedSpellTargets)
    })

    it('keeps selected creature refs aligned when target filtering removes creatures', async () => {
      const spell = createMockSpell('filtered-creature-context-test', {
        effects: [{
          type: 'DAMAGE',
          damage: { dice: '1d6', type: 'Radiant' },
          trigger: { type: 'immediate' },
          condition: {
            type: 'hit',
            targetFilter: { creatureTypes: ['Undead'] }
          }
        }]
      })
      const undeadTarget = { ...mockTarget, id: 'undead', creatureTypes: ['Undead'] }
      const humanTarget = { ...mockTarget, id: 'human', creatureTypes: ['Humanoid'] }

      const commands = await SpellCommandFactory.createCommands(
        spell,
        mockCaster,
        [undeadTarget, humanTarget],
        1,
        createMockGameState()
      )

      expect(commands).toHaveLength(1)
      expect(getContextTargets(commands[0]).map(target => target.id)).toEqual(['undead'])
      expect(getContextSelectedTargets(commands[0])).toEqual([{ kind: 'creature', id: 'undead' }])
    })
    it('should not create immediate commands for persistent area-zone triggers', async () => {
      // Area-zone effects are registered into ActiveSpellZone by useAbilitySystem.
      // The command factory must not also create an immediate DamageCommand for
      // the same delayed effect or movement/end-turn hazards resolve twice.
      const spell = createMockSpell('create_bonfire_zone', {
        effects: [{
          type: 'DAMAGE',
          damage: { dice: '1d8', type: 'Fire' },
          trigger: { type: 'on_enter_area' },
          condition: { type: 'always' }
        }]
      })

      const commands = await SpellCommandFactory.createCommands(
        spell,
        mockCaster,
        [mockTarget],
        1,
        createMockGameState()
      )

      expect(commands).toHaveLength(0)
    })

    it('should not create immediate commands for bare scheduled triggers', async () => {
      // turn_start/turn_end spell effects are registered into the scheduled
      // effect runtime by useAbilitySystem and should not fire at cast time.
      const spell = createMockSpell('delayed_acid', {
        effects: [{
          type: 'DAMAGE',
          damage: { dice: '2d4', type: 'Acid' },
          trigger: { type: 'turn_end' },
          condition: { type: 'always' }
        }]
      })

      const commands = await SpellCommandFactory.createCommands(
        spell,
        mockCaster,
        [mockTarget],
        1,
        createMockGameState()
      )

      expect(commands).toHaveLength(0)
    })
  })
})

