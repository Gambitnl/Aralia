/**
 * This file holds renderer-independent helpers for Submap quick-travel and inspect
 * actions. It exists so future map surfaces can build the same action payloads
 * without copying logic from SubmapPane, and so tests can prove handler
 * assumptions stay stable during pre-deprecation extraction.
 *
 * State left behind: SubmapPane still builds payloads inline; a later pass can
 * route through these helpers once the focused contract tests are green.
 */
import type {
  InspectSubmapTilePayload,
  QuickTravelPayload,
  UpdateInspectedTileDescriptionPayload,
} from '../../types';
import type { BattleMapData, BattleMapTile } from '../../types/combat';
import { findPath } from './pathfinding';

/** Default encounter chance SubmapPane passes today; handler clamps to [0, 1]. */
export const DEFAULT_QUICK_TRAVEL_ENCOUNTER_CHANCE = 0.16;

/** Default step delay SubmapPane passes today; handler clamps to >= 0. */
export const DEFAULT_QUICK_TRAVEL_STEP_DELAY_MS = 3000;

/** Inspect actions always advance time by five minutes in the handler. */
export const INSPECT_TILE_TIME_ADVANCE_SECONDS = 300;

export interface PathNodeMovementCost {
  movementCost: number;
}

/** A pathfinding-grid node (renderer-independent shape used by quick travel). */
export interface QuickTravelPathNode extends PathNodeMovementCost {
  id: string;
  coordinates: { x: number; y: number };
  blocksMovement: boolean;
}

export interface ComputeQuickTravelPathInput {
  start: { x: number; y: number };
  end: { x: number; y: number };
  pathfindingGrid: Map<string, QuickTravelPathNode>;
  submapDimensions: { rows: number; cols: number };
  worldBiomeId: string;
  /** Deterministic hash (seed source for the pathfinder), e.g. proc-data simpleHash. */
  simpleHash: (x: number, y: number, seed: string) => number;
}

export interface ComputedQuickTravelPath {
  path: Set<string>;
  orderedPath: Array<{ x: number; y: number }>;
  /** Total travel time in minutes (matches the legacy useQuickTravelData.time). */
  timeMinutes: number;
  isBlocked: boolean;
}

/** Map an arbitrary world biome id to a pathfinder theme (mirrors the legacy rule). */
function pathfinderThemeFor(worldBiomeId: string): BattleMapData['theme'] {
  const valid: BattleMapData['theme'][] = ['forest', 'cave', 'dungeon', 'desert', 'swamp'];
  if ((valid as string[]).includes(worldBiomeId)) return worldBiomeId as BattleMapData['theme'];
  if (worldBiomeId === 'plains' || worldBiomeId === 'hills') return 'forest';
  if (worldBiomeId === 'mountain') return 'cave';
  return 'forest';
}

/**
 * Renderer-independent quick-travel path computation — the pure core formerly
 * inside `useQuickTravelData`. Given a pathfinding grid and start/end, returns the
 * ordered path, the key set, the travel time (minutes) and a blocked flag, so any
 * navigation surface can feed `buildQuickTravelPayload` without React.
 */
export function computeQuickTravelPath(input: ComputeQuickTravelPathInput): ComputedQuickTravelPath {
  const empty: ComputedQuickTravelPath = { path: new Set<string>(), orderedPath: [], timeMinutes: 0, isBlocked: false };
  const startNode = input.pathfindingGrid.get(`${input.start.x}-${input.start.y}`);
  const endNode = input.pathfindingGrid.get(`${input.end.x}-${input.end.y}`);
  if (!startNode || !endNode) return empty;
  if (endNode.blocksMovement) return { ...empty, isBlocked: true };

  const mapForPathfinder: BattleMapData = {
    dimensions: { width: input.submapDimensions.cols, height: input.submapDimensions.rows },
    tiles: input.pathfindingGrid as unknown as Map<string, BattleMapTile>,
    theme: pathfinderThemeFor(input.worldBiomeId),
    seed: input.simpleHash(0, 0, 'pathfinder_seed'),
  };

  const pathNodes = findPath(startNode as unknown as BattleMapTile, endNode as unknown as BattleMapTile, mapForPathfinder);
  if (pathNodes.length === 0 && startNode !== endNode) return { ...empty, isBlocked: true };

  const path = new Set(pathNodes.map((p) => p.id));
  const orderedPath = pathNodes.map((p) => p.coordinates);
  const timeMinutes = pathNodes.reduce((acc, node) => acc + (node as unknown as PathNodeMovementCost).movementCost, 0) - (startNode.movementCost || 0);
  return { path, orderedPath, timeMinutes, isBlocked: false };
}

export interface QuickTravelPathInput {
  destination: { x: number; y: number };
  orderedPath: Array<{ x: number; y: number }>;
  /** Total travel time in minutes, matching useQuickTravelData.time. */
  travelTimeMinutes: number;
  pathfindingGrid: Map<string, PathNodeMovementCost>;
  encounterChancePerStep?: number;
  stepDelayMs?: number;
}

export interface InspectTileInput {
  tileX: number;
  tileY: number;
  effectiveTerrainType: string;
  worldBiomeId: string;
  parentWorldMapCoords: { x: number; y: number };
  activeFeatureConfig?: InspectSubmapTilePayload['activeFeatureConfig'];
}

