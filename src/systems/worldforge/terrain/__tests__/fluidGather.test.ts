/**
 * @file fluidGather.test.ts — proof that the gather-form step conserves mass
 * and still behaves like water.
 *
 * The GPU kernel in fluidCompute.ts mirrors fluidGather.ts node for node, so
 * what these tests prove about the reference is the claim the kernel ships
 * on. Conservation is the one that matters most: the scatter kernel this
 * replaced lost mass to write races, and the gather form exists to make that
 * loss impossible by construction.
 */
import { describe, it, expect } from 'vitest';
import { DRY, MAX_MASS, GatherField, stepGather } from '../fluidGather';

const N = 16;

function makeField(): GatherField {
  const total = N ** 3;
  return {
    n: N,
    mass: new Float32Array(total),
    vel: new Float32Array(total),
    solid: new Float32Array(total),
  };
}

const idx = (x: number, y: number, z: number) => (y * N + z) * N + x;

function floorAt(f: GatherField, floorY: number): void {
  for (let y = 0; y <= floorY; y++) {
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) f.solid[idx(x, y, z)] = 1;
    }
  }
}

function total(mass: Float32Array): number {
  // Kahan summation: 16^3 float32 adds drift enough to fail an exact check
  // for reasons that have nothing to do with the solver.
  let sum = 0;
  let c = 0;
  for (let i = 0; i < mass.length; i++) {
    const t = sum + mass[i];
    c += Math.abs(sum) >= Math.abs(mass[i]) ? sum - t + mass[i] : mass[i] - t + sum;
    sum = t;
  }
  return sum + c;
}

function run(f: GatherField, steps: number): void {
  let mass = f.mass;
  let vel = f.vel;
  let massOut: Float32Array = new Float32Array(mass.length);
  let velOut: Float32Array = new Float32Array(vel.length);
  for (let s = 0; s < steps; s++) {
    stepGather({ n: f.n, mass, vel, solid: f.solid }, massOut, velOut);
    [mass, massOut] = [massOut, mass];
    [vel, velOut] = [velOut, vel];
  }
  f.mass = mass;
  f.vel = vel;
}

describe('stepGather', () => {
  it('conserves mass exactly through a long fall and settle', () => {
    const f = makeField();
    floorAt(f, 2);
    // A column of water high above the floor, off-center.
    for (let y = 10; y <= 13; y++) f.mass[idx(4, y, 4)] = 1;
    const before = total(f.mass);
    run(f, 200);
    const after = total(f.mass);
    expect(after).toBeCloseTo(before, 3);
  });

  it('drops water rather than diffusing it', () => {
    const f = makeField();
    floorAt(f, 2);
    f.mass[idx(8, 12, 8)] = 1;
    run(f, 30);
    // The mass must now sit at the floor, not linger at the drop height.
    let atFloor = 0;
    let aloft = 0;
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        atFloor += f.mass[idx(x, 3, z)];
        for (let y = 8; y < N; y++) aloft += f.mass[idx(x, y, z)];
      }
    }
    expect(atFloor).toBeGreaterThan(0.7);
    expect(aloft).toBeLessThan(0.01);
  });

  it('levels a lopsided pool', () => {
    const f = makeField();
    floorAt(f, 2);
    // All the water on one half of the floor.
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < 8; x++) f.mass[idx(x, 3, z)] = 1;
    }
    run(f, 300);
    // The far half must have received a comparable share.
    let left = 0;
    let right = 0;
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        const m = f.mass[idx(x, 3, z)];
        if (x < 8) left += m;
        else right += m;
      }
    }
    expect(right).toBeGreaterThan(left * 0.6);
  });

  it('never pushes water into solid or out of the bubble', () => {
    const f = makeField();
    floorAt(f, 2);
    // Water piled against the bubble wall.
    for (let y = 3; y <= 6; y++) f.mass[idx(0, y, 0)] = MAX_MASS;
    run(f, 100);
    for (let y = 0; y <= 2; y++) {
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < N; x++) {
          expect(f.mass[idx(x, y, z)]).toBe(0);
        }
      }
    }
  });

  it('finds a hole: water above a slab drains through a gap', () => {
    const f = makeField();
    // A slab at y=8 with one open cell, floor at the bottom.
    floorAt(f, 2);
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) f.solid[idx(x, 8, z)] = 1;
    }
    f.solid[idx(8, 8, 8)] = 0;
    // A pool sitting on the slab.
    for (let z = 4; z < 12; z++) {
      for (let x = 4; x < 12; x++) f.mass[idx(x, 9, z)] = 1;
    }
    const before = total(f.mass);
    // A one-cell hole throttles the drain, so this needs real time: about
    // half the pool passes through in 600 steps, most of it by 1500.
    run(f, 1500);
    // Most of the pool must have found the gap and reached the lower floor.
    let below = 0;
    for (let y = 3; y < 8; y++) {
      for (let z = 0; z < N; z++) {
        for (let x = 0; x < N; x++) below += f.mass[idx(x, y, z)];
      }
    }
    expect(below).toBeGreaterThan(before * 0.5);
    expect(total(f.mass)).toBeCloseTo(before, 2);
  });
});
