import { describe, it, expect } from 'vitest';
import { MovementCommand } from '../MovementCommand';
import { createMockCombatCharacter, createMockCombatState, createMockGameState } from '@/utils/factories';
import { MovementEffect } from '@/types/spells';
import { CommandContext } from '../../base/SpellCommand';

describe('MovementCommand - Reaction Usage', () => {
  it('consumes reaction if usesReaction is true', () => {
    const caster = createMockCombatCharacter({ id: 'caster', name: 'Caster', position: { x: 0, y: 0 } });
    const target = createMockCombatCharacter({ id: 'target', name: 'Target', position: { x: 1, y: 1 } });
    const state = createMockCombatState({
      characters: [caster, target],
      turnState: { currentTurn: 0, turnOrder: [], currentCharacterId: 'caster', phase: 'planning', actionsThisTurn: [] }
    });

    const effect: MovementEffect = {
      type: 'MOVEMENT',
      movementType: 'stop', // Using stop since that's where applyStop is called
      distance: 0,
      duration: {
        type: 'rounds',
        value: 1
      },
      forcedMovement: {
        usesReaction: true,
        direction: 'away_from_caster',
        maxDistance: 'target_speed'
      },
      trigger: { type: 'immediate', frequency: 'every_time', movementType: 'any' },
      condition: { type: 'always' }
    };

    const context: CommandContext = {
      spellId: 'test_spell',
      spellName: 'Test Spell',
      castAtLevel: 1,
      caster,
      targets: [target],
      gameState: createMockGameState()
    };

    const command = new MovementCommand(effect, context);

    // Ensure reaction starts as unused
    expect(target.actionEconomy.reaction.used).toBe(false);

    // Apply command
    const nextState = command.execute(state);

    // After command, reaction should be used
    const updatedTarget = nextState.characters.find(c => c.id === 'target')!;
    expect(updatedTarget.actionEconomy.reaction.used).toBe(true);
  });
});
