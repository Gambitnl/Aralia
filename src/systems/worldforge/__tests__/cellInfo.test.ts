/**
 * @file cellInfo.test.ts
 * Verifies describeCell extracts a coherent, render-agnostic summary from a
 * generated atlas and degrades gracefully on out-of-range ids.
 */
import { describe, it, expect } from "vitest";
import { generateFmgWorld } from "../fmg/generateWorld";
import { describeCell } from "../cellInfo";

describe("describeCell", () => {
  const atlas = generateFmgWorld("cellinfo-test", {
    width: 960,
    height: 540,
    cellsDesired: 1000,
    template: "continents",
  });

  const cellCount = atlas.pack.cells.h.length;

  it("classifies land vs water by height threshold (20)", () => {
    let land = -1;
    let water = -1;
    for (let i = 0; i < cellCount; i++) {
      if (land < 0 && atlas.pack.cells.h[i] >= 20) land = i;
      if (water < 0 && atlas.pack.cells.h[i] < 20) water = i;
      if (land >= 0 && water >= 0) break;
    }
    expect(describeCell(atlas, land).terrain).toBe("land");
    expect(describeCell(atlas, water).terrain).toBe("water");
  });

  it("reports a biome name for land cells", () => {
    const land = atlas.pack.cells.h.findIndex((h) => h >= 20);
    const info = describeCell(atlas, land);
    expect(typeof info.biome).toBe("string");
    expect(info.biome!.length).toBeGreaterThan(0);
  });

  it("converts the centroid to feet", () => {
    const info = describeCell(atlas, 0);
    expect(Number.isFinite(info.positionFt.x)).toBe(true);
    expect(Number.isFinite(info.positionFt.y)).toBe(true);
  });

  it("returns a safe water entry for out-of-range ids", () => {
    const info = describeCell(atlas, cellCount + 999);
    expect(info.terrain).toBe("water");
    expect(info.hasRiver).toBe(false);
  });

  it("surfaces at least one settlement across the populated world", () => {
    let foundBurg = false;
    for (let i = 0; i < cellCount; i++) {
      const info = describeCell(atlas, i);
      if (info.burg) {
        expect(info.burg.name.length).toBeGreaterThan(0);
        expect(info.burg.population).toBeGreaterThanOrEqual(0);
        foundBurg = true;
        break;
      }
    }
    expect(foundBurg).toBe(true);
  });
});
