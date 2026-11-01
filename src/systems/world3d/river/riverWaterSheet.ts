/**
 * @file riverWaterSheet.ts — the river's drawn water sheet as plain arrays,
 * and the half-float packing of the flow map's textures, with no three.js.
 *
 * WHY HERE. The live river (2026-09-29) builds a new sheet and new flow
 * textures a few times a second while its solver runs, in a worker, and hands
 * them to the page. `buildRiverWaterGeometry` (riverWaterMaterial.ts) wraps
 * the same arrays in a three.js geometry for the judged scene, so the judged
 * sheet and the live sheet are one builder.
 *
 * Sheet construction keeps lookup/normal scratch in exact-address pages and
 * counts triangle indices into their final array. Water values, vertex order
 * and normal arithmetic stay the same; full-course memory fit is still separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/10/2026, 07:56:21
 * Dependents: components/World3D/water/riverReachScene.ts, components/World3D/water/riverReceivingRefiner.ts, components/World3D/water/riverSpillView.ts, components/World3D/water/riverTerrainCourseView.ts, components/World3D/water/riverWaterMaterial.ts, systems/world3d/river/riverLive.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverSolverGrid } from './riverSolver';
import { riverCellX } from './riverRectGrid';

/** The water sheet: positions and normals per drawn cell (xyz), and triangles. */
export interface WaterSheetArrays {
  pos: Float32Array;
  nor: Float32Array;
  index: Uint32Array;
}

/** Scratch is allocated only where this sheet needs cell addresses or smoothed
 * heights. Pages keep the original global addresses and Float64 arithmetic.
 * Every requested page stays until this build returns; there is no wet-cell cap
 * or eviction. Fully wet grids may occupy every page and still need full output. */
class NativeSheetScratch {
  private readonly indices = new Map<number, Int32Array>();
  private readonly normals = new Map<number, { memo: Float64Array; done: Uint8Array }>();
  private readonly pageSize = 256;
  private readonly dense: { indices: Int32Array; memo: Float64Array; done: Uint8Array } | null;

  constructor(cells: number, wetVertices: number) {
    // Broad wet coverage can need nearly every page. Keep the original dense
    // scratch in that case so page lookup does not slow an ordinary full sheet.
    // Sparse source-fed sheets avoid paying for the whole landscape.
    this.dense = wetVertices * 8 > cells
      ? { indices: new Int32Array(cells).fill(-1), memo: new Float64Array(cells), done: new Uint8Array(cells) }
      : null;
  }

  indexAt(cell: number): number {
    if (this.dense) return this.dense.indices[cell];
    return this.indices.get(Math.floor(cell / this.pageSize))?.[cell % this.pageSize] ?? -1;
  }

  setIndex(cell: number, value: number): void {
    if (this.dense) { this.dense.indices[cell] = value; return; }
    const id = Math.floor(cell / this.pageSize);
    let page = this.indices.get(id);
    if (!page) {
      page = new Int32Array(this.pageSize).fill(-1);
      this.indices.set(id, page);
    }
    page[cell % this.pageSize] = value;
  }

  normalDone(cell: number): boolean {
    if (this.dense) return this.dense.done[cell] === 1;
    return this.normals.get(Math.floor(cell / this.pageSize))?.done[cell % this.pageSize] === 1;
  }

  normalAt(cell: number): number {
    if (this.dense) return this.dense.memo[cell];
    return this.normals.get(Math.floor(cell / this.pageSize))!.memo[cell % this.pageSize];
  }

  setNormal(cell: number, value: number): void {
    if (this.dense) { this.dense.memo[cell] = value; this.dense.done[cell] = 1; return; }
    const id = Math.floor(cell / this.pageSize);
    let page = this.normals.get(id);
    if (!page) {
      page = { memo: new Float64Array(this.pageSize), done: new Uint8Array(this.pageSize) };
      this.normals.set(id, page);
    }
    page.memo[cell % this.pageSize] = value;
    page.done[cell % this.pageSize] = 1;
  }
}

