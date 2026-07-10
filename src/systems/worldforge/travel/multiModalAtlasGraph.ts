// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 19:11:10
 * Dependents: components/MapPane.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file multiModalAtlasGraph.ts - build one travel graph that can cross land
 * and sea in the same route.
 *
 * The normal atlas graph is single-mode: land movement cannot enter water, and
 * water movement cannot enter land. This file keeps the existing route planner
 * but gives it a graph with port transfer edges and per-edge travel minutes, so
 * a route can walk to a harbor, ride a ferry lane, and walk away from the next
 * harbor without running separate planners.
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { TravelGraph } from '../../travel/routePlanning';
import { atlasMilesPerUnit, buildRoadCells } from './atlasTravelGraph';
import {
  TERRAIN_TRAVEL_MODIFIERS,
  type TravelTerrain,
} from '../../../types/travel';

const LAND_THRESHOLD = 20;
const DEFAULT_LAND_MPH = 3;
const BOARDING_MINUTES = 60;

const DIFFICULT_BIOMES = new Set<string>([
  'Hot desert',
  'Cold desert',
  'Tropical rainforest',
  'Temperate rainforest',
  'Taiga',
  'Tundra',
  'Glacier',
  'Wetland',
]);

const BIOME_DANGER: Record<string, number> = {
  'Hot desert': 0.5,
  'Cold desert': 0.45,
  'Tropical rainforest': 0.55,
  'Temperate rainforest': 0.4,
  Taiga: 0.4,
  Tundra: 0.45,
  Glacier: 0.6,
  Wetland: 0.5,
  Savanna: 0.3,
  Grassland: 0.2,
  'Tropical seasonal forest': 0.35,
  'Temperate deciduous forest': 0.3,
};

const DEFAULT_LAND_DANGER = 0.25;
const FERRY_LANE_DANGER = 0.12;

// ============================================================================
// Sea danger tier constants (3A — ship open-water)
// ============================================================================
// Ferries are lane-bound and only ever see FERRY_LANE_DANGER. Ships can enter
// coastal and open-ocean cells, which carry progressively higher danger.
// SEA_DANGER_LANE intentionally mirrors FERRY_LANE_DANGER so both kinds agree
// on lane danger; the tiering is only applied when opts.sea.kind === 'ship'.
//
// INVARIANT: SEA_DANGER_LANE < SEA_DANGER_COASTAL < SEA_DANGER_OPEN. The sea
// encounter roll (travel G16) relies on this ordering, and seaTier.test.ts pins
// it. TUNABLE — flagged for design review.
// ============================================================================

/** Danger for a sea cell that sits on a generated ferry lane. TUNABLE — flagged for design review. */
export const SEA_DANGER_LANE = FERRY_LANE_DANGER; // 0.12
/** Danger for a ship in coastal water (≥1 land neighbor, not a lane). TUNABLE — flagged for design review. */
export const SEA_DANGER_COASTAL = 0.3;
/** Danger for a ship in open ocean (no land neighbors, not a lane). TUNABLE — flagged for design review. */
export const SEA_DANGER_OPEN = 0.5;

/** Sea danger tiers, ordered lane < coastal < open. */
export type SeaTier = 'lane' | 'coastal' | 'open';

/** Danger weight for a sea tier. Invariant preserved: lane < coastal < open. */
export function seaDangerForTier(tier: SeaTier): number {
  switch (tier) {
    case 'lane':
      return SEA_DANGER_LANE;
    case 'coastal':
      return SEA_DANGER_COASTAL;
    case 'open':
      return SEA_DANGER_OPEN;
  }
}

/**
 * Classify a sea cell into a danger tier from the atlas topology alone (no new
 * world-gen field): a cell on a generated ferry lane is `lane`; otherwise a cell
 * with ≥1 land neighbor is `coastal` (near shore); a cell with no land neighbor
 * is `open` ocean. This is a coarse proxy for "distance from shore" — the atlas
 * exposes cell adjacency + heights but not a continuous shore-distance field, so
 * one ring of neighbors is the available signal. Pass `laneCells` to avoid
 * rebuilding the ferry-lane set per call.
 */
