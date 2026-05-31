import { describe, it, expect, beforeEach } from 'vitest';
import { SpellCommandFactory } from '../SpellCommandFactory';
import { createMockCombatCharacter, createMockGameState } from '@/utils/factories';
import { SpellSchool, type Spell, type SpellEffect, type UtilityEffect, type StatusConditionEffect } from '@/types/spells';

const readEffect = (commands: unknown[], index = 0): SpellEffect =>
  (commands[index] as { effect: SpellEffect }).effect;

describe('SpellCommandFactory - Status Condition Integration', () => {
  let caster: ReturnType<typeof createMockCombatCharacter>;
  let target: ReturnType<typeof createMockCombatCharacter>;
  let gameState: ReturnType<typeof createMockGameState>;

  beforeEach(() => {
    caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Test Caster'
    });
    target = createMockCombatCharacter({
      id: 'target',
      name: 'Test Target'
    });
    gameState = createMockGameState();
  });

  it('creates StatusConditionCommand for conditionRemoval (e.g. Lesser Restoration)', async () => {
    const spellWithRemoval: Spell = {
      id: 'lesser-restoration-test',
      name: 'Lesser Restoration Test',
      level: 2,
      school: SpellSchool.Abjuration,
      classes: [],
      subClasses: [],
      tags: [],
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'touch', distance: 0 },
      components: { verbal: true, somatic: true, material: false, materialDescription: '', isConsumed: false, materialCost: 0 },
      duration: { type: 'instantaneous', value: 0, unit: 'round', concentration: false },
      targeting: { type: 'single', range: 0, validTargets: ['creatures'] },
      effects: [
        {
          type: 'UTILITY',
          trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', movementType: 'any' },
          condition: { type: 'always' },
          utilityType: 'other',
          description: 'Removes condition',
          conditionRemoval: ['Poisoned', 'Blinded']
        } as UtilityEffect
      ],
      arbitrationType: 'mechanical',
      description: 'Test spell for condition removal.'
    };

    const commands = await SpellCommandFactory.createCommands(spellWithRemoval, caster, [target], 2, gameState);

    // It should create the removal StatusConditionCommand and the original UtilityCommand
    expect(commands.length).toBe(2);

    const removalEffect = readEffect(commands, 0) as StatusConditionEffect;
    expect(removalEffect.type).toBe('STATUS_CONDITION');
    expect(removalEffect.conditionRemoval).toContain('Poisoned');
    expect(removalEffect.conditionRemoval).toContain('Blinded');
  });

  it('creates StatusConditionCommand for option-specific status payloads (e.g. Command Grovel)', async () => {
    const spellWithOptionStatus: Spell = {
      id: 'command-test',
      name: 'Command Test',
      level: 1,
      school: SpellSchool.Enchantment,
      classes: [],
      subClasses: [],
      tags: [],
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'ranged', distance: 60, distanceUnit: 'feet' },
      components: { verbal: true, somatic: false, material: false, materialDescription: '', isConsumed: false, materialCost: 0 },
      duration: { type: 'instantaneous', value: 0, unit: 'round', concentration: false },
      targeting: { type: 'single', range: 60, validTargets: ['creatures'] },
      effects: [
        {
          type: 'UTILITY',
          trigger: { type: 'immediate', frequency: 'every_time', consumption: 'unlimited', movementType: 'any' },
          condition: { type: 'save' },
          utilityType: 'control',
          description: 'Controls target',
          controlOptions: [
            {
              name: 'Grovel',
              effect: 'grovel',
              details: 'Target drops prone',
              statusCondition: { name: 'Prone', duration: { type: 'rounds', value: 1 } }
            }
          ]
        } as UtilityEffect
      ],
      arbitrationType: 'mechanical',
      description: 'Test spell for option specific status.'
    };

    const commands = await SpellCommandFactory.createCommands(spellWithOptionStatus, caster, [target], 1, gameState, 'Grovel');

    // It should create the injected StatusConditionCommand and the original UtilityCommand
    expect(commands.length).toBe(2);

    const statusEffect = readEffect(commands, 0) as StatusConditionEffect;
    expect(statusEffect.type).toBe('STATUS_CONDITION');
    expect(statusEffect.statusCondition.name).toBe('Prone');
  });
});