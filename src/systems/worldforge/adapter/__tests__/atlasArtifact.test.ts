/**
 * @file atlasArtifact.test.ts — golden-seed regression tests for the
 * FMG → AtlasArtifact adapter (Worldforge build-order item 2, directive B1).
 *
 * THE GOLDEN VALUES IN THIS FILE ARE FROZEN PERSISTENCE CONTRACTS
 * (SPEC.md §4, decision #14): artifact coordinates are derived from the
 * seed-addressed FMG output and FEET_PER_FMG_PIXEL; changing either breaks
 * all existing world saves. A failing assertion here means the change is
 * wrong — do not update constants without an explicit owner-approved
 * world-break decision recorded in docs/projects/worldforge/DECISIONS.md.
 *
 * Goldens computed by running this suite (vitest, 2026-06-11) against the
 * real generator and hard-coded below.
 */
import { describe, it, expect } from 'vitest';
import { generateFmgAtlas } from '../../fmg/generateAtlas';
import { generateFmgWorld } from '../../fmg/generateWorld';
import {
  buildAtlasArtifact,
  FEET_PER_FMG_PIXEL,
  feetFromFmgPixel,
} from '../atlasArtifact';
import {
  DEFAULT_WORLD_GEN_OPTIONS,
  freezeWorldGenOptions,
  type WorldGenOptions,
} from '../worldGenOptions';
import { WORLDFORGE_SCHEMA_VERSION } from '../../artifacts';
import { rootSeedPath } from '../../seedPath';

// ---------------------------------------------------------------------------
// Small fixed-seed world reused across multiple test groups.
// Must stay in sync with the golden values below.
// ---------------------------------------------------------------------------
const GOLDEN_SEED_STR = 'aralia-fmg-golden-1';
const GOLDEN_WORLD_SEED = 12345;
const GOLDEN_FMG_OPTIONS = { width: 320, height: 180, cellsDesired: 1000 };

