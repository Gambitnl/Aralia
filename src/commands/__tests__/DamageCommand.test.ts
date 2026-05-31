import { describe, expect, it, vi } from 'vitest';
import { DamageCommand } from '../effects/DamageCommand';
import { createMockCombatCharacter, createMockCombatState, createMockCommandContext, createMockGameState, createMockPlayerCharacter } from '../../utils/factories';
import type { DamageEffect } from '../../types/spells';

// This regression keeps the direct damage command honest: one hit should lower
// HP and leave a readable combat log entry behind. It intentionally stays tiny
// so Package 4 can cite a concrete HP/log proof without widening the pilot.
describe('DamageCommand', () => {
  it('reduces HP and logs a spell hit for a deterministic damage spell', () => {
    const caster = createMockCombatCharacter({
      id: 'caster',
      name: 'Maelis Quill'
    });

    const target = createMockCombatCharacter({
      id: 'target',
      name: 'Target Dummy',
      currentHP: 12,
      maxHP: 12
    });

    const context = createMockCommandContext({
      spellId: 'fire-bolt',
      spellName: 'Fire Bolt',
      castAtLevel: 1,
      caster,
      targets: [target],
      gameState: createMockGameState({
        party: [
          createMockPlayerCharacter({ id: caster.id, name: caster.name }),
          createMockPlayerCharacter({ id: target.id, name: target.name })
        ],
        currentLocationId: 'arena',
        subMapCoordinates: { x: 0, y: 0 },
        mapData: null
      })
    });

    const effect: DamageEffect = {
      type: 'DAMAGE',
      damage: { dice: '10d1', type: 'Force' },
      trigger: { type: 'immediate' },
      condition: { type: 'hit' }
    };

    // Force the verb choice so the log assertion stays stable while the damage
    // amount itself remains deterministic because `10d1` always rolls 10.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const command = new DamageCommand(effect, context);
    const result = await command.execute(createMockCombatState({
      characters: [caster, target],
      combatLog: []
    }));

    vi.restoreAllMocks();

    const updatedTarget = result.characters.find(character => character.id === 'target');

    expect(updatedTarget?.currentHP).toBe(2);
    expect(result.combatLog.find(entry => entry.message === 'Maelis Quill blasts Target Dummy with Fire Bolt for 10 force damage')).toBeDefined();
  });
});
