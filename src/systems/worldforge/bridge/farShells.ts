/**
 * @file farShells.ts — far-distance terrain shells (2026-07-21, Remy: "I don't
 * want to see any world edge at all").
 *
 * Ground mode streams ONE ~914 m local window; everything beyond it used to be
 * an edge-falloff drop faded to haze — a visible world edge. These builders
 * turn data the entry path ALREADY generated into two static, coarse,
 * vertex-colored ring meshes on the window's own vertical datum:
 *
 *  - REGION shell: the region heightfield (100 ft resolution, ~7.6 km square)
 *    the window was cut from. Continues the terrain past the window border.
 *    Inside/near the window rect it is blended down to the window's REAL
 *    heights and tucked slightly under, so the seam cannot crack or z-fight.
 *  - HORIZON shell: the atlas's regular grid heightmap sampled out to tens of
 *    km — distant ranges silhouetted through the haze. Tucked under the region
 *    shell where they overlap.
 *
 * Both are built ONCE per window entry (worker-side, structured-clone-safe
 * typed arrays), rendered as two static meshes — no streaming, no per-frame
 * work. Colors are baked here (biome-band + water + absolute-feet snow line)
 * so the render component stays dumb.
 */
import type { LocalArtifact, RegionArtifact } from "../artifacts";
import { elevationCurveFt } from "../local/generateLocal";
import {
  resolveSnowLineFt,
  SNOW_RGB,
} from "../mountains/mountainTunables";

const FEET_TO_METERS = 0.3048;

/** Normalized height below which a sample reads as water (region/atlas share
 * the 0.2 sea-level convention; generateRegion clamps water to ≤ 0.19). */
const WATER_N = 0.2;

/** One serializable shell grid: row-major heights (meters, window datum) and
 * baked linear-RGB vertex colors, positioned in window-relative meters. */
export interface FarShellGrid {
  cols: number;
  rows: number;
  /** Window-relative meters of sample (0,0) — can be negative. */
  originXM: number;
  originZM: number;
  spacingM: number;
  /** Surface Y in meters on the window's datum (window floor = 0). */
  heightsM: Float32Array;
  /** Linear RGB per sample (3 floats). */
  colors: Float32Array;
}

export interface FarShells {
  region: FarShellGrid;
  horizon: FarShellGrid | null;
}

/** Everything the horizon builder needs from the atlas — kept as plain data so
 * this module never imports the bridge (no cycle, worker-safe, testable). */
export interface HorizonSource {
  /** Regular lattice heights (FMG grid.cells.h, 0..100). */
  gridH: ArrayLike<number>;
  cellsX: number;
  cellsY: number;
  graphWidth: number;
  graphHeight: number;
  feetPerPixel: number;
}

/** Distance the region shell blends from window-true heights to region field. */
const SEAM_BLEND_M = 90;
/** Shell sits this far under the window's own terrain where they overlap. */
const TUCK_M = 0.7;
/** Region shell sampling stride over the 100 ft heightfield grid. */
const REGION_STRIDE = 2;
/** Horizon shell half-extent (m) and sample spacing (m). */
const HORIZON_HALF_M = 20000;
const HORIZON_SPACING_M = 500;
/** Snow blends in over this many feet above the absolute snow line. */
const SNOW_BAND_FT = 600;

/** Distant-terrain palette — matches the near palette's families closely
 * enough that the seam reads as one world (terrainColor PALETTE values). */
const SHELL_WATER: [number, number, number] = [0.16, 0.34, 0.58];
const SHELL_GRASS: [number, number, number] = [0.46, 0.6, 0.34];
const SHELL_HIGHLAND: [number, number, number] = [0.5, 0.46, 0.36];
const SHELL_ROCK: [number, number, number] = [0.46, 0.42, 0.4];

