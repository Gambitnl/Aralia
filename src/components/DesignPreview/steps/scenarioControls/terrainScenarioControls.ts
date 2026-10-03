// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/08/2026, 12:49:29
 * Dependents: components/DesignPreview/steps/scenarioControls/PreviewCombatScenarioControlRegistry.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  Position,
} from '../../../../types/combat';
import {
  canAffordActionCost,
  consumeActionCost,
} from '../../../../utils/combat/actionEconomyUtils';
import {
  calculateMovementCost,
  calculatePathMovementCost,
  calculateStepMovementCost,
} from '../../../../utils/combat/movementUtils';
import { findPath } from '../../../../utils/spatial/pathfinding';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
} from './PreviewCombatScenarioControlTypes';

/**
 * This file owns the interactive starting facts for the Difficult Terrain sandbox.
 *
 * The shared scenario-control host gives this module the live battle map and
 * combatants. These controls reshape the old swamp column into one deterministic
 * proof corridor, open or flood its dry bypasses, and set how much movement the
 * Pathfinder has already spent. Its action controls then ask the ordinary A*
 * pathfinder, feet-based cost calculator, and action-economy helpers to resolve
 * one atomic movement attempt against that live state.
 *
 * Called by: the Tactical Sandbox scenario-control registry.
 * Depends on: the shared scenario-control contract and production combat state.
 */

// ============================================================================
// Authored Proof Fixture
// ============================================================================
// The Pathfinder begins at 2-5 and compares routes toward 8-5. Three expensive
// cells make the straight route cost 45 feet, while either dry bypass costs
// exactly 35 feet. Switching the mud back to normal ground makes the direct
// route cost 30 feet, leaving a visible five feet in the movement budget.
// ============================================================================

const PATHFINDER_ID = 'player-pathfinder';
const PATHFINDER_SPEED_FEET = 35;
const ALREADY_SPENT_FEET = 15;

const MUD_COST_CONTROL_ID = 'mud-costs-double';
const DRY_BYPASSES_CONTROL_ID = 'dry-bypasses-open';
const ALREADY_SPENT_CONTROL_ID = 'fifteen-feet-already-spent';
const MOVE_CASE_CONTROL_ID = 'terrain-move-case';
const ATTEMPT_MOVE_CONTROL_ID = 'attempt-terrain-move';

const PROOF_DESTINATION: Position = { x: 8, y: 5 };
const FOLLOW_UP_DESTINATION: Position = { x: 9, y: 5 };
const BLOCKED_DESTINATION: Position = { x: 10, y: 5 };
const OCCUPIED_DESTINATION: Position = { x: 12, y: 5 };
const OFF_BOARD_DESTINATION: Position = { x: 16, y: 5 };

type TerrainMoveCase =
  | 'cheapest-detour'
  | 'direct-mud'
  | 'one-square-farther'
  | 'blocked-destination'
  | 'occupied-destination'
  | 'off-board-destination';

const TERRAIN_MOVE_CASES = new Set<TerrainMoveCase>([
  'cheapest-detour',
  'direct-mud',
  'one-square-farther',
  'blocked-destination',
  'occupied-destination',
  'off-board-destination',
]);

const PROOF_MUD_TILE_IDS = new Set(['5-5', '6-5', '7-5']);
const DRY_BYPASS_TILE_IDS = new Set([
  '5-4',
  '6-4',
  '7-4',
  '5-6',
  '6-6',
  '7-6',
]);

// The original scenario painted a one-cell-wide vertical swamp column. Default
// application retires only tiles that still carry that exact authored signature,
// so later controls cannot accidentally reopen flooded bypasses or erase new facts.
const LEGACY_SWAMP_TILE_IDS = new Set(
  Array.from({ length: 10 }, (_, index) => `7-${index + 1}`),
);

