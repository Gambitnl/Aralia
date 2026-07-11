// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/07/2026, 00:32:52
 * Dependents: components/BattleMap/BattleMapGroundCanvas.tsx, components/BattleMap/pixi/PixiBattleBoard.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file groundPainter.ts
 * Shared painted-style ground renderer for the 2D battle map.
 *
 * The reference battle-map look is an illustrated forest, not flat colored
 * tiles. Without a bespoke map illustration (and with the image-gen backend
 * down), this draws a naturalistic ground procedurally onto a 2D canvas
 * context: real grass/dirt textures (already shipped for the 3D ez-tree lab)
 * tiled with per-cell variation, procedural water, and hand-drawn top-down
 * trees and rocks, finished with a vignette and dappled light.
 *
 * The drawing code lives here so both the DOM <canvas> renderer
 * (BattleMapGroundCanvas) and the PixiJS prototype paint the exact same art.
 * It is deterministic per map: a small seeded RNG keyed off tile coordinates
 * keeps texture jitter and foliage placement stable across redraws.
 */

// This entry file is now a thin facade (move-only split, W1-P7): the
// implementation moved into ./groundPainter/{textures,props,paintPipeline}.
// The public API re-exported below is unchanged, so BattleMapGroundCanvas and
// the PixiJS board keep importing from './groundPainter' exactly as before.
export { COMBAT_BIOMES, terrainToGround, loadGroundTextures } from './groundPainter/textures';
export type { Ground, CombatBiome, GroundTextures } from './groundPainter/textures';
export { paintGround } from './groundPainter/paintPipeline';
export type { PaintGroundOptions } from './groundPainter/paintPipeline';
