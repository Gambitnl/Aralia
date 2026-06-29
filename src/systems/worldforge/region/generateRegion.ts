// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 09:51:50
 * Dependents: components/Worldforge/AtlasDemo.tsx, systems/worldforge/bridge/legacySubmapBridge.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file generateRegion.ts — L1 Region generator (Worldforge build-order item 3).
 *
 * Spec: docs/projects/worldforge/SPEC.md §4 (L1 REGION), §11 (cells canonical).
 * Given an atlas and an anchor cell id, produces a RegionArtifact: a refined
 * heightfield over the cell's neighborhood plus river banks widened from atlas
 * rivers. This is the first slice of generation BELOW Azgaar's deepest zoom.
 *
 * What changed: WF-G4 — bounds are now an anchor-centered REGION_SIZE_FT
 * square (scale-invariant); membership always includes the anchor's 1-ring;
 * rivers/roads are clipped to the window; town sites outside it are dropped.
 * Why: at canonical FEET_PER_FMG_PIXEL the old member-extent bounds collapsed
 * to 0×0 (black demo canvas); at test scales they overshot the spec size.
 * Preserved: spine/artifacts.ts, seedPath.ts, units.ts consumed read-only;
 * IDW + FBM heightfield pipeline and C2 civ extraction logic unchanged.
 *
 * ── Region membership heuristic ─────────────────────────────────────────────
 * Start from the anchor cell and expand outward via true cell adjacency
 * (`pack.cells.c`). Each ring adds all neighbors of current members. Expand
 * until the covered area roughly matches REGION_SIZE_FT × REGION_SIZE_FT
 * (documented in units.ts as 25,000 ft). The heuristic: stop when the bounds
 * of member cells exceed ~1.2× REGION_SIZE_FT on both axes (overshoot slightly
 * to ensure full coverage). This honors SPEC §11: true Voronoi adjacency, not
 * square windows.
 *
 * WF-G4 (2026-06-11, orchestrator): membership is SAMPLING CONTEXT, not the
 * region window. At the canonical scale (FEET_PER_FMG_PIXEL ≈ 9,842.52) a
 * 25,000 ft region is SMALLER than one atlas cell, so the WF-G3 distance
 * clamp admitted nothing beyond the anchor and IDW had a single sample (flat
 * field). The anchor's direct neighbors (1-ring) are therefore ALWAYS
 * admitted regardless of distance — interpolation needs surrounding context
 * at every scale. At test scale (1,000 ft/px) the 1-ring already passed the
 * clamp, so this changes nothing there.
 *
 * ── Region bounds ───────────────────────────────────────────────────────────
 * WF-G4: bounds are an anchor-centered REGION_SIZE_FT square — SCALE-INVARIANT
 * and independent of membership. The previous member-extent-derived bounds
 * collapsed to 0×0 ft at canonical scale (single member point has no extent),
 * which was the true root cause of the demo's black region canvas. A region
 * is now always exactly 25,000 ft per side (SPEC §4), at any feetPerPixel.
 * Rivers/roads are clipped to this window; town sites outside it are dropped.
 *
 * ── Heightfield interpolation ───────────────────────────────────────────────
 * Base surface: Inverse Distance Weighting (IDW) over pack cell heights
 * (`pack.cells.h` normalized 0..1). IDW chosen for simplicity and determinism;
 * power=2 is standard. Sample points are pack cell centers (`pack.cells.p`)
 * converted to feet. For each grid sample, compute weighted average of all
 * member cell heights, weight = 1/distance². This is O(samples × cells) but
 * the region is small enough (~250×250 grid, ~100-200 cells) to be fast.
 *
 * ── Multi-octave value noise ────────────────────────────────────────────────
 * After IDW base, add deterministic value noise to break up the smooth
 * interpolation. Amplitude scales with local relief: flat coast stays flat,
 * mountains get rugged. Noise seeded via `rngFromPath(streamPath(regionPath,
 * 'relief'))`. Three octaves, lacunarity=2, persistence=0.5, amplitude scaled
 * by local height variance.
 *
 * ── Water discipline ────────────────────────────────────────────────────────
 * Cells that are water in the atlas (h<20) must remain below water height in
 * the refined field. After IDW + noise, clamp all samples in water cells to
 * max 0.19 (just below the 0.2 water threshold). This prevents noise islands
 * from popping out of the sea.
 *
 * ── River banks ─────────────────────────────────────────────────────────────
 * For each `pack.rivers` entry passing through member cells, produce a
 * RegionRiverBank: centerline polyline through the member cell points (feet),
 * widthFt derived from river flux (discharge proxy). Width mapping:
 * widthFt = 50 + sqrt(flux) * 20 (documented heuristic; flux is m³/s from
 * Rivers.generate, so sqrt dampens the range). Carve the heightfield down
 * along the centerline: for each river point, reduce nearby samples by a
 * modest depth (0.02 normalized) within half the river width, creating a
 * channel.
 *
 * ── Town sites (C2) ────────────────────────────────────────────────────────
 * For each burg in member cells (via pack.cells.burg lookup), produce a
 * RegionTownSite. Envelope sizing: sqrt(population) × 80 ft half-extent,
 * clamped to [400, 4000] ft (small hamlet → large city). The town generator
 * (SPEC §6 pass 1) builds inside this envelope later. Gates are computed
 * where roads enter the envelope boundary.
 *
 * ── Roads (C2) ─────────────────────────────────────────────────────────────
 * For each route passing through member cells (searoutes skipped), produce a
 * RegionRoad. Centerline is built from route point [x,y] coords converted to
 * feet, then Chaikin-smoothed (3 iterations). Width mapping by kind:
 *   road  → 40 ft (main trade routes)
 *   trail → 20 ft (local paths)
 * Heightfield is gently flattened under town envelopes (build sites).
 */
