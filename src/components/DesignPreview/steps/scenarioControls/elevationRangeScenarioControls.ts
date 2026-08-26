// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This scenario adapter is consumed by the Tactical Sandbox registry and host.
 * Run dependency sync after verification when its exports or imports change.
 */
// @dependencies-end

/**
 * This file prepares deterministic facts for the Elevation & Range sandbox.
 *
 * The controls set real terrain height, exact three-dimensional range edges,
 * finite-height sight blockers, and an open or blocked cliff transition. Two
 * action buttons ask the mounted combat engine to resolve or replay one stable
 * attack; this adapter never writes a hit, resource spend, or damage result.
 *
 * Called by: the Tactical Sandbox scenario-control registry and preview host.
 * Depends on: canonical elevation geometry, sight, pathfinding, and combat state.
 */

import type {
  Ability,
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  Position,
} from '../../../../types/combat';
import { calculatePathMovementCost } from '../../../../utils/combat';
import {
  getBattleMapTileAltitudeFeet,
  getCombatDistanceFeet,
  getCombatantAltitudeFeet,
} from '../../../../utils/spatial/elevationGeometry';
import { hasLineOfSight } from '../../../../utils/spatial/lineOfSight';
import { findPath } from '../../../../utils/spatial/pathfinding';
import type {
  PreviewCombatScenarioControlApplication,
  PreviewCombatScenarioControlModule,
  PreviewCombatScenarioControlPatch,
  PreviewCombatScenarioControlSnapshot,
  PreviewCombatScenarioControlValues,
  PreviewCombatScenarioControlValue,
} from './PreviewCombatScenarioControlTypes';

// ============================================================================
// Stable Scenario Identity
// ============================================================================
// One range tester, one target, and one separate climber keep the range and
// movement experiments independent while sharing the same authored board.
// ============================================================================

export const ELEVATION_RANGE_TESTER_ID = 'elevation_range-tester';
export const ELEVATION_RANGE_TARGET_ID = 'elevation_range-target';
export const ELEVATION_RANGE_CLIMBER_ID = 'elevation_range-climber';
export const ELEVATION_RANGE_PROBE_EVENT_ID = 'cs12-elevation-range-probe-001';
export const ELEVATION_RANGE_PROBE_RANGE_FEET = 30;

const RANGE_TESTER_START = { x: 1, y: 3 } as const;
const MOVEMENT_LOW_START = { x: 7, y: 8 } as const;
const MOVEMENT_HIGH_START = { x: 8, y: 8 } as const;
const DESIGNATED_ASCENT_TILE_ID = '8-8';
const CLIFF_BOUNDARY_X = 8;
const MANAGED_EFFECT_PREFIX = 'elevation-range-';

const ELEVATION_CASE_CONTROL_ID = 'elevation_case';
const RANGE_CASE_CONTROL_ID = 'range_boundary';
const LOS_BLOCKER_CONTROL_ID = 'los_blocker';
const MOVEMENT_CASE_CONTROL_ID = 'movement_case';
const RESOLVE_PROBE_CONTROL_ID = 'resolve_range_probe';
const REPLAY_PROBE_CONTROL_ID = 'replay_range_probe';

export type ElevationRangeElevationCase = 'level' | 'target_10' | 'target_20';
export type ElevationRangeBoundaryCase = 'exactly_in_range' | 'five_feet_out';
export type ElevationRangeLosCase = 'clear' | 'low_clear' | 'tall_blocked';
export type ElevationRangeMovementCase = 'ascent_open' | 'ascent_blocked' | 'descent_open';

const ELEVATION_CASES = new Set<ElevationRangeElevationCase>(['level', 'target_10', 'target_20']);
const RANGE_CASES = new Set<ElevationRangeBoundaryCase>(['exactly_in_range', 'five_feet_out']);
const LOS_CASES = new Set<ElevationRangeLosCase>(['clear', 'low_clear', 'tall_blocked']);
const MOVEMENT_CASES = new Set<ElevationRangeMovementCase>(['ascent_open', 'ascent_blocked', 'descent_open']);

