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

const flatWorld = (): WorldData => ({
  version: 2,
  seed: 1,
  templateId: 't',
  gridSize: { rows: 4, cols: 4 },
  heights: new Array(16).fill(10),
  temperatures: [],
  moisture: [],
  biomeIds: [],
  rivers: [],
  roads: [],
  sites: [],
  coastlines: [],
  lakes: [],
  biomeZones: [],
});

describe('World3DWrapper chunk loader (W3DUI-1)', () => {
  beforeEach(() => {
    mockCreateWorkerChunkLoader.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('no-fallback: ground mode with no resolvable tile does NOT substitute the legacy worker loader', async () => {
    const World3DWrapper = (await import('../World3DWrapper')).default;
    const world = flatWorld();

    render(
      <World3DWrapper
        entryPosition={{ x: 0, y: 0, z: 0 }}
        worldData={world}
      />,
    );

    // Ground mode is the default since 2026-06-12. No-fallback directive
    // (2026-06-15, WF-G6): a Worldforge ground entry that can't resolve a tile
    // (mocked empty state) surfaces nothing rather than silently substituting
    // the legacy continent worker loader. Give the dynamic bridge imports +
    // async effect time to settle, then prove the legacy loader stayed unused.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(mockCreateWorkerChunkLoader).not.toHaveBeenCalled();
  }, 30000);

  it('does not create a loader when worldData is null', async () => {
    const World3DWrapper = (await import('../World3DWrapper')).default;

    render(
      <World3DWrapper
        entryPosition={{ x: 0, y: 0, z: 0 }}
        worldData={null}
      />,
    );

    expect(mockCreateWorkerChunkLoader).not.toHaveBeenCalled();
  });
});