import {
  WORLDFORGE_SCHEMA_VERSION,
  type RegionArtifact,
  type RegionHeightfield,
  type RegionMarker,
  type RegionRiverBank,
  type RegionRoad,
  type RegionTownSite,
  type RegionZone,
} from '../artifacts';
import {
  childSeedPath,
  rngFromPath,
  streamPath,
  type SeedPath,
} from '../seedPath';
import { BoundsFt, Feet, REGION_SIZE_FT } from '../units';
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { FmgWorldResult } from '../fmg/generateWorld';
import type { Burg } from '../fmg/burgs-generator';
import type { Route } from '../fmg/routes-generator';
import { smoothRegionRiverCenterline } from './riverCenterlineSmoothing';

export interface GenerateRegionOptions {
  /** Feet per FMG pixel (Lane B's canonical converter; pass any plausible value for tests). */
  feetPerPixel: number;
  /** Heightfield sample spacing, feet. Default 100 (SPEC §4 L1 target). */
  resolutionFt?: number;
  /**
   * Optional full world result (from generateFmgWorld). When provided,
   * civilization data (burgs, routes) is used to populate townSites and roads.
   * When omitted, these arrays remain empty (atlas-only mode, C1 compat).
   */
  world?: FmgWorldResult;
  /**
   * Optional window center override, in atlas/graph PIXELS. Used when entering a
   * settlement: the burg sits anywhere within its (far larger) cell, so the
   * Locale window is centered on the burg's position rather than the cell site.
   * Defaults to the anchor cell's Voronoi site.
   */
  windowCenterPx?: readonly [number, number];
}

/**
 * Generate a RegionArtifact: refined heightfield + river banks for the
 * neighborhood of the anchor cell.
 *
 * @param atlas - The FMG atlas result (pack cells, rivers, grid).
 * @param anchorCellId - Pack cell id to center the region on.
 * @param worldSeedPath - Root seed path for the world (e.g. `wf:1337`).
 * @param opts - Conversion + resolution options.
 */
export function generateRegion(
  atlas: FmgAtlasResult,
  anchorCellId: number,
  worldSeedPath: SeedPath,
  opts: GenerateRegionOptions,
): RegionArtifact {
  const { feetPerPixel, resolutionFt = 100 } = opts;
  const { pack } = atlas;
  const cellsN = pack.cells.h.length;

  // Validate anchor cell
  if (anchorCellId < 0 || anchorCellId >= cellsN) {
    throw new Error(`Anchor cell id ${anchorCellId} out of range [0, ${cellsN})`);
  }

  // ── Region membership: expand rings via true cell adjacency ───────────
  const memberCells = expandRegionMembership(pack.cells.c, anchorCellId, pack.cells.p, feetPerPixel);

  // ── Bounds: REGION_SIZE_FT window (WF-G4, scale-invariant), centered on the
  // anchor cell's site — or on an explicit point (e.g. a burg) when given.
  const bounds = computeRegionBounds(anchorCellId, pack.cells.p, feetPerPixel, opts.windowCenterPx);

  // ── Seed path for this region ─────────────────────────────────────────
  const regionPath = childSeedPath(worldSeedPath, `cell:${anchorCellId}`);

  // ── Heightfield: IDW base + multi-octave value noise ──────────────────
  const heightfield = generateHeightfield(
    memberCells,
    pack.cells.p,
    pack.cells.h,
    bounds,
    resolutionFt,
    feetPerPixel,
    regionPath,
  );

  // ── Rivers: banks for rivers passing through member cells ─────────────
  const memberSet = new Set(memberCells);
  const rivers = generateRiverBanks(
    pack.rivers ?? [],
    pack.cells.p,
    memberSet,
    feetPerPixel,
    heightfield,
    bounds,
    regionPath,
  );

  // ── Town sites + roads (C2) ─────────────────────────────────────────
  // When world data is available, populate civilization arrays from burgs
  // and routes. Atlas-only input (no world) yields empty arrays (C1 compat).
  const { townSites, roads } = generateCivData(
    opts.world,
    memberCells,
    memberSet,
    pack.cells.p,
    pack.cells.burg,
    feetPerPixel,
    bounds,
    heightfield,
  );

  // ── Markers + zones flow-down (detail-density pass, 2026-06-11) ───────
  // Points of interest inside the window inherit from the atlas marker
  // layer; world event zones apply when the window's cells intersect the
  // zone's cell set. Empty without world data, like townSites/roads.
  const { markers, zones } = extractWorldOverlays(
    opts.world,
    anchorCellId,
    memberCells,
    pack.cells.p,
    feetPerPixel,
    bounds,
  );

  // ── Biome tint sites (multi-biome blend, 2026-06-12) ──────────────────
  const biomeSites = extractBiomeSites(opts.world, memberCells, pack.cells.p, feetPerPixel, bounds);

  return {
    layer: 'region',
    schemaVersion: WORLDFORGE_SCHEMA_VERSION,
    seedPath: regionPath,
    bounds,
    heightfield,
    rivers,
    roads,
    townSites,
    markers,
    zones,
    biomeSites,
  };
}

