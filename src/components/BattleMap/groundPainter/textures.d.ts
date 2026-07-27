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
import { type SpritePack } from '../spritePacks';
export type Ground = 'grass' | 'dirt' | 'water' | 'stone' | 'sand';
export declare const COMBAT_BIOMES: readonly ["forest", "cave", "dungeon", "desert", "swamp", "snow", "jungle", "coast", "ruins", "volcanic"];
export type CombatBiome = BattleMapBiome;
export declare const terrainToGround: (terrain: string) => Ground;
export interface GroundTextures {
    grass: HTMLImageElement | null;
    dirt: HTMLImageElement | null;
    /** Caeora painted token pack for the ACTIVE biome, if it has one. */
    pack: SpritePack | null;
}
export declare const loadGroundTextures: (theme?: CombatBiome) => Promise<GroundTextures>;
