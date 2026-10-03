/**
 * This file proves the shared creature-size geometry used by tactical combat.
 *
 * It covers size-to-footprint conversion, nearest-footprint distance, and the
 * reusable placement boundary for walls, map edges, and other creatures. The
 * Tactical Sandbox Reach & Creature Size lane relies on these same functions,
 * so its visible explanation cannot drift from the combat geometry.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import {
  getCharacterDistance,
  getOccupiedTiles,
  validateCharacterPlacement,
} from '../combatUtils';

// ============================================================================
// Deterministic Map And Creature Fixtures
// ============================================================================
// The wall at 5,5 is invisible to a Large creature's top-left anchor at 4,4,
// but it blocks the bottom-right square of that creature's 2-by-2 footprint.
// ============================================================================

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: x === 5 && y === 5 ? 'wall' : 'floor',
        elevation: 0,
        movementCost: 5,
        blocksLoS: x === 5 && y === 5,
        blocksMovement: x === 5 && y === 5,
        decoration: null,
        effects: [],
      });
    }
  }

  return {
    dimensions: { width: 8, height: 8 },
    tiles,
    theme: 'dungeon',
    seed: 52,
  };
}

function createSizedCharacter(
  id: string,
  size: NonNullable<CombatCharacter['stats']['size']>,
  position: { x: number; y: number },
): CombatCharacter {
  const base = createMockCombatCharacter({ id, name: id, position });
  return {
    ...base,
    stats: { ...base.stats, size },
  };
}

// ============================================================================
// Canonical Size Geometry
// ============================================================================
// These assertions pin the top-left anchor rule and prove distance uses the
// nearest occupied squares rather than the two actor anchors.
// ============================================================================

describe('combat creature-size geometry', () => {
  it('expands a Large top-left anchor into its complete 2-by-2 footprint', () => {
    const large = createSizedCharacter('large', 'Large', { x: 2, y: 3 });

    expect(getOccupiedTiles(large)).toEqual([
      { x: 2, y: 3 },
      { x: 2, y: 4 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
    ]);
  });

  it('measures range from the nearest footprint squares instead of anchors', () => {
    const large = createSizedCharacter('large', 'Large', { x: 2, y: 3 });
    const medium = createSizedCharacter('medium', 'Medium', { x: 5, y: 4 });

    expect(getCharacterDistance(large, medium)).toBe(2);
  });

  it('rejects a Large placement when only its far footprint square hits a wall', () => {
    const mapData = createMap();
    const large = createSizedCharacter('large', 'Large', { x: 1, y: 1 });
    const result = validateCharacterPlacement(large, { x: 4, y: 4 }, mapData);

    expect(result.allowed).toBe(false);
    expect(result.occupiedTiles).toContainEqual({ x: 5, y: 5 });
    expect(result.reason).toContain('blocked at 5,5');
  });

  it('rejects full-footprint map edges and living-creature overlap', () => {
    const mapData = createMap();
    const large = createSizedCharacter('large', 'Large', { x: 1, y: 1 });
    const blocker = createSizedCharacter('blocker', 'Medium', { x: 3, y: 2 });

    const edge = validateCharacterPlacement(large, { x: 7, y: 7 }, mapData, [large]);
    const overlap = validateCharacterPlacement(large, { x: 2, y: 2 }, mapData, [large, blocker]);

    expect(edge.allowed).toBe(false);
    expect(edge.reason).toContain('leaves the battle map');
    expect(overlap.allowed).toBe(false);
    expect(overlap.blockerId).toBe(blocker.id);
    expect(overlap.reason).toContain('overlaps blocker');
  });
});
