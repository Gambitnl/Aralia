import { describe, expect, it } from 'vitest';

import { buildAbilityCombatAction } from '../actionUtils';
import type { Ability, CombatCharacter } from '../../types/combat';

/**
 * This file protects the combat action handoff used after the player confirms a
 * spell or ability target.
 *
 * The live hook still sends legacy creature IDs and a clicked position, but the
 * Spell Phase object-targeting work also needs a richer target envelope so future
 * map objects and ground points do not lose their identity before execution.
 *
 * Called by: focused Vitest runs for spell targeting/action bridge changes.
 * Depends on: actionUtils.ts and the combat target-envelope types.
 */

describe('buildAbilityCombatAction selected target envelope', () => {
  it('adds creature target references while preserving legacy target ids and position', () => {
    const ability = {
      id: 'ray-of-frost',
      cost: { type: 'action' }
    } as Ability;
    const caster = { id: 'caster' } as CombatCharacter;
    const targetPosition = { x: 4, y: 2 };

    const action = buildAbilityCombatAction(ability, caster, targetPosition, ['goblin-1', 'goblin-2']);

    expect(action.targetPosition).toEqual(targetPosition);
    expect(action.targetCharacterIds).toEqual(['goblin-1', 'goblin-2']);
    expect(action.selectedSpellTargets).toEqual([
      { kind: 'creature', id: 'goblin-1' },
      { kind: 'creature', id: 'goblin-2' }
    ]);
  });

  it('can carry an explicit object or point target without fabricating creature ids', () => {
    const ability = {
      id: 'catapult',
      cost: { type: 'action' }
    } as Ability;
    const caster = { id: 'caster' } as CombatCharacter;
    const targetPosition = { x: 1, y: 3 };

    const action = buildAbilityCombatAction(
      ability,
      caster,
      targetPosition,
      [],
      [
        {
          kind: 'object',
          id: 'loose-stone',
          position: targetPosition,
          name: 'Loose Stone',
          object: {
            id: 'loose-stone',
            name: 'Loose Stone',
            position: targetPosition,
            weightPounds: 2,
            isWornOrCarried: false
          }
        },
        { kind: 'point', position: { x: 2, y: 3 }, purpose: 'ground_target' }
      ]
    );

    expect(action.targetCharacterIds).toEqual([]);
    expect(action.selectedSpellTargets).toEqual([
      expect.objectContaining({ kind: 'object', id: 'loose-stone', name: 'Loose Stone' }),
      { kind: 'point', position: { x: 2, y: 3 }, purpose: 'ground_target' }
    ]);
  });
});