export const ELEVATION_RANGE_PROBE: Ability = {
  id: 'elevation-range-probe',
  name: 'Elevation Range Probe',
  description: 'A stable thirty-foot attack resolved by production targeting and combat.',
  type: 'attack',
  attackType: 'spell',
  isMagical: true,
  cost: { type: 'action' },
  targeting: 'single_enemy',
  range: ELEVATION_RANGE_PROBE_RANGE_FEET / 5,
  attackBonus: 5,
  effects: [{ type: 'damage', dice: '1d4+2', damageType: 'force' }],
  icon: '↕',
};

const FIXED_ATTACK_ROLL_RNG = (): number => (12 - 0.5) / 20;
const FIXED_DAMAGE_RNG = (): number => 0.5;

// ============================================================================
// Deterministic Turn Ownership
// ============================================================================
// The range tester acts first, the climber second, and the target last. Reset
// can therefore prove a legal probe immediately while still exposing ordinary
// movement on the following player turn.
// ============================================================================

export function getElevationRangeInitiativeTotal(character: CombatCharacter): number {
  if (character.id === ELEVATION_RANGE_TESTER_ID) return 30;
  if (character.id === ELEVATION_RANGE_CLIMBER_ID) return 20;
  if (character.id === ELEVATION_RANGE_TARGET_ID) return 10;
  return 0;
}

// ============================================================================
// Controlled Input Parsing
// ============================================================================
// Every selector is validated independently. A stale browser value becomes an
// explicit no-op instead of partially rebuilding the combat board.
// ============================================================================

function readControlledValue<T extends string>(
  values: PreviewCombatScenarioControlValues | undefined,
  controlId: string,
  allowed: Set<T>,
  fallback: T,
): T {
  const value = values?.[controlId];
  return typeof value === 'string' && allowed.has(value as T) ? value as T : fallback;
}

function cloneProbe(): Ability {
  return {
    ...ELEVATION_RANGE_PROBE,
    cost: { ...ELEVATION_RANGE_PROBE.cost },
    effects: ELEVATION_RANGE_PROBE.effects.map(effect => ({ ...effect })),
  };
}

// ============================================================================
// Terrain Reconstruction
// ============================================================================
// Each selector rebuilds every CS12-owned tile from the full control value set.
// This makes selector order irrelevant and gives Reset one exact state.
// ============================================================================

function normalizeTile(tile: BattleMapTile): BattleMapTile {
  const managedEffects = tile.effects.filter(effect => !effect.startsWith(MANAGED_EFFECT_PREFIX));
  const wasManaged = managedEffects.length !== tile.effects.length;
  const isAuthoredCliff = tile.coordinates.x >= CLIFF_BOUNDARY_X;

  // The original expanded scenario owns a two-tier rock cliff at x>=8. Restore
  // that scaffold before applying the current crossing and blocker choices.
  if (isAuthoredCliff || wasManaged) {
    return {
      ...tile,
      terrain: isAuthoredCliff ? 'rock' : 'floor',
      elevation: tile.coordinates.x >= 12 ? 20 : isAuthoredCliff ? 10 : 0,
      movementCost: 5,
      blocksMovement: false,
      blocksLoS: false,
      airspace: undefined,
      effects: managedEffects,
    };
  }
  return tile;
}

function setManagedTile(
  tiles: Map<string, BattleMapTile>,
  position: Position,
  update: (tile: BattleMapTile) => BattleMapTile,
): void {
  const tileId = `${position.x}-${position.y}`;
  const tile = tiles.get(tileId);
  if (!tile) return;
  tiles.set(tileId, update(tile));
}

function getElevationFeet(elevationCase: ElevationRangeElevationCase): number {
  if (elevationCase === 'target_20') return 20;
  if (elevationCase === 'target_10') return 10;
  return 0;
}

function getRangeTargetPosition(
  elevationFeet: number,
  boundaryCase: ElevationRangeBoundaryCase,
): Position {
  // Vertical feet consume part of the fixed thirty-foot range. The horizontal
  // coordinate supplies the remainder, plus one square for the invalid case.
  const horizontalFeet = ELEVATION_RANGE_PROBE_RANGE_FEET - elevationFeet
    + (boundaryCase === 'five_feet_out' ? 5 : 0);
  return { x: RANGE_TESTER_START.x + horizontalFeet / 5, y: RANGE_TESTER_START.y };
}

