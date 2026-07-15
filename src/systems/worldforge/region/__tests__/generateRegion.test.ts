/**
 * @file generateRegion.test.ts — golden + invariant tests for L1 region generator.
 *
 * Verification criteria (directive C1 + C2):
 * - Determinism: same inputs → byte-equal heightfield
 * - FROZEN goldens for fixed seed + anchor cell
 * - Invariants: no NaN, water stays water, river centerline points inside bounds
 * - Different anchor cells → different fields
 * - C2: town sites, roads, envelopes inside bounds, gates on edges, atlas-compat
 * - No Math.random/Date.now in region/
 *
 * What changed: C2 — added civilization tests (town sites + roads).
 * Preserved: existing worldforge/fmg test suites untouched.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateFmgAtlas } from '../../fmg/generateAtlas';
import { generateFmgWorld } from '../../fmg/generateWorld';
import { deriveRegionCrossings, generateRegion, makeMountainRidgeField } from '../generateRegion';
import { RIDGE_START_N, RIDGE_AMPLITUDE } from '../../mountains/mountainTunables';
import { rootSeedPath, fnv1a } from '../../seedPath';
import { boundsContain } from '../../units';
import type { FmgAtlasResult } from '../../fmg/generateAtlas';
import type { FmgWorldResult } from '../../fmg/generateWorld';
import type { RegionArtifact } from '../../artifacts';

const SEED = 'world-42';
const WORLD_SEED = 42;
const FEET_PER_PIXEL = 1000; // plausible test value (Lane B wires canonical)

describe('deriveRegionCrossings', () => {
  const river = {
    riverId: 7,
    centerline: [[50, 0], [50, 100]] as Array<[number, number]>,
    widthFt: 50,
  };

  it('authors a route-aligned bridge receipt for a major road crossing', () => {
    const crossings = deriveRegionCrossings([{
      routeId: 3,
      centerline: [[0, 50], [100, 50]],
      widthFt: 44,
      kind: 'highway',
    }], [river]);

    expect(crossings).toEqual([{
      id: 'crossing:3:7:0',
      kind: 'bridge',
      roadRouteId: 3,
      riverId: 7,
      point: [50, 50],
      roadDirection: [1, 0],
      riverDirection: [0, 1],
      spanFt: 82,
      widthFt: 44,
    }]);
  });

  it('reserves fords for narrow water on minor routes and ignores non-crossing runs', () => {
    const crossings = deriveRegionCrossings([{
      routeId: 9,
      centerline: [[0, 50], [100, 50]],
      widthFt: 20,
      kind: 'trail',
    }, {
      routeId: 10,
      centerline: [[0, 120], [100, 120]],
      widthFt: 20,
      kind: 'trail',
    }], [river]);

    expect(crossings).toHaveLength(1);
    expect(crossings[0]).toMatchObject({
      id: 'crossing:9:7:0',
      kind: 'ford',
      roadRouteId: 9,
      riverId: 7,
    });
  });
});

describe('generateRegion', () => {
  let atlas: FmgAtlasResult;

  beforeAll(() => {
    atlas = generateFmgAtlas(SEED, {
      width: 960,
      height: 540,
      cellsDesired: 10000,
      template: 'continents',
    });
  });

  function findLandCellWithRiver(): number {
    const { pack } = atlas;
    for (let i = 0; i < pack.cells.h.length; i++) {
      if (pack.cells.h[i] >= 20 && pack.cells.r && pack.cells.r[i] > 0) {
        return i;
      }
    }
    throw new Error('No land cell with river found');
  }

  function findDifferentLandCell(exclude: number): number {
    const { pack } = atlas;
    for (let i = 0; i < pack.cells.h.length; i++) {
      if (i !== exclude && pack.cells.h[i] >= 30 && pack.cells.h[i] <= 70) {
        return i;
      }
    }
    throw new Error('No different land cell found');
  }

  it('produces deterministic output (same inputs → byte-equal heightfield)', () => {
    const anchor = findLandCellWithRiver();
    const worldPath = rootSeedPath(WORLD_SEED);

    const a = generateRegion(atlas, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL });
    const b = generateRegion(atlas, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL });

    expect(a.heightfield.width).toBe(b.heightfield.width);
    expect(a.heightfield.height).toBe(b.heightfield.height);
    // Byte-equal Float32Array comparison
    for (let i = 0; i < a.heightfield.samples.length; i++) {
      expect(a.heightfield.samples[i]).toBe(b.heightfield.samples[i]);
    }
    // Rivers also deterministic
    expect(a.rivers.length).toBe(b.rivers.length);
    for (let r = 0; r < a.rivers.length; r++) {
      expect(a.rivers[r].centerline).toEqual(b.rivers[r].centerline);
      expect(a.rivers[r].widthFt).toBe(b.rivers[r].widthFt);
    }
  });

  it('matches FROZEN golden values for anchor cell', () => {
    const anchor = findLandCellWithRiver();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(atlas, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL });

    // ── FROZEN GOLDEN VALUES (do not change without owner approval) ──────
    // These pin the determinism contract: any change to the generation
    // algorithm that shifts output must update these explicitly.
    const golden = {
      gridWidth: region.heightfield.width,
      gridHeight: region.heightfield.height,
      /** FNV-1a hash of a strided sample of the heightfield (stability check). */
      heightfieldHash: hashSamples(region.heightfield.samples),
      riverBankCount: region.rivers.length,
      boundsWidth: Math.round(region.bounds.width),
      boundsHeight: Math.round(region.bounds.height),
    };

    // Capture and freeze on first run; subsequent runs must match.
    // If these fail, the generation algorithm changed — update intentionally.
    expect(golden.gridWidth).toBeGreaterThan(10);
    expect(golden.gridHeight).toBeGreaterThan(10);
    expect(golden.heightfieldHash).toBeGreaterThan(0);
    expect(golden.boundsWidth).toBeGreaterThan(0);
    expect(golden.boundsHeight).toBeGreaterThan(0);

    // Frozen snapshot — update these values after verifying algorithm changes
    expect(golden).toMatchSnapshot('region-golden');
  });

  it('no NaN in heightfield samples', () => {
    const anchor = findLandCellWithRiver();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(atlas, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL });

    for (let i = 0; i < region.heightfield.samples.length; i++) {
      expect(Number.isNaN(region.heightfield.samples[i])).toBe(false);
    }
  }, 30_000);

  it('water discipline: samples near water cells stay below water threshold', () => {
    const anchor = findLandCellWithRiver();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(atlas, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL });
    const { pack } = atlas;

    const WATER_THRESHOLD = 0.2;

    // Check samples near known water cells (limit scan to first 500 water cells)
    let checked = 0;
    for (let cellId = 0; cellId < pack.cells.h.length && checked < 500; cellId++) {
      if (pack.cells.h[cellId] < 20) {
        checked++;
        const [cx, cy] = pack.cells.p[cellId];
        const fx = cx * FEET_PER_PIXEL;
        const fy = cy * FEET_PER_PIXEL;

        // Find the nearest sample
        const col = Math.round((fx - region.bounds.x) / region.heightfield.resolutionFt);
        const row = Math.round((fy - region.bounds.y) / region.heightfield.resolutionFt);
        if (col >= 0 && col < region.heightfield.width && row >= 0 && row < region.heightfield.height) {
          const sample = region.heightfield.samples[row * region.heightfield.width + col];
          expect(sample).toBeLessThan(WATER_THRESHOLD);
        }
      }
    }
  }, 30_000);

  it('all river centerline points are inside bounds', () => {
    const anchor = findLandCellWithRiver();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(atlas, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL });

    for (const bank of region.rivers) {
      for (const [x, y] of bank.centerline) {
        // Allow small tolerance for floating point
        expect(x).toBeGreaterThanOrEqual(region.bounds.x - 1);
        expect(x).toBeLessThanOrEqual(region.bounds.x + region.bounds.width + 1);
        expect(y).toBeGreaterThanOrEqual(region.bounds.y - 1);
        expect(y).toBeLessThanOrEqual(region.bounds.y + region.bounds.height + 1);
      }
    }
  });

  it('different anchor cells produce different heightfields', () => {
    const anchor1 = findLandCellWithRiver();
    const anchor2 = findDifferentLandCell(anchor1);
    const worldPath = rootSeedPath(WORLD_SEED);

    const r1 = generateRegion(atlas, anchor1, worldPath, { feetPerPixel: FEET_PER_PIXEL });
    const r2 = generateRegion(atlas, anchor2, worldPath, { feetPerPixel: FEET_PER_PIXEL });

    // Different anchors should produce different fields (at minimum, different bounds)
    const sameBounds =
      Math.abs(r1.bounds.x - r2.bounds.x) < 1 &&
      Math.abs(r1.bounds.y - r2.bounds.y) < 1 &&
      Math.abs(r1.bounds.width - r2.bounds.width) < 1 &&
      Math.abs(r1.bounds.height - r2.bounds.height) < 1;

    // If bounds happen to match (unlikely but possible), check samples differ
    if (sameBounds && r1.heightfield.samples.length === r2.heightfield.samples.length) {
      let sampleDiff = false;
      for (let i = 0; i < r1.heightfield.samples.length; i++) {
        if (Math.abs(r1.heightfield.samples[i] - r2.heightfield.samples[i]) > 0.001) {
          sampleDiff = true;
          break;
        }
      }
      expect(sampleDiff).toBe(true);
    } else {
      // Different bounds = different regions, pass
      expect(true).toBe(true);
    }
  });

  it('townSites and roads are empty arrays in atlas-only mode (C1 compat)', () => {
    const anchor = findLandCellWithRiver();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(atlas, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL });

    expect(region.townSites).toEqual([]);
    expect(region.roads).toEqual([]);
  });

  it('heightfield samples are in valid range [0, 1]', () => {
    const anchor = findLandCellWithRiver();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(atlas, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL });

    for (let i = 0; i < region.heightfield.samples.length; i++) {
      expect(region.heightfield.samples[i]).toBeGreaterThanOrEqual(0);
      expect(region.heightfield.samples[i]).toBeLessThanOrEqual(1);
    }
  }, 30_000);

  it('returns correct artifact layer and schema', () => {
    const anchor = findLandCellWithRiver();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(atlas, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL });

    expect(region.layer).toBe('region');
    expect(region.schemaVersion).toBe(1);
    expect(region.seedPath).toContain(`cell:${anchor}`);
  });

  it('smoothness invariant: heightfield is lattice-smooth, not white-noise speckle', () => {
    const anchor = findLandCellWithRiver();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(atlas, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL });
    const { samples, width, height } = region.heightfield;

    // Laplacian filter: for each interior sample, measure deviation from
    // the mean of its 4 cardinal neighbors. White noise has high Laplacian;
    // lattice-interpolated FBM has bounded Laplacian.
    let laplacianSum = 0;
    let laplacianCount = 0;
    for (let row = 1; row < height - 1; row++) {
      for (let col = 1; col < width - 1; col++) {
        const idx = row * width + col;
        const center = samples[idx];
        const avg = (samples[idx - 1] + samples[idx + 1] +
                     samples[idx - width] + samples[idx + width]) / 4;
        laplacianSum += Math.abs(center - avg);
        laplacianCount++;
      }
    }
    const meanLaplacian = laplacianSum / laplacianCount;

    // For lattice FBM with BASE_CELL_SIZE=30, the mean Laplacian should be
    // well below the white-noise floor (~0.02). Pin at 0.015 — if this fails,
    // the noise is too high-frequency (likely a lattice regression).
    expect(meanLaplacian).toBeLessThan(0.015);

    // Also freeze the Laplacian value for golden stability
    expect(meanLaplacian).toMatchSnapshot('smoothness-laplacian');
  }, 30_000);
});

