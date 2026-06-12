// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 11/06/2026, 03:03:15
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Worldforge Overlay Rendering Core
 *
 * This module implements a pure canvas-based drawing overlay for showing live entities
 * (the adventure party, non-player characters/NPCs, and active quest markers) on top of
 * the procedural maps.
 *
 * Architectural Design & Decisions:
 * 1. Purity: The functions here accept a CanvasRenderingContext2D and coordinates, and
 *    perform straight pixel calculations. There are no React hooks or DOM lookups. This
 *    allows it to run inside unit tests (Vitest) and headless browser scripts (Playwright).
 * 2. Coordinate Space: Canonical positions are stored in REAL-WORLD FEET.
 *    - In the L0 Atlas Map: FMG coordinates are pixels on a 960x540 canvas.
 *      To convert Feet to FMG pixels, we divide by FEET_PER_FMG_PIXEL.
 *      To convert FMG pixels to screen canvas coordinates, we apply the viewport scale and offset.
 *    - In the L1 Region Map: The region has a bounds box specified in feet.
 *      To convert Feet to screen canvas coordinates, we subtract bounds.x/y and scale/offset.
 * 3. Aesthetics:
 *    - Party: A large pulsing red ring + inner solid red dot. Includes an optional direction arrow
 *      representing the "facing" property. The pulse effect uses Date.now() for continuous animation.
 *    - NPC: Small neutral grey dots. If the user's cursor is near the NPC (hover distance < 12px),
 *      it renders a premium slate-grey tooltip card showing the NPC's name.
 *    - Quest: A classic gold/amber diamond symbol with a thin white outline and gold text labels.
 *
 * Gaps / Unfinished Work:
 * - Hover detection operates on screen pixel distances. If markers overlap, tooltips might collide.
 * - Pulse animation requires redraw ticks (e.g. requestAnimationFrame loop in the React viewer).
 */

import { FEET_PER_FMG_PIXEL } from "../../systems/worldforge/adapter/atlasArtifact";

// ============================================================================
// Interfaces & Types
// ============================================================================

export interface OverlayMarker {
  kind: "party" | "npc" | "quest";
  x: number; // position in feet
  y: number; // position in feet
  label?: string; // name or description label
  facing?: number; // facing direction in radians (optional)
}

export interface OverlayView {
  scale: number;
  offsetX: number;
  offsetY: number;
  mouseX?: number; // active mouse pointer x on canvas (for hovers)
  mouseY?: number; // active mouse pointer y on canvas (for hovers)
}

export interface OverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Coordinate Helper
// ============================================================================

/**
 * Translates a marker's real-world feet coordinates to screen canvas pixels
 * using either L1 Region bounds or L0 Atlas scaling coefficients.
 */
export function getMarkerScreenPos(
  marker: { x: number; y: number },
  view: OverlayView,
  bounds?: OverlayBounds
): { x: number; y: number } {
  if (bounds) {
    // Region (L1) Coordinate Space:
    // (Feet - BoundsMinFeet) * ViewScale + PanOffset
    return {
      x: (marker.x - bounds.x) * view.scale + view.offsetX,
      y: (marker.y - bounds.y) * view.scale + view.offsetY,
    };
  } else {
    // Atlas (L0) Coordinate Space:
    // (Feet / FEET_PER_FMG_PIXEL) * ViewScale + PanOffset
    return {
      x: (marker.x / FEET_PER_FMG_PIXEL) * view.scale + view.offsetX,
      y: (marker.y / FEET_PER_FMG_PIXEL) * view.scale + view.offsetY,
    };
  }
}

// ============================================================================
// Main Draw Routine
// ============================================================================