/**
 * Member cells' centers + biome colors, kept when they fall inside the
 * window (plus a quarter-window margin so borders blend ACROSS the edge
 * instead of snapping at it). Undefined without world data — the renderer
 * then keeps the single anchor-color tint (back-compat).
 */
function extractBiomeSites(
  world: FmgWorldResult | undefined,
  memberCells: number[],
  cellPoints: Array<[number, number]> | Float64Array[] | number[][],
  feetPerPixel: number,
  bounds: BoundsFt,
): RegionArtifact['biomeSites'] {
  const biome = world?.pack.cells.biome;
  const colors = world?.biomesData?.color;
  if (!biome || !colors) return undefined;

  const margin = bounds.width * 0.25;
  const sites: NonNullable<RegionArtifact['biomeSites']> = [];
  for (const id of memberCells) {
    const p = cellPoints[id];
    if (!p) continue;
    const x = p[0] * feetPerPixel;
    const y = p[1] * feetPerPixel;
    if (
      x < bounds.x - margin || x > bounds.x + bounds.width + margin ||
      y < bounds.y - margin || y > bounds.y + bounds.height + margin
    ) continue;
    const color = colors[biome[id]];
    if (typeof color === 'string') sites.push({ x, y, color });
  }
  return sites.length > 0 ? sites : undefined;
}

/**
 * Inherit atlas-layer markers and zones into the region window.
 * Markers: position inside the window (feet). Zones: the window is "inside"
 * a zone when the anchor cell or any member cell whose center lies within
 * the window belongs to the zone's cell set.
 */
function extractWorldOverlays(
  world: FmgWorldResult | undefined,
  anchorCellId: number,
  memberCells: number[],
  cellPoints: Array<[number, number]>,
  feetPerPixel: number,
  bounds: BoundsFt,
): { markers: RegionMarker[]; zones: RegionZone[] } {
  const packAny = world?.pack as unknown as {
    markers?: Array<{ type: string; icon: string; x: number; y: number }>;
    zones?: Array<{ type: string; name: string; cells: number[] }>;
  } | undefined;
  if (!packAny) return { markers: [], zones: [] };

  const inBounds = (xFt: number, yFt: number): boolean =>
    xFt >= bounds.x && xFt <= bounds.x + bounds.width &&
    yFt >= bounds.y && yFt <= bounds.y + bounds.height;

  const markers: RegionMarker[] = [];
  for (const m of packAny.markers ?? []) {
    const xFt = m.x * feetPerPixel;
    const yFt = m.y * feetPerPixel;
    if (!inBounds(xFt, yFt)) continue;
    markers.push({ type: m.type, icon: m.icon, x: xFt, y: yFt });
  }

  // Window cells: the anchor plus members whose centers fall in the window
  const windowCells = new Set<number>([anchorCellId]);
  for (const id of memberCells) {
    const p = cellPoints[id];
    if (p && inBounds(p[0] * feetPerPixel, p[1] * feetPerPixel)) windowCells.add(id);
  }

  const zones: RegionZone[] = [];
  for (const z of packAny.zones ?? []) {
    if (z.cells.some((c) => windowCells.has(c))) {
      zones.push({ type: z.type, name: z.name });
    }
  }

  return { markers, zones };
}

/**
 * Expand region membership from anchor cell via BFS over true cell adjacency.
 * Stop when bounds exceed ~1.2× REGION_SIZE_FT on both axes.
 * Exported for use by proof renderers and tests.
 */
