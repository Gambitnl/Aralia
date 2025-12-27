
import { describe, it, expect } from 'vitest';
import { VisibilitySystem } from '../VisibilitySystem';
import { BattleMapData, BattleMapTile, LightSource, CombatCharacter } from '../../types/combat';

// Mock Data Generators
function createMockMap(width: number, height: number): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      tiles.set(`${x}-${y}`, {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: 'floor',
        elevation: 0,
        movementCost: 1,
        blocksLoS: false,
        blocksMovement: false,
        decoration: null,
        effects: []
      });
    }
  }
  return {
    dimensions: { width, height },
    tiles,
    theme: 'dungeon',
    seed: 123
  };
}

function addWall(map: BattleMapData, x: number, y: number) {
  const tile = map.tiles.get(`${x}-${y}`);
  if (tile) {
    tile.blocksLoS = true;
    tile.terrain = 'wall';
  }
}

describe('VisibilitySystem', () => {
  describe('calculateLightLevels', () => {
    it('should default to darkness in absence of light sources', () => {
      const map = createMockMap(10, 10);
      const lightMap = VisibilitySystem.calculateLightLevels(map, []);

      expect(lightMap.get('0-0')).toBe('darkness');
      expect(lightMap.get('5-5')).toBe('darkness');
    });

    it('should apply bright and dim light correctly', () => {
      const map = createMockMap(20, 20);
      const source: LightSource = {
        id: 'l1',
        sourceSpellId: 'spell1',
        casterId: 'c1',
        attachedTo: 'point',
        position: { x: 10, y: 10 },
        brightRadius: 10, // 2 tiles (5ft per tile)
        dimRadius: 10,    // 2 tiles -> Total 20ft (4 tiles)
        createdTurn: 1
      };

      const lightMap = VisibilitySystem.calculateLightLevels(map, [source]);

      // Center should be bright
      expect(lightMap.get('10-10')).toBe('bright');
      // 10ft away (2 tiles) should be bright
      expect(lightMap.get('12-10')).toBe('bright');
      // 15ft away (3 tiles) should be dim
      expect(lightMap.get('13-10')).toBe('dim');
      // 20ft away (4 tiles) should be dim
      expect(lightMap.get('14-10')).toBe('dim');
      // 25ft away (5 tiles) should be darkness
      expect(lightMap.get('15-10')).toBe('darkness');
    });

    it('should be blocked by walls (shadows)', () => {
      const map = createMockMap(10, 10);
      const source: LightSource = {
        id: 'l1',
        sourceSpellId: 'spell1',
        casterId: 'c1',
        attachedTo: 'point',
        position: { x: 2, y: 2 },
        brightRadius: 20,
        dimRadius: 0,
        createdTurn: 1
      };

      // Wall at (3,2) blocking East
      addWall(map, 3, 2);

      const lightMap = VisibilitySystem.calculateLightLevels(map, [source]);

      expect(lightMap.get('2-2')).toBe('bright'); // Origin
      expect(lightMap.get('3-2')).toBe('bright'); // The wall itself is lit
      expect(lightMap.get('4-2')).toBe('darkness'); // Behind the wall
    });
  });

  describe('getVisibleTiles', () => {
    it('should allow characters with Darkvision to see in darkness', () => {
      const map = createMockMap(10, 10);
      // No lights -> All darkness
      const lightMap = VisibilitySystem.calculateLightLevels(map, []);

      const char = {
        id: 'c1',
        position: { x: 5, y: 5 },
        stats: {
          senses: { darkvision: 15, blindsight: 0, tremorsense: 0, truesight: 0 } // 3 tiles
        }
      } as CombatCharacter;

      const visible = VisibilitySystem.getVisibleTiles(char, map, lightMap);

      expect(visible.has('5-5')).toBe(true); // Self
      expect(visible.has('8-5')).toBe(true); // 15ft away
      expect(visible.has('9-5')).toBe(false); // 20ft away (too far)
    });

    it('should not allow characters without Darkvision to see in darkness', () => {
      const map = createMockMap(10, 10);
      const lightMap = VisibilitySystem.calculateLightLevels(map, []);

      const char = {
        id: 'c1',
        position: { x: 5, y: 5 },
        stats: {
          senses: { darkvision: 0 }
        }
      } as CombatCharacter;

      const visible = VisibilitySystem.getVisibleTiles(char, map, lightMap);

      // Can't see anything in total darkness?
      // Technically you can't see the TILES.
      // You might know your own square, but strictly visual? No.
      expect(visible.has('6-5')).toBe(false);
    });

    it('should allow vision in bright/dim light regardless of Darkvision', () => {
      const map = createMockMap(10, 10);
      const source: LightSource = {
        id: 'l1',
        sourceSpellId: 's1',
        casterId: 'c1',
        attachedTo: 'point',
        position: { x: 5, y: 5 },
        brightRadius: 30,
        dimRadius: 0,
        createdTurn: 1
      };
      const lightMap = VisibilitySystem.calculateLightLevels(map, [source]);

      const char = {
        id: 'c1',
        position: { x: 2, y: 2 }, // Within light
        stats: { senses: { darkvision: 0 } }
      } as CombatCharacter;

      const visible = VisibilitySystem.getVisibleTiles(char, map, lightMap);

      // Can see the illuminated center
      expect(visible.has('5-5')).toBe(true);
    });
  });
});