/** Land tint for a normalized height, before shading/snow. */
function landTint(n: number): [number, number, number] {
  if (n < WATER_N) return SHELL_WATER;
  // grass → highland over 0.35..0.55, highland → rock over 0.55..0.7.
  const t1 = Math.max(0, Math.min(1, (n - 0.35) / 0.2));
  const t2 = Math.max(0, Math.min(1, (n - 0.55) / 0.15));
  const r = SHELL_GRASS[0] + (SHELL_HIGHLAND[0] - SHELL_GRASS[0]) * t1 + (SHELL_ROCK[0] - SHELL_HIGHLAND[0]) * t2;
  const g = SHELL_GRASS[1] + (SHELL_HIGHLAND[1] - SHELL_GRASS[1]) * t1 + (SHELL_ROCK[1] - SHELL_HIGHLAND[1]) * t2;
  const b = SHELL_GRASS[2] + (SHELL_HIGHLAND[2] - SHELL_GRASS[2]) * t1 + (SHELL_ROCK[2] - SHELL_HIGHLAND[2]) * t2;
  return [r, g, b];
}

/** Bake one sample's color: land band + relief brightness + snow-line cap. */
function bakeColor(
  out: Float32Array,
  idx: number,
  n: number,
  elevFt: number,
  snowLineFt: number,
): void {
  let [r, g, b] = landTint(n);
  // Gentle relief brightness (mirrors heightShade's direction, gentler swing).
  const shade = 0.85 + Math.max(0, Math.min(1, n)) * 0.3;
  r *= shade; g *= shade; b *= shade;
  if (n >= WATER_N && elevFt >= snowLineFt) {
    const t = Math.min(1, (elevFt - snowLineFt) / SNOW_BAND_FT);
    r += (SNOW_RGB[0] - r) * t;
    g += (SNOW_RGB[1] - g) * t;
    b += (SNOW_RGB[2] - b) * t;
  }
  out[idx * 3] = r;
  out[idx * 3 + 1] = g;
  out[idx * 3 + 2] = b;
}

/**
 * Build the REGION shell: the region heightfield expressed in window-relative
 * meters on the window's datum, seam-blended to the window's true heights.
 *
 * `windowHeights` is the ground world's encoded height grid (0..100, 1 unit =
 * 18 m via heightToMeters) with `windowCols`/`windowRows` at 1.524 m per cell.
 */
