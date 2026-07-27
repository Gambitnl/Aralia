/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 10:30:12
 * Dependents: components/BattleMap/terrain/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file GridOverlay.tsx
 * Transparent grid overlay that appears on the terrain during movement mode.
 *
 * Uses a custom ShaderMaterial with world-space UV calculations to draw:
 * - Faint grid lines at tile boundaries
 * - Green/blue fill on valid move tiles (30% opacity)
 * - Bright highlight on active path tiles
 * - Darkened fill on tiles that block movement
 *
 * The overlay fades in/out with a 200ms transition when actionMode changes.
 *
 * Research references:
 * - World-space grid shader: https://threejs-journey.com/lessons/shader-patterns
 * - GLSL mod() for repeating patterns: standard technique
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Grid Overlay" section
 */
import React from 'react';
import { BattleMapData } from '../../../types/combat';
interface GridOverlayProps {
    mapData: BattleMapData;
    validMoves: Set<string>;
    activePath: {
        id: string;
    }[];
    actionMode: 'move' | 'ability' | null;
}
declare const GridOverlay: React.FC<GridOverlayProps>;
export default GridOverlay;
