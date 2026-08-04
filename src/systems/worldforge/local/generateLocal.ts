/**
 * @file generateLocal.ts — L2 LOCAL layer generation (wilderness-first slice).
 *
 * Spec: docs/projects/worldforge/SPEC.md §4 L2 + §9 item 4. THE handoff
 * artifact of the pipeline: the playable local area that replaces the legacy
 * submap (Decision Blitz D3). Both the 2D cartographic render and the 3D
 * ground mode consume this one dataset.
 *
 * Inputs: a RegionArtifact (L1, 100ft-resolution heightfield + river banks +
 * roads) and a center point; output: a LocalArtifact at the 5 ft atomic cell
 * (CELL_FT) — elevation upsampled from the region with fine coherent detail,
 * a terrain-material classification per cell, and placed features
 * (vegetation/boulders) with stable ids for the delta layer.
 *
 * Determinism: every random draw comes from named sub-streams of the local
 * seed path (seedPath.ts); same (region, center, seedPath, opts) → identical
 * artifact, forever.
 *
 * What changed: new module (build item 4, slice 1 — wilderness only).
 * Why: first playable-scale layer below L1; town interiors/streets land via
 * the town generator (SPEC §6) into the same artifact in a later slice.
 * Preserved: spine/fmg/region/adapter untouched (consumed read-only).
 */
import { CELL_FT, LOCAL_SIZE_FT, type BoundsFt, type Feet } from '../units';
import { childSeedPath, rngFromPath, streamPath, worldSeedFromPath, type SeedPath } from '../seedPath';
import { makeWorldFeetNoise } from './worldFeetNoise';
import {
  clumpAccept,
  clumpAt,
  clumpDens,
  clumpSeparationScale,
} from '../forests/clumpField';
import { UNDERGROWTH_MULT } from '../forests/forestTunables';
import {
  MOUNTAIN_MAX_ELEV_FT,
  TREELINE_N,
  treelineClassOf,
} from '../mountains/mountainTunables';
import {
  WORLDFORGE_SCHEMA_VERSION,
  type LocalArtifact,
  type LocalFeature,
  type LocalTerrain,
  type RegionArtifact,
  type TerrainMaterial,
} from '../artifacts';

export interface GenerateLocalOptions {
  /** Edge length of the local area in feet (default LOCAL_SIZE_FT = 3000). */
  sizeFt?: Feet;
  /**
   * Biome id of the anchoring atlas cell (FMG biome indices). The caller
   * resolves it (atlas pack.cells.biome at the anchor) — the local layer
   * deliberately doesn't reach back into the atlas itself.
   */
  biomeId: number;
}

// ---------------------------------------------------------------------------
// Biome → material/vegetation profile.
// FMG biome indices (fmg/biomes.ts): 1 hot desert, 2 cold desert, 3 savanna,
// 4 grassland, 5 tropical seasonal forest, 6 temperate deciduous forest,
// 7 tropical rainforest, 8 temperate rainforest, 9 taiga, 10 tundra,
// 11 glacier, 12 wetland. 0 = marine.
// Profiles are deliberately coarse — richness grows with later slices.
// ---------------------------------------------------------------------------

interface BiomeProfile {
  ground: TerrainMaterial;
  /** Trees per 10,000 sq ft (a 100ft×100ft patch). */
  treeDensity: number;
  bushDensity: number;
  boulderDensity: number;
}

