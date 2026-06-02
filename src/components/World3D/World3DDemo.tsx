/**
 * @file World3DDemo.tsx
 * @description Self-contained host for the streamed 3D world. Generates a full world via the
 * real generation pipeline (`generateMap` → `WorldData` v2) and feeds World3DScene an inline
 * (main-thread) chunk loader.
 *
 * Why this is built this way:
 * - Using the real `generateMap` pipeline (instead of a synthetic all-`plains` heightmap) means
 *   the demo showcases the *actual* implemented content: varied biomes, flow-traced rivers,
 *   the MST road graph, and placed towns/dungeons/ruins — the same data the live atlas + 3D
 *   world consume. (Resolves gap W3D-G8 / task T4.)
 * - The inline loader keeps the sandbox runnable without the Web Worker pool (worker-backed
 *   loading is tracked separately as W3D-G1).
 * - The camera spawns on the first generated town so content (town exterior + roads + nearby
 *   rivers/biomes) is visible immediately, rather than risking an open-ocean spawn at the
 *   geometric center.
 */

import React, { useMemo } from 'react';
import World3DScene from './World3DScene';
import { generateMap } from '@/services/mapService';
import { BIOMES } from '@/constants';
import { handleChunkRequest } from '@/systems/world3d/chunkWorkerCore';
import { WORLD3D_CONFIG, heightToMeters } from '@/systems/world3d/config';
import type { ChunkLoader } from '@/systems/world3d/types';

const DEMO_COLS = 60;
const DEMO_ROWS = 40;
const DEMO_SEED = 2026;

const World3DDemo: React.FC = () => {
  const { loader, start, startSurfaceY } = useMemo(() => {
    // Run the real world-generation pipeline so the demo renders authentic rivers, roads,
    // towns, and varied biomes rather than a uniform-plains placeholder.
    const map = generateMap(DEMO_ROWS, DEMO_COLS, {}, BIOMES, DEMO_SEED);
    const world = map.worldData;
    if (!world) {
      throw new Error('World3DDemo: generateMap did not produce worldData (v2). Check the worldSim pipeline.');
    }

    const inlineLoader: ChunkLoader = async (cx, cy) =>
      handleChunkRequest(world, { cx, cy, resolution: WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION });

    // Spawn on the first generated town (grid coords → meters) so content is visible on mount;
    // fall back to the world's geometric center if no town was placed.
    const firstTown = world.sites.find((s) => s.kind === 'town');
    const startGridX = firstTown ? firstTown.position.x : DEMO_COLS / 2;
    const startGridY = firstTown ? firstTown.position.y : DEMO_ROWS / 2;
    const startX = startGridX * WORLD3D_CONFIG.METERS_PER_CELL;
    const startZ = startGridY * WORLD3D_CONFIG.METERS_PER_CELL;

    // Terrain is now vertically exaggerated, so the spawn surface can sit hundreds of meters up.
    // Read the spawn cell's height from WorldData and convert it (via the same exaggerated mapping
    // the geometry builders use) so the scene can frame the camera on the actual ground, not Y=0.
    const { cols, rows } = world.gridSize;
    const cellX = Math.max(0, Math.min(cols - 1, Math.round(startGridX)));
    const cellY = Math.max(0, Math.min(rows - 1, Math.round(startGridY)));
    const startSurfaceY = heightToMeters(world.heights[cellY * cols + cellX] ?? 0);

    return { loader: inlineLoader, start: [startX, 0, startZ] as const, startSurfaceY };
  }, []);

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', height: '100%' }}>
      <h1 style={{ margin: 0, fontSize: '24px', fontFamily: 'Outfit, sans-serif', color: '#1a2a3a' }}>World 3D Chunk Streaming Sandbox</h1>
      <p style={{ margin: 0, fontSize: '14px', color: '#4a5a6a' }}>
        Right-click and drag to pan the camera across the landscape. Chunks will stream in and out in real time!
      </p>
      <World3DScene loader={loader} start={start} startSurfaceY={startSurfaceY} />
    </div>
  );
};

export default World3DDemo;
