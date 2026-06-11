/**
 * This file contains the pure drawing function that renders the FMG world map onto a 2D canvas context.
 *
 * It is designed to be completely independent of the DOM or React. This allows it to be used in
 * unit tests using a mock canvas context, and in headless node/Playwright scripts to generate
 * proof-of-concept images without mounting any UI components.
 *
 * Called by: AtlasMapView.tsx (React UI wrapper), renderAtlasProof.ts (headless verification script)
 * Depends on: generateAtlas.ts (supplies the cells, rivers, and biome color maps)
 */

import type { FmgAtlasResult } from "../../systems/worldforge/fmg/generateAtlas";

// ============================================================================
// Types
// ============================================================================
// Defines the view options used to scale and position the map on the canvas.
// ============================================================================

export interface AtlasView {
  offsetX: number;
  offsetY: number;
  scale: number;
}

// ============================================================================
// Drawing Core
// ============================================================================
// The main rendering function that draws the map layers in order.
// ============================================================================

export function drawAtlas(
  ctx: CanvasRenderingContext2D,
  atlas: FmgAtlasResult,
  view: AtlasView
): void {
  const { pack, biomesData } = atlas;
  const cellsN = pack.cells.h.length;
  const verts = pack.vertices.p as Array<[number, number]>;
  const biomeColors = biomesData.color;

  // Helper to translate map coordinates to canvas screen coordinates
  const tx = (x: number) => x * view.scale + view.offsetX;
  const ty = (y: number) => y * view.scale + view.offsetY;

  // Clear/fill the background with a deep ocean blue.
  // This acts as a fallback for any areas not covered by cell geometry.
  const canvasWidth = ctx.canvas?.width ?? 960;
  const canvasHeight = ctx.canvas?.height ?? 540;
  ctx.fillStyle = "#0e2d52";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // --------------------------------------------------------------------------
  // Layer 1: Ocean Fill with Depth Tint
  // --------------------------------------------------------------------------
  // Draw all cells that are under water (height < 20).
  // The color gets lighter blue as the water gets shallower (closer to height 20).
  // --------------------------------------------------------------------------
  for (let i = 0; i < cellsN; i++) {
    const h = pack.cells.h[i];
    if (h >= 20) continue; // Skip land cells for this layer

    const vIds = pack.cells.v[i];
    if (!vIds || vIds.length < 3) continue;

    // Calculate a color that transitions from deep ocean blue to shallow coastal blue
    const t = Math.max(0, h / 20);
    ctx.fillStyle = `rgb(${Math.round(15 + 40 * t)},${Math.round(55 + 70 * t)},${Math.round(115 + 75 * t)})`;

    ctx.beginPath();
    const firstVert = verts[vIds[0]];
    if (firstVert) {
      ctx.moveTo(tx(firstVert[0]), ty(firstVert[1]));
      for (let k = 1; k < vIds.length; k++) {
        const p = verts[vIds[k]];
        if (p) ctx.lineTo(tx(p[0]), ty(p[1]));
      }
    }
    ctx.closePath();
    ctx.fill();
  }

  // --------------------------------------------------------------------------
  // Layer 2: Land Cells Filled by Biome Color
  // --------------------------------------------------------------------------
  // Draw all cells that are above water (height >= 20).
  // The color is determined by the cell's biome classification.
  // --------------------------------------------------------------------------
  for (let i = 0; i < cellsN; i++) {
    const h = pack.cells.h[i];
    if (h < 20) continue; // Skip water cells for this layer

    const vIds = pack.cells.v[i];
    if (!vIds || vIds.length < 3) continue;

    const biomeIdx = pack.cells.biome?.[i] ?? 0;
    ctx.fillStyle = biomeColors[biomeIdx] ?? "#888888";

    ctx.beginPath();
    const firstVert = verts[vIds[0]];
    if (firstVert) {
      ctx.moveTo(tx(firstVert[0]), ty(firstVert[1]));
      for (let k = 1; k < vIds.length; k++) {
        const p = verts[vIds[k]];
        if (p) ctx.lineTo(tx(p[0]), ty(p[1]));
      }
    }
    ctx.closePath();
    ctx.fill();
  }

  // --------------------------------------------------------------------------
  // Layer 3: Coastline Stroke
  // --------------------------------------------------------------------------
  // Draw thin lines separating land cells from water cells.
  // We identify shared edges between adjacent land and water cells.
  // --------------------------------------------------------------------------
  ctx.beginPath();
  for (let i = 0; i < cellsN; i++) {
    const h = pack.cells.h[i];
    if (h < 20) continue; // Only process land cells as the source

    const vIds = pack.cells.v[i];
    const neighbors = pack.cells.c[i];
    if (!vIds || !neighbors) continue;

    for (const j of neighbors) {
      const neighborHeight = pack.cells.h[j];
      if (neighborHeight < 20) {
        // This neighbor is water. Look for the shared boundary edge.
        const jVerts = pack.cells.v[j];
        if (!jVerts) continue;

        for (let k = 0; k < vIds.length; k++) {
          const v1 = vIds[k];
          const v2 = vIds[(k + 1) % vIds.length];

          // If both vertices are in the water cell's vertex list, it's a shared edge
          if (jVerts.includes(v1) && jVerts.includes(v2)) {
            const p1 = verts[v1];
            const p2 = verts[v2];
            if (p1 && p2) {
              ctx.moveTo(tx(p1[0]), ty(p1[1]));
              ctx.lineTo(tx(p2[0]), ty(p2[1]));
            }
          }
        }
      }
    }
  }
  ctx.strokeStyle = "#1a3d66"; // Dark blue/gray coastline stroke
  ctx.lineWidth = 1.5 * view.scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // --------------------------------------------------------------------------
  // Layer 4: Rivers as Polylines
  // --------------------------------------------------------------------------
  // Draw rivers flowing through the cells.
  // River line widths are scaled based on view zoom and discharge levels.
  // --------------------------------------------------------------------------
  ctx.strokeStyle = "#3d6fa8"; // Medium blue river color
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const r of pack.rivers || []) {
    const pts = r.cells;
    if (!pts || pts.length < 2) continue;

    // Calculate a width that scales with zoom and river discharge width
    const w = Math.max(0.6, Math.min(3.5, (r.width ?? 1) * 1.5)) * view.scale;
    ctx.lineWidth = w;

    ctx.beginPath();
    let first = true;
    for (const c of pts) {
      if (c < 0) continue;
      const p = pack.cells.p[c];
      if (!p) continue;

      if (first) {
        ctx.moveTo(tx(p[0]), ty(p[1]));
        first = false;
      } else {
        ctx.lineTo(tx(p[0]), ty(p[1]));
      }
    }
    ctx.stroke();
  }
}
