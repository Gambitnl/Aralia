/**
 * @file shallowWaterPressure.test.ts — water with weight.
 *
 * Remy, 2026-08-27: a basin on a hill with a small tunnel dug out the side
 * should SHOOT, and the speed should depend on how much water sits above the
 * hole. These tests gate that behaviour so it cannot quietly go back to a
 * gentle seep.
 *
 * The claim under test is Torricelli's: a free jet leaves an opening at
 * `sqrt(2 g h)`. Its signature is that FOUR TIMES the head gives TWICE the
 * speed, where the old linear pipe law would have given four times. That
 * square-root relation is the whole difference between water that has weight
 * and water that merely finds its level, so it is what is measured here rather
 * than any absolute number that a tuning constant could move.
 */
import { describe, expect, it } from 'vitest';
import { ShallowWaterField } from '../shallowWater';

const G = 9.81;

/**
 * A tall column of water at one cell, everything else dry and flat.
 *
 * A single loaded cell beside empty ground is the cleanest breach there is:
 * the head is exactly the depth, and every neighbour is a free opening.
 */
function loadedCell(n: number, depthM: number): ShallowWaterField {
  const f = new ShallowWaterField(n, 1);
  const mid = Math.floor(n / 2) * n + Math.floor(n / 2);
  f.depth[mid] = depthM;
  return f;
}

describe('water with weight', () => {
  it('reports an exit speed that follows sqrt(2 g h)', () => {
    for (const head of [1, 4, 16]) {
      const f = loadedCell(9, head);
      const mid = 4 * 9 + 4;
      f.step(f.maxStableStep());
      // The drop across a face is the full depth, so the speed is sqrt(2 g h).
      expect(f.exitSpeed[mid]).toBeCloseTo(Math.sqrt(2 * G * head), 1);
    }
  });

  it('gives twice the speed for four times the head, not four times', () => {
    const shallow = loadedCell(9, 1);
    const deep = loadedCell(9, 4);
    const mid = 4 * 9 + 4;
    shallow.step(shallow.maxStableStep());
    deep.step(deep.maxStableStep());
    const ratio = deep.exitSpeed[mid] / shallow.exitSpeed[mid];
    // sqrt(4) = 2. A linear law would have put this at 4.
    expect(ratio).toBeCloseTo(2, 1);
  });

  it('clears the exit speed where the ground is dry', () => {
    const f = loadedCell(9, 2);
    f.step(f.maxStableStep());
    // A corner cell never held water, so it must report no flow at all.
    expect(f.exitSpeed[0]).toBe(0);
  });

  it('still conserves volume with the jet law running', () => {
    const f = loadedCell(21, 30);
    const before = f.volume();
    for (let i = 0; i < 200; i++) f.step(f.maxStableStep());
    const after = f.volume() + f.boundaryLedgerM3;
    // Nothing may be created or lost: what left the edge is on the ledger.
    expect(after).toBeCloseTo(before, 3);
  });

  it('drains a deep basin faster than the linear law would', () => {
    /* THE POINT OF THE WHOLE CHANGE. Under the old law the flux across a face
     * was a fixed fraction of the drop, so a 30 m head moved 30x what a 1 m
     * head moved. Under Torricelli the deep case moves MORE than that, because
     * the jet law overtakes the pipe law above about five metres of head. */
    const deep = loadedCell(21, 30);
    const mid = 10 * 21 + 10;
    const start = deep.depth[mid];
    deep.step(deep.maxStableStep());
    const shed = start - deep.depth[mid];

    // The pipe law's ceiling for this face set, per step: accel is
    // dt * G * 0.9 / cell, capped at half the drop, four faces.
    const dt = deep.maxStableStep();
    const pipePerFace = Math.min(start * ((dt * G * 0.9) / 1) * 0.985, start * 0.5);
    expect(shed).toBeGreaterThan(pipePerFace);
  });

  it('leaves gentle water to the pipe law', () => {
    /* Below the crossover the jet law is SMALLER, so taking the larger of the
     * two changes nothing. This is the condition the option was chosen under:
     * nothing that already works may get slower. */
    const f = loadedCell(9, 0.2);
    const mid = 4 * 9 + 4;
    const start = f.depth[mid];
    const dt = f.maxStableStep();
    f.step(dt);
    const shed = start - f.depth[mid];

    const jetPerFace = Math.sqrt(2 * G * start) * start * (dt / 1);
    // The pipe law moved more than the jet law would have, so it is in charge.
    expect(shed).toBeGreaterThan(jetPerFace);
  });
});
