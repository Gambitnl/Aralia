import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Dispatch } from 'react';
import { useVoyageArrival } from '../useVoyageArrival';
import type { VoyageState } from '../../types/naval';
import type { AppAction } from '../../state/actionTypes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../systems/worldforge/bridge/legacySubmapBridge', () => {
  // Burgs indexed by burgId; each carries its atlas cell (the cell-native arrival).
  const burgs: Array<{ cell: number } | undefined> = [];
  burgs[42] = { cell: 142 };
  burgs[7] = { cell: 107 };
  return {
    getBridgeAtlas: vi.fn(() => ({ pack: { burgs } })),
  };
});

vi.mock('@/utils/spatial', () => ({
  determineActiveDynamicNpcsForLocation: vi.fn((_locationId: string) => ['npc_guard_1', 'npc_merchant_2']),
}));

vi.mock('../../constants', () => ({
  LOCATIONS: {},
}));

import { getBridgeAtlas } from '../../systems/worldforge/bridge/legacySubmapBridge';
import { determineActiveDynamicNpcsForLocation } from '@/utils/spatial';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeDocketVoyage(destinationId: string): VoyageState {
  return {
    shipId: 'ship-1',
    destinationId,
    status: 'Docked',
    daysAtSea: 3,
    distanceTraveled: 100,
    distanceToDestination: 100,
    currentWeather: 'Calm',
    suppliesConsumed: { food: 6, water: 6 },
    log: [],
  };
}