export function buildRegionShell(
  region: RegionArtifact,
  local: LocalArtifact,
  baseElevFt: number,
  snowLineFt: number,
  windowHeights: ArrayLike<number>,
  windowCols: number,
  windowRows: number,
): FarShellGrid {
  const hf = region.heightfield;
  const cols = Math.floor((hf.width - 1) / REGION_STRIDE) + 1;
  const rows = Math.floor((hf.height - 1) / REGION_STRIDE) + 1;
  const spacingM = hf.resolutionFt * REGION_STRIDE * FEET_TO_METERS;
  const originXM = (region.bounds.x - local.bounds.x) * FEET_TO_METERS;
  const originZM = (region.bounds.y - local.bounds.y) * FEET_TO_METERS;
  const extentXM = local.bounds.width * FEET_TO_METERS;
  const extentZM = local.bounds.height * FEET_TO_METERS;
  const heightsM = new Float32Array(cols * rows);
  const colors = new Float32Array(cols * rows * 3);

  // Window surface meters at window-relative meters (bilinear, clamped).
  const METERS_PER_ENC = 18; // heightToMeters: 100 enc = 1800 m
  const CELL_M = 1.524;
  const windowSurfaceM = (xM: number, zM: number): number => {
    const gx = Math.max(0, Math.min(windowCols - 1.001, xM / CELL_M - 0.5));
    const gz = Math.max(0, Math.min(windowRows - 1.001, zM / CELL_M - 0.5));
    const x0 = Math.floor(gx); const z0 = Math.floor(gz);
    const fx = gx - x0; const fz = gz - z0;
    const h = (xx: number, zz: number) => Number(windowHeights[zz * windowCols + xx] ?? 0);
    const top = h(x0, z0) * (1 - fx) + h(x0 + 1, z0) * fx;
    const bot = h(x0, z0 + 1) * (1 - fx) + h(x0 + 1, z0 + 1) * fx;
    return (top * (1 - fz) + bot * fz) * METERS_PER_ENC;
  };

  // River mask: shell samples within a river's half-width read as water, so
  // window rivers continue into the distance instead of stopping dead at the
  // border (their carved trench is already in the heightfield — this is tint).
  const riverMask = new Uint8Array(cols * rows);
  for (const river of region.rivers ?? []) {
    const halfW = Math.max(river.widthFt / 2, hf.resolutionFt);
    const line = river.centerline ?? [];
    for (let p = 0; p < line.length - 1; p++) {
      const [ax, ay] = line[p];
      const [bx, by] = line[p + 1];
      const segLen = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.ceil(segLen / hf.resolutionFt));
      for (let st = 0; st <= steps; st++) {
        const xFt = ax + ((bx - ax) * st) / steps;
        const yFt = ay + ((by - ay) * st) / steps;
        const col = Math.round((xFt - region.bounds.x) / (hf.resolutionFt * REGION_STRIDE));
        const row = Math.round((yFt - region.bounds.y) / (hf.resolutionFt * REGION_STRIDE));
        const r = Math.ceil(halfW / (hf.resolutionFt * REGION_STRIDE));
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            const cc = col + dx;
            const rr = row + dz;
            if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
            if (Math.hypot(dx, dz) * hf.resolutionFt * REGION_STRIDE <= halfW) {
              riverMask[rr * cols + cc] = 1;
            }
          }
        }
      }
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const n = hf.samples[row * REGION_STRIDE * hf.width + col * REGION_STRIDE];
      const elevFt = elevationCurveFt(n);
      let hM = (elevFt - baseElevFt) * FEET_TO_METERS;

      // Seam: inside the window follow the window's real surface (tucked
      // under); within SEAM_BLEND_M outside, ease from that to the region field.
      const xM = originXM + col * spacingM;
      const zM = originZM + row * spacingM;
      const dx = Math.max(-xM, 0, xM - extentXM);
      const dz = Math.max(-zM, 0, zM - extentZM);
      const outside = Math.hypot(dx, dz);
      if (outside < SEAM_BLEND_M) {
        const inX = Math.max(0, Math.min(extentXM, xM));
        const inZ = Math.max(0, Math.min(extentZM, zM));
        const winM = windowSurfaceM(inX, inZ) - TUCK_M;
        const t = outside / SEAM_BLEND_M;
        const ease = t * t * (3 - 2 * t);
        hM = winM + (hM - winM) * ease;
      }

      heightsM[idx] = hM;
      // River-masked samples read as water regardless of their land height —
      // the tint continuation of the window's carved rivers.
      bakeColor(colors, idx, riverMask[idx] ? WATER_N - 0.01 : n, elevFt, snowLineFt);
    }
  }
  return { cols, rows, originXM, originZM, spacingM, heightsM, colors };
}

/**
 * Build the HORIZON shell: the atlas's regular grid heightmap bilinearly
 * sampled on a square ring out to HORIZON_HALF_M around the window. Where it
 * overlaps the region shell's footprint it is pushed under the region field so
 * the two never fight.
 */