const BIOME_PROFILES: Record<number, BiomeProfile> = {
  0:  { ground: 'sand',    treeDensity: 0,    bushDensity: 0,   boulderDensity: 0.1 },
  1:  { ground: 'sand',    treeDensity: 0.05, bushDensity: 0.4, boulderDensity: 0.6 },
  2:  { ground: 'sand',    treeDensity: 0.05, bushDensity: 0.3, boulderDensity: 0.8 },
  3:  { ground: 'grass',   treeDensity: 0.3,  bushDensity: 0.8, boulderDensity: 0.3 },
  4:  { ground: 'grass',   treeDensity: 0.2,  bushDensity: 0.6, boulderDensity: 0.3 },
  5:  { ground: 'grass',   treeDensity: 1.4,  bushDensity: 1.0, boulderDensity: 0.2 },
  6:  { ground: 'grass',   treeDensity: 1.8,  bushDensity: 1.2, boulderDensity: 0.3 },
  7:  { ground: 'grass',   treeDensity: 2.6,  bushDensity: 1.6, boulderDensity: 0.2 },
  8:  { ground: 'grass',   treeDensity: 2.2,  bushDensity: 1.4, boulderDensity: 0.4 },
  9:  { ground: 'dirt',    treeDensity: 1.6,  bushDensity: 0.7, boulderDensity: 0.6 },
  10: { ground: 'dirt',    treeDensity: 0.15, bushDensity: 0.5, boulderDensity: 0.9 },
  11: { ground: 'ice',     treeDensity: 0,    bushDensity: 0.05, boulderDensity: 1.2 },
  12: { ground: 'wetland', treeDensity: 0.9,  bushDensity: 1.3, boulderDensity: 0.1 },
};

const FALLBACK_PROFILE: BiomeProfile = BIOME_PROFILES[4];

/**
 * FMG deep-forest biome ids (7 tropical rainforest, 8 temperate rainforest,
 * 9 taiga) — always dense canopy. The density clause below extends "dense" to
 * any biome whose treeDensity reaches 1.4 (currently 5 tropical seasonal 1.4
 * and 6 temperate deciduous 1.8; the id set guards the rainforests/taiga even
 * if their densities get tuned down later).
 */
const DEEP_FOREST_BIOME_IDS: ReadonlySet<number> = new Set([7, 8, 9]);
const DENSE_TREE_DENSITY = 1.4;

/** Material palette order is part of the artifact contract — APPEND ONLY.
 * `ice` (Task 10 MOUNTAINS) is appended last so every prior index is stable
 * and no existing local golden shifts; inserting mid-list would shift indices
 * and break every local golden. */
const MATERIALS: TerrainMaterial[] = [
  'grass', 'dirt', 'rock', 'sand', 'wetland', 'water', 'paved', 'floor', 'ice',
];
const MAT = Object.fromEntries(MATERIALS.map((m, i) => [m, i])) as Record<TerrainMaterial, number>;

/** Water threshold in the region's normalized heightfield (FMG h<20 ≙ 0.2). */
const WATER_LEVEL = 0.2;
/**
 * Slopes steeper than this (rise over 5ft run, in normalized units) read as
 * rock — scree/outcrops on the steepest ~1% of cells. Real 5ft gradients are
 * detail-noise dominated at every altitude (p50≈6e-4, p99≈1.6e-3, max≈2.6e-3,
 * measured 2026-07-01 over 10.8M cells); the old 0.0035 sat above the physical
 * maximum and never fired.
 */
const ROCK_SLOPE = 0.0016;
/** Above this normalized height (FMG h≈65) land is bare rock. */
const ROCK_LINE = 0.65;
/**
 * Transition band below ROCK_LINE where rock mixes into the biome ground with
 * increasing altitude, dithered by the ~60ft detail noise so it reads as
 * coherent rock patches rather than per-cell speckle.
 */
const ROCK_BAND = 0.15;

// Fine 5ft detail now comes from `makeWorldFeetNoise` (a single per-world lattice
// indexed by global world feet) instead of a per-Local lattice — see the
// detail-noise block in generateLocal (Stage 5 S5.2, seamless cell boundaries).

