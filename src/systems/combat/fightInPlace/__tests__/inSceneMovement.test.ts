import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile } from '../../../../types/combat';
import {
  patchTileToWorldMeters,
  worldMetersToPatchTile,
  computeReachableTiles,
  validateInSceneMove,
  GROUND_METERS_PER_CELL_FIP,
} from '../inSceneMovement';

// -----------------------------------------------------------------------------
// Fight-in-place slice 2 — the invisible referee's in-scene movement contract.
//
// The whole point of the slice: a click on the 3D ground picks a WORLD-METERS
// position; the referee maps it to a 5-ft tile of the extracted patch and rules
// the move legal or not against the SAME reachability the 2D board uses. These
// tests pin that world-pos → tile → legality pipeline so the in-scene click can
// never disagree with the underlying tile engine.
// -----------------------------------------------------------------------------

const CELL = GROUND_METERS_PER_CELL_FIP; // 1.524 m == 5 ft

/**
 * A minimal extracted-style patch. `extractLocalTerrainPatch` places the player
 * at the geometric CENTER tile and each tile spans 5 ft from the player's world
 * meters — this fixture mirrors that origin math so the mapping tests exercise
 * the real contract.
 */
function makePatch(
  width: number,
  height: number,
  blocked: Array<[number, number]> = [],
): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  const blockedSet = new Set(blocked.map(([x, y]) => `${x}-${y}`));
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const id = `${tx}-${ty}`;
      tiles.set(id, {
        id,
        coordinates: { x: tx, y: ty },
        terrain: 'grass',
        elevation: 0,
        movementCost: 5,
        blocksLoS: false,
        blocksMovement: blockedSet.has(id),
        decoration: null,
        effects: [],
      });
    }
  }
  return { dimensions: { width, height }, tiles, theme: 'forest', seed: 1 };
}

describe('fight-in-place in-scene movement referee', () => {
  describe('world-meters ↔ patch-tile mapping', () => {
    it('maps the player world position to the geometric center tile', () => {
      const patch = makePatch(40, 30);
      // The patch was extracted centered on (playerX, playerZ). At the extraction
      // anchor the tile is the center.
      const anchor = { playerXM: 100, playerZM: 250 };
      const tile = worldMetersToPatchTile(patch, anchor, 100, 250);
      expect(tile).toEqual({ x: 20, y: 15 });
    });

    it('maps one cell east/north to the adjacent tile', () => {
      const patch = makePatch(40, 30);
      const anchor = { playerXM: 100, playerZM: 250 };
      const east = worldMetersToPatchTile(patch, anchor, 100 + CELL, 250);
      expect(east).toEqual({ x: 21, y: 15 });
      const north = worldMetersToPatchTile(patch, anchor, 100, 250 - CELL);
      expect(north).toEqual({ x: 20, y: 14 });
    });

    it('round-trips tile → world → tile', () => {
      const patch = makePatch(40, 30);
      const anchor = { playerXM: 100, playerZM: 250 };
      for (const t of [
        { x: 20, y: 15 },
        { x: 0, y: 0 },
        { x: 39, y: 29 },
        { x: 25, y: 10 },
      ]) {
        const world = patchTileToWorldMeters(patch, anchor, t.x, t.y);
        const back = worldMetersToPatchTile(patch, anchor, world.xM, world.zM);
        expect(back).toEqual(t);
      }
    });

    it('returns null for a world position outside the patch bounds', () => {
      const patch = makePatch(40, 30);
      const anchor = { playerXM: 100, playerZM: 250 };
      // 200 cells east is far past the 40-wide patch.
      const outside = worldMetersToPatchTile(patch, anchor, 100 + 200 * CELL, 250);
      expect(outside).toBeNull();
    });
  });

  describe('reachability (pure port of the 2D-board BFS)', () => {
    it('reaches tiles within the movement budget', () => {
      const patch = makePatch(40, 30);
      // 30 ft of movement == six 5-ft steps orthogonally.
      const reach = computeReachableTiles(patch, { x: 20, y: 15 }, 30);
      expect(reach.has('20-15')).toBe(true); // start
      expect(reach.has('26-15')).toBe(true); // 6 east, exactly 30 ft
      expect(reach.has('27-15')).toBe(false); // 7 east, 35 ft — out of budget
    });

    it('does not path through blocked tiles', () => {
      // Wall the column x=21 from y=13..17 so the eastward corridor is sealed
      // near the start row; the tile just past the wall is unreachable in a
      // tight budget that can't go around.
      const wall: Array<[number, number]> = [
        [21, 13], [21, 14], [21, 15], [21, 16], [21, 17],
      ];
      const patch = makePatch(40, 30, wall);
      const reach = computeReachableTiles(patch, { x: 20, y: 15 }, 10);
      expect(reach.has('21-15')).toBe(false); // the wall tile itself
      expect(reach.has('22-15')).toBe(false); // behind the wall, 10 ft can't detour
    });

    it('a zero-budget character reaches only its own tile', () => {
      const patch = makePatch(40, 30);
      const reach = computeReachableTiles(patch, { x: 20, y: 15 }, 0);
      expect([...reach]).toEqual(['20-15']);
    });
  });

  describe('validateInSceneMove — world click → tile → legality', () => {
    const patch = makePatch(40, 30);
    const anchor = { playerXM: 100, playerZM: 250 };

    it('accepts a click on a reachable ground position and returns its tile', () => {
      // Click three cells east of the player (15 ft) with a 30-ft budget.
      const clickX = 100 + 3 * CELL;
      const verdict = validateInSceneMove({
        patch,
        anchor,
        startTile: { x: 20, y: 15 },
        movementFeet: 30,
        worldXM: clickX,
        worldZM: 250,
      });
      expect(verdict.legal).toBe(true);
      expect(verdict.tile).toEqual({ x: 23, y: 15 });
    });

    it('rejects a click beyond the movement budget', () => {
      const clickX = 100 + 10 * CELL; // 50 ft east, budget only 30
      const verdict = validateInSceneMove({
        patch,
        anchor,
        startTile: { x: 20, y: 15 },
        movementFeet: 30,
        worldXM: clickX,
        worldZM: 250,
      });
      expect(verdict.legal).toBe(false);
      expect(verdict.tile).toEqual({ x: 30, y: 15 });
      expect(verdict.reason).toMatch(/range|reach|budget/i);
    });

    it('rejects a click onto a blocked tile', () => {
      const walled = makePatch(40, 30, [[23, 15]]);
      const clickX = 100 + 3 * CELL;
      const verdict = validateInSceneMove({
        patch: walled,
        anchor,
        startTile: { x: 20, y: 15 },
        movementFeet: 30,
        worldXM: clickX,
        worldZM: 250,
      });
      expect(verdict.legal).toBe(false);
      expect(verdict.reason).toMatch(/block|impassable|occupied/i);
    });

    it('rejects a click outside the patch entirely', () => {
      const verdict = validateInSceneMove({
        patch,
        anchor,
        startTile: { x: 20, y: 15 },
        movementFeet: 30,
        worldXM: 100 + 500 * CELL,
        worldZM: 250,
      });
      expect(verdict.legal).toBe(false);
      expect(verdict.tile).toBeNull();
      expect(verdict.reason).toMatch(/outside|bounds|off-map/i);
    });
  });
});