export function classifySeaCell(
  atlas: FmgAtlasResult,
  cell: number,
  laneCells?: Set<number>,
): SeaTier {
  const cells = (atlas.pack as unknown as Packish).cells;
  const lanes = laneCells ?? buildFerryLaneCells(atlas);
  if (lanes.has(cell)) return 'lane';
  const isLandHeight = (c: number): boolean => (cells.h?.[c] ?? 0) >= LAND_THRESHOLD;
  return (cells.c?.[cell] ?? []).some(isLandHeight) ? 'coastal' : 'open';
}

/**
 * Aggregate sea danger for a route: the MAX sea-tier danger over the route's sea
 * cells (0 when the route never touches water). Mirrors how RoutePlan.danger is a
 * max over per-cell danger, so a route that crosses open ocean reads as more
 * dangerous than one that only hugs a ferry lane. Used by the committed-trip sea
 * encounter roll (travel G16).
 */
export function routeSeaDanger(atlas: FmgAtlasResult, cells: number[]): number {
  const heights = (atlas.pack as unknown as Packish).cells.h;
  const lanes = buildFerryLaneCells(atlas);
  let max = 0;
  for (const cell of cells) {
    if ((heights?.[cell] ?? 0) >= LAND_THRESHOLD) continue; // land cell — no sea danger
    const d = seaDangerForTier(classifySeaCell(atlas, cell, lanes));
    if (d > max) max = d;
  }
  return max;
}

type Packish = {
  cells: {
    c?: number[][];
    p?: Array<[number, number]>;
    h?: ArrayLike<number>;
    biome?: ArrayLike<number>;
    haven?: ArrayLike<number>;
  };
  burgs?: Array<{ cell?: number; port?: number }>;
  routes?: Array<{ group?: string; cells?: number[]; points?: number[][] }>;
};

export type SeaCapability =
  | { kind: 'ferry'; speedMph: number }
  | { kind: 'ship'; speedMph: number };

export interface MultiModalAtlasGraphOptions {
  /** Land speed for land legs. Defaults to walking speed until the UI passes a selected land transport. */
  landSpeedMph?: number;
  /** Sea capability for this trip. Null means land-only routing. */
  sea: SeaCapability | null;
}

interface PortTransfer {
  landCell: number;
  waterCell: number;
}

// ============================================================================
// Atlas Helpers
// ============================================================================
// This section reads the small parts of the FMG atlas needed for multimodal
// travel: land/sea height, ports, route lanes, positions, and biome names.
// ============================================================================

/** Cell ids on generated ferry lanes. Only `searoutes` count as maritime lanes. */
export function buildFerryLaneCells(atlas: FmgAtlasResult): Set<number> {
  const set = new Set<number>();
  for (const route of ((atlas.pack as unknown as Packish).routes ?? [])) {
    if (route.group !== 'searoutes') continue;

    // FMG-generated routes expose their path as route points. The new harbor
    // pass and some tests may also preserve a simpler `cells` array, so read
    // both shapes and treat them as the same ferry lane vocabulary.
    for (const cell of route.cells ?? []) set.add(cell);
    for (const point of route.points ?? []) {
      const cell = point[2];
      if (Number.isFinite(cell)) set.add(cell);
    }
  }
  return set;
}

function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function buildPortTransfers(atlas: FmgAtlasResult): PortTransfer[] {
  const cells = (atlas.pack as unknown as Packish).cells;
  const transfers: PortTransfer[] = [];

  for (const burg of ((atlas.pack as unknown as Packish).burgs ?? [])) {
    if (!burg.port || burg.cell == null) continue;

    const waterCell = cells.haven?.[burg.cell];
    if (waterCell == null || waterCell <= 0) continue;

    transfers.push({ landCell: burg.cell, waterCell });
  }

  return transfers;
}

