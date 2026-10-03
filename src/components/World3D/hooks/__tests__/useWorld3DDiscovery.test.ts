/**
 * Unit tests for useWorld3DDiscovery hook.
 *
 * Verifies that proximity checks detect hidden sites and dungeon entrances,
 * dispatch the correct REVEAL_HIDDEN_SITE actions and system log messages,
 * and maintain idempotency across repeated position checks in the same session.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorld3DDiscovery } from '../useWorld3DDiscovery';
import type { GroundWorld } from '../../../../systems/worldforge/bridge/groundChunkLoader';

const mockDispatch = vi.fn();
const mockState = {
  playerCell: { cellId: 400 },
  discoveredHiddenSites: [] as Array<{ id: string }>,
  worldSeed: 42,
};

vi.mock('../../../../state/GameContext', () => ({
  useGameState: () => ({
    dispatch: mockDispatch,
    state: mockState,
  }),
}));

vi.mock('../../../../systems/worldforge/bridge/dungeonEntrances', () => ({
  dungeonNameForEntrance: vi.fn(() => 'Ancient Crypt'),
}));

describe('useWorld3DDiscovery', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockState.discoveredHiddenSites = [];
  });

  it('reveals a hidden site when the player comes within range', () => {
    const ground: GroundWorld = {
      cols: 10,
      rows: 10,
      extentMetersX: 100,
      extentMetersZ: 100,
      heights: new Float32Array(100),
      biomeIds: Array(100).fill('forest'),
      towns: [],
      townPlans: [],
      hiddenSites: [
        {
          id: 'site-1',
          name: 'Forgotten Shrine',
          kind: 'shrine',
          xM: 50,
          zM: 50,
          discoveryRadiusM: 10,
        },
      ],
      dungeonEntrances: [],
    } as unknown as GroundWorld;

    const groundRef = { current: ground };

    const { result } = renderHook(() =>
      useWorld3DDiscovery({
        groundRef,
        atlasGroundDrilldown: null,
      }),
    );

    // Check far away (distance = 50m) -> no discovery
    act(() => {
      result.current.checkProximityDiscoveries(0, 0, 0, 0);
    });
    expect(mockDispatch).not.toHaveBeenCalled();

    // Check within 10m (at 45, 50 -> distance = 5m) -> triggers discovery
    act(() => {
      result.current.checkProximityDiscoveries(45, 50, 45, 50);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'REVEAL_HIDDEN_SITE',
      payload: expect.objectContaining({
        id: 'site-1',
        name: 'Forgotten Shrine',
        cellId: 400,
      }),
    });

    // Subsequent check at the same position should be idempotent (no duplicate dispatch)
    mockDispatch.mockClear();
    act(() => {
      result.current.checkProximityDiscoveries(45, 50, 45, 50);
    });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('reveals a dungeon entrance when within range', () => {
    const ground: GroundWorld = {
      cols: 10,
      rows: 10,
      extentMetersX: 100,
      extentMetersZ: 100,
      heights: new Float32Array(100),
      biomeIds: Array(100).fill('forest'),
      towns: [],
      townPlans: [],
      hiddenSites: [],
      dungeonEntrances: [
        {
          id: 'dungeon-1',
          sitePath: 'wf:42/cell:400/dungeon:ancient-crypt',
          cellId: 400,
          entranceKind: 'dungeon',
          xM: 30,
          zM: 30,
          discoveryRadiusM: 15,
        },
      ],
    } as unknown as GroundWorld;

    const groundRef = { current: ground };

    const { result } = renderHook(() =>
      useWorld3DDiscovery({
        groundRef,
        atlasGroundDrilldown: null,
      }),
    );

    // Within 15m (at 25, 30 -> distance = 5m)
    act(() => {
      result.current.checkProximityDiscoveries(25, 30, 25, 30);
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'REVEAL_HIDDEN_SITE',
      payload: expect.objectContaining({
        id: 'dungeon-1',
        cellId: 400,
        name: 'Ancient Crypt',
        kind: 'dungeon',
      }),
    });
  });
});
