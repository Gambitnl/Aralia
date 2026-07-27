/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 13:10:19
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file GrassLayer.tsx
 * @description Near-camera instanced grass for the streamed 3D world
 * (beautification wave vegetation lift). Cheap crossed-quad clusters,
 * biome-tinted from the terrain vertex colors, deterministic per chunk.
 * Distance falloff: only chunks within GRASS_CHUNK_RADIUS (Chebyshev) of the
 * anchor chunk mount a grass mesh at all; far terrain keeps its painted color.
 * Standard materials only — WebGL and WebGPU compatible (no TSL).
 */
import React from 'react';
import type { LoadedChunk } from '@/systems/world3d/types';
/** Chunks within this Chebyshev radius of the player's chunk grow grass. */
export declare const GRASS_CHUNK_RADIUS = 1;
export declare const GrassLayer: React.FC<{
    chunk: LoadedChunk;
    anchor: {
        cx: number;
        cy: number;
    };
    position: [number, number, number];
}>;
