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

/** How dark a tile paints: 0 = fully lit, up to 0.6 = unseen. */
export const fogAlpha = (visible: boolean, light: LightLevel): number => {
  if (!visible) return 0.6;
  switch (light) {
    case 'magical_darkness': return 0.5;
    case 'darkness': return 0.3;
    case 'dim': return 0.16;
    default: return 0;
  }
};

/** The fog ink color, as data so both renderers use the same night-blue. */
export const FOG_TINT = { r: 4, g: 8, b: 14 } as const;

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
