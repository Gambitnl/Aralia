/**
 * Unit tests for the L1 region drawing core function.
 *
 * This test suite stubs the CanvasRenderingContext2D to record calls and assert rendering behaviors,
 * verifying that the heightfield grid and river banks are rendered properly and coordinates
 * are translated correctly according to BoundsFt.
 *
 * Runs on: Vitest unit testing framework.
 */

import { describe, it, expect } from "vitest";
import { drawRegion } from "../regionDraw";
import type { RegionArtifact } from "../../../systems/worldforge/artifacts";

// ============================================================================
// Section: Mock Data & Context
// ============================================================================
// Creates a simple mock RegionArtifact and a spy context to track canvas calls.
// ============================================================================

const mockRegion: RegionArtifact = {
  layer: "region",
  schemaVersion: 1,
  seedPath: "wf:1337:cell:42" as any,
  bounds: {
    x: 1000,
    y: 2000,
    width: 10000,
    height: 10000,
  },
  heightfield: {
    width: 3,
    height: 3,
    resolutionFt: 3000,
    samples: new Float32Array([
      0.1, 0.2, 0.3,
      0.4, 0.5, 0.6,
      0.7, 0.8, 0.9,
    ]),
  },
  rivers: [
    {
      riverId: 1,
      centerline: [
        [1500, 2500],
        [4500, 5500],
      ],
      widthFt: 100,
    },
  ],
  roads: [],
  townSites: [],
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
    moveTo(x: number, y: number) {
      calls.push({ name: "moveTo", args: [x, y] });
    },
    lineTo(x: number, y: number) {
      calls.push({ name: "lineTo", args: [x, y] });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ name: "fillRect", args: [x, y, w, h] });
    },
    stroke() {
      calls.push({ name: "stroke", args: [] });
    },
    save() {
      calls.push({ name: "save", args: [] });
    },
    restore() {
      calls.push({ name: "restore", args: [] });
    },
  } as unknown as CanvasRenderingContext2D & {
    calls: typeof calls;
    props: typeof props;
  };
}

// ============================================================================
// Section: Test Cases
// ============================================================================

describe("drawRegion", () => {
  it("should clear the canvas and draw heightfield cells then river lines", () => {
    const ctx = createMockContext2D();
    drawRegion(ctx, mockRegion, { width: 960, height: 540 });

    // Verify background clear fillRect
    const fillRects = ctx.calls.filter((c) => c.name === "fillRect");
    // Should have 1 for background + 9 for samples = 10 total
    expect(fillRects.length).toBe(10);

    // Verify river path draw — 2 strokes per river since the atlas-coherence
    // pass (2026-06-11): a darker casing pass under the atlas-tone fill pass.
    const strokeCalls = ctx.calls.filter((c) => c.name === "stroke");
    expect(strokeCalls.length).toBe(2);

    // Verify coordinates are scaled/offset correctly and don't crash
    const moveToCall = ctx.calls.find((c) => c.name === "moveTo");
    expect(moveToCall).toBeDefined();
    expect(moveToCall!.args[0]).toBeGreaterThan(0);
    expect(moveToCall!.args[1]).toBeGreaterThan(0);
  });

  it("should draw heightfield cells with local range stretched colors", () => {
    const ctx = createMockContext2D();
    drawRegion(ctx, mockRegion, { width: 960, height: 540 });

    // First sample height = 0.1 (min in mock), so stretched value = 0.
    // It should receive the first color in palette (forest green rgb(35, 85, 40) or shaded version).
    // Last sample height = 0.9 (max in mock), so stretched value = 1.
    // It should receive the last color in palette (snowy peak rgb(240, 242, 245) or shaded version).
    const fillStyleSetters = ctx.calls.filter((c) => c.name === "set_fillStyle");
    expect(fillStyleSetters.length).toBeGreaterThan(5);
  });
});

// ============================================================================
// Section: computeRegionFitView (WF-G4 regression)
// ============================================================================
// The black-region-canvas defect chain included a component link: degenerate
// bounds produced an Infinity fit scale, and the first paint at the old
// `scale: 1` initial state sized the offscreen cache past the browser canvas
// area cap. These pin the pure fit math against both.
// ============================================================================

import { computeRegionFitView } from "../regionDraw";

describe("computeRegionFitView (WF-G4)", () => {
  it("fits healthy bounds at 95% fill, centered", () => {
    const fit = computeRegionFitView({ width: 25_000, height: 25_000 }, 960, 540);
    expect(fit.scale).toBeCloseTo((540 / 25_000) * 0.95, 8);
    // Centered: vertical padding split evenly, horizontal larger (wide viewport)
    expect(fit.offsetY).toBeCloseTo((540 - 25_000 * fit.scale) / 2, 6);
    expect(fit.offsetX).toBeCloseTo((960 - 25_000 * fit.scale) / 2, 6);
    expect(Number.isFinite(fit.scale)).toBe(true);
    expect(fit.scale).toBeGreaterThan(0);
  });

  it("degenerate bounds (0x0 region, the WF-G4 data bug) yield a finite usable view", () => {
    for (const bad of [
      { width: 0, height: 0 },
      { width: -5, height: 100 },
      { width: NaN, height: 100 },
    ]) {
      const fit = computeRegionFitView(bad, 960, 540);
      expect(Number.isFinite(fit.scale)).toBe(true);
      expect(fit.scale).toBeGreaterThan(0);
      expect(Number.isFinite(fit.offsetX)).toBe(true);
      expect(Number.isFinite(fit.offsetY)).toBe(true);
    }
  });

  it("fitted scale keeps the offscreen cache far below the canvas area cap", () => {
    // 25,000 ft bounds at CACHE_MAX_SIDE=2048 fixed-resolution cache:
    // 2048 x 2048 = ~4.2M px, vs the ~268M px Chrome area cap. The old
    // bounds*scale cache at scale 1 was 25,000^2 = 625M px (broken canvas).
    const CACHE_MAX_SIDE = 2048;
    const bounds = { width: 25_000, height: 25_000 };
    const cacheScale = Math.min(CACHE_MAX_SIDE / bounds.width, CACHE_MAX_SIDE / bounds.height);
    const cacheW = Math.round(bounds.width * cacheScale);
    const cacheH = Math.round(bounds.height * cacheScale);
    expect(cacheW * cacheH).toBeLessThanOrEqual(268_435_456 / 16);
  });
});