export function expandRegionMembership(
  adjacency: number[][],
  anchorCellId: number,
  cellPoints: Array<[number, number]>,
  feetPerPixel: number,
): number[] {
  const targetSize = REGION_SIZE_FT * 1.2; // overshoot slightly for full coverage
  const members = new Set<number>([anchorCellId]);
  let frontier = [anchorCellId];

  // WF-G3 fix (2026-06-11, orchestrator): the original loop checked bounds
  // only AFTER admitting a whole ring, so one giant ocean neighbor (coarse
  // pack cells offshore) could explode the bounds from ~20k ft to >150k ft
  // in a single step — found via the live demo's black region canvas on
  // clicked anchors (#1928/#2275). Fix: admit a neighbor only if its center
  // lies within targetSize (Chebyshev) of the ANCHOR center. Expansion now
  // terminates naturally at far-centered ocean giants and the region is
  // hard-bounded to ≤ 2×targetSize by construction. Pre-release golden
  // regeneration recorded in the Worldforge tracker.
  const [ax, ay] = cellPoints[anchorCellId];
  const maxOffsetPx = targetSize / feetPerPixel;
  const withinReach = (cellId: number): boolean => {
    const p = cellPoints[cellId];
    if (!p) return false;
    return Math.abs(p[0] - ax) <= maxOffsetPx && Math.abs(p[1] - ay) <= maxOffsetPx;
  };

  // WF-G4: always admit the anchor's direct neighbors (1-ring) — at canonical
  // scale the region window is smaller than one cell, so the distance clamp
  // alone leaves IDW with a single sample and the heightfield goes flat.
  // Bounds no longer derive from members, so far-centered giants are harmless
  // here (they only contribute a low-weight IDW sample).
  for (const neighborId of adjacency[anchorCellId] ?? []) {
    if (!members.has(neighborId) && cellPoints[neighborId]) {
      members.add(neighborId);
      frontier.push(neighborId);
    }
  }

  while (frontier.length > 0) {
    const nextFrontier: number[] = [];
    for (const cellId of frontier) {
      const neighbors = adjacency[cellId] ?? [];
      for (const neighborId of neighbors) {
        if (!members.has(neighborId) && withinReach(neighborId)) {
          members.add(neighborId);
          nextFrontier.push(neighborId);
        }
      }
    }

    // Stop early once the covered area reaches the target on both axes.
    const memberArray = Array.from(members);
    const bounds = computeMemberBounds(memberArray, cellPoints, feetPerPixel);
    if (bounds.width >= targetSize && bounds.height >= targetSize) {
      break;
    }

    frontier = nextFrontier;
  }

  return Array.from(members).sort((a, b) => a - b);
}

/**
 * Compute the region window: an anchor-centered square of REGION_SIZE_FT per
 * side (WF-G4). Scale-invariant by design — a region is always 25,000 ft
 * regardless of feetPerPixel, so the canonical scale (where one atlas cell is
 * far larger than the window) and test scales behave identically.
 * Exported for proof renderers and tests.
 */
export function computeRegionBounds(
  anchorCellId: number,
  cellPoints: Array<[number, number]>,
  feetPerPixel: number,
  // Optional window center override, in atlas/graph PIXELS. When a settlement is
  // entered, the burg sits anywhere within its (far larger) cell, so centering
  // on the cell site would miss it; the caller passes the burg's position here
  // so the Locale window frames the town. Defaults to the cell's Voronoi site.
  centerPx?: readonly [number, number],
): BoundsFt {
  const [px, py] = centerPx ?? cellPoints[anchorCellId];
  const cx = px * feetPerPixel;
  const cy = py * feetPerPixel;
  return {
    x: cx - REGION_SIZE_FT / 2,
    y: cy - REGION_SIZE_FT / 2,
    width: REGION_SIZE_FT,
    height: REGION_SIZE_FT,
  };
}

/**
 * Compute axis-aligned bounds of member cell centers, converted to feet.
 * Still used by the membership BFS as its coverage stop heuristic; no longer
 * used for the artifact bounds (see computeRegionBounds, WF-G4).
 */
function computeMemberBounds(
  memberCells: number[],
  cellPoints: Array<[number, number]>,
  feetPerPixel: number,
): BoundsFt {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cellId of memberCells) {
    const [px, py] = cellPoints[cellId];
    const x = px * feetPerPixel;
    const y = py * feetPerPixel;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  // Pad by 5% on each side to avoid edge artifacts
  const padX = (maxX - minX) * 0.05;
  const padY = (maxY - minY) * 0.05;
  return {
    x: minX - padX,
    y: minY - padY,
    width: (maxX - minX) + padX * 2,
    height: (maxY - minY) + padY * 2,
  };
}

/**
 * Generate the heightfield: IDW interpolation of pack cell heights, then
 * multi-octave value noise scaled by local relief. Enforce water discipline.
 */
