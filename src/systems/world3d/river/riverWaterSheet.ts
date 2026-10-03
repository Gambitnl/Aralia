/**
 * @file riverWaterSheet.ts — the river's drawn water sheet as plain arrays,
 * and the half-float packing of the flow map's textures, with no three.js.
 *
 * WHY HERE. The live river (2026-09-29) builds a new sheet and new flow
 * textures a few times a second while its solver runs, in a worker, and hands
 * them to the page. `buildRiverWaterGeometry` (riverWaterMaterial.ts) wraps
 * the same arrays in a three.js geometry for the judged scene, so the judged
 * sheet and the live sheet are one builder.
 */
import type { RiverSolverGrid } from './riverSolver';

/** The water sheet: positions and normals per drawn cell (xyz), and triangles. */
export interface WaterSheetArrays {
  pos: Float32Array;
  nor: Float32Array;
  index: Uint32Array;
}

/**
 * THE WATER SHEET: one vertex per solver cell center, at the drawn surface
 * height (NaN = no water drawn there); a quad with four drawn corners gives
 * two triangles, a quad with three gives one. Normals come from a 3 x 3
 * smoothed copy of the heights (the land page's lesson: exact per-vertex
 * normals shade a crease where a slope meets flat water), while positions stay
 * exact so the waterline stays on the banks.
 */
export function buildWaterSheetArrays(grid: RiverSolverGrid, S: Float32Array): WaterSheetArrays {
  const { nx, nz, dx, x0, z0 } = grid;
  const idx = new Int32Array(nx * nz).fill(-1);
  let nv = 0;
  for (let c = 0; c < nx * nz; c += 1) if (!Number.isNaN(S[c])) nv += 1;
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  // Each cell's smoothed height is read by it and its four neighbors: kept
  // once computed (`done` marks it; the value itself may be NaN).
  const memo = new Float64Array(nx * nz);
  const done = new Uint8Array(nx * nz);
  const smooth = (i: number, j: number): number => {
    const c0 = j * nx + i;
    if (done[c0]) return memo[c0];
    let s = 0;
    let k = 0;
    for (let dj = -1; dj <= 1; dj += 1) {
      for (let di = -1; di <= 1; di += 1) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const v = S[jj * nx + ii];
        if (Number.isNaN(v)) continue;
        s += v;
        k += 1;
      }
    }
    const r = k ? s / k : NaN;
    memo[c0] = r;
    done[c0] = 1;
    return r;
  };
  let v = 0;
  for (let j = 0; j < nz; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const c = j * nx + i;
      if (Number.isNaN(S[c])) continue;
      idx[c] = v;
      pos[v * 3] = x0 + (i + 0.5) * dx;
      pos[v * 3 + 1] = S[c];
      pos[v * 3 + 2] = z0 + (j + 0.5) * dx;
      const hc = smooth(i, j);
      const hl = i > 0 ? smooth(i - 1, j) : NaN;
      const hr = i < nx - 1 ? smooth(i + 1, j) : NaN;
      const hd = j > 0 ? smooth(i, j - 1) : NaN;
      const hu = j < nz - 1 ? smooth(i, j + 1) : NaN;
      const gx = !Number.isNaN(hl) && !Number.isNaN(hr) ? (hr - hl) / (2 * dx)
        : !Number.isNaN(hr) ? (hr - hc) / dx : !Number.isNaN(hl) ? (hc - hl) / dx : 0;
      const gz = !Number.isNaN(hd) && !Number.isNaN(hu) ? (hu - hd) / (2 * dx)
        : !Number.isNaN(hu) ? (hu - hc) / dx : !Number.isNaN(hd) ? (hc - hd) / dx : 0;
      const len = Math.hypot(gx, 1, gz);
      nor[v * 3] = -gx / len;
      nor[v * 3 + 1] = 1 / len;
      nor[v * 3 + 2] = -gz / len;
      v += 1;
    }
  }
  const tri: number[] = [];
  for (let j = 0; j < nz - 1; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      const a = idx[j * nx + i];
      const b = idx[j * nx + i + 1];
      const c = idx[(j + 1) * nx + i];
      const d = idx[(j + 1) * nx + i + 1];
      const k = (a >= 0 ? 1 : 0) + (b >= 0 ? 1 : 0) + (c >= 0 ? 1 : 0) + (d >= 0 ? 1 : 0);
      // Winding: +x right, +z toward the viewer of a top-down map; (a, c, b)
      // faces +y (checked: the cross of (c - a) and (b - a) has y > 0).
      if (k === 4) {
        tri.push(a, c, b, b, c, d);
      } else if (k === 3) {
        if (a < 0) tri.push(b, c, d);
        else if (b < 0) tri.push(a, c, d);
        else if (c < 0) tri.push(a, d, b);
        else tri.push(a, c, b);
      }
    }
  }
  return { pos, nor, index: Uint32Array.from(tri) };
}

// ---------------------------------------------------------------------------
// Half floats: the same conversion as three.js's DataUtils.toHalfFloat (the
// tables of "Fast Half Float Conversions", van der Zijp 2008), so a live
// texture holds the same bits the judged scene's would. It truncates; it
// does not round.
// ---------------------------------------------------------------------------

let halfTables: { base: Uint32Array; shift: Uint32Array } | null = null;

function tables(): { base: Uint32Array; shift: Uint32Array } {
  if (halfTables) return halfTables;
  const base = new Uint32Array(512);
  const shift = new Uint32Array(512);
  for (let i = 0; i < 256; i += 1) {
    const e = i - 127;
    if (e < -27) {
      base[i] = 0x0000; base[i | 0x100] = 0x8000; shift[i] = 24; shift[i | 0x100] = 24;
    } else if (e < -14) {
      base[i] = 0x0400 >> (-e - 14); base[i | 0x100] = (0x0400 >> (-e - 14)) | 0x8000;
      shift[i] = -e - 1; shift[i | 0x100] = -e - 1;
    } else if (e <= 15) {
      base[i] = (e + 15) << 10; base[i | 0x100] = ((e + 15) << 10) | 0x8000; shift[i] = 13; shift[i | 0x100] = 13;
    } else if (e < 128) {
      base[i] = 0x7c00; base[i | 0x100] = 0xfc00; shift[i] = 24; shift[i | 0x100] = 24;
    } else {
      base[i] = 0x7c00; base[i | 0x100] = 0xfc00; shift[i] = 13; shift[i | 0x100] = 13;
    }
  }
  halfTables = { base, shift };
  return halfTables;
}

/**
 * Pack floats as half floats, each clamped to +-60000 first (as the judged
 * scene's `createRiverFlowTextures` does).
 */
export function toHalfArray(src: Float32Array, out: Uint16Array = new Uint16Array(src.length)): Uint16Array {
  const { base, shift } = tables();
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  for (let i = 0; i < src.length; i += 1) {
    const v = src[i];
    f32[0] = v > 60000 ? 60000 : v < -60000 ? -60000 : v;
    const f = u32[0];
    const e = (f >> 23) & 0x1ff;
    out[i] = base[e] + ((f & 0x007fffff) >> shift[e]);
  }
  return out;
}
