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
 * It is deterministic per map: a small seeded RNG keyed off tile coordinates
 * keeps texture jitter and foliage placement stable across redraws.
 */
import React, { useEffect, useRef } from 'react';
import type { BattleMapData } from '../../types/combat';

interface BattleMapGroundCanvasProps {
  mapData: BattleMapData;
  tileSize: number;
  className?: string;
}

const GRASS_SRC = `${import.meta.env.BASE_URL}assets/ez-tree-lab/grass.jpg`;
const DIRT_SRC = `${import.meta.env.BASE_URL}assets/ez-tree-lab/dirt_color.jpg`;

// Tiny deterministic hash → [0,1) so texture jitter and foliage are stable.
const rand = (x: number, y: number, salt: number): number => {
  const s = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

type Ground = 'grass' | 'dirt' | 'water' | 'stone' | 'sand';

const terrainToGround = (terrain: string): Ground => {
  switch (terrain) {
    case 'grass': return 'grass';
    case 'mud': return 'grass';
    case 'difficult': return 'grass';
    case 'water': return 'water';
    case 'wall': return 'stone';
    case 'rock':
    case 'stone':
    case 'floor': return 'dirt';
    case 'sand': return 'sand';
    default: return 'grass';
  }
};

// Module-level decode cache: redraws after the first load are synchronous, so
// remounts never flash a blank board while the JPGs re-decode.
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
const loadImage = (src: string): Promise<HTMLImageElement | null> => {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
};

// Top-down foliage clump: a soft shadow, then a scalloped layered canopy with
// a sunlit side, like the painted trees in the reference map.
const drawTree = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => {
  ctx.save();
  // Shadow, offset toward the lower-right (sun from the upper-left).
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.30, cy + r * 0.34, r * 0.95, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  // Scalloped canopy silhouette: lobes around the rim instead of a flat circle.
  const lobes = 7;
  const scallop = (radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2 + rand(seed, i, 31) * 0.5;
      const lr = radius * (0.82 + rand(seed, i, 32) * 0.3);
      ctx.arc(cx + Math.cos(a) * lr * 0.55, cy + Math.sin(a) * lr * 0.55, lr * 0.55, 0, Math.PI * 2);
    }
    ctx.fill();
  };
  ctx.fillStyle = '#2a4f2c';
  scallop(r);
  ctx.fillStyle = '#376339';
  scallop(r * 0.8);
  ctx.fillStyle = '#457a45';
  scallop(r * 0.58);
  // Sunlit crown on the upper-left.
  ctx.fillStyle = 'rgba(178,212,120,0.45)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.30, r * 0.32, 0, Math.PI * 2);
  ctx.arc(cx - r * 0.05, cy - r * 0.42, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  // A hint of trunk visible through the canopy center.
  ctx.fillStyle = 'rgba(60,42,26,0.55)';
  ctx.beginPath();
  ctx.arc(cx + r * 0.05, cy + r * 0.05, r * 0.10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Small understory bush: 2–3 dark leafy blobs with a sunlit tip.
const drawBush = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.2, cy + r * 0.25, r * 0.9, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const blobs = 2 + Math.floor(rand(seed, 0, 41) * 2);
  for (let i = 0; i < blobs; i++) {
    ctx.fillStyle = i === blobs - 1 ? '#3f6b38' : '#2f5230';
    ctx.beginPath();
    ctx.arc(cx + (rand(seed, i, 42) - 0.5) * r, cy + (rand(seed, i, 43) - 0.5) * r * 0.8, r * (0.55 - i * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(170,205,110,0.4)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// Fallen log: a rotated brown capsule with a lighter cut end.
const drawLog = (ctx: CanvasRenderingContext2D, cx: number, cy: number, len: number, seed: number) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rand(seed, 0, 51) * Math.PI);
  const w = len * 0.28;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(len * 0.05, w * 0.5, len * 0.6, w * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4c3623';
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.lineTo(len / 2, 0);
  ctx.stroke();
  // Bark highlight along the top edge.
  ctx.strokeStyle = 'rgba(140,105,70,0.5)';
  ctx.lineWidth = w * 0.35;
  ctx.beginPath();
  ctx.moveTo(-len * 0.42, -w * 0.2);
  ctx.lineTo(len * 0.42, -w * 0.2);
  ctx.stroke();
  // Cut end.
  ctx.fillStyle = '#a8845c';
  ctx.beginPath();
  ctx.arc(len / 2, 0, w * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,64,40,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(len / 2, 0, w * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

// Top-down boulder: irregular gray polygon with a shadow and a highlight.
const drawRock = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) => {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.2, cy + r * 0.28, r * 0.95, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b7280';
  ctx.beginPath();
  const pts = 7;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const rr = r * (0.7 + rand(seed, i, 3) * 0.35);
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr * 0.85;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(200,205,215,0.4)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.2, cy - r * 0.22, r * 0.4, r * 0.28, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const BattleMapGroundCanvas: React.FC<BattleMapGroundCanvasProps> = ({ mapData, tileSize, className }) => {
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

    const draw = (grass: HTMLImageElement | null, dirt: HTMLImageElement | null) => {
      if (cancelled) return;
      const grassPat = grass ? ctx.createPattern(grass, 'repeat') : null;
      const dirtPat = dirt ? ctx.createPattern(dirt, 'repeat') : null;

      // 1. Base grass everywhere (pattern, or a solid fallback).
      if (grassPat) {
        ctx.fillStyle = grassPat;
        ctx.fillRect(0, 0, px, py);
        // A light unifying wash — daylight forest floor, not a dim one.
        ctx.fillStyle = 'rgba(46,82,36,0.30)';
        ctx.fillRect(0, 0, px, py);
      } else {
        ctx.fillStyle = '#2c4a2c';
        ctx.fillRect(0, 0, px, py);
      }

      // 1b. Large soft grass patches — sunlit yellow-greens and shaded darks —
      // so the meadow reads as painted variation instead of one flat tone.
      const mapSeed = W * 31 + H * 17;
      const patchCount = Math.max(8, Math.floor((W * H) / 45));
      for (let i = 0; i < patchCount; i++) {
        const cxp = px * rand(i, mapSeed, 11);
        const cyp = py * rand(i, mapSeed, 12);
        const pr = tileSize * (2 + rand(i, mapSeed, 13) * 4);
        const sunny = rand(i, mapSeed, 14) > 0.45;
        const pg = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, pr);
        if (sunny) {
          pg.addColorStop(0, 'rgba(168,190,88,0.16)');
          pg.addColorStop(1, 'rgba(168,190,88,0)');
        } else {
          pg.addColorStop(0, 'rgba(12,34,18,0.20)');
          pg.addColorStop(1, 'rgba(12,34,18,0)');
        }
        ctx.fillStyle = pg;
        ctx.fillRect(cxp - pr, cyp - pr, pr * 2, pr * 2);
      }

      // 1c. Winding dirt path across the meadow. Drawn BEFORE the per-cell
      // overpaint so water/stone/dirt tiles paint over it where they overlap.
      if (dirtPat) {
        const pathY = (x: number) =>
          py * (0.5 +
            0.22 * Math.sin(x * 0.0035 + mapSeed) +
            0.10 * Math.sin(x * 0.009 + mapSeed * 1.7));
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const tracePath = () => {
          ctx.beginPath();
          for (let x = -tileSize; x <= px + tileSize; x += tileSize / 2) {
            const y = pathY(x);
            if (x <= -tileSize) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
        };
        // Soft dark edge under the path.
        tracePath();
        ctx.strokeStyle = 'rgba(40,30,18,0.35)';
        ctx.lineWidth = tileSize * 1.7;
        ctx.stroke();
        // Dirt body.
        tracePath();
        ctx.strokeStyle = dirtPat;
        ctx.lineWidth = tileSize * 1.25;
        ctx.stroke();
        // Warm sunlit tint on the dirt.
        tracePath();
        ctx.strokeStyle = 'rgba(150,116,70,0.30)';
        ctx.lineWidth = tileSize * 1.25;
        ctx.stroke();
        // Worn center line, lighter where feet travel.
        tracePath();
        ctx.strokeStyle = 'rgba(205,175,125,0.18)';
        ctx.lineWidth = tileSize * 0.45;
        ctx.stroke();
        // Scattered pebbles/speckles along the path edges.
        for (let i = 0; i < W * 2; i++) {
          const sx = px * rand(i, mapSeed, 21);
          const sy = pathY(sx) + (rand(i, mapSeed, 22) - 0.5) * tileSize * 1.3;
          const sr = 1 + rand(i, mapSeed, 23) * 2.5;
          ctx.fillStyle = rand(i, mapSeed, 24) > 0.5 ? 'rgba(90,70,45,0.5)' : 'rgba(170,150,115,0.4)';
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Ground lookup for neighbor checks (water banks need to know which
      // edges of a water tile touch land).
      const groundAt = new Map<string, Ground>();
      mapData.tiles.forEach((tile) => {
        groundAt.set(`${tile.coordinates.x},${tile.coordinates.y}`, terrainToGround(tile.terrain));
      });
      const isLand = (x: number, y: number) => {
        const g = groundAt.get(`${x},${y}`);
        return g !== undefined && g !== 'water';
      };

      // Water draws into its own layer so the whole sheet can be feathered
      // (slight blur) when composited — softening the hard tile-square edges
      // into shorelines without blurring grass, path, or foliage.
      const waterCanvas = document.createElement('canvas');
      waterCanvas.width = canvas.width;
      waterCanvas.height = canvas.height;
      const wctx = waterCanvas.getContext('2d');
      if (wctx) wctx.setTransform(res, 0, 0, res, 0, 0);

      // 2. Per-cell ground: overpaint non-grass terrain + add organic variation.
      mapData.tiles.forEach((tile) => {
        const gx = tile.coordinates.x * tileSize;
        const gy = tile.coordinates.y * tileSize;
        const ground = terrainToGround(tile.terrain);

        if (ground === 'dirt' || ground === 'sand') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(gx, gy, tileSize, tileSize);
          ctx.clip();
          if (dirtPat) {
            ctx.fillStyle = dirtPat;
            ctx.fillRect(gx - 8, gy - 8, tileSize + 16, tileSize + 16);
          } else {
            ctx.fillStyle = ground === 'sand' ? '#b9a06a' : '#5a4632';
            ctx.fillRect(gx, gy, tileSize, tileSize);
          }
          ctx.fillStyle = ground === 'sand' ? 'rgba(190,165,105,0.45)' : 'rgba(70,52,35,0.4)';
          ctx.fillRect(gx, gy, tileSize, tileSize);
          ctx.restore();
        } else if (ground === 'stone') {
          ctx.fillStyle = '#3b3f47';
          ctx.fillRect(gx, gy, tileSize, tileSize);
          ctx.fillStyle = rand(tile.coordinates.x, tile.coordinates.y, 9) > 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.05)';
          ctx.fillRect(gx, gy, tileSize, tileSize);
        } else if (ground === 'water') {
          const c = wctx ?? ctx;
          const tx = tile.coordinates.x;
          const ty = tile.coordinates.y;
          const grd = c.createLinearGradient(gx, gy, gx, gy + tileSize);
          grd.addColorStop(0, '#1a4a68');
          grd.addColorStop(1, '#0e3350');
          c.fillStyle = grd;
          c.fillRect(gx, gy, tileSize, tileSize);
          // Banks: where this water tile touches land, paint a sandy rim and a
          // pale shoreline line inside the water edge so shores read as painted
          // banks instead of hard blue squares.
          const bank = Math.max(3, tileSize * 0.22);
          const drawBank = (bx: number, by: number, bw: number, bh: number, horizontal: boolean, flip: boolean) => {
            const sg = horizontal
              ? c.createLinearGradient(bx, flip ? by + bh : by, bx, flip ? by : by + bh)
              : c.createLinearGradient(flip ? bx + bw : bx, by, flip ? bx : bx + bw, by);
            sg.addColorStop(0, 'rgba(196,172,120,0.85)');
            sg.addColorStop(0.55, 'rgba(150,180,190,0.35)');
            sg.addColorStop(1, 'rgba(150,180,190,0)');
            c.fillStyle = sg;
            c.fillRect(bx, by, bw, bh);
          };
          if (isLand(tx, ty - 1)) drawBank(gx, gy, tileSize, bank, true, false);
          if (isLand(tx, ty + 1)) drawBank(gx, gy + tileSize - bank, tileSize, bank, true, true);
          if (isLand(tx - 1, ty)) drawBank(gx, gy, bank, tileSize, false, false);
          if (isLand(tx + 1, ty)) drawBank(gx + tileSize - bank, gy, bank, tileSize, false, true);
          // Ripple glints driven by a continuous phase over MAP space so the
          // surface reads as one connected sheet, not a repeating per-tile comma.
          c.strokeStyle = 'rgba(140,205,230,0.3)';
          c.lineWidth = 1;
          const phase = Math.sin(tx * 0.9 + ty * 1.7) * 0.5 + 0.5;
          const ry = gy + tileSize * (0.25 + phase * 0.5);
          c.beginPath();
          c.moveTo(gx, ry);
          c.quadraticCurveTo(gx + tileSize / 2, ry - 3, gx + tileSize, ry);
          c.stroke();
        }

        // Subtle brightness noise on every cell for a non-flat, painted feel.
        const n = rand(tile.coordinates.x, tile.coordinates.y, 5);
        if (ground === 'grass') {
          ctx.fillStyle = n > 0.5 ? `rgba(140,170,80,${(n - 0.5) * 0.35})` : `rgba(0,0,0,${(0.5 - n) * 0.22})`;
          ctx.fillRect(gx, gy, tileSize, tileSize);
        }
      });

      // Composite the water sheet with a slight feather so shorelines soften
      // past the tile squares instead of staircasing on the grid.
      if (wctx) {
        ctx.save();
        ctx.filter = 'blur(1.5px)';
        ctx.drawImage(waterCanvas, 0, 0, px, py);
        ctx.filter = 'none';
        ctx.restore();
      }

      // 3. Foliage + rocks from tile decorations (drawn large, top-down).
      mapData.tiles.forEach((tile) => {
        const cx = tile.coordinates.x * tileSize + tileSize / 2;
        const cy = tile.coordinates.y * tileSize + tileSize / 2;
        const seed = tile.coordinates.x * 73 + tile.coordinates.y * 149;
        switch (tile.decoration) {
          case 'tree':
          case 'mangrove':
            drawTree(ctx, cx, cy, tileSize * 0.7, seed);
            break;
          case 'boulder':
          case 'stalagmite':
            drawRock(ctx, cx, cy, tileSize * 0.5, seed);
            break;
          case 'pillar':
            drawRock(ctx, cx, cy, tileSize * 0.42, seed);
            break;
          case 'cactus':
            drawTree(ctx, cx, cy, tileSize * 0.45, seed);
            break;
          default: {
            // Understory scatter: occasional bushes and fallen logs on plain
            // grass keep large open meadows from feeling empty.
            const ground = terrainToGround(tile.terrain);
            if (ground === 'grass') {
              const roll = rand(tile.coordinates.x, tile.coordinates.y, 61);
              if (roll < 0.045) {
                drawBush(ctx, cx + (rand(seed, 1, 62) - 0.5) * tileSize * 0.5, cy + (rand(seed, 2, 63) - 0.5) * tileSize * 0.5, tileSize * 0.35, seed);
              } else if (roll < 0.058) {
                drawLog(ctx, cx, cy, tileSize * 0.9, seed);
              }
            }
            break;
          }
        }
      });

      // 4. Vignette — darken the edges so the board feels lit from within.
      const vg = ctx.createRadialGradient(px / 2, py / 2, Math.min(px, py) * 0.35, px / 2, py / 2, Math.max(px, py) * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, px, py);

      // 5. A couple of soft light dapples for warmth.
      for (let i = 0; i < 3; i++) {
        const lx = px * (0.2 + rand(i, 0, 6) * 0.6);
        const ly = py * (0.2 + rand(i, 1, 7) * 0.6);
        const lr = Math.min(px, py) * 0.18;
        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
        lg.addColorStop(0, 'rgba(255,236,170,0.10)');
        lg.addColorStop(1, 'rgba(255,236,170,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
      }

      // 6. Time-of-day tint keyed off the map seed, so re-rolled encounters
      // don't all read as the same noon meadow: noon (none), golden hour,
      // overcast, and dusk each get a cheap full-board wash.
      const seed = mapData.seed ?? 0;
      const tod = Math.floor(rand(seed % 9973, seed % 7919, 71) * 4);
      if (tod === 1) {
        ctx.fillStyle = 'rgba(255,170,60,0.10)'; // golden hour
        ctx.fillRect(0, 0, px, py);
      } else if (tod === 2) {
        ctx.fillStyle = 'rgba(120,135,160,0.14)'; // overcast
        ctx.fillRect(0, 0, px, py);
      } else if (tod === 3) {
        ctx.fillStyle = 'rgba(50,60,130,0.16)'; // dusk
        ctx.fillRect(0, 0, px, py);
        ctx.fillStyle = 'rgba(255,140,50,0.05)';
        ctx.fillRect(0, 0, px, py);
      }
    };

    Promise.all([loadImage(GRASS_SRC), loadImage(DIRT_SRC)]).then(([grass, dirt]) => draw(grass, dirt));

    return () => { cancelled = true; };
  }, [mapData, tileSize]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

export default BattleMapGroundCanvas;