function generateHeightfield(
  memberCells: number[],
  cellPoints: Array<[number, number]>,
  cellHeights: Uint8Array | Uint16Array | Uint32Array,
  bounds: BoundsFt,
  resolutionFt: number,
  feetPerPixel: number,
  regionPath: SeedPath,
): RegionHeightfield {
  const width = Math.ceil(bounds.width / resolutionFt);
  const height = Math.ceil(bounds.height / resolutionFt);
  const samples = new Float32Array(width * height);
  // Track which samples are in water cells for post-noise re-clamping
  const isWaterCell = new Uint8Array(width * height);

  // Pre-compute member cell positions + heights in feet space
  const memberData = memberCells.map((id) => ({
    x: cellPoints[id][0] * feetPerPixel,
    y: cellPoints[id][1] * feetPerPixel,
    h: cellHeights[id] / 100, // normalize 0..1
  }));

  // IDW power parameter
  const IDW_POWER = 2;
  const WATER_THRESHOLD = 0.2;

  // Combined pass: IDW base + water check in one loop over samples.
  // Track nearest cell per sample to enforce water discipline without a
  // second full scan.
  for (let row = 0; row < height; row++) {
    const sampleY = bounds.y + row * resolutionFt;
    for (let col = 0; col < width; col++) {
      const sampleX = bounds.x + col * resolutionFt;

      // IDW interpolation + nearest cell tracking
      let weightSum = 0;
      let valueSum = 0;
      let nearestDist = Infinity;
      let nearestH = 0;

      for (let mi = 0; mi < memberData.length; mi++) {
        const cell = memberData[mi];
        const dx = sampleX - cell.x;
        const dy = sampleY - cell.y;
        const distSq = dx * dx + dy * dy;

        // Track nearest cell for water discipline
        if (distSq < nearestDist) {
          nearestDist = distSq;
          nearestH = cell.h;
        }

        if (distSq < 0.01) {
          weightSum = 1;
          valueSum = cell.h;
          break;
        }
        const weight = 1 / Math.pow(distSq, IDW_POWER / 2);
        weightSum += weight;
        valueSum += weight * cell.h;
      }

      let baseHeight = weightSum > 0 ? valueSum / weightSum : 0;

      // Water discipline: if nearest cell is water, clamp immediately
      if (nearestH < WATER_THRESHOLD) {
        baseHeight = Math.min(baseHeight, WATER_THRESHOLD - 0.01);
        isWaterCell[row * width + col] = 1;
      }

      samples[row * width + col] = baseHeight;
    }
  }

  // Multi-octave value noise (lattice-interpolated FBM), amplitude scaled by
  // local relief. The coarsest lattice is BASE_CELL_SIZE grid cells wide;
  // higher octaves subdivide by LACUNARITY each step.
  //
  // Relief calibration (Remy, 2026-06-11 quality pass): the original
  // 4×equal-value-noise stack read as drifting CLOUDS — no directional
  // structure. Now: octave 0 is RIDGED (1 − 2|n| — crest lines where the
  // lattice crosses zero) at a much larger 80-cell/8,000 ft wavelength, so
  // each region carries a few connected ridge-and-valley landforms; octaves
  // 1-4 add standard value-noise detail underneath. Pre-release golden
  // regeneration recorded in the Worldforge tracker.
  const reliefRng = rngFromPath(streamPath(regionPath, 'relief'));
  const OCTAVES = 5;
  const LACUNARITY = 2;
  const PERSISTENCE = 0.5;
  const BASE_AMPLITUDE = 0.18;
  // Coarsest noise lattice cell size in heightfield grid cells.
  // 80 cells at 100 ft resolution = 8,000 ft macro landforms (~3 per region).
  const BASE_CELL_SIZE = 80;

  for (let octave = 0; octave < OCTAVES; octave++) {
    const freq = Math.pow(LACUNARITY, octave);
    const amp = BASE_AMPLITUDE * Math.pow(PERSISTENCE, octave);
    const octaveRng = rngFromPath(streamPath(regionPath, `relief-o${octave}`));
    const ridged = octave === 0; // macro octave carries the landform skeleton

    // Lattice cell size for this octave (pixels in heightfield grid)
    const cellSize = Math.max(2, Math.round(BASE_CELL_SIZE / freq));
    const noiseW = Math.ceil(width / cellSize) + 2;
    const noiseH = Math.ceil(height / cellSize) + 2;
    const noiseGrid = new Float32Array(noiseW * noiseH);
    for (let i = 0; i < noiseGrid.length; i++) {
      noiseGrid[i] = octaveRng.next() * 2 - 1; // -1..1
    }

    // Bilinear interpolate from the coarse lattice onto every sample
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const nx = col / cellSize;
        const ny = row / cellSize;
        const x0 = Math.floor(nx);
        const y0 = Math.floor(ny);
        // Smoothstep the lattice weights (2026-06-11 relief calibration):
        // raw bilinear weights leave C1 seams along lattice edges that the
        // strengthened hillshade renders as square patches.
        const rx = nx - x0;
        const ry = ny - y0;
        const fx = rx * rx * (3 - 2 * rx);
        const fy = ry * ry * (3 - 2 * ry);

        const n00 = noiseGrid[y0 * noiseW + x0] ?? 0;
        const n10 = noiseGrid[y0 * noiseW + (x0 + 1)] ?? 0;
        const n01 = noiseGrid[(y0 + 1) * noiseW + x0] ?? 0;
        const n11 = noiseGrid[(y0 + 1) * noiseW + (x0 + 1)] ?? 0;

        let noise = (n00 * (1 - fx) + n10 * fx) * (1 - fy) +
                    (n01 * (1 - fx) + n11 * fx) * fy;

        // Ridge transform: crests form along the lattice's zero-crossings,
        // turning blobs into connected ridge/valley lines.
        if (ridged) noise = 1 - 2 * Math.abs(noise);

        // Scale amplitude by local relief: flat areas get less noise,
        // mountains get more. Base height is the proxy.
        const baseH = samples[row * width + col];
        const reliefScale = Math.max(0.15, Math.min(1, (baseH - 0.15) / 0.55));
        const scaledNoise = noise * amp * reliefScale;

        samples[row * width + col] += scaledNoise;
      }
    }
  }

  // Clamp to 0..1 and re-enforce water discipline after noise
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.max(0, Math.min(1, samples[i]));
    if (isWaterCell[i]) {
      samples[i] = Math.min(samples[i], WATER_THRESHOLD - 0.01);
    }
  }

  return { width, height, resolutionFt, samples };
}

