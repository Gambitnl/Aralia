/**
 * @file World3DDemo.tsx
 * @description Self-contained host for the streamed 3D world. Generates a deterministic world
 * via runWorldSim and feeds World3DScene an inline (main-thread) chunk loader.
 *
 * Why this is built this way:
 * - Direct inline loader integration allows us to test and preview the full 3D chunk streaming
 *   behavior in a sandbox demo without needing real background Web Worker thread support,
 *   which is perfect for isolated UI prototyping and local runs.
 * - Center camera placement at the grid midpoint `[midX, 0, midZ]` positions exploration inside
 *   procedural landmasses immediately upon mount.
 */

import React, { useMemo } from 'react';
import World3DScene from './World3DScene';
import { runWorldSim } from '@/services/worldSim';
import { handleChunkRequest } from '@/systems/world3d/chunkWorkerCore';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import type { ChunkLoader } from '@/systems/world3d/types';

const DEMO_COLS = 60;
const DEMO_ROWS = 40;
const DEMO_SEED = 2026;

const World3DDemo: React.FC = () => {
  const { loader, start } = useMemo(() => {
    const cells = DEMO_COLS * DEMO_ROWS;
    const heights: number[] = [];
    for (let i = 0; i < cells; i++) {
      const v = Math.sin(i * 0.13) * 30 + Math.cos(i * 0.21) * 20 + 40;
      heights.push(Math.max(0, Math.min(100, Math.round(v))));
    }
    const world = runWorldSim({
      seed: DEMO_SEED,
      templateId: 'continents',
      cols: DEMO_COLS,
      rows: DEMO_ROWS,
      heights,
      temperatures: new Array(cells).fill(15),
      moisture: new Array(cells).fill(25),
      biomeIds: new Array(cells).fill('plains'),
    });
    const inlineLoader: ChunkLoader = async (cx, cy) =>
      handleChunkRequest(world, { cx, cy, resolution: WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION });
    
    // Start the camera near the middle of the world (in meters)
    const midX = (DEMO_COLS / 2) * WORLD3D_CONFIG.METERS_PER_CELL;
    const midZ = (DEMO_ROWS / 2) * WORLD3D_CONFIG.METERS_PER_CELL;
    return { loader: inlineLoader, start: [midX, 0, midZ] as const };
  }, []);

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', height: '100%' }}>
      <h1 style={{ margin: 0, fontSize: '24px', fontFamily: 'Outfit, sans-serif', color: '#1a2a3a' }}>World 3D Chunk Streaming Sandbox</h1>
      <p style={{ margin: 0, fontSize: '14px', color: '#4a5a6a' }}>
        Right-click and drag to pan the camera across the landscape. Chunks will stream in and out in real time!
      </p>
      <World3DScene loader={loader} start={start} />
    </div>
  );
};

export default World3DDemo;
