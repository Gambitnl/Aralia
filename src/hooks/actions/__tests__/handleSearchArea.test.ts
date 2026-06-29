import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dispatch } from 'react';
import { handleSearchArea } from '../handleItemInteraction';
import { forageWilderness } from '../../../systems/exploration/forage';
import type { GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';

/**
 * "Search the Area" is the wilderness loot affordance for procedural coord_ tiles
 * (named locations carry authored items; coord_ tiles do not). These tests lock in:
 *  - it only forages in the wilds,
 *  - a tile cannot be re-foraged (no farming),
 *  - finds are placed on the tile (PLACE_AREA_ITEMS) for the player to Take,
 *  - foraging always costs time.
 */

const makeState = (overrides: Partial<GameState> = {}): GameState => ({
  currentLocationId: 'coord_11_8',
  dynamicLocationItemIds: {},
  worldSeed: 12345,
  gameTime: new Date(Date.UTC(2026, 5, 28, 7, 0, 0)),
  mapData: undefined,
  ...overrides,
} as unknown as GameState);

describe('handleSearchArea (wilderness forage)', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let addMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
    addMessage = vi.fn();
  });

  it('refuses to forage at a named (non-coord) location', async () => {
    await handleSearchArea({
      gameState: makeState({ currentLocationId: 'whispering_woods' }),
      dispatch: dispatch as unknown as Dispatch<AppAction>,
      addMessage,
    });
    expect(addMessage.mock.calls.some(([m]) => /only forage out in the wilds/i.test(m))).toBe(true);
    expect(dispatch.mock.calls.some(([a]) => a.type === 'PLACE_AREA_ITEMS')).toBe(false);
  });

  it('reports an already-searched tile and does not place items again', async () => {
    await handleSearchArea({
      gameState: makeState({ dynamicLocationItemIds: { coord_11_8: [] } }),
      dispatch: dispatch as unknown as Dispatch<AppAction>,
      addMessage,
    });
    expect(addMessage.mock.calls.some(([m]) => /already searched/i.test(m))).toBe(true);
    expect(dispatch.mock.calls.some(([a]) => a.type === 'PLACE_AREA_ITEMS')).toBe(false);
  });

  it('places the deterministically-foraged items on the tile and advances time', async () => {
    const state = makeState();
    const expected = forageWilderness({ worldSeed: 12345, x: 11, y: 8, biomeId: undefined });

    await handleSearchArea({
      gameState: state,
      dispatch: dispatch as unknown as Dispatch<AppAction>,
      addMessage,
    });

    const place = dispatch.mock.calls.find(([a]) => a.type === 'PLACE_AREA_ITEMS');
    expect(place).toBeDefined();
    expect(place![0].payload).toEqual({ locationId: 'coord_11_8', itemIds: expected.itemIds });
    expect(dispatch.mock.calls.some(([a]) => a.type === 'ADVANCE_TIME')).toBe(true);

    if (expected.itemIds.length > 0) {
      expect(addMessage.mock.calls.some(([m]) => /uncover:/i.test(m))).toBe(true);
      expect(dispatch.mock.calls.some(([a]) => a.type === 'ADD_DISCOVERY_ENTRY')).toBe(true);
    } else {
      expect(addMessage.mock.calls.some(([m]) => /turn up nothing/i.test(m))).toBe(true);
    }
  });

  it('marks even a fruitless tile as searched (empty array placed)', async () => {
    // Find a seed/coord that forages nothing, to exercise the empty branch.
    let emptyCoord: { x: number; y: number } | null = null;
    for (let x = 0; x < 50 && !emptyCoord; x++) {
      if (forageWilderness({ worldSeed: 999, x, y: 0, biomeId: undefined }).itemIds.length === 0) {
        emptyCoord = { x, y: 0 };
      }
    }
    expect(emptyCoord, 'expected at least one empty-forage tile').not.toBeNull();

    await handleSearchArea({
      gameState: makeState({ currentLocationId: `coord_${emptyCoord!.x}_0`, worldSeed: 999 }),
      dispatch: dispatch as unknown as Dispatch<AppAction>,
      addMessage,
    });

    const place = dispatch.mock.calls.find(([a]) => a.type === 'PLACE_AREA_ITEMS');
    expect(place).toBeDefined();
    expect(place![0].payload.itemIds).toEqual([]);
    expect(dispatch.mock.calls.some(([a]) => a.type === 'ADD_DISCOVERY_ENTRY')).toBe(false);
  });
});
