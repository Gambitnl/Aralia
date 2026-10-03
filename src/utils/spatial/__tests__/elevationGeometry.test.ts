/**
 * This file proves the tactical map uses one three-dimensional ruler.
 *
 * Range and movement both combine horizontal grid travel with real vertical
 * feet from terrain or a flying creature. These focused examples protect the
 * shared geometry before the battle-map hooks consume it.
 *
 * Exercises: elevationGeometry.ts.
 * Depends on: production battle-map and combat-character records.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import {
  getBattleMapTileAltitudeFeet,
  getCombatDistanceFeet,
  getCombatantAltitudeFeet,
  getCombatantToPositionDistanceFeet,
  getElevationTransitionCostFeet,
} from '../elevationGeometry';

// ============================================================================
// Shared Three-Dimensional Fixture
// ============================================================================
// The map rises ten feet at x=3. A grounded target and a flyer let the tests
// prove terrain and explicit altitude use the same local-zero-foot ruler.
// ============================================================================

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < 8; x += 1) {
    for (let y = 0; y < 4; y += 1) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: x >= 3 ? 'rock' : 'floor',
        elevation: x >= 3 ? 10 : 0,
        movementCost: 5,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: [],
      });
    }
  }
  return { dimensions: { width: 8, height: 4 }, tiles, theme: 'dungeon', seed: 12 };
}

describe('elevationGeometry shared ruler', () => {
  it('measures grounded terrain and explicit aerial altitude in whole feet', () => {
    const mapData = createMap();
    const grounded = createMockCombatCharacter({ position: { x: 3, y: 1 } });
    const flyer = createMockCombatCharacter({
      position: { x: 1, y: 1 },
      aerialMovement: { altitudeFeet: 25, isFlying: true, canHover: true, source: 'test' },
    });

    expect(getBattleMapTileAltitudeFeet(mapData.tiles.get('3-1')!)).toBe(10);
    expect(getCombatantAltitudeFeet(grounded, mapData, grounded.position)).toBe(10);
    expect(getCombatantAltitudeFeet(flyer, mapData, flyer.position)).toBe(25);
  });

  it('adds vertical separation to the closest horizontal footprint distance', () => {
    const mapData = createMap();
    const tester = createMockCombatCharacter({ position: { x: 0, y: 1 } });
    const raisedTarget = createMockCombatCharacter({ position: { x: 4, y: 1 } });

    // Twenty horizontal feet plus ten vertical feet is exactly thirty feet.
    expect(getCombatDistanceFeet(tester, raisedTarget, mapData)).toBe(30);
    expect(getCombatantToPositionDistanceFeet(tester, { x: 4, y: 1 }, mapData)).toBe(30);
  });

  it('charges both ascent and descent without changing either tile', () => {
    const mapData = createMap();
    const low = mapData.tiles.get('2-1')!;
    const high = mapData.tiles.get('3-1')!;

    expect(getElevationTransitionCostFeet(low, high)).toBe(10);
    expect(getElevationTransitionCostFeet(high, low)).toBe(10);
    expect(low.elevation).toBe(0);
    expect(high.elevation).toBe(10);
  });
});