const controls: PreviewCombatScenarioControlModule['controls'] = [
  {
    id: MUD_COST_CONTROL_ID,
    label: 'Mud Costs Double',
    description: 'Switch the three-cell mud lane between 10-foot difficult terrain and ordinary 5-foot ground.',
    kind: 'toggle',
    defaultValue: true,
  },
  {
    id: DRY_BYPASSES_CONTROL_ID,
    label: 'Dry Bypasses Open',
    description: 'Open or flood the grass routes above and below the mud lane so route choice is visible.',
    kind: 'toggle',
    defaultValue: true,
  },
  {
    id: ALREADY_SPENT_CONTROL_ID,
    label: '15 ft Already Spent',
    description: 'Reserve 15 feet of the Pathfinder\'s 35-foot movement pool before the next move.',
    kind: 'toggle',
    defaultValue: false,
  },
  {
    id: MOVE_CASE_CONTROL_ID,
    label: 'Route / Destination',
    description: 'Choose a cost comparison, a follow-up move, or an invalid endpoint to test atomically.',
    kind: 'select',
    defaultValue: 'cheapest-detour',
    options: [
      { value: 'cheapest-detour', label: 'Cheapest legal route to 8-5' },
      { value: 'direct-mud', label: 'Direct route through mud to 8-5' },
      { value: 'one-square-farther', label: 'Follow-up one square to 9-5' },
      { value: 'blocked-destination', label: 'Blocked destination at 10-5' },
      { value: 'occupied-destination', label: 'Occupied destination at 12-5' },
      { value: 'off-board-destination', label: 'Off-board destination at 16-5' },
    ],
  },
  {
    id: ATTEMPT_MOVE_CONTROL_ID,
    label: 'Attempt Selected Move',
    description: 'Resolve the selected route against the Pathfinder\'s live remaining movement, position, and board.',
    kind: 'action',
    defaultValue: false,
  },
];

// ============================================================================
// Safe Shared-Contract Guards
// ============================================================================
// A stale panel or partially loaded scenario must never fabricate missing map
// cells or combatants. These helpers validate the requested on/off value and
// confirm that every authored fixture record exists before returning a patch.
// ============================================================================

function requireToggleValue(
  application: PreviewCombatScenarioControlApplication,
): boolean | null {
  // Text such as "false" is truthy in JavaScript but is not a valid switch
  // value. Rejecting it avoids silently showing the opposite combat fact.
  return typeof application.value === 'boolean'
    ? application.value
    : null;
}

function hasEveryTile(mapData: BattleMapData, tileIds: ReadonlySet<string>): boolean {
  // The proof geometry only has meaning when the complete lane is present.
  // Partial updates would create misleading route costs that look plausible.
  return Array.from(tileIds).every(tileId => mapData.tiles.has(tileId));
}

function isLegacySwampTile(tile: BattleMapTile): boolean {
  // Match every old authored field before retiring a cell. A different future
  // terrain fact at the same coordinate must remain under its owning system.
  return tile.terrain === 'difficult'
    && tile.movementCost === 10
    && tile.decoration === 'mangrove'
    && tile.blocksMovement === false;
}

// ============================================================================
// Difficult-Terrain Classification
// ============================================================================
// This switch changes the canonical terrain name and movement cost read by the
// real pathfinder. It also normalizes the obsolete vertical swamp cells and
// authors one fixed blocked endpoint so later movement attempts can prove that
// destination validation happens before position or movement is changed.
// ============================================================================

function applyMudCostControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  mudCostsDouble: boolean,
): PreviewCombatScenarioControlPatch {
  const mapData = snapshot.mapData;

  // Controls may be applied while a scenario is still loading. Preserve that
  // empty state rather than creating a counterfeit board from local constants.
  if (!mapData) {
    return {
      logMessage: 'Difficult Terrain control skipped because no battle map is loaded.',
    };
  }

  if (!hasEveryTile(mapData, PROOF_MUD_TILE_IDS)) {
    return {
      logMessage: 'Difficult Terrain control skipped because the proof mud lane is incomplete.',
    };
  }

  // Copy the tile registry and only replace cells whose authored movement fact
  // changes. The incoming snapshot and unrelated terrain objects remain intact.
  const tiles = new Map(mapData.tiles);
  mapData.tiles.forEach((tile, tileId) => {
    let nextTile = tile;

    // Remove the previous vertical swamp column when it still has the original
    // signature. The new three-cell lane is applied immediately afterward.
    if (
      LEGACY_SWAMP_TILE_IDS.has(tileId)
      && !PROOF_MUD_TILE_IDS.has(tileId)
      && isLegacySwampTile(tile)
    ) {
      nextTile = {
        ...tile,
        terrain: 'grass',
        movementCost: 5,
        decoration: null,
      };
    }

    if (PROOF_MUD_TILE_IDS.has(tileId)) {
      nextTile = mudCostsDouble
        ? {
            ...nextTile,
            terrain: 'difficult',
            movementCost: 10,
            blocksMovement: false,
            blocksLoS: false,
            decoration: 'mangrove',
          }
        : {
            ...nextTile,
            terrain: 'grass',
            movementCost: 5,
            blocksMovement: false,
            blocksLoS: false,
            decoration: null,
          };
    }

    // The boulder is a stable invalid destination, not part of the terrain
    // classification switch. Reapplying either switch preserves this exact
    // blocker so Reset Board always reconstructs the same validation fixture.
    if (
      tileId === `${BLOCKED_DESTINATION.x}-${BLOCKED_DESTINATION.y}`
      && (
        nextTile.terrain !== 'rock'
        || nextTile.movementCost !== 5
        || nextTile.blocksMovement !== true
        || nextTile.blocksLoS !== false
        || nextTile.decoration !== 'boulder'
      )
    ) {
      nextTile = {
        ...nextTile,
        terrain: 'rock',
        movementCost: 5,
        blocksMovement: true,
        blocksLoS: false,
        decoration: 'boulder',
      };
    }

    if (nextTile !== tile) {
      tiles.set(tileId, nextTile);
    }
  });

  return {
    mapData: {
      ...mapData,
      tiles,
    },
    logMessage: mudCostsDouble
      ? 'Sandbox fact: the three mud tiles cost 10 feet each, so a dry bypass is cheaper.'
      : 'Sandbox fact: the former mud tiles cost 5 feet each, so the direct route is cheapest.',
  };
}

// ============================================================================
// Route Choice And Atomic Movement
// ============================================================================
// These helpers turn a selected teaching case into one complete movement
// transaction. Map bounds, blocker, occupancy, route existence, and remaining
// movement are all checked before the Pathfinder record is replaced. A rejected
// attempt therefore leaves position and every action-economy field untouched.
// ============================================================================

interface MovementCostReceipt {
  totalFeet: number;
  baseFeet: number;
  difficultTerrainSurchargeFeet: number;
}

function isTerrainMoveCase(value: unknown): value is TerrainMoveCase {
  // The select is data-driven, so fail closed if stale browser state submits a
  // value that is no longer one of this scenario's authored comparisons.
  return typeof value === 'string' && TERRAIN_MOVE_CASES.has(value as TerrainMoveCase);
}

function getSelectedMoveCase(
  snapshot: PreviewCombatScenarioControlSnapshot,
): TerrainMoveCase | null {
  const value = snapshot.controlValues?.[MOVE_CASE_CONTROL_ID] ?? 'cheapest-detour';
  return isTerrainMoveCase(value) ? value : null;
}

function getMoveDestination(moveCase: TerrainMoveCase): Position {
  // Each invalid case has a separate authored endpoint so its rejection reason
  // is unambiguous in the mounted combat log.
  switch (moveCase) {
    case 'one-square-farther':
      return FOLLOW_UP_DESTINATION;
    case 'blocked-destination':
      return BLOCKED_DESTINATION;
    case 'occupied-destination':
      return OCCUPIED_DESTINATION;
    case 'off-board-destination':
      return OFF_BOARD_DESTINATION;
    default:
      return PROOF_DESTINATION;
  }
}

