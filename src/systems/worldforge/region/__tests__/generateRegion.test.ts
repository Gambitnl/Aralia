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
import { generateRegion } from '../generateRegion';
import { rootSeedPath, fnv1a } from '../../seedPath';
import { boundsContain } from '../../units';
import type { FmgAtlasResult } from '../../fmg/generateAtlas';
import type { FmgWorldResult } from '../../fmg/generateWorld';
import type { RegionArtifact } from '../../artifacts';

const SEED = 'world-42';
const WORLD_SEED = 42;
const FEET_PER_PIXEL = 1000; // plausible test value (Lane B wires canonical)

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
      expect(['road', 'trail']).toContain(road.kind);
      expect(road.widthFt).toBeGreaterThan(0);
      // Road wider than trail
      if (road.kind === 'road') expect(road.widthFt).toBeGreaterThanOrEqual(40);
      if (road.kind === 'trail') expect(road.widthFt).toBeLessThanOrEqual(20);
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
  });
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
    const [px, py] = pack.cells.p[anchor];
    expect(region.bounds.x + region.bounds.width / 2).toBeCloseTo(px * CANONICAL_FEET_PER_PIXEL, 4);
    expect(region.bounds.y + region.bounds.height / 2).toBeCloseTo(py * CANONICAL_FEET_PER_PIXEL, 4);
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
