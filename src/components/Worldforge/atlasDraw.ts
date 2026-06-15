// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 09:06:27
 * Dependents: components/Worldforge/AtlasDemo.tsx, components/Worldforge/AtlasMapView.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file contains the pure drawing functions that render the FMG world map onto a 2D canvas context.
 *
 * It is completely decoupled from the DOM or React. This allows it to be used in unit tests
 * using a mock canvas context, and in headless node/Playwright scripts to generate map proof
 * images.
 *
 * Features implemented:
 * 1. Smooth radial ocean depth gradient (decoupled from cell facets)
 * 2. Land cell biome rendering + NW slope-based hillshading (3D terrain relief)
 * 3. Double-stroke coastlines (wider shelf glow + crisp dark blue boundary stroke)
 * 4. River discharge width-scaled polylines
 * 5. Optional graticule grid lines (latitude & longitude dashed curves/lines)
 * 6. Alternating miles/feet scale bar inside a translucent background box
 * 7. Optional atlas overlays:
 *    - Territory color tint blending for state, culture, religion, or province ownership
 *    - Crisp state border strokes (dark-purple boundaries along shared Voronoi edges)
 *    - Route networks (roads as solid brown, trails as thin dashed stone-grey, sea routes as dashed light-blue)
 *    - Burg markers (capitals as larger double red/white circles, towns as small white circles)
 *    - Serif state name labels and sans-serif burg name labels with zoom thresholds (capitals at scale >= 1.2, towns at scale >= 2.0)
 *    - Simple 2D bounding-box collision detection to declutter labels and prevent overlaps
 *
 * Called by: AtlasMapView.tsx (React UI wrapper), renderAtlasProof.ts (headless verification script)
 * Depends on: generateAtlas.ts, generateWorld.ts, and atlasArtifact.ts (for FEET_PER_FMG_PIXEL)
 */

import type { FmgAtlasResult } from "../../systems/worldforge/fmg/generateAtlas";
import { FEET_PER_FMG_PIXEL } from "../../systems/worldforge/adapter/atlasArtifact";

// ============================================================================
// Types
// ============================================================================

export interface AtlasView {
  offsetX: number;
  offsetY: number;
  scale: number;
  showScaleBar?: boolean; // Default true
  showGraticule?: boolean; // Default false
  showPolitical?: boolean; // Default false
  /** Cell tint mode for atlas territory overlays. Political remains the default FMG view. */
  overlayMode?: AtlasOverlayMode;
  /** Points of interest (pack.markers — Markers.generate port). Default false. */
  showMarkers?: boolean;
  /** Event/danger areas (pack.zones — Zones.generate port). Default false. */
  showZones?: boolean;
  /** State regiments (states[].military — Military.generate port). Default false. */
  showMilitary?: boolean;
  /** Voronoi cell mesh — thin edges on every cell (Azgaar "Cells" layer). Default false. */
  showCells?: boolean;
}

