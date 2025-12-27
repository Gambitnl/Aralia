
import { describe, it, expect } from 'vitest';
import { VisibilitySystem } from '../VisibilitySystem';
import { BattleMapData, BattleMapTile, LightSource, CombatCharacter } from '../../../types/combat';

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

      // We expect units to be 5ft.
      // 10ft bright = 2 units.
      // 12-10 is distance 2. sqrt(2^2 + 0^2) = 2. 2 <= 2 is TRUE.
      expect(lightMap.get('12-10')).toBe('bright');

      // 15ft away (3 units).
      // 13-10 is distance 3.
      // Bright radius = 2. (3 <= 2) FALSE.
      // Max radius (Dim) = 10+10 = 20ft = 4 units.
      // (3 <= 4) TRUE.
      // So it should be DIM.
      expect(lightMap.get('13-10')).toBe('dim');

      // 20ft away (4 units).
      expect(lightMap.get('14-10')).toBe('dim');

      // 25ft away (5 units).
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

  describe('calculateVisibility', () => {
    it('should allow characters with Darkvision to see in darkness', () => {
      const map = createMockMap(10, 10);
      // No lights -> All darkness
      const lightMap = VisibilitySystem.calculateLightLevels(map, []);

      const char = {
        id: 'c1',
        position: { x: 5, y: 5 },
        stats: {
          senses: { darkvision: 15, blindsight: 0, tremorsense: 0, truesight: 0 } // 3 tiles (using 15 units if units are feet?)
          // Wait, units. System assumes unit=1.
          // If darkvision is 15, does it mean 15 units or 15 feet?
          // The system compares distance (units) to radius (units).
          // If previous test used radius=10 for 2 tiles, then units != feet.
          // If radius=10 meant 10 units, then 1 unit = 1 foot.
          // BUT map grid is x,y. Usually 1 tile = 5 feet.
          // If I pass darkvision: 15 (feet), and system compares to distance (tiles), it breaks.
          // 3 tiles distance = 3 units.
          // 3 <= 15 is true.
          // So if input is feet, system must divide by 5.
          // OR test must pass units.
          // Let's assume input is FEET and System divides by 5.
        }
      } as CombatCharacter;

      const visible = VisibilitySystem.calculateVisibility(char, map, lightMap);

      expect(visible.get('5-5')).toBe('dim'); // Self in darkness w/ DV
      // If DV=15 feet, and grid scale is 5, then radius = 3 units.
      // 8-5 is 3 units away.
      expect(visible.get('8-5')).toBe('dim');
      // 9-5 is 4 units away (20 feet).
      expect(visible.get('9-5')).toBe('hidden');
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

      const visible = VisibilitySystem.calculateVisibility(char, map, lightMap);

      expect(visible.get('6-5')).toBe('hidden');
    });

    it('should allow vision in bright/dim light regardless of Darkvision', () => {
      const map = createMockMap(10, 10);
      const source: LightSource = {
        id: 'l1',
        sourceSpellId: 's1',
        casterId: 'c1',
        attachedTo: 'point',
        position: { x: 5, y: 5 },
        brightRadius: 30, // Large
        dimRadius: 0,
        createdTurn: 1
      };
      const lightMap = VisibilitySystem.calculateLightLevels(map, [source]);

      const char = {
        id: 'c1',
        position: { x: 2, y: 2 }, // Within light
        stats: { senses: { darkvision: 0 } }
      } as CombatCharacter;

      const visible = VisibilitySystem.calculateVisibility(char, map, lightMap);

      // Can see the illuminated center
      expect(visible.get('5-5')).toBe('visible');
    });
  });
});
