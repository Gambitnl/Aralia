/**
 * This file proves that the mounted world distinguishes a destination from arrival.
 *
 * A small staged GroundWorld is delivered through the same world-generation client boundary used
 * by World3DWrapper. The scene stand-in requests movement, reports actual footfalls,
 * and pans the camera independently. Only the reached body can offer a doorway,
 * discover sites, trigger encounters, and supply the exact dungeon return point.
 *
 * Called by: the focused Vitest dungeon-entry verification lane.
 * Depends on: World3DWrapper and its established World3DScene movement callback.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroundWorld } from '../../../systems/worldforge/bridge/groundChunkLoader';

// ============================================================================
// Mounted Ground Session Fixture
// ============================================================================
// The wrapper still performs its real asynchronous ground-session setup. Only the expensive world
// authoring and WebGL renderer are replaced with deterministic boundaries suitable for jsdom.
// ============================================================================

const fixture = vi.hoisted(() => ({
  dispatch: vi.fn(),
  groundFactory: vi.fn(),
  worldBusinesses: {} as Record<string, { id: string; name: string; stock: Array<{ itemId: string; quantity: number }> }>,
  setPosition: vi.fn(),
  generate: vi.fn(),
  dispose: vi.fn(),
  discoveries: vi.fn(),
  combat: vi.fn(),
  gameTime: new Date('2026-07-19T12:00:00.000Z'),
  isBroadsheetVisible: false,
  conversationOpen: false,
  isDialogueInterfaceOpen: false,
  conversation: {id:'talk',participants:['elara_vance'],messages:[],isPlayerTurn:true,pendingResponse:false},
  cellId: 751,
  discoveryLog: [] as Array<{source:{type:string;id:string;name:string}}>,
  entrance: {
    id: 'wf-dungeon-click-move-proof',
    sitePath: 'wf:42/cell:751/dungeon:click-move-proof',
    cellId: 751,
    entranceKind: 'dungeon' as const,
    xM: 120,
    zM: 160,
    discoveryRadiusM: 76.2,
  },
  ground: {
    cols: 2,
    rows: 2,
    heights: new Float32Array(4),
    biomeIds: ['grassland', 'grassland', 'grassland', 'grassland'],
    extentMetersX: 240,
    extentMetersZ: 240,
    towns: [],
    townPlans: [],
    hiddenSites: [],
    dungeonEntrances: [] as Array<{
      id: string;
      sitePath: string;
      cellId: number;
      entranceKind: 'dungeon';
      xM: number;
      zM: number;
      discoveryRadiusM: number;
    }>,
  },
}));

fixture.ground.dungeonEntrances.push(fixture.entrance);

// Canonical identity generation is proven by dungeonEntryRuntime.test.ts. This mounted component
// test keeps that boundary deterministic so it can inspect the GameState actions emitted after a
// validated entry and return without regenerating a full dungeon plan in jsdom.
vi.mock('../dungeonEntryRuntime', () => ({
  nearestEnterableDungeon: (
    entrances: typeof fixture.ground.dungeonEntrances,
    xM: number,
    zM: number,
  ) => entrances.find((entrance) => Math.hypot(xM - entrance.xM, zM - entrance.zM) <= 18) ?? null,
  createDungeonEntry: (
    entrance: typeof fixture.entrance,
    returnContext: {
      worldSeed: number;
      cellId: number;
      tileX: number;
      tileY: number;
      xM: number;
      zM: number;
    },
  ) => ({
    identity: { dungeonId: entrance.id, seedPath: entrance.sitePath },
    entranceKind: entrance.entranceKind,
    plan: { name: 'Mounted Lifecycle Proof' },
    returnContext,
  }),
}));

// The scene stand-in exposes one semantic control that invokes the production wrapper callback.
// It does not calculate proximity or render a prompt itself, so a passing assertion must come from
// World3DWrapper's real click-move handler and state.
vi.mock('../World3DScene', () => ({
  default: ({ onGroundPick, onAvatarMovementBlocked, onAvatarPositionChange, onPositionChange, framePlayerNonce, suspended }: {
    suspended?: boolean;
    framePlayerNonce?: number;
    onGroundPick?: (xM: number, zM: number) => void;
    onAvatarMovementBlocked?: (position: { xM: number; zM: number }) => void;
    onAvatarPositionChange?: (position: { xM: number; zM: number; yM: number }) => void;
    onPositionChange?: (xM: number, zM: number) => void;
  }) => (
    // This is a test-only stand-in for the R3F ground plane, not player-facing application chrome;
    // a native control keeps the simulated scene boundary independent from the shared UI layer.
    // eslint-disable-next-line no-restricted-syntax
    <><div data-testid="scene-suspension" data-suspended={Boolean(suspended)} /><div data-testid="camera-player-request" data-nonce={framePlayerNonce ?? 0} /><button
      type="button"
      data-testid="move-player-to-dungeon"
      disabled={!onGroundPick}
      onClick={() => onGroundPick?.(fixture.entrance.xM, fixture.entrance.zM)}
    >
      Move player to dungeon
    </button>
    <button type="button" data-testid="arrive-at-dungeon" onClick={() => onAvatarPositionChange?.({ xM: fixture.entrance.xM - 0.25, zM: fixture.entrance.zM, yM: 0 })}>Actual arrival</button>
    <button type="button" data-testid="pan-to-dungeon" onClick={() => onPositionChange?.(fixture.entrance.xM, fixture.entrance.zM)}>Pan camera</button>
    <button type="button" data-testid="stop-at-wall" onClick={() => { onAvatarPositionChange?.({ xM: 30, zM: 40, yM: 0 }); onAvatarMovementBlocked?.({ xM: 30, zM: 40 }); }}>Blocked arrival</button></>
  ),
}));

vi.mock('../hooks/useWorld3DDiscovery', () => ({ useWorld3DDiscovery: () => ({ checkProximityDiscoveries: fixture.discoveries }) }));
vi.mock('../hooks/useInPlaceCombatTransition', () => ({ useInPlaceCombatTransition: () => ({ checkCombatTriggers: fixture.combat }) }));

// Expedition rendering is outside this prompt regression. Keeping a lightweight overlay avoids
// loading WebGL while preserving the wrapper's production render branch.
vi.mock('../DungeonExpeditionOverlay', () => ({
  default: ({ onReturn }: { onReturn: () => void }) => (
    <div data-testid="dungeon-expedition-overlay">
      {/* The production overlay's return control is represented semantically; WebGL remains out. */}
      {/* eslint-disable-next-line no-restricted-syntax */}
      <button type="button" data-testid="return-from-dungeon" onClick={onReturn}>
        Return from dungeon
      </button>
    </div>
  ),
}));