function buildDirectRoute(
  start: BattleMapTile,
  destination: BattleMapTile,
  mapData: BattleMapData,
): BattleMapTile[] {
  // The direct comparison is deliberately a straight horizontal lane through
  // all three mud squares. Refuse to invent a diagonal fallback if a future
  // fixture moves either endpoint away from row 5.
  if (start.coordinates.y !== destination.coordinates.y) {
    return [];
  }

  const direction = Math.sign(destination.coordinates.x - start.coordinates.x);
  if (direction === 0) {
    return [start];
  }

  const route: BattleMapTile[] = [start];
  for (
    let x = start.coordinates.x + direction;
    x !== destination.coordinates.x + direction;
    x += direction
  ) {
    const tile = mapData.tiles.get(`${x}-${start.coordinates.y}`);
    if (!tile || tile.blocksMovement) {
      return [];
    }
    route.push(tile);
  }

  return route;
}

function describeMovementCost(path: BattleMapTile[]): MovementCostReceipt {
  let baseFeet = 0;
  let difficultTerrainSurchargeFeet = 0;
  let diagonalCount = 0;

  // Price every entered tile with the same 5-10-5 and terrain helpers used by
  // the production pathfinder. Separating base distance from surcharge makes
  // the one-extra-foot-per-foot rule visible without changing the total.
  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const next = path[index];
    const dx = next.coordinates.x - previous.coordinates.x;
    const dy = next.coordinates.y - previous.coordinates.y;
    const baseStep = calculateMovementCost(dx, dy, diagonalCount);
    const pricedStep = calculateStepMovementCost(
      dx,
      dy,
      diagonalCount,
      next.movementCost,
    );

    baseFeet += baseStep.cost;
    difficultTerrainSurchargeFeet += pricedStep.cost - baseStep.cost;
    if (baseStep.isDiagonal) {
      diagonalCount += 1;
    }
  }

  return {
    totalFeet: calculatePathMovementCost(path),
    baseFeet,
    difficultTerrainSurchargeFeet,
  };
}

function rejectMove(reason: string): PreviewCombatScenarioControlPatch {
  // A log-only patch is the adapter's atomic rejection receipt. The host will
  // append the reason while retaining the exact map and character references.
  return {
    logMessage: `Difficult Terrain move rejected: ${reason}`,
  };
}

