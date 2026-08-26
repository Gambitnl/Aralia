/**
 * This file proves terrain height carries referee consequences, not just numbers.
 *
 * The G14 combat-elevation slice gives five-foot steps three meanings (flat,
 * slope, cliff), makes cliff faces impassable walks, charges slope ascents as
 * climbing, lets crests block sight rays, and records the high-ground rule.
 * These focused examples protect those facts before battle-map hooks consume
 * them.
 *
 * Exercises: elevationSemantics.ts, pathfinding.ts, lineOfSight.ts.
 * Depends on: production battle-map records and the shared elevation ruler.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile } from '../../../types/combat';
import { assessElevationStep, assessVoluntaryDescent, getHighGroundAdvantage } from '../elevationSemantics';
import { findPath } from '../pathfinding';
import { hasLineOfSight } from '../lineOfSight';

// ============================================================================
// Shared Fixtures
// ============================================================================

function createTile(x: number, y: number, overrides: Partial<BattleMapTile> = {}): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'grass',
    elevation: 0,
    movementCost: 5,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
    ...overrides,
  };
}

function createMap(
  width: number,
  height: number,
  elevationFor?: (x: number, y: number) => number,
): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      const tile = createTile(x, y);
      if (elevationFor) tile.elevation = elevationFor(x, y);
      tiles.set(tile.id, tile);
    }
  }
  return { dimensions: { width, height }, tiles, theme: 'dungeon', seed: 42 };
}

describe('assessElevationStep referee classification', () => {
  it('treats a single contour band as ordinary walking in both directions', () => {
    const low = createTile(0, 0);
    const high = createTile(1, 0, { elevation: /* one band */ 5 });

    expect(assessElevationStep(low, high)).toMatchObject({
      kind: 'flat',
      riseFeet: 5,
      dropFeet: 0,
      requiresClimb: false,
      blocksWalking: false,
    });
    expect(assessElevationStep(high, low)).toMatchObject({
      kind: 'flat',
      riseFeet: 0,
      dropFeet: 5,
      requiresClimb: false,
      blocksWalking: false,
    });
  });

  it('counts a two-band ascent as climbing but keeps its descent a controlled walk', () => {
    const low = createTile(0, 0);
    const high = createTile(1, 0, { elevation: 10 });

    expect(assessElevationStep(low, high)).toMatchObject({
      kind: 'slope',
      riseFeet: 10,
      requiresClimb: true,
      blocksWalking: false,
    });

    // Dropping down a slope stays legal walking; falling rules own anything worse.
    expect(assessElevationStep(high, low)).toMatchObject({
      kind: 'slope',
      dropFeet: 10,
      requiresClimb: false,
      blocksWalking: false,
    });
  });

  it('marks any face taller than two bands as an unwalkable cliff', () => {
    const low = createTile(0, 0);
    const cliffTop = createTile(1, 0, { elevation: 15 });

    expect(assessElevationStep(low, cliffTop)).toMatchObject({
      kind: 'cliff',
      riseFeet: 15,
      blocksWalking: true,
    });
    // Stepping off the cliff is a fall, never a walk.
    expect(assessElevationStep(cliffTop, low)).toMatchObject({
      kind: 'cliff',
      dropFeet: 15,
      blocksWalking: true,
    });
  });
});

describe('getHighGroundAdvantage recorded house rule', () => {
  it('grants advantage only a full band or more above the target', () => {
    expect(getHighGroundAdvantage(10, 5).modifier).toBe('advantage');
    expect(getHighGroundAdvantage(5, 5).modifier).toBeNull();
    expect(getHighGroundAdvantage(4, 0).modifier).toBeNull();
  });

  it('disadvantages fighting a full band or more below the target', () => {
    expect(getHighGroundAdvantage(0, 5).modifier).toBe('disadvantage');
    expect(getHighGroundAdvantage(0, 4).modifier).toBeNull();
  });
});

