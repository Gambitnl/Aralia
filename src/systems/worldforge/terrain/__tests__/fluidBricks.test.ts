/**
 * @file fluidBricks.test.ts — proof that the sparse brick step is the dense
 * step, and that brick boundaries do not leak.
 *
 * The dense gather form already had its conservation proof (fluidGather.test).
 * Sparsity introduces exactly one new way to lose water: a cell at a brick face
 * computes an outflow into a brick that has no storage and whose invocation
 * never runs, so the mass leaves and never arrives. The rule that prevents it
 * is that AN UNALLOCATED BRICK IS A SOLID WALL, and these tests are what hold
 * that rule in place.
 *
 * The parity test is the other half: with every brick allocated, the sparse
 * step must reproduce the dense step cell for cell. Any divergence between the
 * two is a bug in the sparse form, never a judgment call — the same contract
 * fluidCompute.ts has with fluidGather.ts.
 */
import { describe, it, expect } from 'vitest';
import { GatherField, stepGather } from '../fluidGather';
import {
  BRICK,
  BRICK_CELLS,
  MAX_MASS,
  applyWanted,
  brickTotals,
  bricksInSphere,
  cellAddr,
  computeBrickOpen,
  createRefreshScratch,
  createSparseFluid,
  denseBytes,
  ensureBricks,
  getMass,
  markWanted,
  refreshBricks,
  setMass,
  setSolid,
  sparseBytes,
  stepSparse,
  totalMass,
  type SparseFluid,
} from '../fluidBricks';

const N = 32;
const SLOTS = (N / BRICK) ** 3; // enough for every brick, so tests can go dense

function makeSparse(slots = SLOTS): SparseFluid {
  return createSparseFluid(N, slots);
}

/**
 * Allocate every brick in the domain, solid ones included. Only the parity test
 * wants this: with no brick walls anywhere, the sparse step has to reproduce the
 * dense step exactly, and any surviving difference is the sparse addressing.
 */
function allocateAll(f: SparseFluid): void {
  computeBrickOpen(f);
  const all: number[] = [];
  for (let i = 0; i < f.b ** 3; i++) all.push(i);
  ensureBricks(f, all);
}

function floorSolid(f: SparseFluid, floorY: number): void {
  for (let y = 0; y <= floorY; y++) {
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) setSolid(f, x, y, z, true);
    }
  }
}

function run(f: SparseFluid, steps: number, refreshEvery = 0): void {
  let massOut: Float32Array = new Float32Array(f.mass.length);
  let velOut: Float32Array = new Float32Array(f.vel.length);
  const scratch = createRefreshScratch(f);
  for (let s = 0; s < steps; s++) {
    if (refreshEvery > 0 && s % refreshEvery === 0) {
      refreshBricks(f, scratch, { dilate: 1, fall: 2 });
      // A refresh can grow the pool's used range; the scratch outputs are
      // sized to the whole pool from the start, so nothing to resize.
    }
    stepSparse(f, massOut, velOut);
    const m = f.mass;
    const v = f.vel;
    f.mass = massOut;
    f.vel = velOut;
    massOut = m;
    velOut = v;
  }
}

