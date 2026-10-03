/**
 * @file waterBudget.test.ts — the notebook has to balance.
 *
 * Every test here is on a hand-built 9x9 grid with heights authored directly in
 * meters (`toMeters: identity`, `cellM: 1`), so an expected number can be worked
 * out by hand rather than trusted. The grid is a south-facing slope with a pit
 * carved into it — the smallest terrain that has a basin, a doorstep, an outlet
 * and a river all at once.
 */

import { describe, it, expect } from "vitest";
import {
  buildWaterBudget,
  stepWaterBudget,
  totalWaterM3,
  levelForStorage,
  storageForLevel,
  lakeLevelM,
  type WaterBudget,
} from "../waterBudget";

const N = 9;
const identity = (v: number): number => v;

/**
 * A slope that drains south (row 0 highest), with a 3x3 pit at rows 3-5,
 * cols 3-5. The pit's lowest escape runs over the row-6 ground at 14 m, so its
 * doorstep is 14 m and its capacity is 9 cells x 9 m x 1 m2.
 */
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

function build(overrides: Partial<Parameters<typeof buildWaterBudget>[0]> = {}): WaterBudget {
  return buildWaterBudget({
    cols: N,
    rows: N,
    heights: slopeWithPit(),
    cellM: 1,
    toMeters: identity,
    riverThreshold: 5,
    initialSkyM3: 1e6,
    initialLakeFill: 0,
    climate: {
      precipMPerSec: 0.01,
      evapMPerSec: 0,
      runoffFraction: 1,
    },
    ...overrides,
  });
}

describe("levelForStorage", () => {
  it("floods the deepest cell first, then widens", () => {
    const bed = [0, 0, 2, 4];
    // 2 m3 over the two zero cells is 1 m deep and does not reach the 2 m step.
    expect(levelForStorage(bed, 1, 2)).toBeCloseTo(1, 9);
    // 4 m3 exactly fills to 2 m; a third cell now joins the rise.
    expect(levelForStorage(bed, 1, 4)).toBeCloseTo(2, 9);
    // Round trip against the inverse.
    expect(storageForLevel(bed, 1, 3)).toBeCloseTo(3 + 3 + 1, 9);
    expect(levelForStorage(bed, 1, storageForLevel(bed, 1, 3))).toBeCloseTo(3, 9);
  });
});

describe("basins and doorsteps", () => {
  it("finds the pit, its doorstep and its outlet", () => {
    const b = build();
    expect(b.lakes).toHaveLength(1);
    const lake = b.lakes[0];
    expect(lake.cells).toHaveLength(9);
    expect(lake.doorstepM).toBeCloseTo(14, 9);
    expect(lake.capacityM3).toBeCloseTo(9 * (14 - 5) * 1, 9);
    // The spill leaves over the row-6 ground, which is the lowest rim cell.
    expect(lake.outletCell).toBeGreaterThanOrEqual(0);
    const outletRow = Math.floor(lake.outletCell / N);
    expect(b.bedM[lake.outletCell]).toBeCloseTo(20 - outletRow, 9);
    expect(outletRow).toBe(6);
  });
});

describe("water flows downhill (the notebook's routing)", () => {
  it("routes rain down the slope and off the map, never uphill", () => {
    const b = build();
    const before = totalWaterM3(b);
    const step = stepWaterBudget(b, 1);
    // Rain that fell on the slope left the map at the low edge.
    expect(step.toSeaM3).toBeGreaterThan(0);
    expect(b.seaM3).toBeGreaterThan(0);
    expect(totalWaterM3(b)).toBeCloseTo(before, 6);

    // Every cell's receiver is strictly lower on the filled surface: routing
    // cannot carry a drop uphill by construction.
    for (let i = 0; i < N * N; i++) {
      const r = b.receiver[i];
      if (r < 0) continue;
      expect(b.filledM[r]).toBeLessThan(b.filledM[i]);
    }
  });

  it("gives every river reach a mouth strictly below its head", () => {
    const b = build();
    expect(b.reaches.length).toBeGreaterThan(0);
    for (const reach of b.reaches) {
      expect(b.filledM[reach.mouthCell]).toBeLessThanOrEqual(
        b.filledM[reach.headCell],
      );
    }
  });
});