function buildControlledMap(
  mapData: BattleMapData,
  elevationCase: ElevationRangeElevationCase,
  boundaryCase: ElevationRangeBoundaryCase,
  losCase: ElevationRangeLosCase,
  movementCase: ElevationRangeMovementCase,
): { mapData: BattleMapData; targetPosition: Position } {
  const tiles = new Map<string, BattleMapTile>();
  mapData.tiles.forEach((tile, tileId) => tiles.set(tileId, normalizeTile(tile)));

  const targetElevationFeet = getElevationFeet(elevationCase);
  const targetPosition = getRangeTargetPosition(targetElevationFeet, boundaryCase);

  // A three-cell north/south pedestal gives the 3D terrain mesh enough area to
  // display height while keeping the horizontal sight lane unobstructed.
  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    setManagedTile(tiles, { x: targetPosition.x, y: targetPosition.y + yOffset }, tile => ({
      ...tile,
      terrain: targetElevationFeet > 0 ? 'rock' : 'floor',
      elevation: targetElevationFeet,
      effects: [...tile.effects, `${MANAGED_EFFECT_PREFIX}target-pedestal`],
    }));
  }

  // Every x=8 square is a physical cliff face except the controlled crossing.
  // This makes a blocked crossing pathless rather than allowing a silent detour.
  tiles.forEach((tile, tileId) => {
    if (tile.coordinates.x !== CLIFF_BOUNDARY_X) return;
    tiles.set(tileId, {
      ...tile,
      blocksMovement: tileId === DESIGNATED_ASCENT_TILE_ID
        ? movementCase === 'ascent_blocked'
        : true,
    });
  });

  if (losCase !== 'clear') {
    const blockerPosition = {
      x: Math.floor((RANGE_TESTER_START.x + targetPosition.x) / 2),
      y: RANGE_TESTER_START.y,
    };
    const progress = (blockerPosition.x - RANGE_TESTER_START.x)
      / (targetPosition.x - RANGE_TESTER_START.x);
    const rayHeightFeet = 5 + targetElevationFeet * progress;
    const blockerTopFeet = losCase === 'low_clear'
      ? Math.max(0, rayHeightFeet - 5)
      : rayHeightFeet;

    setManagedTile(tiles, blockerPosition, tile => ({
      ...tile,
      terrain: 'wall',
      blocksMovement: true,
      blocksLoS: true,
      airspace: { blockerTopFeet },
      effects: [...tile.effects, `${MANAGED_EFFECT_PREFIX}sight-blocker`],
    }));
  }

  return { mapData: { ...mapData, tiles }, targetPosition };
}

// ============================================================================
// Actor Preparation And Visible Labels
// ============================================================================
// Character names carry exact altitude and measured distance into both token
// renderers. No high-ground modifier is added; attack bonus stays authored.
// ============================================================================