/**
 * Map a normalized height `n` (0..1 ≙ FMG 0..100) to feet of local relief.
 *
 * Below n = 0.5 this is EXACTLY the legacy `n · 2000` mapping: `max(0, n − 0.5)`
 * is 0, so `Math.pow(0, 2.2)` is 0 and the high-country term drops out — every
 * lowland/town window is BYTE-IDENTICAL to the pre-mountains generator (the hard
 * invariance gate, Task 11). At and above n = 0.5 a `^2.2` ramp accelerates the
 * curve so high country reaches `MOUNTAIN_MAX_ELEV_FT` (7,000 ft) at n = 1 —
 * un-compressing the mountains the flat `× 2000` mapping squashed under ~610 m.
 *
 * The ramp span is written as `MOUNTAIN_MAX_ELEV_FT − 2000` so retuning the max
 * flows through. Monotonic increasing on [0,1]; C1-continuous at the 0.5 knot
 * (the ^2.2 exponent > 1 gives the ramp zero slope there, matching the linear
 * side's 2000 ft/unit). Pure.
 */
export function elevationCurveFt(n: number): number {
  const highRamp = Math.pow(Math.max(0, n - 0.5) / 0.5, 2.2);
  return 2000 * n + highRamp * (MOUNTAIN_MAX_ELEV_FT - 2000);
}

/**
 * Derivative of `elevationCurveFt` (ft per unit n). Exactly 2000 for n ≤ 0.5
 * (the legacy linear side); the high-country ramp steepens toward ~24,000 at
 * n = 1. Used to damp NORMALIZED-space micro-noise so its VERTICAL amplitude
 * stays constant through the curve (2026-07-21 look pass: undamped ±0.017 n
 * detail became ±235 ft needles at 25–60 ft wavelength in peak windows). Pure.
 */