export interface CacheView {
  scale: number;
  seed: string;
  showGraticule?: boolean;
  showPolitical?: boolean;
  overlayMode?: AtlasOverlayMode;
  showMarkers?: boolean;
  showZones?: boolean;
  showMilitary?: boolean;
  showCells?: boolean;
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export type AtlasOverlayMode = "political" | "culture" | "religion" | "province";

interface AtlasOverlayEntity {
  i?: number;
  name?: string;
  fullName?: string;
  color?: string;
  removed?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Checks whether a cached render is still valid for the current rendering request.
 * If the user switches atlas tint modes or toggles static layers, the cache is invalidated.
 */
export function isCacheValid(
  cacheView: CacheView | null,
  nextScale: number,
  nextSeed: string,
  nextShowGraticule?: boolean,
  nextShowPolitical?: boolean,
  nextShowMarkers?: boolean,
  nextShowZones?: boolean,
  nextShowMilitary?: boolean,
  nextOverlayMode?: AtlasOverlayMode,
  nextShowCells?: boolean
): boolean {
  if (!cacheView) return false;
  return (
    cacheView.scale === nextScale &&
    cacheView.seed === nextSeed &&
    cacheView.showGraticule === nextShowGraticule &&
    cacheView.showPolitical === nextShowPolitical &&
    cacheView.showMarkers === nextShowMarkers &&
    cacheView.showZones === nextShowZones &&
    cacheView.showMilitary === nextShowMilitary &&
    cacheView.overlayMode === nextOverlayMode &&
    cacheView.showCells === nextShowCells
  );
}

/**
 * Parses a standard hexadecimal color code (e.g. "#2ca25f") into its red, green,
 * and blue integer values (0-255). Supports both 3-character and 6-character hex formats.
 */
export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b };
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Confirms that a generated FMG color is safe to parse as a canvas hex color.
 * Some ported entities can be present before the color field is populated, so
 * overlay drawing must not depend on the upstream color always existing.
 */
function isHexColor(value: string | undefined): value is string {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/**
 * Produces a deterministic fallback color from an entity's kind, id and name.
 * This preserves visual distinctions for unfinished or partially generated FMG
 * records without adding random colors that would change between renders.
 */
function stableHashColor(
  kind: AtlasOverlayMode,
  id: number,
  entity?: AtlasOverlayEntity
): { r: number; g: number; b: number } {
  const text = `${kind}:${id}:${entity?.fullName ?? entity?.name ?? ""}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const hue = Math.abs(hash) % 360;
  const saturation = 0.58;
  const lightness = 0.52;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = hue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (huePrime < 1) {
    r1 = chroma;
    g1 = x;
  } else if (huePrime < 2) {
    r1 = x;
    g1 = chroma;
  } else if (huePrime < 3) {
    g1 = chroma;
    b1 = x;
  } else if (huePrime < 4) {
    g1 = x;
    b1 = chroma;
  } else if (huePrime < 5) {
    r1 = x;
    b1 = chroma;
  } else {
    r1 = chroma;
    b1 = x;
  }

  const m = lightness - chroma / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/**
 * Looks up the selected per-cell overlay assignment and returns the entity tint.
 * Cell id 0 / neutral assignments intentionally return null so the base biome
 * terrain remains visible for wildlands, no-religion, and no-province cells.
 */
function getOverlayColor(
  atlas: FmgAtlasResult,
  cellId: number,
  mode: AtlasOverlayMode
): { r: number; g: number; b: number } | null {
  const { pack } = atlas;
  const cells = pack.cells;
  const overlaySources = {
    political: { ids: cells.state, entities: pack.states as AtlasOverlayEntity[] | undefined },
    culture: { ids: cells.culture, entities: pack.cultures as AtlasOverlayEntity[] | undefined },
    religion: { ids: cells.religion, entities: pack.religions as AtlasOverlayEntity[] | undefined },
    province: { ids: cells.province, entities: pack.provinces as AtlasOverlayEntity[] | undefined },
  };
  const source = overlaySources[mode];
  const entityId = source.ids?.[cellId] ?? 0;
  if (entityId <= 0) return null;

  const entity = source.entities?.[entityId];
  if (entity?.removed) return null;
  if (isHexColor(entity?.color)) return parseHexColor(entity.color);
  return stableHashColor(mode, entityId, entity);
}

/**
 * Utility to find the nearest clean round number (1, 2, 5, 10, 20, 50, etc.)
 * below or close to the target value for scale display rendering.
 */
export function getCleanNumber(val: number): number {
  if (val <= 1) return 1;
  const d = Math.floor(Math.log10(val));
  const base = Math.pow(10, d);
  const ratio = val / base;
  if (ratio < 1.5) return 1 * base;
  if (ratio < 3.5) return 2 * base;
  if (ratio < 7.5) return 5 * base;
  return 10 * base;
}

/**
 * Pure helper function to determine if a border exists between two states.
 */
export function isStateBorder(stateIdA: number, stateIdB: number): boolean {
  return stateIdA !== stateIdB;
}

/**
 * Pure helper function to determine if a burg name should be shown based on capital status and scale.
 */
export function shouldShowBurgLabel(isCapital: boolean, scale: number): boolean {
  if (isCapital) {
    return scale >= 1.2;
  } else {
    return scale >= 2.0;
  }
}

/**
 * Helper to check if two bounding boxes intersect (AABB collision check).
 */
export function intersects(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

// ============================================================================
// Drawing Sub-Layers
// ============================================================================

/**
 * Draws the dashed graticule grid lines mapping coordinate lines on the map canvas.
 */
export function drawGraticule(
  ctx: CanvasRenderingContext2D,
  atlas: FmgAtlasResult,
  view: AtlasView
): void {
  const { mapCoordinates, graphWidth = 960, graphHeight = 540 } = atlas;
  if (!mapCoordinates) return;

  const tx = (x: number) => x * view.scale + view.offsetX;
  const ty = (y: number) => y * view.scale + view.offsetY;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 0.8;
  ctx.setLineDash([4, 4]);

  const lonW = mapCoordinates.lonW;
  const lonE = mapCoordinates.lonE;
  const latS = mapCoordinates.latS;
  const latN = mapCoordinates.latN;

  // Render vertical longitude lines every 2 degrees
  const step = 2;
  const startLon = Math.ceil(lonW / step) * step;
  for (let lon = startLon; lon <= lonE; lon += step) {
    const t = (lon - lonW) / (lonE - lonW || 1);
    const x = t * graphWidth;
    ctx.beginPath();
    ctx.moveTo(tx(x), ty(0));
    ctx.lineTo(tx(x), ty(graphHeight));
    ctx.stroke();
  }

  // Render horizontal latitude lines every 2 degrees
  const startLat = Math.ceil(latS / step) * step;
  for (let lat = startLat; lat <= latN; lat += step) {
    const t = (lat - latS) / (latN - latS || 1);
    const y = (1 - t) * graphHeight;
    ctx.beginPath();
    ctx.moveTo(tx(0), ty(y));
    ctx.lineTo(tx(graphWidth), ty(y));
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws the cartographic scale bar (miles and feet alternating indicator).
 */
export function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  atlas: FmgAtlasResult,
  view: AtlasView
): void {
  const canvasHeight = ctx.canvas?.height ?? 540;

  // Target width of the scale bar is ~120 screen pixels.
  // We translate this distance into real-world miles.
  const targetPixels = 120;
  const targetMiles = (targetPixels / view.scale) * FEET_PER_FMG_PIXEL / 5280;
  const cleanMiles = getCleanNumber(targetMiles);
  const cleanFeet = cleanMiles * 5280;

  // Translate clean real miles back to screen pixels width
  const screenWidth = (cleanFeet / FEET_PER_FMG_PIXEL) * view.scale;

  // Draw translucent background panel
  const px = 20;
  const py = canvasHeight - 40;
  const pw = screenWidth + 24;
  const ph = 24;

  ctx.save();
  ctx.fillStyle = "rgba(10, 20, 40, 0.65)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  ctx.fillRect(px, py, pw, ph);
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.stroke();

  // Draw the scale bar segments
  const bx = px + 12;
  const by = py + 12;
  const bw = screenWidth;
  const bh = 5;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx, by, bw, bh);

  // Draw the dark segment representing the left half
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(bx, by, bw / 2, bh);

  // Draw text labels
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "#f3f4f6";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  ctx.fillText("0", bx, by - 2);
  ctx.fillText(`${cleanMiles} mi`, bx + bw, by - 2);

  ctx.restore();
}

// ============================================================================
// Main Drawing Function
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

  const tx = (x: number) => x * view.scale + view.offsetX;
  const ty = (y: number) => y * view.scale + view.offsetY;

  const canvasWidth = ctx.canvas?.width ?? 960;
  const canvasHeight = ctx.canvas?.height ?? 540;
  const overlayMode = view.overlayMode ?? "political";

  // --------------------------------------------------------------------------
  // Layer 0: Radial Ocean Depth Gradient Background
  // --------------------------------------------------------------------------
  const grad = ctx.createRadialGradient(
    tx(atlas.graphWidth / 2),
    ty(atlas.graphHeight / 2),
    50 * view.scale,
    tx(atlas.graphWidth / 2),
    ty(atlas.graphHeight / 2),
    Math.max(atlas.graphWidth, atlas.graphHeight) * view.scale
  );
  grad.addColorStop(0, "#1c497d");
  grad.addColorStop(1, "#091a33");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // --------------------------------------------------------------------------
  // Layer 1: Ocean Cell Fill with depth tint
  // --------------------------------------------------------------------------
  for (let i = 0; i < cellsN; i++) {
    const h = pack.cells.h[i];
    if (h >= 20) continue; // Skip land cells

    const vIds = pack.cells.v[i];
    if (!vIds || vIds.length < 3) continue;

    const t = Math.max(0, h / 20);
    // Draw with partial transparency to let the smooth radial background shine through
    ctx.fillStyle = `rgba(${Math.round(15 + 40 * t)},${Math.round(55 + 70 * t)},${Math.round(115 + 75 * t)}, 0.45)`;

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
  // Layer 2: Land Cells with NW slope shading and political state color blending
  // --------------------------------------------------------------------------
  for (let i = 0; i < cellsN; i++) {
    const h = pack.cells.h[i];
    if (h < 20) continue; // Skip water cells

    const vIds = pack.cells.v[i];
    if (!vIds || vIds.length < 3) continue;

    const biomeIdx = pack.cells.biome?.[i] ?? 0;
    const biomeHexColor = biomeColors[biomeIdx] ?? "#888888";
    const { r, g, b } = parseHexColor(biomeHexColor);

    let rFinal = r;
    let gFinal = g;
    let bFinal = b;

    // Blend the selected atlas overlay into the terrain tint. Political,
    // culture, religion and province all color the same cell surface, so only
    // one can be active at a time; neutral id 0 deliberately keeps biome color.
    const overlayColor = getOverlayColor(atlas, i, overlayMode);
    if (overlayColor) {
      rFinal = r * 0.55 + overlayColor.r * 0.45;
      gFinal = g * 0.55 + overlayColor.g * 0.45;
      bFinal = b * 0.55 + overlayColor.b * 0.45;
    }

    // Elevation tint (relief pass, 2026-06-11): highlands lift toward
    // rock-grey so mountain massifs read at a glance — Azgaar's terrain
    // look. Eases in above the lowland band (h 40), ~85% blend at peaks.
    const elev = Math.max(0, (h - 40) / 60);
    if (elev > 0) {
      const tLift = elev * elev * 0.85;
      rFinal = rFinal + (236 - rFinal) * tLift;
      gFinal = gFinal + (235 - gFinal) * tLift;
      bFinal = bFinal + (232 - bFinal) * tLift;
    }

    // Compute NW slope relief shading
    let dx = 0;
    let dy = 0;
    let count = 0;
    const neighbors = pack.cells.c[i];
    const p_i = pack.cells.p[i];
    if (neighbors && p_i) {
      for (const j of neighbors) {
        const h_j = pack.cells.h[j];
        const p_j = pack.cells.p[j];
        if (p_j) {
          const dist = Math.hypot(p_j[0] - p_i[0], p_j[1] - p_i[1]) || 1;
          dx += ((h_j - h) * (p_j[0] - p_i[0])) / (dist * dist);
          dy += ((h_j - h) * (p_j[1] - p_i[1])) / (dist * dist);
          count++;
        }
      }
    }
    const gx = count > 0 ? dx / count : 0;
    const gy = count > 0 ? dy / count : 0;

    const slope = gx * -0.707 + gy * -0.707;
    const shade = Math.max(-0.06, Math.min(0.06, slope));
    const adjust = Math.max(0.75, Math.min(1.25, 1 - shade * 6.0));

    ctx.fillStyle = `rgb(${Math.round(rFinal * adjust)},${Math.round(gFinal * adjust)},${Math.round(bFinal * adjust)})`;

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
  // Layer 2.5: Voronoi Cell Mesh (Azgaar "Cells" layer)
  // --------------------------------------------------------------------------
  // Thin edge on every cell so individual Voronoi cells are visible — the
  // mesh the whole atlas is built from. Drawn under coastlines/borders/labels
  // (as upstream FMG layers the Cells under map ink). One batched path; shared
  // edges double-stroke at low alpha, which is visually indistinguishable and
  // far cheaper than de-duplicating ~6k cells' edges.
  if (view.showCells) {
    ctx.beginPath();
    for (let i = 0; i < cellsN; i++) {
      const vIds = pack.cells.v[i];
      if (!vIds || vIds.length < 3) continue;
      const firstVert = verts[vIds[0]];
      if (!firstVert) continue;
      ctx.moveTo(tx(firstVert[0]), ty(firstVert[1]));
      for (let k = 1; k < vIds.length; k++) {
        const p = verts[vIds[k]];
        if (p) ctx.lineTo(tx(p[0]), ty(p[1]));
      }
      ctx.closePath();
    }
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgba(30,38,56,0.4)";
    ctx.stroke();
  }

  // --------------------------------------------------------------------------
  // Layer 3: Coastline Double Stroke
  // --------------------------------------------------------------------------
  const coastlineEdges: Array<[[number, number], [number, number]]> = [];
  for (let i = 0; i < cellsN; i++) {
    const h = pack.cells.h[i];
    if (h < 20) continue; // Land cell is source

    const vIds = pack.cells.v[i];
    const neighbors = pack.cells.c[i];
    if (!vIds || !neighbors) continue;

    for (const j of neighbors) {
      if (pack.cells.h[j] < 20) {
        // Neighbor is water. Extract shared boundary edge.
        const jVerts = pack.cells.v[j];
        if (!jVerts) continue;

        for (let k = 0; k < vIds.length; k++) {
          const v1 = vIds[k];
          const v2 = vIds[(k + 1) % vIds.length];

          if (jVerts.includes(v1) && jVerts.includes(v2)) {
            const p1 = verts[v1];
            const p2 = verts[v2];
            if (p1 && p2) {
              coastlineEdges.push([p1, p2]);
            }
          }
        }
      }
    }
  }

  // Draw coastline shelf glow
  ctx.save();
  ctx.strokeStyle = "rgba(100, 180, 240, 0.35)";
  ctx.lineWidth = 4 * view.scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [p1, p2] of coastlineEdges) {
    ctx.moveTo(tx(p1[0]), ty(p1[1]));
    ctx.lineTo(tx(p2[0]), ty(p2[1]));
  }
  ctx.stroke();
  ctx.restore();

  // Draw crisp coastline border
  ctx.save();
  ctx.strokeStyle = "#1a3d66";
  ctx.lineWidth = 1.5 * view.scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [p1, p2] of coastlineEdges) {
    ctx.moveTo(tx(p1[0]), ty(p1[1]));
    ctx.lineTo(tx(p2[0]), ty(p2[1]));
  }
  ctx.stroke();
  ctx.restore();

  // --------------------------------------------------------------------------
  // Layer 4: Rivers as Polylines
  // --------------------------------------------------------------------------
  ctx.save();
  ctx.strokeStyle = "#3d6fa8";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const r of pack.rivers || []) {
    const pts = r.cells;
    if (!pts || pts.length < 2) continue;

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
  ctx.restore();

  // --------------------------------------------------------------------------
  // Layer 4.5: Relief glyphs (relief pass, 2026-06-11) — Azgaar-style
  // mountain/hill marks so elevation reads as cartography, not just tint.
  // Peaks (h ≥ 65) always draw; hills (50–64) draw on alternating cells to
  // keep density pleasant. Size follows height; screen-scaled so glyphs
  // stay legible at any zoom without swallowing the map.
  // --------------------------------------------------------------------------
  {
    ctx.save();
    ctx.lineJoin = "round";
    for (let i = 0; i < cellsN; i++) {
      const h = pack.cells.h[i];
      if (h < 50) continue;
      const isPeak = h >= 65;
      if (!isPeak && i % 2 === 0) continue; // thin the hill band

      const p = pack.cells.p[i];
      if (!p) continue;
      const x = tx(p[0]);
      const y = ty(p[1]);
      const size = (isPeak ? 3.2 + ((h - 65) / 35) * 2.4 : 2.2) * Math.max(1, Math.sqrt(view.scale));

      ctx.beginPath();
      ctx.moveTo(x - size, y + size * 0.6);
      ctx.lineTo(x, y - size);
      ctx.lineTo(x + size, y + size * 0.6);
      if (isPeak) {
        ctx.fillStyle = "rgba(90, 82, 74, 0.55)";
        ctx.fill();
        ctx.strokeStyle = "rgba(50, 45, 40, 0.65)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(90, 82, 74, 0.45)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Layer 5: Political Overlay Features (State Borders, Routes, Burgs, Labels)
  // --------------------------------------------------------------------------
  const labelsToDraw: Array<{
    text: string;
    x: number;
    y: number;
    font: string;
    textColor: string;
    haloColor: string;
    haloWidth: number;
    isState: boolean;
  }> = [];

  if (view.showPolitical) {
    // 5.1 State borders edge-tracing
    if (pack.cells.state) {
      ctx.save();
      ctx.strokeStyle = "#2d1b38";
      ctx.lineWidth = 1.5 * view.scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();

      for (let i = 0; i < cellsN; i++) {
        const h = pack.cells.h[i];
        if (h < 20) continue;
        const s_i = pack.cells.state[i];

        const neighbors = pack.cells.c[i];
        const vIds_i = pack.cells.v[i];
        if (!neighbors || !vIds_i) continue;

        for (const j of neighbors) {
          if (j <= i) continue; // Trace each edge once

          const s_j = pack.cells.state[j];
          if (isStateBorder(s_i, s_j)) {
            const vIds_j = pack.cells.v[j];
            if (!vIds_j) continue;

            const shared = vIds_i.filter((v) => vIds_j.includes(v));
            if (shared.length === 2) {
              const p1 = verts[shared[0]];
              const p2 = verts[shared[1]];
              if (p1 && p2) {
                ctx.moveTo(tx(p1[0]), ty(p1[1]));
                ctx.lineTo(tx(p2[0]), ty(p2[1]));
              }
            }
          }
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 5.2 Routes (roads, trails, and sea routes using points array)
    if (pack.routes) {
      for (const route of pack.routes) {
        const pts = route.points;
        if (!pts || pts.length < 2) continue;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tx(pts[0][0]), ty(pts[0][1]));
        for (let k = 1; k < pts.length; k++) {
          ctx.lineTo(tx(pts[k][0]), ty(pts[k][1]));
        }

        if (route.group === "roads") {
          ctx.strokeStyle = "#8b5a2b"; // Solid brown
          ctx.lineWidth = 1.2 * view.scale;
          ctx.setLineDash([]);
        } else if (route.group === "trails") {
          ctx.strokeStyle = "#708090"; // Stone grey
          ctx.lineWidth = 0.8 * view.scale;
          ctx.setLineDash([3, 3]);
        } else if (route.group === "searoutes") {
          ctx.strokeStyle = "#87cefa"; // Light blue
          ctx.lineWidth = 1.0 * view.scale;
          ctx.setLineDash([4, 4]);
        }

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5.3 Burg markers (Circles)
    if (pack.burgs) {
      for (const burg of pack.burgs) {
        if (!burg || !burg.i || burg.removed) continue;

        const bx = tx(burg.x);
        const by = ty(burg.y);

        ctx.save();
        if (burg.capital) {
          // Capital symbol: outer white circle + inner rose-red circle
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(bx, by, 5, 0, 2 * Math.PI);
          ctx.fill();

          ctx.fillStyle = "#e11d48";
          ctx.beginPath();
          ctx.arc(bx, by, 2.5, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          // Burg symbol: small white circle with thin dark border
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#374151";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(bx, by, 2, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();

        // 5.4 Queue burg name labels based on zoom thresholds
        const showLabel = shouldShowBurgLabel(burg.capital === 1, view.scale);
        if (showLabel && burg.name) {
          labelsToDraw.push({
            text: burg.name,
            x: bx,
            y: by - 6, // Offset slightly above burg
            font: burg.capital ? "bold 10px sans-serif" : "9px sans-serif",
            textColor: burg.capital ? "#111827" : "#374151",
            haloColor: "#ffffff",
            haloWidth: burg.capital ? 2.5 : 2,
            isState: false,
          });
        }
      }
    }

    // 5.5 Queue state name labels (serif Georgia at state centers/poles)
    if (pack.states) {
      for (const state of pack.states) {
        if (!state || !state.i || state.removed) continue;

        // Position name label at the state's pole of inaccessibility, or fallback to center cell centroid
        const pole = state.pole ?? (pack.cells.p[state.center] as [number, number]);
        if (!pole) continue;

        const sx = tx(pole[0]);
        const sy = ty(pole[1]);

        labelsToDraw.push({
          text: state.name.toUpperCase(),
          x: sx,
          y: sy,
          font: `bold 12px Georgia, serif`,
          textColor: "#2d1b38",
          haloColor: "#ffffff",
          haloWidth: 3,
          isState: true,
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // Layer 5.5: Zones — event/danger areas from the Zones.generate port
  // (2026-06-11 detail-density pass). Flat translucent tints per zone type
  // stand in for upstream's SVG hatch patterns; drawn under labels so names
  // stay readable.
  // --------------------------------------------------------------------------
  if (view.showZones) {
    const zones = (pack as unknown as { zones?: Array<{ type: string; cells: number[] }> }).zones ?? [];
    const ZONE_TINTS: Record<string, string> = {
      Invasion: "220,38,38",
      Rebels: "249,115,22",
      Proselytism: "168,85,247",
      Crusade: "124,58,237",
      Disease: "132,204,22",
      Disaster: "245,158,11",
      Eruption: "239,68,68",
      Avalanche: "226,232,240",
      Fault: "146,64,14",
      Flood: "56,189,248",
      Tsunami: "14,165,233",
    };
    for (const zone of zones) {
      const tint = ZONE_TINTS[zone.type] ?? "148,163,184";
      ctx.fillStyle = `rgba(${tint},0.30)`;
      ctx.strokeStyle = `rgba(${tint},0.65)`;
      ctx.lineWidth = 1;
      for (const cellId of zone.cells) {
        const vIds = pack.cells.v[cellId];
        if (!vIds || vIds.length < 3) continue;
        ctx.beginPath();
        const firstVert = verts[vIds[0]];
        if (!firstVert) continue;
        ctx.moveTo(tx(firstVert[0]), ty(firstVert[1]));
        for (let k = 1; k < vIds.length; k++) {
          const p = verts[vIds[k]];
          if (p) ctx.lineTo(tx(p[0]), ty(p[1]));
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Layer 6: Draw queued labels using bounding-box decluttering
  // --------------------------------------------------------------------------
  // We draw state names first (as they have higher priority) then burg names
  // --------------------------------------------------------------------------
  const bboxes: BBox[] = [];
  const sortedLabels = [...labelsToDraw].sort((a, b) => (a.isState === b.isState ? 0 : a.isState ? -1 : 1));

  ctx.save();
  for (const lbl of sortedLabels) {
    ctx.font = lbl.font;
    const textWidth = ctx.measureText(lbl.text).width;
    const textHeight = lbl.isState ? 12 : 9;
    const padding = 2;

    const box: BBox = {
      minX: lbl.x - textWidth / 2 - padding,
      maxX: lbl.x + textWidth / 2 + padding,
      minY: lbl.y - textHeight / 2 - padding,
      maxY: lbl.y + textHeight / 2 + padding,
    };

    // Check for collisions
    let collides = false;
    for (const drawnBox of bboxes) {
      if (intersects(box, drawnBox)) {
        collides = true;
        break;
      }
    }

    if (!collides) {
      // Draw text with halo
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.strokeStyle = lbl.haloColor;
      ctx.lineWidth = lbl.haloWidth;
      ctx.strokeText(lbl.text, lbl.x, lbl.y);

      ctx.fillStyle = lbl.textColor;
      ctx.fillText(lbl.text, lbl.x, lbl.y);

      bboxes.push(box);
    }
  }
  ctx.restore();

  // --------------------------------------------------------------------------
  // Layer 6.5: Markers — points of interest from the Markers.generate port.
  // Emoji glyphs at a fixed SCREEN size (icons identify, they don't measure)
  // over a soft halo disc for readability on any terrain.
  // --------------------------------------------------------------------------
  if (view.showMarkers) {
    const markers = (pack as unknown as {
      markers?: Array<{ icon: string; x: number; y: number }>;
    }).markers ?? [];
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "11px serif";
    for (const m of markers) {
      const x = tx(m.x);
      const y = ty(m.y);
      ctx.beginPath();
      ctx.arc(x, y, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.fill();
      ctx.strokeStyle = "rgba(55,65,81,0.9)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.fillText(m.icon, x, y + 0.5);
    }
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Layer 6.6: Military — state regiments from the Military.generate port.
  // Diamond badge in the OWNER STATE's tint + unit icon; fleets float at sea.
  // --------------------------------------------------------------------------
  if (view.showMilitary) {
    const states = (pack as unknown as {
      states?: Array<{ i: number; removed?: boolean; color?: string; military?: Array<{ x: number; y: number; icon?: string }> }>;
    }).states ?? [];
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const s of states) {
      if (!s.i || s.removed || !s.military) continue;
      for (const r of s.military) {
        const x = tx(r.x);
        const y = ty(r.y);
        ctx.beginPath();
        ctx.moveTo(x, y - 8);
        ctx.lineTo(x + 8, y);
        ctx.lineTo(x, y + 8);
        ctx.lineTo(x - 8, y);
        ctx.closePath();
        ctx.fillStyle = s.color ?? "#64748b";
        ctx.fill();
        ctx.strokeStyle = "rgba(17,24,39,0.85)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = "9px serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(r.icon ?? "⚔️", x, y + 0.5);
      }
    }
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Layer 7: Graticule Grid (Latitude/Longitude lines)
  // --------------------------------------------------------------------------
  if (view.showGraticule) {
    drawGraticule(ctx, atlas, view);
  }

  // --------------------------------------------------------------------------
  // Layer 8: Scale Bar (Miles and Feet)
  // --------------------------------------------------------------------------
  if (view.showScaleBar !== false) {
    drawScaleBar(ctx, atlas, view);
  }
}
