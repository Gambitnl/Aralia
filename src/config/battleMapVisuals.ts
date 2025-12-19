/**
 * @file src/config/battleMapVisuals.ts
 * Central configuration for Battle Map visuals (terrain and decorations).
 * Replaces hardcoded switch statements in BattleMapTile.tsx with a data-driven approach.
 */

import { BattleMapTerrain, BattleMapDecoration } from '../types/combat';
import { TerrainVisualSpec, DecorationVisualSpec } from '../types/visuals';

/**
 * Standard visual definitions for terrain types.
 */
export const TERRAIN_VISUALS: Record<BattleMapTerrain, TerrainVisualSpec> = {
  grass: { terrain: 'grass', colorClass: 'bg-green-800' },
  rock: { terrain: 'rock', colorClass: 'bg-gray-600' },
  water: { terrain: 'water', colorClass: 'bg-blue-700' },
  difficult: { terrain: 'difficult', colorClass: 'bg-yellow-700' },
  wall: { terrain: 'wall', colorClass: 'bg-gray-900' },
  floor: { terrain: 'floor', colorClass: 'bg-gray-600' },
  stone: { terrain: 'rock', colorClass: 'bg-gray-600' }, // Mapping 'stone' to rock visual for now
  sand: { terrain: 'sand', colorClass: 'bg-yellow-600' },
  mud: { terrain: 'mud', colorClass: 'bg-stone-700' },
};

/**
 * Standard visual definitions for decorations.
 */
export const DECORATION_VISUALS: Record<Exclude<BattleMapDecoration, null>, DecorationVisualSpec> = {
  tree: { decoration: 'tree', icon: '🌳' },
  boulder: { decoration: 'boulder', icon: '🪨' },
  stalagmite: { decoration: 'stalagmite', icon: 'ʌ' },
  pillar: { decoration: 'pillar', icon: '🏛️' },
  cactus: { decoration: 'cactus', icon: '🌵' },
  mangrove: { decoration: 'mangrove', icon: '🌿' },
};

/**
 * Resolves the visual spec for a given terrain type.
 * @param terrain - The terrain type.
 * @returns The resolved visual spec or a safe fallback.
 */
export function getTerrainVisual(terrain: BattleMapTerrain): TerrainVisualSpec {
  return TERRAIN_VISUALS[terrain] || { terrain, colorClass: 'bg-black' };
}

/**
 * Resolves the visual spec for a given decoration.
 * @param decoration - The decoration type.
 * @returns The resolved visual spec or null if no decoration/unknown.
 */
export function getDecorationVisual(decoration: BattleMapDecoration): DecorationVisualSpec | null {
  if (!decoration) return null;
  return DECORATION_VISUALS[decoration] || null;
}
