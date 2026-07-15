// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 22:02:15
 * Dependents: components/Worldforge/TownPlanView.tsx, systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/interiorParts.ts, systems/worldforge/roster/generateTownRoster.ts, systems/worldforge/town/buildingPlotInput.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file generateInterior.ts — LEGACY ADAPTER over generateBuilding.
 *
 * Task 10 of the Building Blueprint Pipeline. The old in-file BSP generator is
 * gone: ONE generator (generateBuilding, Tasks 2–8) now owns interior
 * generation, and this module is a thin, deterministic mapping from the rich
 * BlueprintPlan to the legacy InteriorPlan shape every existing 3D-build
 * caller consumes (interiorParts, groundChunkLoader, the town roster).
 *
 * What the collapse keeps and loses:
 * - Rooms become their axis-aligned BBOXES (InteriorRoom is a rect). For an
 *   L-shaped blueprint room the bbox is a LOOSE bound — bboxes may overlap
 *   and no longer tile the envelope exactly.
 * - RoomPurpose (20 values) collapses onto the 6 legacy RoomRoles via
 *   PURPOSE_TO_ROLE below (total mapping — every purpose is covered).
 * - Doors keep {a, b, x, y, axis}; isEntry/openDir/swingInto are dropped
 *   (the legacy bridge derives the entry from a === EXTERIOR).
 * - Furnishing kinds pass through UNCHANGED, including kinds the legacy 3D
 *   bridge has no mesh for yet (bench, altar, desk, chair, weapon-rack) —
 *   the bridge's own unknown-kind skip governs there; the adapter never
 *   silently drops data.
 * - Windows, wall edges and wall runs have no legacy slot and are dropped
 *   (the legacy bridge computes its own walls from room rects).
 * - Basements exist in the BlueprintPlan (rollBasement below decides them
 *   deterministically per building) but InteriorPlan cannot represent level
 *   -1, so the adapter output stays basement-free: level -1 floors are
 *   skipped and the basement stair (fromLevel -1) is filtered out. Only the
 *   blueprint-primary 3D path (interiorParts.blueprintStructureParts)
 *   renders below-grade geometry.
 *
 * Lot fit: the plot's snapped frontage × depth are fed into generateBuilding
 * as maxWidthFt/maxDepthFt, clamping the invented footprint into the lot so
 * interiors never overhang their plot (C3-T2). plan.widthFt/depthFt echo the
 * ACTUAL building envelope (≤ the lot), which is what the renderer sizes
 * roofs and the wall envelope from.
 *
 * Seeds: the building derives from childSeedPath(seedPath,
 * `interior:<plot.id>`) — the same segment the legacy generator used — and
 * buildingId === plot.id. plot.id is unique within a town plan and the seed
 * path scopes the town, so (seedPath, plot.id) is globally unique. Interiors
 * in existing worlds re-roll once (approved plan consequence).
 */

import { childSeedPath, rngFromPath, streamPath, type SeedPath } from '../seedPath';
import type { Feet } from '../units';
import {
  generateBuilding,
  backstoryDigest,
  briefDigest,
  ensembleDigest,
  eventLogDigest,
  styleDigest,
} from './generateBuilding';
import type {
  BuildingBackstory,
  BuildingEvent,
  BuildingEventHistory,
  BuildingEnsemble,
  BlueprintDoor,
  BlueprintFloor,
  BlueprintPlan,
  BlueprintFurnishing,
  BlueprintRoom,
  BuildingType,
  HouseholdBrief,
  RoomPurpose,
  StyleContext,
} from './blueprintTypes';
import type {
  InteriorDoorway,
  InteriorFloor,
  InteriorFurnishing,
  InteriorPlan,
  InteriorRoom,
  InteriorStair,
  RoomRole,
} from './types';

/** Atomic grid (decision #12). */
const CELL_FT = 5;
/** Smallest lot the adapter will size a building into. */
const MIN_LOT_FT = 10;

export interface InteriorPlotInput {
  id: number;
  /** Closed quad, [x, y] feet, corners 0-1 = street frontage (TownPlan contract). */
  footprint: Array<[Feet, Feet]>;
  role: string;
  storeys: number;
  /** Town-authored block instruction; absent for legacy and isolated plots. */
  ensemble?: BuildingEnsemble;
  // v2 (all optional — legacy callers unchanged):
  /** Town population classification; when present it WINS over the role mapping. */
  buildingType?: BuildingType;
  /** The founding household brief (built via town/householdBrief.briefForPlot).
   *  Present only where the population pass ran; unpopulated towns pass none and
   *  the building generates briefless exactly as before. */
  household?: HouseholdBrief;
  /** Architectural style context assembled at the 3D bake from the atlas (Task 7):
   *  cultureType from the burg, climate from its biome, wealth from the plot's
   *  ward district, ageBand. Present only where the atlas can supply culture +
   *  biome; when absent the building generates style-less (no solved roof), and
   *  the legacy prism renders — honest absence, byte-identical to before. */
  style?: StyleContext;
  /** Optional replay/save override for the building's permanent history. */
  backstory?: BuildingBackstory;
  /** Optional legacy event array or compacted journal for this canonical plot. */
  eventLog?: BuildingEventHistory | readonly BuildingEvent[];
}