export function buildHorizonShell(
  source: HorizonSource,
  region: RegionArtifact,
  local: LocalArtifact,
  baseElevFt: number,
  snowLineFt: number,
): FarShellGrid {
  const spacingM = HORIZON_SPACING_M;
  const cols = Math.floor((2 * HORIZON_HALF_M) / spacingM) + 1;
  const rows = cols;
  const windowCenterXFt = local.bounds.x + local.bounds.width / 2;
  const windowCenterYFt = local.bounds.y + local.bounds.height / 2;
  const originXM = (local.bounds.width / 2) * FEET_TO_METERS - HORIZON_HALF_M;
  const originZM = (local.bounds.height / 2) * FEET_TO_METERS - HORIZON_HALF_M;
  const heightsM = new Float32Array(cols * rows);
  const colors = new Float32Array(cols * rows * 3);

  // Atlas grid bilinear sample of normalized height at an absolute-feet point.
  const colSpanPx = source.graphWidth / source.cellsX;
  const rowSpanPx = source.graphHeight / source.cellsY;
  const sampleN = (xFt: number, yFt: number): number => {
    const xPx = xFt / source.feetPerPixel;
    const yPx = yFt / source.feetPerPixel;
    const gx = Math.max(0, Math.min(source.cellsX - 1.001, xPx / colSpanPx - 0.5));
    const gy = Math.max(0, Math.min(source.cellsY - 1.001, yPx / rowSpanPx - 0.5));
    const x0 = Math.floor(gx); const y0 = Math.floor(gy);
    const fx = gx - x0; const fy = gy - y0;
    const h = (xx: number, yy: number) =>
      Number(source.gridH[yy * source.cellsX + xx] ?? 0) / 100;
    const top = h(x0, y0) * (1 - fx) + h(x0 + 1, y0) * fx;
    const bot = h(x0, y0 + 1) * (1 - fx) + h(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bot * fy;
  };

  // Region field sampler (for pushing the horizon under the region shell).
  const hf = region.heightfield;
  const regionN = (xFt: number, yFt: number): number => {
    const gx = Math.max(0, Math.min(hf.width - 1.001, (xFt - region.bounds.x) / hf.resolutionFt));
    const gy = Math.max(0, Math.min(hf.height - 1.001, (yFt - region.bounds.y) / hf.resolutionFt));
    const x0 = Math.floor(gx); const y0 = Math.floor(gy);
    const fx = gx - x0; const fy = gy - y0;
    const s = (xx: number, yy: number) => hf.samples[yy * hf.width + xx];
    const top = s(x0, y0) * (1 - fx) + s(x0 + 1, y0) * fx;
    const bot = s(x0, y0 + 1) * (1 - fx) + s(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bot * fy;
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const xM = originXM + col * spacingM;
      const zM = originZM + row * spacingM;
      const xFt = windowCenterXFt - local.bounds.width / 2 + xM / FEET_TO_METERS;
      const yFt = windowCenterYFt - local.bounds.height / 2 + zM / FEET_TO_METERS;
      let n = sampleN(xFt, yFt);

      // Under the region shell's footprint, follow the (finer) region field
      // from 20 m below so the coarse atlas lump can never poke through it.
      const insideRegion =
        xFt > region.bounds.x && xFt < region.bounds.x + region.bounds.width &&
        yFt > region.bounds.y && yFt < region.bounds.y + region.bounds.height;
      let elevFt = elevationCurveFt(n);
      let hM = (elevFt - baseElevFt) * FEET_TO_METERS;
      if (insideRegion) {
        n = regionN(xFt, yFt);
        elevFt = elevationCurveFt(n);
        hM = (elevFt - baseElevFt) * FEET_TO_METERS - 20;
      }

      // Outer-rim dip: the shell's square boundary would silhouette as a hard
      // line where fully-fogged terrain meets the sky gradient. The last 15%
      // of the half-extent bends smoothly downward so the rim sinks below the
      // visual horizon and the fog finishes the blend.
      const rim = Math.max(
        Math.abs(xM - (originXM + HORIZON_HALF_M)),
        Math.abs(zM - (originZM + HORIZON_HALF_M)),
      ) / HORIZON_HALF_M;
      if (rim > 0.85) {
        const t = Math.min(1, (rim - 0.85) / 0.15);
        hM -= t * t * 500;
      }

      heightsM[idx] = hM;
      bakeColor(colors, idx, n, elevFt, snowLineFt);
    }
  }
  return { cols, rows, originXM, originZM, spacingM, heightsM, colors };
}

/** Assemble both shells. Pure; every input is plain data. */
export function buildFarShells(
  region: RegionArtifact,
  local: LocalArtifact,
  baseElevFt: number,
  anchorLatitudeDeg: number | null,
  windowHeights: ArrayLike<number>,
  windowCols: number,
  windowRows: number,
  horizonSource: HorizonSource | null,
): FarShells {
  const snowLineFt = resolveSnowLineFt(anchorLatitudeDeg);
  return {
    region: buildRegionShell(
      region, local, baseElevFt, snowLineFt, windowHeights, windowCols, windowRows,
    ),
    horizon: horizonSource
      ? buildHorizonShell(horizonSource, region, local, baseElevFt, snowLineFt)
      : null,
  };
}
