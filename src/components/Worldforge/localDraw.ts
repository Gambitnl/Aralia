/**
 * This file contains the pure drawing core that renders the L2 LOCAL layer
 * (a LocalArtifact: 600×600 5-ft material/elevation cells + feature list)
 * onto a 2D canvas context. It is the visual quality bar for replacing the
 * legacy Submap surface (Worldforge build order; Remy's 2026-06-11 focus:
 * Azgaar → submap → 3D world mode).
 *
 * Like atlasDraw/regionDraw it is DOM/React-free: unit tests drive it with a
 * stub context and headless proof scripts rasterize it without mounting UI.
 *
 * Rendering approach: terrain is rasterized once into an ImageData at NATIVE
 * cell resolution (1 px per 5-ft cell — 600×600) with per-cell material
 * color, elevation hillshading (NW light) and a water-depth ramp, then the
 * caller blits it scaled. Features draw as vector glyphs at view scale on
 * top so they stay crisp when zoomed.
 *
 * Called by: LocalMapView.tsx (interactive viewport), renderLocalProof
 * scripts. Depends on: systems/worldforge/artifacts (LocalArtifact shape).
 */

import type { LocalArtifact, LocalFeature, TerrainMaterial } from "../../systems/worldforge/artifacts";

// ── Material palette ─────────────────────────────────────────────────────────
// Indexed by the artifact's own materials array (order is an artifact
// contract; resolve by NAME here so palette stays correct if it grows).
const MATERIAL_COLORS: Record<TerrainMaterial, [number, number, number]> = {
  grass: [88, 128, 58],
  dirt: [128, 102, 68],
  rock: [124, 118, 110],
  sand: [202, 182, 132],
  wetland: [84, 110, 76],
  water: [42, 88, 132],
  paved: [148, 140, 128],
  floor: [160, 148, 128],
  // Glacier ice (Task 10 MOUNTAINS): 2D counterpart of terrainColor's ICE_RGB
  // (linear 0.86/0.90/0.95 → 0–255), a pale icy blue distinct from rock.
  ice: [219, 230, 242],
};

/** Per-kind feature glyph colors. */
const FEATURE_STYLE: Record<LocalFeature["kind"], { fill: string; stroke: string; radiusFt: number }> = {
  tree: { fill: "#2d5a27", stroke: "#1c3a18", radiusFt: 9 },
  bush: { fill: "#4a7a3a", stroke: "#2d5a27", radiusFt: 4.5 },
  boulder: { fill: "#8a857c", stroke: "#5c5850", radiusFt: 6 },
  "water-body": { fill: "#2a5884", stroke: "#1c3c5c", radiusFt: 8 },
  path: { fill: "#b09a72", stroke: "#8a7a5a", radiusFt: 4 },
  poi: { fill: "#d8b54a", stroke: "#8a6f1c", radiusFt: 7 },
  building: { fill: "#a06a4a", stroke: "#6b3a2a", radiusFt: 10 },
};

