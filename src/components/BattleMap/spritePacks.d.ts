/**
 * @file spritePacks.ts
 * Per-biome loader for the Caeora painted VTT token packs
 * (public/assets/battlemap/<biome>/). Each biome that has a painted pack
 * registers a manifest here; the 2D board's ground painter stamps those
 * sprites instead of drawing procedural shapes.
 *
 * Adding a pack for a new biome is one entry in PACKS — drop the art under
 * public/assets/battlemap/<biome>/ and list the files by logical role.
 *
 * Props carry baked drop shadows (sun upper-left), so the painter keeps them
 * near-upright; flat decals (tracks, leaves) are shadow-free and rotate
 * freely. A missing file logs once and is skipped — the painter falls back
 * to its procedural drawer for that role.
 */
import type { BattleMapBiome } from '../../types/combat';
/** A loaded pack: logical role → the images available for it. */
export type SpritePack = Record<string, HTMLImageElement[]>;
/** True if the biome has a painted pack registered. */
export declare const biomeHasSpritePack: (biome: BattleMapBiome) => boolean;
/** Load (once) and cache the painted pack for a biome, or null if it has none. */
export declare const loadSpritePack: (biome: BattleMapBiome) => Promise<SpritePack | null>;