export interface NormalizedQuickTravelHandlerInputs {
  orderedPath: Array<{ x: number; y: number }>;
  routeSteps: Array<{ x: number; y: number }>;
  safeEncounterChance: number;
  safeStepDelayMs: number;
  defaultStepDurationSeconds: number;
}

/**
 * Returns the Moore-neighborhood tile keys a player may inspect. Mirrors
 * useInspectableTiles without React so other surfaces can share the rule.
 */
export function getInspectableTileKeys(
  playerCoords: { x: number; y: number },
  submapDimensions: { rows: number; cols: number },
): Set<string> {
  const tiles = new Set<string>();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const adjX = playerCoords.x + dx;
      const adjY = playerCoords.y + dy;
      if (adjX >= 0 && adjX < submapDimensions.cols && adjY >= 0 && adjY < submapDimensions.rows) {
        tiles.add(`${adjX},${adjY}`);
      }
    }
  }
  return tiles;
}

/**
 * Builds per-step duration seconds the same way SubmapPane does before dispatch.
 * Movement costs come from the pathfinding grid in minutes; each step is at least
 * one second after conversion.
 */
export function buildStepDurationsSeconds(
  orderedPath: Array<{ x: number; y: number }>,
  pathfindingGrid: Map<string, PathNodeMovementCost>,
): number[] {
  const stepPath = orderedPath.slice(1);
  return stepPath.map((step) => {
    const movementCostMinutes = pathfindingGrid.get(`${step.x}-${step.y}`)?.movementCost ?? 30;
    return Math.max(1, Math.round(movementCostMinutes * 60));
  });
}

/**
 * Builds the QUICK_TRAVEL payload shape SubmapPane dispatches today. Any future
 * navigation surface should call this (or match its output) before hitting
 * handleQuickTravel.
 */
export function buildQuickTravelPayload(input: QuickTravelPathInput): QuickTravelPayload {
  const stepDurationsSeconds = buildStepDurationsSeconds(input.orderedPath, input.pathfindingGrid);

  return {
    destination: input.destination,
    durationSeconds: Math.round(input.travelTimeMinutes * 60),
    orderedPath: input.orderedPath,
    stepDurationsSeconds,
    encounterChancePerStep: input.encounterChancePerStep ?? DEFAULT_QUICK_TRAVEL_ENCOUNTER_CHANCE,
    stepDelayMs: input.stepDelayMs ?? DEFAULT_QUICK_TRAVEL_STEP_DELAY_MS,
  };
}

/**
 * Builds the inspect_submap_tile payload SubmapPane dispatches today.
 */
export function buildInspectSubmapTilePayload(input: InspectTileInput): InspectSubmapTilePayload {
  return {
    tileX: input.tileX,
    tileY: input.tileY,
    effectiveTerrainType: input.effectiveTerrainType,
    worldBiomeId: input.worldBiomeId,
    parentWorldMapCoords: input.parentWorldMapCoords,
    activeFeatureConfig: input.activeFeatureConfig,
  };
}

/**
 * Storage key used by handleInspectSubmapTile when persisting inspected text.
 */
export function buildInspectTileStorageKey(details: InspectSubmapTilePayload): string {
  return `${details.parentWorldMapCoords.x}_${details.parentWorldMapCoords.y}_${details.tileX}_${details.tileY}`;
}

/**
 * Builds the reducer payload handleInspectSubmapTile dispatches after a successful
 * inspection response.
 */
export function buildUpdateInspectedTileDescriptionPayload(
  details: InspectSubmapTilePayload,
  description: string,
): UpdateInspectedTileDescriptionPayload {
  return {
    tileKey: buildInspectTileStorageKey(details),
    description,
  };
}

/**
 * Mirrors handleQuickTravel path selection and clamping so tests can prove UI
 * payloads and handler assumptions stay aligned without mounting SubmapPane.
 */
export function normalizeQuickTravelHandlerInputs(
  quickTravel: QuickTravelPayload,
  currentSubmapCoords: { x: number; y: number },
): NormalizedQuickTravelHandlerInputs {
  const orderedPath =
    Array.isArray(quickTravel.orderedPath) && quickTravel.orderedPath.length > 0
      ? quickTravel.orderedPath
      : [currentSubmapCoords, quickTravel.destination];

  const routeSteps = orderedPath.slice(1);
  const safeEncounterChance = Math.max(0, Math.min(1, Number(quickTravel.encounterChancePerStep ?? DEFAULT_QUICK_TRAVEL_ENCOUNTER_CHANCE)));
  const safeStepDelayMs = Math.max(0, Number(quickTravel.stepDelayMs ?? DEFAULT_QUICK_TRAVEL_STEP_DELAY_MS));
  const defaultStepDurationSeconds =
    routeSteps.length > 0
      ? Math.max(1, Math.round(Number(quickTravel.durationSeconds || 0) / routeSteps.length))
      : 0;

  return {
    orderedPath,
    routeSteps,
    safeEncounterChance,
    safeStepDelayMs,
    defaultStepDurationSeconds,
  };
}
