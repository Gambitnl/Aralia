// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/06/2026, 14:09:00
 * Dependents: components/World3D/World3DDemo.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file groundChunkLoader.ts â€” walking-scale ChunkData producer + loader for
 * Worldforge ground mode (slice 3b of Azgaar â†’ submap â†’ 3D world mode).
 *
 * KEY INSIGHT (replaces the planned coords.ts refactor): the world3d
 * geometry/bundle/streamer layers are SCALE-FREE â€” chunkGeometry spaces
 * vertices by CHUNK_WORLD_SIZE and maps height 0..100 â†’ meters via
 * heightToMeters; only chunkSampler's grid math bakes in the continent
 * METERS_PER_CELL (1024). So ground mode needs no core surgery: this module
 * samples chunks at GROUND scale (one LocalArtifact cell = 5 ft = 1.524 m)
 * and hands them to the SAME buildChunkBundle. The streamer, LOD and scene
 * consume the result unchanged.
 *
 * Coverage: a LocalArtifact spans 600 Ã— 1.524 m = 914.4 m â‰ˆ 7.14 chunks per
 * axis (CHUNK_WORLD_SIZE = 128 m). Vertices beyond the artifact clamp to its
 * edge values (flat continuation), mirroring chunkSampler's clamping.
 */
import type { ChunkData, ChunkMeshBundle, VegetationScatter } from "../../world3d/types";
import { buildChunkBundle } from "../../world3d/chunkBundle";
import { WORLD3D_CONFIG, heightToMeters } from "../../world3d/config";
import { biomeColor } from "../../world3d/terrainColor";
import type { LocalArtifact, RegionArtifact } from "../artifacts";
import { localArtifactToWorldData, GROUND_METERS_PER_CELL } from "./groundWorldAdapter";
import { generateTownPlan } from "../town/generateTownPlan";
import { buildInteriorParts, interiorEnvelopeM, type SitePart, type OccupantBody } from "./interiorParts";
import { generateTownRoster } from "../roster/generateTownRoster";
import type { TownRoster, Occupant } from "../roster/types";
import { generateBody } from "../body/generateBody";
import type { BodyPlan } from "../body/types";
import { childSeedPath } from "../seedPath";
import { localWithDeltas } from "./groundDeltas";
import type { WorldDelta } from "../delta/types";
import { getBurgNamer } from "./legacySubmapBridge";
import { SeededRandom } from "../../../utils/random/seededRandom";
import { generateBusinessName } from "../../economy/NpcBusinessManager";
import type { BusinessType, WorldBusiness } from "../../../types/business";
import type { RichNPC } from "../../../types/world";
import type { BattleMapData, BattleMapTile, BattleMapTerrain, BattleMapDecoration } from "@/types/combat";
import { generateGroundHostiles } from "./groundHostiles";

/** A polyline in ground world-meters with a uniform width (meters). */
interface GroundPolyline {
  points: Array<{ x: number; z: number }>;
  widthM: number;
}

/** A roster person resolved to the plot center where their figure is rendered. */
interface GroundOccupantSite {
  burgId: number;
  occupantId: number;
  name: string;
  xM: number;
  zM: number;
}

/** An artifact feature in ground meters (world space, origin = artifact NW). */
export interface GroundFeature {
  id: number;
  kind: string;
  xM: number;
  zM: number;
}

// ============================================================================
// Ground Hostile Creature definition
// ============================================================================
// This interface defines a hostile creature placed in the ground world. It
// holds coordinate positions in meters relative to the ground world's origin
// and the monster id matching standard bestiary entries (e.g. "Goblin").
// ============================================================================
export interface GroundHostile {
  id: string;
  name: string;
  xM: number;
  zM: number;
  monsterId: string;
}

/** Pre-extracted, chunk-samplable view of a LocalArtifact. */
export interface GroundWorld {
  cols: number;
  rows: number;
  /** 0..100 heights (groundWorldAdapter domain), row-major. */
  heights: number[];
  biomeIds: string[];
  /** Total ground extent, world meters. */
  extentMetersX: number;
  extentMetersZ: number;
  /** The artifact's OWN placed features (trees/bushes/boulders…), meters. */
  features: GroundFeature[];
  /** Hostile monsters placed deterministically on the ground map. */
  hostiles: GroundHostile[];
  /** River/road centerlines crossing the artifact, ground meters. */
  rivers: GroundPolyline[];
  roads: GroundPolyline[];
  /** Town sites overlapping the artifact, center in ground meters. */
  towns: Array<{ burgId: number; xM: number; zM: number; halfM: number }>;
  /** Town-plan building plots (C3 generateTownPlan), centers in meters. */
  buildings: Array<{
    id: string;
    xM: number;
    zM: number;
    /** Plot footprint corners, ground meters (quad order from the plan). */
    cornersM: Array<{ x: number; z: number }>;
    /** Building height, meters (storeys × 3). */
    heightM: number;
    role: string;
    /** Interior wall envelope, meters (≤ plot; roofs/floors fit THIS). */
    wallWidthM: number;
    wallDepthM: number;
    /** L4 interior: walls + furnishings as site-local boxes (seamless). */
    parts: SitePart[];
    name?: string;
    unlabeled?: boolean;
    labelRangeM?: number;
  }>;
  /** Occupant rosters per town (L4 — future UI/schedules consume these). */
  rosters: TownRoster[];
  /**
   * Roster occupants resolved to their current plot center. The figure boxes
   * already live inside building parts; these entries are marker-only labels.
   */
  occupants: GroundOccupantSite[];
}

const FEET_TO_METERS = 0.3048;

/** Region polylines (feet, world space) → ground meters, kept if any point
 * lands inside the artifact window (fine clipping happens per chunk). */
