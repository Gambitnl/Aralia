
import { describe, it, expect } from 'vitest';
import { heuristic } from '../pathfinding';
import { BattleMapTile } from '../../types/combat';

describe('Pathfinding Heuristic (Chebyshev Distance)', () => {
  // Helper to create minimal tiles for testing
  const createTile = (x: number, y: number): BattleMapTile => ({
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'grass',
    elevation: 0,
    movementCost: 1,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  });

  it('calculates correct distance for cardinal movement', () => {
    const start = createTile(0, 0);
    const endX = createTile(5, 0); // 5 tiles right
    const endY = createTile(0, 3); // 3 tiles down

    expect(heuristic(start, endX)).toBe(5);
    expect(heuristic(start, endY)).toBe(3);
  });

  it('calculates correct distance for diagonal movement', () => {
    const start = createTile(0, 0);
    const end = createTile(4, 4); // 4 diagonal steps

    // Manhattan would be 8. Chebyshev is 4.
    expect(heuristic(start, end)).toBe(4);
  });

  it('calculates correct distance for mixed movement (knight\'s move etc)', () => {
    const start = createTile(0, 0);
    const end = createTile(2, 5);

    // dx=2, dy=5.
    // Manhattan: 2+5=7
    // Chebyshev: max(2,5)=5
    expect(heuristic(start, end)).toBe(5);
  });

  it('is symmetric', () => {
    const a = createTile(2, 3);
    const b = createTile(10, 8);
    expect(heuristic(a, b)).toBe(heuristic(b, a));
  });

  it('is zero for same tile', () => {
    const a = createTile(5, 5);
    expect(heuristic(a, a)).toBe(0);
  });
});
