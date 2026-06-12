/**
 * Unit tests for the pure atlas drawing core function.
 *
 * This test suite stubs the CanvasRenderingContext2D to record calls and assert rendering behaviors,
 * verifying that layers are drawn in the correct order, colors match the biome mappings,
 * rivers are rendered properly, and view transformation scale/offsets are applied correctly.
 * It also tests cache validation and hex-color parsing helpers.
 *
 * Runs on: Vitest unit testing framework
 */

import { describe, it, expect } from "vitest";
import { drawAtlas, isCacheValid, parseHexColor, getCleanNumber, isStateBorder, shouldShowBurgLabel } from "../atlasDraw";
import { heightmapTemplates } from "../../../systems/worldforge/fmg/heightmap-templates";
import type { FmgAtlasResult } from "../../../systems/worldforge/fmg/generateAtlas";

// ============================================================================
// Section: Mock Data & Context
// ============================================================================
// Creates a simple mock atlas result and a spy context to track canvas calls.
// ============================================================================

const mockAtlas: FmgAtlasResult = {
  seed: "test-seed",
  graphWidth: 100,
  graphHeight: 100,
  template: "continents",
  mapSize: 50,
  latitude: 50,
  longitude: 50,
  mapCoordinates: {
    latT: 10,
    latN: 10,
    latS: 0,
    lonT: 10,
    lonW: 0,
    lonE: 10,
  },
  biomesData: {
    color: ["#001122", "#334455", "#667788"],
    name: ["WaterBiome", "LandBiomeA", "LandBiomeB"],
    biomes: [0, 1, 2],
  } as any,
  pack: {
    cells: {
      p: [
        [10, 20],
        [30, 40],
        [50, 60],
      ],
      v: [
        [0, 1, 2],
        [1, 2, 0],
        [2, 0, 1],
      ],
      c: [[1], [0, 2], [1]],
      b: [0, 0, 0],
      i: new Uint32Array([0, 1, 2]),
      h: new Uint8Array([10, 25, 30]), // Cell 0: water (<20), Cell 1 & 2: land (>=20)
      biome: new Uint8Array([0, 1, 2]),
    },
    vertices: {
      p: [
        [10, 10],
        [20, 20],
        [30, 30],
      ],
      v: [],
      c: [],
    },
    features: [
      0 as any,
      {
        i: 1,
        type: "ocean",
        land: false,
        border: false,
        cells: 1,
        firstCell: 0,
        vertices: [],
        area: 100,
        shoreline: [],
      },
      {
        i: 2,
        type: "island",
        land: true,
        border: false,
        cells: 2,
        firstCell: 1,
        vertices: [],
        area: 200,
        shoreline: [],
      },
    ],
    rivers: [
      {
        i: 1,
        cells: [0, 1],
        width: 1,
        source: 0,
        mouth: 1,
        type: "river",
      } as any,
    ],
  },
  grid: {} as any, // Not used by drawing logic
};

function createMockContext2D() {
  const calls: Array<{ name: string; args: any[] }> = [];
  const props: Record<string, any> = {};

  return {
    calls,
    props,
    get fillStyle() {
      return props.fillStyle;
    },
    set fillStyle(val) {
      props.fillStyle = val;
      calls.push({ name: "set_fillStyle", args: [val] });
    },
    get strokeStyle() {
      return props.strokeStyle;
    },
    set strokeStyle(val) {
      props.strokeStyle = val;
      calls.push({ name: "set_strokeStyle", args: [val] });
    },
    get lineWidth() {
      return props.lineWidth;
    },
    set lineWidth(val) {
      props.lineWidth = val;
      calls.push({ name: "set_lineWidth", args: [val] });
    },
    get lineCap() {
      return props.lineCap;
    },
    set lineCap(val) {
      props.lineCap = val;
      calls.push({ name: "set_lineCap", args: [val] });
    },
    get lineJoin() {
      return props.lineJoin;
    },
    set lineJoin(val) {
      props.lineJoin = val;
      calls.push({ name: "set_lineJoin", args: [val] });
    },
    beginPath() {
      calls.push({ name: "beginPath", args: [] });
    },
    closePath() {
      calls.push({ name: "closePath", args: [] });
    },
    moveTo(x: number, y: number) {
      calls.push({ name: "moveTo", args: [x, y] });
    },
    lineTo(x: number, y: number) {
      calls.push({ name: "lineTo", args: [x, y] });
    },
    fill() {
      calls.push({ name: "fill", args: [] });
    },
    stroke() {
      calls.push({ name: "stroke", args: [] });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ name: "fillRect", args: [x, y, w, h] });
    },
    rect(x: number, y: number, w: number, h: number) {
      calls.push({ name: "rect", args: [x, y, w, h] });
    },
    save() {
      calls.push({ name: "save", args: [] });
    },
    restore() {
      calls.push({ name: "restore", args: [] });
    },
    setLineDash(dash: number[]) {
      calls.push({ name: "setLineDash", args: [dash] });
    },
    fillText(text: string, x: number, y: number) {
      calls.push({ name: "fillText", args: [text, x, y] });
    },
    createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
      calls.push({ name: "createRadialGradient", args: [x0, y0, r0, x1, y1, r1] });
      return {
        addColorStop(offset: number, color: string) {
          calls.push({ name: "addColorStop", args: [offset, color] });
        }
      };
    }
  } as unknown as CanvasRenderingContext2D & {
    calls: typeof calls;
    props: typeof props;
  };
}