export function elevationCurveSlopeFt(n: number): number {
  if (n <= 0.5) return 2000;
  const t = (n - 0.5) / 0.5;
  return 2000 + (2.2 / 0.5) * Math.pow(t, 1.2) * (MOUNTAIN_MAX_ELEV_FT - 2000);
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export function generateLocal(
  region: RegionArtifact,
  centerFt: { x: Feet; y: Feet },
  parentSeedPath: SeedPath,
  opts: GenerateLocalOptions,
): LocalArtifact {
  const sizeFt = opts.sizeFt ?? LOCAL_SIZE_FT;
  const widthCells = Math.round(sizeFt / CELL_FT);
  const heightCells = widthCells;
  const bounds: BoundsFt = {
    x: centerFt.x - sizeFt / 2,
    y: centerFt.y - sizeFt / 2,
    width: sizeFt,
    height: sizeFt,
  };
  const localPath = childSeedPath(
    parentSeedPath,
    `local:${Math.round(centerFt.x)}-${Math.round(centerFt.y)}`,
  );

  const profile = BIOME_PROFILES[opts.biomeId] ?? FALLBACK_PROFILE;
  const hf = region.heightfield;

  // Region heightfield sampler (bilinear over the 100ft grid, normalized 0..1).
  const sampleRegion = (fx: Feet, fy: Feet): number => {
    const gx = Math.min(Math.max((fx - region.bounds.x) / hf.resolutionFt, 0), hf.width - 1.001);
    const gy = Math.min(Math.max((fy - region.bounds.y) / hf.resolutionFt, 0), hf.height - 1.001);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const s = (xi: number, yi: number) => hf.samples[yi * hf.width + xi];
    const a = s(x0, y0) * (1 - tx) + s(Math.min(x0 + 1, hf.width - 1), y0) * tx;
    const b = s(x0, Math.min(y0 + 1, hf.height - 1)) * (1 - tx) + s(Math.min(x0 + 1, hf.width - 1), Math.min(y0 + 1, hf.height - 1)) * tx;
    return a * (1 - ty) + b * ty;
  };

  // Fine detail: two small octaves (~60ft and ~25ft features), zeroed in/near
  // water so shores stay clean.
  // GRID-RETIRE / Stage 5 S5.2: index the detail by GLOBAL WORLD FEET via a single
  // per-world lattice, NOT by this Local's own cell frame + per-local seed. fx,fy
  // are global feet (region bounds = FMG px × FEET_PER_FMG_PIXEL), so two adjacent
  // cells evaluate the same value at their shared edge — the terrain meets with no
  // seam, by construction. (Was `makeLatticeNoise(streamPath(localPath,…))(cx,cy)`,
  // which seeded per-local and indexed per-cell → a cliff at every cell boundary.)
  const worldSeed = worldSeedFromPath(parentSeedPath);
  const noiseA = makeWorldFeetNoise(worldSeed, 12 * CELL_FT); // ~60ft features
  const noiseB = makeWorldFeetNoise(worldSeed, 5 * CELL_FT); //  ~25ft features

  // High-country CRAG octave (2026-07-21 look pass): ridged noise at ~800 ft
  // wavelength whose VERTICAL amplitude is held at ~±CRAG_FT by dividing out
  // the elevation curve's local slope. This fills the 200–1,000 ft band that
  // makes alpine windows read as rock formations — the damped micro-detail
  // (below) killed the needle spikes, and the region field is too smooth at
  // window scale to carve faces on its own. Gated to EXACTLY 0 below n = 0.6,
  // so every lowland/town window stays byte-identical.
  const cragNoise = makeWorldFeetNoise((worldSeed ^ 0x43524147) >>> 0, 800); // 'CRAG'
  const CRAG_FT = 130;
  const cragGate = (base: number): number => {
    const t = Math.max(0, Math.min(1, (base - 0.6) / 0.15));
    return t * t * (3 - 2 * t); // smoothstep — 0 at 0.6, 1 from 0.75 up
  };

  const elevationFt = new Float32Array(widthCells * heightCells);
  const materialIndex = new Uint8Array(widthCells * heightCells);
  /** Normalized base heights cached for slope/material passes. */
  const normalized = new Float32Array(widthCells * heightCells);

  for (let cy = 0; cy < heightCells; cy++) {
    for (let cx = 0; cx < widthCells; cx++) {
      const i = cy * widthCells + cx;
      const fx = bounds.x + (cx + 0.5) * CELL_FT;
      const fy = bounds.y + (cy + 0.5) * CELL_FT;
      const base = sampleRegion(fx, fy);
      const aboveWater = Math.max(0, base - WATER_LEVEL);
      // Detail amplitude scales with height above water (flat shores, rugged hills).
      const detail = (noiseA(fx, fy) - 0.5) * 0.012 + (noiseB(fx, fy) - 0.5) * 0.005;
      // Damp the n-space detail by the curve's local slope so its VERTICAL
      // amplitude stays ~±25 ft everywhere. For base ≤ 0.5 the slope is exactly
      // 2000 (damp = 1) — every lowland/town window stays byte-identical.
      const curveSlope = elevationCurveSlopeFt(base);
      const detailDamp = 2000 / curveSlope;
      // Crag relief: ridge-transformed noise, slope-compensated to a constant
      // ~±CRAG_FT vertical, faded in above n = 0.6 (see cragGate above).
      const gate = cragGate(base);
      let cragN = 0;
      if (gate > 0) {
        const cn = cragNoise(fx, fy) * 2 - 1;
        cragN = ((1 - 2 * Math.abs(cn)) * CRAG_FT * gate) / curveSlope;
      }
      const n = base + detail * Math.min(1, aboveWater * 8) * detailDamp + cragN;
      normalized[i] = n;
      // Normalized 0..1 ≙ FMG 0..100 height → feet of relief via elevationCurveFt
      // (Task 11): identity `n · 2000` below n = 0.5 (lowlands/towns unchanged),
      // accelerating to MOUNTAIN_MAX_ELEV_FT at n = 1 so high country grows real
      // peaks. The L3 ground mode re-anchors absolute elevation.
      elevationFt[i] = elevationCurveFt(n);
    }
  }

  // Material classification pass.
  for (let cy = 0; cy < heightCells; cy++) {
    for (let cx = 0; cx < widthCells; cx++) {
      const i = cy * widthCells + cx;
      const n = normalized[i];
      if (n < WATER_LEVEL) { materialIndex[i] = MAT.water; continue; }
      // Slope from horizontal neighbors (5ft run).
      const right = normalized[cy * widthCells + Math.min(cx + 1, widthCells - 1)];
      const down = normalized[Math.min(cy + 1, heightCells - 1) * widthCells + cx];
      const slope = Math.max(Math.abs(right - n), Math.abs(down - n));
      // Rock: steepest outcrops anywhere, plus the altitude band — 0 rock at
      // ROCK_LINE - ROCK_BAND rising to solid rock at ROCK_LINE and above.
      const rockiness = (n - (ROCK_LINE - ROCK_BAND)) / ROCK_BAND;
      if (slope > ROCK_SLOPE || rockiness >= 1) { materialIndex[i] = MAT.rock; continue; }
      if (rockiness > 0) {
        const fx = bounds.x + (cx + 0.5) * CELL_FT;
        const fy = bounds.y + (cy + 0.5) * CELL_FT;
        if (noiseA(fx, fy) < rockiness) { materialIndex[i] = MAT.rock; continue; }
      }
      // Shoreline band: damp ground material near water.
      if (n < WATER_LEVEL + 0.012) {
        materialIndex[i] = profile.ground === 'sand' ? MAT.sand : MAT.dirt;
        continue;
      }
      materialIndex[i] = MAT[profile.ground];
    }
  }

  // River banks crossing the local bounds carve water bands (the region
  // already carved the heightfield; here we classify the surface).
  for (const river of region.rivers) {
    const halfW = Math.max(river.widthFt / 2, CELL_FT);
    for (let p = 0; p < river.centerline.length - 1; p++) {
      const [ax, ay] = river.centerline[p];
      const [bx, by] = river.centerline[p + 1];
      // Walk the segment at 5ft steps, stamping water within halfW.
      const segLen = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(segLen / CELL_FT));
      for (let st = 0; st <= steps; st++) {
        const fx = ax + ((bx - ax) * st) / steps;
        const fy = ay + ((by - ay) * st) / steps;
        if (fx < bounds.x - halfW || fx > bounds.x + bounds.width + halfW) continue;
        if (fy < bounds.y - halfW || fy > bounds.y + bounds.height + halfW) continue;
        const r = Math.ceil(halfW / CELL_FT);
        const ccx = Math.floor((fx - bounds.x) / CELL_FT);
        const ccy = Math.floor((fy - bounds.y) / CELL_FT);
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const tx = ccx + dx;
            const ty = ccy + dy;
            if (tx < 0 || ty < 0 || tx >= widthCells || ty >= heightCells) continue;
            if (Math.hypot(dx, dy) * CELL_FT <= halfW) materialIndex[ty * widthCells + tx] = MAT.water;
          }
        }
      }
    }
  }

  // Roads crossing the local bounds become paved/dirt path bands.
  for (const road of region.roads ?? []) {
    const halfW = Math.max(road.widthFt / 2, CELL_FT / 2);
    for (let p = 0; p < road.centerline.length - 1; p++) {
      const [ax, ay] = road.centerline[p];
      const [bx, by] = road.centerline[p + 1];
      const segLen = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(segLen / CELL_FT));
      for (let st = 0; st <= steps; st++) {
        const fx = ax + ((bx - ax) * st) / steps;
        const fy = ay + ((by - ay) * st) / steps;
        const ccx = Math.floor((fx - bounds.x) / CELL_FT);
        const ccy = Math.floor((fy - bounds.y) / CELL_FT);
        const r = Math.ceil(halfW / CELL_FT);
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const tx = ccx + dx;
            const ty = ccy + dy;
            if (tx < 0 || ty < 0 || tx >= widthCells || ty >= heightCells) continue;
            const idx = ty * widthCells + tx;
            if (materialIndex[idx] === MAT.water) continue; // bridges are a later slice
            if (Math.hypot(dx, dy) * CELL_FT <= halfW) {
              materialIndex[idx] = road.kind === 'road' ? MAT.paved : MAT.dirt;
            }
          }
        }
      }
    }
  }

  // Feature placement: blue-noise-ish rejection sampling per kind, density by
  // biome profile, never on water/paved, boulders prefer rock.
  //
  // `clumped` kinds additionally run through the three-octave clump field
  // (forests/clumpField.ts), which is what stops the result reading as an
  // orchard. Two things change for them: acceptance becomes a continuous
  // probability instead of a uniform draw, and the minimum-separation radius
  // relaxes toward the middle of a thicket so a knot can actually close over.
  //
  // The attempt budget is doubled for clumped kinds because the acceptance
  // probability averages about 0.61, so a fixed 12x budget would quietly ship
  // 40% fewer trees. The target count is deliberately unchanged: the field is
  // meant to REDISTRIBUTE density, not remove it, and a window that loses a
  // third of its trees to a new gate is a different, worse change.
  const features: LocalFeature[] = [];
  let nextId = 1;
  const placeKind = (
    kind: LocalFeature['kind'],
    densityPer10kSqFt: number,
    stream: string,
    minSepFt: number,
    allow: (mat: number) => boolean,
    keep?: (fx: number, fy: number) => boolean,
    clumped = false,
  ) => {
    const target = Math.round((sizeFt * sizeFt) / 10_000 * densityPer10kSqFt);
    if (target <= 0) return;
    const rng = rngFromPath(streamPath(localPath, stream));
    // Uniform grid over the window at the unrelaxed separation radius, so the
    // min-sep test reads at most nine buckets instead of every tree placed so
    // far. Identical decisions to the old O(n^2) scan: a candidate closer than
    // minSepFt can only be in this cell or one touching it, and the clump
    // relief only ever SHRINKS the radius (see clumpSeparationScale).
    const gridCols = Math.max(1, Math.ceil(sizeFt / minSepFt));
    const buckets: Array<Array<[number, number]>> = [];
    const bucketAt = (gx: number, gy: number) => {
      const i = gy * gridCols + gx;
      return (buckets[i] ??= []);
    };
    let attempts = 0;
    let placedTotal = 0;
    const budget = target * (clumped ? 24 : 12);
    while (placedTotal < target && attempts < budget) {
      attempts++;
      const fx = bounds.x + rng.next() * sizeFt;
      const fy = bounds.y + rng.next() * sizeFt;
      const ccx = Math.min(widthCells - 1, Math.floor((fx - bounds.x) / CELL_FT));
      const ccy = Math.min(heightCells - 1, Math.floor((fy - bounds.y) / CELL_FT));
      if (!allow(materialIndex[ccy * widthCells + ccx])) continue;
      // Optional spatial gate (e.g. the biome tree line) — checked after the
      // material allow, before min-sep; a rejected sample burns an attempt
      // exactly like a material rejection.
      if (keep && !keep(fx, fy)) continue;

      let dens = 0;
      let sep = minSepFt;
      if (clumped) {
        const clump = clumpAt(fx, fy);
        // Probabilities over 1 always accept, which is what lets the dense
        // knots saturate rather than merely being likelier than the clearings.
        if (rng.next() > clumpAccept(clump)) continue;
        dens = clumpDens(clump);
        sep = minSepFt * clumpSeparationScale(dens);
      }

      const gx = Math.min(gridCols - 1, Math.max(0, Math.floor((fx - bounds.x) / minSepFt)));
      const gy = Math.min(gridCols - 1, Math.max(0, Math.floor((fy - bounds.y) / minSepFt)));
      let tooClose = false;
      for (let oy = -1; oy <= 1 && !tooClose; oy++) {
        for (let ox = -1; ox <= 1 && !tooClose; ox++) {
          const nx = gx + ox;
          const ny = gy + oy;
          if (nx < 0 || ny < 0 || nx >= gridCols || ny >= gridCols) continue;
          for (const [px, py] of bucketAt(nx, ny)) {
            if (Math.hypot(px - fx, py - fy) < sep) { tooClose = true; break; }
          }
        }
      }
      if (tooClose) continue;
      bucketAt(gx, gy).push([fx, fy]);
      placedTotal++;
      const feature: LocalFeature = { id: nextId++, kind, x: fx, y: fy };
      if (clumped) feature.dens = dens;
      features.push(feature);
    }
  };

  const groundOk = (m: number) => m !== MAT.water && m !== MAT.paved && m !== MAT.rock;

  // Every vegetated kind now clumps, in every biome. The dense-forest flag no
  // longer decides WHETHER the field applies — a grassland whose trees are
  // spread evenly is an orchard, and savannah trees clump for the same reasons
  // rainforest trees do — it decides only whether the window also gets the
  // undergrowth stream crowding its thicket floors.
  //
  // What used to live here was a boolean gate on a single octave of the same
  // noise, applied to dense windows only. It went for two reasons: a hard
  // cutoff draws a visible contour through the forest, and one octave produces
  // a field with a recognizable mean everywhere, so what came out the other
  // side was still an even sprinkle with soft variation. See clumpField.ts.
  const isDenseForest =
    DEEP_FOREST_BIOME_IDS.has(opts.biomeId) || profile.treeDensity >= DENSE_TREE_DENSITY;

  // Tree line (Task 11 MOUNTAINS): reject trees above the window's normalized
  // height line, resolved ONCE from the anchor biome's temperature class — cold
  // taiga/tundra/glacier lose trees lowest, tropical biomes carry no line
  // (TREELINE_N.none sits above the domain). Read from the SAME cached
  // `normalized` field the material pass uses, indexed by the SAME cell math as
  // placeKind, so the gate agrees cell-for-cell. It stays a hard boolean while
  // the clump field went probabilistic, and that asymmetry is deliberate: a
  // tree line is a real geographic edge that the eye expects to see, whereas a
  // clearing margin is not. Trees only — bushes, boulders, and undergrowth are
  // untouched. For a lowland window every cell is below the line, so
  // `belowTreeline` is always true and the gate costs the tree stream nothing.
  const treelineN = TREELINE_N[treelineClassOf(opts.biomeId)];
  const belowTreeline = (fx: number, fy: number): boolean => {
    const ccx = Math.min(widthCells - 1, Math.floor((fx - bounds.x) / CELL_FT));
    const ccy = Math.min(heightCells - 1, Math.floor((fy - bounds.y) / CELL_FT));
    return normalized[ccy * widthCells + ccx] <= treelineN;
  };

  placeKind('tree', profile.treeDensity, 'trees', 18, groundOk, belowTreeline, true);
  placeKind('bush', profile.bushDensity, 'bushes', 10, groundOk, undefined, true);
  // Boulders do not clump: scree genuinely does, but it clumps to slope and
  // outcrop rather than to a vegetation field, and borrowing this one would
  // put boulders in the same knots as the trees. Left even until the rocks
  // pass gives them a field of their own.
  placeKind('boulder', profile.boulderDensity, 'boulders', 14, (m) => m !== MAT.water && m !== MAT.paved);
  if (isDenseForest) {
    // Undergrowth: scrub crowding the thicket floor under dense canopy. It
    // reads the same clump field as the trees, so it hugs the thickets and the
    // clearings stay open. Reuses the 'bush' feature kind; the separate
    // 'undergrowth' stream name keeps it deterministic and independent of the
    // base 'bushes' stream. Runs LAST: each placeKind call seeds its own rng
    // via rngFromPath(streamPath(localPath, stream)), so ordering cannot
    // perturb the other streams, and appending keeps the three base streams'
    // ids contiguous.
    placeKind('bush', profile.bushDensity * UNDERGROWTH_MULT, 'undergrowth', 8, groundOk, undefined, true);
  }

  const terrain: LocalTerrain = {
    widthCells,
    heightCells,
    elevationFt,
    materialIndex,
    materials: MATERIALS,
  };

  return {
    layer: 'local',
    schemaVersion: WORLDFORGE_SCHEMA_VERSION,
    seedPath: localPath,
    bounds,
    terrain,
    features,
  };
}