function prepareCharacters(
  snapshot: PreviewCombatScenarioControlSnapshot,
  mapData: BattleMapData,
  targetPosition: Position,
  movementCase: ElevationRangeMovementCase,
): CombatCharacter[] | null {
  const rawTester = snapshot.characters.find(character => character.id === ELEVATION_RANGE_TESTER_ID);
  const rawTarget = snapshot.characters.find(character => character.id === ELEVATION_RANGE_TARGET_ID);
  if (!rawTester || !rawTarget) return null;

  const testerBase: CombatCharacter = {
    ...rawTester,
    position: { ...RANGE_TESTER_START },
    abilities: [
      ...rawTester.abilities.filter(ability => ability.id !== ELEVATION_RANGE_PROBE.id),
      cloneProbe(),
    ],
  };
  const targetBase = {
    ...rawTarget,
    position: { ...targetPosition },
  };
  const targetAltitudeFeet = getCombatantAltitudeFeet(targetBase, mapData, targetPosition);
  const distanceFeet = getCombatDistanceFeet(testerBase, targetBase, mapData);
  const rangeState = distanceFeet <= ELEVATION_RANGE_PROBE_RANGE_FEET ? 'IN RANGE' : 'OUT OF RANGE';

  const tester: CombatCharacter = {
    ...testerBase,
    name: `Range Tester · 0 ft · ${ELEVATION_RANGE_PROBE_RANGE_FEET} ft probe`,
  };
  const target: CombatCharacter = {
    ...targetBase,
    name: `Range Target · ${targetAltitudeFeet} ft · ${distanceFeet} ft · ${rangeState}`,
  };

  const previousClimber = snapshot.characters.find(character => character.id === ELEVATION_RANGE_CLIMBER_ID);
  const climberSource = previousClimber ?? rawTester;
  const climberPosition = movementCase === 'descent_open'
    ? MOVEMENT_HIGH_START
    : MOVEMENT_LOW_START;
  const destination = movementCase === 'descent_open'
    ? MOVEMENT_LOW_START
    : MOVEMENT_HIGH_START;
  const startTile = mapData.tiles.get(`${climberPosition.x}-${climberPosition.y}`);
  const endTile = mapData.tiles.get(`${destination.x}-${destination.y}`);
  const movementPath = startTile && endTile ? findPath(startTile, endTile, mapData) : [];
  const movementCostFeet = movementPath.length > 0 ? calculatePathMovementCost(movementPath) : null;
  const movementLabel = movementCase === 'ascent_blocked'
    ? 'blocked ascent'
    : `${movementCase === 'descent_open' ? 'descent' : 'ascent'} · ${movementCostFeet ?? '?'} ft`;

  const climber: CombatCharacter = {
    ...climberSource,
    id: ELEVATION_RANGE_CLIMBER_ID,
    name: `Elevation Climber · ${movementLabel}`,
    team: 'player',
    position: { ...climberPosition },
    abilities: climberSource.abilities.filter(ability => ability.id !== ELEVATION_RANGE_PROBE.id),
  };

  return [
    ...snapshot.characters.filter(character => ![
      ELEVATION_RANGE_TESTER_ID,
      ELEVATION_RANGE_TARGET_ID,
      ELEVATION_RANGE_CLIMBER_ID,
    ].includes(character.id)),
    tester,
    climber,
    target,
  ];
}

// ============================================================================
// Complete Fixture And Readout
// ============================================================================
// Selectors call this one reconstruction path. The returned readout is derived
// from production helpers and is useful to focused tests or future inspectors.
// ============================================================================

export function prepareElevationRangeScenarioSnapshot(
  snapshot: PreviewCombatScenarioControlSnapshot,
): PreviewCombatScenarioControlPatch {
  if (!snapshot.mapData) {
    return { logMessage: 'Elevation & Range fixture skipped because no battle map is loaded.' };
  }

  const elevationCase = readControlledValue(
    snapshot.controlValues,
    ELEVATION_CASE_CONTROL_ID,
    ELEVATION_CASES,
    'target_10',
  );
  const boundaryCase = readControlledValue(
    snapshot.controlValues,
    RANGE_CASE_CONTROL_ID,
    RANGE_CASES,
    'exactly_in_range',
  );
  const losCase = readControlledValue(
    snapshot.controlValues,
    LOS_BLOCKER_CONTROL_ID,
    LOS_CASES,
    'clear',
  );
  const movementCase = readControlledValue(
    snapshot.controlValues,
    MOVEMENT_CASE_CONTROL_ID,
    MOVEMENT_CASES,
    'ascent_open',
  );
  const controlledMap = buildControlledMap(
    snapshot.mapData,
    elevationCase,
    boundaryCase,
    losCase,
    movementCase,
  );
  const characters = prepareCharacters(
    snapshot,
    controlledMap.mapData,
    controlledMap.targetPosition,
    movementCase,
  );

  if (!characters) {
    return { logMessage: 'Elevation & Range fixture skipped because its tester or target is missing.' };
  }

  const target = characters.find(character => character.id === ELEVATION_RANGE_TARGET_ID)!;
  const tester = characters.find(character => character.id === ELEVATION_RANGE_TESTER_ID)!;
  const distanceFeet = getCombatDistanceFeet(tester, target, controlledMap.mapData);
  return {
    mapData: controlledMap.mapData,
    characters,
    logMessage: `CS12 prepared ${distanceFeet} ft three-dimensional range, ${losCase.replace('_', ' ')}, and ${movementCase.replace('_', ' ')}. No high-ground attack bonus applies.`,
  };
}