// ============================================================================
// Graph Builder
// ============================================================================
// This section exposes the one `TravelGraph` the route planner needs. It keeps
// ordinary land-to-land and sea-to-sea movement, then admits land-to-sea movement
// only through explicit harbor transfer pairs.
// ============================================================================

export function buildMultiModalAtlasGraph(
  atlas: FmgAtlasResult,
  opts: MultiModalAtlasGraphOptions,
): TravelGraph {
  const pack = atlas.pack as unknown as Packish;
  const cells = pack.cells;
  const roadCells = buildRoadCells(atlas);
  const ferryLaneCells = buildFerryLaneCells(atlas);
  const portTransfers = buildPortTransfers(atlas);
  const landSpeedMph = opts.landSpeedMph ?? DEFAULT_LAND_MPH;
  const milesPerUnit = atlasMilesPerUnit(atlas);
  const names = (atlas.biomesData as unknown as { name?: string[] }).name;

  const position = (cell: number): [number, number] => {
    const point = cells.p?.[cell];
    return point ? [point[0], point[1]] : [0, 0];
  };

  const seaKind = opts.sea?.kind;

  const isLand = (cell: number): boolean => (cells.h?.[cell] ?? 0) >= LAND_THRESHOLD;
  const isFerryWater = (cell: number): boolean => !isLand(cell) && ferryLaneCells.has(cell);
  const biomeName = (cell: number): string => names?.[cells.biome?.[cell] ?? -1] ?? '';

  const isPortTransfer = (from: number, to: number): boolean =>
    portTransfers.some(
      (transfer) =>
        (transfer.landCell === from && transfer.waterCell === to) ||
        (transfer.waterCell === from && transfer.landCell === to),
    );

  const canEnter = (cell: number): boolean => {
    if (!cells.p?.[cell]) return false;
    if (isLand(cell)) return true;
    if (!opts.sea) return false;
    // Ships can enter any sea cell; ferries are restricted to lane cells.
    if (opts.sea.kind === 'ship') return true;
    return isFerryWater(cell);
  };

  const terrain = (cell: number): TravelTerrain => {
    if (!isLand(cell)) return 'open';
    if (roadCells.has(cell)) return 'road';
    return DIFFICULT_BIOMES.has(biomeName(cell)) ? 'difficult' : 'open';
  };

  return {
    neighbors: (cell) =>
      (cells.c?.[cell] ?? []).filter((neighbor) => {
        if (!canEnter(neighbor)) return false;

        const fromLand = isLand(cell);
        const toLand = isLand(neighbor);
        if (fromLand === toLand) return true;

        return Boolean(opts.sea) && isPortTransfer(cell, neighbor);
      }),
    position,
    terrain,
    passable: canEnter,
    danger: (cell) => {
      if (!isLand(cell)) {
        // Ships see three danger tiers based on cell type (lane/coastal/open),
        // classified from atlas topology. Ferries are lane-bound — keep the flat
        // legacy value so ferry behavior is byte-for-byte identical to before.
        if (seaKind === 'ship') {
          return seaDangerForTier(classifySeaCell(atlas, cell, ferryLaneCells));
        }
        return FERRY_LANE_DANGER;
      }
      const base = BIOME_DANGER[biomeName(cell)] ?? DEFAULT_LAND_DANGER;
      return roadCells.has(cell) ? base * 0.5 : base;
    },
    edgeMinutes: (from, to) => {
      if (isPortTransfer(from, to)) return BOARDING_MINUTES;

      const speed = isLand(to) ? landSpeedMph : (opts.sea?.speedMph ?? landSpeedMph);
      const modifier = isLand(to) ? TERRAIN_TRAVEL_MODIFIERS[terrain(to)] || 1 : 1;
      const miles = distance(position(from), position(to)) * milesPerUnit;
      return (miles / Math.max(0.1, speed * modifier)) * 60;
    },
  };
}
