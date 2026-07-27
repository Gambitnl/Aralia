/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:33:33
 * Dependents: VoxelTerrain.tsx, voxelMesher.worker.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
export declare class SimplexNoise {
    constructor(seed?: number);
    seed(seed: number): void;
    noise3D(xin: number, yin: number, zin: number): number;
}
