import { describe, expect, it } from 'vitest';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
} from '../../../../../types/combat';
import { calculatePathMovementCost } from '../../../../../utils/combat/movementUtils';
import { findPath } from '../../../../../utils/spatial/pathfinding';
import terrainScenarioControlModule, {
  terrainScenarioControlModule as namedTerrainScenarioControlModule,
} from '../terrainScenarioControls';
import type {
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValue,
} from '../PreviewCombatScenarioControlTypes';

/**
 * This file proves that the Difficult Terrain switches change real movement facts.
 *
 * The tests start from the legacy sandbox board, apply the public control module,
 * and ask the production A* pathfinder and movement-cost calculator to price the
 * route from 2-5 to 8-5. This protects the visible teaching claims without
 * mocking the mechanic or editing the shared battle-map engine.
 *
 * Covers: terrainScenarioControls.ts.
 * Depends on: the production pathfinder and feet-based movement-cost helpers.
 */

// ============================================================================
// Legacy Board and Character Fixtures
// ============================================================================
// The host still builds the old vertical mud column before applying scenario
// defaults. Recreating that exact input proves this module can normalize it into
// the deterministic three-cell lane without mutating the supplied snapshot.
// ============================================================================

const PATHFINDER_ID = 'player-pathfinder';
const START_TILE_ID = '2-5';
const DESTINATION_TILE_ID = '8-5';
const PROOF_MUD_TILE_IDS = ['5-5', '6-5', '7-5'];
const BYPASS_TILE_IDS = ['5-4', '6-4', '7-4', '5-6', '6-6', '7-6'];

function createLegacyTile(x: number, y: number): BattleMapTile {
  const isLegacyMud = x === 7 && y >= 1 && y <= 10;

  // These fields mirror the authored terrain branch in PreviewCombatScenarios.
  // Using that real opening signature catches drift between the host and module.
  return {
    id: `${x}-${y}`,
    coordinates: { x, y },
    terrain: isLegacyMud ? 'difficult' : 'grass',
    elevation: 0,
    movementCost: isLegacyMud ? 10 : 5,
    blocksLoS: false,
    blocksMovement: false,
    decoration: isLegacyMud ? 'mangrove' : null,
    effects: [],
  };
}

function createLegacyMap(): BattleMapData {
  const tiles = new Map<string, BattleMapTile>();

  // The full 16-by-12 board gives A* every route available in the live sandbox,
  // including longer alternatives around both controlled bypass rows.
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const tile = createLegacyTile(x, y);
      tiles.set(tile.id, tile);
    }
  }

  return {
    dimensions: { width: 16, height: 12 },
    tiles,
    theme: 'swamp',
    seed: 7,
  };
}

function createPathfinder(): CombatCharacter {
  // The controls only read identity, position, speed, and action economy. This
  // deliberately small test combatant avoids bringing character-generation
  // randomness into a route-cost proof. The intermediate unknown assertion is
  // explicit because omitted class and ability-score fields are never read by
  // this module; production code still receives full CombatCharacter records.
  return {
    id: PATHFINDER_ID,
    name: 'Pathfinder Ranger',
    team: 'player',
    position: { x: 2, y: 5 },
    stats: {
      speed: 30,
    },
    actionEconomy: {
      action: { used: false, remaining: 1 },
      bonusAction: { used: false, remaining: 1 },
      reaction: { used: false, remaining: 1 },
      legendary: { used: 0, total: 0 },
      movement: { used: 0, total: 30 },
      freeActions: 1,
    },
    statusEffects: [],
    abilities: [],
    currentHP: 30,
    maxHP: 30,
  } as unknown as CombatCharacter;
}

function createSnapshot(): PreviewCombatScenarioControlSnapshot {
  return {
    mapData: createLegacyMap(),
    characters: [
      createPathfinder(),
      // The unrelated actor exists only to prove reference preservation. Its
      // position and HP make it the production occupied-destination boundary.
      {
        ...createPathfinder(),
        id: 'training-dummy',
        name: 'Training Dummy',
        team: 'enemy',
        position: { x: 12, y: 5 },
        currentHP: 999,
        maxHP: 999,
      },
    ],
    activeLightSources: [],
    reactiveTriggers: [],
  };
}

// ============================================================================
// Public Contract Test Helpers
// ============================================================================
// Defaults and individual clicks both enter through applyControl. These helpers
// carry each returned patch forward exactly as the shared host does and expose
// the production route receipt used by the assertions below.
// ============================================================================