// These established chrome surfaces do not participate in doorway proximity and would otherwise
// add unrelated timers and layout behavior to this focused component contract.
vi.mock('../InWorldHUD', () => ({
  default: ({onFramePlayer}: {onFramePlayer?: () => void}) => <div data-testid="in-world-hud">
    <button type="button" data-testid="frame-player" disabled={!onFramePlayer} onClick={onFramePlayer}>To Player</button>
  </div>,
}));
vi.mock('../LocaleMovePane', () => ({
  default: () => <div data-testid="locale-move-pane" />,
}));
vi.mock('../WorldGenLoadingScreen', () => ({
  default: () => <div data-testid="world-gen-loading" />,
}));

// The ground loader is intentionally tiny but follows the disposable callable contract owned by
// the wrapper, allowing setup and cleanup to execute normally.
vi.mock('../createGroundWorkerChunkLoader', () => ({
  createGroundWorkerChunkLoader: () => {
    const loader = vi.fn(async () => ({
      cx: 0,
      cy: 0,
      terrain: {
        positions: new Float32Array(0),
        indices: new Uint32Array(0),
        normals: new Float32Array(0),
        colors: new Float32Array(0),
      },
      sites: [],
    }));
    return Object.assign(loader, { dispose: vi.fn() });
  },
}));

// Deliver Stage A immediately through the production client's callback shape. This mounts the
// World3DScene contract with a real GroundWorld reference before the movement control is used.
vi.mock('../createWorldGenClient', () => ({
  createWorldGenClient: () => ({
    generate: (
      _request: unknown,
      callbacks: {
        onStageA: (payload: { ground: GroundWorld; region: undefined }) => void;
      },
    ) => {
      fixture.generate(_request);
      callbacks.onStageA({ ground: fixture.ground as unknown as GroundWorld, region: undefined });
    },
    dispose: fixture.dispose,
  }),
}));