export interface LocalDrawOptions {
  /** Optional custom canvas width/height, falls back to ctx.canvas. */
  width?: number;
  height?: number;
  /** View transform (canvas px per FOOT + offsets). Fitted when omitted. */
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  /** Skip feature glyphs (terrain-only pass, e.g. for minimaps). */
  skipFeatures?: boolean;
  /** Atlas biome hue for the coherence chain — see rasterizeLocalTerrain. */
  biomeColor?: string;
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

/**
 * Rasterize the terrain grid into an ImageData at native cell resolution.
 * Exported separately so LocalMapView can cache it per artifact and the
 * unit tests can pin pixel-level goldens without a canvas.
 *
 * `biomeColor` (atlas `biomesData.color[biomeId]`, optional) carries the
 * L0→L1→L2 coherence chain down to the playable layer: the VEGETATED ground
 * materials (grass/wetland) blend 55% toward the atlas hue so a tropical
 * forest local reads tropical and a tundra local reads tundra, while
 * material-true surfaces (sand/dirt/rock/water/paved) stay themselves.
 */
export function rasterizeLocalTerrain(local: LocalArtifact, biomeColor?: string): ImageData {
  const { widthCells: w, heightCells: h, elevationFt, materialIndex, materials } = local.terrain;

  // Resolve palette through the artifact's own material order
  const biomeRGB = biomeColor ? parseHex(biomeColor) : null;
  const palette: [number, number, number][] = materials.map((m) => {
    const base = MATERIAL_COLORS[m] ?? ([255, 0, 255] as [number, number, number]);
    if (biomeRGB && (m === "grass" || m === "wetland")) {
      return [
        Math.round(base[0] * 0.45 + biomeRGB[0] * 0.55),
        Math.round(base[1] * 0.45 + biomeRGB[1] * 0.55),
        Math.round(base[2] * 0.45 + biomeRGB[2] * 0.55),
      ];
    }
    return base;
  });
  const waterIdx = materials.indexOf("water");

  // Local elevation range for shading amplitude
  let minE = Infinity;
  let maxE = -Infinity;
  for (let i = 0; i < elevationFt.length; i++) {
    const e = elevationFt[i];
    if (e < minE) minE = e;
    if (e > maxE) maxE = e;
  }
  const range = Math.max(1, maxE - minE);

  const img = new ImageData(w, h);
  const data = img.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const mat = materialIndex[i];
      let [r, g, b] = palette[mat] ?? [255, 0, 255];

      if (mat === waterIdx) {
        // Water: depth ramp instead of hillshade (deeper = darker)
        const t = (elevationFt[i] - minE) / range;
        r = Math.round(r * (0.7 + 0.5 * t));
        g = Math.round(g * (0.7 + 0.5 * t));
        b = Math.round(b * (0.75 + 0.4 * t));
      } else {
        // NW hillshade from the elevation gradient
        const eL = x > 0 ? elevationFt[i - 1] : elevationFt[i];
        const eR = x < w - 1 ? elevationFt[i + 1] : elevationFt[i];
        const eU = y > 0 ? elevationFt[i - w] : elevationFt[i];
        const eD = y < h - 1 ? elevationFt[i + w] : elevationFt[i];
        const slope = ((eR - eL) + (eD - eU)) / 2;
        const shade = Math.max(0.72, Math.min(1.28, 1 - (slope / range) * 90));

        // Faint elevation tint keeps large-scale relief readable at fit zoom
        const lift = 0.92 + 0.16 * ((elevationFt[i] - minE) / range);

        r = Math.round(r * shade * lift);
        g = Math.round(g * shade * lift);
        b = Math.round(b * shade * lift);
      }

      const o = i * 4;
      data[o] = Math.min(255, r);
      data[o + 1] = Math.min(255, g);
      data[o + 2] = Math.min(255, b);
      data[o + 3] = 255;
    }
  }

  return img;
}

/**
 * Draw the full local view: terrain blit + feature glyphs. The terrain
 * ImageData may be passed pre-rasterized (cache path); otherwise it is
 * computed on the fly.
 */
