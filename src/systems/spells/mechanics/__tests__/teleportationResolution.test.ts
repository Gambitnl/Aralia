/**
 * This file proves exact-destination teleportation uses canonical combat truth.
 *
 * A Large Misty Step caster must fit every destination square. The tests cover
 * legal resource payment, occupied far-footprint overlap, blocked far squares,
 * range, sight, and board edges while proving rejected attempts do not spend a
 * Bonus Action, slot, movement, or a nearby enemy's Reaction.
 */

// ============================================================================
// Test Inputs
// ============================================================================
// The suite uses live spell JSON, combat fixtures, and the production resolver.
// ============================================================================

import { describe, expect, it } from 'vitest';
import mistyStepData from '@/data/spells/level-2/misty-step.json';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  Position,
} from '../../../../types/combat';
import type { Spell } from '../../../../types/spells';
import { createMockCombatCharacter } from '../../../../utils/core';
import { resolveTeleportation } from '../teleportationResolution';

// ============================================================================
// Canonical Spell And Board Facts
// ============================================================================
// The low barrier and difficult strip lie between source and legal destination.
// They would matter to walking, but neither is allowed to charge or reroute an
// instantaneous teleport. A separate wall blocks one authored sightline.
// ============================================================================

const MISTY_STEP = mistyStepData as unknown as Spell;
const CASTER_ID = 'teleport-test-caster';
const WATCHER_ID = 'teleport-test-watcher';
const START: Position = { x: 2, y: 5 };
const LEGAL_DESTINATION: Position = { x: 7, y: 2 };
const OCCUPIED_DESTINATION: Position = { x: 3, y: 6 };
const BLOCKED_DESTINATION: Position = { x: 5, y: 8 };
const HIDDEN_DESTINATION: Position = { x: 7, y: 7 };
const OUT_OF_RANGE_DESTINATION: Position = { x: 10, y: 2 };

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const id = `${x}-${y}`;
      const difficult = x === 4 && y >= 2 && y <= 5;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: difficult ? 'mud' : 'floor',
        elevation: 0,
        movementCost: difficult ? 10 : 5,
        blocksMovement: false,
        blocksLoS: false,
        decoration: null,
        effects: difficult ? ['difficult-path'] : [],
      });
    }
  }

  // This low barrier stops ordinary traversal but remains short enough to see
  // over, while the separate wall provides the deliberate hidden destination.
  tiles.set('5-3', {
    ...tiles.get('5-3')!,
    terrain: 'rock',
    blocksMovement: true,
    blocksLoS: false,
    decoration: 'low_barrier',
    effects: ['path-obstacle'],
  });
  tiles.set('5-6', {
    ...tiles.get('5-6')!,
    terrain: 'wall',
    blocksMovement: true,
    blocksLoS: true,
    decoration: 'high_wall',
    effects: ['visibility-blocker'],
  });
  tiles.set('6-9', {
    ...tiles.get('6-9')!,
    terrain: 'wall',
    blocksMovement: true,
    blocksLoS: false,
    decoration: 'low_barrier',
    effects: ['far-footprint-blocker'],
  });

  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'dungeon',
    seed: 13,
  };
}

function createCaster(position = START): CombatCharacter {
  const caster = createMockCombatCharacter({
    id: CASTER_ID,
    name: 'Large Misty Vanguard',
    position: { ...position },
    spellSlots: { level_2: { current: 1, max: 1 } },
  });
  return {
    ...caster,
    stats: { ...caster.stats, size: 'Large' },
    actionEconomy: {
      ...caster.actionEconomy,
      movement: { used: 0, total: 30 },
    },
  };
}

function createWatcher(): CombatCharacter {
  const watcher = createMockCombatCharacter({
    id: WATCHER_ID,
    name: 'Space Warden',
    position: { x: 4, y: 6 },
    team: 'enemy',
  });
  return {
    ...watcher,
    actionEconomy: {
      ...watcher.actionEconomy,
      reaction: { used: false, remaining: 1 },
    },
  };
}