function mergePatch(
  snapshot: PreviewCombatScenarioControlSnapshot,
  patch: PreviewCombatScenarioControlPatch,
): PreviewCombatScenarioControlSnapshot {
  return {
    ...snapshot,
    mapData: patch.mapData ?? snapshot.mapData,
    characters: patch.characters ?? snapshot.characters,
    activeLightSources: patch.activeLightSources ?? snapshot.activeLightSources,
    reactiveTriggers: patch.reactiveTriggers ?? snapshot.reactiveTriggers,
  };
}

function applyControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  controlId: string,
  value: PreviewCombatScenarioControlValue,
): PreviewCombatScenarioControlSnapshot {
  // Tests intentionally use the default export because that is the registry's
  // integration surface, not a test-only helper hidden beside the contract.
  return mergePatch(snapshot, terrainScenarioControlModule.applyControl({
    controlId,
    value,
    snapshot,
  }));
}

function attemptMove(
  snapshot: PreviewCombatScenarioControlSnapshot,
  moveCase: string,
): {
  patch: PreviewCombatScenarioControlPatch;
  snapshot: PreviewCombatScenarioControlSnapshot;
} {
  // The mounted host supplies the live owner and the complete selector state
  // in the same click transaction. This helper mirrors that public contract.
  const liveSnapshot: PreviewCombatScenarioControlSnapshot = {
    ...snapshot,
    turnState: {
      currentTurn: 1,
      turnOrder: [PATHFINDER_ID, 'training-dummy'],
      currentCharacterId: PATHFINDER_ID,
      phase: 'action',
      actionsThisTurn: [],
    },
    controlValues: {
      'mud-costs-double': true,
      'dry-bypasses-open': true,
      'fifteen-feet-already-spent': false,
      'terrain-move-case': moveCase,
      'attempt-terrain-move': false,
    },
  };
  const patch = terrainScenarioControlModule.applyControl({
    controlId: 'attempt-terrain-move',
    value: true,
    snapshot: liveSnapshot,
  });

  return {
    patch,
    snapshot: mergePatch(liveSnapshot, patch),
  };
}

function applyDefaults(
  snapshot: PreviewCombatScenarioControlSnapshot = createSnapshot(),
): PreviewCombatScenarioControlSnapshot {
  let controlledSnapshot = snapshot;

  // The host applies controls in declaration order whenever the scenario opens
  // or Reset Board is pressed. Mirroring that loop proves reset determinism.
  for (const control of terrainScenarioControlModule.controls) {
    controlledSnapshot = applyControl(
      controlledSnapshot,
      control.id,
      control.defaultValue as boolean,
    );
  }

  return controlledSnapshot;
}

function getRoute(snapshot: PreviewCombatScenarioControlSnapshot): BattleMapTile[] {
  const mapData = snapshot.mapData;
  expect(mapData).not.toBeNull();

  // A complete fixture always contains the authored start and destination. A
  // missing cell is a fixture failure, not a reason to fabricate a fallback.
  const start = mapData!.tiles.get(START_TILE_ID);
  const destination = mapData!.tiles.get(DESTINATION_TILE_ID);
  expect(start).toBeDefined();
  expect(destination).toBeDefined();

  return findPath(start!, destination!, mapData!);
}

function getPathfinder(snapshot: PreviewCombatScenarioControlSnapshot): CombatCharacter {
  const pathfinder = snapshot.characters.find(character => character.id === PATHFINDER_ID);
  expect(pathfinder).toBeDefined();
  return pathfinder!;
}

// ============================================================================
// Module Description and Default Fixture
// ============================================================================
// These assertions protect the three labels, their reset values, the default
// export required by the registry, and the canonical 35-foot Pathfinder speed.
// ============================================================================

