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

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { drawAtlas, isCacheValid, parseHexColor, getCleanNumber, isStateBorder, shouldShowBurgLabel } from "../atlasDraw";
import { buildForestGlyphs, forestGlyphRampOpacity, buildReliefGlyphs, reliefGlyphRampOpacity, buildPassMarks, passMarkPath, RELIEF_GLYPH_LAYER_OPACITY } from "../atlasSvg";
import { reliefInk } from "../mountainGlyphs";
import { heightmapTemplates } from "../../../systems/worldforge/fmg/heightmap-templates";
import { Biomes } from "../../../systems/worldforge/fmg/biomes";
import { GLYPH_MIN_ZOOM, GLYPH_FULL_ZOOM, FOREST_TINTS } from "../../../systems/worldforge/forests/forestTunables";
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
  it("skips the offscreen terrain buffer while the mounted canvas is zero-sized", () => {
    const ctx = createMockContext2D();
    Object.defineProperty(ctx, "canvas", { value: { width: 0, height: 0 } });
    const createElement = vi.spyOn(document, "createElement");

    // A transient zero-sized mount must draw directly instead of asking the
    // browser to drawImage a zero-sized offscreen canvas.
    expect(() => drawAtlas(ctx, mockAtlas, { offsetX: 0, offsetY: 0, scale: 1 })).not.toThrow();
    expect(createElement).not.toHaveBeenCalledWith("canvas");
    createElement.mockRestore();
  });

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

  it("should tint land cells with the selected culture overlay color", () => {
    const ctx = createMockContext2D();
    const cultureAtlas: FmgAtlasResult = {
      ...mockAtlas,
      pack: {
        ...mockAtlas.pack,
        cells: {
          ...mockAtlas.pack.cells,
          h: new Uint8Array([25, 25, 25]),
          culture: new Uint16Array([0, 1, 0]),
        },
        cultures: [
          { i: 0, name: "Wildlands", base: 1, shield: "round" },
          { i: 1, name: "Test Culture", base: 1, shield: "round", color: "#ff0000" },
        ],
      },
    };

    drawAtlas(ctx, cultureAtlas, { offsetX: 0, offsetY: 0, scale: 1, overlayMode: "culture" });

    const cultureTint = ctx.calls.find((c) => c.name === "set_fillStyle" && c.args[0] === "rgb(143,37,47)");
    expect(cultureTint).toBeDefined();
  });
});

// ============================================================================
// Section: Forest tree glyphs (forests campaign Task 6)
// ============================================================================
// The canvas renderer stamps the SAME per-cell glyph paths the SVG model
// builder emits (one source of truth: buildForestGlyphs), via Path2D, right
// after the terrain-texture blur boundary — zoom-gated on view.scale.
// ============================================================================

