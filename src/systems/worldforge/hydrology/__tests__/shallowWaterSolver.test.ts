/**
 * @file shallowWaterSolver.test.ts — the seam between the notebook and the real
 * fluid, tested for the two things a seam can get wrong: water moving the wrong
 * way, and water going missing while it crosses.
 *
 * Same hand-built 9x9 slope-with-a-pit as the notebook tests, heights authored
 * directly in meters so an expected number is arithmetic and not a guess.
 */

import { describe, it, expect } from "vitest";
import {
  buildWaterBudget,
  stepWaterBudget,
  totalWaterM3,
  lakeLevelM,
  type WaterBudget,
} from "../waterBudget";
import {
  openLocalWindow,
  stepLocalWindow,
  closeLocalWindow,
  coupledTotalM3,
  windowWaterM3,
  wetCellCount,
} from "../shallowWaterSolver";

const N = 9;
const identity = (v: number): number => v;

function slopeWithPit(): number[] {
  const h: number[] = [];
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const pit = row >= 3 && row <= 5 && col >= 3 && col <= 5;
      h.push(pit ? 5 : 20 - row);
    }
  }
  return h;
}

/** A pure slope, no pit — the cleanest possible "does it run downhill?" test. */
function pureSlope(): number[] {
  const h: number[] = [];
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) h.push(20 - row * 0.5);
  }
  return h;
}

function build(
  heights: number[],
  overrides: Partial<Parameters<typeof buildWaterBudget>[0]> = {},
): WaterBudget {
  return buildWaterBudget({
    cols: N,
    rows: N,
    heights,
    cellM: 1,
    toMeters: identity,
    riverThreshold: 5,
    initialSkyM3: 1e6,
    initialLakeFill: 0,
    climate: { precipMPerSec: 0.01, evapMPerSec: 0, runoffFraction: 1 },
    ...overrides,
  });
}

/** Mean row of the water, weighted by depth. Rises as water runs south. */
function centerOfMassRow(depth: Float32Array): number {
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < depth.length; i++) {
    const d = depth[i];
    if (d <= 0) continue;
    sum += Math.floor(i / N) * d;
    weight += d;
  }
  return weight > 0 ? sum / weight : 0;
}

describe("water flows downhill in the live window", () => {
  it("moves a dropped body of water south, down the slope", () => {
    const b = build(pureSlope());
    const win = openLocalWindow(b, { originCol: 0, originRow: 0, n: N });
    // The window's bed IS the notebook's bed — no second heightfield (GG-129).
    expect(win.field.bed[0]).toBeCloseTo(b.bedM[0], 9);
    expect(win.field.bed[N * (N - 1)]).toBeCloseTo(b.bedM[N * (N - 1)], 9);

    win.field.add(4, 1, 1); // 1 m of water high on the slope
    const startRow = centerOfMassRow(win.field.depth);
    const startVolume = windowWaterM3(win);

    // Stopped while the sheet is still in flight. Run this slope to rest and it
    // delivers ~93% of the pour off the low edge and leaves a film thinner than
    // DRY_DEPTH_M behind — correct, but it proves less about direction than a
    // moving body does. Measured: 20 steps leaves 0.31 m3 over 17 wet cells.
    for (let i = 0; i < 20; i++) stepLocalWindow(win, 1 / 30);

    const endRow = centerOfMassRow(win.field.depth);
    // Some ran off the low edge; whatever is left has moved downhill.
    expect(win.ledger.returnM3).toBeGreaterThan(0);
    expect(endRow).toBeGreaterThan(startRow);
    // Nothing was created: what is left plus what ran off is what we poured.
    expect(windowWaterM3(win) + win.ledger.returnM3).toBeCloseTo(startVolume, 4);
    expect(wetCellCount(win)).toBeGreaterThan(0);
  });

  it("never lifts water above the surface it came from", () => {
    const b = build(pureSlope());
    const win = openLocalWindow(b, { originCol: 0, originRow: 0, n: N });
    win.field.add(4, 1, 1);
    const highestSurface = win.field.surfaceAt(4, 1);
    for (let i = 0; i < 200; i++) stepLocalWindow(win, 1 / 30);
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        if (win.field.depth[z * N + x] <= 0) continue;
        expect(win.field.surfaceAt(x, z)).toBeLessThanOrEqual(highestSurface + 1e-6);
      }
    }
  });
});

