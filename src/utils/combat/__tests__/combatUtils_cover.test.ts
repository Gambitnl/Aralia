
import { describe, it, expect } from 'vitest';
import { calculateCover } from '../combatUtils';
import { BattleMapData, BattleMapTile } from '../../types/combat';

describe('calculateCover', () => {
  const createMap = (tiles: Partial<BattleMapTile>[]): BattleMapData => {
    const mapTiles = new Map<string, BattleMapTile>();
    tiles.forEach(t => {
      const tile = {
        id: `${t.coordinates!.x}-${t.coordinates!.y}`,
        terrain: 'grass',
        elevation: 0,
        movementCost: 1,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: [],
        ...t
      } as BattleMapTile;
      mapTiles.set(tile.id, tile);
    });

    return {
      dimensions: { width: 10, height: 10 },
      tiles: mapTiles,
      theme: 'forest',
      seed: 123
    };
  };

  it('should return 0 for adjacent targets (no room for cover)', () => {
    const map = createMap([
      { coordinates: { x: 0, y: 0 } },
      { coordinates: { x: 1, y: 0 } }
    ]);
    const bonus = calculateCover({ x: 0, y: 0 }, { x: 1, y: 0 }, map);
    expect(bonus).toBe(0);
  });

  it('should return 0 for clear shot at range', () => {
    const map = createMap([
      { coordinates: { x: 0, y: 0 } },
      { coordinates: { x: 1, y: 0 } }, // Empty space
      { coordinates: { x: 2, y: 0 } },
      { coordinates: { x: 3, y: 0 } }
    ]);
    const bonus = calculateCover({ x: 0, y: 0 }, { x: 3, y: 0 }, map);
    expect(bonus).toBe(0);
  });

  it('should return 2 if a tile in between provides cover', () => {
    const map = createMap([
      { coordinates: { x: 0, y: 0 } },
      { coordinates: { x: 1, y: 0 }, providesCover: true, decoration: 'tree' }, // Cover!
      { coordinates: { x: 2, y: 0 } }
    ]);
    const bonus = calculateCover({ x: 0, y: 0 }, { x: 2, y: 0 }, map);
    expect(bonus).toBe(2);
  });

  it('should return 2 if multiple tiles provide cover (same type)', () => {
    const map = createMap([
      { coordinates: { x: 0, y: 0 } },
      { coordinates: { x: 1, y: 0 }, providesCover: true, decoration: 'tree' },
      { coordinates: { x: 2, y: 0 }, providesCover: true, decoration: 'boulder' },
      { coordinates: { x: 3, y: 0 } }
    ]);
    const bonus = calculateCover({ x: 0, y: 0 }, { x: 3, y: 0 }, map);
    expect(bonus).toBe(2);
  });

  it('should return 5 (Three-Quarters Cover) if a pillar is in the way', () => {
    const map = createMap([
      { coordinates: { x: 0, y: 0 } },
      { coordinates: { x: 1, y: 0 }, providesCover: true, decoration: 'pillar' },
      { coordinates: { x: 2, y: 0 } }
    ]);
    const bonus = calculateCover({ x: 0, y: 0 }, { x: 2, y: 0 }, map);
    expect(bonus).toBe(5);
  });

  it('should return 5 if there is a mix of half and three-quarters cover', () => {
    const map = createMap([
      { coordinates: { x: 0, y: 0 } },
      { coordinates: { x: 1, y: 0 }, providesCover: true, decoration: 'tree' }, // +2
      { coordinates: { x: 2, y: 0 }, providesCover: true, decoration: 'pillar' }, // +5
      { coordinates: { x: 3, y: 0 } }
    ]);
    const bonus = calculateCover({ x: 0, y: 0 }, { x: 3, y: 0 }, map);
    expect(bonus).toBe(5);
  });

  it('should return 0 if the cover tile is the start or end tile', () => {
    const map = createMap([
      { coordinates: { x: 0, y: 0 }, providesCover: true },
      { coordinates: { x: 1, y: 0 } },
      { coordinates: { x: 2, y: 0 }, providesCover: true }
    ]);
    const bonus = calculateCover({ x: 0, y: 0 }, { x: 2, y: 0 }, map);
    expect(bonus).toBe(0);
  });

  it('should work for diagonal lines', () => {
    const map = createMap([
      { coordinates: { x: 0, y: 0 } },
      { coordinates: { x: 1, y: 1 }, providesCover: true, decoration: 'tree' },
      { coordinates: { x: 2, y: 2 } }
    ]);
    const bonus = calculateCover({ x: 0, y: 0 }, { x: 2, y: 2 }, map);
    expect(bonus).toBe(2);
  });
});