function regionPolylinesToGround(
  lines: Array<{ centerline: Array<[number, number]>; widthFt: number }>,
  local: LocalArtifact,
): GroundPolyline[] {
  const { bounds } = local;
  const out: GroundPolyline[] = [];
  for (const line of lines) {
    const pts = line.centerline.map(([fx, fy]) => ({
      x: (fx - bounds.x) * FEET_TO_METERS,
      z: (fy - bounds.y) * FEET_TO_METERS,
    }));
    const extentX = bounds.width * FEET_TO_METERS;
    const extentZ = bounds.height * FEET_TO_METERS;
    const touches = pts.some(
      (p) => p.x >= -50 && p.x <= extentX + 50 && p.z >= -50 && p.z <= extentZ + 50,
    );
    if (touches && pts.length >= 2) {
      out.push({ points: pts, widthM: Math.max(1, line.widthFt * FEET_TO_METERS) });
    }
  }
  return out;
}

export interface MakeGroundWorldOptions {
  /** In-game hour 0–23: working adults stand at their work plot during
   * business hours (8–18), at home otherwise. Default noon. */
  hour?: number;
  /** Saved world deltas (B6/B7 plot edits) — replayed onto each town plan
   * before buildings/interiors/rosters derive from it, so the 3D village
   * reflects player edits. */
  deltas?: WorldDelta[];
  worldBusinesses?: Record<string, WorldBusiness>;
  generatedNpcs?: Record<string, RichNPC>;
}

export function makeGroundWorld(
  local: LocalArtifact,
  seed: number,
  region?: RegionArtifact,
  opts: MakeGroundWorldOptions = {},
): GroundWorld {
  const wd = localArtifactToWorldData(local, seed);
  const townContent = groundTowns(local, region, opts.hour ?? 12, opts.deltas ?? [], seed, opts);

  // Each makeGroundWorld call receives a freshly allocated height array from
  // localArtifactToWorldData. Flattening mutates only that per-call array, so
  // the LocalArtifact terrain and any future makeGroundWorld calls stay clean.
  flattenBuildingTerrainPads(
    wd.heights,
    wd.gridSize.cols,
    wd.gridSize.rows,
    townContent.buildings,
  );

  const features: GroundFeature[] = local.features.map((f) => ({
    id: f.id,
    kind: f.kind,
    xM: (f.x - local.bounds.x) * FEET_TO_METERS,
    zM: (f.y - local.bounds.y) * FEET_TO_METERS,
  }));

  const extentX = wd.gridSize.cols * GROUND_METERS_PER_CELL;
  const extentZ = wd.gridSize.rows * GROUND_METERS_PER_CELL;
  const centerX = extentX / 2;
  const centerZ = extentZ / 2;

  // Derive hostile spawns from region markers/zones (HOSTILE-1).
  // Pure, deterministic, seeded. Empty when the window has no hostile
  // context — peaceful tiles spawn nothing (hard rule: no fallback hostiles).
  const hostiles: GroundHostile[] = generateGroundHostiles(
    region?.markers,
    region?.zones,
    seed,
    local.bounds.x,
    local.bounds.y,
    local.bounds.width,
    local.bounds.height,
  );

  return {
    cols: wd.gridSize.cols,
    rows: wd.gridSize.rows,
    heights: wd.heights,
    biomeIds: wd.biomeIds,
    extentMetersX: extentX,
    extentMetersZ: extentZ,
    features,
    hostiles,
    rivers: region ? regionPolylinesToGround(region.rivers, local) : [],
    // Region routes + the town plan's own streets ride the same ribbon path
    roads: [
      ...(region ? regionPolylinesToGround(region.roads, local) : []),
      ...townContent.planStreets,
    ],
    towns: townContent.towns,
    buildings: townContent.buildings,
    rosters: townContent.rosters,
    occupants: townContent.occupants,
  };
}

/**
 * Flatten building plots directly into the encoded terrain grid.
 *
 * Buildings, their interior parts, and occupant markers all ask the same
 * GroundWorld for surface height later in the loader. Leveling this one height
 * array keeps every consumer in agreement without adding building-specific
 * exceptions to the chunk sampler or renderer.
 */
function flattenBuildingTerrainPads(
  heights: number[],
  cols: number,
  rows: number,
  buildings: GroundWorld["buildings"],
): void {
  // Pad heights are sampled from the original terrain before any plot changes.
  // This avoids construction order affecting nearby buildings.
  const originalHeights = heights.slice();
  const footprintPads = new Map<number, number>();
  const skirtPads = new Map<number, number[]>();

  for (const building of buildings) {
    if (building.cornersM.length < 3) continue;

    // The plot centroid is the construction elevation. Keeping it in the
    // 0..100 encoded domain avoids unit conversions and matches the ground
    // sampler's later input.
    const centroid = {
      x: building.cornersM.reduce((sum, corner) => sum + corner.x, 0) / building.cornersM.length,
      z: building.cornersM.reduce((sum, corner) => sum + corner.z, 0) / building.cornersM.length,
    };
    const padHeight = sampleEncodedHeight(
      originalHeights,
      cols,
      rows,
      centroid.x,
      centroid.z,
    );
    const footprintIndexes = buildingFootprintCells(cols, rows, building.cornersM);
    const footprintSet = new Set(footprintIndexes);

    // Every cell whose center falls inside the plot is made perfectly level.
    for (const index of footprintIndexes) {
      footprintPads.set(index, padHeight);
    }

    // A one-cell ring around the plot is blended halfway toward the pad. The
    // ring softens the join to the natural slope without widening the actual
    // level building footprint.
    for (const index of footprintIndexes) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const neighborCol = col + dx;
          const neighborRow = row + dz;
          if (neighborCol < 0 || neighborCol >= cols || neighborRow < 0 || neighborRow >= rows) continue;
          const neighborIndex = neighborRow * cols + neighborCol;
          if (footprintSet.has(neighborIndex)) continue;
          const pads = skirtPads.get(neighborIndex) ?? [];
          pads.push(padHeight);
          skirtPads.set(neighborIndex, pads);
        }
      }
    }
  }

  // Footprints win over skirts so a neighboring building cannot slope another
  // building's interior. Overlapping skirt pads average their target height,
  // keeping the result deterministic if close plots share a transition cell.
  for (const [index, padHeight] of footprintPads) {
    heights[index] = padHeight;
  }
  for (const [index, padHeights] of skirtPads) {
    if (footprintPads.has(index)) continue;
    const averagePadHeight = padHeights.reduce((sum, height) => sum + height, 0) / padHeights.length;
    heights[index] = originalHeights[index] + (averagePadHeight - originalHeights[index]) * 0.5;
  }
}