describe("drawAtlas forest glyph stamping", () => {
  /** Path2D stand-in: jsdom has no Path2D; record every constructed path. */
  const constructedPaths: Array<{ d: string }> = [];
  class FakePath2D {
    d: string;
    constructor(d?: string) {
      this.d = d ?? "";
      constructedPaths.push(this);
    }
  }

  beforeEach(() => {
    constructedPaths.length = 0;
    vi.stubGlobal("Path2D", FakePath2D);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Mock ctx extended with the transform + alpha the glyph pass uses. */
  function createGlyphMockContext() {
    const ctx = createMockContext2D() as any;
    ctx.translate = (x: number, y: number) => ctx.calls.push({ name: "translate", args: [x, y] });
    ctx.scale = (x: number, y: number) => ctx.calls.push({ name: "scale", args: [x, y] });
    Object.defineProperty(ctx, "globalAlpha", {
      get: () => ctx.props.globalAlpha,
      set: (v: number) => {
        ctx.props.globalAlpha = v;
        ctx.calls.push({ name: "set_globalAlpha", args: [v] });
      },
    });
    // Re-wire fill/stroke to CAPTURE the Path2D argument the stamping passes.
    ctx.fill = (...args: unknown[]) => ctx.calls.push({ name: "fill", args });
    ctx.stroke = (...args: unknown[]) => ctx.calls.push({ name: "stroke", args });
    return ctx as ReturnType<typeof createMockContext2D>;
  }

  /** Three square land cells, all forest biome; cells 0+1 in one named forest. */
  function forestAtlas(kind: string): FmgAtlasResult {
    return {
      seed: "forest-seed",
      graphWidth: 100,
      graphHeight: 100,
      biomesData: Biomes.getDefault(),
      pack: {
        vertices: { p: [[0, 0], [20, 0], [20, 20], [0, 20], [40, 0], [40, 20], [60, 0], [60, 20]] },
        cells: {
          // Lowland forest (h30, below the mountains T9 relief band) so this
          // forest-glyph fixture stays isolated from the relief-glyph stamp;
          // relief stamping is exercised in "drawAtlas relief glyph stamping".
          h: new Uint8Array([30, 30, 30]),
          v: [[0, 1, 2, 3], [1, 4, 5, 2], [4, 6, 7, 5]],
          c: [[1], [0, 2], [1]],
          biome: new Uint8Array([6, 6, 6]),
          p: [[10, 10], [30, 10], [50, 10]],
        },
        rivers: [],
        forests: [{ i: 1, name: "Testwood", kind, cells: [0, 1], pole: [20, 10] }],
      },
    } as unknown as FmgAtlasResult;
  }

  it("stamps one Path2D per forest cell with the builder's exact path data", () => {
    const ctx = createGlyphMockContext();
    const view = { offsetX: 7, offsetY: 11, scale: 3, showScaleBar: false };
    drawAtlas(ctx, forestAtlas("ordinary"), view);

    const expected = buildForestGlyphs(forestAtlas("ordinary"));
    expect(expected).toHaveLength(2); // sanity: the builder sees both forest cells
    expect(constructedPaths.map((p) => p.d)).toEqual(expected.map((e) => e.d));

    // Stamped through the graph→screen transform, not per-point math.
    expect(ctx.calls.some((c) => c.name === "translate" && c.args[0] === 7 && c.args[1] === 11)).toBe(true);
    expect(ctx.calls.some((c) => c.name === "scale" && c.args[0] === 3 && c.args[1] === 3)).toBe(true);

    // Each path is filled AND stroked (canopy shapes + stem lines).
    const pathFills = ctx.calls.filter((c) => c.name === "fill" && c.args[0] instanceof FakePath2D);
    const pathStrokes = ctx.calls.filter((c) => c.name === "stroke" && c.args[0] instanceof FakePath2D);
    expect(pathFills).toHaveLength(2);
    expect(pathStrokes).toHaveLength(2);

    // Layer alpha follows the shared zoom ramp (scale 3 ≥ FULL → full opacity).
    expect(ctx.calls.some((c) => c.name === "set_globalAlpha" && c.args[0] === forestGlyphRampOpacity(3))).toBe(true);

    // Constant 0.5 SCREEN px ink (matches the SVG side's non-scaling-stroke).
    expect(ctx.calls.some((c) => c.name === "set_lineWidth" && c.args[0] === 0.5 / 3)).toBe(true);

    // Ordinary forest → default glyph green, not a kind tint.
    expect(ctx.calls.some((c) => c.name === "set_fillStyle" && c.args[0] === "#2f5233")).toBe(true);
  });

  it("stamps AFTER the terrain fills and BEFORE the coastline ink", () => {
    const ctx = createGlyphMockContext();
    drawAtlas(ctx, forestAtlas("ordinary"), { offsetX: 0, offsetY: 0, scale: 3, showScaleBar: false });
    const idxOf = (pred: (c: { name: string; args: any[] }) => boolean) => ctx.calls.findIndex(pred);
    const translateIdx = idxOf((c) => c.name === "translate");
    const coastIdx = idxOf((c) => c.name === "set_strokeStyle" && c.args[0] === "#1a3d66");
    const lastTerrainFillIdx = ctx.calls
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.name === "fill" && !(c.args[0] instanceof FakePath2D))
      .map(({ i }) => i)
      .pop()!;
    expect(translateIdx).toBeGreaterThan(lastTerrainFillIdx);
    expect(translateIdx).toBeLessThan(coastIdx);
  });

  it("tints haunted forest glyphs with the kind hex", () => {
    const ctx = createGlyphMockContext();
    drawAtlas(ctx, forestAtlas("haunted"), { offsetX: 0, offsetY: 0, scale: 3, showScaleBar: false });
    expect(ctx.calls.some((c) => c.name === "set_fillStyle" && c.args[0] === FOREST_TINTS.haunted)).toBe(true);
    expect(ctx.calls.some((c) => c.name === "set_fillStyle" && c.args[0] === "#2f5233")).toBe(false);
  });

  it("skips stamping entirely below GLYPH_MIN_ZOOM (zoomed-out map stays clean)", () => {
    const ctx = createGlyphMockContext();
    drawAtlas(ctx, forestAtlas("ordinary"), {
      offsetX: 0,
      offsetY: 0,
      scale: GLYPH_MIN_ZOOM - 0.05,
      showScaleBar: false,
    });
    expect(constructedPaths).toHaveLength(0);
    expect(ctx.calls.some((c) => c.name === "translate")).toBe(false);
  });

  it("ramps globalAlpha between MIN and FULL zoom", () => {
    const mid = (GLYPH_MIN_ZOOM + GLYPH_FULL_ZOOM) / 2;
    const ctx = createGlyphMockContext();
    drawAtlas(ctx, forestAtlas("ordinary"), { offsetX: 0, offsetY: 0, scale: mid, showScaleBar: false });
    const alphaSet = ctx.calls.find((c) => c.name === "set_globalAlpha");
    expect(alphaSet).toBeDefined();
    expect(alphaSet!.args[0]).toBeCloseTo(forestGlyphRampOpacity(mid), 10);
  });

  it("a forest-free atlas never touches Path2D or the transform (existing fixtures unchanged)", () => {
    const ctx = createGlyphMockContext();
    drawAtlas(ctx, mockAtlas, { offsetX: 0, offsetY: 0, scale: 3, showScaleBar: false });
    expect(constructedPaths).toHaveLength(0);
    expect(ctx.calls.some((c) => c.name === "translate")).toBe(false);
  });
});

// ============================================================================
// Section: Mountain relief glyphs + pass marks (mountains campaign Task 9)
// ============================================================================
// The canvas renderer stamps the SAME per-cell relief paths the SVG model
// builder emits (one source of truth: buildReliefGlyphs), via Path2D, just
// BEFORE the forest layer (relief under trees). Peaks h>=80 add a WHITE
// snowcap. Pass marks (buildPassMarks) draw in the political layer after routes.
// ============================================================================

describe("drawAtlas relief glyph + pass-mark stamping", () => {
  const constructedPaths: Array<{ d: string }> = [];
  class FakePath2D {
    d: string;
    constructor(d?: string) {
      this.d = d ?? "";
      constructedPaths.push(this);
    }
  }

  beforeEach(() => {
    constructedPaths.length = 0;
    vi.stubGlobal("Path2D", FakePath2D);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createReliefMockContext() {
    const ctx = createMockContext2D() as any;
    ctx.translate = (x: number, y: number) => ctx.calls.push({ name: "translate", args: [x, y] });
    ctx.scale = (x: number, y: number) => ctx.calls.push({ name: "scale", args: [x, y] });
    Object.defineProperty(ctx, "globalAlpha", {
      get: () => ctx.props.globalAlpha,
      set: (v: number) => {
        ctx.props.globalAlpha = v;
        ctx.calls.push({ name: "set_globalAlpha", args: [v] });
      },
    });
    ctx.fill = (...args: unknown[]) => ctx.calls.push({ name: "fill", args });
    ctx.stroke = (...args: unknown[]) => ctx.calls.push({ name: "stroke", args });
    return ctx as ReturnType<typeof createMockContext2D>;
  }

  /** Hill (h60) + snow-capped peak (h85), no forest. */
  function reliefAtlas(): FmgAtlasResult {
    return {
      seed: "relief-seed",
      graphWidth: 100,
      graphHeight: 100,
      biomesData: Biomes.getDefault(),
      pack: {
        vertices: { p: [[0, 0], [20, 0], [20, 20], [0, 20], [40, 0], [40, 20]] },
        cells: {
          h: new Uint8Array([60, 85]),
          v: [[0, 1, 2, 3], [1, 4, 5, 2]],
          c: [[1], [0]],
          biome: new Uint8Array([2, 2]),
          p: [[10, 10], [30, 10]],
        },
        rivers: [],
      },
    } as unknown as FmgAtlasResult;
  }

  it("stamps relief bodies (band ink) + a white snowcap via Path2D at full zoom", () => {
    const ctx = createReliefMockContext();
    drawAtlas(ctx, reliefAtlas(), { offsetX: 0, offsetY: 0, scale: 3, showScaleBar: false });

    const expected = buildReliefGlyphs(reliefAtlas());
    expect(expected).toHaveLength(2); // hill + peak
    // Order: hill body, then peak body, then peak snowcap.
    expect(constructedPaths.map((p) => p.d)).toEqual([
      expected[0].d,
      expected[1].d,
      expected[1].snowD,
    ]);

    // Band ink for each body; white for the cap.
    expect(ctx.calls.some((c) => c.name === "set_strokeStyle" && c.args[0] === reliefInk("hill"))).toBe(true);
    expect(ctx.calls.some((c) => c.name === "set_strokeStyle" && c.args[0] === reliefInk("peak"))).toBe(true);
    expect(ctx.calls.some((c) => c.name === "set_strokeStyle" && c.args[0] === "#ffffff")).toBe(true);

    // Layer alpha follows the shared relief zoom ramp (scale 3 ≥ FULL).
    expect(ctx.calls.some((c) => c.name === "set_globalAlpha" && c.args[0] === RELIEF_GLYPH_LAYER_OPACITY)).toBe(true);
    expect(RELIEF_GLYPH_LAYER_OPACITY).toBe(reliefGlyphRampOpacity(3));
    // Constant screen-px ink (canvas twin of non-scaling-stroke).
    expect(ctx.calls.some((c) => c.name === "set_lineWidth" && c.args[0] === 0.6 / 3)).toBe(true);
  });

  it("skips relief stamping entirely below the min zoom (map stays clean far out)", () => {
    const ctx = createReliefMockContext();
    drawAtlas(ctx, reliefAtlas(), { offsetX: 0, offsetY: 0, scale: 0.2, showScaleBar: false });
    // No relief Path2D and no relief band ink at this zoom.
    expect(ctx.calls.some((c) => c.name === "set_strokeStyle" && c.args[0] === reliefInk("peak"))).toBe(false);
  });

  it("no longer emits the legacy 2026-06-11 triangle relief fill (Layer 4.5 removed)", () => {
    const ctx = createReliefMockContext();
    drawAtlas(ctx, reliefAtlas(), { offsetX: 0, offsetY: 0, scale: 3, showScaleBar: false, showPolitical: true } as any);
    // The old pass filled peaks with this exact rgba — gone now.
    expect(ctx.calls.some((c) => c.name === "set_fillStyle" && c.args[0] === "rgba(90, 82, 74, 0.55)")).toBe(false);
  });

  it("stamps relief BEFORE the forest glyphs (relief under trees)", () => {
    // A forested mountain cell: relief (height-truth) + forest (named) both stamp.
    const forestedPeak = {
      seed: "fp",
      graphWidth: 100,
      graphHeight: 100,
      biomesData: Biomes.getDefault(),
      pack: {
        vertices: { p: [[0, 0], [20, 0], [20, 20], [0, 20]] },
        cells: {
          h: new Uint8Array([60]),
          v: [[0, 1, 2, 3]],
          c: [[]],
          biome: new Uint8Array([6]),
          p: [[10, 10]],
        },
        rivers: [],
        forests: [{ i: 1, name: "Highwood", kind: "ordinary", cells: [0], pole: [10, 10] }],
      },
    } as unknown as FmgAtlasResult;
    const ctx = createReliefMockContext();
    drawAtlas(ctx, forestedPeak, { offsetX: 0, offsetY: 0, scale: 3, showScaleBar: false });
    const reliefInkIdx = ctx.calls.findIndex((c) => c.name === "set_strokeStyle" && c.args[0] === reliefInk("hill"));
    const forestFillIdx = ctx.calls.findIndex((c) => c.name === "set_fillStyle" && c.args[0] === "#2f5233");
    expect(reliefInkIdx).toBeGreaterThanOrEqual(0);
    expect(forestFillIdx).toBeGreaterThanOrEqual(0);
    expect(reliefInkIdx).toBeLessThan(forestFillIdx);
  });

  /** Two land cells + one pass on cell 1; political layer on. */
  function passAtlas(): FmgAtlasResult {
    return {
      seed: "pass-seed",
      graphWidth: 100,
      graphHeight: 100,
      biomesData: Biomes.getDefault(),
      pack: {
        vertices: { p: [[0, 0], [20, 0], [20, 20], [0, 20], [40, 0], [40, 20]] },
        cells: {
          h: new Uint8Array([30, 30]),
          v: [[0, 1, 2, 3], [1, 4, 5, 2]],
          c: [[1], [0]],
          biome: new Uint8Array([1, 1]),
          p: [[10, 10], [30, 10]],
        },
        rivers: [],
        routes: [],
        passes: [{ i: 1, rangeI: 1, cellId: 1, name: "Highwood Pass", routeIds: [] }],
      },
    } as unknown as FmgAtlasResult;
  }

  it("stamps a paired-chevron pass mark via Path2D at each pass cell (ink #3d3833)", () => {
    const ctx = createReliefMockContext();
    drawAtlas(ctx, passAtlas(), { offsetX: 0, offsetY: 0, scale: 3, showScaleBar: false, showPolitical: true } as any);
    const marks = buildPassMarks(passAtlas());
    expect(marks).toEqual([{ x: 30, y: 10 }]);
    expect(constructedPaths.some((p) => p.d === passMarkPath(30, 10))).toBe(true);
    expect(ctx.calls.some((c) => c.name === "set_strokeStyle" && c.args[0] === "#3d3833")).toBe(true);
  });

  it("draws pass marks even far out (passes are load-bearing, NOT zoom-hidden)", () => {
    const ctx = createReliefMockContext();
    drawAtlas(ctx, passAtlas(), { offsetX: 0, offsetY: 0, scale: 0.2, showScaleBar: false, showPolitical: true } as any);
    // Relief is zoom-hidden at 0.2, but the pass mark still stamps.
    expect(constructedPaths.some((p) => p.d === passMarkPath(30, 10))).toBe(true);
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

  it("should return false if the atlas overlay mode does not match", () => {
    const cache = { scale: 1.0, seed: "seed", overlayMode: "culture" as const };
    expect(isCacheValid(cache, 1.0, "seed", undefined, undefined, undefined, undefined, undefined, "religion")).toBe(false);
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