function applyMovementAttempt(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  const { snapshot } = application;
  const mapData = snapshot.mapData;
  const mover = snapshot.characters.find(character => character.id === PATHFINDER_ID);

  if (application.value !== true) {
    return {
      logMessage: 'Difficult Terrain move control is ready.',
    };
  }
  if (!mapData) {
    return rejectMove('no battle map is loaded. Position and movement are unchanged.');
  }
  if (!mover) {
    return rejectMove('the Pathfinder is unavailable. No other combatant was changed.');
  }
  if (snapshot.turnState?.currentCharacterId !== PATHFINDER_ID) {
    return rejectMove('the Pathfinder does not own the current turn. Position and movement are unchanged.');
  }

  const moveCase = getSelectedMoveCase(snapshot);
  if (!moveCase) {
    return rejectMove('the selected route case is unknown. Position and movement are unchanged.');
  }

  const destinationPosition = getMoveDestination(moveCase);
  const destinationId = `${destinationPosition.x}-${destinationPosition.y}`;
  const destination = mapData.tiles.get(destinationId);
  const start = mapData.tiles.get(`${mover.position.x}-${mover.position.y}`);

  // Bounds and start-state checks happen before any path or cost is calculated.
  // This keeps off-board attempts from being clamped into a different move.
  if (!destination) {
    return rejectMove(`destination ${destinationId} is off-board. Position ${mover.position.x}-${mover.position.y} and movement are unchanged.`);
  }
  if (!start) {
    return rejectMove(`the Pathfinder's current tile is unavailable. Position and movement are unchanged.`);
  }
  if (destination.blocksMovement) {
    return rejectMove(`destination ${destinationId} is blocked. Position ${mover.position.x}-${mover.position.y} and movement are unchanged.`);
  }

  const occupant = snapshot.characters.find(character =>
    character.id !== mover.id
    && character.currentHP > 0
    && character.position.x === destinationPosition.x
    && character.position.y === destinationPosition.y
  );
  if (occupant) {
    return rejectMove(`destination ${destinationId} is occupied by ${occupant.name}. Position and movement are unchanged.`);
  }
  if (start.id === destination.id) {
    return rejectMove(`the Pathfinder already occupies ${destinationId}. Movement remains ${mover.actionEconomy.movement.used}/${mover.actionEconomy.movement.total} ft.`);
  }

  // The explicit direct case measures the authored mud lane. Every other legal
  // case delegates route choice to A*, which may take more cells when their
  // total price is lower than the short difficult-terrain route.
  const path = moveCase === 'direct-mud'
    ? buildDirectRoute(start, destination, mapData)
    : findPath(start, destination, mapData);
  if (path.length === 0 || path[path.length - 1]?.id !== destination.id) {
    return rejectMove(`no legal route reaches ${destinationId}. Position and movement are unchanged.`);
  }

  const cost = describeMovementCost(path);
  const movementCost = {
    type: 'movement-only' as const,
    movementCost: cost.totalFeet,
  };
  const beforeMovement = mover.actionEconomy.movement;
  const remainingFeet = Math.max(0, beforeMovement.total - beforeMovement.used);

  if (!canAffordActionCost(mover, movementCost)) {
    return rejectMove(
      `${moveCase === 'direct-mud' ? 'direct mud route' : 'selected route'} costs ${cost.totalFeet} ft `
      + `(${cost.baseFeet} ft base + ${cost.difficultTerrainSurchargeFeet} ft difficult-terrain surcharge), `
      + `but only ${remainingFeet} ft remain. Position ${mover.position.x}-${mover.position.y} and movement `
      + `${beforeMovement.used}/${beforeMovement.total} ft are unchanged.`,
    );
  }

  // The shared economy helper charges only the mover. Position is layered onto
  // that paid record, while every bystander keeps the same object reference.
  const paidMover = consumeActionCost(mover, movementCost);
  const movedPathfinder: CombatCharacter = {
    ...paidMover,
    position: { ...destinationPosition },
  };
  const characters = snapshot.characters.map(character =>
    character.id === PATHFINDER_ID ? movedPathfinder : character
  );
  const afterMovement = movedPathfinder.actionEconomy.movement;
  const routeKind = moveCase === 'direct-mud'
    ? 'direct authored mud route'
    : moveCase === 'one-square-farther'
      ? 'cheapest legal follow-up route'
      : 'cheapest legal route selected by A*';

  return {
    characters,
    logMessage: `Difficult Terrain move resolved: ${mover.position.x}-${mover.position.y} → ${destinationId} by ${routeKind}. `
      + `Route ${path.map(tile => tile.id).join(' → ')}; cost ${cost.totalFeet} ft `
      + `(${cost.baseFeet} ft base + ${cost.difficultTerrainSurchargeFeet} ft difficult-terrain surcharge). `
      + `Pathfinder movement ${beforeMovement.used}/${beforeMovement.total} → ${afterMovement.used}/${afterMovement.total} ft; `
      + `${Math.max(0, afterMovement.total - afterMovement.used)} ft remains.`,
  };
}

// ============================================================================
// Dry Bypass Availability
// ============================================================================
// The upper and lower bypasses are ordinary grass while open. Closing them
// floods those exact cells and makes them impassable, leaving the production
// pathfinder to decide whether the remaining route fits the movement budget.
// ============================================================================

function applyDryBypassesControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  bypassesOpen: boolean,
): PreviewCombatScenarioControlPatch {
  const mapData = snapshot.mapData;

  if (!mapData) {
    return {
      logMessage: 'Difficult Terrain control skipped because no battle map is loaded.',
    };
  }

  if (!hasEveryTile(mapData, DRY_BYPASS_TILE_IDS)) {
    return {
      logMessage: 'Difficult Terrain control skipped because the dry bypasses are incomplete.',
    };
  }

  // Both bypasses change together so the switch has one deterministic meaning:
  // open offers a 35-foot route; flooded removes both equivalent alternatives.
  const tiles = new Map(mapData.tiles);
  DRY_BYPASS_TILE_IDS.forEach(tileId => {
    const tile = mapData.tiles.get(tileId)!;
    tiles.set(tileId, bypassesOpen
      ? {
          ...tile,
          terrain: 'grass',
          movementCost: 5,
          blocksMovement: false,
          blocksLoS: false,
          decoration: null,
        }
      : {
          ...tile,
          terrain: 'water',
          movementCost: 5,
          blocksMovement: true,
          blocksLoS: false,
          decoration: null,
        });
  });

  return {
    mapData: {
      ...mapData,
      tiles,
    },
    logMessage: bypassesOpen
      ? 'Sandbox fact: the dry grass bypasses above and below the mud are open.'
      : 'Sandbox fact: both dry bypasses are flooded and block movement.',
  };
}