describe("the window is seeded from, and gives back to, the notebook", () => {
  it("takes the lake's water as real depth and returns it on close", () => {
    const b = build(slopeWithPit(), { initialLakeFill: 1 });
    const lake = b.lakes[0];
    const storedBefore = lake.storedM3;
    const total0 = totalWaterM3(b);
    expect(storedBefore).toBeGreaterThan(0);

    const win = openLocalWindow(b, { originCol: 2, originRow: 2, n: 5 });
    // The whole pit sits inside a 5x5 window at (2,2), so the lake handed over
    // everything it held.
    expect(win.seededM3).toBeCloseTo(storedBefore, 6);
    expect(lake.storedM3).toBeCloseTo(0, 6);
    expect(coupledTotalM3(totalWaterM3(b), [win])).toBeCloseTo(total0, 6);

    // Depth in the window matches the lake surface it was seeded from.
    const localOfPitCenter = (4 - 2) * 5 + (4 - 2);
    expect(win.field.bed[localOfPitCenter] + win.field.depth[localOfPitCenter]).toBeCloseTo(
      lake.doorstepM,
      6,
    );

    closeLocalWindow(win);
    expect(coupledTotalM3(totalWaterM3(b), [])).toBeCloseTo(total0, 6);
    expect(lake.storedM3).toBeGreaterThan(0);
  });

  it("hands the notebook's routed rain to the window, not to the sea", () => {
    const b = build(slopeWithPit());
    const win = openLocalWindow(b, { originCol: 2, originRow: 2, n: 5 });
    const step = stepWaterBudget(b, 1);
    expect(step.toWindowsM3).toBeGreaterThan(0);
    expect(win.ledger.transitM3).toBeCloseTo(step.toWindowsM3, 9);

    const local = stepLocalWindow(win, 1 / 30);
    expect(local.inflowM3).toBeCloseTo(step.toWindowsM3, 9);
    expect(win.ledger.transitM3).toBe(0);
    expect(windowWaterM3(win)).toBeGreaterThan(0);
  });
});

describe("the seam conserves water", () => {
  it("holds the coupled total flat across rain, spill, run-off and close", () => {
    const b = build(slopeWithPit(), {
      initialLakeFill: 0.5,
      climate: { precipMPerSec: 0.004, evapMPerSec: 0.001, runoffFraction: 0.5 },
    });
    const total0 = totalWaterM3(b);
    const win = openLocalWindow(b, { originCol: 2, originRow: 2, n: 5 });
    expect(coupledTotalM3(totalWaterM3(b), [win])).toBeCloseTo(total0, 6);

    for (let i = 0; i < 200; i++) {
      stepWaterBudget(b, 1);
      for (let k = 0; k < 4; k++) stepLocalWindow(win, 1 / 30);
      expect(coupledTotalM3(totalWaterM3(b), [win])).toBeCloseTo(total0, 3);
    }

    closeLocalWindow(win);
    stepWaterBudget(b, 1);
    expect(coupledTotalM3(totalWaterM3(b), [])).toBeCloseTo(total0, 3);
  });

  it("puts the closed window's lake water back in the lake, not downstream", () => {
    const b = build(slopeWithPit(), { initialLakeFill: 1 });
    const lake = b.lakes[0];
    const level0 = lakeLevelM(lake, b.cellAreaM2);
    const win = openLocalWindow(b, { originCol: 2, originRow: 2, n: 5 });
    closeLocalWindow(win);
    expect(lakeLevelM(lake, b.cellAreaM2)).toBeCloseTo(level0, 4);
  });
});