// ---------------------------------------------------------------------------
// C2: civilization data (town sites + roads)
// ---------------------------------------------------------------------------
describe('generateRegion (C2: civilization)', () => {
  let world: FmgWorldResult;

  beforeAll(() => {
    world = generateFmgWorld(SEED, {
      width: 960,
      height: 540,
      cellsDesired: 10000,
      template: 'continents',
    });
  }, 60_000);

  function findBurgCell(): number {
    const { pack } = world;
    // Find a land cell with a burg
    for (let i = 0; i < pack.cells.h.length; i++) {
      if (pack.cells.burg && pack.cells.burg[i] > 0 && pack.cells.h[i] >= 20) {
        return i;
      }
    }
    throw new Error('No burg cell found');
  }

  it('produces town sites and roads when world is provided', () => {
    const anchor = findBurgCell();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(world, anchor, worldPath, {
      feetPerPixel: FEET_PER_PIXEL,
      world,
    });

    // Should have at least 1 town site (anchor is a burg cell)
    expect(region.townSites.length).toBeGreaterThanOrEqual(1);
    // Roads may or may not pass through (depends on routes near this burg)
    expect(region.roads).toBeDefined();
  }, 30_000);

  it('matches FROZEN golden values for burg-bearing anchor', () => {
    const anchor = findBurgCell();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(world, anchor, worldPath, {
      feetPerPixel: FEET_PER_PIXEL,
      world,
    });

    const golden = {
      townSiteCount: region.townSites.length,
      roadCount: region.roads.length,
      roadKinds: region.roads.map((r) => r.kind).sort(),
      firstEnvelopeWidth: region.townSites.length > 0
        ? Math.round(region.townSites[0].envelope.width) : 0,
      firstGateCount: region.townSites.length > 0
        ? region.townSites[0].gates.length : 0,
    };

    // Basic sanity
    expect(golden.townSiteCount).toBeGreaterThanOrEqual(1);
    expect(golden.firstEnvelopeWidth).toBeGreaterThan(0);

    // FROZEN snapshot
    expect(golden).toMatchSnapshot('c2-region-golden');
  }, 30_000);

  it('determinism: same world + anchor → byte-equal civ data', () => {
    const anchor = findBurgCell();
    const worldPath = rootSeedPath(WORLD_SEED);
    const a = generateRegion(world, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL, world });
    const b = generateRegion(world, anchor, worldPath, { feetPerPixel: FEET_PER_PIXEL, world });

    expect(a.townSites.length).toBe(b.townSites.length);
    for (let i = 0; i < a.townSites.length; i++) {
      expect(a.townSites[i].burgId).toBe(b.townSites[i].burgId);
      expect(a.townSites[i].envelope).toEqual(b.townSites[i].envelope);
      expect(a.townSites[i].gates).toEqual(b.townSites[i].gates);
    }
    expect(a.roads.length).toBe(b.roads.length);
    for (let i = 0; i < a.roads.length; i++) {
      expect(a.roads[i].routeId).toBe(b.roads[i].routeId);
      expect(a.roads[i].kind).toBe(b.roads[i].kind);
      expect(a.roads[i].centerline).toEqual(b.roads[i].centerline);
    }
  }, 30_000);

  it('invariant: all town envelopes are inside region bounds', () => {
    const anchor = findBurgCell();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(world, anchor, worldPath, {
      feetPerPixel: FEET_PER_PIXEL,
      world,
    });

    for (const site of region.townSites) {
      const env = site.envelope;
      // Envelope center must be inside region bounds (edges may overshoot slightly)
      const cx = env.x + env.width / 2;
      const cy = env.y + env.height / 2;
      expect(cx).toBeGreaterThanOrEqual(region.bounds.x - 1);
      expect(cx).toBeLessThanOrEqual(region.bounds.x + region.bounds.width + 1);
      expect(cy).toBeGreaterThanOrEqual(region.bounds.y - 1);
      expect(cy).toBeLessThanOrEqual(region.bounds.y + region.bounds.height + 1);
    }
  }, 30_000);

  it('invariant: gates are on envelope edges', () => {
    const anchor = findBurgCell();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(world, anchor, worldPath, {
      feetPerPixel: FEET_PER_PIXEL,
      world,
    });

    const EDGE_TOLERANCE = 10; // feet — gates should be very close to edge
    for (const site of region.townSites) {
      const env = site.envelope;
      for (const [gx, gy] of site.gates) {
        // Gate must be on or very near one of the 4 envelope edges
        const onLeft = Math.abs(gx - env.x) < EDGE_TOLERANCE;
        const onRight = Math.abs(gx - (env.x + env.width)) < EDGE_TOLERANCE;
        const onTop = Math.abs(gy - env.y) < EDGE_TOLERANCE;
        const onBottom = Math.abs(gy - (env.y + env.height)) < EDGE_TOLERANCE;
        expect(onLeft || onRight || onTop || onBottom).toBe(true);
      }
    }
  }, 30_000);

  it('invariant: all road centerline points are inside region bounds', () => {
    const anchor = findBurgCell();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(world, anchor, worldPath, {
      feetPerPixel: FEET_PER_PIXEL,
      world,
    });

    for (const road of region.roads) {
      for (const [x, y] of road.centerline) {
        expect(x).toBeGreaterThanOrEqual(region.bounds.x - 1);
        expect(x).toBeLessThanOrEqual(region.bounds.x + region.bounds.width + 1);
        expect(y).toBeGreaterThanOrEqual(region.bounds.y - 1);
        expect(y).toBeLessThanOrEqual(region.bounds.y + region.bounds.height + 1);
      }
    }
  }, 30_000);

  it('invariant: roads have correct kind values and positive width', () => {
    const anchor = findBurgCell();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(world, anchor, worldPath, {
      feetPerPixel: FEET_PER_PIXEL,
      world,
    });

    for (const road of region.roads) {
      // 'path' = village forest spurs (road-systems Task 7), 8 ft foot-worn lines.
      expect(['road', 'trail', 'path']).toContain(road.kind);
      expect(road.widthFt).toBeGreaterThan(0);
      // Road wider than trail, trail wider than path
      if (road.kind === 'road') expect(road.widthFt).toBeGreaterThanOrEqual(40);
      if (road.kind === 'trail') expect(road.widthFt).toBeLessThanOrEqual(20);
      if (road.kind === 'path') expect(road.widthFt).toBeLessThanOrEqual(8);
    }
  }, 30_000);

  it('no searoutes become region roads', () => {
    const anchor = findBurgCell();
    const worldPath = rootSeedPath(WORLD_SEED);
    const region = generateRegion(world, anchor, worldPath, {
      feetPerPixel: FEET_PER_PIXEL,
      world,
    });

    // All roads must be 'road' or 'trail' — never searoute
    for (const road of region.roads) {
      expect(road.kind).not.toBe('searoute');
    }
  }, 30_000);

  it('atlas-only (no world) still yields empty civ arrays', () => {
    const { pack } = world;
    // Find a land cell with river from the atlas portion
    let anchor = -1;
    for (let i = 0; i < pack.cells.h.length; i++) {
      if (pack.cells.h[i] >= 20 && pack.cells.r && pack.cells.r[i] > 0) {
        anchor = i;
        break;
      }
    }
    expect(anchor).toBeGreaterThan(-1);

    const worldPath = rootSeedPath(WORLD_SEED);
    // Pass world as atlas (FmgWorldResult extends FmgAtlasResult) but no world option
    const region = generateRegion(world, anchor, worldPath, {
      feetPerPixel: FEET_PER_PIXEL,
    });

    expect(region.townSites).toEqual([]);
    expect(region.roads).toEqual([]);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// Task 11 (MOUNTAINS): window-scale ridge synthesis. After the octave loop and
// BEFORE the clamp pass, a domain-warped ridged world-feet noise adds real peaks
// to high country. Its boost is gated by smoothstep on (baseH − RIDGE_START_N),
// so for baseH ≤ RIDGE_START_N the contribution is EXACTLY 0 — lowland regions
// (towns, low country) are byte-identical. World-seed-keyed + world-feet-indexed,
// mirroring the octave loop, so it is seam-safe by construction.
// ---------------------------------------------------------------------------
describe('generateRegion — mountain ridge synthesis (Task 11)', () => {
  const PROBE_POINTS: Array<[number, number]> = [
    [0, 0], [12345, 67890], [-4000, 9000], [250000, 250000], [1_000_000, 300_000],
  ];

  it('ridge contribution is EXACTLY 0 for baseH ≤ RIDGE_START_N (lowland invariance — hard gate)', () => {
    const ridge = makeMountainRidgeField(0xc0ffee);
    for (let baseH = 0; baseH <= RIDGE_START_N; baseH += 0.02) {
      const bh = Math.min(baseH, RIDGE_START_N);
      for (const [fx, fy] of PROBE_POINTS) {
        expect(ridge(fx, fy, bh)).toBe(0); // samples[i] += 0 ⇒ unchanged
      }
    }
    // The boundary itself (baseH === RIDGE_START_N) is inclusive-invariant.
    for (const [fx, fy] of PROBE_POINTS) expect(ridge(fx, fy, RIDGE_START_N)).toBe(0);
  });

  it('fires above the line and its boost grows monotonically with baseH (gating)', () => {
    const ridge = makeMountainRidgeField(0xc0ffee);
    let anyNonZero = false;
    for (let k = 0; k < 400 && !anyNonZero; k++) {
      if (ridge(k * 137, k * 251, 0.9) !== 0) anyNonZero = true;
    }
    expect(anyNonZero).toBe(true); // high country actually reshapes

    const fx = 8000;
    const fy = 15000;
    const mag = (h: number) => Math.abs(ridge(fx, fy, h));
    expect(mag(RIDGE_START_N)).toBe(0);
    expect(mag(0.9)).toBeGreaterThanOrEqual(mag(0.7));
    expect(mag(0.7)).toBeGreaterThanOrEqual(mag(0.6));
  });

  it('is bounded by RIDGE_AMPLITUDE and finite everywhere', () => {
    const ridge = makeMountainRidgeField(42);
    for (let k = 0; k < 600; k++) {
      const v = ridge(k * 53, k * 97 - 12000, 0.8 + 0.2 * ((k % 11) / 11));
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThanOrEqual(RIDGE_AMPLITUDE + 1e-12);
    }
  });

  it('is deterministic (same world seed → identical) and seed-sensitive (seam-safe convention)', () => {
    const a = makeMountainRidgeField(777);
    const b = makeMountainRidgeField(777);
    for (const [fx, fy] of PROBE_POINTS) {
      expect(a(fx, fy, 0.85)).toBe(b(fx, fy, 0.85));
    }
    const c = makeMountainRidgeField(778);
    let differs = false;
    for (let k = 0; k < 80 && !differs; k++) {
      if (a(k * 111, k * 333, 0.9) !== c(k * 111, k * 333, 0.9)) differs = true;
    }
    expect(differs).toBe(true);
  });
});

/**
 * FNV-1a style hash over a strided sample of the heightfield.
 * Samples every 100th value for a compact stability check.
 */
function hashSamples(samples: Float32Array): number {
  let hash = 0x811c9dc5;
  const stride = Math.max(1, Math.floor(samples.length / 100));
  for (let i = 0; i < samples.length; i += stride) {
    // Convert float to 4-byte int representation for hashing
    const val = Math.round(samples[i] * 10000);
    hash ^= val & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (val >> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Build a tiny atlas whose river path makes one hard right-angle bend inside
 * the fixed region window. The non-river variant keeps every other input the
 * same, so subtracting the two heightfields isolates only the carve pass.
 */
function makeBentRiverAtlas(withRiver: boolean): FmgAtlasResult {
  const cellPoints: Array<[number, number]> = [
    [12.5, 12.5],
    [2.5, 2.5],
    [2.5, 22.5],
    [22.5, 22.5],
    [22.5, 2.5],
  ];

  return {
    seed: SEED,
    grid: {} as FmgAtlasResult['grid'],
    pack: {
      cells: {
        h: Uint8Array.from([70, 70, 70, 70, 70]),
        c: [
          [1, 2, 3, 4],
          [0, 2],
          [0, 1, 3],
          [0, 2, 4],
          [0, 3],
        ],
        p: cellPoints,
        r: Uint16Array.from(withRiver ? [1, 1, 1, 0, 0] : [0, 0, 0, 0, 0]),
      },
      rivers: withRiver
        ? [{ i: 1, cells: [1, 2, 3], discharge: 25, width: 0, source: 1, mouth: 3 }]
        : [],
    },
  } as unknown as FmgAtlasResult;
}

/**
 * Identify heightfield samples changed by river carving by comparing two
 * otherwise identical generated regions. Coordinates are returned in feet so
 * they can be measured against raw and smoothed river polylines.
 */
function collectLoweredSamples(
  carved: RegionArtifact,
  baseline: RegionArtifact,
): Array<[number, number]> {
  const lowered: Array<[number, number]> = [];
  const { width, resolutionFt } = carved.heightfield;
  for (let i = 0; i < carved.heightfield.samples.length; i++) {
    const drop = baseline.heightfield.samples[i] - carved.heightfield.samples[i];
    if (drop <= 0.005) continue;
    const row = Math.floor(i / width);
    const col = i % width;
    lowered.push([
      carved.bounds.x + col * resolutionFt,
      carved.bounds.y + row * resolutionFt,
    ]);
  }
  return lowered;
}

/**
 * Test-local copy of the intended renderer smoothing. It exists only to state
 * the WF-G5 expectation before production exposes a shared helper.
 */
function chaikinSmoothForTest(
  pts: Array<[number, number]>,
  iterations: number,
): Array<[number, number]> {
  let current = pts;
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: Array<[number, number]> = [];
    for (let i = 0; i < current.length - 1; i++) {
      const [ax, ay] = current[i];
      const [bx, by] = current[i + 1];
      smoothed.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25]);
      smoothed.push([ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    current = smoothed;
  }
  return current;
}

/**
 * Average the closest distance from a set of heightfield sample positions to
 * a candidate river path. WF-G5 uses an aggregate metric because exact sample
 * cells can shift by one grid step without changing the visible fix.
 */
function meanDistanceToLine(
  samples: Array<[number, number]>,
  line: Array<[number, number]>,
): number {
  let total = 0;
  for (const [x, y] of samples) {
    let best = Infinity;
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i];
      const [bx, by] = line[i + 1];
      best = Math.min(best, distanceToSegmentForTest(x, y, ax, ay, bx, by));
    }
    total += best;
  }
  return total / Math.max(1, samples.length);
}

/**
 * Measure sample-to-segment distance for the aggregate carve alignment test.
 */
function distanceToSegmentForTest(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.01) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ---------------------------------------------------------------------------
// WF-G3 regression (2026-06-11, orchestrator fix): region bounds must stay
// clamped for ANY land anchor — the live demo found anchors (#1928, #2275)
// whose ring expansion exploded to >150k ft via giant offshore pack cells.
// ---------------------------------------------------------------------------
describe('generateRegion — WF-G3 bounds clamp', () => {
  const ATLAS_OPTS = { width: 960, height: 540, cellsDesired: 10000, template: 'continents' as const };
  // WF-G4 tightened this: bounds are now exactly REGION_SIZE_FT by construction.
  const MAX_EXTENT_FT = 25_000;

  it('the demo-discovered exploding anchors stay bounded', () => {
    const atlas = generateFmgAtlas(SEED, ATLAS_OPTS);
    for (const anchor of [1928, 2275]) {
      const region = generateRegion(atlas, anchor, rootSeedPath(WORLD_SEED), {
        feetPerPixel: FEET_PER_PIXEL,
      });
      expect(region.bounds.width).toBeLessThanOrEqual(MAX_EXTENT_FT);
      expect(region.bounds.height).toBeLessThanOrEqual(MAX_EXTENT_FT);
    }
  });

  it('anchor sweep: every 250th land cell yields clamped bounds', () => {
    const atlas = generateFmgAtlas(SEED, ATLAS_OPTS);
    const heights = (atlas as { pack: { cells: { h: Uint8Array } } }).pack.cells.h;
    let checked = 0;
    for (let id = 0; id < heights.length; id += 250) {
      if (heights[id] < 20) continue; // land anchors only
      const region = generateRegion(atlas, id, rootSeedPath(WORLD_SEED), {
        feetPerPixel: FEET_PER_PIXEL,
      });
      expect(region.bounds.width).toBeLessThanOrEqual(MAX_EXTENT_FT);
      expect(region.bounds.height).toBeLessThanOrEqual(MAX_EXTENT_FT);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  }, 30_000); // ~24 region generations; 5s default flakes under parallel load
});

// ---------------------------------------------------------------------------
// WF-G4 regression (2026-06-11, orchestrator fix): at the CANONICAL scale
// (FEET_PER_FMG_PIXEL ≈ 9,842.52 — the value the live demo passes) a region
// is smaller than one atlas cell. The old member-extent bounds collapsed to
// 0×0 ft with an empty heightfield (black demo canvas); membership clamping
// left IDW a single flat sample. These tests pin the scale-invariant
// contract: bounds are ALWAYS an anchor-centered 25,000 ft square with a
// populated, non-flat heightfield, at any feetPerPixel.
// ---------------------------------------------------------------------------
describe('generateRegion — WF-G4 canonical-scale contract', () => {
  const ATLAS_OPTS = { width: 960, height: 540, cellsDesired: 10000, template: 'continents' as const };
  const CANONICAL_FEET_PER_PIXEL = 9842.51968503937; // adapter/atlasArtifact FEET_PER_FMG_PIXEL

  it('bounds are exactly REGION_SIZE_FT and anchor-centered at canonical scale', () => {
    const atlas = generateFmgAtlas(SEED, ATLAS_OPTS);
    const { pack } = atlas;
    let anchor = -1;
    for (let i = 0; i < pack.cells.h.length; i++) {
      if (pack.cells.h[i] >= 20) { anchor = i; break; }
    }
    const region = generateRegion(atlas, anchor, rootSeedPath(WORLD_SEED), {
      feetPerPixel: CANONICAL_FEET_PER_PIXEL,
    });

    expect(region.bounds.width).toBe(25_000);
    expect(region.bounds.height).toBe(25_000);
    // Seam purity (2026-07-02): the window origin snaps to the 100 ft sample
    // lattice so all regions share one world grid — the center may sit up to
    // resolution/2 from the anchor site.
    const [px, py] = pack.cells.p[anchor];
    expect(Math.abs(region.bounds.x + region.bounds.width / 2 - px * CANONICAL_FEET_PER_PIXEL)).toBeLessThanOrEqual(50);
    expect(Math.abs(region.bounds.y + region.bounds.height / 2 - py * CANONICAL_FEET_PER_PIXEL)).toBeLessThanOrEqual(50);
    expect(region.bounds.x % 100).toBe(0);
    expect(region.bounds.y % 100).toBe(0);
  });

  it('heightfield is populated and non-flat at canonical scale (the black-canvas bug)', () => {
    const atlas = generateFmgAtlas(SEED, ATLAS_OPTS);
    const { pack } = atlas;
    let anchor = -1;
    for (let i = 0; i < pack.cells.h.length; i++) {
      if (pack.cells.h[i] >= 20) { anchor = i; break; }
    }
    const region = generateRegion(atlas, anchor, rootSeedPath(WORLD_SEED), {
      feetPerPixel: CANONICAL_FEET_PER_PIXEL,
    });
    const { samples, width, height } = region.heightfield;

    expect(width).toBe(250); // 25,000 ft / 100 ft default resolution
    expect(height).toBe(250);
    expect(samples.length).toBe(width * height);

    let min = Infinity, max = -Infinity, nanCount = 0;
    for (let i = 0; i < samples.length; i++) {
      if (Number.isNaN(samples[i])) nanCount++;
      if (samples[i] < min) min = samples[i];
      if (samples[i] > max) max = samples[i];
    }
    expect(nanCount).toBe(0);
    // Non-flat: the FBM relief must produce visible variation even when the
    // IDW base inside one cell is nearly constant.
    expect(max - min).toBeGreaterThan(0.005);
  });

  it('bounds are identical across scales (scale-invariance of the window size)', () => {
    const atlas = generateFmgAtlas(SEED, ATLAS_OPTS);
    const { pack } = atlas;
    let anchor = -1;
    for (let i = 0; i < pack.cells.h.length; i++) {
      if (pack.cells.h[i] >= 20) { anchor = i; break; }
    }
    for (const fpp of [CANONICAL_FEET_PER_PIXEL, 1000, 5000]) {
      const region = generateRegion(atlas, anchor, rootSeedPath(WORLD_SEED), { feetPerPixel: fpp });
      expect(region.bounds.width).toBe(25_000);
      expect(region.bounds.height).toBe(25_000);
    }
  });
});

// ---------------------------------------------------------------------------
// Open-region seam continuity (2026-07-01): the relief noise must be a pure
// function of WORLD position, so two regions anchored on adjacent cells produce
// the SAME terrain height at a shared world point. Otherwise the open-world
// streamer shows a cliff wherever it hands off from one region to the next.
//
// Isolation: a flat, all-equal-height atlas makes the IDW base identical
// everywhere (weighted average of equal values), so any height difference at a
// shared world point comes purely from the relief noise — exactly what this fix
// targets.
// ---------------------------------------------------------------------------
describe('generateRegion — cross-region seam continuity', () => {
  /** Grid of equal-height land cells with 4-neighbour adjacency. */
  function makeFlatGridAtlas(cols: number, rows: number, spacingPx: number, h: number): FmgAtlasResult {
    const n = cols * rows;
    const p: Array<[number, number]> = [];
    const c: number[][] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        p.push([(col + 1) * spacingPx, (row + 1) * spacingPx]);
        const neigh: number[] = [];
        if (col > 0) neigh.push(row * cols + (col - 1));
        if (col < cols - 1) neigh.push(row * cols + (col + 1));
        if (row > 0) neigh.push((row - 1) * cols + col);
        if (row < rows - 1) neigh.push((row + 1) * cols + col);
        c.push(neigh);
      }
    }
    return {
      seed: SEED,
      grid: {} as FmgAtlasResult['grid'],
      pack: {
        cells: {
          h: Uint8Array.from(new Array(n).fill(h)),
          c,
          p,
          r: Uint16Array.from(new Array(n).fill(0)),
        },
        rivers: [],
      },
    } as unknown as FmgAtlasResult;
  }

  /** Bilinear sample of a region's normalized heightfield at a world point. */
  function sampleAt(region: RegionArtifact, fx: number, fy: number): number {
    const hf = region.heightfield;
    const gx = Math.min(Math.max((fx - region.bounds.x) / hf.resolutionFt, 0), hf.width - 1.001);
    const gy = Math.min(Math.max((fy - region.bounds.y) / hf.resolutionFt, 0), hf.height - 1.001);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const s = (xi: number, yi: number) => hf.samples[yi * hf.width + xi];
    const a = s(x0, y0) * (1 - tx) + s(x0 + 1, y0) * tx;
    const b = s(x0, y0 + 1) * (1 - tx) + s(x0 + 1, y0 + 1) * tx;
    return a * (1 - ty) + b * ty;
  }

  it('adjacent regions agree on terrain height at shared world points', () => {
    const atlas = makeFlatGridAtlas(11, 11, 10, 70);
    const worldPath = rootSeedPath(WORLD_SEED);
    const opts = { feetPerPixel: 1000 };

    // Anchors on horizontally-adjacent cells (col5 and col6 of row5): their
    // 25,000 ft windows overlap, so shared world points exist in both.
    const regionA = generateRegion(atlas, 5 * 11 + 5, worldPath, opts);
    const regionB = generateRegion(atlas, 5 * 11 + 6, worldPath, opts);

    // Points inside the overlap of both windows (x∈[57500,72500], y∈[47500,72500]).
    const sharedPoints: Array<[number, number]> = [
      [65000, 60000],
      [60000, 55000],
      [70000, 65000],
      [62000, 50000],
      [68000, 70000],
    ];

    for (const [fx, fy] of sharedPoints) {
      const hA = sampleAt(regionA, fx, fy);
      const hB = sampleAt(regionB, fx, fy);
      expect(Math.abs(hA - hB)).toBeLessThan(0.01);
    }
  });
});

// ---------------------------------------------------------------------------
// WF-G5 regression (2026-06-12): river carving must follow the same smoothed
// band the region renderer draws. The test builds a sharp L-bend where the raw
// polyline and the Chaikin-smoothed line are far enough apart to measure.
// ---------------------------------------------------------------------------
describe('generateRegion — WF-G5 smoothed river carve', () => {
  it('carves lowered samples closer to the smoothed bend than the raw centerline', () => {
    const atlasWithRiver = makeBentRiverAtlas(true);
    const atlasWithoutRiver = makeBentRiverAtlas(false);
    const worldPath = rootSeedPath(WORLD_SEED);
    const opts = { feetPerPixel: 1000, resolutionFt: 250 };

    const carved = generateRegion(atlasWithRiver, 0, worldPath, opts);
    const baseline = generateRegion(atlasWithoutRiver, 0, worldPath, opts);
    const river = carved.rivers[0];
    expect(river).toBeDefined();

    const rawLine: Array<[number, number]> = [
      [2500, 2500],
      [2500, 22500],
      [22500, 22500],
    ];
    const smoothedLine = chaikinSmoothForTest(rawLine, 3);
    const carvedSamples = collectLoweredSamples(carved, baseline);

    // The synthetic bend has enough lowered cells to make an aggregate
    // distance stable while still catching the raw-vs-smoothed channel shift.
    expect(carvedSamples.length).toBeGreaterThan(10);
    expect(meanDistanceToLine(carvedSamples, smoothedLine)).toBeLessThan(
      meanDistanceToLine(carvedSamples, rawLine),
    );
  });
});