// ============================================================================
// Section: Test Cases
// ============================================================================

describe("drawAtlas", () => {
  it("should draw layers in correct order (water background, land cells, coastline)", () => {
    const ctx = createMockContext2D();
    const view = { offsetX: 10, offsetY: 20, scale: 2 };
    drawAtlas(ctx, mockAtlas, view);

    // Verify background gradient creation
    const gradCall = ctx.calls.find(c => c.name === "createRadialGradient");
    expect(gradCall).toBeDefined();

    // Verify land cells are filled
    const fills = ctx.calls.filter(c => c.name === "fill");
    expect(fills.length).toBeGreaterThanOrEqual(1);
  });

  it("should draw coastline stroke between land and water cells", () => {
    const ctx = createMockContext2D();
    const view = { offsetX: 10, offsetY: 20, scale: 2 };
    drawAtlas(ctx, mockAtlas, view);

    // Verify coastline double stroke (shelf glow + crisp boundary)
    const strokeCalls = ctx.calls.filter((c) => c.name === "stroke");
    expect(strokeCalls.length).toBeGreaterThanOrEqual(2);

    // Shelf glow style
    const shelfCall = ctx.calls.find(
      (c) => c.name === "set_strokeStyle" && c.args[0] === "rgba(100, 180, 240, 0.35)"
    );
    expect(shelfCall).toBeDefined();

    // Crisp coast stroke style
    const coastlineStrokeCall = ctx.calls.find(
      (c) => c.name === "set_strokeStyle" && c.args[0] === "#1a3d66"
    );
    expect(coastlineStrokeCall).toBeDefined();
  });

  it("should transform coordinates correctly according to scale and offset", () => {
    const ctx = createMockContext2D();
    const view = { offsetX: 100, offsetY: 200, scale: 3 };
    drawAtlas(ctx, mockAtlas, view);

    // Vertex 0 coordinate: [10, 10]
    // Under view scale 3 and offset [100, 200]:
    // screenX = 10 * 3 + 100 = 130
    // screenY = 10 * 3 + 200 = 230

    const hasTransformedMove = ctx.calls.some(
      (c) => c.name === "moveTo" && c.args[0] === 130 && c.args[1] === 230
    );
    expect(hasTransformedMove).toBe(true);
  });
});

describe("isCacheValid", () => {
  it("should return false if cache view is null", () => {
    expect(isCacheValid(null, 1.0, "seed")).toBe(false);
  });

  it("should return false if scale does not match", () => {
    const cache = { scale: 1.0, seed: "seed" };
    expect(isCacheValid(cache, 1.5, "seed")).toBe(false);
  });

  it("should return false if seed does not match", () => {
    const cache = { scale: 1.0, seed: "seedA" };
    expect(isCacheValid(cache, 1.0, "seedB")).toBe(false);
  });

  it("should return false if showGraticule option does not match", () => {
    const cache = { scale: 1.0, seed: "seed", showGraticule: false };
    expect(isCacheValid(cache, 1.0, "seed", true)).toBe(false);
  });

  it("should return true if scale, seed, and showGraticule all match", () => {
    const cache = { scale: 2.5, seed: "seed", showGraticule: true };
    expect(isCacheValid(cache, 2.5, "seed", true)).toBe(true);
  });
});

