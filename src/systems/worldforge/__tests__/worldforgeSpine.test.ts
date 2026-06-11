/**
 * @file worldforgeSpine.test.ts — golden-seed regression tests for the
 * Worldforge generation spine (build-order item 1).
 *
 * THE GOLDEN VALUES IN THIS FILE ARE FROZEN PERSISTENCE CONTRACTS
 * (SPEC.md §4, decision #14): seed paths address saved worlds, so a change
 * that breaks these assertions silently regenerates every player's world
 * differently. If a test here fails after a refactor, the refactor is wrong —
 * do not update the constants without an explicit owner-approved world-break
 * decision recorded in docs/projects/worldforge/DECISIONS.md.
 */
import {
  CELL_FT,
  FEET_PER_METER,
  boundsCenter,
  boundsContain,
  feetFromMeters,
  metersFromFeet,
  snapToCell,
} from '../units';
import {
  childSeedPath,
  fnv1a,
  makeSeedPath,
  rngFromPath,
  rootSeedPath,
  seedFromPath,
  streamPath,
} from '../seedPath';
import { WORLDFORGE_SCHEMA_VERSION } from '../artifacts';
import {
  clearGenerators,
  getGenerator,
  makeArtifactEnvelope,
  registerGenerator,
} from '../generate';

describe('worldforge spine — units (feet canon)', () => {
  it('defines the 5 ft atomic cell', () => {
    expect(CELL_FT).toBe(5);
  });

  it('meters shim is the exact international conversion and round-trips', () => {
    expect(feetFromMeters(0.3048)).toBeCloseTo(1, 12);
    expect(metersFromFeet(1)).toBeCloseTo(0.3048, 12);
    expect(metersFromFeet(feetFromMeters(12345.678))).toBeCloseTo(12345.678, 8);
    expect(FEET_PER_METER).toBeCloseTo(3.28083989501, 9);
  });

  it('snapToCell snaps to the 5 ft grid', () => {
    expect(snapToCell(0)).toBe(0);
    expect(snapToCell(7.4)).toBe(5);
    expect(snapToCell(7.6)).toBe(10);
    expect(snapToCell(-3)).toBe(-5);
  });

  it('bounds helpers behave', () => {
    const b = { x: 100, y: 200, width: 50, height: 20 };
    expect(boundsCenter(b)).toEqual({ x: 125, y: 210 });
    expect(boundsContain(b, 100, 200)).toBe(true); // inclusive min edge
    expect(boundsContain(b, 150, 210)).toBe(false); // exclusive max edge
    expect(boundsContain(b, 125, 219.999)).toBe(true);
  });
});

describe('worldforge spine — seed paths (FROZEN golden values)', () => {
  it('builds hierarchical paths', () => {
    expect(rootSeedPath(1337)).toBe('wf:1337');
    expect(makeSeedPath(1337, 'cell:71-8')).toBe('wf:1337/cell:71-8');
    expect(makeSeedPath(1337, 'cell:71-8', 'local:2-1')).toBe(
      'wf:1337/cell:71-8/local:2-1',
    );
    expect(childSeedPath('wf:1337', 'cell:71-8')).toBe('wf:1337/cell:71-8');
    expect(streamPath('wf:1337/cell:71-8/local:2-1', 'vegetation')).toBe(
      'wf:1337/cell:71-8/local:2-1/s:vegetation',
    );
  });

  it('rejects segments containing the separator', () => {
    expect(() => childSeedPath('wf:1', 'bad/segment')).toThrow();
    expect(() => childSeedPath('wf:1', '')).toThrow();
  });

  it('GOLDEN: fnv1a and seedFromPath are frozen', () => {
    expect(fnv1a('wf:1337')).toBe(2277731204);
    expect(seedFromPath('wf:1337')).toBe(130247559);
    expect(seedFromPath('wf:1337/cell:71-8')).toBe(2073839975);
    expect(seedFromPath('wf:1337/cell:71-8/local:2-1')).toBe(676371581);
    expect(seedFromPath('wf:1337/cell:71-8/local:2-1/s:vegetation')).toBe(843063001);
  });

  it('GOLDEN: rngFromPath produces the frozen Park-Miller stream', () => {
    const rng = rngFromPath('wf:1337/cell:71-8/local:2-1');
    expect(rng.next()).toBeCloseTo(0.533749487282475, 14);
    expect(rng.next()).toBeCloseTo(0.7276364054788244, 14);
    expect(rng.next()).toBeCloseTo(0.3850690139318528, 14);
    expect(rng.next()).toBeCloseTo(0.8549219652590546, 14);
  });

  it('same path → identical stream; sibling paths → different streams', () => {
    const a1 = rngFromPath(makeSeedPath(42, 'cell:1-1'));
    const a2 = rngFromPath(makeSeedPath(42, 'cell:1-1'));
    const b = rngFromPath(makeSeedPath(42, 'cell:1-2'));
    const seqA1 = [a1.next(), a1.next(), a1.next()];
    const seqA2 = [a2.next(), a2.next(), a2.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA1).toEqual(seqA2);
    expect(seqA1).not.toEqual(seqB);
  });

  it('named sub-streams are independent of each other', () => {
    const base = makeSeedPath(7, 'cell:3-3', 'local:0-0');
    const veg = rngFromPath(streamPath(base, 'vegetation'));
    const water = rngFromPath(streamPath(base, 'water'));
    expect(veg.next()).not.toBe(water.next());
  });

  it('seedFromPath stays inside the Park-Miller domain [1, 2147483646]', () => {
    // Sample a spread of paths including ones engineered toward edge hashes.
    for (let i = 0; i < 500; i++) {
      const s = seedFromPath(makeSeedPath(i, `cell:${i}-${i * 7}`));
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(2147483646);
    }
  });
});

describe('worldforge spine — generator registry & envelope', () => {
  afterEach(() => clearGenerators());

  it('registers and retrieves a generator by layer', () => {
    const bounds = { x: 0, y: 0, width: 3000, height: 3000 };
    const dummy = {
      layer: 'local' as const,
      generate: (_parent: never, seedPath: string) => ({
        ...makeArtifactEnvelope('local', seedPath, bounds),
        layer: 'local' as const,
        terrain: {
          widthCells: 1,
          heightCells: 1,
          elevationFt: new Float32Array(1),
          materialIndex: new Uint8Array(1),
          materials: ['grass' as const],
        },
        features: [],
      }),
    };
    registerGenerator(dummy);
    const got = getGenerator('local');
    expect(got).toBeDefined();
    const artifact = got!.generate(null, 'wf:1/cell:0-0/local:0-0', bounds);
    expect(artifact.layer).toBe('local');
    expect(artifact.schemaVersion).toBe(WORLDFORGE_SCHEMA_VERSION);
    expect(artifact.seedPath).toBe('wf:1/cell:0-0/local:0-0');
    expect(artifact.bounds).toEqual(bounds);
  });

  it('returns undefined for unregistered layers and clears cleanly', () => {
    expect(getGenerator('atlas')).toBeUndefined();
  });
});
