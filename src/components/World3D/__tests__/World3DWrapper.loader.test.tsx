/**
 * @file World3DWrapper.loader.test.tsx
 * Guards W3DUI-1: PLAYING uses createWorkerChunkLoader (not inline handleChunkRequest).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ChunkLoader } from '@/systems/world3d/types';
import type { WorldData } from '@/services/worldSim/types';

const mockCreateWorkerChunkLoader = vi.fn(
  (_world: WorldData): ChunkLoader => async (cx, cy) => ({
    cx,
    cy,
    terrain: { positions: new Float32Array(0), indices: new Uint32Array(0) },
    sites: [],
  }),
);

vi.mock('../createWorkerChunkLoader', () => ({
  createWorkerChunkLoader: (...args: unknown[]) => mockCreateWorkerChunkLoader(...args),
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

  it('builds a worker-backed loader when worldData is present', async () => {
    const World3DWrapper = (await import('../World3DWrapper')).default;
    const world = flatWorld();

    render(
      <World3DWrapper
        entryPosition={{ x: 0, y: 0, z: 0 }}
        worldData={world}
      />,
    );

    expect(mockCreateWorkerChunkLoader).toHaveBeenCalledTimes(1);
    expect(mockCreateWorkerChunkLoader).toHaveBeenCalledWith(
      world,
      expect.any(Number),
      expect.any(Function),
    );
  });

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
