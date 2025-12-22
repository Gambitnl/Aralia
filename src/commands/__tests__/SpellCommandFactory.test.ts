import { describe, it, expect } from 'vitest'
import { SpellCommandFactory } from '../factory/SpellCommandFactory'
import { DamageCommand } from '../effects/DamageCommand'
import type { DamageEffect, Spell } from '@/types/spells'
import type { CombatCharacter } from '@/types/combat'
import { createMockGameState } from '@/utils/factories'

// Mocks
const mockCaster = { id: 'c1', name: 'Caster', level: 5 } as CombatCharacter
const mockTarget = { id: 't1', name: 'Target' } as CombatCharacter
const getContextTargets = (command: unknown): CombatCharacter[] =>
  (command as { context: { targets: CombatCharacter[] } }).context.targets

const createMockSpell = (id: string, overrides: Partial<Spell> = {}): Spell => ({
  id,
  name: id,
  level: 1,
  school: 'Evocation',
  classes: ['Wizard'],
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
  })
})
