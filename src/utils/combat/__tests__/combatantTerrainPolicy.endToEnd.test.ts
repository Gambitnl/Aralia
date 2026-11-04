import { describe, it, expect } from 'vitest';
import type { PlayerCharacter } from '@/types';
import type { BattleMapData, BattleMapTerrain, BattleMapTile } from '@/types/combat';
import { createPlayerCombatCharacter, resolveCombatantTerrainMovementPolicy } from '../combatUtils';
import { createMockPlayerCharacter } from '../../core';
import { findPath } from '../../spatial/pathfinding';
import { calculatePathMovementCost } from '../movementUtils';

/**
 * End-to-end verification for GG-257:
 * A combatant carries its race's qualified terrain movement policy from
 * the PlayerCharacter record into CombatCharacter, and real combat pathfinding
 * and movement costing honor that policy (waiving difficult ground, while still
 * charging difficult water).
 */
function makeTile(
  x: number,
  y: number,
  terrain: BattleMapTerrain,
  isDifficult: boolean,
): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain,
    elevation: 0,
    movementCost: isDifficult ? 10 : 5,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function buildTestMap(corridorTerrain: BattleMapTerrain, isDifficult: boolean): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x <= 4; x++) {
    // Tiles (1,0), (2,0), (3,0) use the test terrain
    const useTestTerrain = x >= 1 && x <= 3;
    tiles.set(
      `${x}-0`,
      makeTile(x, 0, useTestTerrain ? corridorTerrain : 'grass', useTestTerrain ? isDifficult : false),
    );
  }
  return {
    dimensions: { width: 5, height: 1 },
    tiles,
    theme: 'dungeon',
    seed: 1,
  } as unknown as BattleMapData;
}

describe('GG-257: Combatant race-aware terrain policy end-to-end', () => {
  const earthGenasiPlayer: PlayerCharacter = createMockPlayerCharacter({
    name: 'Terra',
    race: {
      id: 'earth_genasi',
      name: 'Earth Genasi',
      description: 'Earth Genasi race',
      traits: [
        'Size: Medium',
        'Speed: 30 feet',
        'Earth Walk: You can move across Difficult Terrain without expending extra movement if you are walking on the ground or a floor.',
      ],
    },
  });

  const humanPlayer: PlayerCharacter = createMockPlayerCharacter({
    name: 'Valen',
    race: {
      id: 'human',
      name: 'Human',
      description: 'Human race',
      traits: ['Size: Medium', 'Speed: 30 feet'],
    },
  });

  it('populates terrainPolicy and terrainPolicyId on CombatCharacter when character becomes a combatant', () => {
    const combatant = createPlayerCombatCharacter(earthGenasiPlayer);

    expect(combatant.terrainPolicyId).toBe('earth-walk');
    expect(combatant.terrainPolicy).toBeDefined();
    expect(combatant.terrainPolicy?.id).toBe('earth-walk');

    const resolvedPolicy = resolveCombatantTerrainMovementPolicy(combatant);
    expect(resolvedPolicy).toBe(combatant.terrainPolicy);
  });

  it('leaves terrainPolicy undefined for races without terrain traits', () => {
    const combatant = createPlayerCombatCharacter(humanPlayer);

    expect(combatant.terrainPolicyId).toBeUndefined();
    expect(combatant.terrainPolicy).toBeUndefined();
    expect(resolveCombatantTerrainMovementPolicy(combatant)).toBeNull();
  });

  it('pays normal (waived) cost across difficult ground in a combat move for an Earth Walker', () => {
    const combatant = createPlayerCombatCharacter(earthGenasiPlayer);
    const map = buildTestMap('rock', true); // 3 squares of difficult rock ground
    const startTile = map.tiles.get('0-0')!;
    const endTile = map.tiles.get('4-0')!;

    const policy = resolveCombatantTerrainMovementPolicy(combatant);
    const path = findPath(startTile, endTile, map, {}, 1, policy);
    expect(path.map(t => t.id)).toEqual(['0-0', '1-0', '2-0', '3-0', '4-0']);

    const moveCost = calculatePathMovementCost(path, policy);
    // 4 steps of 5 feet each = 20 feet (difficult terrain surcharge waived on ground)
    expect(moveCost).toBe(20);
  });

  it('pays full surcharge across difficult water for the same Earth Walker (qualifier preserved)', () => {
    const combatant = createPlayerCombatCharacter(earthGenasiPlayer);
    const map = buildTestMap('water', true); // 3 squares of difficult water
    const startTile = map.tiles.get('0-0')!;
    const endTile = map.tiles.get('4-0')!;

    const policy = resolveCombatantTerrainMovementPolicy(combatant);
    const path = findPath(startTile, endTile, map, {}, 1, policy);
    expect(path.map(t => t.id)).toEqual(['0-0', '1-0', '2-0', '3-0', '4-0']);

    const moveCost = calculatePathMovementCost(path, policy);
    // 3 difficult water squares (10 ft each) + 1 grass square (5 ft) = 35 feet
    expect(moveCost).toBe(35);
  });

  it('charges full surcharge to a standard combatant on difficult ground', () => {
    const combatant = createPlayerCombatCharacter(humanPlayer);
    const map = buildTestMap('rock', true);
    const startTile = map.tiles.get('0-0')!;
    const endTile = map.tiles.get('4-0')!;

    const policy = resolveCombatantTerrainMovementPolicy(combatant);
    const path = findPath(startTile, endTile, map, {}, 1, policy);
    const moveCost = calculatePathMovementCost(path, policy);
    // 3 difficult rock squares (10 ft each) + 1 grass square (5 ft) = 35 feet
    expect(moveCost).toBe(35);
  });
});