describe('pathfinding obeys elevation referee facts', () => {
  it('cannot walk across a cliff wall spanning the board', () => {
    // A fifteen-foot face runs the full height at x=3, so every route crosses it.
    const map = createMap(8, 4, (x) => (x >= 3 ? 15 : 0));
    const path = findPath(map.tiles.get('0-1')!, map.tiles.get('4-1')!, map);
    expect(path).toEqual([]);
  });

  it('lets a climber cross the same cliff wall', () => {
    const map = createMap(8, 4, (x) => (x >= 3 ? 15 : 0));
    const path = findPath(map.tiles.get('0-1')!, map.tiles.get('4-1')!, map, {
      isClimbing: true,
    });
    expect(path.length).toBeGreaterThan(0);
    expect(path[0].id).toBe('0-1');
    expect(path[path.length - 1].id).toBe('4-1');
  });

  it('still routes over a ten-foot slope without any climb configuration', () => {
    const map = createMap(8, 4, (x) => (x >= 3 ? 10 : 0));
    const path = findPath(map.tiles.get('0-1')!, map.tiles.get('4-1')!, map);
    expect(path.length).toBeGreaterThan(0);
  });

  it('prefers a longer flat detour over a shorter climb when both exist', () => {
    // Cliff wall at x=2 except row y=0, which rises only ten feet (a slope).
    // The direct crossing is five feet of horizontal travel; the detour is
    // longer horizontally, so a walker must come back through the slope gap.
    const map = createMap(6, 3, (x, y) => {
      if (x === 2) return y === 0 ? 10 : 15;
      return 0;
    });
    const path = findPath(map.tiles.get('0-0')!, map.tiles.get('4-0')!, map);
    expect(path.length).toBeGreaterThan(0);
    for (const tile of path) {
      if (tile.coordinates.x === 2) {
        expect(tile.coordinates.y).toBe(0);
      }
    }
  });
});

describe('line of sight respects terrain relief', () => {
  it('blocks sight across an unflagged ridge higher than the eye ray', () => {
    const map = createMap(5, 5);
    map.tiles.get('2-0')!.elevation = 15;
    const start = map.tiles.get('0-0')!;
    const end = map.tiles.get('4-0')!;

    // Both eyes sit at five feet, so a fifteen-foot ridge mid-ray is cover.
    expect(hasLineOfSight(start, end, map)).toBe(false);
  });

  it('keeps two observers on the same plateau visible across a lower saddle', () => {
    const map = createMap(5, 5, (x) => (x === 2 ? 0 : 20));
    const start = map.tiles.get('0-0')!;
    const end = map.tiles.get('4-0')!;

    // Eyes ride at twenty-five feet over a zero-foot saddle: clear view.
    expect(hasLineOfSight(start, end, map)).toBe(true);
  });

  it('looks over a crest from high ground but not through a taller wall of rock', () => {
    const map = createMap(5, 5, (x) => (x === 0 ? 30 : x === 2 ? 15 : 0));
    const start = map.tiles.get('0-0')!;
    const end = map.tiles.get('4-0')!;

    // The ray falls from thirty-five feet to five; at the midpoint it rides
    // twenty feet up, clearing the fifteen-foot crest below it.
    expect(hasLineOfSight(start, end, map)).toBe(true);

    // Raise the crest to twenty-five feet and it now intersects the ray.
    map.tiles.get('2-0')!.elevation = 25;
    expect(hasLineOfSight(start, end, map)).toBe(false);
  });
});

describe('assessVoluntaryDescent handoff facts', () => {
  it('converts an edge step off a cliff into fall distance', () => {
    const top = createTile(3, 1, { elevation: 15 });
    const ground = createTile(2, 1);

    expect(assessVoluntaryDescent(top, ground)).toEqual({
      walkableWithoutFalling: false,
      fallDistanceFeet: 15,
    });
  });

  it('keeps slope and flat step-downs as ordinary walking with no fall event', () => {
    const high = createTile(0, 0, { elevation: 10 });
    const low = createTile(1, 0);

    expect(assessVoluntaryDescent(high, low)).toEqual({
      walkableWithoutFalling: true,
      fallDistanceFeet: 0,
    });
  });

  it('marks a climb attempt up a cliff as blocked without inventing a fall', () => {
    const ground = createTile(2, 1);
    const cliffTop = createTile(3, 1, { elevation: 20 });

    // Ascending is not a descent; the caller must reject it before bridging.
    expect(assessVoluntaryDescent(ground, cliffTop)).toEqual({
      walkableWithoutFalling: false,
      fallDistanceFeet: 0,
    });
  });
});