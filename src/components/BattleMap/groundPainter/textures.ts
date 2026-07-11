/**
 * @file groundPainter/textures.ts
 * Ground vocabulary + the module-level image/decode cache for the painted
 * battle-map ground: the grass/dirt JPGs and the Caeora sprite pack are
 * loaded once and memoized so remounts never flash a blank board.
 *
 * Extracted verbatim from groundPainter.ts. The paint pipeline consumes the
 * GroundTextures bundle this module resolves.
 */
import type { BattleMapBiome } from '../../../types/combat';
import { BATTLE_MAP_BIOMES } from '../../../types/combat';
import { loadSpritePack, type SpritePack } from '../spritePacks';

const GRASS_SRC = `${import.meta.env.BASE_URL}assets/ez-tree-lab/grass.jpg`;
const DIRT_SRC = `${import.meta.env.BASE_URL}assets/ez-tree-lab/dirt_color.jpg`;

export type Ground = 'grass' | 'dirt' | 'water' | 'stone' | 'sand';

// The biomes the battle-map generator can roll (mapData.theme). Single
// source of truth lives in types/combat.ts; these aliases keep the painter's
// local vocabulary.
export const COMBAT_BIOMES = BATTLE_MAP_BIOMES;
export type CombatBiome = BattleMapBiome;

export const terrainToGround = (terrain: string): Ground => {
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

export interface GroundTextures {
  grass: HTMLImageElement | null;
  dirt: HTMLImageElement | null;
  /** Caeora painted token pack for the ACTIVE biome, if it has one. */
  pack: SpritePack | null;
}

export const loadGroundTextures = async (theme?: CombatBiome): Promise<GroundTextures> => {
  const [grass, dirt, pack] = await Promise.all([
    loadImage(GRASS_SRC),
    loadImage(DIRT_SRC),
    loadSpritePack(theme ?? 'forest'),
  ]);
  return { grass, dirt, pack };
};
