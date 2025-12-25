/**
 * @file src/systems/visibility/VisibilitySystem.ts
 * Core logic for the Visibility System.
 * Calculates light levels on the map and determines which tiles are visible to a specific character.
 * Implements "The Blinding of the Deep" plan.
 *
 * Copyright (c) 2024 Aralia RPG. Licensed under the MIT License.
 */

import {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  LightLevel,
  LightSource,
  Position,
} from '../../types/combat';
import { calculateAffectedTiles } from '../../utils/aoeCalculations';
import { hasLineOfSight } from '../../utils/lineOfSight';

export class VisibilitySystem {
  /**
   * Calculates the light level for every tile on the map based on active light sources.
   * Considers wall obstructions (shadow casting).
   *
   * @param mapData - The battle map data (dimensions, tiles).
   * @param lightSources - List of active light sources.
   * @param characters - List of characters (needed to resolve dynamic light positions attached to characters).
   * @returns A Map where key is "x-y" and value is the LightLevel ('bright', 'dim', 'darkness').
   */
  static calculateLightLevels(
    mapData: BattleMapData,
    lightSources: LightSource[],
    characters: CombatCharacter[]
  ): Map<string, LightLevel> {
    const lightGrid = new Map<string, LightLevel>();
    const ambientLight = this.getAmbientLight(mapData);

    // Initialize grid with ambient light
    for (const [key] of mapData.tiles) {
      lightGrid.set(key, ambientLight);
    }

    // Process each light source
    for (const source of lightSources) {
      const origin = this.resolveLightSourcePosition(source, characters);
      if (!origin) continue;

      // 1. Calculate Bright Light Radius
      // "Bright light lets you see normally."
      const brightTiles = calculateAffectedTiles({
        shape: 'Sphere',
        origin,
        size: source.brightRadius,
      });

      this.applyLightToTiles(brightTiles, 'bright', origin, mapData, lightGrid);

      // 2. Calculate Dim Light Radius (Bright Radius + Dim Radius)
      // "Dim light, also called shadows, creates a lightly obscured area."
      // Note: In 5e, a torch has 20ft bright + 20ft dim. The dim light extends 20ft BEYOND the bright light.
      // So the outer radius is brightRadius + dimRadius.
      const totalRadius = source.brightRadius + source.dimRadius;
      if (totalRadius > source.brightRadius) {
        const dimTiles = calculateAffectedTiles({
            shape: 'Sphere',
            origin,
            size: totalRadius,
        });
        this.applyLightToTiles(dimTiles, 'dim', origin, mapData, lightGrid);
      }
    }

    return lightGrid;
  }

  /**
   * Applies a specific light level to a set of candidate tiles, checking for shadows/LoS.
   * Only upgrades light levels (Darkness -> Dim -> Bright). Never downgrades.
   */
  private static applyLightToTiles(
    tiles: Position[],
    level: LightLevel,
    origin: Position,
    mapData: BattleMapData,
    lightGrid: Map<string, LightLevel>
  ) {
    const startTile = mapData.tiles.get(`${Math.round(origin.x)}-${Math.round(origin.y)}`);
    if (!startTile) return; // Light source off-map?

    for (const pos of tiles) {
      const key = `${pos.x}-${pos.y}`;
      const targetTile = mapData.tiles.get(key);

      if (!targetTile) continue;

      // Skip if already brighter or equal
      const currentLevel = lightGrid.get(key);
      if (level === 'dim' && currentLevel === 'bright') continue;
      if (level === currentLevel) continue;

      // Check Line of Sight from Light Source to Tile (Shadow Casting)
      if (hasLineOfSight(startTile, targetTile, mapData)) {
        lightGrid.set(key, level);
      }
    }
  }

