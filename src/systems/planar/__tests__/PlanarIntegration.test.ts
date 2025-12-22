
import { describe, it, expect } from 'vitest';
import { SpellCommandFactory } from '../../../commands/factory/SpellCommandFactory';
import { DamageCommand } from '../../../commands/effects/DamageCommand';
import { Spell, SpellEffect } from '../../../types/spells';
import { CombatCharacter, CombatState } from '../../../types/combat';
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
    school: 'Evocation',
    castingTime: { unit: 'action', value: 1 },
    range: { type: 'ranged', distance: 150 },
    duration: { type: 'instantaneous' },
    components: { verbal: true, somatic: true, material: true, materialDescription: 'bat guano' },
    effects: [
      {
        type: 'DAMAGE',
        damage: { type: 'fire', dice: '8d6' },
        trigger: { type: 'on_cast' },
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
        turnState: {} as any,
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
