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
import type { ChunkData, ChunkMeshBundle } from "../../world3d/types";
import { buildChunkBundle } from "../../world3d/chunkBundle";
import { WORLD3D_CONFIG, heightToMeters } from "../../world3d/config";
import { biomeColor } from "../../world3d/terrainColor";
import type { LocalArtifact, RegionArtifact } from "../artifacts";
import { localArtifactToWorldData, GROUND_METERS_PER_CELL } from "./groundWorldAdapter";
import { generateTownPlan } from "../town/generateTownPlan";

/** A polyline in ground world-meters with a uniform width (meters). */
interface GroundPolyline {
  points: Array<{ x: number; z: number }>;
  widthM: number;
}

/** An artifact feature in ground meters (world space, origin = artifact NW). */
export interface GroundFeature {
  id: number;
  kind: string;
  xM: number;
  zM: number;
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
  }>;
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

export function makeGroundWorld(
  local: LocalArtifact,
  seed: number,
  region?: RegionArtifact,
): GroundWorld {
  const wd = localArtifactToWorldData(local, seed);
  const townContent = groundTowns(local, region);
  const features: GroundFeature[] = local.features.map((f) => ({
    id: f.id,
    kind: f.kind,
    xM: (f.x - local.bounds.x) * FEET_TO_METERS,
    zM: (f.y - local.bounds.y) * FEET_TO_METERS,
  }));
  return {
    cols: wd.gridSize.cols,
    rows: wd.gridSize.rows,
    heights: wd.heights,
    biomeIds: wd.biomeIds,
    extentMetersX: wd.gridSize.cols * GROUND_METERS_PER_CELL,
    extentMetersZ: wd.gridSize.rows * GROUND_METERS_PER_CELL,
    features,
    rivers: region ? regionPolylinesToGround(region.rivers, local) : [],
    // Region routes + the town plan's own streets ride the same ribbon path
    roads: [
      ...(region ? regionPolylinesToGround(region.roads, local) : []),
      ...townContent.planStreets,
    ],
    towns: townContent.towns,
    buildings: townContent.buildings,
  };
}

/**
 * Town content for the ground window: the site marker (label + keep box),
 * and — the C3 payoff — the town's GENERATED plan: streets become road
 * ribbons, plots become building boxes. Deterministic via the region's
 * seed path, so the 3D town matches the 2D town plan exactly.
 */
function groundTowns(
  local: LocalArtifact,
  region?: RegionArtifact,
): {
  towns: GroundWorld["towns"];
  buildings: GroundWorld["buildings"];
  planStreets: GroundPolyline[];
} {
  const exX = local.bounds.width * FEET_TO_METERS;
  const exZ = local.bounds.height * FEET_TO_METERS;

  const towns: GroundWorld["towns"] = [];
  const buildings: GroundWorld["buildings"] = [];
  const planStreets: GroundPolyline[] = [];

  for (const t of region?.townSites ?? []) {
    const xM = (t.envelope.x + t.envelope.width / 2 - local.bounds.x) * FEET_TO_METERS;
    const zM = (t.envelope.y + t.envelope.height / 2 - local.bounds.y) * FEET_TO_METERS;
    const halfM = (Math.max(t.envelope.width, t.envelope.height) / 2) * FEET_TO_METERS;
    if (xM < -halfM || xM > exX + halfM || zM < -halfM || zM > exZ + halfM) continue;

    towns.push({ burgId: t.burgId, xM, zM, halfM });

    const plan = generateTownPlan(t, region!.seedPath);
    for (const s of plan.streets) {
      planStreets.push({
        points: s.centerline.map(([fx, fy]) => ({
          x: (fx - local.bounds.x) * FEET_TO_METERS,
          z: (fy - local.bounds.y) * FEET_TO_METERS,
        })),
        widthM: Math.max(1.5, s.widthFt * FEET_TO_METERS),
      });
    }
    for (const p of plan.plots) {
      const cx = p.footprint.reduce((a, q) => a + q[0], 0) / p.footprint.length;
      const cy = p.footprint.reduce((a, q) => a + q[1], 0) / p.footprint.length;
      buildings.push({
        id: `wf-plot-${t.burgId}-${p.id}`,
        xM: (cx - local.bounds.x) * FEET_TO_METERS,
        zM: (cy - local.bounds.y) * FEET_TO_METERS,
        cornersM: p.footprint.map(([fx, fy]) => ({
          x: (fx - local.bounds.x) * FEET_TO_METERS,
          z: (fy - local.bounds.y) * FEET_TO_METERS,
        })),
        heightM: Math.max(1, (p.storeys ?? 1)) * 3,
        role: p.role ?? 'house',
      });
    }
  }

  return { towns, buildings, planStreets };
}

/** Encoded-height bilinear sample at world meters → true meters via heightToMeters. */
function groundSurfaceY(ground: GroundWorld, wxM: number, wzM: number): number {
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
): { positions: Float32Array; scales: Float32Array; rotations: Float32Array; cacheKey: string } {
  const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;
  const minX = cx * S;
  const minZ = cy * S;
  const positions: number[] = [];
  const scales: number[] = [];
  const rotations: number[] = [];

  for (const f of ground.features) {
    if (f.kind !== "tree" && f.kind !== "bush") continue;
    if (f.xM < minX || f.xM >= minX + S || f.zM < minZ || f.zM >= minZ + S) continue;
    positions.push(f.xM - minX, groundSurfaceY(ground, f.xM, f.zM), f.zM - minZ);
    scales.push(f.kind === "tree" ? 0.9 + fhash01(f.id, 7) * 0.6 : 0.35 + fhash01(f.id, 7) * 0.2);
    rotations.push(fhash01(f.id, 11) * Math.PI * 2);
  }

  return {
    positions: new Float32Array(positions),
    scales: new Float32Array(scales),
    rotations: new Float32Array(rotations),
    cacheKey: `ground|${cx}|${cy}|${positions.length}`,
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
          unlabeled: true,
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
) {
  const ground = makeGroundWorld(local, seed, region);
  return {
    ground,
    loader: async (cx: number, cy: number): Promise<ChunkMeshBundle> => {
      const bundle = buildChunkBundle(
        sampleGroundChunk(ground, cx, cy, WORLD3D_CONFIG.HEIGHTFIELD_RESOLUTION),
      );
      // Artifact features replace the generic per-vertex scatter (see
      // buildGroundVegetation — determinism + no lattice banding).
      const vegetation = buildGroundVegetation(ground, cx, cy);
      return {
        ...bundle,
        vegetation: vegetation.positions.length > 0 ? vegetation : undefined,
      };
    },
  };
}