/** Ignore affine/rotation dust without ever rounding a genuinely short lot up. */
const snapDown = (v: number): number => Math.floor((v + 1e-6) / CELL_FT) * CELL_FT;

/**
 * Town plot role → BuildingType. Explicit and closed: an unmapped role throws
 * (no silent fallback — Remy's no-fallback directive; C3-T3).
 */
const ROLE_TO_TYPE: Record<string, BuildingType> = {
  house: 'cottage',
  market: 'shop',
  shop: 'shop',
  tavern: 'tavern',
  inn: 'tavern',
  workshop: 'workshop',
  craft: 'workshop',
  manor: 'manor',
  keep: 'keep',
  citadel: 'keep',
  civic: 'civic',
  temple: 'temple',
};

/** Resolve a plot role to a BuildingType; throws on an unmapped role. */
export function buildingTypeForRole(role: string): BuildingType {
  const type = ROLE_TO_TYPE[role];
  if (!type) {
    throw new Error(
      `generateInterior: no BuildingType mapping for plot role "${role}" ` +
      `(known: ${Object.keys(ROLE_TO_TYPE).join(', ')})`,
    );
  }
  return type;
}

/** Full RoomPurpose → legacy RoomRole table (total — every purpose covered). */
export const PURPOSE_TO_ROLE: Record<RoomPurpose, RoomRole> = {
  'hall': 'hall',
  'common-room': 'hall',
  'great-hall': 'hall',
  'nave': 'hall',
  'sanctuary': 'hall',
  'guard-room': 'hall',
  'corridor': 'hall',
  'kitchen': 'kitchen',
  'bedroom': 'bedroom',
  'guest-room': 'bedroom',
  'private-room': 'bedroom',
  'solar': 'bedroom',
  'shopfront': 'shopfloor',
  'workshop': 'workshop',
  'study': 'workshop',
  'storage': 'storage',
  'pantry': 'storage',
  'cellar': 'storage',
  'armory': 'storage',
  'vestry': 'storage',
  'forge': 'workshop',
  'counting-room': 'workshop',
  'servant-room': 'bedroom',
  'stockroom': 'storage',
  'brewhouse': 'storage',
};

const toRoom = (r: BlueprintRoom): InteriorRoom => ({
  id: r.id,
  role: PURPOSE_TO_ROLE[r.purpose],
  x: r.bbox.x,
  y: r.bbox.y,
  w: r.bbox.w,
  d: r.bbox.d,
});

const toDoorway = (d: BlueprintDoor): InteriorDoorway => ({
  a: d.a,
  b: d.b,
  x: d.x,
  y: d.y,
  axis: d.axis,
});

const toFurnishing = (f: BlueprintFurnishing): InteriorFurnishing => ({
  kind: f.kind,
  roomId: f.roomId,
  x: f.x,
  y: f.y,
  rotation: f.rotation,
});

const toFloor = (f: BlueprintFloor): InteriorFloor => ({
  level: f.level,
  rooms: f.rooms.map(toRoom),
  doorways: f.doors.map(toDoorway),
  furnishings: f.furnishings.map(toFurnishing),
});

// generateInterior is pure and deterministic but called repeatedly for the
// SAME plot (roster bedroom-count, 3D bake, chunk reloads). generateBuilding
// memoizes the BlueprintPlan; this memo keeps the legacy contract that
// identical (plot, seedPath) calls return the SAME InteriorPlan instance.
const interiorMemo = new Map<string, InteriorPlan>();
const INTERIOR_MEMO_CAP = 50_000;

/**
 * The FULL BlueprintPlan for a town plot — the same plan generateInterior
 * collapses onto the legacy InteriorPlan, exposed so 3D consumers (Task 12:
 * interiorParts → buildBuildingMeshData) can raise real blueprint geometry
 * (irregular shell, wall thickness, window voids) instead of the legacy
 * room-rect approximation. Deterministic and memoized via generateBuilding,
 * so calling this alongside generateInterior costs one map lookup.
 */
/**
 * Basement odds by building type. Manors and taverns nearly always dig
 * cellars (wine/stores), shops and workshops usually (stock), cottages
 * sometimes (root cellar). Tuned for flavor, not simulation.
 */
export const BASEMENT_CHANCE: Record<BuildingType, number> = {
  manor: 0.9,
  tavern: 0.8,
  shop: 0.6,
  workshop: 0.5,
  cottage: 0.25,
  townhouse: 0.4,
  tenement: 0.2,
  farmstead: 0.3,
  smithy: 0.4,
  inn: 0.85,
  storehouse: 0.7,
  temple: 0.6, // crypt
  keep: 0.9,
  civic: 0.5,
};