describe('terrainScenarioControlModule', () => {
  it('default-exports the terrain module with fixture switches plus route and action controls', () => {
    expect(terrainScenarioControlModule).toBe(namedTerrainScenarioControlModule);
    expect(terrainScenarioControlModule.scenarioId).toBe('terrain');
    expect(terrainScenarioControlModule.controls).toEqual([
      expect.objectContaining({
        id: 'mud-costs-double',
        label: 'Mud Costs Double',
        kind: 'toggle',
        defaultValue: true,
      }),
      expect.objectContaining({
        id: 'dry-bypasses-open',
        label: 'Dry Bypasses Open',
        kind: 'toggle',
        defaultValue: true,
      }),
      expect.objectContaining({
        id: 'fifteen-feet-already-spent',
        label: '15 ft Already Spent',
        kind: 'toggle',
        defaultValue: false,
      }),
      expect.objectContaining({
        id: 'terrain-move-case',
        label: 'Route / Destination',
        kind: 'select',
        defaultValue: 'cheapest-detour',
      }),
      expect.objectContaining({
        id: 'attempt-terrain-move',
        label: 'Attempt Selected Move',
        kind: 'action',
        defaultValue: false,
      }),
    ]);
  });

  it('turns the legacy board into the deterministic fixture without mutating its tiles', () => {
    const snapshot = createSnapshot();
    const originalMap = snapshot.mapData!;
    const originalProofTile = originalMap.tiles.get('5-5');
    const originalLegacyMud = originalMap.tiles.get('7-2');
    const controlled = applyDefaults(snapshot);
    const pathfinder = getPathfinder(controlled);

    expect(controlled.mapData).not.toBe(originalMap);
    expect(controlled.mapData?.tiles.get('5-5')).toMatchObject({
      terrain: 'difficult',
      movementCost: 10,
      decoration: 'mangrove',
    });
    expect(controlled.mapData?.tiles.get('7-2')).toMatchObject({
      terrain: 'grass',
      movementCost: 5,
      decoration: null,
    });
    expect(originalProofTile).toMatchObject({ terrain: 'grass', movementCost: 5 });
    expect(originalLegacyMud).toMatchObject({ terrain: 'difficult', movementCost: 10 });
    expect(pathfinder.position).toEqual({ x: 2, y: 5 });
    expect(pathfinder.stats.speed).toBe(35);
    expect(pathfinder.actionEconomy.movement).toEqual({ used: 0, total: 35 });
  });

  // ========================================================================
  // Mud Cost and Route Choice
  // ========================================================================
  // With double-cost mud, production A* should take a longer dry route that
  // consumes the full 35-foot pool. Normalizing those cells makes the direct
  // six-step route cheaper and leaves five feet visible in the movement bar.
  // ========================================================================

  it('makes double-cost mud select a 35-foot dry detour through the real pathfinder', () => {
    const controlled = applyDefaults();
    const route = getRoute(controlled);
    const routeIds = route.map(tile => tile.id);

    expect(calculatePathMovementCost(route)).toBe(35);
    expect(routeIds).not.toContain('5-5');
    expect(routeIds).not.toContain('6-5');
    expect(routeIds).not.toContain('7-5');
    expect(routeIds.some(tileId => BYPASS_TILE_IDS.includes(tileId))).toBe(true);
  });

  it('makes ordinary-cost mud select the 30-foot direct route', () => {
    const controlled = applyDefaults();
    const ordinaryGround = applyControl(controlled, 'mud-costs-double', false);
    const route = getRoute(ordinaryGround);
    const routeIds = route.map(tile => tile.id);

    expect(calculatePathMovementCost(route)).toBe(30);
    expect(routeIds).toEqual(expect.arrayContaining(PROOF_MUD_TILE_IDS));
    PROOF_MUD_TILE_IDS.forEach(tileId => {
      expect(ordinaryGround.mapData?.tiles.get(tileId)).toMatchObject({
        terrain: 'grass',
        movementCost: 5,
        decoration: null,
      });
    });
  });

  // ========================================================================
  // Bypass Availability
  // ========================================================================
  // Flooding both short bypasses makes A* choose a wider route around the
  // controlled cells. Its 40-foot price exceeds the Pathfinder's 35-foot pool,
  // while the still-more-expensive direct mud crossing remains unattractive.
  // ========================================================================

  it('blocks both short bypasses and leaves an over-budget 40-foot outer route', () => {
    const controlled = applyDefaults();
    const flooded = applyControl(controlled, 'dry-bypasses-open', false);
    const route = getRoute(flooded);

    expect(calculatePathMovementCost(route)).toBe(40);
    expect(calculatePathMovementCost(route)).toBeGreaterThan(35);
    expect(route.map(tile => tile.id)).not.toEqual(expect.arrayContaining(PROOF_MUD_TILE_IDS));
    BYPASS_TILE_IDS.forEach(tileId => {
      expect(flooded.mapData?.tiles.get(tileId)).toMatchObject({
        terrain: 'water',
        blocksMovement: true,
      });
    });

    const reopened = applyControl(flooded, 'dry-bypasses-open', true);
    expect(calculatePathMovementCost(getRoute(reopened))).toBe(35);
  });

  // ========================================================================
  // Movement Already Spent
  // ========================================================================
  // This control changes only the live movement ledger. It preserves position,
  // neighboring combatants, and the map so the budget comparison stays isolated.
  // ========================================================================

  it('switches between 20 and 35 feet remaining without moving either combatant', () => {
    const controlled = applyDefaults();
    const originalPathfinder = getPathfinder(controlled);
    const originalDummy = controlled.characters[1];
    const spent = applyControl(controlled, 'fifteen-feet-already-spent', true);
    const spentPathfinder = getPathfinder(spent);

    expect(spentPathfinder.actionEconomy.movement).toEqual({ used: 15, total: 35 });
    expect(spentPathfinder.position).toEqual({ x: 2, y: 5 });
    expect(getPathfinder(controlled)).toBe(originalPathfinder);
    expect(controlled.characters[1]).toBe(originalDummy);
    expect(spent.characters[1]).toBe(originalDummy);
    expect(spent.mapData).toBe(controlled.mapData);

    const refreshed = applyControl(spent, 'fifteen-feet-already-spent', false);
    expect(getPathfinder(refreshed).actionEconomy.movement).toEqual({
      used: 0,
      total: 35,
    });
  });

  // ========================================================================
  // Canonical Movement Transactions
  // ========================================================================
  // These cases prove the adapter does not merely describe route costs. It
  // resolves or rejects one complete move through the production pathfinder,
  // movement-cost calculator, and action-economy helpers.
  // ========================================================================

  it('rejects the 45-foot direct mud route but resolves the 35-foot A* detour', () => {
    const controlled = applyDefaults();
    const originalPathfinder = getPathfinder(controlled);
    const originalDummy = controlled.characters[1];
    const direct = attemptMove(controlled, 'direct-mud');

    expect(direct.patch.characters).toBeUndefined();
    expect(direct.snapshot.characters).toBe(controlled.characters);
    expect(getPathfinder(direct.snapshot)).toBe(originalPathfinder);
    expect(direct.patch.logMessage).toContain('costs 45 ft');
    expect(direct.patch.logMessage).toContain('30 ft base + 15 ft difficult-terrain surcharge');
    expect(direct.patch.logMessage).toContain('only 35 ft remain');

    const detour = attemptMove(controlled, 'cheapest-detour');
    const movedPathfinder = getPathfinder(detour.snapshot);

    expect(movedPathfinder.position).toEqual({ x: 8, y: 5 });
    expect(movedPathfinder.actionEconomy.movement).toEqual({ used: 35, total: 35 });
    expect(detour.snapshot.characters[1]).toBe(originalDummy);
    expect(detour.patch.logMessage).toContain('cheapest legal route selected by A*');
    expect(detour.patch.logMessage).toContain('cost 35 ft (35 ft base + 0 ft difficult-terrain surcharge)');
    expect(detour.patch.logMessage).not.toContain('5-5 → 6-5 → 7-5');
  });

  it('charges an ordinary direct move and its follow-up from the same remaining pool', () => {
    const controlled = applyDefaults();
    const ordinaryGround = applyControl(controlled, 'mud-costs-double', false);
    const direct = attemptMove(ordinaryGround, 'direct-mud');

    expect(getPathfinder(direct.snapshot)).toMatchObject({
      position: { x: 8, y: 5 },
      actionEconomy: { movement: { used: 30, total: 35 } },
    });
    expect(direct.patch.logMessage).toContain('cost 30 ft (30 ft base + 0 ft difficult-terrain surcharge)');
    expect(direct.patch.logMessage).toContain('5 ft remains');

    const followUp = attemptMove(direct.snapshot, 'one-square-farther');
    expect(getPathfinder(followUp.snapshot)).toMatchObject({
      position: { x: 9, y: 5 },
      actionEconomy: { movement: { used: 35, total: 35 } },
    });
    expect(followUp.patch.logMessage).toContain('movement 30/35 → 35/35 ft');

    // Repeating the same destination is a no-pay rejection, not a zero-cost
    // movement receipt that could hide an accidental second mutation.
    const repeated = attemptMove(followUp.snapshot, 'one-square-farther');
    expect(repeated.patch.characters).toBeUndefined();
    expect(repeated.snapshot.characters).toBe(followUp.snapshot.characters);
    expect(repeated.patch.logMessage).toContain('already occupies 9-5');
    expect(repeated.patch.logMessage).toContain('Movement remains 35/35 ft');
  });

  it('rejects a legal detour when prior movement leaves only 20 feet', () => {
    const controlled = applyDefaults();
    const partlySpent = applyControl(controlled, 'fifteen-feet-already-spent', true);
    const result = attemptMove(partlySpent, 'cheapest-detour');

    expect(result.patch.characters).toBeUndefined();
    expect(result.snapshot.characters).toBe(partlySpent.characters);
    expect(getPathfinder(result.snapshot)).toMatchObject({
      position: { x: 2, y: 5 },
      actionEconomy: { movement: { used: 15, total: 35 } },
    });
    expect(result.patch.logMessage).toContain('costs 35 ft');
    expect(result.patch.logMessage).toContain('only 20 ft remain');
  });

  it.each([
    ['blocked-destination', 'destination 10-5 is blocked'],
    ['occupied-destination', 'destination 12-5 is occupied by Training Dummy'],
    ['off-board-destination', 'destination 16-5 is off-board'],
  ])('rejects %s atomically', (moveCase, reason) => {
    const controlled = applyDefaults();
    const result = attemptMove(controlled, moveCase);

    expect(result.patch.characters).toBeUndefined();
    expect(result.patch.mapData).toBeUndefined();
    expect(result.snapshot.characters).toBe(controlled.characters);
    expect(result.snapshot.mapData).toBe(controlled.mapData);
    expect(getPathfinder(result.snapshot)).toMatchObject({
      position: { x: 2, y: 5 },
      actionEconomy: { movement: { used: 0, total: 35 } },
    });
    expect(result.patch.logMessage).toContain(reason);
    expect(result.patch.logMessage).toContain('unchanged');
  });

  it('changes only the three authored lane tiles when classification is toggled after setup', () => {
    const controlled = applyDefaults();
    const ordinaryGround = applyControl(controlled, 'mud-costs-double', false);
    const changedTileIds = Array.from(controlled.mapData!.tiles.keys()).filter(tileId =>
      controlled.mapData!.tiles.get(tileId) !== ordinaryGround.mapData!.tiles.get(tileId)
    );

    expect(changedTileIds.sort()).toEqual([...PROOF_MUD_TILE_IDS].sort());
    expect(ordinaryGround.mapData?.tiles.get('10-5')).toMatchObject({
      terrain: 'rock',
      blocksMovement: true,
      decoration: 'boulder',
    });
  });

  it('recreates the same authored position, cost, and route on repeated Reset inputs', () => {
    const first = applyDefaults(createSnapshot());
    const second = applyDefaults(createSnapshot());

    expect(getPathfinder(first)).toMatchObject({
      position: { x: 2, y: 5 },
      actionEconomy: { movement: { used: 0, total: 35 } },
    });
    expect(getPathfinder(second)).toMatchObject({
      position: { x: 2, y: 5 },
      actionEconomy: { movement: { used: 0, total: 35 } },
    });
    expect(getRoute(first).map(tile => tile.id)).toEqual(getRoute(second).map(tile => tile.id));
    expect(calculatePathMovementCost(getRoute(first))).toBe(35);
    expect(calculatePathMovementCost(getRoute(second))).toBe(35);
  });

  // ========================================================================
  // Defensive No-Op Behavior
  // ========================================================================
  // Invalid values, missing fixture records, and stale control ids must return
  // an explanatory log without mutating or inventing canonical combat state.
  // ========================================================================

  it('returns log-only patches for malformed or unavailable control requests', () => {
    const snapshot = createSnapshot();
    const invalidValue = terrainScenarioControlModule.applyControl({
      controlId: 'mud-costs-double',
      value: 'false',
      snapshot,
    });
    const missingMap = terrainScenarioControlModule.applyControl({
      controlId: 'mud-costs-double',
      value: true,
      snapshot: { ...snapshot, mapData: null },
    });
    const missingPathfinder = terrainScenarioControlModule.applyControl({
      controlId: 'fifteen-feet-already-spent',
      value: true,
      snapshot: { ...snapshot, characters: [] },
    });
    const unknownControl = terrainScenarioControlModule.applyControl({
      controlId: 'stale-control-id',
      value: true,
      snapshot,
    });

    expect(invalidValue.mapData).toBeUndefined();
    expect(invalidValue.logMessage).toContain('requires an on/off value');
    expect(missingMap.mapData).toBeUndefined();
    expect(missingMap.logMessage).toContain('no battle map is loaded');
    expect(missingPathfinder.characters).toBeUndefined();
    expect(missingPathfinder.logMessage).toContain('Pathfinder is unavailable');
    expect(unknownControl.mapData).toBeUndefined();
    expect(unknownControl.characters).toBeUndefined();
    expect(unknownControl.logMessage).toContain('Unknown Difficult Terrain scenario control');
  });
});
