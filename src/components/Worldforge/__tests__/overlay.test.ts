/**
 * Unit tests for the pure Worldforge map overlay drawing core.
 *
 * This test suite validates coordinate translations (Feet -> Canvas Screen Space)
 * for both L0 Atlas views and L1 Region views, tests marker styling rendering outputs,
 * and verifies that hover labels and facing directions are computed correctly.
 *
 * Runs on: Vitest unit testing framework
 */

import { describe, it, expect } from "vitest";
import { getMarkerScreenPos, drawOverlay, type OverlayMarker, type OverlayView, type OverlayBounds } from "../overlay";
import { FEET_PER_FMG_PIXEL } from "../../../systems/worldforge/adapter/atlasArtifact";

// ============================================================================
// Canvas Spy Helper
// ============================================================================
// Simple mock object that records canvas rendering API calls to assert drawings.
// ============================================================================

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
    get font() {
      return props.font;
    },
    set font(val) {
      props.font = val;
      calls.push({ name: "set_font", args: [val] });
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
    arc(x: number, y: number, r: number, sa: number, ea: number) {
      calls.push({ name: "arc", args: [x, y, r, sa, ea] });
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
    strokeRect(x: number, y: number, w: number, h: number) {
      calls.push({ name: "strokeRect", args: [x, y, w, h] });
    },
    save() {
      calls.push({ name: "save", args: [] });
    },
    restore() {
      calls.push({ name: "restore", args: [] });
    },
    fillText(text: string, x: number, y: number) {
      calls.push({ name: "fillText", args: [text, x, y] });
    },
    strokeText(text: string, x: number, y: number) {
      calls.push({ name: "strokeText", args: [text, x, y] });
    },
    measureText(text: string) {
      return { width: text.length * 6 };
    },
  } as unknown as CanvasRenderingContext2D & {
    calls: typeof calls;
    props: typeof props;
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Worldforge Overlay Coordinates", () => {
  it("should convert feet to canvas coordinates correctly in L0 Atlas view", () => {
    // Math: xFmg = feetX / FEET_PER_FMG_PIXEL
    // screenX = xFmg * scale + offsetX
    const view: OverlayView = {
      scale: 2.0,
      offsetX: 100,
      offsetY: 200,
    };
    
    const targetFeetX = 50 * FEET_PER_FMG_PIXEL; // should result in xFmg = 50
    const targetFeetY = 80 * FEET_PER_FMG_PIXEL; // should result in yFmg = 80
    
    const screenPos = getMarkerScreenPos({ x: targetFeetX, y: targetFeetY }, view);
    
    // Expected screen:
    // x = 50 * 2.0 + 100 = 200
    // y = 80 * 2.0 + 200 = 360
    expect(screenPos.x).toBeCloseTo(200);
    expect(screenPos.y).toBeCloseTo(360);
  });

  it("should convert feet to canvas coordinates correctly in L1 Region view using bounds offset", () => {
    // Math: screenX = (feetX - bounds.x) * scale + offsetX
    const view: OverlayView = {
      scale: 1.5,
      offsetX: 50,
      offsetY: 75,
    };
    const bounds: OverlayBounds = {
      x: 1000,
      y: 2000,
      width: 5000,
      height: 4000,
    };

    const targetFeetX = 2000;
    const targetFeetY = 3000;

    const screenPos = getMarkerScreenPos({ x: targetFeetX, y: targetFeetY }, view, bounds);

    // Expected screen:
    // x = (2000 - 1000) * 1.5 + 50 = 1550
    // y = (3000 - 2000) * 1.5 + 75 = 1575
    expect(screenPos.x).toBeCloseTo(1550);
    expect(screenPos.y).toBeCloseTo(1575);
  });
});