function buildingFootprintCells(
  cols: number,
  rows: number,
  corners: Array<{ x: number; z: number }>,
): number[] {
  // The bounds trim the scan to the plot's neighborhood; the quad test below
  // remains the source of truth for rotated or skewed footprints.
  const minCol = Math.max(0, Math.floor(Math.min(...corners.map((corner) => corner.x)) / GROUND_METERS_PER_CELL) - 1);
  const maxCol = Math.min(cols - 1, Math.ceil(Math.max(...corners.map((corner) => corner.x)) / GROUND_METERS_PER_CELL) + 1);
  const minRow = Math.max(0, Math.floor(Math.min(...corners.map((corner) => corner.z)) / GROUND_METERS_PER_CELL) - 1);
  const maxRow = Math.min(rows - 1, Math.ceil(Math.max(...corners.map((corner) => corner.z)) / GROUND_METERS_PER_CELL) + 1);
  const indexes: number[] = [];

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const center = {
        x: (col + 0.5) * GROUND_METERS_PER_CELL,
        z: (row + 0.5) * GROUND_METERS_PER_CELL,
      };
      if (pointInsideConvexQuad(center, corners)) indexes.push(row * cols + col);
    }
  }

  return indexes;
}

function pointInsideConvexQuad(point: { x: number; z: number }, corners: Array<{ x: number; z: number }>): boolean {
  // Generated plot corners form convex quads. A point inside the plot stays on
  // the same side of every directed edge.
  let sign = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const cross = (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
    if (Math.abs(cross) < 1e-9) continue;
    const nextSign = Math.sign(cross);
    if (sign !== 0 && nextSign !== sign) return false;
    sign = nextSign;
  }
  return true;
}

function sampleEncodedHeight(
  heights: number[],
  cols: number,
  rows: number,
  wxM: number,
  wzM: number,
): number {
  // This mirrors groundSurfaceY's encoded-grid interpolation but intentionally
  // stops before heightToMeters because terrain pads are stored in 0..100.
  const clampX = (v: number) => Math.max(0, Math.min(cols - 1, v));
  const clampY = (v: number) => Math.max(0, Math.min(rows - 1, v));
  const gx = clampX(wxM / GROUND_METERS_PER_CELL);
  const gy = clampY(wzM / GROUND_METERS_PER_CELL);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = clampX(x0 + 1);
  const y1 = clampY(y0 + 1);
  const fx = gx - x0;
  const fy = gy - y0;
  const h = (xx: number, yy: number) => heights[yy * cols + xx] ?? 0;
  const top = h(x0, y0) * (1 - fx) + h(x1, y0) * fx;
  const bottom = h(x0, y1) * (1 - fx) + h(x1, y1) * fx;
  return top * (1 - fy) + bottom * fy;
}

/**
 * Project a parametric BodyPlan (feet, BODY-1) into the renderer's OccupantBody
 * (meters + hex). Torso box depth derives from the chest girth treated as a
 * circumference (girth / π), so a stockier build reads as a deeper figure.
 */
function bodyPlanToOccupantBody(plan: BodyPlan): OccupantBody {
  const p = plan.proportions;
  return {
    heightM: p.height * FEET_TO_METERS,
    shoulderWidthM: p.shoulderWidth * FEET_TO_METERS,
    depthM: (p.torsoGirth / Math.PI) * FEET_TO_METERS,
    headSizeM: p.headSize * FEET_TO_METERS,
    skinToneHex: plan.skinToneHex,
    clothingHex: plan.clothingPrimaryHex,
  };
}

function getBusinessTypeForPlot(role: string, plotId: number): BusinessType {
  const types: BusinessType[] = role === 'market'
    ? ['general_store', 'tavern', 'apothecary', 'trading_company', 'enchanter_shop']
    : ['smithy', 'mine', 'farm', 'trading_company'];
  const index = Math.abs(Math.imul(plotId + 17, 2654435761) >>> 8) % types.length;
  return types[index];
}

/**
 * Town content for the ground window: the site marker (label + keep box),
 * and — the C3 payoff — the town's GENERATED plan: streets become road
 * ribbons, plots become building boxes. Deterministic via the region's
 * seed path, so the 3D town matches the 2D town plan exactly.
 */