describe('sparse brick fluid', () => {
  it('reproduces the dense step cell for cell when every brick is allocated', () => {
    const f = makeSparse();
    floorSolid(f, 7);
    allocateAll(f);

    const dense: GatherField = {
      n: N,
      mass: new Float32Array(N ** 3),
      vel: new Float32Array(N ** 3),
      solid: new Float32Array(N ** 3),
    };
    // The same solid and the same water in both, placed to straddle brick faces.
    for (let y = 0; y <= 7; y++) {
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < N; x++) dense.solid[(y * N + z) * N + x] = 1;
      }
    }
    const put = (x: number, y: number, z: number, m: number) => {
      setMass(f, x, y, z, m);
      dense.mass[(y * N + z) * N + x] = m;
    };
    // A column crossing three bricks vertically, and a puddle crossing a face.
    for (let y = 9; y < 22; y++) put(7, y, 7, 0.9);
    for (let x = 6; x < 11; x++) for (let z = 6; z < 11; z++) put(x, 8, z, 0.7);

    const sMass = new Float32Array(f.mass.length);
    const sVel = new Float32Array(f.vel.length);
    const dMass = new Float32Array(N ** 3);
    const dVel = new Float32Array(N ** 3);
    stepSparse(f, sMass, sVel);
    stepGather(dense, dMass, dVel);

    let worst = 0;
    for (let y = 0; y < N; y++) {
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < N; x++) {
          const a = cellAddr(f, x, y, z);
          expect(a).toBeGreaterThanOrEqual(0);
          worst = Math.max(worst, Math.abs(sMass[a] - dMass[(y * N + z) * N + x]));
          worst = Math.max(worst, Math.abs(sVel[a] - dVel[(y * N + z) * N + x]));
        }
      }
    }
    expect(worst).toBe(0);
  });

  it('conserves mass exactly across brick boundaries with a partial pool', () => {
    // A pool far too small to hold the domain: only the bricks the allocator
    // asks for exist, so every step runs against real brick walls.
    const f = createSparseFluid(N, 96);
    floorSolid(f, 7);
    computeBrickOpen(f);
    const scratch = createRefreshScratch(f);

    // Seed water in one brick, then let the allocator grow the footprint.
    ensureBricks(f, bricksInSphere(f, 15, 26, 15, 2));
    for (let y = 24; y < 28; y++) {
      for (let z = 14; z <= 16; z++) {
        for (let x = 14; x <= 16; x++) setMass(f, x, y, z, 1);
      }
    }
    const before = totalMass(f);
    expect(before).toBeGreaterThan(30);

    run(f, 240, 4);

    expect(totalMass(f)).toBeCloseTo(before, 3);
    // And the water actually travelled: it must have reached the floor, which
    // is nineteen cells and more than two brick boundaries down.
    let atFloor = 0;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) atFloor += getMass(f, x, 8, z);
    expect(atFloor).toBeGreaterThan(before * 0.5);
  });

  it('loses nothing when the allocator refreshes mid-fall', () => {
    // The failure this guards: a refresh frees or reassigns a slot under water
    // in flight. Refreshing every single step is the harshest version of it.
    const f = createSparseFluid(N, 96);
    floorSolid(f, 3);
    computeBrickOpen(f);
    ensureBricks(f, bricksInSphere(f, 15, 29, 15, 1));
    for (let y = 28; y < 31; y++) setMass(f, 15, y, 15, 1);
    const before = totalMass(f);
    run(f, 200, 1);
    expect(totalMass(f)).toBeCloseTo(before, 4);
  });

  it('never allocates a brick that is solid all the way through', () => {
    const f = makeSparse();
    floorSolid(f, 15); // bricks 0 and 1 in y are entirely solid
    computeBrickOpen(f);
    const b = f.b;
    for (let bz = 0; bz < b; bz++) {
      for (let bx = 0; bx < b; bx++) {
        expect(f.brickOpen[(0 * b + bz) * b + bx]).toBe(0);
        expect(f.brickOpen[(1 * b + bz) * b + bx]).toBe(0);
        expect(f.brickOpen[(2 * b + bz) * b + bx]).toBe(1);
      }
    }
    const scratch = createRefreshScratch(f);
    ensureBricks(f, bricksInSphere(f, 15, 17, 15, 1));
    for (let y = 16; y < 19; y++) setMass(f, 15, y, 15, 1);
    refreshBricks(f, scratch, { dilate: 2, fall: 4 });
    for (let slot = 0; slot < f.slotHigh; slot++) {
      const bid = f.slotBrick[slot];
      if (bid < 0) continue;
      expect(f.brickOpen[bid]).toBe(1);
    }
  });

  it('never frees a brick that still holds mass', () => {
    const f = makeSparse();
    computeBrickOpen(f);
    ensureBricks(f, [0, 1, 2]);
    // Brick 0 keeps a sub-DRY residue: inert to the physics, but real mass.
    f.mass[0 * BRICK_CELLS] = 1e-5;
    const totals = new Float32Array(f.b ** 3);
    brickTotals(f, totals);
    const want = new Uint8Array(f.b ** 3); // want nothing
    const stats = applyWanted(f, want, totals);
    expect(stats.freed).toBe(2);
    expect(f.brickSlot[0]).toBeGreaterThanOrEqual(0);
    expect(totalMass(f)).toBeCloseTo(1e-5, 12);
  });

  it('holds water against an unallocated brick exactly as against rock', () => {
    // Two runs of the same scene: one where the neighbouring brick is rock,
    // one where it is simply not allocated. The water must end up identical.
    const build = (wall: 'rock' | 'unallocated'): SparseFluid => {
      const f = createSparseFluid(N, SLOTS);
      floorSolid(f, 7);
      if (wall === 'rock') {
        for (let y = 0; y < N; y++) {
          for (let z = 0; z < N; z++) {
            for (let x = 16; x < N; x++) setSolid(f, x, y, z, true);
          }
        }
      }
      computeBrickOpen(f);
      const ids: number[] = [];
      const b = f.b;
      for (let by = 0; by < b; by++) {
        for (let bz = 0; bz < b; bz++) {
          for (let bx = 0; bx < 2; bx++) {
            const id = (by * b + bz) * b + bx;
            if (f.brickOpen[id] === 1) ids.push(id);
          }
        }
      }
      ensureBricks(f, ids);
      for (let y = 8; y < 14; y++) {
        for (let z = 4; z < 12; z++) {
          for (let x = 10; x < 16; x++) setMass(f, x, y, z, MAX_MASS);
        }
      }
      return f;
    };
    const rock = build('rock');
    const gap = build('unallocated');
    const before = totalMass(rock);
    run(rock, 120);
    run(gap, 120);
    expect(totalMass(rock)).toBeCloseTo(before, 3);
    expect(totalMass(gap)).toBeCloseTo(before, 3);
    let worst = 0;
    for (let y = 0; y < N; y++) {
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < 16; x++) {
          worst = Math.max(worst, Math.abs(getMass(rock, x, y, z) - getMass(gap, x, y, z)));
        }
      }
    }
    expect(worst).toBe(0);
  });

  it('reports starvation instead of losing water when the pool is full', () => {
    const f = createSparseFluid(N, 4);
    computeBrickOpen(f);
    ensureBricks(f, [0, 1, 2, 3]);
    for (let i = 0; i < 4; i++) f.mass[i * BRICK_CELLS] = 1;
    const totals = new Float32Array(f.b ** 3);
    brickTotals(f, totals);
    const want = new Uint8Array(f.b ** 3);
    const wet = markWanted(f, totals, { dilate: 1, fall: 1 }, want);
    expect(wet).toBe(4);
    const stats = applyWanted(f, want, totals);
    expect(stats.starved).toBeGreaterThan(0);
    expect(totalMass(f)).toBeCloseTo(4, 6);
  });

  it('costs a fraction of the dense field it replaces', () => {
    // 64 m at 12.5 cm: the resolution the dense form could not reach.
    const fine = sparseBytes(512, 12288);
    expect(denseBytes(512)).toBeGreaterThan(2_600_000_000);
    expect(fine.total).toBeLessThan(135 * 1024 * 1024);
    // 64 m at 25 cm: the shipped resolution, at a tenth of the shipped memory.
    const shipped = sparseBytes(256, 4096);
    expect(denseBytes(256)).toBeGreaterThan(330_000_000);
    expect(shipped.total).toBeLessThan(45 * 1024 * 1024);
  });
});
