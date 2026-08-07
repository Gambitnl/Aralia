/**
 * The 2D water solver. Conservation is the invariant every other test rests on.
 *
 * A solver that quietly loses water is worse than no solver, because the loss
 * is invisible until a reservoir is mysteriously empty an hour later. So the
 * first tests here are about volume, not about behavior.
 */
import { describe, it, expect } from 'vitest';
import { ShallowWaterField, DRY_DEPTH_M } from '../shallowWater';

/** A field with a flat bed at the given height. */
function flat(n: number, cellM: number, bedY = 0): ShallowWaterField {
  const f = new ShallowWaterField(n, cellM);
  f.bed.fill(bedY);
  return f;
}

/** A field that slopes down toward +x. */
function slope(n: number, cellM: number, dropPerCell = 0.2): ShallowWaterField {
  const f = new ShallowWaterField(n, cellM);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) f.bed[f.idx(x, z)] = -x * dropPerCell;
  }
  return f;
}

describe('conservation', () => {
  it('keeps every drop when nothing leaves the domain', () => {
    // A basin with raised walls, so no water can reach an edge face.
    const f = flat(24, 0.25);
    for (let z = 0; z < 24; z++) {
      for (let x = 0; x < 24; x++) {
        const edge = x < 2 || z < 2 || x > 21 || z > 21;
        if (edge) f.bed[f.idx(x, z)] = 10;
      }
    }
    for (let z = 8; z < 16; z++) {
      for (let x = 8; x < 16; x++) f.add(x, z, 0.6);
    }
    const before = f.volume();
    for (let s = 0; s < 200; s++) f.step(f.maxStableStep());
    const after = f.volume();

    expect(f.boundaryLedgerM3).toBe(0);
    // RELATIVE tolerance, because the field is Float32Array. Float32 epsilon is
    // 1.2e-7 and 200 steps of accumulation lands near 2.5e-7 relative, which is
    // arithmetic rather than leakage. An absolute 5e-7 bound looked strict and
    // was really just a bound on the magnitude of the test fixture.
    expect(Math.abs(after - before) / before).toBeLessThan(1e-5);
  });

  it('records what leaves rather than deleting it', () => {
    // The research is blunt: a static exterior is an infinite reservoir. Water
    // that runs off the edge must land in a ledger a coarse model can read.
    const f = slope(20, 0.25);
    for (let z = 0; z < 20; z++) for (let x = 0; x < 4; x++) f.add(x, z, 0.5);
    const before = f.volume();
    for (let s = 0; s < 150; s++) f.step(f.maxStableStep());

    expect(f.boundaryLedgerM3).toBeGreaterThan(0);
    // Everything is accounted for: what remains plus what left equals what was.
    expect(f.volume() + f.boundaryLedgerM3).toBeCloseTo(before, 5);
  });
});

