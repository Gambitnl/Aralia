/**
 * @file src/systems/visibility/__tests__/VisibilitySystem.test.ts
 * Tests for the VisibilitySystem.
 */
import { describe, it, expect } from 'vitest';
import { VisibilitySystem } from '../VisibilitySystem';
import {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  LightSource,
  LightLevel,
} from '../../../types/combat';

// --- Mocks & Factories ---

const createTile = (x: number, y: number, blocksLoS = false): BattleMapTile => ({
  id: `${x}-${y}`,
  coordinates: { x, y },
  terrain: 'floor',
  elevation: 0,
  movementCost: 1,
  blocksLoS,
  blocksMovement: blocksLoS,
  decoration: null,
  effects: [],
});

const createMap = (width: number, height: number, theme: BattleMapData['theme'] = 'cave'): BattleMapData => {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      tiles.set(`${x}-${y}`, createTile(x, y));
    }
  }
  return {
    dimensions: { width, height },
    tiles,
    theme,
    seed: 12345,
  };
};

const createCharacter = (
  id: string,
  x: number,
  y: number,
  darkvision = 0
): CombatCharacter => ({
  id,
  name: 'TestChar',
  level: 1,
  class: { name: 'Fighter', level: 1, hitDie: 'd10', savingThrowProficiencies: [], armorProficiencies: [], weaponProficiencies: [], skills: [], features: [], spellcasting: undefined },
  position: { x, y },
  stats: {
    strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10,
    baseInitiative: 0, speed: 30, cr: '0',
    senses: { darkvision, blindsight: 0, tremorsense: 0, truesight: 0 },
  },
  abilities: [],
  team: 'player',
  currentHP: 10,
  maxHP: 10,
  initiative: 10,
  statusEffects: [],
  actionEconomy: {
    action: { used: false, remaining: 1 },
    bonusAction: { used: false, remaining: 1 },
    reaction: { used: false, remaining: 1 },
    movement: { used: 0, total: 30 },
    freeActions: 1,
  },
});

const createLightSource = (
  id: string,
  x: number,
  y: number,
  bright: number,
  dim: number
): LightSource => ({
  id,
  sourceSpellId: 'spell-1',
  casterId: 'caster-1',
  brightRadius: bright,
  dimRadius: dim,
  attachedTo: 'point',
  position: { x, y },
  createdTurn: 1,
});

describe('VisibilitySystem', () => {
  describe('calculateLightLevels', () => {
    it('should default to darkness in caves', () => {
      const map = createMap(5, 5, 'cave');
      const lights: LightSource[] = [];
      const levels = VisibilitySystem.calculateLightLevels(map, lights, []);

      expect(levels.get('0-0')).toBe('darkness');
      expect(levels.get('4-4')).toBe('darkness');
    });

    it('should default to bright in forests', () => {
      const map = createMap(5, 5, 'forest');
      const lights: LightSource[] = [];
      const levels = VisibilitySystem.calculateLightLevels(map, lights, []);

      expect(levels.get('0-0')).toBe('bright');
    });

    it('should apply bright light around a source', () => {
      const map = createMap(10, 10, 'cave');
      // Light at 5,5 with 5ft radius (1 tile Chebyshev radius)
      // 5ft = 1 tile. So x=4,5,6 y=4,5,6 should be bright.
      const light = createLightSource('l1', 5, 5, 5, 0);
      const levels = VisibilitySystem.calculateLightLevels(map, [light], []);

      expect(levels.get('5-5')).toBe('bright'); // Center
      expect(levels.get('6-6')).toBe('bright'); // Diagonal 1 tile away
      expect(levels.get('7-7')).toBe('darkness'); // 2 tiles away (10ft)
    });

    it('should apply dim light extending beyond bright light', () => {
      const map = createMap(10, 10, 'cave');
      // Light: 5ft bright, +5ft dim (Total 10ft)
      const light = createLightSource('l1', 5, 5, 5, 5);
      const levels = VisibilitySystem.calculateLightLevels(map, [light], []);

      expect(levels.get('5-5')).toBe('bright'); // < 5ft
      expect(levels.get('6-6')).toBe('bright'); // 5ft (boundary inclusive)
      expect(levels.get('7-7')).toBe('dim');    // 10ft
      expect(levels.get('8-8')).toBe('darkness'); // 15ft
    });

    it('should cast shadows (block light through walls)', () => {
      const map = createMap(5, 5, 'cave');
      // Wall at 2,2
      map.tiles.get('2-2')!.blocksLoS = true;

      // Light at 1,2.
      // 3,2 is behind 2,2. Should be dark.
      const light = createLightSource('l1', 1, 2, 10, 0); // 10ft = 2 tiles
      const levels = VisibilitySystem.calculateLightLevels(map, [light], []);

      expect(levels.get('1-2')).toBe('bright');
      expect(levels.get('2-2')).toBe('bright'); // Wall itself is lit on the facing side
      expect(levels.get('3-2')).toBe('darkness'); // Shadowed
    });
  });

  describe('getVisibleTiles', () => {
    it('should see everything in bright light', () => {
      const map = createMap(5, 5, 'forest'); // Bright ambient
      const lightGrid = VisibilitySystem.calculateLightLevels(map, [], []);
      const char = createCharacter('c1', 2, 2); // No darkvision

      const visible = VisibilitySystem.getVisibleTiles(char, map, lightGrid);
      expect(visible.has('0-0')).toBe(true);
      expect(visible.has('4-4')).toBe(true);
    });

    it('should not see in darkness without darkvision', () => {
      const map = createMap(5, 5, 'cave'); // Dark ambient
      const lightGrid = VisibilitySystem.calculateLightLevels(map, [], []);
      const char = createCharacter('c1', 2, 2, 0); // 0 Darkvision

      const visible = VisibilitySystem.getVisibleTiles(char, map, lightGrid);
      // Can't see anything except maybe self? D&D rules say blinded.
      // Implementation check: if tile is darkness and dist > darkvision(0), not visible.
      // So nothing visible.
      expect(visible.size).toBe(0);
    });

    it('should see in darkness WITH darkvision', () => {
        const map = createMap(10, 10, 'cave');
        const lightGrid = VisibilitySystem.calculateLightLevels(map, [], []);
        const char = createCharacter('c1', 5, 5, 10); // 10ft Darkvision (2 tiles)

        const visible = VisibilitySystem.getVisibleTiles(char, map, lightGrid);

        expect(visible.has('5-5')).toBe(true); // Self
        expect(visible.has('7-7')).toBe(true); // 10ft away
        expect(visible.has('8-8')).toBe(false); // 15ft away
    });

    it('should not see through walls even with darkvision', () => {
        const map = createMap(5, 5, 'cave');
        map.tiles.get('3-2')!.blocksLoS = true;
        const lightGrid = VisibilitySystem.calculateLightLevels(map, [], []);
        const char = createCharacter('c1', 1, 2, 20); // 20ft DV

        const visible = VisibilitySystem.getVisibleTiles(char, map, lightGrid);

        // Wall at 3,2.
        // 4,2 is blocked.
        expect(visible.has('1-2')).toBe(true);
        expect(visible.has('3-2')).toBe(true); // See the wall
        expect(visible.has('4-2')).toBe(false); // Can't see past it
    });
  });
});