/**
 * Generate river banks: centerline polylines + heightfield carving.
 * Width mapping: widthFt = 50 + sqrt(flux) * 20 (flux is m³/s from Rivers.generate).
 * Carve depth: 0.02 normalized within half-width of centerline.
 */
function generateRiverBanks(
  rivers: Array<{ i: number; cells: number[]; discharge: number; width: number }>,
  cellPoints: Array<[number, number]>,
  memberSet: Set<number>,
  feetPerPixel: number,
  heightfield: RegionHeightfield,
  bounds: BoundsFt,
  regionPath: SeedPath,
): RegionRiverBank[] {
  const banks: RegionRiverBank[] = [];

  for (const river of rivers) {
    // Locality prefilter: the river must touch the membership context at all
    if (!river.cells.some((c) => memberSet.has(c))) continue;

    // Build the full centerline in feet, then clip to the region window
    // (WF-G4): at canonical scale river points are ~70k ft apart, so segments
    // routinely cross the whole 25k window with both endpoints outside —
    // the old member-cell point filter produced <2 in-window points and
    // dropped the river entirely.
    const fullLine: Array<[Feet, Feet]> = river.cells
      .filter((c) => cellPoints[c])
      .map((c) => [
        cellPoints[c][0] * feetPerPixel,
        cellPoints[c][1] * feetPerPixel,
      ]);
    const centerline = clipPolylineToBounds(fullLine, bounds);
    if (centerline.length < 2) continue; // need at least 2 points for a line

    // Width from flux (discharge proxy). sqrt dampens the range; +50 ensures
    // even small streams have visible banks.
    const widthFt = 50 + Math.sqrt(river.discharge) * 20;

    banks.push({ riverId: river.i, centerline, widthFt });

    // WF-G5: carve the terrain under the same curved band the renderer draws.
    // The artifact keeps the clipped raw path for traceability; both carve and
    // draw derive the smoothed path from riverCenterlineSmoothing.ts.
    carveRiverChannel(smoothRegionRiverCenterline(centerline), widthFt, heightfield, bounds);
  }

  return banks;
}

/**
 * Carve a river channel into the heightfield: reduce heights along the
 * centerline by a modest depth within half the river width.
 */
function carveRiverChannel(
  centerline: Array<[Feet, Feet]>,
  widthFt: Feet,
  heightfield: RegionHeightfield,
  bounds: BoundsFt,
): void {
  const CARVE_DEPTH = 0.04; // normalized depth; visible in hypsometric render
  const halfWidth = widthFt / 2;

  // For each heightfield sample near the centerline, reduce height
  for (let row = 0; row < heightfield.height; row++) {
    const sampleY = bounds.y + row * heightfield.resolutionFt;
    for (let col = 0; col < heightfield.width; col++) {
      const sampleX = bounds.x + col * heightfield.resolutionFt;

      // Find minimum distance to any centerline segment
      let minDist = Infinity;
      for (let i = 0; i < centerline.length - 1; i++) {
        const [ax, ay] = centerline[i];
        const [bx, by] = centerline[i + 1];
        const dist = pointToSegmentDist(sampleX, sampleY, ax, ay, bx, by);
        minDist = Math.min(minDist, dist);
      }

      // If within half-width, carve proportionally
      if (minDist < halfWidth) {
        const idx = row * heightfield.width + col;
        const falloff = 1 - minDist / halfWidth; // 1 at center, 0 at edge
        heightfield.samples[idx] = Math.max(0, heightfield.samples[idx] - CARVE_DEPTH * falloff);
      }
    }
  }
}

/**
 * Distance from point (px, py) to line segment (ax, ay)–(bx, by).
 */
function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.01) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Generate civilization data: town sites from burgs, roads from routes.
 * Returns empty arrays when no world data is provided (atlas-only C1 compat).
 */
