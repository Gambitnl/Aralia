/**
 * Unit tests for useInPlaceCombatTransition hook.
 *
 * Verifies that hostile proximity triggers combat, dispatches position freeze,
 * and passes the extracted tactical patch to the encounter handler.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useInPlaceCombatTransition,
  attachWorldforgeBattleMapProvenance,
  standsInSettlement,
} from '../useInPlaceCombatTransition';
import type { GroundWorld } from '../../../../systems/worldforge/bridge/groundChunkLoader';
import type { BattleMapData } from '../../../../types/combat';

const mockDispatch = vi.fn();
const mockState = {
  playerCell: { cellId: 600 },
  worldSeed: 42,
  gameTime: new Date('2026-08-26T12:00:00Z'),
  playerFactionStandings: {},
  notoriety: { knownCrimes: [] },
  worldforgeEncounterReceipts: [],
};

const mockHandleStartBattleMapEncounter = vi.fn();

vi.mock('../../../../state/GameContext', () => ({
  useGameState: () => ({
    dispatch: mockDispatch,
    state: mockState,
  }),
}));

vi.mock('../../../../hooks/actions/handleEncounter', () => ({
  handleStartBattleMapEncounter: (...args: unknown[]) =>
    mockHandleStartBattleMapEncounter(...args),
}));

vi.mock('../../../../systems/combat/fightInPlace/activeGroundCombatSession', () => ({
  prepareActiveGroundSettlementEncounter: vi.fn(),
  registerActiveGroundCombatProvider: () => vi.fn(),
  registerActiveGroundOpeningCombatProvider: () => vi.fn(),
}));

describe('useInPlaceCombatTransition', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockHandleStartBattleMapEncounter.mockClear();
  });

  it('attaches worldforge provenance correctly to battle map data', () => {
    const rawMap: BattleMapData = {
      width: 40,
      height: 30,
      tiles: [],
      entities: [],
    } as unknown as BattleMapData;

    const result = attachWorldforgeBattleMapProvenance(rawMap, 42, 600, 100, 200);
    expect(result.provenance).toEqual({
      kind: 'worldforge',
      worldSeed: 42,
      anchorCellId: 600,
      anchorWorldMeters: { x: 100, z: 200 },
      generationPath: ['World', 'Region', 'Local', 'Ground', 'Tactical patch'],
    });
  });

  it('triggers combat when player walks within 4m of a hostile creature', async () => {
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
      dungeonEntrances: [],
      hostiles: [
        {
          id: 'hostile-wolf-1',
          name: 'Dire Wolf',
          xM: 50,
          zM: 50,
        },
      ],
    } as unknown as GroundWorld;

    const groundRef = { current: ground };
    const extractPatchRef = {
      current: vi.fn(() => ({
        width: 40,
        height: 30,
        tiles: [],
        entities: [],
      })) as unknown as typeof import('../../../../systems/worldforge/bridge/groundChunkLoader').extractLocalTerrainPatch,
    };
    const groundOccupantsAtRef = {
      current: vi.fn(() => []) as unknown as typeof import('../../../../systems/worldforge/bridge/groundAgentMotion').allGroundAgentsAt,
    };
    const lastGroundXZ = { current: { x: 48, z: 50 } };
    const wfGroundView = {
      start: [0, 0, 0] as readonly [number, number, number],
      surfaceY: 0,
      tile: { x: 600, y: 0 },
      localeExtent: { cols: 10, rows: 10 },
    };
    const combatTriggered = { current: false };

    const { result } = renderHook(() =>
      useInPlaceCombatTransition({
        groundRef,
        extractPatchRef,
        groundOccupantsAtRef,
        lastGroundXZ,
        wfGroundView,
        loader: undefined,
        combatTriggered,
      }),
    );

    // Far from hostile (at 0, 0 -> dist 70m)
    act(() => {
      result.current.checkCombatTriggers(0, 0, { x: 600, y: 0 });
    });
    expect(combatTriggered.current).toBe(false);

    // Within 4m of hostile (at 48, 50 -> dist 2m)
    await act(async () => {
      result.current.checkCombatTriggers(48, 50, { x: 600, y: 0 });
    });

    expect(combatTriggered.current).toBe(true);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_PLAYER_GROUND_POS',
      payload: {
        position: {
          tileX: 600,
          tileY: 0,
          xM: 48,
          zM: 50,
        },
      },
    });
    expect(mockHandleStartBattleMapEncounter).toHaveBeenCalled();
  });
});

// ============================================================================
// Full-freedom initiation (9C)
// ============================================================================
// Combat can start from ANY exploration position, and the battlefield it cuts
// must match the context the player was standing in. Before this, the picker
// covered three of WorldForge's thirteen biomes and knew nothing about towns.
// ============================================================================

describe('standsInSettlement', () => {
  const towns = [{ burgId: 1, name: 'Redhollow', xM: 100, zM: 200, halfM: 25 }];

  it('recognizes a player inside a town footprint', () => {
    expect(standsInSettlement({ towns }, 100, 200)).toBe(true);
    expect(standsInSettlement({ towns }, 120, 215)).toBe(true);
  });

  it('rejects a player outside every town footprint', () => {
    expect(standsInSettlement({ towns }, 140, 200)).toBe(false);
    expect(standsInSettlement({ towns }, 100, 240)).toBe(false);
  });

  it('handles a ground artifact with no towns at all', () => {
    expect(standsInSettlement({ towns: [] }, 0, 0)).toBe(false);
    expect(standsInSettlement({} as { towns: [] }, 0, 0)).toBe(false);
  });
});

describe('useInPlaceCombatTransition battlefield context (9C)', () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    mockHandleStartBattleMapEncounter.mockClear();
  });

  /** Walk into the hostile and report the theme the patch extractor was asked for. */
  async function themeForContext(options: {
    biome: string;
    towns?: GroundWorld['towns'];
  }): Promise<string | undefined> {
    const ground = {
      cols: 10,
      rows: 10,
      extentMetersX: 100,
      extentMetersZ: 100,
      heights: new Float32Array(100),
      biomeIds: Array(100).fill(options.biome),
      towns: options.towns ?? [],
      townPlans: [],
      hiddenSites: [],
      dungeonEntrances: [],
      hostiles: [{ id: 'hostile-wolf-1', name: 'Dire Wolf', xM: 50, zM: 50 }],
    } as unknown as GroundWorld;

    const extractPatch = vi.fn(() => ({ width: 40, height: 30, tiles: [], entities: [] }));
    const combatTriggered = { current: false };

    const { result } = renderHook(() =>
      useInPlaceCombatTransition({
        groundRef: { current: ground },
        extractPatchRef: {
          current: extractPatch as unknown as typeof import('../../../../systems/worldforge/bridge/groundChunkLoader').extractLocalTerrainPatch,
        },
        groundOccupantsAtRef: {
          current: vi.fn(() => []) as unknown as typeof import('../../../../systems/worldforge/bridge/groundAgentMotion').allGroundAgentsAt,
        },
        lastGroundXZ: { current: { x: 48, z: 50 } },
        wfGroundView: {
          start: [0, 0, 0] as readonly [number, number, number],
          surfaceY: 0,
          tile: { x: 600, y: 0 },
          localeExtent: { cols: 10, rows: 10 },
        },
        loader: undefined,
        combatTriggered,
      }),
    );

    await act(async () => {
      result.current.checkCombatTriggers(48, 50, { x: 600, y: 0 });
    });

    // extractLocalTerrainPatch(ground, x, z, theme, worldSeed, ...) — the mock
    // declares no parameters, so read the argument list positionally.
    const firstCall = extractPatch.mock.calls[0] as unknown as unknown[] | undefined;
    return firstCall?.[3] as string | undefined;
  }

  it('cuts a swamp battlefield when the player fights in a wetland', async () => {
    expect(await themeForContext({ biome: 'Wetland' })).toBe('swamp');
  });

  it('cuts a snow battlefield on a glacier — a biome the old picker could not reach', async () => {
    expect(await themeForContext({ biome: 'Glacier' })).toBe('snow');
  });

  it('cuts a built-environment battlefield when the fight starts inside a town', async () => {
    const theme = await themeForContext({
      biome: 'Grassland',
      towns: [{ burgId: 1, name: 'Redhollow', xM: 48, zM: 50, halfM: 40 }],
    });
    // The surface biome under a town is still grassland; standing IN the town wins.
    expect(theme).toBe('ruins');
  });

  it('keeps the forest default for a forest fight', async () => {
    expect(await themeForContext({ biome: 'Temperate deciduous forest' })).toBe('forest');
  });
});