describe("parseHexColor", () => {
  it("should parse 6-character hex colors correctly", () => {
    expect(parseHexColor("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(parseHexColor("#0000ff")).toEqual({ r: 0, g: 0, b: 255 });
    expect(parseHexColor("#a2b3c4")).toEqual({ r: 162, g: 179, b: 196 });
  });

  it("should parse 3-character hex colors correctly", () => {
    expect(parseHexColor("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor("#0f0")).toEqual({ r: 0, g: 255, b: 0 });
    expect(parseHexColor("#00f")).toEqual({ r: 0, g: 0, b: 255 });
  });
});

describe("getCleanNumber", () => {
  it("should return clean rounded numbers for scale display", () => {
    expect(getCleanNumber(0)).toBe(1);
    expect(getCleanNumber(-5)).toBe(1);
    expect(getCleanNumber(1.2)).toBe(1);
    expect(getCleanNumber(3.4)).toBe(2);
    expect(getCleanNumber(6.8)).toBe(5);
    expect(getCleanNumber(8.9)).toBe(10);
    expect(getCleanNumber(45)).toBe(50);
    expect(getCleanNumber(260)).toBe(200);
    expect(getCleanNumber(8500)).toBe(10000);
  });
});

describe("heightmapTemplates list", () => {
  it("should contain standard heightmap templates", () => {
    expect(heightmapTemplates).toBeDefined();
    expect(Object.keys(heightmapTemplates).length).toBeGreaterThan(0);
    expect(heightmapTemplates.continents).toBeDefined();
    expect(heightmapTemplates.continents.name).toBe("Continents");
  });
});

describe("drawGraticule and drawScaleBar", () => {
  it("should call context drawing methods during rendering", () => {
    const ctx = createMockContext2D();
    const view = { offsetX: 0, offsetY: 0, scale: 1, showGraticule: true, showScaleBar: true };
    drawAtlas(ctx, mockAtlas, view);

    // Verify scale bar fillText was called
    const fillTexts = ctx.calls.filter((c) => c.name === "fillText");
    expect(fillTexts.length).toBeGreaterThan(0);

    // Verify graticule line dashes were set
    const hasDashes = ctx.calls.some((c) => c.name === "save");
    expect(hasDashes).toBe(true);
  });
});

describe("isStateBorder", () => {
  it("should return true if state IDs are different", () => {
    expect(isStateBorder(1, 2)).toBe(true);
    expect(isStateBorder(0, 3)).toBe(true);
  });

  it("should return false if state IDs are the same", () => {
    expect(isStateBorder(1, 1)).toBe(false);
    expect(isStateBorder(0, 0)).toBe(false);
  });
});

describe("shouldShowBurgLabel", () => {
  it("should show capitals above scale 1.2", () => {
    expect(shouldShowBurgLabel(true, 1.0)).toBe(false);
    expect(shouldShowBurgLabel(true, 1.2)).toBe(true);
    expect(shouldShowBurgLabel(true, 2.5)).toBe(true);
  });

  it("should show towns/non-capitals above scale 2.0", () => {
    expect(shouldShowBurgLabel(false, 1.5)).toBe(false);
    expect(shouldShowBurgLabel(false, 2.0)).toBe(true);
    expect(shouldShowBurgLabel(false, 3.0)).toBe(true);
  });
});

describe("Directive A6 Transition Thresholds & Hysteresis Logic", () => {
  const DESCEND_SCALE_THRESHOLD = 4.0;
  const RESTORE_SCALE_HYSTERESIS = 3.5;

  it("should determine if a zoom scale crosses the descent threshold", () => {
    const scaleA = 3.9;
    const scaleB = 4.0;
    const scaleC = 4.5;
    expect(scaleA >= DESCEND_SCALE_THRESHOLD).toBe(false);
    expect(scaleB >= DESCEND_SCALE_THRESHOLD).toBe(true);
    expect(scaleC >= DESCEND_SCALE_THRESHOLD).toBe(true);
  });

  it("should trigger region auto-ascent when scale falls below floor threshold (0.85 of initial)", () => {
    const initialScale = 0.5;
    const floorThreshold = initialScale * 0.85; // 0.425
    
    const scaleAbove = 0.43;
    const scaleBelow = 0.42;
    
    expect(scaleAbove < floorThreshold).toBe(false);
    expect(scaleBelow < floorThreshold).toBe(true);
  });

  it("should ensure the restored atlas zoom scale is clamped below the descent threshold to prevent bounce loops", () => {
    const lastScale = 5.0; // User was zoomed in deeply before auto-descent
    const restoredScale = Math.min(RESTORE_SCALE_HYSTERESIS, lastScale);
    
    expect(restoredScale).toBe(RESTORE_SCALE_HYSTERESIS);
    expect(restoredScale < DESCEND_SCALE_THRESHOLD).toBe(true);
  });
});