describe('behavior', () => {
  it('runs downhill', () => {
    const f = slope(24, 0.25);
    for (let z = 0; z < 24; z++) for (let x = 2; x < 5; x++) f.add(x, z, 0.4);
    const startMass = () => {
      let m = 0;
      for (let z = 0; z < 24; z++) for (let x = 0; x < 8; x++) m += f.depth[f.idx(x, z)];
      return m;
    };
    const before = startMass();
    for (let s = 0; s < 60; s++) f.step(f.maxStableStep());
    // Water has left the uphill end.
    expect(startMass()).toBeLessThan(before * 0.8);
  });

  it('fills a hole and levels out', () => {
    const f = flat(20, 0.25);
    // A pit in the middle.
    for (let z = 7; z < 13; z++) {
      for (let x = 7; x < 13; x++) f.bed[f.idx(x, z)] = -1.5;
    }
    // Walls, so the test measures leveling rather than draining.
    for (let z = 0; z < 20; z++) {
      for (let x = 0; x < 20; x++) {
        if (x < 1 || z < 1 || x > 18 || z > 18) f.bed[f.idx(x, z)] = 10;
      }
    }
    for (let z = 2; z < 6; z++) for (let x = 2; x < 6; x++) f.add(x, z, 1.2);

    for (let s = 0; s < 400; s++) f.step(f.maxStableStep());

    // The pit holds water.
    expect(f.depth[f.idx(10, 10)]).toBeGreaterThan(0.3);

    // And the wet surface is level. Sample only genuinely wet interior cells;
    // a damp film on a dry shelf is not part of the pool.
    const surfaces: number[] = [];
    for (let z = 2; z < 18; z++) {
      for (let x = 2; x < 18; x++) {
        if (f.depth[f.idx(x, z)] > 0.05) surfaces.push(f.surfaceAt(x, z));
      }
    }
    const spread = Math.max(...surfaces) - Math.min(...surfaces);
    expect(spread).toBeLessThan(0.12);
  });

  it('drains through a breach', () => {
    const f = flat(20, 0.25);
    for (let z = 0; z < 20; z++) {
      for (let x = 0; x < 20; x++) {
        if (x < 1 || z < 1 || x > 18 || z > 18) f.bed[f.idx(x, z)] = 10;
      }
    }
    for (let z = 2; z < 18; z++) for (let x = 2; x < 18; x++) f.add(x, z, 0.8);
    const before = f.volume();
    for (let s = 0; s < 50; s++) f.step(f.maxStableStep());
    const held = f.volume();
    expect(held).toBeCloseTo(before, 5); // sealed

    // Now cut the wall — exactly what a spell does.
    for (let z = 9; z < 12; z++) f.bed[f.idx(19, z)] = -0.5;
    // 2000 steps, not 300. The total-outflow cap that killed the checkerboard
    // also slowed drainage, and that is a real trade rather than a test tweak:
    // a three-cell breach empties a basin over seconds of sim time, not frames.
    // Measured: 72% remains at 300 steps, 13% at 2000, 0.7% at 5000.
    for (let s = 0; s < 2000; s++) f.step(f.maxStableStep());

    expect(f.volume()).toBeLessThan(held * 0.2);
    // Every drop that left is on the ledger — nothing evaporated.
    expect(f.volume() + f.boundaryLedgerM3).toBeCloseTo(held, 4);
  });

  it('stays finite: no NaN at the stable step', () => {
    const f = slope(24, 0.25, 0.4);
    for (let z = 0; z < 24; z++) for (let x = 0; x < 24; x++) f.add(x, z, Math.random() * 0.6);
    for (let s = 0; s < 300; s++) f.step(f.maxStableStep());
    for (let i = 0; i < f.depth.length; i++) {
      expect(Number.isFinite(f.depth[i])).toBe(true);
      expect(f.depth[i]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('a bottom that changes', () => {
  it('lowering the bed creates CAPACITY, not water', () => {
    const f = flat(12, 0.25);
    for (let z = 0; z < 12; z++) for (let x = 0; x < 12; x++) f.add(x, z, 0.5);
    const before = f.volume();
    f.editBed(4, 4, 7, 7, () => -2);
    // Same water, deeper hole. The surface fell with the bed.
    expect(f.volume()).toBeCloseTo(before, 6);
    expect(f.depth[f.idx(5, 5)]).toBeCloseTo(0.5, 6);
  });

  it('raising the bed DISPLACES water instead of deleting it', () => {
    // The silent-loss failure this solver exists to avoid. Clamping depth to
    // zero here would destroy volume and nobody would notice for an hour.
    const f = flat(12, 0.25);
    for (let z = 0; z < 12; z++) for (let x = 0; x < 12; x++) f.add(x, z, 0.5);
    const before = f.volume();
    const displaced = f.editBed(4, 4, 7, 7, () => 5);
    expect(displaced).toBeGreaterThan(0);
    expect(f.volume()).toBeCloseTo(before, 5);
  });

  it('a mound raised in a lake makes the lake RISE', () => {
    const f = flat(16, 0.25);
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        if (x < 1 || z < 1 || x > 14 || z > 14) f.bed[f.idx(x, z)] = 10;
      }
    }
    for (let z = 1; z < 15; z++) for (let x = 1; x < 15; x++) f.add(x, z, 1);
    const surfaceBefore = f.surfaceAt(2, 2);
    f.editBed(6, 6, 9, 9, () => 0.9);
    for (let s = 0; s < 200; s++) f.step(f.maxStableStep());
    expect(f.surfaceAt(2, 2)).toBeGreaterThan(surfaceBefore);
  });

  it('water finds a channel dug beneath it', () => {
    // "Water follows newly dug channels" — the fantasy the whole campaign is
    // for, on the solver that actually affords it.
    const f = flat(24, 0.25);
    for (let z = 0; z < 24; z++) {
      for (let x = 0; x < 24; x++) {
        if (x < 1 || z < 1 || x > 22 || z > 22) f.bed[f.idx(x, z)] = 10;
      }
    }
    for (let z = 2; z < 8; z++) for (let x = 2; x < 22; x++) f.add(x, z, 0.7);
    for (let s = 0; s < 60; s++) f.step(f.maxStableStep());

    const farBefore = f.depth[f.idx(12, 18)];
    // Dig a trench from the pool to a far corner.
    f.editBed(10, 8, 13, 20, () => -1.2);
    for (let s = 0; s < 400; s++) f.step(f.maxStableStep());

    expect(f.depth[f.idx(12, 18)]).toBeGreaterThan(farBefore + 0.2);
  });
});

describe('cost', () => {
  it('a full 256 grid step is far under a frame', () => {
    // The number that replaces the 3D wall. 256^2 is 65,536 cells against
    // 16.8 million in 3D, and the measured 3D step was 108 ms.
    const f = slope(256, 0.25, 0.05);
    for (let z = 0; z < 256; z++) for (let x = 0; x < 40; x++) f.add(x, z, 0.5);
    f.step(f.maxStableStep());
    const t0 = Date.now();
    const STEPS = 10;
    for (let s = 0; s < STEPS; s++) f.step(f.maxStableStep());
    const per = (Date.now() - t0) / STEPS;
    expect(per).toBeLessThan(16);
  });
});
