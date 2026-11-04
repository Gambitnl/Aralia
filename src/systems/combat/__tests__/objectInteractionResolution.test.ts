import { describe, expect, it } from 'vitest';
import {
  resolveObjectInteraction,
  type ObjectInteractionRequest,
} from '../objectInteractionResolution';
import { createMockCombatCharacter } from '../../../utils/core/factories';
import type {
  BattleMapData,
  BattleMapTile,
  TargetableMapObject,
} from '../../../types/combat';
import { getObjectAC, getObjectHPAverage } from '../../../utils/combat/physicsUtils';

/**
 * GG-206: Proves object durability, material, size, and AC attack gating in combat.
 * 1. Stone door has AC 17 (from getObjectAC('stone')) and HP seeded from getObjectHP('medium', false) = 18.
 * 2. Attack roll below 17 (e.g. 14) misses the stone door, dealing 0 damage while spending the Action.
 * 3. Attack roll of 17 or higher hits the stone door and applies damage.
 */
function makeTile(x: number, y: number): BattleMapTile {
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: 'floor',
    elevation: 0,
    movementCost: 5,
    blocksLoS: false,
    blocksMovement: false,
    decoration: null,
    effects: [],
  };
}

function createTestMap(objects: TargetableMapObject[]): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();
  for (let x = 0; x <= 5; x += 1) {
    for (let y = 0; y <= 5; y += 1) {
      tiles.set(`${x}-${y}`, makeTile(x, y));
    }
  }
  return {
    dimensions: { width: 10, height: 10 },
    tiles,
    targetableObjects: objects,
    theme: 'dungeon',
    seed: 42,
  };
}

describe('objectInteractionResolution - AC and HP rules (GG-206)', () => {
  it('seeds stone door HP from getObjectHP and AC from getObjectAC (AC 17, HP 18)', () => {
    const actor = createMockCombatCharacter({
      id: 'fighter',
      name: 'Fighter',
      position: { x: 1, y: 1 },
      team: 'player',
    });

    const stoneDoor: TargetableMapObject = {
      id: 'stone-door-1',
      name: 'Stone Door',
      position: { x: 1, y: 2 },
      material: 'stone',
      size: 'Medium',
      interactionState: {
        kind: 'breakable',
        isOpen: false,
        useCount: 0,
        hitPoints: 0, // unseeded; should derive from getObjectHP
        maxHitPoints: 0,
        destroyed: false,
        resolvedEventIds: [],
      },
    };

    const mapData = createTestMap([stoneDoor]);

    // An attack rolling 14 (under AC 17) misses the stone door
    const missRequest: ObjectInteractionRequest = {
      eventId: 'evt-miss-1',
      actorId: actor.id,
      objectId: stoneDoor.id,
      operation: 'damage',
      damage: 8,
      attackRoll: 14,
    };

    const missResult = resolveObjectInteraction({
      characters: [actor],
      mapData,
      request: missRequest,
    });

    expect(missResult.accepted).toBe(true);
    expect(missResult.isHit).toBe(false);
    expect(missResult.armorClass).toBe(17);
    expect(missResult.reason).toContain('missed Stone Door\'s AC 17');
    expect(missResult.cost).toBe('action');

    // The door is still at full seeded HP (18 HP for Medium resilient stone)
    const doorAfterMiss = missResult.mapData.targetableObjects?.find(o => o.id === stoneDoor.id);
    expect(doorAfterMiss?.interactionState?.armorClass).toBe(getObjectAC('stone'));
    expect(doorAfterMiss?.interactionState?.maxHitPoints).toBe(getObjectHPAverage('medium', false));
    expect(doorAfterMiss?.interactionState?.hitPoints).toBe(18);
    expect(doorAfterMiss?.interactionState?.destroyed).toBe(false);

    // An attack rolling 18 (meeting or exceeding AC 17) hits and deals damage
    const hitActor = missResult.characters[0];
    // Reset action economy so the actor can swing again
    hitActor.actionEconomy.action.used = false;
    hitActor.actionEconomy.action.remaining = 1;

    const hitRequest: ObjectInteractionRequest = {
      eventId: 'evt-hit-1',
      actorId: hitActor.id,
      objectId: stoneDoor.id,
      operation: 'damage',
      damage: 8,
      attackRoll: 18,
    };

    const hitResult = resolveObjectInteraction({
      characters: [hitActor],
      mapData: missResult.mapData,
      request: hitRequest,
    });

    expect(hitResult.accepted).toBe(true);
    expect(hitResult.isHit).toBe(true);
    expect(hitResult.reason).toContain('Stone Door took 8 damage and has 10/18 HP');

    const doorAfterHit = hitResult.mapData.targetableObjects?.find(o => o.id === stoneDoor.id);
    expect(doorAfterHit?.interactionState?.hitPoints).toBe(10);
    expect(doorAfterHit?.interactionState?.destroyed).toBe(false);
  });
});
