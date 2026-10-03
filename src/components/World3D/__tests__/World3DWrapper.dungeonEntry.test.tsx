/**
 * This file proves that the mounted 3D world reacts to its real click-move contract.
 *
 * A small staged GroundWorld is delivered through the same world-generation client boundary used
 * by World3DWrapper. The scene stand-in then calls the wrapper's actual `onGroundPick` handler at a
 * doorway. This keeps the test focused on the integration seam that regressed: component movement
 * must refresh the player-facing prompt, not merely pass a pure distance-helper test.
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
  default: ({ onGroundPick }: { onGroundPick?: (xM: number, zM: number) => void }) => (
    // This is a test-only stand-in for the R3F ground plane, not player-facing application chrome;
    // a native control keeps the simulated scene boundary independent from the shared UI layer.
    // eslint-disable-next-line no-restricted-syntax
    <button
      type="button"
      data-testid="move-player-to-dungeon"
      onClick={() => onGroundPick?.(fixture.entrance.xM, fixture.entrance.zM)}
    >
      Move player to dungeon
    </button>
  ),
}));

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
  default: () => <div data-testid="in-world-hud" />,
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
    ) => callbacks.onStageA({ ground: fixture.ground as unknown as GroundWorld, region: undefined }),
    dispose: vi.fn(),
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
  extractLocalTerrainPatch: vi.fn(),
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

// The component still owns its normal game-state dispatch. A static movement position is enough
// because this regression is the immediate prompt refresh performed by the click handler itself.
vi.mock('../../../state/GameContext', () => ({
  useGameState: () => ({
    dispatch: fixture.dispatch,
    state: {
      isDevModeEnabled: false,
      worldSeed: 42,
      playerCell: { cellId: 751 },
      playerGroundPos: null,
      discoveredHiddenSites: [],
      worldforgeEncounterReceipts: [],
      gameTime: new Date('2026-07-19T12:00:00.000Z'),
      generatedNpcs: {},
      worldBusinesses: {},
      party: [],
    },
  }),
}));

vi.mock('../../../hooks/useWorldViewMode', () => ({
  usePlayerWorldPos: () => ({
    setPosition: vi.fn(),
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
  beforeEach(() => {
    fixture.dispatch.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it(
    'shows Enter Dungeon when the real scene move handler reaches the doorway',
    async () => {
      const World3DWrapper = (await import('../World3DWrapper')).default;
      render(<World3DWrapper entryPosition={{ x: 0, y: 0, z: 0 }} />);

      // Wait for the staged GroundWorld to mount the scene contract, then confirm the prompt does not
      // exist before movement. This is the supervisor's original failing state.
      const moveControl = await screen.findByTestId('move-player-to-dungeon');
      expect(screen.queryByTestId('dungeon-entry-prompt')).not.toBeInTheDocument();

      // Drive the exact callback World3DScene's ground raycast and __wf3dMoveTo hook use. The wrapper
      // must refresh proximity immediately instead of waiting for an unrelated camera callback.
      fireEvent.click(moveControl);

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
            xM: fixture.entrance.xM,
            zM: fixture.entrance.zM,
          },
        },
      });

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

      // Returning records retreat and restores the exact saved GroundWorld anchor. No completion
      // action is emitted because current mounted gameplay has no authoritative completion rule.
      fireEvent.click(screen.getByTestId('return-from-dungeon'));
      expect(fixture.dispatch).toHaveBeenCalledWith({
        type: 'DUNGEON_RETREATED',
        payload: { dungeonId: fixture.entrance.id },
      });
      expect(screen.queryByTestId('dungeon-expedition-overlay')).not.toBeInTheDocument();
    },
    30_000,
  );
});
