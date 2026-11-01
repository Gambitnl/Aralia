/**
 * The fight-in-place view draws the 3D arena's generated bodies (2026-10-30).
 * The arena places an actor at its tile + 0.5 in units of one 5 ft tile; the
 * fight scales one unit to 1.524 m. These tests pin that a body's tile center
 * lands exactly on its token's world point, for the patch mapping and for a
 * token placed by its source meters.
 */
import { describe, expect, it } from 'vitest';
import { arenaGroupOriginM } from '../InPlaceCombatLayer';
import { GROUND_METERS_PER_CELL_FIP as U } from '@/systems/combat/fightInPlace/inSceneMovement';

const anchor = { xM: 467.66, zM: 465.46 };
const dims = { width: 41, height: 31 };

/** Where the arena puts the actor's tile center, in world meters, under this group origin. */
const bodyAt = (origin: { xM: number; zM: number }, tile: { x: number; y: number }) => ({
  xM: origin.xM + (tile.x + 0.5) * U,
  zM: origin.zM + (tile.y + 0.5) * U,
});

describe('arenaGroupOriginM', () => {
  it('puts a body on the extraction point of its tile', () => {
    for (const tile of [{ x: 20, y: 15 }, { x: 0, y: 0 }, { x: 33, y: 4 }]) {
      const token = { xM: anchor.xM + (tile.x - 20) * U, zM: anchor.zM + (tile.y - 15) * U };
      const at = bodyAt(arenaGroupOriginM(token, tile, anchor, dims), tile);
      expect(at.xM).toBeCloseTo(token.xM, 9);
      expect(at.zM).toBeCloseTo(token.zM, 9);
    }
  });

  it('follows a token placed by its source meters, off the patch mapping', () => {
    const tile = { x: 22, y: 12 };
    const token = { xM: anchor.xM + 2 * U + 0.4, zM: anchor.zM - 3 * U - 0.7 };
    const at = bodyAt(arenaGroupOriginM(token, tile, anchor, dims), tile);
    expect(at.xM).toBeCloseTo(token.xM, 9);
    expect(at.zM).toBeCloseTo(token.zM, 9);
  });
});
