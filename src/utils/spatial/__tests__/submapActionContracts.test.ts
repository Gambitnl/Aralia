import { describe, it, expect } from 'vitest';
import {
  buildInspectSubmapTilePayload,
  buildQuickTravelPayload,
  buildStepDurationsSeconds,
  buildUpdateInspectedTileDescriptionPayload,
  DEFAULT_QUICK_TRAVEL_ENCOUNTER_CHANCE,
  DEFAULT_QUICK_TRAVEL_STEP_DELAY_MS,
  getInspectableTileKeys,
  INSPECT_TILE_TIME_ADVANCE_SECONDS,
  normalizeQuickTravelHandlerInputs,
  computeQuickTravelPath,
  type QuickTravelPathNode,
} from '../submapActionContracts';

/** Build a clear straight-line grid of walkable nodes for path tests. */
function gridLine(n: number): Map<string, QuickTravelPathNode> {
  const g = new Map<string, QuickTravelPathNode>();
  for (let x = 0; x < n; x++) {
    g.set(`${x}-0`, { id: `${x}-0`, coordinates: { x, y: 0 }, movementCost: 15, blocksMovement: false });
  }
  return g;
}

describe('submapActionContracts', () => {
  describe('getInspectableTileKeys', () => {
    it('returns the eight adjacent tiles around the player', () => {
      const keys = getInspectableTileKeys({ x: 5, y: 5 }, { rows: 10, cols: 10 });
      expect(keys.size).toBe(8);
      expect(keys.has('5,4')).toBe(true);
      expect(keys.has('6,5')).toBe(true);
      expect(keys.has('5,5')).toBe(false);
    });

    it('clips adjacency at submap edges', () => {
      const keys = getInspectableTileKeys({ x: 0, y: 0 }, { rows: 5, cols: 5 });
      expect(keys.size).toBe(3);
      expect(keys.has('1,0')).toBe(true);
      expect(keys.has('0,1')).toBe(true);
      expect(keys.has('1,1')).toBe(true);
    });
  });

  describe('computeQuickTravelPath', () => {
    it('finds a straight path and reports an ordered route + time', () => {
      const grid = gridLine(4);
      const r = computeQuickTravelPath({
        start: { x: 0, y: 0 },
        end: { x: 3, y: 0 },
        pathfindingGrid: grid,
        submapDimensions: { rows: 1, cols: 4 },
        worldBiomeId: 'plains',
        simpleHash: () => 1,
      });
      expect(r.isBlocked).toBe(false);
      expect(r.orderedPath.length).toBeGreaterThanOrEqual(2);
      expect(r.orderedPath[0]).toEqual({ x: 0, y: 0 });
      expect(r.orderedPath[r.orderedPath.length - 1]).toEqual({ x: 3, y: 0 });
      expect(r.path.has('3-0')).toBe(true);
    });

    it('flags a blocked destination and returns an empty route', () => {
      const grid = gridLine(3);
      grid.set('2-0', { id: '2-0', coordinates: { x: 2, y: 0 }, movementCost: Infinity, blocksMovement: true });
      const r = computeQuickTravelPath({
        start: { x: 0, y: 0 },
        end: { x: 2, y: 0 },
        pathfindingGrid: grid,
        submapDimensions: { rows: 1, cols: 3 },
        worldBiomeId: 'plains',
        simpleHash: () => 1,
      });
      expect(r.isBlocked).toBe(true);
      expect(r.orderedPath).toEqual([]);
    });
  });

  describe('buildQuickTravelPayload', () => {
    it('matches SubmapPane duration and step semantics', () => {
      const pathfindingGrid = new Map([
        ['5-5', { movementCost: 30 }],
        ['6-5', { movementCost: 15 }],
        ['7-5', { movementCost: 30 }],
      ]);

      const payload = buildQuickTravelPayload({
        destination: { x: 7, y: 5 },
        orderedPath: [
          { x: 5, y: 5 },
          { x: 6, y: 5 },
          { x: 7, y: 5 },
        ],
        travelTimeMinutes: 45,
        pathfindingGrid,
      });

      expect(payload.destination).toEqual({ x: 7, y: 5 });
      expect(payload.durationSeconds).toBe(2700);
      expect(payload.orderedPath).toHaveLength(3);
      expect(payload.stepDurationsSeconds).toEqual([900, 1800]);
      expect(payload.encounterChancePerStep).toBe(DEFAULT_QUICK_TRAVEL_ENCOUNTER_CHANCE);
      expect(payload.stepDelayMs).toBe(DEFAULT_QUICK_TRAVEL_STEP_DELAY_MS);
    });
  });

  describe('buildStepDurationsSeconds', () => {
    it('defaults missing grid nodes to 30 minutes converted to seconds', () => {
      const durations = buildStepDurationsSeconds(
        [{ x: 1, y: 1 }, { x: 2, y: 2 }],
        new Map(),
      );
      expect(durations).toEqual([1800]);
    });
  });

  describe('normalizeQuickTravelHandlerInputs', () => {
    it('falls back to current position plus destination when orderedPath is missing', () => {
      const normalized = normalizeQuickTravelHandlerInputs(
        {
          destination: { x: 8, y: 8 },
          durationSeconds: 120,
        },
        { x: 5, y: 5 },
      );

      expect(normalized.orderedPath).toEqual([
        { x: 5, y: 5 },
        { x: 8, y: 8 },
      ]);
      expect(normalized.routeSteps).toEqual([{ x: 8, y: 8 }]);
      expect(normalized.defaultStepDurationSeconds).toBe(120);
    });

    it('clamps encounter chance and step delay the same way handleQuickTravel does', () => {
      const normalized = normalizeQuickTravelHandlerInputs(
        {
          destination: { x: 6, y: 5 },
          durationSeconds: 60,
          orderedPath: [{ x: 5, y: 5 }, { x: 6, y: 5 }],
          encounterChancePerStep: 2,
          stepDelayMs: -500,
        },
        { x: 5, y: 5 },
      );

      expect(normalized.safeEncounterChance).toBe(1);
      expect(normalized.safeStepDelayMs).toBe(0);
    });
  });

  describe('inspect payload contract', () => {
    it('builds the inspect payload fields handleInspectSubmapTile expects', () => {
      const payload = buildInspectSubmapTilePayload({
        tileX: 4,
        tileY: 6,
        effectiveTerrainType: 'forest',
        worldBiomeId: 'forest',
        parentWorldMapCoords: { x: 12, y: 8 },
        activeFeatureConfig: { id: 'pond', icon: '💧' },
      });

      expect(payload.tileX).toBe(4);
      expect(payload.worldBiomeId).toBe('forest');
      expect(payload.parentWorldMapCoords).toEqual({ x: 12, y: 8 });
      expect(payload.activeFeatureConfig?.id).toBe('pond');
    });

    it('uses the same storage key format as handleInspectSubmapTile', () => {
      const details = buildInspectSubmapTilePayload({
        tileX: 2,
        tileY: 3,
        effectiveTerrainType: 'path',
        worldBiomeId: 'plains',
        parentWorldMapCoords: { x: 10, y: 11 },
      });

      const updatePayload = buildUpdateInspectedTileDescriptionPayload(details, 'Mossy stones.');
      expect(updatePayload.tileKey).toBe('10_11_2_3');
      expect(updatePayload.description).toBe('Mossy stones.');
    });

    it('documents the fixed inspect time advance constant', () => {
      expect(INSPECT_TILE_TIME_ADVANCE_SECONDS).toBe(300);
    });
  });
});
