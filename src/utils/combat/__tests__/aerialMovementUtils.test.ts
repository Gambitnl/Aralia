/**
 * This file proves the shared aerial resolver spends real movement and rejects
 * illegal three-dimensional destinations without partial state changes.
 *
 * The fixtures cover ground difficulty, a low obstacle, occupied airspace,
 * blocked and off-board destinations, insufficient Fly Speed, and the exact
 * unsupported fall boundary when a non-hovering flyer loses support.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../types/combat';
import { createMockCombatCharacter } from '../../core';
import {
  resolveAerialMovement,
  resolveAerialSupportLoss,
} from '../aerialMovementUtils';

// ============================================================================
// Three-Dimensional Test Board
// ============================================================================
// The horizontal lane contains costly ground and a low blocked obstacle. A
// flyer at twenty feet should ignore both while still obeying its endpoint.
// ============================================================================

function createMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 12; x += 1) {
      const id = `${x}-${y}`;
      tiles.set(id, {
        id,
        coordinates: { x, y },
        terrain: 'floor',
        elevation: 0,
        movementCost: 5,
        blocksMovement: false,
        blocksLoS: false,
        decoration: null,
        effects: [],
      });
    }
  }

  tiles.set('2-2', { ...tiles.get('2-2')!, terrain: 'mud', movementCost: 10 });
  tiles.set('3-2', { ...tiles.get('3-2')!, terrain: 'mud', movementCost: 10 });
  tiles.set('4-2', {
    ...tiles.get('4-2')!,
    terrain: 'wall',
    elevation: 10,
    blocksMovement: true,
    blocksLoS: true,
  });
  tiles.set('6-2', { ...tiles.get('6-2')!, terrain: 'rock', elevation: 10 });
  tiles.set('7-2', {
    ...tiles.get('7-2')!,
    terrain: 'wall',
    elevation: 10,
    blocksMovement: true,
    blocksLoS: true,
  });

  return {
    dimensions: { width: 12, height: 8 },
    tiles,
    theme: 'dungeon',
    seed: 15,
  };
}

function createFlyer(overrides: Partial<CombatCharacter> = {}): CombatCharacter {
  return createMockCombatCharacter({
    id: 'aerial-flyer',
    name: 'Aerial Scout',
    position: { x: 1, y: 2 },
    stats: {
      strength: 10,
      dexterity: 14,
      constitution: 12,
      intelligence: 10,
      wisdom: 12,
      charisma: 10,
      baseInitiative: 2,
      speed: 30,
      extraMovementSpeeds: { fly: 40 },
      cr: '1',
      size: 'Medium',
    },
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      legendary: { used: 0, total: 0 },
      movement: { used: 0, total: 40 },
      freeActions: 1,
    },
    aerialMovement: {
      altitudeFeet: 10,
      isFlying: true,
      canHover: false,
      source: 'test stat block',
    },
    ...overrides,
  });
}

// ============================================================================
// Legal Flight And Cost
// ============================================================================
// Twenty-five horizontal feet plus ten vertical feet costs thirty-five. The
// muddy ground and low wall underneath do not add cost or block the route.
// ============================================================================

describe('resolveAerialMovement legal flight', () => {
  it('spends horizontal plus vertical distance and ignores ground terrain cost', () => {
    const mapData = createMap();
    const flyer = createFlyer();
    const groundCreature = createMockCombatCharacter({
      id: 'ground-creature',
      name: 'Ground Creature',
      position: { x: 6, y: 2 },
    });
    const result = resolveAerialMovement({
      character: flyer,
      destination: { x: 6, y: 2 },
      destinationAltitudeFeet: 20,
      mapData,
      characters: [flyer, groundCreature],
      crossedGroundTiles: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 4, y: 2 },
      ],
    });

    expect(result).toMatchObject({
      allowed: true,
      horizontalDistanceFeet: 25,
      verticalDistanceFeet: 10,
      distanceFeet: 35,
      costFeet: 35,
      flySpeedFeet: 40,
      ignoredGroundMovementCost: true,
    });
    expect(result.character.position).toEqual({ x: 6, y: 2 });
    expect(result.character.aerialMovement).toMatchObject({
      altitudeFeet: 20,
      isFlying: true,
      canHover: false,
    });
    expect(result.character.actionEconomy.movement).toEqual({ used: 35, total: 40 });
  });
});

// ============================================================================
// Atomic Destination Rejections
// ============================================================================
// Every rejection returns the original object and its untouched movement pool.
// This guards against paying for only the legal prefix of an invalid flight.
// ============================================================================

describe('resolveAerialMovement destination boundaries', () => {
  it('rejects occupied airspace at the same altitude', () => {
    const mapData = createMap();
    const flyer = createFlyer();
    const occupiedFlyer = createFlyer({
      id: 'occupied-flyer',
      name: 'Airspace Guard',
      position: { x: 6, y: 2 },
      aerialMovement: {
        altitudeFeet: 20,
        isFlying: true,
        canHover: true,
        source: 'test stat block',
      },
    });
    const result = resolveAerialMovement({
      character: flyer,
      destination: { x: 6, y: 2 },
      destinationAltitudeFeet: 20,
      mapData,
      characters: [flyer, occupiedFlyer],
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('overlaps Airspace Guard');
    expect(result.character).toBe(flyer);
    expect(result.character.actionEconomy.movement.used).toBe(0);
  });

  it('rejects blocked altitude, map overflow, and insufficient Fly Speed', () => {
    const mapData = createMap();
    const flyer = createFlyer();
    const blocked = resolveAerialMovement({
      character: flyer,
      destination: { x: 7, y: 2 },
      destinationAltitudeFeet: 10,
      mapData,
      characters: [flyer],
    });
    const offBoard = resolveAerialMovement({
      character: flyer,
      destination: { x: 12, y: 2 },
      destinationAltitudeFeet: 20,
      mapData,
      characters: [flyer],
    });
    const tooFar = resolveAerialMovement({
      character: flyer,
      destination: { x: 10, y: 7 },
      destinationAltitudeFeet: 25,
      mapData,
      characters: [flyer],
    });

    expect(blocked.reason).toContain('blocked at 7,2');
    expect(offBoard.reason).toContain('leaves the battle map at 12,2');
    expect(tooFar.reason).toContain('only 40 ft of Fly Speed remains');
    expect([blocked, offBoard, tooFar].every(result => result.character === flyer)).toBe(true);
    expect(flyer.actionEconomy.movement.used).toBe(0);
  });
});

// ============================================================================
// Loss Of Support
// ============================================================================
// Hover is executable as a retained state. A non-hovering fall is identified
// precisely but remains unsupported until combat can resolve its landing.
// ============================================================================

describe('resolveAerialSupportLoss', () => {
  it('reports the unsupported fall boundary when Fly Speed becomes zero', () => {
    const flyer = createFlyer({
      stats: { ...createFlyer().stats, extraMovementSpeeds: { fly: 0 } },
    });
    const result = resolveAerialSupportLoss(flyer);

    expect(result).toEqual(expect.objectContaining({
      remainsAloft: false,
      requiresFall: true,
      runtimeSupported: false,
      trigger: 'zero_fly_speed',
    }));
    expect(result.reason).toContain('no integrated aerial fall-event');
  });

  it('keeps a hovering creature aloft under the same zero-speed trigger', () => {
    const flyer = createFlyer({
      stats: { ...createFlyer().stats, extraMovementSpeeds: { fly: 0 } },
      aerialMovement: {
        altitudeFeet: 10,
        isFlying: true,
        canHover: true,
        source: 'test hover',
      },
    });

    expect(resolveAerialSupportLoss(flyer)).toMatchObject({
      remainsAloft: true,
      requiresFall: false,
      runtimeSupported: true,
      trigger: 'zero_fly_speed',
    });
  });
});
