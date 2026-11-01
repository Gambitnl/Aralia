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
  party: [{id: 'p', name: 'Player'}],
  companions: {},
  worldSeed: 42,
  gameTime: new Date('2026-08-26T12:00:00Z'),
  playerFactionStandings: {},
  notoriety: { knownCrimes: [] },
  worldforgeEncounterReceipts: [],
};

const mockHandleStartBattleMapEncounter = vi.fn();
const mockResolveSurfaceHostileTemplate = vi.hoisted(() => vi.fn());
const mockPrepareSurfaceHostileEncounter = vi.hoisted(() => vi.fn());
const mockSelectSurfaceHostileParticipants = vi.hoisted(() => vi.fn());
vi.mock('../../../../systems/combat/worldScenario/surfaceHostileEncounter', () => ({prepareSurfaceHostileEncounter: mockPrepareSurfaceHostileEncounter, selectSurfaceHostileParticipants: mockSelectSurfaceHostileParticipants}));
vi.mock('../../../../systems/combat/worldScenario/surfaceHostileTemplate', () => ({
  resolveSurfaceHostileTemplate: mockResolveSurfaceHostileTemplate,
}));
beforeEach(() => {
  mockSelectSurfaceHostileParticipants.mockReset().mockImplementation(args => ({status:'ready',hostiles:[args.hostile]}));
  mockPrepareSurfaceHostileEncounter.mockReset().mockImplementation(args => ({status: 'ready',
    receipt: {id: 'test-contact', kind: 'surface-hostile-contact'},
    payload: {monsters: [args.profile], extractedBattleMap: args.map},
  }));
  mockResolveSurfaceHostileTemplate.mockReset().mockImplementation(async (hostile) => ({
    status: 'ready',
    monster: { id: hostile.monsterId, name: hostile.name, quantity: 1, cr: '1', description: hostile.name },
  }));
});

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

  it('refuses an inconsistent source profile visibly without a fallback fight, repeated notices or position writes', async () => {
    mockResolveSurfaceHostileTemplate.mockResolvedValue({
      status: 'source-gap', detail: 'Highwayman declares CR 3 but Bandit is CR 1/8.',
    });
    const extractPatch = vi.fn();
    const combatTriggered = { current: false };
    const ground = { hostiles: [{ id: 'source-h', name: 'Highwayman', monsterId: 'Bandit', xM: 50, zM: 50 }] } as GroundWorld;
    const { result } = renderHook(() => useInPlaceCombatTransition({
      groundRef: { current: ground },
      extractPatchRef: { current: extractPatch as never },
      groundOccupantsAtRef: { current: null },
      lastGroundXZ: { current: { x: 48, z: 50 } },
      wfGroundView: null, loader: undefined, combatTriggered,
    }));
    await act(async () => { result.current.checkCombatTriggers(48, 50, {x: 600, y: 0}); });
    await act(async () => { result.current.checkCombatTriggers(48, 50, {x: 600, y: 0}); });
    expect(mockHandleStartBattleMapEncounter).not.toHaveBeenCalled();
    expect(extractPatch).not.toHaveBeenCalled();
    expect(combatTriggered.current).toBe(false);
    expect(mockDispatch.mock.calls.filter(([action]) => action.type === 'SET_PLAYER_GROUND_POS')).toHaveLength(0);
    expect(mockDispatch.mock.calls.filter(([action]) => action.type === 'ADD_NOTIFICATION')).toEqual([[
      { type: 'ADD_NOTIFICATION', payload: {type: 'warning', message: 'Combat unavailable for Highwayman: Highwayman declares CR 3 but Bandit is CR 1/8. No encounter has started.'} },
    ]]);
    // Leaving the contact radius lets a later legitimate approach retry.
    await act(async () => { result.current.checkCombatTriggers(0, 0, {x: 600, y: 0}); });
    await act(async () => { result.current.checkCombatTriggers(48, 50, {x: 600, y: 0}); });
    expect(mockResolveSurfaceHostileTemplate).toHaveBeenCalledTimes(2);
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

  it.each(['walked away', 'changed source world', 'left exploration'] as const)('does not launch a stale contact after the player %s during profile loading', async change => {
    let finish!: (value: unknown) => void;
    mockResolveSurfaceHostileTemplate.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const combatTriggered = { current: false };
    const ground = { cols: 10, rows: 10, biomeIds: Array(100).fill('Grassland'), towns: [],
      hostiles: [{id: 'h', name: 'Bandit', monsterId: 'Bandit', xM: 50, zM: 50}],
    } as unknown as GroundWorld;
    const groundRef = { current: ground };
    const lastGroundXZ = { current: {x: 48, z: 50} };
    const extract = vi.fn(() => ({width: 40, height: 30, tiles: [], entities: []}));
    const {result, unmount} = renderHook(() => useInPlaceCombatTransition({
      groundRef, extractPatchRef: {current: extract as never}, groundOccupantsAtRef: {current: null},
      lastGroundXZ, wfGroundView: null, loader: undefined, combatTriggered,
    }));
    await act(async () => { result.current.checkCombatTriggers(48, 50, {x: 600, y: 0}); });
    await vi.waitFor(() => expect(mockResolveSurfaceHostileTemplate).toHaveBeenCalledOnce());
    if(change === 'walked away') lastGroundXZ.current = {x: 0, z: 0};
    else if(change === 'changed source world') groundRef.current = {...ground, hostiles: []};
    else unmount();
    await act(async () => { finish({status: 'ready', monster: {id: 'bandit', name: 'Bandit', quantity: 1, cr: '1/8'}}); });
    expect(mockHandleStartBattleMapEncounter).not.toHaveBeenCalled();
    expect(extract).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(combatTriggered.current).toBe(false);
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
          monsterId: 'Dire Wolf',
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
    expect(mockPrepareSurfaceHostileEncounter).toHaveBeenCalledWith(expect.objectContaining({
      hostile: ground.hostiles[0], hostiles: ground.hostiles, profiles: [], cellId: 600, worldSeed: 42,
      party: [{characterId: 'p', xM: 48, zM: 50, yM: undefined}],
    }));
    expect(mockDispatch).toHaveBeenCalledWith({type: 'RECORD_WORLDFORGE_ENCOUNTER', payload: {receipt: {id: 'test-contact', kind: 'surface-hostile-contact'}}});
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
      hostiles: [{ id: 'hostile-wolf-1', name: 'Dire Wolf', monsterId: 'Dire Wolf', xM: 50, zM: 50 }],
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

describe('surface group profile validation',()=>{
  it.each([false,true])('validates the entire participant group before extraction (invalid companion: %s)',async invalid=>{
    mockDispatch.mockClear();mockHandleStartBattleMapEncounter.mockClear();
    mockSelectSurfaceHostileParticipants.mockImplementation(args=>({status:'ready',hostiles:args.hostiles}));
    mockResolveSurfaceHostileTemplate.mockImplementation(async h=>invalid&&h.id==='second'
      ?{status:'source-gap',detail:'Missing source profile'}
      :{status:'ready',monster:{id:h.monsterId,name:h.name,quantity:1,cr:'1/8',description:h.name}});
    const ground={cols:10,rows:10,biomeIds:Array(100).fill('forest'),towns:[],townPlans:[],hostiles:[
      {id:'first',name:'Bandit',monsterId:'Bandit',xM:50,zM:50},
      {id:'second',name:'Bandit',monsterId:'Bandit',xM:56,zM:50}
    ]} as unknown as GroundWorld;
    const extract=vi.fn(()=>({dimensions:{width:11,height:11},tiles:new Map(),theme:'forest',seed:42}));
    const {result}=renderHook(()=>useInPlaceCombatTransition({groundRef:{current:ground},extractPatchRef:{current:extract as never},groundOccupantsAtRef:{current:null},lastGroundXZ:{current:{x:48,z:50}},wfGroundView:null,loader:undefined,combatTriggered:{current:false}}));
    await act(async()=>{result.current.checkCombatTriggers(48,50,{x:600,y:0});});
    expect(mockResolveSurfaceHostileTemplate).toHaveBeenCalledWith(ground.hostiles[1]);
    if(invalid){
      expect(extract).not.toHaveBeenCalled();expect(mockHandleStartBattleMapEncounter).not.toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({type:'ADD_NOTIFICATION',payload:expect.objectContaining({message:expect.stringContaining('No group member was omitted')})}));
    }else{
      expect(mockPrepareSurfaceHostileEncounter).toHaveBeenCalledWith(expect.objectContaining({hostiles:ground.hostiles,profiles:[{entityId:'second',monster:expect.objectContaining({name:'Bandit'})}]}));
      expect(mockHandleStartBattleMapEncounter).toHaveBeenCalled();
    }
  });
});
