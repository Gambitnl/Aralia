/**
 * @file BattleMapFogCanvas.tsx
 * Soft fog-of-war / lighting layer for the 2D battle map.
 *
 * The previous approach rendered visibility as flat black divs per tile, which
 * staircased exactly on grid lines and read as a spreadsheet mask instead of
 * light. This draws the same per-tile visibility data at ONE PIXEL PER TILE
 * into a tiny offscreen canvas, then upscales it with bilinear smoothing onto
 * the display canvas — the interpolation feathers every light boundary half a
 * tile in each direction, so lit areas read as pools of light with organic
 * edges while still being exactly the referee's visibility data underneath.
 */
import React from 'react';
import type { BattleMapData, LightLevel } from '../../types/combat';
interface BattleMapFogCanvasProps {
    mapData: BattleMapData;
    tileSize: number;
    visibleTiles: Set<string>;
    getLightLevel: (tileId: string) => LightLevel;
    className?: string;
}
export declare const BattleMapFogCanvas: React.FC<BattleMapFogCanvasProps>;
export default BattleMapFogCanvas;
