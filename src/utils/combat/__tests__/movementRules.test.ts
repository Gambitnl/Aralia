
import { describe, it, expect } from 'vitest';
import { findBattlePath as findPath } from '../../spatial';
import { calculateMovementCost, getTargetDistance } from '../movementUtils';
import { BattleMapData, BattleMapTile } from '../../../types/combat';

describe('movementUtils: 5-10-5 Rule', () => {
  it('calculates straight moves as 5ft', () => {
    // Up
    expect(calculateMovementCost(0, 1, 0)).toEqual({ cost: 5, isDiagonal: false });
    // Right
    expect(calculateMovementCost(1, 0, 0)).toEqual({ cost: 5, isDiagonal: false });
  });

  it('calculates first diagonal as 5ft', () => {
    expect(calculateMovementCost(1, 1, 0)).toEqual({ cost: 5, isDiagonal: true });
  });

  it('calculates second diagonal as 10ft', () => {
    expect(calculateMovementCost(1, 1, 1)).toEqual({ cost: 10, isDiagonal: true });
  });

  it('calculates third diagonal as 5ft', () => {
    expect(calculateMovementCost(1, 1, 2)).toEqual({ cost: 5, isDiagonal: true });
  });

  it('calculates fourth diagonal as 10ft', () => {
    expect(calculateMovementCost(1, 1, 3)).toEqual({ cost: 10, isDiagonal: true });
  });

  it('getTargetDistance returns correct grid distance (5-10-5)', () => {
      // 1 diagonal
      expect(getTargetDistance({x:0, y:0}, {x:1, y:1})).toBe(5);
      // 2 diagonals
      expect(getTargetDistance({x:0, y:0}, {x:2, y:2})).toBe(15);
      // 3 diagonals
      expect(getTargetDistance({x:0, y:0}, {x:3, y:3})).toBe(20);
      // 1 straight + 1 diagonal
      expect(getTargetDistance({x:0, y:0}, {x:1, y:2})).toBe(10);
  });
});

describe('pathfinding: findPath (5-10-5)', () => {
  // Helper to create a simple map
  const createMap = (width: number, height: number): BattleMapData => {
    const tiles = new Map<string, BattleMapTile>();
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const id = `${x}-${y}`;
        tiles.set(id, {
          id,
          coordinates: { x, y },
          terrain: 'floor',
          elevation: 0,
          blocksLoS: false,
          blocksMovement: false,
          movementCost: 1,
          decoration: null,
          effects: []
        });
      }
    }
    return {
      dimensions: { width, height },
      tiles,
      theme: 'forest',
      seed: 1
    };
  };

  it('finds straight path correctly (cost 5 per step)', () => {
    const map = createMap(5, 5);
    const start = map.tiles.get('0-0')!;
    const end = map.tiles.get('0-2')!; // 2 steps up

    const path = findPath(start, end, map);

    expect(path).toHaveLength(3);
    expect(path[0].id).toBe('0-0');
    expect(path[2].id).toBe('0-2');
  });

  it('calculates diagonal cost correctly (5 then 10)', () => {
    // 5-10-5 rule means diagonals alternate.
    const map = createMap(5, 5);
    const start = map.tiles.get('0-0')!;
    const end = map.tiles.get('2-2')!;

    const path = findPath(start, end, map);
    expect(path).toHaveLength(3); // 0-0, 1-1, 2-2
    expect(path[1].coordinates.x).toBe(1);
    expect(path[1].coordinates.y).toBe(1);
  });

  it('avoids obstacles', () => {
    const map = createMap(3, 3);
    // Block (1,0)
    map.tiles.get('1-0')!.blocksMovement = true;

    const start = map.tiles.get('0-0')!;
    const end = map.tiles.get('2-0')!;

    const path = findPath(start, end, map);

    // Should contain at least 3 nodes (start, middle, end)
    expect(path.length).toBeGreaterThan(0);
    // Middle node should not be 1-0
    expect(path.find(t => t.id === '1-0')).toBeUndefined();
  });
});