  /**
   * Determines the set of tiles visible to a specific character.
   * Considers Line of Sight, Light Levels, and Character Senses (Darkvision).
   *
   * @param observer - The character looking at the map.
   * @param mapData - The battle map data.
   * @param lightGrid - The pre-calculated light levels for the map.
   * @returns A Set of tile IDs ("x-y") that are visible to the observer.
   */
  static getVisibleTiles(
    observer: CombatCharacter,
    mapData: BattleMapData,
    lightGrid: Map<string, LightLevel>
  ): Set<string> {
    const visibleTiles = new Set<string>();
    const originTile = mapData.tiles.get(`${observer.position.x}-${observer.position.y}`);

    if (!originTile) return visibleTiles; // Observer off-map

    // Optimization: Only check tiles within a reasonable view distance?
    // For now, iterate all tiles. Maps are usually small (< 50x50).
    // If maps get huge, we should optimize this to a bounding box.

    for (const [key, tile] of mapData.tiles) {
      // 1. Check Physical Line of Sight
      // We assume character can see in all directions (360 vision) unless blinded condition is active.
      // TODO: Check 'blinded' condition on character.

      const hasPhysicalLoS = hasLineOfSight(originTile, tile, mapData);
      if (!hasPhysicalLoS) continue;

      // 2. Check Lighting
      const lightLevel = lightGrid.get(key) || 'darkness';

      if (lightLevel === 'bright' || lightLevel === 'dim') {
        // Visible in Bright or Dim light
        visibleTiles.add(key);
      } else if (lightLevel === 'darkness') {
        // Check Darkvision
        const darkvisionRange = observer.stats.senses?.darkvision || 0;
        if (darkvisionRange > 0) {
           // Calculate distance
           const dx = Math.abs(tile.coordinates.x - observer.position.x);
           const dy = Math.abs(tile.coordinates.y - observer.position.y);
           // Chebyshev distance for 5e
           const distance = Math.max(dx, dy) * 5; // 5ft per tile

           if (distance <= darkvisionRange) {
             visibleTiles.add(key);
           }
        }
        // If no darkvision, it remains hidden (darkness)
      } else if (lightLevel === 'magical_darkness') {
         // Standard Darkvision doesn't penetrate magical darkness (like Darkness spell).
         // Warlock Devil's Sight (truesight-ish) might.
         // For now, assume invisible unless specific override exists.
         // TODO: Check for 'Devil's Sight' or True Sight.
         const truesightRange = observer.stats.senses?.truesight || 0;
         if (truesightRange > 0) {
             // Calculate distance
             const dx = Math.abs(tile.coordinates.x - observer.position.x);
             const dy = Math.abs(tile.coordinates.y - observer.position.y);
             const distance = Math.max(dx, dy) * 5;
             if (distance <= truesightRange) {
                 visibleTiles.add(key);
             }
         }
      }
    }

    return visibleTiles;
  }

  /**
   * Resolves the actual grid position of a light source.
   */
  private static resolveLightSourcePosition(
    source: LightSource,
    characters: CombatCharacter[]
  ): Position | undefined {
    if (source.attachedTo === 'point') {
      return source.position;
    }

    // Attached to a character (caster or target)
    // Note: attachedToCharacterId should be populated if it's attached to caster or target.
    // If attachedTo is 'caster', we use casterId. If 'target', we usually expect a specific target ID.
    // However, existing LightSource type has `attachedToCharacterId`.

    let charId: string | undefined;

    if (source.attachedToCharacterId) {
        charId = source.attachedToCharacterId;
    } else if (source.attachedTo === 'caster') {
        charId = source.casterId;
    }

    if (charId) {
      const char = characters.find((c) => c.id === charId);
      return char?.position;
    }

    return undefined;
  }

  /**
   * Determines ambient light based on map theme.
   */
  private static getAmbientLight(mapData: BattleMapData): LightLevel {
    // Underdark themes default to darkness
    if (['cave', 'dungeon'].includes(mapData.theme)) {
      return 'darkness';
    }
    // Surface themes default to bright (Daytime assumption for now)
    // TODO: Time of Day system integration
    return 'bright';
  }
}
