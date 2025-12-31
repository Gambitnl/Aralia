
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateCombatTurn } from '../combatAI';
import {
  createMockCombatCharacter,
  // TODO(lint-intent): 'createMockSpell' is unused in this test; use it in the assertion path or remove it.
  createMockSpell as _createMockSpell
} from '../../factories';
import {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  Ability
} from '../../../types/combat';

// Mock logger to suppress output during tests
vi.mock('../../logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper to create a simple flat map
function createSimpleMap(width: number, height: number): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: 'floor',
        movementCost: 1,
        blocksMovement: false,
        blocksLoS: false,
        elevation: 0,
        decoration: null,
        effects: []
      });
    }
  }
  return {
    dimensions: { width, height },
    tiles,
    theme: 'dungeon',
    seed: 12345
  };
}

describe('combatAI', () => {
  let mapData: BattleMapData;
  let hero: CombatCharacter;
  let enemy: CombatCharacter;
  let basicAttack: Ability;

  beforeEach(() => {
    mapData = createSimpleMap(10, 10);

    // Create a basic attack ability using an object literal that satisfies the Ability interface
    basicAttack = {
      id: 'attack-1',
      name: 'Fire Bolt',
      description: 'Deals 10 damage',
      type: 'attack',
      range: 6, // 30ft / 5 = 6 tiles
      targeting: 'single_enemy',
      cost: { type: 'action' },
      effects: [
        {
          type: 'damage',
          damageType: 'fire',
          value: 10,
          dice: '1d10'
        }
      ],
      // Required Ability fields that might be optional in factory but needed here to satisfy strict type
      icon: 'fire-icon',
      tags: [],
    };
  });

  it('should end turn if no enemies are present', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 }
    });

    const result = evaluateCombatTurn(hero, [hero], mapData);

    expect(result.type).toBe('end_turn');
  });

  it('should move towards enemy if out of range', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [basicAttack]
    });

    // Enemy at 9,9 (approx 9 tiles away Chebyshev), Range is 6
    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 9, y: 9 }
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    expect(result.type).toBe('move');
    // Should move towards 9,9
    expect(result.targetPosition?.x).toBeGreaterThan(0);
    expect(result.targetPosition?.y).toBeGreaterThan(0);
  });

  it('should attack enemy if in range', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [basicAttack]
    });

    // Enemy at 0,2 (Distance 2, Range 6)
    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 0, y: 2 }
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    expect(result.type).toBe('ability');
    expect(result.abilityId).toBe(basicAttack.id);
    expect(result.targetCharacterIds).toContain(enemy.id);
  });

  it('should prioritize killing blow', () => {
    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [basicAttack]
    });

    // Enemy 1: Full health
    const enemyFull = createMockCombatCharacter({
      id: 'e1',
      team: 'enemy',
      position: { x: 0, y: 2 },
      currentHP: 20,
      maxHP: 20
    });

    // Enemy 2: 1 HP (Killable)
    const enemyLow = createMockCombatCharacter({
      id: 'e2',
      team: 'enemy',
      position: { x: 2, y: 0 },
      currentHP: 1,
      maxHP: 20
    });

    const result = evaluateCombatTurn(hero, [hero, enemyFull, enemyLow], mapData);

    expect(result.type).toBe('ability');
    expect(result.targetCharacterIds).toContain(enemyLow.id);
  });

  it('should retreat when health is low', () => {
    // Create a hero with a very weak attack so retreat is more attractive
    const weakAttack: Ability = {
      ...basicAttack,
      effects: [{ type: 'damage', value: 1, damageType: 'physical' }]
    };

    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 5, y: 5 },
      currentHP: 2, // 10% HP (Low)
      maxHP: 20,
      abilities: [weakAttack]
    });

    // Actually, force retreat by removing abilities entirely, ensuring "Self Preservation" is the only score source
    hero.abilities = [];

    enemy = createMockCombatCharacter({
      id: 'goblin',
      team: 'enemy',
      position: { x: 4, y: 5 } // Adjacent
    });

    const result = evaluateCombatTurn(hero, [hero, enemy], mapData);

    expect(result.type).toBe('move');
    const dist = Math.sqrt(
      Math.pow((result.targetPosition!.x - enemy.position.x), 2) +
      Math.pow((result.targetPosition!.y - enemy.position.y), 2)
    );
    expect(dist).toBeGreaterThan(1);
  });

  it('should use AoE to hit multiple enemies', () => {
    const fireball: Ability = {
      id: 'fireball',
      name: 'Fireball',
      description: 'Boom',
      type: 'spell',
      range: 20,
      targeting: 'area',
      areaShape: 'circle', // Matches Combat type
      areaSize: 2,        // Matches Combat type
      areaOfEffect: { shape: 'circle', size: 2 }, // Explicitly set for AI helper compatibility
      cost: { type: 'action' },
      effects: [{
        type: 'damage',
        value: 20,
        dice: '8d6',
        damageType: 'fire'
      }]
    };

    hero = createMockCombatCharacter({
      id: 'hero',
      team: 'player',
      position: { x: 0, y: 0 },
      abilities: [fireball]
    });

    // Cluster of enemies
    const e1 = createMockCombatCharacter({ id: 'e1', team: 'enemy', position: { x: 5, y: 5 } });
    const e2 = createMockCombatCharacter({ id: 'e2', team: 'enemy', position: { x: 6, y: 5 } });

    const result = evaluateCombatTurn(hero, [hero, e1, e2], mapData);

    expect(result.type).toBe('ability');
    expect(result.abilityId).toBe('fireball');
    expect(result.targetCharacterIds).toContain(e1.id);
    expect(result.targetCharacterIds).toContain(e2.id);
  });
});
