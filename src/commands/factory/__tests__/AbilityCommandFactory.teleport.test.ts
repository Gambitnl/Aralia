/**
 * This focused regression protects the factory bridge for teleport-style
 * ability effects. The larger factory test file also covers attack riders and
 * sneaks, so this smaller file keeps teleport dispatch verification isolated
 * from unrelated combat randomness.
 */
import { describe, expect, it } from 'vitest';
import { Ability } from '../../../types/combat';
import { createMockCombatCharacter } from '../../../utils/factories';
import { AbilityCommandFactory } from '../AbilityCommandFactory';
import { MovementCommand } from '../../effects/MovementCommand';

describe('AbilityCommandFactory teleport dispatch', () => {
  it('creates a movement command for teleport effects', () => {
    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster' });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target' });
    const teleport: Ability = {
      id: 'teleport_step',
      name: 'Teleport Step',
      description: 'Instantly reposition a target.',
      type: 'utility',
      cost: { type: 'action' },
      targeting: 'single_any',
      range: 30,
      effects: [{ type: 'teleport', value: 30 }]
    };

    const commands = AbilityCommandFactory.createCommands(
      teleport,
      caster,
      [target],
      { mapData: { gridSize: { cols: 12, rows: 12 } } } as any
    );

    expect(commands).toHaveLength(1);
    expect(commands[0]).toBeInstanceOf(MovementCommand);
    expect(commands[0].description).toContain('teleport');
  });
});
