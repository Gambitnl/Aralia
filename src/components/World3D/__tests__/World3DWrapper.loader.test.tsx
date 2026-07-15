/**
 * @file World3DWrapper.loader.test.tsx
 * Guards W3DUI-1: PLAYING uses createWorkerChunkLoader (not inline handleChunkRequest).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ChunkLoader } from '@/systems/world3d/types';
import type { WorldData } from '@/services/worldSim/types';

const mockCreateWorkerChunkLoader = vi.fn(
  (_world: WorldData, _resolution?: number, _workerFactory?: () => Worker): ChunkLoader & { dispose: () => void } => {
    const base: ChunkLoader = async (cx, cy) => ({
      cx,
      cy,
      terrain: {
        positions: new Float32Array(0),
        indices: new Uint32Array(0),
        normals: new Float32Array(0),
        colors: new Float32Array(0),
      },
      sites: [],
    });
    // The wrapper now owns a disposable, self-healing loader and calls dispose() on cleanup.
    const loader = base as ChunkLoader & { dispose: () => void };
    loader.dispose = vi.fn();
    return loader;
  },
);

vi.mock('../createWorkerChunkLoader', () => ({
  createWorkerChunkLoader: (world: WorldData, resolution: number, workerFactory: () => Worker) =>
    mockCreateWorkerChunkLoader(world, resolution, workerFactory),
}));

vi.mock('../World3DScene', () => ({
  default: () => <div data-testid="world3d-scene" />,
}));

vi.mock('../InWorldHUD', () => ({
  default: () => <div data-testid="in-world-hud" />,
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

vi.mock('../../../state/GameContext', () => ({
  useGameState: () => ({
    dispatch: vi.fn(),
    state: { isDevModeEnabled: false },
  }),
}));

describe('World3DWrapper chunk loader (W3DUI-1)', () => {
  beforeEach(() => {
    mockCreateWorkerChunkLoader.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('no-fallback: ground mode with no resolvable tile does NOT substitute the legacy worker loader', async () => {
    const World3DWrapper = (await import('../World3DWrapper')).default;

    render(<World3DWrapper entryPosition={{ x: 0, y: 0, z: 0 }} />);

    // Ground mode is the default since 2026-06-12. No-fallback directive
    // (2026-06-15, WF-G6): a Worldforge ground entry that can't resolve a tile
    // (mocked empty state) surfaces nothing rather than silently substituting
    // the legacy continent worker loader. Give the dynamic bridge imports +
    // async effect time to settle, then prove the legacy loader stayed unused.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(mockCreateWorkerChunkLoader).not.toHaveBeenCalled();
  }, 30000);

  it('does not create the legacy worker loader (it was removed in grid retirement)', async () => {
    const World3DWrapper = (await import('../World3DWrapper')).default;

    render(<World3DWrapper entryPosition={{ x: 0, y: 0, z: 0 }} />);

    expect(mockCreateWorkerChunkLoader).not.toHaveBeenCalled();
  });

  it('compacts only non-empty building logs for the worker request', async () => {
    const { compactBuildingEventLogs } = await import('../World3DWrapper');
    const fire = {
      day: 9,
      kind: 'fire-damage' as const,
      payload: { incidentId: 'burg:4:day:9:fire', severity: 2 as const },
    };
    const source = [fire];
    const compact = compactBuildingEventLogs({
      8: { buildingEvents: {} },
      4: { buildingEvents: { 7: source, 2: [] } },
    } as never);

    expect(compact).toEqual({ 4: { 7: [fire] } });
    const copied = compact?.[4][7];
    expect(copied).not.toBe(source);
    expect(Array.isArray(copied)).toBe(true);
    if (!Array.isArray(copied)) throw new Error('expected legacy array copy');
    expect(copied[0]).not.toBe(fire);
  });

  it('preserves a versioned journal while deep-cloning the worker projection', async () => {
    const { compactBuildingEventLogs } = await import('../World3DWrapper');
    const { generateBuilding } = await import('../../../systems/worldforge/interior/generateBuilding');
    const { applyHistory, snapshotBuildingHistory, isBuildingHistoryJournal } =
      await import('../../../systems/worldforge/interior/buildingEventHistory');
    const { rootSeedPath } = await import('../../../systems/worldforge/seedPath');
    const fire = {
      day: 9,
      kind: 'fire-damage' as const,
      payload: { incidentId: 'burg:4:day:9:fire', severity: 2 as const },
    };
    const plan = generateBuilding({
      buildingId: 7,
      type: 'shop',
      seedPath: rootSeedPath(77),
      style: {
        cultureType: 'River',
        climate: 'temperate',
        wealth: 'common',
        ageBand: 'aged',
      },
    });
    const journal = snapshotBuildingHistory(applyHistory(plan, [fire]), [fire]);
    const compact = compactBuildingEventLogs({
      4: { buildingEvents: { 7: journal } },
    } as never);
    const copied = compact?.[4][7];

    expect(copied).toEqual(journal);
    expect(copied).not.toBe(journal);
    expect(isBuildingHistoryJournal(copied)).toBe(true);
    if (!isBuildingHistoryJournal(copied)) throw new Error('expected journal copy');
    expect(copied.snapshot).not.toBe(journal.snapshot);
    expect(copied.snapshot.history.features).not.toBe(journal.snapshot.history.features);
  });
});
