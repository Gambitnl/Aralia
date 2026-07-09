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
import React, { useEffect, useRef } from 'react';
import type { BattleMapData } from '../../types/combat';
import { loadGroundTextures, paintGround } from './groundPainter';

interface BattleMapGroundCanvasProps {
  mapData: BattleMapData;
  tileSize: number;
  className?: string;
  showDecorations?: boolean;
}

export const BattleMapGroundCanvas: React.FC<BattleMapGroundCanvasProps> = ({
  mapData,
  tileSize,
  className,
  showDecorations = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = mapData.dimensions.width;
    const H = mapData.dimensions.height;
    const px = W * tileSize;
    const py = H * tileSize;
    // Author the backing store above CSS resolution (device pixels + a 2×
    // supersample) so zooming reveals real detail instead of bilinear mush.
    // Capped by total pixel budget so huge procedural maps don't blow memory.
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const budgetRes = Math.sqrt(24_000_000 / Math.max(1, px * py));
    const res = Math.max(1, Math.min(Math.max(dpr, 1) * 2, 3, budgetRes));
    canvas.width = Math.round(px * res);
    canvas.height = Math.round(py * res);
    canvas.style.width = `${px}px`;
    canvas.style.height = `${py}px`;
    ctx.setTransform(res, 0, 0, res, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    loadGroundTextures(mapData.theme).then((textures) => {
      if (cancelled) return;
      // The asset overlay toggle hides decorative props without touching the
      // base terrain or the map data that describes those props.
      paintGround(ctx, mapData, tileSize, textures, res, { showDecorations });
    });

    return () => { cancelled = true; };
  }, [mapData, tileSize, showDecorations]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

export default BattleMapGroundCanvas;
