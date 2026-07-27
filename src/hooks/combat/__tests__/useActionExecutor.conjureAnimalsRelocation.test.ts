import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useActionExecutor } from '../useActionExecutor';
import type { CombatAction, CombatCharacter } from '../../../types/combat';
import type { ActiveSpellZone } from '../../../systems/spells/effects';
import {
  defaultProps,
  mockCanAfford,
  mockConsumeAction,
  mockProcessTileEffects,
  mockCharacter,
  resetActionExecutorMocks
} from './useActionExecutor.fixtures';

/**
 * This file proves the movement owner recenters Conjure Animals' persistent
 * threat zone when the summoned pack relocates.
 *
 * Called by: focused Vitest runtime proof for the G14 Conjure Animals family.
 * Depends on: useActionExecutor and the shared ActiveSpellZone contract.
 */

describe('useActionExecutor Conjure Animals relocation', () => {
  it('updates the pack-owned threat zone center before later trigger checks', async () => {
    resetActionExecutorMocks();
    const movedPack: CombatCharacter = {
      ...mockCharacter,
      id: 'conjure-animals-pack',
      name: 'Spectral Pack',
      isSummon: true,
      position: { x: 3, y: 0 },
      summonMetadata: {
        casterId: 'caster',
        spellId: 'conjure-animals'
      }
    };
    const zone: ActiveSpellZone = {
      id: 'conjure-animals-zone',
      spellId: 'conjure-animals',
      casterId: 'caster',
      position: { x: 0, y: 0 },
      areaOfEffect: { shape: 'sphere', size: 10 },
      effects: [],
      triggeredThisTurn: new Set(),
      triggeredEver: new Set()
    };
    const setSpellZones = vi.fn();
    mockCanAfford.mockReturnValue(true);
    mockConsumeAction.mockReturnValue(movedPack);
    mockProcessTileEffects.mockImplementation(character => character);

    const { result } = renderHook(() => useActionExecutor({
      ...defaultProps,
      characters: [{ ...movedPack, position: { x: 0, y: 0 } }],
      spellZones: [zone],
      setSpellZones
    }));

    const action: CombatAction = {
      id: 'conjure-animals-pack-move',
      characterId: movedPack.id,
      type: 'move',
      targetPosition: movedPack.position,
      cost: { type: 'movement-only', movementCost: 15 },
      timestamp: Date.now()
    };

    expect(await result.current.executeAction(action)).toBe(true);
    expect(setSpellZones).toHaveBeenCalledTimes(1);

    const updateZones = setSpellZones.mock.calls[0][0] as (zones: ActiveSpellZone[]) => ActiveSpellZone[];
    expect(updateZones([zone])[0]).toEqual(expect.objectContaining({
      position: movedPack.position
    }));
  });
});