function generateCivData(
  world: FmgWorldResult | undefined,
  memberCells: number[],
  memberSet: Set<number>,
  cellPoints: Array<[number, number]>,
  cellBurg: Uint16Array | undefined,
  feetPerPixel: number,
  bounds: BoundsFt,
  heightfield: RegionHeightfield,
): { townSites: RegionTownSite[]; roads: RegionRoad[] } {
  // Atlas-only mode: no civilization data
  if (!world || !world.pack.burgs || !world.pack.routes || !cellBurg) {
    return { townSites: [], roads: [] };
  }

  const { pack } = world;
  const burgs = pack.burgs!;
  const routes = pack.routes!;

  // ── Roads: routes passing through member cells (skip searoutes) ───────
  const roads: RegionRoad[] = [];
  for (const route of routes) {
    // Searoutes are NOT region roads (SPEC C2 requirement)
    if (route.group === 'searoutes') continue;

    // Locality prefilter: the route must touch the membership context at all
    // (route points are [x, y, cellId] triples)
    if (!route.points.some((p) => memberSet.has(p[2]))) continue;

    // Build the FULL centerline in feet, smooth, then clip to the region
    // window (WF-G4): like rivers, route segments can cross the whole window
    // with both endpoints outside at canonical scale. Smoothing happens
    // before clipping so the clipped ends land exactly on the window edge.
    const rawCenterline: Array<[Feet, Feet]> = route.points.map((point) => [
      point[0] * feetPerPixel,
      point[1] * feetPerPixel,
    ]);
    if (rawCenterline.length < 2) continue;

    // Chaikin smooth (3 iterations for gentle curves). Roads keep using the
    // same region helper so all curved L1 polylines share one curve profile.
    const centerline = clipPolylineToBounds(smoothRegionRiverCenterline(rawCenterline), bounds);
    if (centerline.length < 2) continue;

    // Width by kind: road=40ft (main trade routes), trail=20ft (local paths)
    const kind = route.group === 'roads' ? 'road' as const : 'trail' as const;
    const widthFt = kind === 'road' ? 40 : 20;

    roads.push({ routeId: route.i, centerline, widthFt, kind });
  }

  // ── Town sites: burgs in member cells ──────────────────────────────────
  const townSites: RegionTownSite[] = [];
  const seenBurgIds = new Set<number>();

  for (const cellId of memberCells) {
    const burgId = cellBurg[cellId];
    if (!burgId || seenBurgIds.has(burgId)) continue;
    seenBurgIds.add(burgId);

    const burg = burgs[burgId];
    if (!burg || burg.removed || !burg.i) continue;

    const cx = burg.x * feetPerPixel;
    const cy = burg.y * feetPerPixel;

    // WF-G4: member cells can extend far beyond the (now fixed-size) region
    // window — only burgs whose center falls inside the window are this
    // region's town sites.
    if (
      cx < bounds.x || cx > bounds.x + bounds.width ||
      cy < bounds.y || cy > bounds.y + bounds.height
    ) continue;

    // Envelope: sqrt(population) * 80 ft half-extent, clamped [400, 4000] ft.
    // Small hamlet (pop 10) ≈ 253 ft → 400 (min); large city (pop 2500) ≈ 4000 ft.
    const pop = burg.population ?? 10;
    const halfExtent = Math.max(400, Math.min(4000, Math.sqrt(pop) * 80));
    const envelope: BoundsFt = {
      x: cx - halfExtent,
      y: cy - halfExtent,
      width: halfExtent * 2,
      height: halfExtent * 2,
    };

    // Gates: where roads enter the envelope boundary.
    // Check each road's centerline for intersection with envelope edges.
    const gates: Array<[Feet, Feet]> = [];
    for (const road of roads) {
      const entryPoints = findEnvelopeEntries(road.centerline, envelope);
      for (const pt of entryPoints) gates.push(pt);
    }

    townSites.push({ burgId: burg.i, envelope, gates });
  }

  // ── Heightfield interaction: flatten gently under town envelopes ───────
  flattenUnderTowns(townSites, heightfield, bounds);

  return { townSites, roads };
}

/**
 * Clip a polyline to a bounds window (WF-G4). Keeps in-window points and
 * inserts edge-intersection points where segments cross the boundary —
 * including segments whose BOTH endpoints lie outside but which pass through
 * the window (the common case at canonical scale, where atlas points are
 * ~70k ft apart and the window is 25k ft). Re-entries are joined into one
 * polyline; for L1 rendering and carving this is visually indistinguishable
 * and keeps the artifact a single centerline per river/road.
 */
function clipPolylineToBounds(
  line: Array<[Feet, Feet]>,
  bounds: BoundsFt,
): Array<[Feet, Feet]> {
  const bx2 = bounds.x + bounds.width;
  const by2 = bounds.y + bounds.height;
  const inside = (x: number, y: number): boolean =>
    x >= bounds.x && x <= bx2 && y >= bounds.y && y <= by2;

  const out: Array<[Feet, Feet]> = [];
  const push = (p: [number, number]) => {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > 1e-6 || Math.abs(last[1] - p[1]) > 1e-6) {
      out.push([p[0], p[1]]);
    }
  };

  for (let i = 0; i < line.length; i++) {
    const [ax, ay] = line[i];
    if (inside(ax, ay)) push([ax, ay]);

    if (i < line.length - 1) {
      const [bxp, byp] = line[i + 1];
      // Collect every boundary crossing of this segment, ordered along it.
      // 0 crossings: fully inside or fully outside (nothing extra to add).
      // 1 crossing: enters or leaves. 2 crossings: passes straight through.
      const crossings: Array<{ t: number; pt: [number, number] }> = [];
      const edges: Array<[number, number, number, number]> = [
        [bounds.x, bounds.y, bx2, bounds.y],
        [bounds.x, by2, bx2, by2],
        [bounds.x, bounds.y, bounds.x, by2],
        [bx2, bounds.y, bx2, by2],
      ];
      const dx = bxp - ax;
      const dy = byp - ay;
      const lenSq = dx * dx + dy * dy;
      for (const [ex1, ey1, ex2, ey2] of edges) {
        const pt = lineSegmentIntersection(ax, ay, bxp, byp, ex1, ey1, ex2, ey2);
        if (pt) {
          const t = lenSq > 0 ? ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / lenSq : 0;
          crossings.push({ t, pt });
        }
      }
      crossings.sort((a, b) => a.t - b.t);
      for (const c of crossings) push(c.pt);
    }
  }

  return out;
}

