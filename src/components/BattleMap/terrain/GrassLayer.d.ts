/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 10:29:54
 * Dependents: components/BattleMap/terrain/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file GrassLayer.tsx
 * Instanced grass blades scattered across grass-type tiles with GPU wind animation.
 *
 * Uses InstancedMesh with a custom vertex shader for wind sway. Each grass blade
 * is a thin triangle strip; per-instance attributes control position, rotation,
 * scale, and color tint. Wind uses a combination of sin() primary wave and
 * smooth noise for organic secondary motion.
 *
 * Performance strategy (from research):
 * - InstancedMesh: single draw call for all blades
 * - Chunked into 16-tile groups for frustum culling
 * - Billboard rotation not needed (blades are 3D geometry viewed from above)
 * - ~60-80 blades per grass tile → ~36,000-48,000 total for a 30×20 map (~600 grass tiles)
 *
 * Research references:
 * - Instanced grass with GLSL wind: https://github.com/Nitash-Biswas/grass-shader-glsl
 * - Codrops fluffy grass: https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/
 * - Three.js forum instanced grass: https://discourse.threejs.org/t/simple-instanced-grass-example/26694
 * - al-ro grass instancing: https://al-ro.github.io/projects/grass/
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Vegetation Layer" section
 */
import React from 'react';
import { BattleMapData } from '../../../types/combat';
interface GrassLayerProps {
    mapData: BattleMapData;
}
declare const GrassLayer: React.FC<GrassLayerProps>;
export default GrassLayer;