/**
 * THE WATER SHEET: one vertex per solver cell center, at the drawn surface
 * height (NaN = no water drawn there); a quad with four drawn corners gives
 * two triangles, a quad with three gives one. Normals come from a 3 x 3
 * smoothed copy of the heights (the land page's lesson: exact per-vertex
 * normals shade a crease where a slope meets flat water), while positions stay
 * exact so the waterline stays on the banks.
 */
export function buildWaterSheetArrays(grid: RiverSolverGrid, S: Float32Array, cells?: ArrayLike<number>): WaterSheetArrays {
  const { nx, nz, dx, x0, z0 } = grid;
  let minJ = nz, maxJ = -1, nv = 0;
  const rowMin = new Int32Array(nz).fill(nx);
  const rowMax = new Int32Array(nz).fill(-1);
  // `cells` (2026-10-22, GG-430): an ascending list that holds every cell
  // with a surface. Both passes then visit those cells only, in the same
  // order as the whole-grid passes, so the sheet is the same.
  for (let k = 0, end = cells ? cells.length : nx * nz; k < end; k += 1) {
    const c = cells ? cells[k] : k;
    if (Number.isNaN(S[c])) continue;
    nv += 1;
    const i = c % nx, j = (c - i) / nx;
    rowMin[j] = Math.min(rowMin[j], i);
    rowMax[j] = Math.max(rowMax[j], i);
    minJ = Math.min(minJ, j);
    maxJ = Math.max(maxJ, j);
  }
  const scratch = new NativeSheetScratch(nx * nz, nv);
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  // Each cell's smoothed height is read by it and its four neighbors: kept
  // once computed (`done` marks it; the value itself may be NaN).

  const smooth = (i: number, j: number): number => {
    const c0 = j * nx + i;
    if (scratch.normalDone(c0)) return scratch.normalAt(c0);
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
    scratch.setNormal(c0,r);
    return r;
  };
  let v = 0;
  for (let k = 0, end = cells ? cells.length : nx * nz; k < end; k += 1) {
    {
      const c = cells ? cells[k] : k;
      const i = c % nx, j = (c - i) / nx;
      if (Number.isNaN(S[c])) continue;
      scratch.setIndex(c,v);
      pos[v * 3] = grid.xEdges?riverCellX(grid,i):x0 + (i + 0.5) * dx;
      pos[v * 3 + 1] = S[c];
      pos[v * 3 + 2] = z0 + (j + 0.5) * dx;
      const hc = smooth(i, j);
      const hl = i > 0 ? smooth(i - 1, j) : NaN;
      const hr = i < nx - 1 ? smooth(i + 1, j) : NaN;
      const hd = j > 0 ? smooth(i, j - 1) : NaN;
      const hu = j < nz - 1 ? smooth(i, j + 1) : NaN;
      const leftSpan=grid.xEdges&&i>0?riverCellX(grid,i)-riverCellX(grid,i-1):dx,rightSpan=grid.xEdges&&i<nx-1?riverCellX(grid,i+1)-riverCellX(grid,i):dx;
      const gx = !Number.isNaN(hl) && !Number.isNaN(hr) ? (hr - hl) / (leftSpan+rightSpan)
        : !Number.isNaN(hr) ? (hr - hc) / rightSpan : !Number.isNaN(hl) ? (hc - hl) / leftSpan : 0;
      const gz = !Number.isNaN(hd) && !Number.isNaN(hu) ? (hu - hd) / (2 * dx)
        : !Number.isNaN(hu) ? (hu - hc) / dx : !Number.isNaN(hd) ? (hc - hd) / dx : 0;
      const len = Math.hypot(gx, 1, gz);
      nor[v * 3] = -gx / len;
      nor[v * 3 + 1] = 1 / len;
      nor[v * 3 + 2] = -gz / len;
      v += 1;
    }
  }
  // Every contributing quad has a finite corner inside the measured box.
  // Count exact indices first, then write directly to their final typed array;
  // no boxed-number triangle list coexists with the final output.
  const j0 = Math.max(0, minJ - 1), j1 = Math.min(nz - 2, maxJ);
  // Each quad touches only two rows. Their finite-corner bounds also skip
  // empty reaches between distant source-fed patches, in native triangle order.
  const rowStart = (j: number): number => Math.max(0, Math.min(rowMin[j], rowMin[j + 1]) - 1);
  const rowEnd = (j: number): number => Math.min(nx - 2, Math.max(rowMax[j], rowMax[j + 1]));
  let indexCount=0;
  for(let j=j0;j<=j1;j++)for(let i=rowStart(j),end=rowEnd(j);i<=end;i++){
   const k=(Number.isNaN(S[j*nx+i])?0:1)+(Number.isNaN(S[j*nx+i+1])?0:1)+(Number.isNaN(S[(j+1)*nx+i])?0:1)+(Number.isNaN(S[(j+1)*nx+i+1])?0:1);
   if(k===4)indexCount+=6;else if(k===3)indexCount+=3;
  }
  const index=new Uint32Array(indexCount);let offset=0;
  const tri={push:(a:number,b:number,c:number,d?:number,e?:number,f?:number)=>{index[offset++]=a;index[offset++]=b;index[offset++]=c;if(d!==undefined){index[offset++]=d;index[offset++]=e!;index[offset++]=f!;}}};
  for (let j = j0; j <= j1; j += 1) {
    for (let i = rowStart(j), end = rowEnd(j); i <= end; i += 1) {
      // Widely separated wet patches can span the whole course. Check the
      // original height mask before touching paged indices: fewer than three
      // corners cannot emit a triangle, even inside that large bounding box.
      const corners = (Number.isNaN(S[j * nx + i]) ? 0 : 1)
        + (Number.isNaN(S[j * nx + i + 1]) ? 0 : 1)
        + (Number.isNaN(S[(j + 1) * nx + i]) ? 0 : 1)
        + (Number.isNaN(S[(j + 1) * nx + i + 1]) ? 0 : 1);
      if (corners < 3) continue;
      const a = scratch.indexAt(j * nx + i);
      const b = scratch.indexAt(j * nx + i + 1);
      const c = scratch.indexAt((j + 1) * nx + i);
      const d = scratch.indexAt((j + 1) * nx + i + 1);
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
  if(offset!==indexCount)throw Error('Native sheet index count changed during synchronous build');
  return { pos, nor, index };
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
const halfOne = new Float32Array(1), halfOneBits = new Uint32Array(halfOne.buffer);
/** One value, with the same bits toHalfArray gives it (2026-10-22: the live
 * mapper converts only the cells it rewrote). `v` is a Float32 value. */
export function toHalfBits(v: number): number {
  const { base, shift } = tables();
  halfOne[0] = v;
  let f = halfOneBits[0];
  const a = f & 0x7fffffff;
  if (a > 0x476a6000) {
    if (a <= 0x7f800000) f = (f & 0x80000000) | 0x476a6000;
    else { halfOne[0] = v; f = halfOneBits[0]; }
  }
  const e = (f >>> 23) & 0x1ff;
  return base[e] + ((f & 0x007fffff) >> shift[e]);
}

export function toHalfArray(src: Float32Array, out: Uint16Array = new Uint16Array(src.length)): Uint16Array {
  const { base, shift } = tables();
  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  // 2026-10-21: read the source bits directly (the live flow map converts
  // three 23.7-million-value textures for each picture). The clamp to
  // +/-60000 acts on the bits: a magnitude over 60000 (0x476a6000) up to
  // infinity takes 60000 with its sign. A NaN keeps the old value path, so
  // every output bit is the same as before.
  const bits = new Uint32Array(src.buffer, src.byteOffset, src.length);
  for (let i = 0; i < src.length; i += 1) {
    let f = bits[i];
    const a = f & 0x7fffffff;
    if (a > 0x476a6000) {
      if (a <= 0x7f800000) f = (f & 0x80000000) | 0x476a6000;
      else { f32[0] = src[i]; f = u32[0]; }
    }
    const e = (f >>> 23) & 0x1ff;
    out[i] = base[e] + ((f & 0x007fffff) >> shift[e]);
  }
  return out;
}
