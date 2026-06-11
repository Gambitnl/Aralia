/**
 * Unit tests for the pure atlas drawing core function.
 *
 * This test suite stubs the CanvasRenderingContext2D to record calls and assert rendering behaviors,
 * verifying that layers are drawn in the correct order, colors match the biome mappings,
 * rivers are rendered properly, and view transformation scale/offsets are applied correctly.
 *
 * Runs on: Vitest unit testing framework
 */

import { describe, it, expect } from "vitest";
import { drawAtlas } from "../atlasDraw";
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
    latStart: 0,
    latEnd: 10,
    lonStart: 0,
    lonEnd: 10,
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
  } as unknown as CanvasRenderingContext2D & {
    calls: typeof calls;
    props: typeof props;
  };
}

// ============================================================================
// Section: Test Cases
// ============================================================================

describe("drawAtlas", () => {
  it("should draw layers in correct order (water cells filled before land cells)", () => {
    const ctx = createMockContext2D();
    const view = { offsetX: 10, offsetY: 20, scale: 2 };
    drawAtlas(ctx, mockAtlas, view);

    // Find all 'fill' calls and check what fillStyle was active right before them
    const fillStyleTransitions: string[] = [];
    let currentFillStyle = "";

    for (const call of ctx.calls) {
      if (call.name === "set_fillStyle") {
        currentFillStyle = call.args[0];
      } else if (call.name === "fill") {
        fillStyleTransitions.push(currentFillStyle);
      }
    }

    // First fill should be the water cell's depth tint color
    // Then should come the land cell colors from biomesData.color
    expect(fillStyleTransitions.length).toBeGreaterThanOrEqual(3);

    // First fill style after clearRect should be a water rgb color (representing Cell 0, which is water)
    expect(fillStyleTransitions[0]).toContain("rgb");

    // Subsequent fill styles should correspond to land cell biomes (LandBiomeA: #334455, LandBiomeB: #667788)
    expect(fillStyleTransitions[1]).toBe("#334455");
    expect(fillStyleTransitions[2]).toBe("#667788");
  });

  it("should draw coastline stroke between land and water cells", () => {
    const ctx = createMockContext2D();
    const view = { offsetX: 10, offsetY: 20, scale: 2 };
    drawAtlas(ctx, mockAtlas, view);

    // Assert that a stroke call is made with the coastline color
    const strokeCalls = ctx.calls.filter((c) => c.name === "stroke");
    expect(strokeCalls.length).toBeGreaterThanOrEqual(1);

    // Look for the coastline styling: strokeStyle should be '#1a3d66'
    const coastlineStrokeCall = ctx.calls.find(
      (c) => c.name === "set_strokeStyle" && c.args[0] === "#1a3d66"
    );
    expect(coastlineStrokeCall).toBeDefined();
  });

  it("should draw the correct number of river polylines", () => {
    const ctx = createMockContext2D();
    const view = { offsetX: 10, offsetY: 20, scale: 2 };
    drawAtlas(ctx, mockAtlas, view);

    // The mock atlas has 1 river with 2 cells.
    // The river draws when pts.length >= 2, so it should generate moveTo/lineTo and a stroke.
    const riverStrokeStyleCall = ctx.calls.filter(
      (c) => c.name === "set_strokeStyle" && c.args[0] === "#3d6fa8"
    );
    expect(riverStrokeStyleCall.length).toBe(1);
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
    const hasTransformedLine = ctx.calls.some(
      (c) => c.name === "lineTo" && c.args[0] === 130 && c.args[1] === 230
    );

    expect(hasTransformedMove || hasTransformedLine).toBe(true);
  });
});