// The fixture does not author shops, combatants, or terrain crops. These dynamic bridge exports are
// nevertheless present so the wrapper can complete the same module-loading handshake as production.
vi.mock('../../../systems/worldforge/bridge/legacySubmapBridge', () => ({
  getBurgNamer: () => () => 'Test Keeper',
  getBridgeAtlas: () => ({ pack: { burgs: [] } }),
}));
vi.mock('../../../systems/worldforge/bridge/groundChunkLoader', () => ({
  canonicalArtifactTownForSite: vi.fn(),
  createGroundChunkLoader: (...args: unknown[]) => {
    fixture.groundFactory(...args);
    return { ground: fixture.ground, loader: vi.fn() };
  },
  extractLocalTerrainPatch: vi.fn(),
  // This fixture is a flat surface; production uses the shared continuous sampler.
  groundSurfaceY: () => 0,
}));
vi.mock('../../../systems/worldforge/bridge/groundWorldAdapter', () => ({
  GROUND_METERS_PER_CELL: 1.524,
}));
vi.mock('../../../systems/worldforge/bridge/groundAgentMotion', () => ({
  allGroundAgentsAt: () => [],
}));

// No combat provider is exercised here. Returning inert unregister functions keeps the wrapper's
// provider lifecycle intact without touching shared combat state.
vi.mock('../../../systems/combat/fightInPlace/activeGroundCombatSession', () => ({
  prepareActiveGroundSettlementEncounter: vi.fn(),
  registerActiveGroundCombatProvider: () => vi.fn(),
  registerActiveGroundOpeningCombatProvider: () => vi.fn(),
}));

// The component still owns normal game-state dispatch. A static saved destination
// deliberately differs from the live footfall reported by the scene stand-in.
vi.mock('../../../state/GameContext', () => ({
  useGameState: () => ({
    dispatch: fixture.dispatch,
    state: {
      isDevModeEnabled: false,
      isBroadsheetVisible: fixture.isBroadsheetVisible,
      activeConversation: fixture.conversationOpen ? fixture.conversation : null,
      isDialogueInterfaceOpen: fixture.isDialogueInterfaceOpen,
      worldSeed: 42,
      playerCell: { cellId: fixture.cellId },
      playerGroundPos: null,
      discoveredHiddenSites: [],
      discoveryLog: fixture.discoveryLog,
      worldforgeEncounterReceipts: [],
      gameTime: fixture.gameTime,
      generatedNpcs: {},
      companions: {},
      worldBusinesses: fixture.worldBusinesses,
      party: [],
    },
  }),
}));

vi.mock('../../../hooks/useWorldViewMode', () => ({
  usePlayerWorldPos: () => ({
    setPosition: fixture.setPosition,
    position: null,
  }),
  useWorldViewMode: () => ({
    setMode: vi.fn(),
  }),
}));

// ============================================================================
// Click-Move Prompt Contract
// ============================================================================