function groundTowns(
  local: LocalArtifact,
  region: RegionArtifact | undefined,
  hour: number,
  deltas: WorldDelta[],
  worldSeed: number,
  opts: MakeGroundWorldOptions = {},
): {
  towns: GroundWorld["towns"];
  buildings: GroundWorld["buildings"];
  planStreets: GroundPolyline[];
  rosters: TownRoster[];
  occupants: GroundOccupantSite[];
} {
  const exX = local.bounds.width * FEET_TO_METERS;
  const exZ = local.bounds.height * FEET_TO_METERS;

  const towns: GroundWorld["towns"] = [];
  const buildings: GroundWorld["buildings"] = [];
  const planStreets: GroundPolyline[] = [];
  const rosters: TownRoster[] = [];
  const occupants: GroundOccupantSite[] = [];

  for (const t of region?.townSites ?? []) {
    const xM = (t.envelope.x + t.envelope.width / 2 - local.bounds.x) * FEET_TO_METERS;
    const zM = (t.envelope.y + t.envelope.height / 2 - local.bounds.y) * FEET_TO_METERS;
    const halfM = (Math.max(t.envelope.width, t.envelope.height) / 2) * FEET_TO_METERS;
    if (xM < -halfM || xM > exX + halfM || zM < -halfM || zM > exZ + halfM) continue;

    towns.push({ burgId: t.burgId, xM, zM, halfM });

    // Player edits replay over the regenerated plan (GROUND-DELTA-1): a
    // modified plot changes its interior, a removed one vanishes, an added
    // building appears — deterministic base + delta layer (decision #14).
    const basePlan = generateTownPlan(t, region!.seedPath);
    const plan = deltas.length
      ? (localWithDeltas(local, basePlan, deltas).townPlan ?? basePlan)
      : basePlan;
    for (const s of plan.streets) {
      planStreets.push({
        points: s.centerline.map(([fx, fy]) => ({
          x: (fx - local.bounds.x) * FEET_TO_METERS,
          z: (fy - local.bounds.y) * FEET_TO_METERS,
        })),
        // 2.5 m floor: thinner ribbons vanish against grass at walking
        // scale (Remy shot-1 review) — a village lane reads at ~8 ft.
        widthM: Math.max(2.5, s.widthFt * FEET_TO_METERS),
      });
    }
    // Occupants live where the floor plans say they can (ROSTER-1), and
    // stand at work during business hours (time-of-day v0).
    // Culture-true names from the burg's culture (FMG Markov chains under a
    // scoped PRNG swap in getBurgNamer). No-fallback directive (2026-06-15):
    // getBurgNamer throws if the culture can't resolve — no syllable substitute.
    const nameFor = getBurgNamer(worldSeed, t.burgId);
    const roster = generateTownRoster(plan, region!.seedPath, { nameFor });

    // Post-process the roster: map each shopkeeper/artisan to the business owner name
    for (const o of roster.occupants) {
      if (o.workPlotId !== undefined) {
        const bizId = `biz_burg_${t.burgId}_plot_${o.workPlotId}`;
        const npcId = `npc_burg_${t.burgId}_plot_${o.workPlotId}`;
        let ownerNpc = opts.generatedNpcs?.[npcId];
        if (!ownerNpc) {
          const biz = opts.worldBusinesses?.[bizId];
          if (biz) {
            ownerNpc = opts.generatedNpcs?.[biz.ownerId];
          }
        }
        if (ownerNpc) {
          o.name = ownerNpc.name;
        } else {
          // Fallback deterministic name generation if not in state
          const seedValue = worldSeed + t.burgId + o.workPlotId;
          const rng = new SeededRandom(seedValue);
          const pPlot = plan.plots.find(pl => pl.id === o.workPlotId);
          if (pPlot) {
            const tempNpcName = o.name || nameFor(rng);
            o.name = tempNpcName;
          }
        }
      }
    }

    rosters.push(roster);
    const byPlot = new Map<number, Array<Occupant & { atWork: boolean; resolvedPlotId: number }>>();
    for (const o of roster.occupants) {
      const atWork = o.workPlotId !== undefined && isAtWork(o.id, hour);
      const placeAt = atWork ? o.workPlotId! : o.homePlotId;
      byPlot.set(placeAt, [...(byPlot.get(placeAt) ?? []), { ...o, atWork, resolvedPlotId: placeAt }]);
    }

    for (const p of plan.plots) {
      const cx = p.footprint.reduce((a, q) => a + q[0], 0) / p.footprint.length;
      const cy = p.footprint.reduce((a, q) => a + q[1], 0) / p.footprint.length;
      const xM = (cx - local.bounds.x) * FEET_TO_METERS;
      const zM = (cy - local.bounds.y) * FEET_TO_METERS;
      const heightM = Math.max(1, (p.storeys ?? 1)) * 3;

      const isBiz = p.role === 'market' || p.role === 'workshop';
      let bizName: string | undefined;

      if (isBiz) {
        const bizId = `biz_burg_${t.burgId}_plot_${p.id}`;
        const biz = opts.worldBusinesses?.[bizId];
        if (biz) {
          bizName = biz.name;
        } else {
          // Fallback deterministic name generation if not in state
          const seedValue = worldSeed + t.burgId + p.id;
          const rng = new SeededRandom(seedValue);
          const bizType = getBusinessTypeForPlot(p.role, p.id);
          bizName = generateBusinessName(bizType, rng);
        }
      }

      // The same byPlot map that feeds figure placement also feeds
      // nameplates, so home/work resolution cannot drift between systems.
      for (const occupant of byPlot.get(p.id) ?? []) {
        occupants.push({
          burgId: t.burgId,
          occupantId: occupant.id,
          name: occupant.name,
          xM,
          zM,
        });
      }

      const plotInput = { id: p.id, footprint: p.footprint, role: p.role ?? 'house', storeys: p.storeys ?? 1 };
      // Wall envelope (≤ plot footprint): roofs/floors must fit THESE dims,
      // not the plot, or eaves float past the walls (construction v2).
      const envelope = interiorEnvelopeM(plotInput, region!.seedPath);
      buildings.push({
        id: `wf-plot-${t.burgId}-${p.id}`,
        xM,
        zM,
        cornersM: p.footprint.map(([fx, fy]) => ({
          x: (fx - local.bounds.x) * FEET_TO_METERS,
          z: (fy - local.bounds.y) * FEET_TO_METERS,
        })),
        heightM,
        role: p.role ?? 'house',
        wallWidthM: envelope.wallWidthM,
        wallDepthM: envelope.wallDepthM,
        name: bizName,
        unlabeled: !isBiz,
        labelRangeM: 20,
        // Seamless interior (L4): same seed path the town plan used, so the
        // plan, the shell, the rooms AND the household all agree.
        parts: buildInteriorParts(
          plotInput,
          region!.seedPath,
          heightM,
          // Each occupant gets a parametric body (BODY-1) from its own seed
          // path, so villagers vary in height/build/palette deterministically.
          (byPlot.get(p.id) ?? []).map((o) => ({
            id: o.id,
            ageBand: o.ageBand,
            atWork: o.atWork,
            body: bodyPlanToOccupantBody(
              generateBody(o, childSeedPath(region!.seedPath, `occ:${o.id}`)),
            ),
          })),
        ),
      });
    }
  }

  return { towns, buildings, planStreets, rosters, occupants };
}