function resolve(destination: Position, caster = createCaster()) {
  const characters = [caster, createWatcher()];
  return {
    characters,
    result: resolveTeleportation({
      characters,
      mapData: createMap(),
      casterId: CASTER_ID,
      spell: MISTY_STEP,
      destination,
    }),
  };
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing teleport test actor ${id}.`);
  return character;
}

// ============================================================================
// Exact Placement, Payment, And Traversal Boundaries
// ============================================================================
// Each rejected result is checked against the same original array reference.
// That is stronger than comparing labels: it proves no resource or position
// patch was created before legality was known.
// ============================================================================

describe('resolveTeleportation', () => {
  it('teleports the full creature, pays canonical cost, and skips traversal reactions', () => {
    const { result } = resolve(LEGAL_DESTINATION);
    const caster = findCharacter(result.characters, CASTER_ID);
    const watcher = findCharacter(result.characters, WATCHER_ID);

    expect(result).toMatchObject({
      status: 'teleported',
      reason: 'teleported',
      origin: START,
      destination: LEGAL_DESTINATION,
      distanceFeet: 25,
      maxDistanceFeet: 30,
      traversal: {
        movementSpentFeet: 0,
        pathTilesEntered: 0,
        opportunityAttacksProvoked: 0,
      },
    });
    expect(result.placement?.occupiedTiles).toEqual([
      { x: 7, y: 2 },
      { x: 7, y: 3 },
      { x: 8, y: 2 },
      { x: 8, y: 3 },
    ]);
    expect(caster.position).toEqual(LEGAL_DESTINATION);
    expect(caster.actionEconomy.bonusAction.used).toBe(true);
    expect(caster.actionEconomy.movement.used).toBe(0);
    expect(caster.spellSlots?.level_2.current).toBe(0);
    expect(watcher.actionEconomy.reaction.used).toBe(false);
  });

  it('rejects overlap on the Large creature far footprint without payment', () => {
    const { characters, result } = resolve(OCCUPIED_DESTINATION);
    const caster = findCharacter(result.characters, CASTER_ID);

    expect(result.characters).toBe(characters);
    expect(result).toMatchObject({
      status: 'rejected',
      reason: 'destination_occupied',
      destination: OCCUPIED_DESTINATION,
    });
    expect(result.placement?.blockerId).toBe(WATCHER_ID);
    expect(result.placement?.reason).toContain('overlaps Space Warden');
    expect(caster.position).toEqual(START);
    expect(caster.actionEconomy.bonusAction.used).toBe(false);
    expect(caster.spellSlots?.level_2.current).toBe(1);
  });

  it('rejects a blocker under a non-anchor footprint square', () => {
    const { characters, result } = resolve(BLOCKED_DESTINATION);

    expect(result.characters).toBe(characters);
    expect(result.reason).toBe('destination_blocked');
    expect(result.placement?.reason).toContain('blocked at 6,9');
  });

  it('rejects an unseen destination with a precise reason', () => {
    const { characters, result } = resolve(HIDDEN_DESTINATION);

    expect(result.characters).toBe(characters);
    expect(result.reason).toBe('destination_not_visible');
    expect(result.distanceFeet).toBe(25);
  });

  it('rejects a destination beyond Misty Step range before payment', () => {
    const { characters, result } = resolve(OUT_OF_RANGE_DESTINATION);

    expect(result.characters).toBe(characters);
    expect(result).toMatchObject({
      reason: 'destination_out_of_range',
      distanceFeet: 40,
      maxDistanceFeet: 30,
    });
  });

  it('rejects when the Large far footprint crosses the board edge', () => {
    const boundaryCaster = createCaster({ x: 12, y: 9 });
    const { characters, result } = resolve({ x: 15, y: 10 }, boundaryCaster);

    expect(result.characters).toBe(characters);
    expect(result.reason).toBe('destination_out_of_bounds');
    expect(result.placement?.reason).toContain('leaves the battle map at 16,10');
    expect(findCharacter(result.characters, CASTER_ID).spellSlots?.level_2.current).toBe(1);
  });
});
