/**
 * @file BattleMapGroundCanvas.tsx
 * Painted-style ground layer for the 2D battle map.
 *
 * The reference battle-map look is an illustrated forest, not flat colored
 * tiles. Without a bespoke map illustration (and with the image-gen backend
 * down), this draws a naturalistic ground procedurally onto a <canvas>: real
 * grass/dirt textures (already shipped for the 3D ez-tree lab) tiled with
 * per-cell variation, procedural water, and hand-drawn top-down trees and rocks,
 * finished with a vignette and dappled light. The interactive tile grid, tokens,
 * and overlays render ON TOP of this canvas — the tiles are translucent so this
 * ground reads as the battlefield.
 *
 * The drawing itself lives in the shared groundPainter module so the PixiJS
 * prototype paints the exact same art. This component owns only the DOM canvas
 * lifecycle: sizing the backing store, the supersample/budget resolution, and
 * kicking off a repaint when the map changes.
 */
import React from 'react';
import type { BattleMapData } from '../../types/combat';
interface BattleMapGroundCanvasProps {
    mapData: BattleMapData;
    tileSize: number;
    className?: string;
    showDecorations?: boolean;
}
export declare const BattleMapGroundCanvas: React.FC<BattleMapGroundCanvasProps>;
export default BattleMapGroundCanvas;
