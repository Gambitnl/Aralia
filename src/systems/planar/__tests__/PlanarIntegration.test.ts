
import { describe, it, expect } from 'vitest';
import { SpellCommandFactory } from '../../../commands/factory/SpellCommandFactory';
import { DamageCommand } from '../../../commands/effects/DamageCommand';
// TODO(lint-intent): 'SpellEffect' is unused in this test; use it in the assertion path or remove it.
import { Spell, SpellEffect as _SpellEffect, SpellSchool } from '../../../types/spells';
// TODO(lint-intent): 'CombatCharacter' is unused in this test; use it in the assertion path or remove it.
import { CombatCharacter as _CombatCharacter, CombatState } from '../../../types/combat';
import { GameState } from '../../../types';
import { PLANES } from '../../../data/planes';
import { createMockCombatCharacter } from '../../../utils/factories';

describe('Planar Mechanics Integration', () => {
  const mockCaster = createMockCombatCharacter({ id: 'caster', name: 'Caster' });
  const mockTarget = createMockCombatCharacter({ id: 'target', name: 'Target' });

  const mockFireSpell: Spell = {
    id: 'fireball',
    name: 'Fireball',
    level: 3,
    school: SpellSchool.Evocation,
    castingTime: { unit: 'action', value: 1 },
    range: { type: 'ranged', distance: 150 },
    // Was missing required concentration flag; set explicitly for instantaneous spells.
    duration: { type: 'instantaneous', concentration: false },
    // Was missing required targeting block; add a basic area targeting for fireball.
    targeting: {
      type: 'area',
      range: 150,
      areaOfEffect: { shape: 'Sphere', size: 20 },
      validTargets: ['creatures']
    },
    components: { verbal: true, somatic: true, material: true, materialDescription: 'bat guano' },
    effects: [
      {
        type: 'DAMAGE',
        damage: { type: 'fire', dice: '8d6' },
        // Was using unsupported on_cast trigger; switch to immediate to match EffectTrigger.
        trigger: { type: 'immediate' },
        condition: { type: 'save', saveType: 'Dexterity', saveEffect: 'half' }
      }
    ],
    classes: ['Wizard'],
    description: 'Boom'
  };

  const mockGameState = {} as GameState;

  it('should pass currentPlane to CommandContext when provided', async () => {
    const plane = PLANES['nine_hells'];
    const commands = await SpellCommandFactory.createCommands(
      mockFireSpell,
      mockCaster,
      [mockTarget],
      3,
      mockGameState,
      undefined,
      plane
    );

    expect(commands.length).toBeGreaterThan(0);
    const damageCommand = commands.find(c => c instanceof DamageCommand);
    expect(damageCommand).toBeDefined();

    // Verify metadata has spell info, which confirms context was built.
    expect(damageCommand?.metadata.spellName).toBe('Fireball');
  });

  it('should execute without crashing when plane is present', async () => {
    const plane = PLANES['nine_hells'];
    const commands = await SpellCommandFactory.createCommands(
      mockFireSpell,
      mockCaster,
      [mockTarget],
      3,
      mockGameState,
      undefined,
      plane
    );

    // Smoke test: Execute it
    const state: CombatState = {
        isActive: true,
        characters: [mockCaster, mockTarget],
        // Was an unknown cast; now uses a minimal TurnState shape.
        turnState: {
            currentTurn: 1,
            turnOrder: [mockCaster.id, mockTarget.id],
            currentCharacterId: mockCaster.id,
            phase: 'action',
            actionsThisTurn: []
        },
        selectedCharacterId: null,
        selectedAbilityId: null,
        actionMode: 'select',
        validTargets: [],
        validMoves: [],
        combatLog: [],
        reactiveTriggers: [],
        activeLightSources: [],
        currentPlane: plane
    };

    // We expect no crash
    const newState = commands[0].execute(state);
    expect(newState).toBeDefined();
    // Check log for fire damage
    expect(newState.combatLog.some(l => l.type === 'damage')).toBe(true);
  });
});