export function drawLocal(
  ctx: CanvasRenderingContext2D,
  local: LocalArtifact,
  options: LocalDrawOptions = {},
  terrainRaster?: ImageData,
): void {
  const canvasWidth = options.width ?? ctx.canvas?.width ?? 960;
  const canvasHeight = options.height ?? ctx.canvas?.height ?? 540;
  const { bounds } = local;
  const { widthCells: w, heightCells: h } = local.terrain;

  // Background
  ctx.fillStyle = "#0c1824";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Fit transform when not provided (same 95% rule as the other layers)
  const fitScale = Math.min(canvasWidth / bounds.width, canvasHeight / bounds.height) * 0.95;
  const scale = options.scale ?? fitScale;
  const offsetX = options.offsetX ?? (canvasWidth - bounds.width * scale) / 2;
  const offsetY = options.offsetY ?? (canvasHeight - bounds.height * scale) / 2;

  const tx = (xFeet: number) => (xFeet - bounds.x) * scale + offsetX;
  const ty = (yFeet: number) => (yFeet - bounds.y) * scale + offsetY;

  // ── Terrain blit ──────────────────────────────────────────────────────────
  const raster = terrainRaster ?? rasterizeLocalTerrain(local, options.biomeColor);
  // putImageData ignores the transform, so stage through an offscreen canvas
  const stage = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (stage) {
    stage.width = w;
    stage.height = h;
    const stageCtx = stage.getContext("2d");
    if (stageCtx) {
      stageCtx.putImageData(raster, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(stage, 0, 0, w, h, tx(bounds.x), ty(bounds.y), bounds.width * scale, bounds.height * scale);
    }
  }

  // ── Feature glyphs ────────────────────────────────────────────────────────
  if (!options.skipFeatures) {
    drawLocalFeatures(ctx, local, { scale, offsetX, offsetY });
  }
}

/**
 * Feature-glyph pass only — exported so LocalMapView can blit its cached
 * terrain raster and then overlay crisp vector features per frame without
 * re-rasterizing terrain through drawLocal.
 */
export function drawLocalFeatures(
  ctx: CanvasRenderingContext2D,
  local: LocalArtifact,
  view: { scale: number; offsetX: number; offsetY: number },
): void {
  const { bounds } = local;
  const { scale, offsetX, offsetY } = view;
  const tx = (xFeet: number) => (xFeet - bounds.x) * scale + offsetX;
  const ty = (yFeet: number) => (yFeet - bounds.y) * scale + offsetY;

  // Draw the canonical settlement plan before foliage glyphs. These are the
  // exact artifact streets and footprints Ground 3D consumes, so water/terrain
  // stays visible underneath while the selected place reads as the same town.
  if (local.townPlan) {
    const plan = local.townPlan;
    for (const street of plan.streets) {
      if (street.centerline.length < 2) continue;
      ctx.beginPath();
      street.centerline.forEach(([xFeet, yFeet], index) => {
        const x = tx(xFeet);
        const y = ty(yFeet);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1.25, street.widthFt * scale);
      ctx.strokeStyle = street.colorHex ?? '#b09a72';
      ctx.stroke();
    }

    // Plot wall and roof stamps mirror the generated 3D architecture palette;
    // civic roles keep their authored footprint, making landmark cues visible
    // without building a second schematic town renderer.
    for (const plot of plan.plots) {
      if (plot.footprint.length < 3) continue;
      ctx.beginPath();
      plot.footprint.forEach(([xFeet, yFeet], index) => {
        const x = tx(xFeet);
        const y = ty(yFeet);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.globalAlpha = 0.84;
      ctx.fillStyle = plot.wallColorHex ?? '#a06a4a';
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(0.75, 1.5 * scale);
      ctx.strokeStyle = plot.roofColorHex ?? '#5d3428';
      ctx.stroke();
    }

    // The town centroid is the selected-focus marker used by the entry CTA and
    // initial Ground spawn. Its canonical name makes the correspondence visible
    // even at fit zoom, while source id remains in the surrounding UI receipt.
    const points = plan.plots.flatMap((plot) => plot.footprint);
    if (points.length > 0) {
      const centerX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
      const centerY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
      const markerX = tx(centerX);
      const markerY = ty(centerY);
      const markerRadius = Math.max(5, 18 * scale);
      ctx.beginPath();
      ctx.arc(markerX, markerY, markerRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.24)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fbbf24';
      ctx.stroke();
      ctx.font = '600 12px Outfit, sans-serif';
      ctx.fillStyle = '#fff7d6';
      ctx.fillText(plan.identity?.name ?? `Town ${plan.burgId}`, markerX + markerRadius + 4, markerY - 4);
    }
  }

  {
    for (const f of local.features) {
      const style = FEATURE_STYLE[f.kind];
      if (!style) continue;
      const r = Math.max(1.2, style.radiusFt * scale);
      const x = tx(f.x);
      const y = ty(f.y);

      if (f.kind === "tree") {
        // Canopy disc with a darker rim and an offset highlight — reads as a
        // tree at fit zoom without per-tree image assets
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = style.fill;
        ctx.fill();
        ctx.lineWidth = Math.max(0.5, r * 0.18);
        ctx.strokeStyle = style.stroke;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fill();
      } else if (f.kind === "boulder") {
        // Slightly squashed ellipse
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = style.fill;
        ctx.fill();
        ctx.lineWidth = Math.max(0.5, r * 0.15);
        ctx.strokeStyle = style.stroke;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = style.fill;
        ctx.fill();
        ctx.lineWidth = Math.max(0.5, r * 0.15);
        ctx.strokeStyle = style.stroke;
        ctx.stroke();
      }
    }
  }
}