export interface ElevationRangeScenarioReadout {
  testerAltitudeFeet: number;
  targetAltitudeFeet: number;
  distanceFeet: number;
  rangeFeet: number;
  lineOfSight: boolean;
  targetEligible: boolean;
  movementPathExists: boolean;
  movementCostFeet: number | null;
  attackBonus: number;
}

export function getElevationRangeScenarioReadout(
  snapshot: PreviewCombatScenarioControlSnapshot,
): ElevationRangeScenarioReadout | null {
  if (!snapshot.mapData) return null;
  const tester = snapshot.characters.find(character => character.id === ELEVATION_RANGE_TESTER_ID);
  const target = snapshot.characters.find(character => character.id === ELEVATION_RANGE_TARGET_ID);
  const climber = snapshot.characters.find(character => character.id === ELEVATION_RANGE_CLIMBER_ID);
  if (!tester || !target || !climber) return null;

  const testerTile = snapshot.mapData.tiles.get(`${tester.position.x}-${tester.position.y}`);
  const targetTile = snapshot.mapData.tiles.get(`${target.position.x}-${target.position.y}`);
  const destination = climber.position.x === MOVEMENT_HIGH_START.x
    ? MOVEMENT_LOW_START
    : MOVEMENT_HIGH_START;
  const destinationTile = snapshot.mapData.tiles.get(`${destination.x}-${destination.y}`);
  const climberTile = snapshot.mapData.tiles.get(`${climber.position.x}-${climber.position.y}`);
  if (!testerTile || !targetTile || !destinationTile || !climberTile) return null;

  const testerAltitudeFeet = getCombatantAltitudeFeet(tester, snapshot.mapData, tester.position);
  const targetAltitudeFeet = getCombatantAltitudeFeet(target, snapshot.mapData, target.position);
  const distanceFeet = getCombatDistanceFeet(tester, target, snapshot.mapData);
  const lineOfSight = hasLineOfSight(testerTile, targetTile, snapshot.mapData, {
    startAltitudeFeet: testerAltitudeFeet,
    endAltitudeFeet: targetAltitudeFeet,
  });
  const movementPath = findPath(climberTile, destinationTile, snapshot.mapData);

  return {
    testerAltitudeFeet,
    targetAltitudeFeet,
    distanceFeet,
    rangeFeet: ELEVATION_RANGE_PROBE_RANGE_FEET,
    lineOfSight,
    targetEligible: distanceFeet <= ELEVATION_RANGE_PROBE_RANGE_FEET && lineOfSight,
    movementPathExists: movementPath.length > 0,
    movementCostFeet: movementPath.length > 0 ? calculatePathMovementCost(movementPath) : null,
    attackBonus: ELEVATION_RANGE_PROBE.attackBonus ?? 0,
  };
}

// ============================================================================
// Production Action Requests
// ============================================================================
// Resolve and Replay deliberately publish the same stable event id. The target
// validator and ability transaction own legality, Action payment, dice, HP,
// logs, and repeat suppression.
// ============================================================================

function requestRangeProbe(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (application.value !== true) return { logMessage: '' };
  return {
    abilityExecution: {
      ability: cloneProbe(),
      casterId: ELEVATION_RANGE_TESTER_ID,
      targetId: ELEVATION_RANGE_TARGET_ID,
      attackRollRng: FIXED_ATTACK_ROLL_RNG,
      damageRng: FIXED_DAMAGE_RNG,
      executionEventId: ELEVATION_RANGE_PROBE_EVENT_ID,
    },
    logMessage: '',
  };
}

