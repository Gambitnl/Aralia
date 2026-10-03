/**
 * Unit tests for useInteriorTransition hook.
 *
 * Verifies that nearby dungeon entrances are detected, enter actions validate
 * and dispatch DUNGEON_ENTERED, and retreat actions restore position and dispatch DUNGEON_RETREATED.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInteriorTransition } from '../useInteriorTransition';
import type {
  GroundDungeonEntrance,
  GroundWorld,
} from '../../../../systems/worldforge/bridge/groundChunkLoader';
import type { ClickMoveIntent } from '../../clickMoveAuthority';

const mockDispatch = vi.fn();
const mockState = {
  playerCell: { cellId: 500 },
  worldSeed: 42,
};

vi.mock('../../../../state/GameContext', () => ({
  useGameState: () => ({
    dispatch: mockDispatch,
    state: mockState,
  }),
}));

vi.mock('../../dungeonEntryRuntime', () => ({
  nearestEnterableDungeon: (entrances: GroundDungeonEntrance[], xM: number, zM: number) =>
    entrances.find((e) => Math.hypot(xM - e.xM, zM - e.zM) <= 10) ?? null,
  createDungeonEntry: (entrance: GroundDungeonEntrance, returnContext: unknown) => ({
    identity: { dungeonId: entrance.id, seedPath: entrance.sitePath },
    entranceKind: entrance.entranceKind,
    plan: { name: 'Test Dungeon' },
    returnContext,
  }),
}));

describe('useInteriorTransition', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
  });

  it('detects nearby dungeon entrance, enters, and retreats correctly', () => {
    const entrance: GroundDungeonEntrance = {
      id: 'dungeon-crypt-1',
      sitePath: 'wf:42/cell:500/dungeon:crypt',
      cellId: 500,
      entranceKind: 'ruin-door',
      xM: 50,
      zM: 50,
      discoveryRadiusM: 20,
    };

    const ground: GroundWorld = {
      dungeonEntrances: [entrance],
    } as unknown as GroundWorld;

    const groundRef = { current: ground };
    const wfGroundView = { tile: { x: 500, y: 0 } };
    const playerGroundPosRef = { current: null };
    const lastGroundXZ = { current: { x: 45, z: 50 } };
    const clickMoveIntent = { current: null as ClickMoveIntent };

    const { result } = renderHook(() =>
      useInteriorTransition({
        groundRef,
        wfGroundView,
        playerGroundPosRef,
        lastGroundXZ,
        clickMoveIntent,
      }),
    );

    // Initial state
    expect(result.current.nearbyDungeonEntrance).toBeNull();
    expect(result.current.activeDungeonEntry).toBeNull();

    // Move close to entrance (within 10m)
    act(() => {
      result.current.refreshNearbyDungeonEntrance(48, 50);
    });

    expect(result.current.nearbyDungeonEntrance?.id).toBe('dungeon-crypt-1');

    // Enter dungeon
    act(() => {
      result.current.handleEnterDungeon();
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'DUNGEON_ENTERED',
      payload: {
        identity: {
          dungeonId: 'dungeon-crypt-1',
          seedPath: 'wf:42/cell:500/dungeon:crypt',
        },
      },
    });
    expect(result.current.activeDungeonEntry).not.toBeNull();

    // Return / retreat from dungeon
    act(() => {
      result.current.handleReturnFromDungeon();
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_PLAYER_GROUND_POS',
      payload: {
        position: expect.objectContaining({
          tileX: 500,
          tileY: 0,
        }),
      },
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'DUNGEON_RETREATED',
      payload: { dungeonId: 'dungeon-crypt-1' },
    });

    expect(result.current.activeDungeonEntry).toBeNull();
  });
});