/** Encoded-height bilinear sample at world meters → true meters via heightToMeters. */
export function groundSurfaceY(ground: GroundWorld, wxM: number, wzM: number): number {
  const { cols, rows, heights: H } = ground;
  const clampX = (v: number) => Math.max(0, Math.min(cols - 1, v));
  const clampY = (v: number) => Math.max(0, Math.min(rows - 1, v));
  const gx = clampX(wxM / GROUND_METERS_PER_CELL);
  const gy = clampY(wzM / GROUND_METERS_PER_CELL);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = clampX(x0 + 1);
  const y1 = clampY(y0 + 1);
  const fx = gx - x0;
  const fy = gy - y0;
  const h = (xx: number, yy: number) => H[yy * cols + xx] ?? 0;
  const enc = (h(x0, y0) * (1 - fx) + h(x1, y0) * fx) * (1 - fy) +
              (h(x0, y1) * (1 - fx) + h(x1, y1) * fx) * fy;
  return heightToMeters(enc);
}

/**
 * Per-occupant work hours (schedules v2): start 7–9, end 16–19, seeded by
 * occupant id — shops open and close staggered instead of the whole town
 * teleporting between home and work at 8:00 sharp.
 */
export function isAtWork(occupantId: number, hour: number): boolean {
  const start = 7 + ((Math.imul(occupantId + 11, 2654435761) >>> 8) % 3);
  const end = 16 + ((Math.imul(occupantId + 29, 2246822519) >>> 8) % 4);
  return hour >= start && hour < end;
}

