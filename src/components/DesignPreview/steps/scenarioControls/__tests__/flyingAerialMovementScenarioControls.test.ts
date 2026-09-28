/**
 * This file proves the Flying & Aerial Movement board is deterministic and
 * delegates every movement outcome to canonical combat state.
 *
 * Assertions cover the authored route, real Fly Speed and altitude, exact
 * horizontal-plus-vertical cost, repeated budget use, traversed-airspace
 * rejection, landing, and canonical support-loss impact outcomes.
 */

import { describe, expect, it } from 'vitest';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../../types/combat';
import { createMockCombatCharacter } from '../../../../../utils/core';
import flyingAerialMovementScenarioControls, {
  FLYING_AERIAL_BLOCKED_DESTINATION,
  FLYING_AERIAL_DESTINATION_ALTITUDE_FEET,
  FLYING_AERIAL_AIRSPACE_GUARD_ID,
  FLYING_AERIAL_FINAL_DESTINATION,
  FLYING_AERIAL_FIRST_DESTINATION,
  FLYING_AERIAL_FLYER_ID,
  FLYING_AERIAL_FLY_SPEED_FEET,
  FLYING_AERIAL_GROUND_CREATURE_ID,
  FLYING_AERIAL_INSUFFICIENT_DESTINATION,
  FLYING_AERIAL_LEGAL_DESTINATION,
  FLYING_AERIAL_OCCUPIED_DESTINATION,
  FLYING_AERIAL_OFF_BOARD_DESTINATION,
  FLYING_AERIAL_START,
  FLYING_AERIAL_START_ALTITUDE_FEET,
  prepareFlyingAerialMovementCharacters,
  prepareFlyingAerialMovementMapData,
} from '../flyingAerialMovementScenarioControls';
import type { PreviewCombatScenarioControlSnapshot } from '../PreviewCombatScenarioControlTypes';

// ============================================================================
// Mounted Board Fixture
// ============================================================================
// A plain sixteen-by-twelve map becomes the same raised route, wall, landing,
// and invalid boundary board that the Tactical Sandbox host displays.
// ============================================================================

function createRawMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();

  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
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

  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'dungeon',
    seed: 15,
  };
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  const characters = prepareFlyingAerialMovementCharacters([
    createMockCombatCharacter({
      id: FLYING_AERIAL_FLYER_ID,
      name: 'Aerial Scout',
      position: FLYING_AERIAL_START,
    }),
    createMockCombatCharacter({
      id: FLYING_AERIAL_GROUND_CREATURE_ID,
      name: 'Ground Warden',
      position: FLYING_AERIAL_OCCUPIED_DESTINATION,
      team: 'enemy',
    }),
    createMockCombatCharacter({
      id: FLYING_AERIAL_AIRSPACE_GUARD_ID,
      name: 'Aerie Mage',
      position: { x: 6, y: 10 },
    }),
    createMockCombatCharacter({
      id: 'aerial-bystander',
      name: 'Unrelated Bystander',
      position: { x: 1, y: 10 },
    }),
  ]);

  return {
    mapData: prepareFlyingAerialMovementMapData(createRawMap()),
    characters,
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

function apply(
  controlId: string,
  value: boolean | string = true,
  snapshot = createSnapshot(),
  controlValues: Record<string, boolean | string> = {},
) {
  return flyingAerialMovementScenarioControls.applyControl({
    controlId,
    value,
    snapshot: { ...snapshot, controlValues },
  });
}

function withPatch(
  snapshot: PreviewCombatScenarioControlSnapshot,
  patch: ReturnType<typeof apply>,
): PreviewCombatScenarioControlSnapshot {
  return {
    ...snapshot,
    mapData: patch.mapData ?? snapshot.mapData,
    characters: patch.characters ?? snapshot.characters,
    activeLightSources: patch.activeLightSources ?? snapshot.activeLightSources,
  };
}

function findCharacter(characters: CombatCharacter[], id: string): CombatCharacter {
  const character = characters.find(candidate => candidate.id === id);
  if (!character) throw new Error(`Missing Flying scenario actor ${id}.`);
  return character;
}

// ============================================================================
// Registration And Baseline
// ============================================================================
// Reset-state assertions keep every visible proof fact stable before controls
// run: two actors, speed, altitude, difficult ground, obstacle, and landing.
// ============================================================================

describe('flyingAerialMovementScenarioControls baseline', () => {
  it('registers two actions and two deterministic selectors', () => {
    expect(flyingAerialMovementScenarioControls.scenarioId).toBe('flying_aerial_movement');
    expect(flyingAerialMovementScenarioControls.controls.map(control => control.kind))
      .toEqual(['action', 'select', 'select', 'action']);
    expect(flyingAerialMovementScenarioControls.controls[1].options?.map(option => option.value))
      .toEqual([
        'route_tall_blocker',
        'route_ceiling',
        'route_occupied_flyer',
        'occupied',
        'blocked',
        'off_board',
        'insufficient_speed',
      ]);
  });

  it('prepares canonical flyer, ground creature, route, obstacle, and raised landing', () => {
    const snapshot = createSnapshot();
    const flyer = findCharacter(snapshot.characters, FLYING_AERIAL_FLYER_ID);
    const groundCreature = findCharacter(snapshot.characters, FLYING_AERIAL_GROUND_CREATURE_ID);
    const airspaceGuard = findCharacter(snapshot.characters, FLYING_AERIAL_AIRSPACE_GUARD_ID);

    expect(flyer.position).toEqual(FLYING_AERIAL_START);
    expect(flyer.stats.extraMovementSpeeds?.fly).toBe(FLYING_AERIAL_FLY_SPEED_FEET);
    expect(flyer.aerialMovement).toEqual(expect.objectContaining({
      altitudeFeet: FLYING_AERIAL_START_ALTITUDE_FEET,
      isFlying: true,
      canHover: false,
    }));
    expect(flyer.actionEconomy.movement).toEqual({ used: 0, total: 40 });
    expect(groundCreature.position).toEqual(FLYING_AERIAL_OCCUPIED_DESTINATION);
    expect(groundCreature.aerialMovement).toBeUndefined();
    expect(airspaceGuard.aerialMovement).toMatchObject({
      altitudeFeet: 15,
      isFlying: true,
      canHover: true,
    });
    expect(airspaceGuard.spellSlots?.level_1.current).toBe(1);
    expect(snapshot.mapData?.tiles.get('4-6')).toMatchObject({ terrain: 'mud', movementCost: 10 });
    expect(snapshot.mapData?.tiles.get('6-6')).toMatchObject({
      elevation: 10,
      blocksMovement: true,
      effects: ['aerial-route-low-obstacle-10-ft'],
    });
    expect(snapshot.mapData?.tiles.get('8-6')).toMatchObject({
      elevation: 10,
      blocksMovement: false,
      effects: ['legal-aerial-destination-20-ft'],
    });
    expect(snapshot.mapData?.tiles.get('6-8')?.airspace).toEqual({ blockerTopFeet: 30 });
    expect(snapshot.mapData?.tiles.get('6-9')?.airspace).toEqual({ ceilingFeet: 18 });
  });
});

// ============================================================================
// Legal Aerial Movement
// ============================================================================
// The result must update one live actor, charge thirty-five feet exactly, and
// leave all unrelated actors intact while retaining all three route cues.
// ============================================================================

describe('flyingAerialMovementScenarioControls legal route', () => {
  it('spends live 20, 15, and 5 foot legs then rejects a fourth click atomically', () => {
    let snapshot = createSnapshot();
    const first = apply('legal-aerial-move', true, snapshot);
    snapshot = withPatch(snapshot, first);
    const firstFlyer = findCharacter(snapshot.characters, FLYING_AERIAL_FLYER_ID);
    expect(firstFlyer.position).toEqual(FLYING_AERIAL_FIRST_DESTINATION);
    expect(firstFlyer.aerialMovement?.altitudeFeet).toBe(15);
    expect(firstFlyer.actionEconomy.movement.used).toBe(20);

    const second = apply('legal-aerial-move', true, snapshot);
    snapshot = withPatch(snapshot, second);
    const secondFlyer = findCharacter(snapshot.characters, FLYING_AERIAL_FLYER_ID);
    expect(secondFlyer.position).toEqual(FLYING_AERIAL_LEGAL_DESTINATION);
    expect(secondFlyer.aerialMovement?.altitudeFeet).toBe(FLYING_AERIAL_DESTINATION_ALTITUDE_FEET);
    expect(secondFlyer.actionEconomy.movement.used).toBe(35);

    const third = apply('legal-aerial-move', true, snapshot);
    snapshot = withPatch(snapshot, third);
    const thirdFlyer = findCharacter(snapshot.characters, FLYING_AERIAL_FLYER_ID);
    expect(thirdFlyer.position).toEqual(FLYING_AERIAL_FINAL_DESTINATION);
    expect(thirdFlyer.actionEconomy.movement).toEqual({ used: 40, total: 40 });

    const rejected = apply('legal-aerial-move', true, snapshot);
    const rejectedFlyer = findCharacter(rejected.characters ?? [], FLYING_AERIAL_FLYER_ID);
    expect(rejectedFlyer).toBe(thirdFlyer);
    expect(rejected.logMessage).toContain('only 0 ft of Fly Speed remains');
    expect(rejected.logMessage).toContain('remain unchanged');
    expect(first.activeLightSources?.map(light => light.id)).toEqual([
      'flying-aerial-source-cue',
      'flying-aerial-path-cue',
      'flying-aerial-destination-cue',
    ]);
    expect(first.logMessage).toContain('3D path 15 horizontal + 5 vertical = 20 ft');
    expect(first.logMessage).toContain('Difficult ground adds 0 aerial cost');
    expect(findCharacter(snapshot.characters, 'aerial-bystander').name)
      .toBe('Unrelated Bystander');
  });
});

// ============================================================================
// Atomic Rejections And Fall Boundary
// ============================================================================
// Each failed destination and unsupported fall leaves source, altitude, and
// movement untouched. The log explains the exact source of refusal.
// ============================================================================

describe('flyingAerialMovementScenarioControls rejection boundaries', () => {
  it.each([
    ['route_tall_blocker', undefined, 'blocker reaches 30 ft'],
    ['route_ceiling', undefined, 'exceeds the 18-foot ceiling'],
    ['route_occupied_flyer', undefined, 'overlaps Aerie Mage'],
    ['occupied', FLYING_AERIAL_OCCUPIED_DESTINATION, 'overlaps Ground Warden'],
    ['blocked', FLYING_AERIAL_BLOCKED_DESTINATION, 'Airspace is sealed at 11,8'],
    ['off_board', FLYING_AERIAL_OFF_BOARD_DESTINATION, 'leaves the battle map at 16,6'],
    ['insufficient_speed', FLYING_AERIAL_INSUFFICIENT_DESTINATION, 'only 40 ft of Fly Speed remains'],
  ])('rejects the %s destination without partial cost', (choice, destination, reason) => {
    const result = apply('invalid-destination', choice);
    const flyer = findCharacter(result.characters ?? [], FLYING_AERIAL_FLYER_ID);

    if (destination) expect(destination).toBeDefined();
    expect(flyer.position).toEqual(FLYING_AERIAL_START);
    expect(flyer.aerialMovement?.altitudeFeet).toBe(FLYING_AERIAL_START_ALTITUDE_FEET);
    expect(flyer.actionEconomy.movement).toEqual({ used: 0, total: 40 });
    expect(result.logMessage).toContain(reason);
    expect(result.logMessage).toContain('no partial position, altitude, cost, landing, or cue');
  });

  it('lands a controlled descent with paid movement, zero damage, and no Prone', () => {
    const result = apply(
      'resolve-landing-support',
      true,
      createSnapshot(),
      { 'landing-support-case': 'controlled_descent' },
    );
    const flyer = findCharacter(result.characters ?? [], FLYING_AERIAL_FLYER_ID);

    expect(flyer.aerialMovement).toMatchObject({ altitudeFeet: 0, isFlying: false });
    expect(flyer.actionEconomy.movement).toEqual({ used: 10, total: 40 });
    expect(result.logMessage).toContain('CONTROLLED DESCENT RESOLVED');
    expect(result.logMessage).toContain('damage 0, Prone false');
  });

  it.each([
    ['support_loss', 'HP damage 4', 'Prone true'],
    ['support_loss_feather_fall', 'Feather Fall accepted', 'HP damage 0'],
    ['support_loss_resistance', 'defended 2', 'HP damage 2'],
    ['support_loss_downing', 'DOWNED 0 HP 0S/0F', 'Prone true'],
  ])('resolves %s through canonical fall impact', (choice, firstFact, secondFact) => {
    const result = apply(
      'resolve-landing-support',
      true,
      createSnapshot(),
      { 'landing-support-case': choice },
    );
    const flyer = findCharacter(result.characters ?? [], FLYING_AERIAL_FLYER_ID);

    expect(flyer.aerialMovement).toMatchObject({ altitudeFeet: 0, isFlying: false });
    expect(result.logMessage).toContain('SUPPORT LOSS RESOLVED');
    expect(result.logMessage).toContain(firstFact);
    expect(result.logMessage).toContain(secondFact);
  });

  it('keeps inert action defaults as a fully prepared reset baseline', () => {
    const result = apply('legal-aerial-move', false);
    const flyer = findCharacter(result.characters ?? [], FLYING_AERIAL_FLYER_ID);

    expect(result.logMessage).toBe('');
    expect(flyer.position).toEqual(FLYING_AERIAL_START);
    expect(flyer.aerialMovement?.altitudeFeet).toBe(FLYING_AERIAL_START_ALTITUDE_FEET);
    expect(result.activeLightSources).toHaveLength(3);
  });
});
