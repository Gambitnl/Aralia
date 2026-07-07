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
import React, { useEffect, useRef } from 'react';
import type { BattleMapData, LightLevel } from '../../types/combat';
import { buildFogAlphaGrid, FOG_TINT } from './fogModel';

interface BattleMapFogCanvasProps {
  mapData: BattleMapData;
  tileSize: number;
  visibleTiles: Set<string>;
  getLightLevel: (tileId: string) => LightLevel;
  className?: string;
}

export const BattleMapFogCanvas: React.FC<BattleMapFogCanvasProps> = ({ mapData, tileSize, visibleTiles, getLightLevel, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = mapData.dimensions.width;
    const H = mapData.dimensions.height;
    const px = W * tileSize;
    const py = H * tileSize;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(px * dpr);
    canvas.height = Math.round(py * dpr);
    canvas.style.width = `${px}px`;
    canvas.style.height = `${py}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1px-per-tile fog raster.
    const mini = document.createElement('canvas');
    mini.width = W;
    mini.height = H;
    const mctx = mini.getContext('2d');
    if (!mctx) return;
    const grid = buildFogAlphaGrid(mapData, visibleTiles, getLightLevel);
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const alpha = grid.alphas[y * grid.width + x];
        if (alpha <= 0) continue;
        mctx.fillStyle = `rgba(${FOG_TINT.r},${FOG_TINT.g},${FOG_TINT.b},${alpha})`;
        mctx.fillRect(x, y, 1, 1);
      }
    }

    // Upscale with smoothing: bilinear interpolation IS the feathering.
    ctx.clearRect(0, 0, px, py);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mini, 0, 0, W, H, 0, 0, px, py);
  }, [mapData, tileSize, visibleTiles, getLightLevel]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

export default BattleMapFogCanvas;
