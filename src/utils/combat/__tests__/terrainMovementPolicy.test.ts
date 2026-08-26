import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTerrain, BattleMapTile } from '../../../types/combat';
import { findBattlePath as findPath } from '../../spatial';
import {
  ANY_DIFFICULT_TERRAIN_POLICY,
  EARTH_WALK_TERRAIN_POLICY,
  TIMBERWALK_TERRAIN_POLICY,
  calculatePathMovementCost,
  getPolicyAwareTileMovementMultiplier,
  resolveTerrainMovementPolicyFromTraits,
} from '../movementUtils';

// -----------------------------------------------------------------------------
// agora-395a — the race-aware terrain movement policy seam.
//
// Character records flatten Earth Walk and Timberwalk into one unconditional
// `ignoreDifficultTerrain` boolean, which loses the surface each trait names.
// These tests pin the seam that keeps the qualifier attached to the rule, and
// prove production pathfinding and production path costing both consult it.
// -----------------------------------------------------------------------------

function makeTile(
  x: number,
  y: number,
  overrides: Partial<BattleMapTile> = {},
): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'difficult',
    elevation: 0,
    movementCost: 10,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
    ...overrides,
  };
}

/** A one-row corridor of difficult squares, all of one terrain kind. */
function makeCorridor(length: number, terrain: BattleMapTerrain): BattleMapTile[] {
  return Array.from({ length }, (_, x) => makeTile(x, 0, { terrain }));
}

describe('terrain movement policy seam', () => {
  describe('reading the policy out of canonical trait text', () => {
    it('reads Earth Walk with its ground-or-floor qualifier intact', () => {
      const policy = resolveTerrainMovementPolicyFromTraits([
        'Size: Medium',
        'Earth Walk: You can move across Difficult Terrain without expending extra movement if you are walking on the ground or a floor.',
      ]);
      expect(policy?.id).toBe('earth-walk');
    });

    it('reads Timberwalk, which the boolean flag parser never matched', () => {
      const policy = resolveTerrainMovementPolicyFromTraits([
        'Timberwalk: Ability checks made to track you have Disadvantage, and you can move across difficult terrain made of nonmagical plants and undergrowth without expending extra movement.',
      ]);
      expect(policy?.id).toBe('timberwalk');
    });

    it('falls back to the unqualified waiver when a trait names no surface', () => {
      const policy = resolveTerrainMovementPolicyFromTraits([
        'Sure-Footed: You can move across Difficult Terrain without expending extra movement.',
      ]);
      expect(policy?.id).toBe('any-difficult-terrain');
    });

    it('returns null when nothing waives the surcharge', () => {
      expect(resolveTerrainMovementPolicyFromTraits(['Darkvision: 60 feet.'])).toBeNull();
      expect(resolveTerrainMovementPolicyFromTraits(undefined)).toBeNull();
    });
  });

  describe('per-tile qualifiers', () => {
    it('waives Earth Walk on ground and floors', () => {
      for (const terrain of ['grass', 'rock', 'difficult', 'floor', 'sand', 'mud'] as const) {
        expect(EARTH_WALK_TERRAIN_POLICY.ignoresDifficultTerrain(makeTile(0, 0, { terrain })))
          .toBe(true);
      }
    });

    it('does NOT waive Earth Walk in difficult water — the qualifier the flag lost', () => {
      const water = makeTile(0, 0, { terrain: 'water' });
      expect(EARTH_WALK_TERRAIN_POLICY.ignoresDifficultTerrain(water)).toBe(false);
      expect(getPolicyAwareTileMovementMultiplier(water, EARTH_WALK_TERRAIN_POLICY)).toBe(2);
    });

    it('waives Timberwalk only for plants and undergrowth', () => {
      expect(TIMBERWALK_TERRAIN_POLICY.ignoresDifficultTerrain(
        makeTile(0, 0, { terrain: 'grass' }),
      )).toBe(true);
      expect(TIMBERWALK_TERRAIN_POLICY.ignoresDifficultTerrain(
        makeTile(0, 0, { terrain: 'rock', decoration: 'bush' }),
      )).toBe(true);
      // Bare rubble is difficult ground, not undergrowth.
      expect(TIMBERWALK_TERRAIN_POLICY.ignoresDifficultTerrain(
        makeTile(0, 0, { terrain: 'difficult' }),
      )).toBe(false);
    });

    it('never waives a square nothing can enter', () => {
      const wall = makeTile(0, 0, { terrain: 'floor', blocksMovement: true });
      expect(EARTH_WALK_TERRAIN_POLICY.ignoresDifficultTerrain(wall)).toBe(false);
      expect(ANY_DIFFICULT_TERRAIN_POLICY.ignoresDifficultTerrain(wall)).toBe(false);
    });

    it('leaves ordinary terrain alone for every policy', () => {
      const plain = makeTile(0, 0, { terrain: 'grass', movementCost: 5 });
      expect(getPolicyAwareTileMovementMultiplier(plain, null)).toBe(1);
      expect(getPolicyAwareTileMovementMultiplier(plain, EARTH_WALK_TERRAIN_POLICY)).toBe(1);
    });
  });

  describe('production path costing', () => {
    it('charges the surcharge with no policy and waives it with Earth Walk', () => {
      const path = makeCorridor(4, 'difficult');
      expect(calculatePathMovementCost(path)).toBe(30);
      expect(calculatePathMovementCost(path, EARTH_WALK_TERRAIN_POLICY)).toBe(15);
    });

    it('still charges an Earth Walker for wading difficult water', () => {
      const path = makeCorridor(4, 'water');
      expect(calculatePathMovementCost(path, EARTH_WALK_TERRAIN_POLICY)).toBe(30);
    });
  });

  describe('production pathfinding', () => {
    /** Two routes from (0,0) to (4,0): the short difficult row, or a clear detour. */
    function makeSplitMap(): BattleMapData {
      const tiles = new Map<string, BattleMapTile>();
      for (let y = 0; y <= 2; y += 1) {
        for (let x = 0; x <= 4; x += 1) {
          const onDifficultRow = y === 0 && x > 0 && x < 4;
          tiles.set(`${x}-${y}`, makeTile(x, y, {
            terrain: onDifficultRow ? 'difficult' : 'grass',
            movementCost: onDifficultRow ? 10 : 5,
          }));
        }
      }
      return { dimensions: { width: 5, height: 3 }, tiles, theme: 'forest', seed: 1 };
    }

    it('routes an ordinary mover around the difficult row', () => {
      const map = makeSplitMap();
      const path = findPath(map.tiles.get('0-0')!, map.tiles.get('4-0')!, map);
      expect(path.length).toBeGreaterThan(0);
      expect(path.some(tile => tile.coordinates.y !== 0)).toBe(true);
    });

    it('routes an Earth Walker straight through it', () => {
      const map = makeSplitMap();
      const path = findPath(
        map.tiles.get('0-0')!,
        map.tiles.get('4-0')!,
        map,
        {},
        1,
        EARTH_WALK_TERRAIN_POLICY,
      );
      expect(path.map(tile => tile.id)).toEqual(['0-0', '1-0', '2-0', '3-0', '4-0']);
    });
  });
});