/** Deterministic 0..1 from a feature id (scale/rotation jitter). */
function fhash01(id: number, salt: number): number {
  let h = Math.imul(id + 374761393, 668265263) ^ (salt | 0);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

/**
 * Ground-mode vegetation = the artifact's OWN tree/bush features inside the
 * chunk (chunk-local positions), replacing the generic per-vertex scatter —
 * which both honors the deterministic feature placement (delta-layer ids!)
 * and removes the lattice-row banding the scatter produced.
 */
export function buildGroundVegetation(
  ground: GroundWorld,
  cx: number,
  cy: number,
): { trees: VegetationScatter; bushes: VegetationScatter } {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const minX = cx * S;
  const minZ = cy * S;
  const tPos: number[] = [];
  const tScl: number[] = [];
  const tRot: number[] = [];
  const tCol: number[] = [];
  const bPos: number[] = [];
  const bScl: number[] = [];
  const bRot: number[] = [];
  const bCol: number[] = [];

  // Species palettes (tree-variety dispatch, 2026-06-12): 3 green variants
  // per kind picked by id hash — deterministic, instanced-friendly.
  const TREE_PALETTE: Array<[number, number, number]> = [
    [0.12, 0.3, 0.17],
    [0.18, 0.42, 0.25],
    [0.24, 0.48, 0.23],
  ];
  const BUSH_PALETTE: Array<[number, number, number]> = [
    [0.29, 0.42, 0.16],
    [0.35, 0.5, 0.25],
    [0.24, 0.55, 0.22],
  ];

  for (const f of ground.features) {
    if (f.kind !== "tree" && f.kind !== "bush") continue;
    if (f.xM < minX || f.xM >= minX + S || f.zM < minZ || f.zM >= minZ + S) continue;
    const surfaceY = groundSurfaceY(ground, f.xM, f.zM);
    const rot = fhash01(f.id, 11) * Math.PI * 2;
    if (f.kind === "tree") {
      tPos.push(f.xM - minX, surfaceY, f.zM - minZ);
      tScl.push(0.7 + fhash01(f.id, 7) * 1.1);
      tRot.push(rot);
      const tc = TREE_PALETTE[Math.floor(fhash01(f.id, 23) * 3)];
      tCol.push(tc[0], tc[1], tc[2]);
    } else {
      bPos.push(f.xM - minX, surfaceY, f.zM - minZ);
      bScl.push(0.35 + fhash01(f.id, 7) * 0.25);
      bRot.push(rot);
      const bc = BUSH_PALETTE[Math.floor(fhash01(f.id, 23) * 3)];
      bCol.push(bc[0], bc[1], bc[2]);
    }
  }

  return {
    trees: {
      positions: new Float32Array(tPos),
      scales: new Float32Array(tScl),
      rotations: new Float32Array(tRot),
      colors: new Float32Array(tCol),
      cacheKey: `ground-tree|${cx}|${cy}|${tPos.length}`,
    },
    bushes: {
      positions: new Float32Array(bPos),
      scales: new Float32Array(bScl),
      rotations: new Float32Array(bRot),
      colors: new Float32Array(bCol),
      cacheKey: `ground-bush|${cx}|${cy}|${bPos.length}`,
    },
  };
}

/**
 * Sample one chunk of ground terrain: vertex (i, j) sits at world meters
 * (cxÂ·S + i/(resâˆ’1)Â·S), mapped to fractional artifact cells at 1.524 m per
 * cell, with bilinear height interpolation and nearest-cell biomes.
 */
export function sampleGroundChunk(
  ground: GroundWorld,
  cx: number,
  cy: number,
  resolution: number,
): ChunkData {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const { cols, rows, heights: H, biomeIds } = ground;

  const clampX = (v: number) => Math.max(0, Math.min(cols - 1, v));
  const clampY = (v: number) => Math.max(0, Math.min(rows - 1, v));
  const h = (xx: number, yy: number) => H[yy * cols + xx] ?? 0;

  // Edge treatment: chunks beyond the artifact window would otherwise
  // extend the clamped border heights as an infinite plateau. Instead, ease
  // terrain downward and blend the tint toward haze over EDGE_FALL_M, so
  // the detail window reads as land falling away toward the horizon.
  const EDGE_FALL_M = 256;
  const EDGE_DROP_H = 14;
  const HAZE_RGB: [number, number, number] = [0.64, 0.67, 0.64];
  const extentX = cols * GROUND_METERS_PER_CELL;
  const extentZ = rows * GROUND_METERS_PER_CELL;

  const heights = new Float32Array(resolution * resolution);
  const outBiomes: string[] = new Array(resolution * resolution);
  const biomeColors = new Float32Array(resolution * resolution * 3);

  for (let j = 0; j < resolution; j++) {
    const tz = resolution === 1 ? 0 : j / (resolution - 1);
    const worldZ = (cy + tz) * S;
    const gy = clampY(worldZ / GROUND_METERS_PER_CELL);
    for (let i = 0; i < resolution; i++) {
      const txr = resolution === 1 ? 0 : i / (resolution - 1);
      const worldX = (cx + txr) * S;
      const gx = clampX(worldX / GROUND_METERS_PER_CELL);

      // Bilinear height over the 5-ft cell grid
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = clampX(x0 + 1);
      const y1 = clampY(y0 + 1);
      const fx = gx - x0;
      const fy = gy - y0;
      const top = h(x0, y0) * (1 - fx) + h(x1, y0) * fx;
      const bot = h(x0, y1) * (1 - fx) + h(x1, y1) * fx;
      let height = top * (1 - fy) + bot * fy;

      // Out-of-window falloff (eased) — 0 inside the artifact, 1 at
      // EDGE_FALL_M past its border.
      const ox = Math.max(0, -worldX, worldX - extentX);
      const oz = Math.max(0, -worldZ, worldZ - extentZ);
      let edgeT = 0;
      if (ox > 0 || oz > 0) {
        const t = Math.min(1, Math.hypot(ox, oz) / EDGE_FALL_M);
        edgeT = t * (2 - t);
        height = Math.max(0, height - EDGE_DROP_H * edgeT);
      }

      const idx = j * resolution + i;
      heights[idx] = height;

      const bx = Math.round(gx);
      const by = Math.round(gy);
      const biomeId = biomeIds[clampY(by) * cols + clampX(bx)] ?? "plains";
      outBiomes[idx] = biomeId;

      let [r, g, b] = biomeColor(biomeId, height / 100);
      if (edgeT > 0) {
        const hz = edgeT * 0.65;
        r += (HAZE_RGB[0] - r) * hz;
        g += (HAZE_RGB[1] - g) * hz;
        b += (HAZE_RGB[2] - b) * hz;
      }
      biomeColors[idx * 3] = r;
      biomeColors[idx * 3 + 1] = g;
      biomeColors[idx * 3 + 2] = b;
    }
  }

  return {
    cx,
    cy,
    resolution,
    heights,
    biomeIds: outBiomes,
    biomeColors,
    rivers: ground.rivers.flatMap((r) => clipGroundPolylineToChunk(r, cx, cy)),
    roads: ground.roads.flatMap((r) => clipGroundPolylineToChunk(r, cx, cy)),
    lakes: [],
    // Sites whose center falls in this chunk (sampler convention):
    // town markers (label + keep box) and the town plan's building plots
    // as small 'ruin' boxes. Positions ride the pseudo-grid trick.
    sites: [
      ...ground.towns
        .filter((t) => inChunk(t.xM, t.zM, cx, cy))
        .map((t) => ({
          id: `wf-town-${t.burgId}`,
          kind: "town" as const,
          position: pseudoGrid(t.xM, t.zM),
          footprint: [],
          walled: false,
          population: undefined,
          surfaceY: groundSurfaceY(ground, t.xM, t.zM),
          // The plot buildings ARE the town at this scale — keep the
          // nameplate, drop the population-scaled marker cube.
          markerOnly: true,
        })),
      ...ground.buildings
        .filter((b) => inChunk(b.xM, b.zM, cx, cy))
        .map((b) => ({
          id: b.id,
          kind: "ruin" as const,
          position: pseudoGrid(b.xM, b.zM),
          // 4-corner footprint → siteGeometry builds the oriented box
          // sized by the plot's true edges (pseudo-grid like everything)
          footprint: b.cornersM.map((c) => pseudoGrid(c.x, c.z)),
          walled: false,
          population: undefined,
          surfaceY: groundSurfaceY(ground, b.xM, b.zM),
          heightM: b.heightM,
          colorHex: b.role === 'market' ? '#c8923f' : '#b09a72',
          // One label per settlement (the town marker) — not one per house.
          unlabeled: b.unlabeled ?? true,
          name: b.name,
          labelRangeM: b.labelRangeM ?? 20,
          // Seamless interior parts (meters, site-local) — when present the
          // renderer builds walls instead of a solid box.
          parts: b.parts,
          wallWidthM: b.wallWidthM,
          wallDepthM: b.wallDepthM,
        })),
      // Mapped occupants (NPCs): these show where keepers or townsfolk are
      // standing inside their buildings during working/home hours. We guard this
      // with a fallback to an empty array in case the ground data was mocked
      // without rosters.
      ...(ground.occupants || [])
        .filter((o) => inChunk(o.xM, o.zM, cx, cy))
        .map((o) => ({
          id: `wf-occ-${o.burgId}-${o.occupantId}`,
          kind: "landmark" as const,
          position: pseudoGrid(o.xM, o.zM),
          footprint: [],
          walled: false,
          population: undefined,
          surfaceY: groundSurfaceY(ground, o.xM, o.zM),
          // Occupant bodies are already rendered as interior parts. This
          // marker carries only the close-range roster nameplate.
          markerOnly: true,
          name: o.name,
          labelRangeM: 12,
        })),
      // Mapped hostiles: these render as high-contrast red boxes on the
      // ground map and carry nameplates so the player can spot them easily.
      // We guard this with a fallback to an empty array so tests modeling
      // older or simpler ground worlds without hostile placements don't crash.
      ...(ground.hostiles || [])
        .filter((h) => inChunk(h.xM, h.zM, cx, cy))
        .map((h) => ({
          id: h.id,
          kind: "monster" as const,
          position: pseudoGrid(h.xM, h.zM),
          footprint: [],
          walled: false,
          surfaceY: groundSurfaceY(ground, h.xM, h.zM),
          name: h.name,
          labelRangeM: 15,
        })),
    ],
  };
}

function inChunk(xM: number, zM: number, cx: number, cy: number): boolean {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  return xM >= cx * S && xM < (cx + 1) * S && zM >= cy * S && zM < (cy + 1) * S;
}

function pseudoGrid(xM: number, zM: number): { x: number; y: number } {
  return {
    x: xM / WORLD3D_CONFIG.METERS_PER_CELL,
    y: zM / WORLD3D_CONFIG.METERS_PER_CELL,
  };
}

/**
 * Clip a ground polyline (world meters) to a chunk and convert to the
 * builders' expected shape. UNIT TRICK: road/water geometry compute
 * `point·METERS_PER_CELL − chunkOrigin` and `width·METERS_PER_CELL`, so
 * emitting points as meters ÷ METERS_PER_CELL (pseudo-grid) makes the
 * continent-scale builders produce TRUE ground meters — same reasoning as
 * the terrain path, no core changes.
 */
function clipGroundPolylineToChunk(
  line: GroundPolyline,
  cx: number,
  cy: number,
): Array<{ points: { x: number; y: number }[]; width: number[] }> {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const M = WORLD3D_CONFIG.METERS_PER_CELL;
  const minX = cx * S;
  const minZ = cy * S;
  const maxX = minX + S;
  const maxZ = minZ + S;
  const inside = (p: { x: number; z: number }) =>
    p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ;

  // Segment-walk clip: inside points pass through; boundary crossings add
  // intersection points (incl. both-endpoints-outside pass-throughs).
  const out: Array<{ x: number; z: number }> = [];
  const push = (p: { x: number; z: number }) => {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 1e-6 || Math.abs(last.z - p.z) > 1e-6) out.push(p);
  };
  const edgeHits = (a: { x: number; z: number }, b: { x: number; z: number }) => {
    const hits: Array<{ t: number; x: number; z: number }> = [];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const tryEdge = (t: number) => {
      if (t <= 0 || t >= 1 || !Number.isFinite(t)) return;
      const x = a.x + dx * t;
      const z = a.z + dz * t;
      if (x >= minX - 1e-6 && x <= maxX + 1e-6 && z >= minZ - 1e-6 && z <= maxZ + 1e-6) {
        hits.push({ t, x, z });
      }
    };
    if (dx !== 0) { tryEdge((minX - a.x) / dx); tryEdge((maxX - a.x) / dx); }
    if (dz !== 0) { tryEdge((minZ - a.z) / dz); tryEdge((maxZ - a.z) / dz); }
    hits.sort((p, q) => p.t - q.t);
    return hits;
  };

  for (let i = 0; i < line.points.length; i++) {
    const p = line.points[i];
    if (inside(p)) push(p);
    if (i < line.points.length - 1) {
      for (const h of edgeHits(p, line.points[i + 1])) push({ x: h.x, z: h.z });
    }
  }

  if (out.length < 2) return [];
  return [{
    points: out.map((p) => ({ x: p.x / M, y: p.z / M })),
    width: out.map(() => line.widthM / M),
  }];
}