/**
 * Draws all overlay markers onto the canvas context.
 * Renders above cache layers to maintain dynamic movements and animations during panning.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  markers: OverlayMarker[],
  view: OverlayView,
  bounds?: OverlayBounds
): void {
  // Pulse factor calculation using current time to animate party ring size
  // Math.sin creates a periodic oscillation between 0.8 and 1.3
  const time = typeof Date !== "undefined" ? Date.now() : 0;
  const pulse = 1.05 + 0.25 * Math.sin(time / 180);

  // Draw each marker in sequence
  for (const marker of markers) {
    const { x, y, kind, label, facing } = marker;
    const { x: sx, y: sy } = getMarkerScreenPos({ x, y }, view, bounds);

    // Skip drawing if the coordinate is far outside the viewport boundaries to save rendering ticks
    const canvasWidth = ctx.canvas?.width ?? 960;
    const canvasHeight = ctx.canvas?.height ?? 540;
    if (sx < -50 || sx > canvasWidth + 50 || sy < -50 || sy > canvasHeight + 50) {
      continue;
    }

    ctx.save();

    if (kind === "party") {
      // 1. Party styling (pulsing red outer circle + inner solid red dot)
      // Representing the primary players/protagonists

      // Pulsing outer aura ring
      ctx.beginPath();
      ctx.arc(sx, sy, 8 * pulse, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(239, 68, 68, 0.22)"; // translucent red
      ctx.strokeStyle = "rgba(239, 68, 68, 0.85)"; // semi-solid red outline
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // Inner core dot
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = "#ef4444"; // solid bright red
      ctx.strokeStyle = "#ffffff"; // white ring border
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();

      // Optional directional pointer wedge indicating facing angle
      if (facing !== undefined) {
        const arrowLen = 11;
        const arrowWid = 5;
        
        ctx.beginPath();
        // Tip of the arrow
        ctx.moveTo(sx + Math.cos(facing) * arrowLen, sy + Math.sin(facing) * arrowLen);
        // Left corner
        ctx.lineTo(
          sx + Math.cos(facing + Math.PI - 0.55) * arrowWid,
          sy + Math.sin(facing + Math.PI - 0.55) * arrowWid
        );
        // Right corner
        ctx.lineTo(
          sx + Math.cos(facing + Math.PI + 0.55) * arrowWid,
          sy + Math.sin(facing + Math.PI + 0.55) * arrowWid
        );
        ctx.closePath();

        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#b91c1c"; // darker border
        ctx.lineWidth = 1.0;
        ctx.fill();
        ctx.stroke();
      }

      // Draw party label if supplied
      if (label) {
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.strokeStyle = "rgba(10, 20, 40, 0.85)";
        ctx.lineWidth = 2.5;
        ctx.strokeText(label, sx, sy + 11);
        ctx.fillStyle = "#fca5a5"; // Light red text
        ctx.fillText(label, sx, sy + 11);
      }

    } else if (kind === "quest") {
      // 2. Quest styling (premium gold diamond shape)
      // Indicates active mission objectives or critical locations

      ctx.beginPath();
      ctx.moveTo(sx, sy - 6.5);
      ctx.lineTo(sx + 6.5, sy);
      ctx.lineTo(sx, sy + 6.5);
      ctx.lineTo(sx - 6.5, sy);
      ctx.closePath();

      ctx.fillStyle = "#eab308"; // bright gold
      ctx.strokeStyle = "#ffffff"; // white outline
      ctx.lineWidth = 1.2;
      ctx.fill();
      ctx.stroke();

      // Draw quest label centered below the gold diamond
      if (label) {
        ctx.font = "bold 9.5px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.strokeStyle = "rgba(10, 20, 40, 0.9)";
        ctx.lineWidth = 2.5;
        ctx.strokeText(label, sx, sy + 8);
        ctx.fillStyle = "#fef08a"; // gold yellow text
        ctx.fillText(label, sx, sy + 8);
      }

    } else if (kind === "npc") {
      // 3. NPC styling (small neutral dot + hover tooltip nameplate)
      // Represents townsfolk, merchants, or monsters

      ctx.beginPath();
      ctx.arc(sx, sy, 3.2, 0, 2 * Math.PI);
      ctx.fillStyle = "#cbd5e1"; // neutral light grey
      ctx.strokeStyle = "#334155"; // dark slate border
      ctx.lineWidth = 1.0;
      ctx.fill();
      ctx.stroke();

      // Hover check: calculate distance from canvas cursor position
      const isHovered =
        view.mouseX !== undefined &&
        view.mouseY !== undefined &&
        Math.hypot(sx - view.mouseX, sy - view.mouseY) < 12;

      // Render name tooltip if hovered or zoom is highly detailed
      if (isHovered && label) {
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

        const textWidth = ctx.measureText(label).width;
        
        // Premium dark gray background card with subtle border
        ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
        ctx.lineWidth = 1.0;
        ctx.fillRect(sx - textWidth / 2 - 4.5, sy - 17.5, textWidth + 9, 11.5);
        ctx.strokeRect(sx - textWidth / 2 - 4.5, sy - 17.5, textWidth + 9, 11.5);

        ctx.fillStyle = "#f3f4f6"; // light text
        ctx.fillText(label, sx, sy - 8.5);
      }
    }

    ctx.restore();
  }
}
