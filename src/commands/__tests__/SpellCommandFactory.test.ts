import { describe, it, expect, vi } from 'vitest'
import { SpellCommandFactory } from '../factory/SpellCommandFactory'
import { DamageCommand } from '../effects/DamageCommand'
import { HealingCommand } from '../effects/HealingCommand'
import { StatusConditionCommand } from '../effects/StatusConditionCommand'
import { MovementCommand } from '../effects/MovementCommand'
import { SummoningCommand } from '../effects/SummoningCommand'
import { TerrainCommand } from '../effects/TerrainCommand'
import { UtilityCommand } from '../effects/UtilityCommand'
import { DefensiveCommand } from '../effects/DefensiveCommand'
import { AttackRollModifierCommand } from '../effects/AttackRollModifierCommand'
import { ReactiveEffectCommand } from '../effects/ReactiveEffectCommand'
import { RegisterRiderCommand } from '../effects/RegisterRiderCommand'
import { DamageEffect, Spell, SpellSchool } from '@/types/spells'
import type { CombatCharacter, SelectedSpellTarget } from '@/types/combat'
import { combatEvents } from '@/systems/events/CombatEvents'
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories'

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

    it('routes representative structured effect families to their runtime command classes', async () => {
      // This matrix is intentionally about command creation, not command
      // execution. It catches spell JSON families that validate but would
      // silently fail to get a runtime command when the factory route drifts.
      const matrixEffects: Spell['effects'] = [
        { type: 'DAMAGE', damage: { dice: '1d6', type: 'Fire' }, trigger: { type: 'immediate' }, condition: { type: 'hit' } },
        { type: 'HEALING', healing: { dice: '1d4' }, trigger: { type: 'immediate' }, condition: { type: 'always' } },
        { type: 'STATUS_CONDITION', statusCondition: { name: 'Prone', duration: { type: 'rounds', value: 1 } }, trigger: { type: 'immediate' }, condition: { type: 'always' } },
        {
          type: 'ATTACK_ROLL_MODIFIER',
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
          attackRollModifier: {
            modifier: 'penalty',
            direction: 'incoming',
            attackKind: 'weapon',
            consumption: 'while_active',
            duration: { type: 'rounds', value: 1 },
            dice: '1d4'
          }
        },
        { type: 'MOVEMENT', movementType: 'teleport', distance: 30, duration: { type: 'rounds', value: 1 }, trigger: { type: 'immediate' }, condition: { type: 'always' } },
        { type: 'SUMMONING', summonType: 'object', objectDescription: 'a harmless test object', count: 1, duration: { type: 'rounds', value: 1 }, trigger: { type: 'immediate' }, condition: { type: 'always' } },
        { type: 'TERRAIN', terrainType: 'difficult', areaOfEffect: { shape: 'Cube', size: 5 }, duration: { type: 'rounds', value: 1 }, trigger: { type: 'immediate' }, condition: { type: 'always' } },
        { type: 'UTILITY', utilityType: 'information', description: 'reveals a test clue', trigger: { type: 'immediate' }, condition: { type: 'always' } },
        { type: 'DEFENSIVE', defenseType: 'ac_bonus', acBonus: 2, duration: { type: 'rounds', value: 1 }, trigger: { type: 'immediate' }, condition: { type: 'always' } },
        { type: 'REACTIVE', trigger: { type: 'on_target_attack' }, condition: { type: 'always' }, description: 'reacts to a target attack' },
        { type: 'DAMAGE', damage: { dice: '1d8', type: 'Radiant' }, trigger: { type: 'on_attack_hit' }, condition: { type: 'hit' } }
      ]
      const spell = createMockSpell('factory-command-family-matrix', {
        effects: matrixEffects
      })

      const commands = await SpellCommandFactory.createCommands(
        spell,
        mockCaster,
        [mockTarget],
        1,
        createMockGameState()
      )

      expect(commands).toHaveLength(matrixEffects.length)
      expect(commands[0]).toBeInstanceOf(DamageCommand)
      expect(commands[1]).toBeInstanceOf(HealingCommand)
      expect(commands[2]).toBeInstanceOf(StatusConditionCommand)
      expect(commands[3]).toBeInstanceOf(AttackRollModifierCommand)
      expect(commands[4]).toBeInstanceOf(MovementCommand)
      expect(commands[5]).toBeInstanceOf(SummoningCommand)
      expect(commands[6]).toBeInstanceOf(TerrainCommand)
      expect(commands[7]).toBeInstanceOf(UtilityCommand)
      expect(commands[8]).toBeInstanceOf(DefensiveCommand)
      expect(commands[9]).toBeInstanceOf(ReactiveEffectCommand)
      expect(commands[10]).toBeInstanceOf(RegisterRiderCommand)
    })
    it('emits structured spell attack hit events when hit-conditioned spell damage resolves', async () => {
      // Armor-style reactive effects need the same machine-readable attack
      // facts for spell attacks that weapon attacks already publish. This
      // proves the full factory-created command path instead of testing the
      // event bus in isolation.
      combatEvents.clearForTest()
      // Pin the d20 away from both critical faces. The assertion protects the
      // event contract, so ambient randomness must not turn the same test into
      // a critical-hit case when it runs beside other suites.
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)

      try {
        const caster = createMockCombatCharacter({
          id: 'spell-caster',
          name: 'Spell Caster'
        })
        const target = createMockCombatCharacter({
          id: 'spell-target',
          name: 'Spell Target',
          currentHP: 20,
          maxHP: 20
        })
        const spellAttack = createMockSpell('chromatic-orb-event-test', {
          attackType: 'ranged',
          effects: [{
            type: 'DAMAGE',
            damage: { dice: '1d8', type: 'Fire' },
            trigger: { type: 'immediate' },
            condition: { type: 'hit' }
          }]
        })

        const commands = await SpellCommandFactory.createCommands(
          spellAttack,
          caster,
          [target],
          1,
          createMockGameState()
        )

        let currentState = createMockCombatState({
          characters: [caster, target],
          combatLog: []
        })
        for (const command of commands) {
          currentState = await command.execute(currentState)
        }

        expect(combatEvents.getDispatchLog()).toEqual(expect.arrayContaining([
          expect.objectContaining({
            type: 'unit_attack',
            attackerId: caster.id,
            targetId: target.id,
            isHit: true,
            isCrit: false,
            attackType: 'spell',
            weaponType: 'ranged'
          })
        ]))
      } finally {
        randomSpy.mockRestore()
        combatEvents.clearForTest()
      }
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




