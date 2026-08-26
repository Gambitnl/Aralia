/**
 * This file proves markers #903 and #911: pressure plates resolve against a
 * BattleMap movement path, and secret door state maps onto terrain the tile
 * renderer already draws.
 *
 * The fixtures use the BattleMap's own "x-y" tile-id convention and a real
 * CombatCharacter so the bridge is tested against the tactical vocabulary it
 * has to speak, not a stand-in.
 */

import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter } from '../../../utils/core';
import {
  createBattleMapPuzzleLayer,
  getSecretDoorTileView,
  getSecretDoorTileViews,
  resolvePlateTriggers,
  tileIdForPosition,
} from '../battleMapBridge';
import type { PressurePlate, SecretDoor, Trap } from '../types';

function createPlate(overrides: Partial<PressurePlate> = {}): PressurePlate {
  return {
    id: 'plate-a',
    name: 'Cracked Flagstone',
    linkedTrapId: 'dart-trap',
    description: 'A stone that sits a fraction proud of its neighbours.',
    isHidden: true,
    detectionDC: 14,
    minSize: 'Medium',
    isPressed: false,
    isJammed: false,
    resetBehavior: 'auto_instant',
    jamDC: 15,
    ...overrides,
  };
}

function createTrap(): Trap {
  return {
    id: 'dart-trap',
    name: 'Dart Trap',
    type: 'mechanical',
    detectionDC: 14,
    disarmDC: 14,
    triggerCondition: 'proximity',
    effect: { damage: { count: 2, sides: 4, bonus: 0 }, damageType: 'piercing' },
    resetable: true,
    isDisarmed: false,
    isTriggered: false,
  };
}

function createDoor(overrides: Partial<SecretDoor> = {}): SecretDoor {
  return {
    id: 'door-a',
    name: 'Hidden Passage',
    tileId: '4-9',
    detectionDC: 15,
    mechanismDC: 13,
    mechanismDescription: 'a sconce that pulls down',
    isLocked: false,
    state: 'hidden',
    ...overrides,
  };
}

describe('battleMapBridge tile keys', () => {
  it('builds the same "x-y" key BattleMapData uses for its tiles', () => {
    expect(tileIdForPosition({ x: 4, y: 9 })).toBe('4-9');
  });
});

describe('battleMapBridge pressure plate triggers (#903)', () => {
  const mover = createMockCombatCharacter({ id: 'walker' });

  it('fires a plate the creature walked over, not only the destination', () => {
    const plate = createPlate();
    const trap = createTrap();
    const layer = createBattleMapPuzzleLayer(
      [{ plate, tileId: '2-2', trap }],
      [],
    );

    const triggers = resolvePlateTriggers({
      layer,
      character: mover,
      movementPath: [{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }],
    });

    expect(triggers).toHaveLength(1);
    expect(triggers[0].plateId).toBe('plate-a');
    expect(triggers[0].tileId).toBe('2-2');
    expect(triggers[0].result.triggered).toBe(true);
    // The linked trap fired, so the caller gets an effect to apply.
    expect(triggers[0].result.trapEffect?.damageType).toBe('piercing');
  });

  it('reports nothing for a path that misses every plate', () => {
    const layer = createBattleMapPuzzleLayer([{ plate: createPlate(), tileId: '7-7' }], []);

    const triggers = resolvePlateTriggers({
      layer,
      character: mover,
      movementPath: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
    });

    expect(triggers).toEqual([]);
  });

  it('respects the plate size threshold using the size the caller supplies', () => {
    const layer = createBattleMapPuzzleLayer(
      [{ plate: createPlate({ minSize: 'Large' }), tileId: '2-2' }],
      [],
    );

    const tooLight = resolvePlateTriggers({
      layer,
      character: mover,
      movementPath: [{ x: 2, y: 2 }],
      occupantSize: 'Small',
    });
    expect(tooLight).toEqual([]);

    const heavy = resolvePlateTriggers({
      layer,
      character: mover,
      movementPath: [{ x: 2, y: 2 }],
      occupantSize: 'Huge',
    });
    expect(heavy).toHaveLength(1);
  });

  it('leaves a jammed plate alone', () => {
    const layer = createBattleMapPuzzleLayer(
      [{ plate: createPlate({ isJammed: true }), tileId: '2-2', trap: createTrap() }],
      [],
    );

    const triggers = resolvePlateTriggers({
      layer,
      character: mover,
      movementPath: [{ x: 2, y: 2 }],
    });

    expect(triggers).toEqual([]);
  });

  it('resets an auto plate walked over but keeps the one stood on pressed', () => {
    const walkedOver = createPlate({ id: 'walked-over' });
    const standingOn = createPlate({ id: 'standing-on' });
    const layer = createBattleMapPuzzleLayer(
      [
        { plate: walkedOver, tileId: '2-2' },
        { plate: standingOn, tileId: '3-2' },
      ],
      [],
    );

    resolvePlateTriggers({
      layer,
      character: mover,
      movementPath: [{ x: 2, y: 2 }, { x: 3, y: 2 }],
    });

    expect(walkedOver.isPressed).toBe(false);
    expect(standingOn.isPressed).toBe(true);
  });
});

describe('battleMapBridge secret door rendering (#911)', () => {
  it('keeps a hidden door indistinguishable from wall', () => {
    const view = getSecretDoorTileView(createDoor({ state: 'hidden' }));

    expect(view.terrain).toBe('wall');
    expect(view.revealed).toBe(false);
    expect(view.passable).toBe(false);
    expect(view.label).toBeNull();
  });

  it('reveals a detected door while it is still solid', () => {
    const view = getSecretDoorTileView(createDoor({ state: 'detected' }));

    expect(view.terrain).toBe('wall');
    expect(view.revealed).toBe(true);
    expect(view.passable).toBe(false);
    expect(view.label).toBe('Hidden Passage');
  });

  it('opens the passage once the door is operated', () => {
    const view = getSecretDoorTileView(createDoor({ state: 'open' }));

    expect(view.terrain).toBe('floor');
    expect(view.revealed).toBe(true);
    expect(view.passable).toBe(true);
  });

  it('keeps a reopened-then-closed door revealed but impassable', () => {
    const view = getSecretDoorTileView(createDoor({ state: 'closed' }));

    expect(view.revealed).toBe(true);
    expect(view.passable).toBe(false);
    expect(view.terrain).toBe('wall');
  });

  it('keys every door view by its tile id, hidden ones included', () => {
    const layer = createBattleMapPuzzleLayer([], [
      createDoor({ id: 'a', tileId: '4-9', state: 'hidden' }),
      createDoor({ id: 'b', tileId: '5-9', state: 'open' }),
    ]);

    const views = getSecretDoorTileViews(layer);

    expect([...views.keys()].sort()).toEqual(['4-9', '5-9']);
    expect(views.get('4-9')?.revealed).toBe(false);
    expect(views.get('5-9')?.passable).toBe(true);
  });
});
