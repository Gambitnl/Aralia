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
import { DiscoveryType, type DiscoveryEntry } from '../../../../types';

const mockDispatch = vi.fn();
const {publicVisit} = vi.hoisted(() => ({publicVisit: vi.fn<(...args: unknown[]) => unknown>(() => null)}));
vi.mock('../../publicBuildingDiscovery', () => ({publicBuildingDiscovery: publicVisit}));
const mockState = {
  playerCell: { cellId: 400 },
  discoveredHiddenSites: [] as Array<{ id: string }>,
  worldSeed: 42,
  gameTime: new Date('0351-01-01T07:00:00.000Z'),
  discoveryLog: [] as DiscoveryEntry[],
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
    mockState.discoveryLog = [];
    publicVisit.mockReset().mockReturnValue(null);
  });

  it('records a body-supported public visit once without a pin, and retains that identity after remount', () => {
    const account = {gameTime:mockState.gameTime.toISOString(),type:DiscoveryType.LOCATION_DISCOVERY,
      title:'Place Visited: Saved inn',content:'You entered its public common room.',source:{type:'LOCATION',id:'world:42:cell:400:building:wf-plot-8-1'},
      flags:[{key:'locationId',value:'world:42:cell:400:building:wf-plot-8-1'}],associatedLocationId:'cell_400'};
    publicVisit.mockReturnValue(account);
    const groundRef={current:{buildings:[]} as unknown as GroundWorld};
    const mounted=renderHook(()=>useWorld3DDiscovery({groundRef}));
    act(()=>mounted.result.current.checkProximityDiscoveries(5,6,100,200));
    expect(publicVisit).not.toHaveBeenCalled();
    act(()=>mounted.result.current.checkProximityDiscoveries(5,6,100,200,10.1));
    expect(publicVisit).toHaveBeenCalledWith(groundRef.current,{xM:5,zM:6,yM:10.1},mockState,expect.any(Function));
    expect(mockDispatch.mock.calls.map(([action])=>action.type)).toEqual(['ADD_DISCOVERY_ENTRY']);
    act(()=>mounted.result.current.checkProximityDiscoveries(5,6,0,0,10.1));
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    mockState.discoveryLog=[account as DiscoveryEntry];mockDispatch.mockClear();mounted.unmount();
    const loaded=renderHook(()=>useWorld3DDiscovery({groundRef}));
    act(()=>loaded.result.current.checkProximityDiscoveries(5,6,0,0,10.1));
    expect(mockDispatch).not.toHaveBeenCalled();
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

    expect(mockDispatch).toHaveBeenCalledWith({type:'ADD_DISCOVERY_ENTRY',payload:expect.objectContaining({
      type:DiscoveryType.LOCATION_DISCOVERY,
      title:'Place Discovered: Forgotten Shrine',
      associatedLocationId:'cell_400',
    })});

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

    // Looking at the doorway from afar must not discover it.
    act(() => result.current.checkProximityDiscoveries(0, 0, 30, 30));
    expect(mockDispatch).not.toHaveBeenCalled();

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

    const account = mockDispatch.mock.calls.find(([action])=>action.type==='ADD_DISCOVERY_ENTRY')?.[0].payload;
    expect(account.title).toBe('Place Discovered: Ancient Crypt');
    mockState.discoveredHiddenSites = [{id:'dungeon-1'}];
    mockState.discoveryLog = [account];
    mockDispatch.mockClear();
    // A full hook remount represents returning after save/reload.
    const revisited=renderHook(()=>useWorld3DDiscovery({groundRef,atlasGroundDrilldown:null}));
    act(()=>revisited.result.current.checkProximityDiscoveries(25,30,25,30));
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
