// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 09:51:50
 * Dependents: components/Worldforge/LocalMapView.tsx, components/Worldforge/RegionMapView.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file contains the pure drawing function that renders the refined L1 region map
 * from a RegionArtifact onto a 2D canvas context.
 *
 * It is designed to be completely independent of the DOM or React. This allows it to be used in
 * unit tests using a mock canvas context, and in headless node/Playwright scripts to generate
 * proof-of-concept images without mounting any UI components.
 *
 * Layer drawing sequence:
 * 1. Hypsometric color heightfield grid cells with local min/max stretch and NW slope shading.
 * 2. River banks as width-scaled blue polyline paths.
 * 3. Town sites (empty placeholder loop for future C2 expansion).
 * 4. Roads (empty placeholder loop for future C2 expansion).
 *
 * Called by: AtlasDemo.tsx (React UI wrapper), renderAtlasProof.ts (headless verification script).
 * Depends on: generateRegion.ts (supplies the RegionArtifact data prop).
 */

import type { RegionArtifact } from "../../systems/worldforge/artifacts";
import { smoothRegionRiverCenterline } from "../../systems/worldforge/region/riverCenterlineSmoothing";

// ============================================================================
// Types
// ============================================================================
// Defines options for adjusting the view or style of the region render.
// ============================================================================

export interface RegionDrawOptions {
  /** Optional custom canvas width, falls back to ctx.canvas.width. */
  width?: number;
  /** Optional custom canvas height, falls back to ctx.canvas.height. */
  height?: number;
  /** Optional custom scale factor. If not provided, computed to fit canvas. */
  scale?: number;
  /** Optional custom X offset in canvas space. */
  offsetX?: number;
  /** Optional custom Y offset in canvas space. */
  offsetY?: number;
  /**
   * Atlas coherence (Remy, 2026-06-11): the anchor cell's biome color from
   * `atlas.biomesData.color[biomeId]` â€” the region tints its land with the
   * SAME hue the atlas shows at the descend point, so L1 reads as a zoomed
   * piece of L0 rather than a generic green ramp. When omitted, the legacy
   * hypsometric palette renders (kept for tests/back-compat).
   */
  biomeColor?: string;
}

/** Atlas water language (atlasDraw.ts): deepâ†’shallow ocean ramp. */
const WATER_DEEP: [number, number, number] = [9, 26, 51]; // #091a33
const WATER_SHALLOW: [number, number, number] = [28, 73, 125]; // #1c497d
/** Region samples below this normalized height are water (FMG h<20 â‰™ 0.2). */
const REGION_WATER_LEVEL = 0.2;

