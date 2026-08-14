// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 15:06:13
 * Dependents: components/DesignPreview/steps/scenarioControls/darkvisionScenarioControls.ts, systems/visibility/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file calculates the light level and visibility tier of every map tile.
 *
 * Light may illuminate an opaque wall face, but an observer cannot see through
 * that wall or through a sealed diagonal corner. Keeping both decisions on the
 * shared line-of-sight helper prevents targeting and presentation from drifting.
 *
 * Called by: combat visibility, map presentation, and Tactical Sandbox proofs.
 * Depends on: combat map data and the canonical spatial line-of-sight helper.
 */

import {
  BattleMapData,
  CombatCharacter,
  LightSource,
  LightLevel,
  Position
} from '../../types/combat';
import { hasLineOfSight } from '../../utils/spatial';

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
      if (this.isSuppressedByOpaqueCover(source, mapData)) continue;

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

          if (this.isLineBlocked(sourcePos, tile.coordinates, mapData, false)) {
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

  private static isLineBlocked(
    start: Position,
    end: Position,
    mapData: BattleMapData,
    blockOpaqueEndpoint = true,
  ): boolean {
    const startTile = mapData.tiles.get(`${start.x}-${start.y}`);
    const endTile = mapData.tiles.get(`${end.x}-${end.y}`);

    // Visibility and target selection must never disagree about a sealed
    // corner or opaque endpoint. Missing endpoint tiles are outside the board
    // and therefore cannot provide a visible route.
    return !startTile || !endTile || !hasLineOfSight(startTile, endTile, mapData, {
      includeEndTileBlocker: blockOpaqueEndpoint,
    });
  }

  /**
   * Opaque cover is only meaningful for object-mounted light sources, so the
   * visibility pass checks the map's explicit object records before spending
   * the light budget on tiles.
   */
  private static isSuppressedByOpaqueCover(source: LightSource, mapData: BattleMapData): boolean {
    if (!source.opaqueCoverBlocks || !source.position) {
      return false;
    }

    const srcPos = source.position;
    const coveredObject = mapData.targetableObjects?.some(object =>
      object.position.x === srcPos.x &&
      object.position.y === srcPos.y &&
      object.isCoveredByOpaqueMaterial === true
    );

    return coveredObject === true;
  }
}
