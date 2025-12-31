/**
 * @file VisibilitySystem.ts
 * Core logic for calculating light levels and character visibility in the Underdark.
 *
 * "In the deep, light is not a given. It is a resource." - Depthcrawler
 */

import {
  BattleMapData,
  // TODO(lint-intent): 'BattleMapTile' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  BattleMapTile as _BattleMapTile,
  CombatCharacter,
  LightSource,
  LightLevel,
  Position
} from '../../types/combat';
import { bresenhamLine } from '../../utils/lineOfSight';

export type VisibilityTier = 'visible' | 'dim' | 'hidden';

// D&D 5e Standard: 1 Grid Unit = 5 Feet.
const GRID_SCALE = 5;

export class VisibilitySystem {

  /**
   * Calculates the light level for every tile on the map based on active light sources.
   * Considers walls blocking light.
   *
   * @param mapData The current state of the battle map.
   * @param lightSources List of active light sources.
   * @returns A map of tile IDs to their LightLevel.
   */
  static calculateLightLevels(
    mapData: BattleMapData,
    lightSources: LightSource[]
  ): Map<string, LightLevel> {
    const lightLevels = new Map<string, LightLevel>();

    // Initialize all tiles to Darkness (Underdark default)
    mapData.tiles.forEach((tile) => {
      lightLevels.set(tile.id, 'darkness');
    });

    for (const source of lightSources) {
      const sourcePos = source.position;
      if (!sourcePos) continue;

      // Convert Radius (Feet) to Grid Units
      const brightRadiusUnits = source.brightRadius / GRID_SCALE;
      const dimRadiusUnits = source.dimRadius / GRID_SCALE;
      const maxRadiusUnits = brightRadiusUnits + dimRadiusUnits;

      const minX = Math.floor(sourcePos.x - maxRadiusUnits);
      const maxX = Math.ceil(sourcePos.x + maxRadiusUnits);
      const minY = Math.floor(sourcePos.y - maxRadiusUnits);
      const maxY = Math.ceil(sourcePos.y + maxRadiusUnits);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const tileId = `${x}-${y}`;
          const tile = mapData.tiles.get(tileId);
          if (!tile) continue;

          // Euclidean distance in grid units
          const dist = Math.sqrt(Math.pow(x - sourcePos.x, 2) + Math.pow(y - sourcePos.y, 2));

          if (dist > maxRadiusUnits) continue;

          if (this.isLineBlocked(sourcePos, tile.coordinates, mapData)) {
            continue;
          }

          let contribution: LightLevel = 'darkness';

          if (brightRadiusUnits > 0 && dist <= brightRadiusUnits) {
            contribution = 'bright';
          } else if (dist <= maxRadiusUnits) {
            contribution = 'dim';
          }

          const current = lightLevels.get(tileId) || 'darkness';

          if (contribution === 'bright') {
            lightLevels.set(tileId, 'bright');
          } else if (contribution === 'dim' && current !== 'bright') {
            lightLevels.set(tileId, 'dim');
          }
        }
      }
    }

    return lightLevels;
  }

  /**
   * Calculates what a specific observer can see.
   *
   * @param observer The character looking around.
   * @param mapData The map.
   * @param lightLevels Pre-calculated light levels for the map.
   * @returns A map of Tile IDs to VisibilityTier.
   */
  static calculateVisibility(
    observer: CombatCharacter,
    mapData: BattleMapData,
    lightLevels: Map<string, LightLevel>
  ): Map<string, VisibilityTier> {
    const visibilityMap = new Map<string, VisibilityTier>();
    const observerPos = observer.position;

    // Convert Senses (Feet) to Grid Units
    const darkvisionRangeUnits = (observer.stats.senses?.darkvision || 0) / GRID_SCALE;
    const blindsightRangeUnits = (observer.stats.senses?.blindsight || 0) / GRID_SCALE;

    mapData.tiles.forEach((tile) => {
      const tileId = tile.id;
      const dist = Math.sqrt(Math.pow(tile.coordinates.x - observerPos.x, 2) + Math.pow(tile.coordinates.y - observerPos.y, 2));

      // 1. Blindsight Check
      if (blindsightRangeUnits > 0 && dist <= blindsightRangeUnits) {
        if (!this.isLineBlocked(observerPos, tile.coordinates, mapData)) {
           visibilityMap.set(tileId, 'visible');
           return;
        }
      }

      // 2. Line of Sight Check
      if (this.isLineBlocked(observerPos, tile.coordinates, mapData)) {
        visibilityMap.set(tileId, 'hidden');
        return;
      }

      // 3. Light Level Check
      const lightLevel = lightLevels.get(tileId) || 'darkness';

      if (lightLevel === 'bright') {
        visibilityMap.set(tileId, 'visible');
      } else if (lightLevel === 'dim') {
        visibilityMap.set(tileId, 'dim');
      } else if (lightLevel === 'darkness') {
        if (darkvisionRangeUnits > 0 && dist <= darkvisionRangeUnits) {
          // Darkvision: Darkness -> Dim
          // NOTE: In 5e, Darkvision sees in Darkness as if it were Dim Light (grayscale).
          // We mark it as 'dim' here.
          visibilityMap.set(tileId, 'dim');
        } else {
          visibilityMap.set(tileId, 'hidden');
        }
      } else if (lightLevel === 'magical_darkness') {
        visibilityMap.set(tileId, 'hidden');
      }
    });

    return visibilityMap;
  }

  private static isLineBlocked(start: Position, end: Position, mapData: BattleMapData): boolean {
    const line = bresenhamLine(start.x, start.y, end.x, end.y);

    for (let i = 1; i < line.length - 1; i++) {
      const pt = line[i];
      const tileId = `${pt.x}-${pt.y}`;
      const tile = mapData.tiles.get(tileId);

      if (tile && tile.blocksLoS) {
        return true;
      }
    }
    return false;
  }
}