describe("Worldforge Overlay Drawer", () => {
  it("should render party markers with distinctive pulsing style and direction facing arrow", () => {
    const ctx = createMockContext2D();
    const markers: OverlayMarker[] = [
      {
        kind: "party",
        x: 10 * FEET_PER_FMG_PIXEL,
        y: 20 * FEET_PER_FMG_PIXEL,
        label: "Adventure Party",
        facing: Math.PI / 2, // Facing Downwards
      },
    ];
    const view: OverlayView = { scale: 1.0, offsetX: 0, offsetY: 0 };

    drawOverlay(ctx, markers, view);

    // Should contain canvas save/restore states
    expect(ctx.calls.some(c => c.name === "save")).toBe(true);
    expect(ctx.calls.some(c => c.name === "restore")).toBe(true);

    // Should draw arcs (circle) for party dots
    const arcCalls = ctx.calls.filter(c => c.name === "arc");
    expect(arcCalls.length).toBeGreaterThanOrEqual(2); // One outer ring, one inner core dot
    
    // First arc should draw at (10, 20) screen pixels
    expect(arcCalls[0].args[0]).toBe(10);
    expect(arcCalls[0].args[1]).toBe(20);

    // Outer pulse ring fill color should be translucent red
    const fillStyleCalls = ctx.calls.filter(c => c.name === "set_fillStyle");
    expect(fillStyleCalls.some(c => c.args[0] === "rgba(239, 68, 68, 0.22)")).toBe(true);

    // Inner dot fill color should be bright red
    expect(fillStyleCalls.some(c => c.args[0] === "#ef4444")).toBe(true);

    // Facing pointer wedge should be drawn (lineTo calls)
    const lineToCalls = ctx.calls.filter(c => c.name === "lineTo");
    expect(lineToCalls.length).toBeGreaterThanOrEqual(2);

    // Should render label text "Adventure Party"
    const textCalls = ctx.calls.filter(c => c.name === "strokeText" || c.name === "fillText");
    expect(textCalls.some(c => c.args[0] === "Adventure Party")).toBe(true);
  });

  it("should render quest markers as gold diamonds with name labels", () => {
    const ctx = createMockContext2D();
    const markers: OverlayMarker[] = [
      {
        kind: "quest",
        x: 30 * FEET_PER_FMG_PIXEL,
        y: 40 * FEET_PER_FMG_PIXEL,
        label: "Primary Objective",
      },
    ];
    const view: OverlayView = { scale: 1.0, offsetX: 0, offsetY: 0 };

    drawOverlay(ctx, markers, view);

    // Verify gold fill style color
    const fillStyleCalls = ctx.calls.filter(c => c.name === "set_fillStyle");
    expect(fillStyleCalls.some(c => c.args[0] === "#eab308")).toBe(true);

    // Verify polygon paths (four corners of diamond)
    const lineToCalls = ctx.calls.filter(c => c.name === "lineTo");
    expect(lineToCalls.length).toBe(3); // 3 lineTo + moveTo/closePath makes 4 points

    // Verify label text
    const textCalls = ctx.calls.filter(c => c.name === "fillText");
    expect(textCalls.some(c => c.args[0] === "Primary Objective")).toBe(true);
  });

  it("should render NPC markers and only display labels when mouse hover is within distance thresholds", () => {
    const markers: OverlayMarker[] = [
      {
        kind: "npc",
        x: 15 * FEET_PER_FMG_PIXEL,
        y: 25 * FEET_PER_FMG_PIXEL,
        label: "Remy",
      },
    ];

    // Case 1: Hover is far away (no tooltip should render)
    {
      const ctx = createMockContext2D();
      const view: OverlayView = { scale: 1.0, offsetX: 0, offsetY: 0, mouseX: 100, mouseY: 100 };
      drawOverlay(ctx, markers, view);
      
      const fillRectCalls = ctx.calls.filter(c => c.name === "fillRect");
      expect(fillRectCalls.length).toBe(0); // No tooltip card rectangle

      const textCalls = ctx.calls.filter(c => c.name === "fillText");
      expect(textCalls.length).toBe(0); // No tooltip name text
    }

    // Case 2: Hover is close (distance < 12px) (tooltip name card should render)
    {
      const ctx = createMockContext2D();
      // NPC screen coordinate is (15, 25)
      // Hover at (17, 27) -> distance = sqrt(4 + 4) = 2.82px < 12px
      const view: OverlayView = { scale: 1.0, offsetX: 0, offsetY: 0, mouseX: 17, mouseY: 27 };
      drawOverlay(ctx, markers, view);
      
      const fillRectCalls = ctx.calls.filter(c => c.name === "fillRect");
      expect(fillRectCalls.length).toBe(1); // Tooltip card rectangle drawn!

      const textCalls = ctx.calls.filter(c => c.name === "fillText");
      expect(textCalls.some(c => c.args[0] === "Remy")).toBe(true); // NPC label drawn!
    }
  });

  it("should respect offscreen canvas layering bounds and skip rendering offscreen markers", () => {
    const ctx = createMockContext2D();
    const markers: OverlayMarker[] = [
      {
        kind: "quest",
        x: -500 * FEET_PER_FMG_PIXEL, // screenX = -500 (far left offscreen)
        y: 20 * FEET_PER_FMG_PIXEL,
      },
      {
        kind: "quest",
        x: 10 * FEET_PER_FMG_PIXEL,
        y: 20 * FEET_PER_FMG_PIXEL, // screenX = 10, screenY = 20 (onscreen)
      },
    ];
    const view: OverlayView = { scale: 1.0, offsetX: 0, offsetY: 0 };
    drawOverlay(ctx, markers, view);

    // Check count of lineTo calls. Each diamond marker makes 3 lineTo calls.
    // Since only 1 marker is onscreen, we should see exactly 3 lineTo calls (not 6!).
    const lineToCalls = ctx.calls.filter(c => c.name === "lineTo");
    expect(lineToCalls.length).toBe(3);
  });
});