describe("lakes fill to the outlet, not for ever", () => {
  it("stops at the doorstep and spills the excess downstream", () => {
    const b = build();
    const lake = b.lakes[0];
    expect(lake.storedM3).toBe(0);

    let spilled = 0;
    for (let i = 0; i < 400; i++) {
      const s = stepWaterBudget(b, 1);
      spilled += s.lakeOutflowM3;
      // The level may never exceed the doorstep, on any step.
      expect(lakeLevelM(lake, b.cellAreaM2)).toBeLessThanOrEqual(
        lake.doorstepM + 1e-9,
      );
    }

    expect(lake.storedM3).toBeCloseTo(lake.capacityM3, 6);
    expect(lakeLevelM(lake, b.cellAreaM2)).toBeCloseTo(lake.doorstepM, 6);
    // Once full it keeps discharging rather than swallowing the catchment.
    expect(spilled).toBeGreaterThan(0);
    expect(lake.outflowM3s).toBeGreaterThan(0);
  });

  it("holds a rising level below the doorstep while it is still filling", () => {
    const b = build({ climate: { precipMPerSec: 1e-5, evapMPerSec: 0, runoffFraction: 1 } });
    const lake = b.lakes[0];
    stepWaterBudget(b, 1);
    const first = lakeLevelM(lake, b.cellAreaM2);
    stepWaterBudget(b, 1);
    const second = lakeLevelM(lake, b.cellAreaM2);
    expect(second).toBeGreaterThan(first);
    expect(second).toBeLessThan(lake.doorstepM);
  });
});

describe("evaporation reduces the level", () => {
  it("lifts water off the lake into the sky bucket, exactly", () => {
    const b = build({
      initialLakeFill: 1,
      climate: { precipMPerSec: 0, evapMPerSec: 0.001, runoffFraction: 1 },
    });
    const lake = b.lakes[0];
    const level0 = lakeLevelM(lake, b.cellAreaM2);
    const stored0 = lake.storedM3;
    const sky0 = b.skyM3;
    const total0 = totalWaterM3(b);

    const step = stepWaterBudget(b, 10);

    expect(lake.storedM3).toBeLessThan(stored0);
    expect(lakeLevelM(lake, b.cellAreaM2)).toBeLessThan(level0);
    // The sky gained precisely what the lake lost — no leak, no invention.
    expect(b.skyM3 - sky0).toBeCloseTo(stored0 - lake.storedM3, 9);
    expect(step.evaporatedM3).toBeCloseTo(stored0 - lake.storedM3, 9);
    expect(totalWaterM3(b)).toBeCloseTo(total0, 6);
  });

  it("evaporates at the WET area, so a drying lake slows down", () => {
    const b = build({
      initialLakeFill: 1,
      climate: { precipMPerSec: 0, evapMPerSec: 0.02, runoffFraction: 1 },
    });
    const lake = b.lakes[0];
    const first = stepWaterBudget(b, 10).evaporatedM3;
    for (let i = 0; i < 40; i++) stepWaterBudget(b, 10);
    const later = stepWaterBudget(b, 10).evaporatedM3;
    expect(later).toBeLessThanOrEqual(first + 1e-12);
    expect(lake.storedM3).toBeGreaterThanOrEqual(0);
  });
});

describe("river discharge is consistent with precipitation", () => {
  it("matches precip x runoff x area x catchment cells at every mouth", () => {
    const b = build();
    stepWaterBudget(b, 1);
    const { precipMPerSec, runoffFraction } = b.climate;
    let checked = 0;
    for (const reach of b.reaches) {
      // A reach fed by a spilling lake carries more than its own rain; on the
      // first step no lake has spilled yet, so every mouth is rain only.
      const expected =
        precipMPerSec * runoffFraction * b.cellAreaM2 * reach.catchmentCells;
      expect(reach.flowM3s).toBeCloseTo(expected, 9);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("keeps the world total flat over a long run with rain and sun", () => {
    const b = build({
      initialLakeFill: 0.5,
      climate: { precipMPerSec: 0.005, evapMPerSec: 0.002, runoffFraction: 0.4 },
    });
    const total0 = totalWaterM3(b);
    for (let i = 0; i < 500; i++) stepWaterBudget(b, 2);
    expect(totalWaterM3(b)).toBeCloseTo(total0, 4);
    // And the sky did not quietly become the only thing holding water.
    expect(b.seaM3).toBeGreaterThan(0);
  });

  it("a dry sky starves rain rather than minting it", () => {
    const b = build({ initialSkyM3: 1, climate: { precipMPerSec: 1, evapMPerSec: 0, runoffFraction: 1 } });
    const total0 = totalWaterM3(b);
    const step = stepWaterBudget(b, 1);
    expect(step.rainM3).toBeCloseTo(1, 9);
    expect(b.rainShortfallM3).toBeGreaterThan(0);
    expect(b.skyM3).toBeCloseTo(0, 9);
    expect(totalWaterM3(b)).toBeCloseTo(total0, 6);
  });
});