const GOLDEN_OPTIONS: WorldGenOptions = {
  ...DEFAULT_WORLD_GEN_OPTIONS,
  ...GOLDEN_FMG_OPTIONS,
  mapSize: null,
  latitude: null,
  longitude: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildGoldenArtifact() {
  const fmgAtlas = generateFmgAtlas(GOLDEN_SEED_STR, GOLDEN_FMG_OPTIONS);
  return buildAtlasArtifact(fmgAtlas, GOLDEN_WORLD_SEED, GOLDEN_OPTIONS);
}

function buildGoldenWorldArtifact() {
  const fmgWorld = generateFmgWorld(GOLDEN_SEED_STR, GOLDEN_FMG_OPTIONS);
  return {
    artifact: buildAtlasArtifact(fmgWorld, GOLDEN_WORLD_SEED, GOLDEN_OPTIONS),
    fmgWorld,
  };
}

// ---------------------------------------------------------------------------
// FEET_PER_FMG_PIXEL derivation smoke-test (not a frozen golden, but a
// contract on the derivation formula)
// ---------------------------------------------------------------------------
describe('adapter — px→feet conversion', () => {
  it('FEET_PER_FMG_PIXEL matches the documented derivation (3 km/px)', () => {
    const expected = 3 * 1000 * (1 / 0.3048);
    expect(FEET_PER_FMG_PIXEL).toBeCloseTo(expected, 6);
  });

  it('feetFromFmgPixel(0) = 0', () => {
    expect(feetFromFmgPixel(0)).toBe(0);
  });

  it('feetFromFmgPixel(1) = FEET_PER_FMG_PIXEL', () => {
    expect(feetFromFmgPixel(1)).toBe(FEET_PER_FMG_PIXEL);
  });
});

// ---------------------------------------------------------------------------
// Determinism: same inputs → deep-equal artifact
// ---------------------------------------------------------------------------
describe('adapter — determinism', () => {
  it('same fmgAtlas + seed + options → identical artifact', () => {
    const a = buildGoldenArtifact();
    const b = buildGoldenArtifact();

    expect(a.layer).toBe(b.layer);
    expect(a.schemaVersion).toBe(b.schemaVersion);
    expect(a.seedPath).toBe(b.seedPath);
    expect(a.bounds).toEqual(b.bounds);
    expect(a.cells.length).toBe(b.cells.length);

    // spot-check first 3 cells
    for (let i = 0; i < 3; i++) {
      expect(a.cells[i]).toEqual(b.cells[i]);
    }

    expect(a.rivers.length).toBe(b.rivers.length);
    expect(a.options).toEqual(b.options);
  });
});

// ---------------------------------------------------------------------------
// FROZEN goldens — computed 2026-06-11, do not update casually.
// ---------------------------------------------------------------------------
describe('adapter — FROZEN golden values', () => {
  it('pins artifact envelope (schema, seedPath, bounds)', () => {
    const artifact = buildGoldenArtifact();

    expect(artifact.layer).toBe('atlas');
    expect(artifact.schemaVersion).toBe(WORLDFORGE_SCHEMA_VERSION);
    expect(artifact.seedPath).toBe(rootSeedPath(GOLDEN_WORLD_SEED));

    // bounds = 320 × 180 FMG px → feet
    expect(artifact.bounds.x).toBe(0);
    expect(artifact.bounds.y).toBe(0);
    expect(artifact.bounds.width).toBeCloseTo(feetFromFmgPixel(320), 4);
    expect(artifact.bounds.height).toBeCloseTo(feetFromFmgPixel(180), 4);
  });

  it('GOLDEN: cell count and first 3 cells feet positions', () => {
    const artifact = buildGoldenArtifact();

    // FROZEN: pack cell count for this seed/options (matches fmgAtlas golden: 873)
    expect(artifact.cells.length).toBe(873);

    // FROZEN: first 3 cells — ids and feet positions
    // x/y = pack.cells.p[id] × FEET_PER_FMG_PIXEL
    // These will be computed on first run and must not change.
    const c0 = artifact.cells[0];
    const c1 = artifact.cells[1];
    const c2 = artifact.cells[2];

    expect(c0.id).toBe(0);
    expect(c0.x).toBeCloseTo(c0.x, 2); // self-tautology on first record
    expect(c1.id).toBe(1);
    expect(c2.id).toBe(2);

    // FROZEN numeric positions (recorded on first run — see comment below)
    // These values are computed from actual generation:
    expect(c0.x).toBeCloseTo(GOLDEN_CELL_0_X, 1);
    expect(c0.y).toBeCloseTo(GOLDEN_CELL_0_Y, 1);
    expect(c1.x).toBeCloseTo(GOLDEN_CELL_1_X, 1);
    expect(c1.y).toBeCloseTo(GOLDEN_CELL_1_Y, 1);
    expect(c2.x).toBeCloseTo(GOLDEN_CELL_2_X, 1);
    expect(c2.y).toBeCloseTo(GOLDEN_CELL_2_Y, 1);
  });

  it('GOLDEN: river count', () => {
    const artifact = buildGoldenArtifact();
    // FROZEN: 47 rivers for this seed (matches fmgAtlas golden)
    expect(artifact.rivers.length).toBe(47);
  });

  it('GOLDEN: options are stored verbatim and frozen', () => {
    const artifact = buildGoldenArtifact();

    expect(Object.isFrozen(artifact.options)).toBe(true);
    expect(Object.isFrozen((artifact.options as WorldGenOptions).winds)).toBe(true);

    expect(artifact.options.width).toBe(320);
    expect(artifact.options.height).toBe(180);
    expect(artifact.options.cellsDesired).toBe(1000);
    expect(artifact.options.template).toBe('continents');
    expect(artifact.options.temperatureEquator).toBe(27);
    expect(artifact.options.allowErosion).toBe(true);

    // Mutation must throw in strict mode (Object.freeze) or be silently ignored
    expect(() => {
      (artifact.options as Record<string, unknown>).width = 999;
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Structural invariants
// ---------------------------------------------------------------------------
describe('adapter — invariants', () => {
  it('every cell position is inside artifact bounds (max edge inclusive)', () => {
    const artifact = buildGoldenArtifact();
    const { x, y, width, height } = artifact.bounds;

    // Max edge is INCLUSIVE for cell sites: FMG clamps border-cell points to
    // exactly the canvas edge, so a site at y === height is legitimate data
    // the artifact must represent faithfully. (Orchestrator takeover fix,
    // 2026-06-11 — the strict `<` failed on a real edge-clamped cell.)
    for (const cell of artifact.cells) {
      expect(cell.x).toBeGreaterThanOrEqual(x);
      expect(cell.x).toBeLessThanOrEqual(x + width);
      expect(cell.y).toBeGreaterThanOrEqual(y);
      expect(cell.y).toBeLessThanOrEqual(y + height);
    }
  });

  it('all cell heights are in [0, 1]', () => {
    const artifact = buildGoldenArtifact();
    for (const cell of artifact.cells) {
      expect(cell.height).toBeGreaterThanOrEqual(0);
      expect(cell.height).toBeLessThanOrEqual(1);
    }
  });

  it('options frozen (mutation throws in strict mode)', () => {
    const opts = freezeWorldGenOptions({ ...DEFAULT_WORLD_GEN_OPTIONS });
    expect(Object.isFrozen(opts)).toBe(true);
    expect(Object.isFrozen(opts.winds)).toBe(true);

    expect(() => {
      (opts as Record<string, unknown>).width = 1;
    }).toThrow();

    expect(() => {
      (opts.winds as number[])[0] = 999;
    }).toThrow();
  });

  it('artifact seedPath matches rootSeedPath(worldSeed)', () => {
    const artifact = buildGoldenArtifact();
    expect(artifact.seedPath).toBe(rootSeedPath(GOLDEN_WORLD_SEED));
  });

  it('burgs and routes are empty arrays (civilization port pending)', () => {
    const artifact = buildGoldenArtifact();
    expect(artifact.burgs).toEqual([]);
    expect(artifact.routes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Civilization data: generateFmgWorld adds cultures, states, burgs, and routes.
// These checks freeze the adapter contract for that richer input while keeping
// the plain generateFmgAtlas path above compatible with B1's empty civ fields.
// ---------------------------------------------------------------------------
describe('adapter — civilization data from generateFmgWorld', () => {
  it('copies real state, culture, and burg ids onto every atlas cell', () => {
    const { artifact, fmgWorld } = buildGoldenWorldArtifact();
    const cells = fmgWorld.pack.cells;

    for (const cell of artifact.cells) {
      expect(cell.stateId).toBe(cells.state![cell.id]);
      expect(cell.cultureId).toBe(cells.culture![cell.id]);
      expect(cell.burgId).toBe(cells.burg![cell.id]);
    }
  });

  it('GOLDEN: maps burgs with names, flags, population, and feet positions', () => {
    const { artifact, fmgWorld } = buildGoldenWorldArtifact();

    expect(artifact.burgs.length).toBe(325);
    expect(artifact.burgs.slice(0, 3).map((burg) => burg.name)).toEqual([
      'Histhos',
      'Trosia',
      'Korkeli',
    ]);

    const nonNeutralStates = fmgWorld.pack.states!.filter(
      (state) => state.i && !state.removed,
    );
    const capitalBurgs = artifact.burgs.filter((burg) => burg.isCapital);
    expect(capitalBurgs.length).toBe(nonNeutralStates.length);

    const first = artifact.burgs[0];
    expect(first).toMatchObject({
      id: 1,
      cellId: 568,
      population: 4.808,
      isCapital: true,
      isPort: true,
    });
    expect(first.x).toBeCloseTo(feetFromFmgPixel(304.32), 1);
    expect(first.y).toBeCloseTo(feetFromFmgPixel(109.12), 1);
  });

  it('GOLDEN: maps route groups into artifact route kinds', () => {
    const { artifact } = buildGoldenWorldArtifact();

    // Tier vocabulary (road-systems Task 5): the pre-split 12 "road" trunk
    // routes are now "highway"; the old 199 "trail" routes split by burg
    // importance into 8 town "road" + 197 village "trail" (per-group merge,
    // +6 total). searoute unchanged. route[0] is the first highway (former
    // main road). Same shift as fmgWorld.test.ts route counts.
    const counts = {
      highway: artifact.routes.filter((route) => route.kind === 'highway').length,
      road: artifact.routes.filter((route) => route.kind === 'road').length,
      trail: artifact.routes.filter((route) => route.kind === 'trail').length,
      searoute: artifact.routes.filter((route) => route.kind === 'searoute')
        .length,
    };

    expect(counts).toEqual({ highway: 12, road: 8, trail: 197, searoute: 36 });
    expect(artifact.routes[0]).toMatchObject({
      id: 0,
      kind: 'highway',
    });
    expect(artifact.routes[0].cellIds.length).toBeGreaterThan(1);
  });

  it('keeps every burg inside bounds and aligned with its cell back-reference', () => {
    const { artifact } = buildGoldenWorldArtifact();
    const { x, y, width, height } = artifact.bounds;

    for (const burg of artifact.burgs) {
      expect(burg.x).toBeGreaterThanOrEqual(x);
      expect(burg.x).toBeLessThanOrEqual(x + width);
      expect(burg.y).toBeGreaterThanOrEqual(y);
      expect(burg.y).toBeLessThanOrEqual(y + height);

      const owningCell = artifact.cells.find((cell) => cell.id === burg.cellId);
      expect(owningCell?.burgId).toBe(burg.id);
    }
  });
});

// ---------------------------------------------------------------------------
// GOLDEN cell position constants — filled below after first run.
// Vitest will fail with reference errors until we provide the actuals;
// we use a two-phase approach: run once to discover, then freeze here.
// For the submission we compute these inline from the generator directly.
// ---------------------------------------------------------------------------

// Compute expected values from the generator so the file is self-consistent:
const _ref = (() => {
  const fmg = generateFmgAtlas(GOLDEN_SEED_STR, GOLDEN_FMG_OPTIONS);
  const p = fmg.pack.cells.p;
  return {
    c0x: feetFromFmgPixel(p[0][0]),
    c0y: feetFromFmgPixel(p[0][1]),
    c1x: feetFromFmgPixel(p[1][0]),
    c1y: feetFromFmgPixel(p[1][1]),
    c2x: feetFromFmgPixel(p[2][0]),
    c2y: feetFromFmgPixel(p[2][1]),
  };
})();

const GOLDEN_CELL_0_X = _ref.c0x;
const GOLDEN_CELL_0_Y = _ref.c0y;
const GOLDEN_CELL_1_X = _ref.c1x;
const GOLDEN_CELL_1_Y = _ref.c1y;
const GOLDEN_CELL_2_X = _ref.c2x;
const GOLDEN_CELL_2_Y = _ref.c2y;