function applyElevationRangeControl(
  application: PreviewCombatScenarioControlApplication,
): PreviewCombatScenarioControlPatch {
  if (
    application.controlId === RESOLVE_PROBE_CONTROL_ID
    || application.controlId === REPLAY_PROBE_CONTROL_ID
  ) {
    return requestRangeProbe(application);
  }

  const selectorSets: Record<string, Set<string>> = {
    [ELEVATION_CASE_CONTROL_ID]: ELEVATION_CASES,
    [RANGE_CASE_CONTROL_ID]: RANGE_CASES,
    [LOS_BLOCKER_CONTROL_ID]: LOS_CASES,
    [MOVEMENT_CASE_CONTROL_ID]: MOVEMENT_CASES,
  };
  const allowed = selectorSets[application.controlId];
  if (!allowed || typeof application.value !== 'string' || !allowed.has(application.value)) {
    return {
      logMessage: `Elevation & Range control "${application.controlId}" ignored an unsupported value.`,
    };
  }

  const controlValues: Record<string, PreviewCombatScenarioControlValue> = {
    ...application.snapshot.controlValues,
    [application.controlId]: application.value,
  };
  return prepareElevationRangeScenarioSnapshot({
    ...application.snapshot,
    controlValues,
  });
}

// ============================================================================
// Registry Export
// ============================================================================
// Reset Board reapplies these defaults through the same complete fixture path,
// producing raised, exactly-in-range, clear-sight, open-ascent state every time.
// ============================================================================

const elevationRangeScenarioControls: PreviewCombatScenarioControlModule = {
  scenarioId: 'elevation_range',
  controls: [
    {
      id: ELEVATION_CASE_CONTROL_ID,
      label: 'Elevation Case',
      description: 'Set the target level, 10 ft high, or 20 ft high in both map renderers.',
      kind: 'select',
      defaultValue: 'target_10',
      options: [
        { value: 'level', label: 'Level · 0 ft' },
        { value: 'target_10', label: 'Raised · 10 ft' },
        { value: 'target_20', label: 'Raised · 20 ft' },
      ],
    },
    {
      id: RANGE_CASE_CONTROL_ID,
      label: '3D Range Boundary',
      description: 'Keep the selected elevation and place the target exactly at 30 ft or 5 ft beyond it.',
      kind: 'select',
      defaultValue: 'exactly_in_range',
      options: [
        { value: 'exactly_in_range', label: 'Exactly 30 ft · valid' },
        { value: 'five_feet_out', label: '35 ft · invalid' },
      ],
    },
    {
      id: LOS_BLOCKER_CONTROL_ID,
      label: 'Elevation-aware LoS Blocker',
      description: 'Compare a clear ray, a finite low blocker below it, and a taller blocker intersecting it.',
      kind: 'select',
      defaultValue: 'clear',
      options: [
        { value: 'clear', label: 'No blocker' },
        { value: 'low_clear', label: 'Low blocker · see over' },
        { value: 'tall_blocked', label: 'Tall blocker · blocked' },
      ],
    },
    {
      id: MOVEMENT_CASE_CONTROL_ID,
      label: 'Height Transition',
      description: 'Prepare an open 10 ft ascent, the blocked equivalent, or a controlled 10 ft descent. Falls remain separate.',
      kind: 'select',
      defaultValue: 'ascent_open',
      options: [
        { value: 'ascent_open', label: 'Open ascent · costs 15 ft' },
        { value: 'ascent_blocked', label: 'Blocked ascent · no path' },
        { value: 'descent_open', label: 'Open descent · costs 15 ft' },
      ],
    },
    {
      id: RESOLVE_PROBE_CONTROL_ID,
      label: 'Resolve Range Probe',
      description: 'Validate 3D range and elevated sight, then let production own Action, roll, damage, HP, and log.',
      kind: 'action',
      defaultValue: false,
    },
    {
      id: REPLAY_PROBE_CONTROL_ID,
      label: 'Replay Stable Probe',
      description: 'Redeliver the same event id; no validation result, roll, Action, damage, or HP effect may repeat.',
      kind: 'action',
      defaultValue: false,
    },
  ],
  applyControl: applyElevationRangeControl,
};

export default elevationRangeScenarioControls;