function makeSailingVoyage(destinationId: string): VoyageState {
  return {
    shipId: 'ship-1',
    destinationId,
    status: 'Sailing',
    daysAtSea: 1,
    distanceTraveled: 20,
    distanceToDestination: 100,
    currentWeather: 'Calm',
    suppliesConsumed: { food: 2, water: 2 },
    log: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useVoyageArrival', () => {
  // mockDispatch is the raw vi.fn() for assertion (toHaveBeenCalledTimes, .mock.calls).
  // dispatch is the typed alias passed to the hook (React.Dispatch<AppAction>).
  let mockDispatch: ReturnType<typeof vi.fn>;
  let dispatch: Dispatch<AppAction>;

  beforeEach(() => {
    mockDispatch = vi.fn();
    dispatch = mockDispatch as unknown as Dispatch<AppAction>;
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Docked voyage with a matching port tile
  // -------------------------------------------------------------------------
  it('dispatches MOVE_PLAYER then NAVAL_CLEAR_VOYAGE when docked with a matching tile', () => {
    const voyage = makeDocketVoyage('42'); // burgId 42 → tile (5, 3)

    renderHook(() =>
      useVoyageArrival({
        worldSeed: 12345,
        currentVoyage: voyage,
        dispatch,
      }),
    );

    expect(mockDispatch).toHaveBeenCalledTimes(2);

    // First call: MOVE_PLAYER
    const moveCall = mockDispatch.mock.calls[0][0];
    expect(moveCall.type).toBe('MOVE_PLAYER');
    expect(moveCall.payload.newLocationId).toBe('cell_142'); // burg 42 → atlas cell 142
    expect(moveCall.payload.activeDynamicNpcIds).toEqual(['npc_guard_1', 'npc_merchant_2']);
    expect(moveCall.payload).not.toHaveProperty('mapData'); // not passed — reducer uses current

    // Second call: NAVAL_CLEAR_VOYAGE
    const clearCall = mockDispatch.mock.calls[1][0];
    expect(clearCall.type).toBe('NAVAL_CLEAR_VOYAGE');
  });

  it('computes activeDynamicNpcIds using the correct locationId', () => {
    renderHook(() =>
      useVoyageArrival({
        worldSeed: 12345,
        currentVoyage: makeDocketVoyage('7'), // burgId 7 → atlas cell 107
        dispatch,
      }),
    );

    expect(determineActiveDynamicNpcsForLocation).toHaveBeenCalledWith('cell_107', {});
  });

  it('passes worldSeed to the cell-native bridge atlas', () => {
    renderHook(() =>
      useVoyageArrival({
        worldSeed: 99999,
        currentVoyage: makeDocketVoyage('42'),
        dispatch,
      }),
    );

    // Grid retirement made the burg's atlas cell authoritative, so arrival no
    // longer requests a projected 30x20 town-tile view.
    expect(getBridgeAtlas).toHaveBeenCalledWith(99999);
  });

  // -------------------------------------------------------------------------
  // 2. Non-docked voyages dispatch nothing
  // -------------------------------------------------------------------------
  it('dispatches nothing when voyage status is Sailing', () => {
    renderHook(() =>
      useVoyageArrival({
        worldSeed: 12345,
        currentVoyage: makeSailingVoyage('42'),
        dispatch,
      }),
    );

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('dispatches nothing when currentVoyage is null', () => {
    renderHook(() =>
      useVoyageArrival({
        worldSeed: 12345,
        currentVoyage: null,
        dispatch,
      }),
    );

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('dispatches nothing when currentVoyage is undefined', () => {
    renderHook(() =>
      useVoyageArrival({
        worldSeed: 12345,
        currentVoyage: undefined,
        dispatch,
      }),
    );

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. Idempotency: after voyage is cleared (null), no further dispatch
  // -------------------------------------------------------------------------
  it('does not re-dispatch after voyage is cleared (rerender with null voyage)', () => {
    let voyage: VoyageState | null = makeDocketVoyage('42');

    const { rerender } = renderHook(() =>
      useVoyageArrival({
        worldSeed: 12345,
        currentVoyage: voyage,
        dispatch,
      }),
    );

    // First render: dispatched MOVE_PLAYER + NAVAL_CLEAR_VOYAGE
    expect(mockDispatch).toHaveBeenCalledTimes(2);

    // Simulate state update: voyage is now null after reducer applied NAVAL_CLEAR_VOYAGE
    voyage = null;
    rerender();

    // No additional dispatches
    expect(mockDispatch).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // 4. No matching tile for destBurgId → only NAVAL_CLEAR_VOYAGE, no MOVE_PLAYER
  // -------------------------------------------------------------------------
  it('dispatches only NAVAL_CLEAR_VOYAGE (not MOVE_PLAYER) when no tile matches the destBurgId', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderHook(() =>
      useVoyageArrival({
        worldSeed: 12345,
        currentVoyage: makeDocketVoyage('999'), // burgId 999 not in mock tile list
        dispatch,
      }),
    );

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'NAVAL_CLEAR_VOYAGE' });
    // Confirm a clear error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Destination burg 999 has no atlas cell'),
    );

    consoleErrorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 5. Invalid/absent destinationId → only NAVAL_CLEAR_VOYAGE
  // -------------------------------------------------------------------------
  it('dispatches only NAVAL_CLEAR_VOYAGE when destinationId is "0" (non-positive)', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderHook(() =>
      useVoyageArrival({
        worldSeed: 12345,
        currentVoyage: makeDocketVoyage('0'),
        dispatch,
      }),
    );

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'NAVAL_CLEAR_VOYAGE' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('invalid destinationId "0"'),
    );

    consoleErrorSpy.mockRestore();
  });

  it('dispatches only NAVAL_CLEAR_VOYAGE when destinationId is empty string', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderHook(() =>
      useVoyageArrival({
        worldSeed: 12345,
        currentVoyage: makeDocketVoyage(''),
        dispatch,
      }),
    );

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'NAVAL_CLEAR_VOYAGE' });

    consoleErrorSpy.mockRestore();
  });

  it('dispatches only NAVAL_CLEAR_VOYAGE when destinationId is absent (undefined)', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const voyage: VoyageState = { ...makeDocketVoyage('42'), destinationId: undefined };

    renderHook(() =>
      useVoyageArrival({
        worldSeed: 12345,
        currentVoyage: voyage,
        dispatch,
      }),
    );

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'NAVAL_CLEAR_VOYAGE' });

    consoleErrorSpy.mockRestore();
  });

  // Grid retirement: the "absent mapData.gridSize → only NAVAL_CLEAR_VOYAGE"
  // case is removed — there is no mapData grid anymore; the burg→tile map uses
  // the canonical MAP_GRID_SIZE, so docking always resolves against the world.

  // -------------------------------------------------------------------------
  // 7. Absent worldSeed → only NAVAL_CLEAR_VOYAGE (no MOVE_PLAYER)
  // -------------------------------------------------------------------------
  it('dispatches only NAVAL_CLEAR_VOYAGE when worldSeed is null', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderHook(() =>
      useVoyageArrival({
        worldSeed: null,
        currentVoyage: makeDocketVoyage('42'),
        dispatch,
      }),
    );

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'NAVAL_CLEAR_VOYAGE' });
    expect(getBridgeAtlas).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('worldSeed is absent'),
    );

    consoleErrorSpy.mockRestore();
  });
});
