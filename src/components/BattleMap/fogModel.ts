/**
 * @file fogModel.ts
 * Shared fog-of-war / lighting math for the 2D battle board.
 *
 * Both the DOM fog canvas (BattleMapFogCanvas) and the PixiJS prototype paint
 * the exact same night-blue fog. This module is the single source of that
 * math: how dark a tile paints given its visibility and light level, the ink
 * color, and a row-major alpha grid the renderers upscale.
 */
import type { BattleMapData, LightLevel } from '../../types/combat';

/** How dark a tile paints: 0 = fully lit, up to 0.55 = unseen. */
export const fogAlpha = (visible: boolean, light: LightLevel): number => {
  if (!visible) return 0.55;
  switch (light) {
    case 'magical_darkness': return 0.48;
    case 'darkness': return 0.3;
    case 'dim': return 0.16;
    default: return 0;
  }
};

/**
 * The fog ink color, as data so both renderers use the same night-blue.
 * Deliberately BLUE, not near-black: over green or brown terrain a near-black
 * veil reads as painted dirt/shadow smears; a slate-blue veil reads as
 * "outside your sight" — a vision statement, not a terrain feature.
 */
export const FOG_TINT = { r: 22, g: 34, b: 64 } as const;

/**
 * Fog ink over WATER tiles. The slate ink that works on grass muddies blue
 * water into gray-green murk; staying in the water's own hue family makes
 * hidden water read as "darker water you can't see", not a stain on it.
 */
export const FOG_TINT_WATER = { r: 8, g: 20, b: 58 } as const;

export interface FogAlphaGrid {
  width: number;
  height: number;
  /** Row-major: alphas[y * width + x]. Exact JS doubles so 0.6 reads back as 0.6. */
  alphas: number[];
}

export const buildFogAlphaGrid = (
  mapData: BattleMapData,
  visibleTiles: Set<string>,
  getLightLevel: (tileId: string) => LightLevel,
): FogAlphaGrid => {
  const width = mapData.dimensions.width;
  const height = mapData.dimensions.height;
  const alphas = new Array<number>(width * height).fill(0);
  mapData.tiles.forEach((tile) => {
    alphas[tile.coordinates.y * width + tile.coordinates.x] = fogAlpha(
      visibleTiles.has(tile.id),
      getLightLevel(tile.id),
    );
  });
  return { width, height, alphas };
};

/**
 * Blur the fog grid before upscaling. The raw grid is tile-exact, so any
 * diagonal visibility boundary (a sightline breaking over a rising crest) is
 * a one-tile staircase — bilinear upscale feathers each step but cannot
 * remove the teeth. A 3×3 weighted blur (repeatable) melts the steps into
 * one continuous penumbra while staying within a tile of the referee's
 * truth: fully-lit and fully-hidden interiors keep their exact values.
 */
export const blurFogAlphaGrid = (
  grid: FogAlphaGrid,
  passes = 1,
): FogAlphaGrid => {
  const { width, height } = grid;
  let src = grid.alphas;
  for (let pass = 0; pass < passes; pass++) {
    const out = new Array<number>(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weight = 0;
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const w = ox === 0 && oy === 0 ? 4 : ox === 0 || oy === 0 ? 2 : 1;
            sum += src[ny * width + nx] * w;
            weight += w;
          }
        }
        out[y * width + x] = sum / weight;
      }
    }
    src = out;
  }
  return { width, height, alphas: src };
};