/**
 * Inline (main-thread) chunk loader for ground mode â€” same shape as the
 * demo's WorldData loader: (cx, cy) â†’ ChunkMeshBundle promise.
 */
export function createGroundChunkLoader(
  local: LocalArtifact,
  seed: number,
  region?: RegionArtifact,
  opts: MakeGroundWorldOptions = {},
) {
  const ground = makeGroundWorld(local, seed, region, opts);
  return {
    ground,
    loader: async (cx: number, cy: number): Promise<ChunkMeshBundle> => {
      const bundle = buildChunkBundle(
        sampleGroundChunk(ground, cx, cy, WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION),
      );
      // Artifact features replace the generic per-vertex scatter (see
      // buildGroundVegetation — determinism + no lattice banding). Trees
      // and bushes are separate instanced layers (variety dispatch).
      const { trees, bushes } = buildGroundVegetation(ground, cx, cy);
      return {
        ...bundle,
        vegetation: trees.positions.length > 0 ? trees : undefined,
        bushes: bushes.positions.length > 0 ? bushes : undefined,
      };
    },
  };
}

// ============================================================================
// Terrain Patch Extraction
// ============================================================================
// This function extracts a 40x30 local region centered at the player's world
// meters position (playerX, playerZ) from the GroundWorld object. It samples
// elevations, determines biomes, detects obstacle collisions (features), and
// maps buildings/seamless interiors directly onto the BattleMap 3D tiles.
// ============================================================================
export function extractLocalTerrainPatch(
  ground: GroundWorld,
  playerX: number,
  playerZ: number,
  biome: 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp',
  seed: number,
): BattleMapData {
  const width = 40;
  const height = 30;
  const tiles = new Map<string, BattleMapTile>();

  // The player is placed at the center tile coordinate (20, 15) of the BattleMap.
  const centerX = 20;
  const centerY = 15;

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const tileId = `${tx}-${ty}`;

      // Compute the absolute ground world meters coordinates for this tile.
      // One tile in a BattleMap corresponds to 5 feet (1.524 meters).
      const dx = (tx - centerX) * GROUND_METERS_PER_CELL;
      const dz = (ty - centerY) * GROUND_METERS_PER_CELL;
      const wx = playerX + dx;
      const wz = playerZ + dz;

      // 1. Elevation calculation: Sample the ground surface height in meters,
      // then convert it back to the BattleMap's internal elevation units.
      // BattleMap renders with a vertical ELEVATION_SCALE of 0.3, so we divide
      // the real height in meters by 0.3.
      const realHeightM = groundSurfaceY(ground, wx, wz);
      const elevation = realHeightM / 0.3;

      // 2. Biome lookup: Sample the nearest biome from the GroundWorld grid.
      const bx = Math.max(0, Math.min(ground.cols - 1, Math.round(wx / GROUND_METERS_PER_CELL)));
      const by = Math.max(0, Math.min(ground.rows - 1, Math.round(wz / GROUND_METERS_PER_CELL)));
      const groundBiome = ground.biomeIds[by * ground.cols + bx] ?? "plains";

      // Map GroundWorld biome to a valid BattleMapTerrain value
      let terrain: BattleMapTerrain = 'grass';
      if (groundBiome === 'ocean' || groundBiome === 'water') {
        terrain = 'water';
      } else if (groundBiome === 'desert') {
        terrain = 'sand';
      } else if (groundBiome === 'swamp' || groundBiome === 'wetland') {
        terrain = 'mud';
      } else if (groundBiome === 'mountain' || groundBiome === 'tundra') {
        terrain = 'rock';
      }

      // Initialize default properties for the tile
      let blocksMovement = terrain === 'water';
      let blocksLoS = false;
      let decoration: BattleMapDecoration = null;

      // 3. Natural obstacles: Check if this tile overlaps any trees, bushes, or boulders
      // within reasonable collision ranges.
      for (const f of ground.features) {
        const dist = Math.hypot(wx - f.xM, wz - f.zM);
        if (f.kind === 'tree' && dist < 1.2) {
          decoration = 'tree';
          blocksMovement = true;
          blocksLoS = true;
        } else if (f.kind === 'bush' && dist < 0.8) {
          decoration = 'bush';
        } else if (f.kind === 'boulder' && dist < 1.0) {
          decoration = 'boulder';
          blocksMovement = true;
          blocksLoS = true;
        }
      }

      // 4. Buildings and interior parts: If the tile overlaps a building plot footprint,
      // it becomes a floor tile. If it overlaps a wall part, it blocks movement and LoS.
      for (const b of ground.buildings) {
        if (b.cornersM.length < 3) continue;

        // Perform the convex polygon point-in-polygon check
        if (pointInsideConvexQuad({ x: wx, z: wz }, b.cornersM)) {
          // Inside a building boundary: make it a floor tile and remove nature decorations.
          terrain = 'floor';
          blocksMovement = false;
          blocksLoS = false;
          decoration = null;

          // Convert world coords to building-local coordinate space to check walls and furniture
          const c = b.cornersM;
          const e1x = c[1].x - c[0].x;
          const e1z = c[1].z - c[0].z;
          const e2x = c[3].x - c[0].x;
          const e2z = c[3].z - c[0].z;
          const rotationY = -Math.atan2(e1z, e1x);
          const cross = e1x * e2z - e1z * e2x;
          const doorZSign = cross >= 0 ? -1 : 1;

          const dxLocal = wx - b.xM;
          const dzLocal = wz - b.zM;
          const lx = dxLocal * Math.cos(rotationY) - dzLocal * Math.sin(rotationY);
          const lz = dxLocal * Math.sin(rotationY) + dzLocal * Math.cos(rotationY);

          // Iterate through interior parts (walls and furniture)
          for (const p of b.parts) {
            const lzScene = p.z * doorZSign;
            // Add a small 0.1m tolerance buffer to ensure adjacent cells align cleanly
            const inX = lx >= p.x - p.w / 2 - 0.1 && lx <= p.x + p.w / 2 + 0.1;
            const inZ = lz >= lzScene - p.d / 2 - 0.1 && lz <= lzScene + p.d / 2 + 0.1;

            if (inX && inZ && p.h > 0.5) {
              blocksMovement = true;
              // Check if this part has a wall-colored hex code to determine LoS blocking
              const isWall = p.colorHex === '#cfc7b8' || p.colorHex === '#c8923f' || p.colorHex === '#b09a72';
              if (isWall) {
                terrain = 'wall';
                blocksLoS = true;
              }
            }
          }
        }
      }

      tiles.set(tileId, {
        id: tileId,
        coordinates: { x: tx, y: ty },
        terrain,
        elevation,
        movementCost: blocksMovement ? 0 : 1,
        blocksLoS,
        blocksMovement,
        decoration,
        effects: [],
      });
    }
  }

  return {
    dimensions: { width, height },
    tiles,
    theme: biome,
    seed,
  };
}