describe('World3DWrapper dungeon entry prompt', () => {
  it('hands saved business names and depleted stock to the staged save-entry worker', async () => {
    const id = 'biz_burg_2_plot_60';
    fixture.worldBusinesses = { [id]: { id, name: 'The Grand Sanctum', stock: [{ itemId: 'ration', quantity: 0 }] } };
    const saved = JSON.stringify(fixture.worldBusinesses);
    const World3DWrapper = (await import('../World3DWrapper')).default;
    render(<World3DWrapper entryPosition={{x:0,y:0,z:0}} />);
    await waitFor(() => expect(fixture.generate).toHaveBeenCalledOnce());
    // A legacy save uses the worker path rather than retained Atlas entry.
    // Both paths must receive the same owned registry, without a new name or stock.
    expect(fixture.generate.mock.calls[0]?.[0]?.worldBusinesses).toBe(fixture.worldBusinesses);
    expect(JSON.stringify(fixture.worldBusinesses)).toBe(saved);
  });

  it('hands the saved business registry to native Atlas entry instead of generating a different inn name', async () => {
    const id = 'biz_burg_253_plot_1';
    fixture.worldBusinesses = { [id]: { id, name: 'The Gilded Consortium', stock: [{ itemId: 'ration', quantity: 3 }] } };
    const saved = JSON.stringify(fixture.worldBusinesses);
    const { buildAtlasGroundDrilldown } = await import('../../../systems/worldforge/leaf3d/atlasGroundDrilldown');
    const receipt = buildAtlasGroundDrilldown({ worldSeed: 42, atlasCellId: 751,
      region: { seedPath: '42/region:751' } as never,
      local: { seedPath: '42/region:751/local:100,200', bounds: { x: 100, y: 200, width: 3000, height: 3000 }, features: [{ id: 8, kind: 'poi', x: 201, y: 300, data: { name: 'Putivl — Gate 1' } }] } as never,
      focus: { kind: 'site', id: 8, label: 'Putivl — Gate 1', xFt: 201, yFt: 300 },
    });
    const World3DWrapper = (await import('../World3DWrapper')).default;
    render(<World3DWrapper entryPosition={{x:0,y:0,z:0}} atlasGroundDrilldown={receipt} />);
    await waitFor(() => expect(fixture.groundFactory).toHaveBeenCalledOnce());
    // The existing loader already gives saved names precedence. Entry must
    // supply that registry, retaining its stock and identity without migration.
    expect(fixture.groundFactory.mock.calls[0]?.[3]?.worldBusinesses).toBe(fixture.worldBusinesses);
    expect(JSON.stringify(fixture.worldBusinesses)).toBe(saved);
    expect(fixture.generate).not.toHaveBeenCalled();
  });

  it.each(['companion','household'])('gives %s conversation ownership of movement and returns walking only when it closes', async kind => {
    fixture.conversationOpen=kind==='companion';
    fixture.isDialogueInterfaceOpen=kind==='household';
    const World3DWrapper=(await import('../World3DWrapper')).default;
    const view=render(<World3DWrapper entryPosition={{x:0,y:0,z:0}} />);
    expect(await screen.findByTestId('move-player-to-dungeon')).toBeDisabled();
    fixture.conversationOpen=false;
    fixture.isDialogueInterfaceOpen=false;
    view.rerender(<World3DWrapper entryPosition={{x:0,y:0,z:0}} />);
    await waitFor(()=>expect(screen.getByTestId('move-player-to-dungeon')).toBeEnabled());
  });
  it('blocks the retained walking callback while reading and restores it on close', async () => {
    fixture.isBroadsheetVisible=true;
    const World3DWrapper=(await import('../World3DWrapper')).default;
    const view=render(<World3DWrapper entryPosition={{x:0,y:0,z:0}} />);
    expect(await screen.findByTestId('move-player-to-dungeon')).toBeDisabled();
    fixture.isBroadsheetVisible=false;
    view.rerender(<World3DWrapper entryPosition={{x:0,y:0,z:0}} />);
    await waitFor(()=>expect(screen.getByTestId('move-player-to-dungeon')).toBeEnabled());
  });
  it.each([42, 99])('names an arrived doorway only from firsthand discovery in world %s', async (world) => {
    fixture.discoveryLog = [{source:{type:'LOCATION',id:`world:${world}:cell:751:site:${fixture.entrance.id}`,name:'Temple of the Morning: Undercroft'}}];
    const World3DWrapper = (await import('../World3DWrapper')).default;
    render(<World3DWrapper entryPosition={{x:0,y:0,z:0}} />);
    fireEvent.click(await screen.findByTestId('move-player-to-dungeon'));
    fireEvent.click(screen.getByTestId('arrive-at-dungeon'));
    const prompt=await screen.findByTestId('dungeon-entry-prompt');
    if(world===42)expect(prompt).toHaveTextContent('Temple of the Morning: Undercroft');
    else {expect(prompt).toHaveTextContent('Dungeon Entrance');expect(prompt).not.toHaveTextContent('Temple of the Morning');}
  });
  beforeEach(() => {
    fixture.dispatch.mockClear();
    fixture.groundFactory.mockClear();
    fixture.worldBusinesses = {};
    fixture.generate.mockClear();
    fixture.dispose.mockClear();
    fixture.discoveries.mockClear();
    fixture.combat.mockClear();
    fixture.gameTime = new Date('2026-07-19T12:00:00.000Z');
    fixture.isBroadsheetVisible = false;
    fixture.conversationOpen = false;
    fixture.isDialogueInterfaceOpen = false;
    fixture.cellId = 751;
    fixture.discoveryLog = [];
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('requests camera return without changing body position, time or dungeon discovery', async () => {
    const World3DWrapper = (await import('../World3DWrapper')).default;
    render(<World3DWrapper entryPosition={{x: 0, y: 0, z: 0}} />);
    await waitFor(() => expect(screen.getByTestId('frame-player')).toBeEnabled());
    const prior = fixture.dispatch.mock.calls.length;
    fireEvent.click(screen.getByTestId('frame-player'));
    expect(screen.getByTestId('camera-player-request')).toHaveAttribute('data-nonce', '1');
    fireEvent.click(screen.getByTestId('pan-to-dungeon'));
    const actions = fixture.dispatch.mock.calls.slice(prior).map(([action]) => action.type);
    expect(actions).not.toContain('SET_PLAYER_GROUND_POS');
    expect(actions).not.toContain('ADVANCE_TIME');
    expect(screen.queryByTestId('dungeon-entry-prompt')).not.toBeInTheDocument();
    expect(fixture.discoveries).not.toHaveBeenCalled();
  });

  it('corrects a blocked destination to actual arrival and removes the distant entry prompt', async () => {
    const World3DWrapper = (await import('../World3DWrapper')).default;
    render(<World3DWrapper entryPosition={{ x: 0, y: 0, z: 0 }} />);
    fireEvent.click(await screen.findByTestId('move-player-to-dungeon'));
    expect(screen.queryByTestId('dungeon-entry-prompt')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('arrive-at-dungeon'));
    expect(await screen.findByTestId('dungeon-entry-prompt')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('stop-at-wall'));
    expect(screen.queryByTestId('dungeon-entry-prompt')).not.toBeInTheDocument();
    expect(fixture.dispatch).toHaveBeenLastCalledWith({ type: 'SET_PLAYER_GROUND_POS', payload: {
      position: { tileX: 751, tileY: 0, xM: 30, zM: 40 },
    } });
  });

  it('keeps the loaded town through clock ticks and same-cell updates, but rebuilds for a different cell', async () => {
    const World3DWrapper = (await import('../World3DWrapper')).default;
    const view = render(<World3DWrapper entryPosition={{ x: 0, y: 0, z: 0 }} />);
    await screen.findByTestId('move-player-to-dungeon');
    expect(fixture.generate).toHaveBeenCalledTimes(1);

    fixture.gameTime = new Date('2026-07-19T12:01:00.000Z');
    view.rerender(<World3DWrapper entryPosition={{ x: 12, y: 0, z: 8 }} />);
    expect(fixture.generate).toHaveBeenCalledTimes(1);
    expect(fixture.dispose).not.toHaveBeenCalled();

    fixture.cellId = 752;
    view.rerender(<World3DWrapper entryPosition={{ x: 12, y: 0, z: 8 }} />);
    await waitFor(() => expect(fixture.generate).toHaveBeenCalledTimes(2));
    expect(fixture.dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps exploration at the actual far-side body when the camera pans to a dungeon', async () => {
    const World3DWrapper = (await import('../World3DWrapper')).default;
    render(<World3DWrapper entryPosition={{ x: 0, y: 0, z: 0 }} />);
    fireEvent.click(await screen.findByTestId('stop-at-wall'));
    fireEvent.click(screen.getByTestId('pan-to-dungeon'));
    expect(screen.queryByTestId('dungeon-entry-prompt')).not.toBeInTheDocument();
    expect(fixture.discoveries).toHaveBeenLastCalledWith(30, 40, 30, 40, 0);
    expect(fixture.combat).toHaveBeenLastCalledWith(30, 40, { x: 751, y: 0 });
  });

  it(
    'offers entry and exploration only after actual avatar arrival, preserving exact dungeon return',
    async () => {
      const World3DWrapper = (await import('../World3DWrapper')).default;
      render(<World3DWrapper entryPosition={{ x: 0, y: 0, z: 0 }} />);

      // Wait for the staged GroundWorld to mount the scene contract, then confirm the prompt does not
      // exist before movement. This is the supervisor's original failing state.
      const moveControl = await screen.findByTestId('move-player-to-dungeon');
      expect(screen.queryByTestId('dungeon-entry-prompt')).not.toBeInTheDocument();

      // A raycast destination and a camera pan are not arrival. The moving body
      // reports its own reached doorway before discovery or entry is offered.
      fireEvent.click(moveControl);
      fireEvent.click(screen.getByTestId('pan-to-dungeon'));
      expect(screen.queryByTestId('dungeon-entry-prompt')).not.toBeInTheDocument();
      expect(fixture.discoveries).not.toHaveBeenCalled();
      expect(fixture.combat).not.toHaveBeenCalled();
      expect(fixture.dispatch.mock.calls.some(([action]) => action.type === 'SET_PLAYER_GROUND_POS')).toBe(false);
      fireEvent.click(screen.getByTestId('arrive-at-dungeon'));

      await waitFor(() => {
        expect(screen.getByTestId('dungeon-entry-prompt')).toBeInTheDocument();
        expect(screen.getByTestId('enter-dungeon')).toHaveTextContent('Enter Dungeon');
      });
      expect(fixture.dispatch).toHaveBeenCalledWith({
        type: 'SET_PLAYER_GROUND_POS',
        payload: {
          position: {
            tileX: 751,
            tileY: 0,
            xM: fixture.entrance.xM - 0.25,
            yM: 0,
            zM: fixture.entrance.zM,
          },
        },
      });

      expect(fixture.discoveries).toHaveBeenCalledWith(fixture.entrance.xM - 0.25, fixture.entrance.zM, fixture.entrance.xM - 0.25, fixture.entrance.zM, 0);
      expect(fixture.combat).toHaveBeenCalledWith(fixture.entrance.xM - 0.25, fixture.entrance.zM, { x: 751, y: 0 });

      // Entry dispatches the exact receipt returned by the validated runtime boundary. The local
      // overlay may render the generated plan, but durable state remains in the shared reducer.
      fireEvent.click(screen.getByTestId('enter-dungeon'));
      expect(fixture.dispatch).toHaveBeenCalledWith({
        type: 'DUNGEON_ENTERED',
        payload: {
          identity: {
            dungeonId: fixture.entrance.id,
            seedPath: fixture.entrance.sitePath,
          },
        },
      });
      expect(screen.getByTestId('dungeon-expedition-overlay')).toBeInTheDocument();
      expect(screen.getByTestId('move-player-to-dungeon')).toBeDisabled();
      expect(screen.getByTestId('scene-suspension')).toHaveAttribute('data-suspended', 'true');
      expect(screen.queryByTestId('frame-player')).not.toBeInTheDocument();
      const bodyWrites = fixture.dispatch.mock.calls.filter(([action]) => action.type === 'SET_PLAYER_GROUND_POS').length;
      fireEvent.click(screen.getByTestId('stop-at-wall'));
      expect(fixture.dispatch.mock.calls.filter(([action]) => action.type === 'SET_PLAYER_GROUND_POS')).toHaveLength(bodyWrites);

      // Returning records retreat and restores the exact saved GroundWorld anchor. No completion
      // action is emitted because current mounted gameplay has no authoritative completion rule.
      fireEvent.click(screen.getByTestId('return-from-dungeon'));
      expect(fixture.dispatch).toHaveBeenCalledWith({ type: 'SET_PLAYER_GROUND_POS', payload: { position: {
        tileX: 751, tileY: 0, xM: fixture.entrance.xM - 0.25, zM: fixture.entrance.zM, yM: 0,
      } } });
      expect(fixture.dispatch).toHaveBeenCalledWith({
        type: 'DUNGEON_RETREATED',
        payload: { dungeonId: fixture.entrance.id },
      });
      expect(screen.queryByTestId('dungeon-expedition-overlay')).not.toBeInTheDocument();
      expect(screen.getByTestId('move-player-to-dungeon')).toBeEnabled();
      expect(screen.getByTestId('scene-suspension')).toHaveAttribute('data-suspended', 'false');
      expect(screen.getByTestId('frame-player')).toBeInTheDocument();
    },
    30_000,
  );
  it('offers the ordinary save menu through the existing parent action authority', async () => {
    const World3DWrapper = (await import('../World3DWrapper')).default;
    const onAction = vi.fn();
    render(<World3DWrapper entryPosition={{x:0,y:0,z:0}} onAction={onAction} />);
    const menu = await screen.findByTestId('world-system-menu');
    // The bar now starts with "Adventure log"; open the system menu's own trigger.
    fireEvent.click(menu.querySelector('button[aria-haspopup="menu"]')!);
    fireEvent.click(await screen.findByText('Save Game', {exact:true}));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({type:'save_game'}));
  });

});
