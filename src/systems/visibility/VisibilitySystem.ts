/**
 * @file src/systems/visibility/VisibilitySystem.ts
 * Core logic for calculating lighting and visibility in the Underdark and beyond.
 * Implements strict D&D 5e visibility rules: Bright Light, Dim Light, Darkness, and Darkvision.
 */

import {
  BattleMapData,
  LightSource,
  CombatCharacter,
  LightLevel,
  Position,
  BattleMapTile
} from '../../types/combat';
import { bresenhamLine } from '../../utils/lineOfSight';

export class VisibilitySystem {
  /**
   * Calculates the light level for every tile on the map based on active light sources.
   * Assumes default ambient light is 'darkness' (Underdark standard).
   *
   * @param mapData The battle map geometry.
   * @param lightSources List of active light sources.
   * @param ambientLight The base light level of the map (default: 'darkness').
   * @returns A Map where key is "x,y" and value is the LightLevel.
   */
  static calculateLightLevels(
    mapData: BattleMapData,
    lightSources: LightSource[],
    ambientLight: LightLevel = 'darkness'
  ): Map<string, LightLevel> {
    // 1. Initialize with ambient light
    const lightMap = new Map<string, LightLevel>();

    // Optimization: If ambient is bright, everything is bright (unless we handle magical darkness later)
    if (ambientLight === 'bright') {
       // Just return all bright? Or map it out?
       // For now, let's map it out to support magical darkness overriding bright light later.
       mapData.tiles.forEach((tile) => {
         lightMap.set(tile.id, 'bright');
       });
       return lightMap;
    }

    // Default everything to ambient
    mapData.tiles.forEach((tile) => {
      lightMap.set(tile.id, ambientLight);
    });

    // 2. Process each light source
    for (const source of lightSources) {
      if (!source.position && !source.attachedToCharacterId) continue;

      // Resolve position
      let origin: Position | undefined = source.position;

      // If attached to a character, we need to find that character.
      // Ideally, the caller should resolve positions, but lightSources might not have up-to-date character pos.
      // For this pure function, we assume `source.position` is populated OR we skip if we can't find it.
      // NOTE: The `LightSource` interface has `position?: Position`.
      // If it's attached to a character, the system maintaining state must update the `position` field
      // OR we need characters passed in.
      // For now, we assume the caller has updated source.position.

      if (!origin) continue;

      const brightRadius = source.brightRadius;
      const dimRadius = source.dimRadius;
      const totalRadius = brightRadius + dimRadius;
      const tileRadius = Math.ceil(totalRadius / 5);

      // Bounding box
      const minX = Math.floor(origin.x - tileRadius);
      const maxX = Math.ceil(origin.x + tileRadius);
      const minY = Math.floor(origin.y - tileRadius);
      const maxY = Math.ceil(origin.y + tileRadius);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const tileId = `${x}-${y}`; // Using standard ID format "x-y" matching BattleMapTile.id
          const tile = mapData.tiles.get(tileId);
          if (!tile) continue;

          // Calculate distance (Chebyshev for 5e grid)
          const dist = Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) * 5;

          if (dist > totalRadius) continue;

          // Check Line of Sight (Shadows)
          if (!this.hasLineOfSightForLight(origin, { x, y }, mapData)) {
            continue;
          }

          // Determine Level
          let level: LightLevel = 'darkness';
          if (dist <= brightRadius) {
            level = 'bright';
          } else if (dist <= totalRadius) {
            level = 'dim';
          }

          // Apply to map (Merge logic: Bright > Dim > Darkness)
          const current = lightMap.get(tileId) || 'darkness';
          if (level === 'bright') {
            lightMap.set(tileId, 'bright');
          } else if (level === 'dim' && current !== 'bright') {
            lightMap.set(tileId, 'dim');
          }
        }
      }
    }

    return lightMap;
  }

  /**
   * Determines the set of tiles visible to a specific character.
   *
   * @param observer The character looking.
   * @param mapData The map.
   * @param lightMap The calculated light levels.
   * @returns A Set of tile IDs that are visible.
   */
  static getVisibleTiles(
    observer: CombatCharacter,
    mapData: BattleMapData,
    lightMap: Map<string, LightLevel>
  ): Set<string> {
    const visibleTiles = new Set<string>();
    const origin = observer.position;

    // Determine Max Vision Range
    // Default 5e assumption: You can see indefinitely if there's light,
    // but practically limited by map or reasonable max (e.g., 120ft, 300ft).
    // Darkvision has a specific limit.
    // For performance, let's clamp "infinite" vision to a reasonable board size (e.g. 60 tiles / 300ft).
    const MAX_VIEW_DISTANCE = 300;

    // Use Darkvision range if relevant for Darkness
    const darkvisionRange = observer.stats.senses?.darkvision || 0;

    // Iterate all tiles in bounding box of MAX_VIEW_DISTANCE
    const radiusTiles = Math.ceil(MAX_VIEW_DISTANCE / 5);
    const minX = Math.floor(origin.x - radiusTiles);
    const maxX = Math.ceil(origin.x + radiusTiles);
    const minY = Math.floor(origin.y - radiusTiles);
    const maxY = Math.ceil(origin.y + radiusTiles);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const tileId = `${x}-${y}`;
        const tile = mapData.tiles.get(tileId);

        // If tile doesn't exist, skip
        if (!tile) continue;

        // 1. Check Line of Sight (Physical obstruction)
        if (!this.hasLineOfSight(origin, { x, y }, mapData)) {
          continue;
        }

        // 2. Check Lighting Condition
        const lightLevel = lightMap.get(tileId) || 'darkness';
        const dist = Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) * 5;

        if (lightLevel === 'bright' || lightLevel === 'dim') {
          // Visible
          visibleTiles.add(tileId);
        } else if (lightLevel === 'darkness') {
          // Only visible if within Darkvision range
          if (darkvisionRange > 0 && dist <= darkvisionRange) {
            visibleTiles.add(tileId);
          }
        }
      }
    }

    return visibleTiles;
  }

  /**
   * Helper to check line of sight for light propagation.
   * Light sources can be in walls (torches on walls), so we might need lenient checking for start.
   */
  private static hasLineOfSightForLight(start: Position, end: Position, mapData: BattleMapData): boolean {
    const line = bresenhamLine(start.x, start.y, end.x, end.y);

    // Iterate points between start and end
    for (let i = 0; i < line.length; i++) {
        const point = line[i];

        // Skip the very last point (the target tile itself is illuminated even if it's a wall)
        if (point.x === end.x && point.y === end.y) continue;

        // Skip the very first point (the source itself)
        if (point.x === start.x && point.y === start.y) continue;

        const tileId = `${point.x}-${point.y}`;
        const tile = mapData.tiles.get(tileId);

        if (tile && tile.blocksLoS) {
            return false;
        }
    }
    return true;
  }

  /**
   * Helper for character vision LoS.
   * Characters cannot see THROUGH walls.
   */
  private static hasLineOfSight(start: Position, end: Position, mapData: BattleMapData): boolean {
     // Identical logic to light for now, but semantically distinct.
     // (e.g., Glass windows might block movement but not sight, magical darkness blocks sight but not movement)
     return this.hasLineOfSightForLight(start, end, mapData);
  }
}