/**
 * Find points where a polyline enters an envelope boundary.
 * Returns entry points on the envelope edge.
 */
function findEnvelopeEntries(
  centerline: Array<[number, number]>,
  envelope: BoundsFt,
): Array<[number, number]> {
  const entries: Array<[number, number]> = [];
  const { x: ex, y: ey, width: ew, height: eh } = envelope;
  const ex2 = ex + ew;
  const ey2 = ey + eh;

  for (let i = 0; i < centerline.length - 1; i++) {
    const [ax, ay] = centerline[i];
    const [bx, by] = centerline[i + 1];
    const aInside = ax >= ex && ax <= ex2 && ay >= ey && ay <= ey2;
    const bInside = bx >= ex && bx <= ex2 && by >= ey && by <= ey2;

    // Segment crosses envelope boundary: one inside, one outside
    if (aInside !== bInside) {
      // Find intersection with envelope edges
      const intersection = segmentRectIntersection(ax, ay, bx, by, ex, ey, ex2, ey2);
      if (intersection) entries.push(intersection);
    }
  }

  return entries;
}

/**
 * Find intersection of segment (ax,ay)–(bx,by) with axis-aligned rect.
 * Returns the intersection point closest to the outside endpoint.
 */
function segmentRectIntersection(
  ax: number, ay: number, bx: number, by: number,
  rx1: number, ry1: number, rx2: number, ry2: number,
): [number, number] | null {
  // Check all 4 edges of the rectangle
  const edges: Array<[number, number, number, number]> = [
    [rx1, ry1, rx2, ry1], // top
    [rx1, ry2, rx2, ry2], // bottom
    [rx1, ry1, rx1, ry2], // left
    [rx2, ry1, rx2, ry2], // right
  ];

  let closest: [number, number] | null = null;
  let closestDist = Infinity;

  for (const [ex1, ey1, ex2, ey2] of edges) {
    const pt = lineSegmentIntersection(ax, ay, bx, by, ex1, ey1, ex2, ey2);
    if (pt) {
      // Distance to the outside endpoint (the one further from center)
      const dist = Math.hypot(pt[0] - ax, pt[1] - ay);
      if (dist < closestDist) {
        closestDist = dist;
        closest = pt;
      }
    }
  }

  return closest;
}

/**
 * Intersection of two line segments. Returns null if parallel or out of range.
 */
function lineSegmentIntersection(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): [number, number] | null {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom;

  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [ax + t * d1x, ay + t * d1y];
}

/**
 * Flatten heightfield gently under town envelopes (build sites).
 * Average the height within each envelope to create a flat building pad.
 */
function flattenUnderTowns(
  townSites: RegionTownSite[],
  heightfield: RegionHeightfield,
  bounds: BoundsFt,
): void {
  const { width, height, resolutionFt, samples } = heightfield;
  const FLATTEN_STRENGTH = 0.5; // blend toward mean (0=no flatten, 1=full flatten)

  for (const site of townSites) {
    const { envelope } = site;
    // Find grid cells inside envelope
    const col0 = Math.max(0, Math.floor((envelope.x - bounds.x) / resolutionFt));
    const col1 = Math.min(width - 1, Math.ceil((envelope.x + envelope.width - bounds.x) / resolutionFt));
    const row0 = Math.max(0, Math.floor((envelope.y - bounds.y) / resolutionFt));
    const row1 = Math.min(height - 1, Math.ceil((envelope.y + envelope.height - bounds.y) / resolutionFt));

    if (col0 > col1 || row0 > row1) continue;

    // Compute mean height in envelope
    let sum = 0;
    let count = 0;
    for (let r = row0; r <= row1; r++) {
      for (let c = col0; c <= col1; c++) {
        sum += samples[r * width + c];
        count++;
      }
    }
    if (count === 0) continue;
    const mean = sum / count;

    // Blend toward mean (gentle flattening, not total erase)
    for (let r = row0; r <= row1; r++) {
      for (let c = col0; c <= col1; c++) {
        const idx = r * width + c;
        samples[idx] = samples[idx] + (mean - samples[idx]) * FLATTEN_STRENGTH;
      }
    }
  }
}