// ============================================================================
// Remaining Movement Budget
// ============================================================================
// The Pathfinder's speed is set on the canonical stats record because turn
// initialization recalculates movement from that value. The switch changes only
// movement already spent; it does not grant Dash or ignore difficult terrain.
// ============================================================================

function applyAlreadySpentControl(
  snapshot: PreviewCombatScenarioControlSnapshot,
  alreadySpent: boolean,
): PreviewCombatScenarioControlPatch {
  const pathfinderExists = snapshot.characters.some(
    character => character.id === PATHFINDER_ID,
  );

  if (!pathfinderExists) {
    return {
      logMessage: 'Difficult Terrain control skipped because the Pathfinder is unavailable.',
    };
  }

  // Replace only the Pathfinder. Other actors keep their original references,
  // and the Pathfinder keeps its current position and every unrelated rule fact.
  const characters = snapshot.characters.map((character): CombatCharacter => {
    if (character.id !== PATHFINDER_ID) {
      return character;
    }

    return {
      ...character,
      stats: {
        ...character.stats,
        speed: PATHFINDER_SPEED_FEET,
      },
      actionEconomy: {
        ...character.actionEconomy,
        movement: {
          total: PATHFINDER_SPEED_FEET,
          used: alreadySpent ? ALREADY_SPENT_FEET : 0,
        },
      },
    };
  });

  return {
    characters,
    logMessage: alreadySpent
      ? 'Sandbox fact: the Pathfinder has spent 15 feet and has 20 of 35 feet remaining.'
      : 'Sandbox fact: the Pathfinder has spent 0 feet and has all 35 feet remaining.',
  };
}

// ============================================================================
// Difficult Terrain Control Module
// ============================================================================
// The shared registry consumes this one module object. Dispatch stays explicit
// so a stale identifier produces a visible no-op instead of changing a nearby
// terrain fact by accident.
// ============================================================================

export const terrainScenarioControlModule: PreviewCombatScenarioControlModule = {
  scenarioId: 'terrain',
  controls,
  applyControl: application => {
    // Selectors describe the next attempt without moving anyone. The action
    // button consumes the selected value from the host's complete control set.
    if (application.controlId === MOVE_CASE_CONTROL_ID) {
      return isTerrainMoveCase(application.value)
        ? {
            logMessage: `Difficult Terrain move case selected: ${application.value}. No movement has occurred.`,
          }
        : {
            logMessage: 'Difficult Terrain move case rejected because its value is unknown.',
          };
    }

    if (application.controlId === ATTEMPT_MOVE_CONTROL_ID) {
      return applyMovementAttempt(application);
    }

    const enabled = requireToggleValue(application);

    if (enabled === null) {
      return {
        logMessage: `Difficult Terrain control "${application.controlId}" requires an on/off value.`,
      };
    }

    if (application.controlId === MUD_COST_CONTROL_ID) {
      return applyMudCostControl(application.snapshot, enabled);
    }

    if (application.controlId === DRY_BYPASSES_CONTROL_ID) {
      return applyDryBypassesControl(application.snapshot, enabled);
    }

    if (application.controlId === ALREADY_SPENT_CONTROL_ID) {
      return applyAlreadySpentControl(application.snapshot, enabled);
    }

    return {
      logMessage: `Unknown Difficult Terrain scenario control: ${application.controlId}.`,
    };
  },
};

// The registry imports the default value, while the named export lets focused
// tests identify this module without constructing a second wrapper object.
export default terrainScenarioControlModule;