/**
 * Deterministic per-building basement decision: one draw from the plot's own
 * interior seed path on a NAMED sub-stream ('s:basement'), compared against
 * the type's chance above. The stream isolation means adding draws anywhere
 * else never flips a building's basement, and the decision depends only on
 * (interiorPath, type) — both already part of every memo key downstream.
 * No Math.random anywhere (determinism contract).
 */
export function rollBasement(type: BuildingType, interiorPath: SeedPath): boolean {
  return rngFromPath(streamPath(interiorPath, 'basement')).next() < BASEMENT_CHANCE[type];
}

export function blueprintForPlot(plot: InteriorPlotInput, seedPath: SeedPath): BlueprintPlan {
  const interiorPath = childSeedPath(seedPath, `interior:${plot.id}`);

  // Lot envelope from the footprint's edge lengths (rotation-free frame).
  const [c0, c1, , c3] = plot.footprint;
  const lotWidthFt = Math.max(MIN_LOT_FT, snapDown(Math.hypot(c1[0] - c0[0], c1[1] - c0[1])));
  const lotDepthFt = Math.max(MIN_LOT_FT, snapDown(Math.hypot(c3[0] - c0[0], c3[1] - c0[1])));
  const storeys = Math.max(1, Math.floor(plot.storeys || 1));
  // The town's own classification wins over the coarse role mapping; role is the
  // fallback only when the population pass did NOT tag this plot.
  const type = plot.buildingType ?? buildingTypeForRole(plot.role);

  return generateBuilding({
    buildingId: plot.id,
    type,
    seedPath: interiorPath,
    storeys,
    ensemble: plot.ensemble,
    basement: rollBasement(type, interiorPath),
    maxWidthFt: lotWidthFt,
    maxDepthFt: lotDepthFt,
    household: plot.household,
    // Style context (Task 7): when the bake supplied one, generateBuilding
    // resolves the dress, roof, and permanent history. Undefined keeps the
    // style-less legacy plan; an explicit backstory remains available to saves.
    style: plot.style,
    backstory: plot.backstory,
    eventLog: plot.eventLog,
  });
}

export function generateInterior(plot: InteriorPlotInput, seedPath: SeedPath): InteriorPlan {
  const interiorPath = childSeedPath(seedPath, `interior:${plot.id}`);

  // Lot envelope from the footprint's edge lengths (rotation-free frame).
  const [c0, c1, , c3] = plot.footprint;
  const lotWidthFt = Math.max(MIN_LOT_FT, snapDown(Math.hypot(c1[0] - c0[0], c1[1] - c0[1])));
  const lotDepthFt = Math.max(MIN_LOT_FT, snapDown(Math.hypot(c3[0] - c0[0], c3[1] - c0[1])));
  const storeys = Math.max(1, Math.floor(plot.storeys || 1));

  // Memo key includes the resolved type override, the brief digest and the
  // style/backstory digests (the same digests generateBuilding keys on)
  // so a typed/briefed/styled plot never collapses onto the plain entry.
  // Style-less plots append an empty style-digest segment, so their cached
  // InteriorPlan is unchanged (byte-stable legacy behavior).
  const memoKey =
    `${interiorPath}|${plot.role}|${storeys}|${lotWidthFt}|${lotDepthFt}` +
    `|${plot.buildingType ?? ''}|${briefDigest(plot.household)}|${styleDigest(plot.style)}` +
    `|${ensembleDigest(plot.ensemble)}|${backstoryDigest(plot.backstory)}` +
    `|${eventLogDigest(plot.eventLog)}`;
  const cached = interiorMemo.get(memoKey);
  if (cached) return cached;

  const plan = blueprintForPlot(plot, seedPath);

  const ground = plan.floors.find((f) => f.level === 0);
  if (!ground) {
    throw new Error(`generateInterior: plan for plot ${plot.id} has no ground floor`);
  }
  const uppers = plan.floors.filter((f) => f.level >= 1);

  const result: InteriorPlan = {
    plotId: plot.id,
    widthFt: plan.widthFt,
    depthFt: plan.depthFt,
    storeys,
    rooms: ground.rooms.map(toRoom),
    doorways: ground.doors.map(toDoorway),
    furnishings: ground.furnishings.map(toFurnishing),
    upperFloors: uppers.map(toFloor),
    stairs: plan.stairs
      .filter((s) => s.fromLevel >= 0)
      .map((s): InteriorStair => ({ fromFloor: s.fromLevel, x: s.x, y: s.y })),
  };
  // Keep legacy plans sparse, but preserve the old core's plot position when
  // structural history enlarged only one side of the blueprint envelope.
  if (plan.siteOriginFt) result.siteOriginFt = plan.siteOriginFt;
  if (interiorMemo.size >= INTERIOR_MEMO_CAP) interiorMemo.clear();
  interiorMemo.set(memoKey, result);
  return result;
}
