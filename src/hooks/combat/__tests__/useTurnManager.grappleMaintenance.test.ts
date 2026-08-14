/**
 * This file proves ordinary map actions run canonical Grappled maintenance.
 *
 * The test mounts the production turn coordinator, executes the same move
 * action created by both battle-map renderers, and mirrors parent-owned roster
 * updates between renders. It covers in-reach preservation, paired cleanup,
 * immediate movement restoration, and repeated post-release updates.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CombatCharacter, CombatLogEntry } from '../../../types/combat';
import { calculateMovementTotal } from '../../../utils/combat/actionEconomyUtils';
import { applyGrappledCondition } from '../../../utils/combat/grappleUtils';
import { createMockCombatCharacter } from '../../../utils/core';
import { useTurnManager } from '../useTurnManager';

// ============================================================================
// Live Roster Harness
// ============================================================================
// Parent components own the character array in production. This harness applies
// each hook callback immediately, then rerenders before the next player action.
// ============================================================================

function createGrappleRoster(): CombatCharacter[] {
  const grappler = createMockCombatCharacter({
    id: 'movement-grappler',
    name: 'Movement Grappler',
    team: 'player',
    position: { x: 4, y: 4 },
  });
  const target = applyGrappledCondition(createMockCombatCharacter({
    id: 'movement-target',
    name: 'Movement Target',
    team: 'enemy',
    position: { x: 5, y: 4 },
  }), {
    grapplerId: grappler.id,
    escapeDc: 13,
    source: 'Turn-manager integration test',
  });

  return [grappler, target];
}

function findCharacter(characters: CombatCharacter[], characterId: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === characterId);
  if (!character) throw new Error(`Missing test character ${characterId}.`);
  return character;
}

describe('useTurnManager Grappled movement maintenance', () => {
  it('preserves an in-reach move, then releases both mirrors once beyond reach', async () => {
    let charactersState = createGrappleRoster();
    const logs: CombatLogEntry[] = [];
    const onCharacterUpdate = (updatedCharacter: CombatCharacter) => {
      charactersState = charactersState.map(character => (
        character.id === updatedCharacter.id ? updatedCharacter : character
      ));
    };
    const { result, rerender } = renderHook(
      ({ chars }: { chars: CombatCharacter[] }) => useTurnManager({
        characters: chars,
        mapData: null,
        onCharacterUpdate,
        onLogEntry: entry => logs.push(entry),
        initiativeRoller: character => character.id === 'movement-grappler' ? 18 : 12,
      }),
      { initialProps: { chars: charactersState } },
    );

    act(() => {
      result.current.initializeCombat(charactersState);
    });
    rerender({ chars: charactersState });

    await act(async () => {
      await result.current.executeAction({
        id: 'move-within-reach',
        characterId: 'movement-grappler',
        type: 'move',
        cost: { type: 'movement-only', movementCost: 5 },
        targetPosition: { x: 4, y: 5 },
        timestamp: 1,
      });
    });
    rerender({ chars: charactersState });

    const stillHeld = findCharacter(charactersState, 'movement-target');
    expect(stillHeld.statusEffects).toContainEqual(expect.objectContaining({ name: 'Grappled' }));
    expect(stillHeld.conditions).toContainEqual(expect.objectContaining({ name: 'Grappled' }));
    expect(calculateMovementTotal(stillHeld)).toBe(0);

    await act(async () => {
      await result.current.executeAction({
        id: 'move-beyond-reach',
        characterId: 'movement-grappler',
        type: 'move',
        cost: { type: 'movement-only', movementCost: 10 },
        targetPosition: { x: 2, y: 5 },
        timestamp: 2,
      });
    });
    rerender({ chars: charactersState });

    const released = findCharacter(charactersState, 'movement-target');
    expect(released.statusEffects.some(effect => effect.name === 'Grappled')).toBe(false);
    expect(released.conditions?.some(condition => condition.name === 'Grappled')).toBe(false);
    expect(released.actionEconomy.movement.total).toBe(30);
    expect(logs.filter(entry => entry.message.startsWith('Grapple ends:'))).toHaveLength(1);

    // A later ordinary update must not republish cleanup or restore a stale
    // mirror from the hook's pre-batch character prop.
    await act(async () => {
      await result.current.executeAction({
        id: 'move-after-release',
        characterId: 'movement-grappler',
        type: 'move',
        cost: { type: 'movement-only', movementCost: 5 },
        targetPosition: { x: 1, y: 5 },
        timestamp: 3,
      });
    });
    rerender({ chars: charactersState });

    expect(logs.filter(entry => entry.message.startsWith('Grapple ends:'))).toHaveLength(1);
    expect(findCharacter(charactersState, 'movement-target').actionEconomy.movement.total).toBe(30);
  });
});