function parseHexColor(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

/** A fitted view: scale + centering offsets for a bounds inside a viewport. */
export interface RegionFitView {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Compute the fitted view (95% fill, centered) for region bounds inside a
 * viewport. Pure â€” extracted from RegionMapView for the WF-G4 regression
 * tests: degenerate bounds (zero/negative extent) must yield a FINITE,
 * positive scale rather than Infinity, which propagated into an unusable
 * offscreen cache canvas and a black region view.
 */
export function computeRegionFitView(
  bounds: { width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
): RegionFitView {
  if (!(bounds.width > 0) || !(bounds.height > 0)) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }
  const scale = Math.min(viewportWidth / bounds.width, viewportHeight / bounds.height) * 0.95;
  return {
    scale,
    offsetX: (viewportWidth - bounds.width * scale) / 2,
    offsetY: (viewportHeight - bounds.height * scale) / 2,
  };
}

// ============================================================================
// Drawing Core
// ============================================================================
// The main rendering function that draws the L1 region layers in order.
// ============================================================================

export function drawRegion(
  ctx: CanvasRenderingContext2D,
  region: RegionArtifact,
  options: RegionDrawOptions = {}
): void {
  // ============================================================================
  // Color Palette (Hypsometric Tints)
  // ============================================================================
  // We translate normalized height values to color values. Green represents low-lying
  // valley zones, shifting to yellows/oranges, browns, and finally white snow peaks.
  // ============================================================================

  interface ColorStop {
    h: number;
    r: number;
    g: number;
    b: number;
  }

  const HYPSOMETRIC_PALETTE: ColorStop[] = [
    { h: 0.0, r: 35, g: 85, b: 40 },    // Deep forest/valley green
    { h: 0.2, r: 75, g: 145, b: 80 },   // Meadow green
    { h: 0.4, r: 215, g: 200, b: 125 }, // Sandy flats/dry valleys
    { h: 0.65, r: 165, g: 120, b: 75 },  // Foothill brown
    { h: 0.85, r: 105, g: 70, b: 40 },   // Alpine/rocky brown
    { h: 1.0, r: 240, g: 242, b: 245 }  // Snowy mountain peaks
  ];

  /**
   * Linear interpolation to determine the color at a specific normalized height.
   */
  function getHypsometricColor(h: number): { r: number; g: number; b: number } {
    if (h <= 0) return { r: HYPSOMETRIC_PALETTE[0].r, g: HYPSOMETRIC_PALETTE[0].g, b: HYPSOMETRIC_PALETTE[0].b };
    const lastIdx = HYPSOMETRIC_PALETTE.length - 1;
    if (h >= 1) return { r: HYPSOMETRIC_PALETTE[lastIdx].r, g: HYPSOMETRIC_PALETTE[lastIdx].g, b: HYPSOMETRIC_PALETTE[lastIdx].b };

    for (let i = 0; i < lastIdx; i++) {
      const c0 = HYPSOMETRIC_PALETTE[i];
      const c1 = HYPSOMETRIC_PALETTE[i + 1];
      if (h >= c0.h && h <= c1.h) {
        const t = (h - c0.h) / (c1.h - c0.h);
        return {
          r: Math.round(c0.r + (c1.r - c0.r) * t),
          g: Math.round(c0.g + (c1.g - c0.g) * t),
          b: Math.round(c0.b + (c1.b - c0.b) * t),
        };
      }
    }
    return { r: HYPSOMETRIC_PALETTE[lastIdx].r, g: HYPSOMETRIC_PALETTE[lastIdx].g, b: HYPSOMETRIC_PALETTE[lastIdx].b };
  }

  const canvasWidth = options.width ?? ctx.canvas?.width ?? 960;
  const canvasHeight = options.height ?? ctx.canvas?.height ?? 540;

  const { bounds, heightfield, rivers, roads, townSites } = region;
  const { width: gridWidth, height: gridHeight, resolutionFt, samples } = heightfield;

  // Clear background
  ctx.fillStyle = "#091a33"; // atlas deep-ocean tone — letterbox reads as sea
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // --------------------------------------------------------------------------
  // Compute fitting scale and offset
  // --------------------------------------------------------------------------
  const scaleX = canvasWidth / bounds.width;
  const scaleY = canvasHeight / bounds.height;
  const fitScale = Math.min(scaleX, scaleY) * 0.95; // 5% border padding
  
  const fitOffsetX = (canvasWidth - bounds.width * fitScale) / 2;
  const fitOffsetY = (canvasHeight - bounds.height * fitScale) / 2;

  const scale = options.scale ?? fitScale;
  const offsetX = options.offsetX ?? fitOffsetX;
  const offsetY = options.offsetY ?? fitOffsetY;

  // Coordinate conversion: converts feet-canon positions to screen canvas pixels
  const tx = (xFeet: number) => (xFeet - bounds.x) * scale + offsetX;
  const ty = (yFeet: number) => (yFeet - bounds.y) * scale + offsetY;

  // --------------------------------------------------------------------------
  // Layer 1: Heightfield Grid with NW Slope Shading
  // --------------------------------------------------------------------------
  // Find local min and max height values to stretch color values. LAND
  // samples only â€” letting water depths into the range compressed land
  // contrast on coastal regions (atlas-coherence pass, 2026-06-11).
  let minH = Infinity;
  let maxH = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    const val = samples[i];
    if (val < REGION_WATER_LEVEL) continue;
    if (val < minH) minH = val;
    if (val > maxH) maxH = val;
  }
  if (minH === Infinity) {
    // All-water window: keep a defined range for the (unused) land path
    minH = 0;
    maxH = REGION_WATER_LEVEL;
  }
  const heightRange = maxH - minH || 1;

  // NW Light Direction Vector
  const Lx = -0.707;
  const Ly = -0.707;

  // Atlas-coherence mode: tint land with the anchor cell's atlas biome color
  // so the region reads as a zoom into the spot that was clicked. Without a
  // biomeColor the legacy hypsometric palette is used (tests/back-compat).
  const biomeRGB = options.biomeColor ? parseHexColor(options.biomeColor) : null;

  // Multi-biome blend (2026-06-12): when the artifact carries member-cell
  // biome sites, land near a biome border IDW-shades toward the neighbor's
  // hue instead of wearing the anchor color wall-to-wall. Only active in
  // coherence mode with ≥2 parsable sites; otherwise the single tint (or
  // hypsometric legacy) path is untouched.
  const blendSites =
    biomeRGB && region.biomeSites && region.biomeSites.length >= 2
      ? region.biomeSites
          .map((s) => ({ x: s.x, y: s.y, rgb: parseHexColor(s.color) }))
          .filter((s): s is { x: number; y: number; rgb: [number, number, number] } => s.rgb !== null)
      : null;
  const idwTint = (fx: number, fy: number): [number, number, number] => {
    let wr = 0, wg = 0, wb = 0, wsum = 0;
    for (const s of blendSites!) {
      const d2 = (s.x - fx) * (s.x - fx) + (s.y - fy) * (s.y - fy) + 1;
      const w = 1 / d2;
      wr += s.rgb[0] * w;
      wg += s.rgb[1] * w;
      wb += s.rgb[2] * w;
      wsum += w;
    }
    return [wr / wsum, wg / wsum, wb / wsum];
  };

  // Render each grid cell as a rectangle
  const rectW = resolutionFt * scale + 0.6; // 0.6 overlap prevents sub-pixel grid gaps
  const rectH = resolutionFt * scale + 0.6;

  for (let r = 0; r < gridHeight; r++) {
    const feetY = bounds.y + r * resolutionFt;
    const screenY = ty(feetY);

    for (let c = 0; c < gridWidth; c++) {
      const feetX = bounds.x + c * resolutionFt;
      const screenX = tx(feetX);

      const idx = r * gridWidth + c;
      const h = samples[idx];

      // Stretch height locally
      const hStretched = (h - minH) / heightRange;

      let rBase: number;
      let gBase: number;
      let bBase: number;

      if (h < REGION_WATER_LEVEL) {
        // Water in the atlas's own ocean language: deep â†’ shallow ramp.
        // Absolute (not locally stretched) so coasts match L0 exactly.
        const wt = Math.max(0, Math.min(1, h / REGION_WATER_LEVEL));
        rBase = WATER_DEEP[0] + (WATER_SHALLOW[0] - WATER_DEEP[0]) * wt;
        gBase = WATER_DEEP[1] + (WATER_SHALLOW[1] - WATER_DEEP[1]) * wt;
        bBase = WATER_DEEP[2] + (WATER_SHALLOW[2] - WATER_DEEP[2]) * wt;

        ctx.fillStyle = `rgb(${Math.round(rBase)},${Math.round(gBase)},${Math.round(bBase)})`;
        ctx.fillRect(screenX, screenY, rectW, rectH);
        continue; // water takes no hillshade â€” matches the atlas's flat seas
      }

      if (biomeRGB) {
        // Biome-tinted relief: the atlas hue, lightness driven by the local
        // elevation stretch (valleys darker, heights lighter, faint snow
        // blend at the very top of the local range).
        const tint = blendSites && blendSites.length >= 2 ? idwTint(feetX, feetY) : biomeRGB;
        const lift = 0.72 + 0.56 * hStretched;
        rBase = tint[0] * lift;
        gBase = tint[1] * lift;
        bBase = tint[2] * lift;
        if (hStretched > 0.9) {
          const t = (hStretched - 0.9) / 0.1;
          rBase = rBase + (245 - rBase) * t * 0.55;
          gBase = gBase + (246 - gBase) * t * 0.55;
          bBase = bBase + (248 - bBase) * t * 0.55;
        }
      } else {
        const color = getHypsometricColor(hStretched);
        rBase = color.r;
        gBase = color.g;
        bBase = color.b;
      }

      // Compute slope shade based on neighboring heights
      const hLeft = c > 0 ? samples[idx - 1] : h;
      const hRight = c < gridWidth - 1 ? samples[idx + 1] : h;
      const hTop = r > 0 ? samples[idx - gridWidth] : h;
      const hBottom = r < gridHeight - 1 ? samples[idx + gridWidth] : h;

      const dx = hRight - hLeft;
      const dy = hBottom - hTop;

      // Project slope along light vector and scale/clamp shade modifier.
      // Strength 18 → 42 with a wider clamp (2026-06-11 relief calibration):
      // the 8,000 ft macro landforms have gentler per-sample gradients than
      // the old cloud noise, so the hillshade needs more gain to articulate
      // ridge and valley walls at fit zoom.
      const slope = dx * Lx + dy * Ly;
      const shade = Math.max(0.55, Math.min(1.45, 1 - slope * 42.0));

      const rShaded = Math.max(0, Math.min(255, Math.round(rBase * shade)));
      const gShaded = Math.max(0, Math.min(255, Math.round(gBase * shade)));
      const bShaded = Math.max(0, Math.min(255, Math.round(bBase * shade)));

      ctx.fillStyle = `rgb(${rShaded},${gShaded},${bShaded})`;
      ctx.fillRect(screenX, screenY, rectW, rectH);
    }
  }

  // --------------------------------------------------------------------------
  // Layer 2: River Banks â€” the atlas's river style (#3d6fa8 over a darker
  // casing) so waterways keep their identity across the descend.
  // --------------------------------------------------------------------------
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const river of rivers || []) {
    const { centerline, widthFt } = river;
    if (centerline.length < 2) continue;

    // WF-G5: render the same smoothed river band that the generator carves
    // into terrain, so tight bends no longer show water beside its channel.
    const drawCenterline = smoothRegionRiverCenterline(centerline);
    const w = Math.max(1.5, widthFt * scale);
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(tx(drawCenterline[0][0]), ty(drawCenterline[0][1]));
      for (let i = 1; i < drawCenterline.length; i++) {
        ctx.lineTo(tx(drawCenterline[i][0]), ty(drawCenterline[i][1]));
      }
      ctx.stroke();
    };

    ctx.strokeStyle = "#1a3d66"; // casing (atlas water outline tone)
    ctx.lineWidth = w * 1.5;
    trace();
    ctx.strokeStyle = "#3d6fa8"; // fill (atlas river tone)
    ctx.lineWidth = w;
    trace();
  }

  // --------------------------------------------------------------------------
  // Layer 3: Roads — drawn BELOW town sites so settlements sit on their
  // road network. Style follows the C2 proof renderer: darker casing under
  // a sand-toned fill; trails read thinner and greyer than trade roads.
  // (Placeholders implemented 2026-06-11 — Remy's detail-density pass.)
  // --------------------------------------------------------------------------
  for (const road of roads || []) {
    const { centerline, widthFt, kind } = road;
    if (!centerline || centerline.length < 2) continue;

    const w = Math.max(1.2, widthFt * scale * 2); // ×2: 20-40 ft roads must read at fit zoom
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(tx(centerline[0][0]), ty(centerline[0][1]));
      for (let i = 1; i < centerline.length; i++) {
        ctx.lineTo(tx(centerline[i][0]), ty(centerline[i][1]));
      }
      ctx.stroke();
    };

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = kind === "road" ? "#6b4c2a" : "#7a705c"; // casing
    ctx.lineWidth = w * 1.6;
    trace();
    ctx.strokeStyle = kind === "road" ? "#c9a66b" : "#b8a880"; // fill
    ctx.lineWidth = w;
    trace();
  }

  // --------------------------------------------------------------------------
  // Layer 4: Town Sites — envelope footprint + center glyph + gate dots.
  // The glyph guarantees the settlement reads at fit zoom even when the
  // envelope itself is only a few pixels wide.
  // --------------------------------------------------------------------------
  for (const town of townSites || []) {
    const env = town.envelope;
    if (!env) continue;
    const ex = tx(env.x);
    const ey = ty(env.y);
    const ew = env.width * scale;
    const eh = env.height * scale;

    // Envelope: built-up footprint
    ctx.fillStyle = "rgba(196, 92, 60, 0.30)";
    ctx.fillRect(ex, ey, ew, eh);
    ctx.strokeStyle = "#b91c1c";
    ctx.lineWidth = Math.max(1, Math.min(2.5, ew * 0.04));
    ctx.strokeRect(ex, ey, ew, eh);

    // Gates
    for (const [gx, gy] of town.gates || []) {
      ctx.beginPath();
      ctx.arc(tx(gx), ty(gy), Math.max(1.5, ew * 0.035), 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.strokeStyle = "#7c2d12";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Center glyph: burg dot in the atlas's own marker language
    const cx = ex + ew / 2;
    const cy = ey + eh / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(3, Math.min(6, ew * 0.12)), 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // --------------------------------------------------------------------------
  // Layer 5: Inherited atlas markers — same halo-disc glyph language as L0
  // (detail-density pass, 2026-06-11), slightly larger at region zoom.
  // --------------------------------------------------------------------------
  for (const m of region.markers ?? []) {
    const x = tx(m.x);
    const y = ty(m.y);
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fill();
    ctx.strokeStyle = "rgba(55,65,81,0.9)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "14px serif";
    ctx.fillStyle = "#111827";
    ctx.fillText(m.icon, x, y + 0.5);
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Layer 6: Zone banners — the window sits inside world event zones; a
  // tinted frame + named banner says so without painting over the terrain.
  // Tint table mirrors the atlas zone layer (atlasDraw Layer 5.5).
  // --------------------------------------------------------------------------
  const REGION_ZONE_TINTS: Record<string, string> = {
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
  const zonesInWindow = region.zones ?? [];
  zonesInWindow.forEach((zone, idx) => {
    const tint = REGION_ZONE_TINTS[zone.type] ?? "148,163,184";

    // Frame (first zone only — stacked frames would just look muddy)
    if (idx === 0) {
      ctx.strokeStyle = `rgba(${tint},0.55)`;
      ctx.lineWidth = 6;
      ctx.strokeRect(
        tx(bounds.x) + 3,
        ty(bounds.y) + 3,
        bounds.width * scale - 6,
        bounds.height * scale - 6,
      );
    }

    // Banner: top-center, stacked per zone
    const label = `⚠ ${zone.name}`;
    ctx.save();
    ctx.font = "bold 12px sans-serif";
    const tw = ctx.measureText(label).width;
    const bx = tx(bounds.x + bounds.width / 2) - tw / 2 - 10;
    const by = ty(bounds.y) + 10 + idx * 26;
    ctx.fillStyle = `rgba(${tint},0.85)`;
    ctx.beginPath();
    if (typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === "function") {
      ctx.roundRect(bx, by, tw + 20, 20, 6);
    } else {
      ctx.rect(bx, by, tw + 20, 20);
    }
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, bx + (tw + 20) / 2, by + 10.5);
    ctx.restore();
  });
}
