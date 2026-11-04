/**
 * @file clothAtlas.ts — where every cloth point lives on the GPU, and the
 * static data the solver reads per point.
 *
 * Character cloth+armor campaign, slice 1c (2026-11-04). Remy picked GPU
 * particle cloth on WebGL (sheet 71CWggvG q3 + q10): every cloth point of
 * every garment in a scene is one texel of shared float textures, so a town
 * of figures steps in a handful of draw calls instead of per-figure CPU work.
 * This file is the CPU half: it packs garments into the atlas (shelf
 * packing) and writes the per-texel data. It owns no GPU object, so it is
 * unit-testable.
 *
 * Per texel (all RGBA float):
 *   rest      right, down, diag down-right, diag down-left rest lengths
 *             (−1 = no constraint that way). Slack is already applied.
 *   rest2     right-2, down-2 bend rest lengths (−1 = none), bend stiffness,
 *             tether length (meters; see below).
 *   grid      col, row, cols (negative = tube: last column joins the first),
 *             rows.
 *   meta      garment slot, pin slot (−1 = free point), 1 = in use, tether
 *             pin slot (−1 = none).
 *
 * TETHER (long-range attachment). The parallel solve under-converges, and
 * the first rendered cape (2026-11-04) stretched about 20% under its own
 * weight: a calf-length cut dragged at the floor. Each free point is
 * therefore tied to its nearest pin: it may never be farther from that pin
 * than its rest distance plus TETHER_GIVE. It costs one test per point.
 *
 * A point reads its LEFT and UP constraints from the neighbor's right/down
 * entries, so every constraint is stored once and both ends agree on it.
 */
import type { ClothPanel } from './garmentPanels';

export const ATLAS_SIZE = 256;
/** How much farther than its rest distance a point may hang from its pin. */
export const TETHER_GIVE = 1.03;

export interface AtlasRegion {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

export interface AtlasData {
  rest: Float32Array;
  rest2: Float32Array;
  grid: Float32Array;
  meta: Float32Array;
}

/** Shelf packer over an ATLAS_SIZE square. Freed regions are kept and
 * reused by any later garment that fits inside them. */
export class ClothAtlasPacker {
  private shelves: Array<{ y: number; h: number; x: number }> = [];
  private nextY = 0;
  private free: AtlasRegion[] = [];

  allocate(cols: number, rows: number): AtlasRegion {
    if (cols > ATLAS_SIZE || rows > ATLAS_SIZE) {
      throw new Error(`clothAtlas: a ${cols}x${rows} garment is larger than the ${ATLAS_SIZE}² atlas`);
    }
    const reuse = this.free.findIndex((r) => r.cols >= cols && r.rows >= rows);
    if (reuse >= 0) {
      const r = this.free.splice(reuse, 1)[0];
      return { x: r.x, y: r.y, cols, rows };
    }
    for (const s of this.shelves) {
      if (s.h >= rows && s.x + cols <= ATLAS_SIZE) {
        const r = { x: s.x, y: s.y, cols, rows };
        s.x += cols;
        return r;
      }
    }
    if (this.nextY + rows > ATLAS_SIZE) {
      // Loud, not silent: a dropped garment would render as a bare body.
      throw new Error(`clothAtlas: the ${ATLAS_SIZE}² cloth atlas is full (${this.nextY} rows used)`);
    }
    const shelf = { y: this.nextY, h: rows, x: cols };
    this.shelves.push(shelf);
    this.nextY += rows;
    return { x: 0, y: shelf.y, cols, rows };
  }

  release(region: AtlasRegion): void {
    this.free.push(region);
  }
}

export function createAtlasData(): AtlasData {
  const n = ATLAS_SIZE * ATLAS_SIZE * 4;
  const meta = new Float32Array(n);
  // every texel starts unused: no garment, no pin
  for (let i = 0; i < ATLAS_SIZE * ATLAS_SIZE; i++) {
    meta[i * 4] = -1;
    meta[i * 4 + 1] = -1;
    meta[i * 4 + 3] = -1;
  }
  return { rest: new Float32Array(n), rest2: new Float32Array(n), grid: new Float32Array(n), meta };
}

const dist = (p: Float32Array, a: number, b: number): number =>
  Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);

/**
 * Write one garment's static data into its atlas region. `pinSlots[i]` is
 * the pin slot of panel point i, or −1 for a free point.
 */
export function writeGarment(data: AtlasData, region: AtlasRegion, panel: ClothPanel, garmentSlot: number, pinSlots: Int32Array): void {
  const { rows, cols, wrap, rest: p } = panel;
  if (region.cols !== cols || region.rows !== rows) throw new Error('clothAtlas: region does not match the panel');
  const idx = (r: number, c: number): number => r * cols + ((c % cols) + cols) % cols;
  const has = (c: number): boolean => wrap || (c >= 0 && c < cols);
  // The surplus goes across the rows only, and not on the top two rows, so
  // the pinned edge holds its shape (entity-forge fm-003 / fm-010).
  const slackAt = (r: number): number => (r < 2 ? 1 : panel.slack);
  // nearest pin per point (rest space), for the tether
  const pinned: number[] = [];
  for (let i = 0; i < rows * cols; i++) if (pinSlots[i] >= 0) pinned.push(i);
  const tetherPin = (i: number): [number, number] => {
    let best = -1, bestD = Infinity;
    for (const j of pinned) {
      const d = dist(p, i, j);
      if (d < bestD) { bestD = d; best = j; }
    }
    return best < 0 ? [-1, 0] : [pinSlots[best], bestD * TETHER_GIVE];
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = idx(r, c);
      const t = ((region.y + r) * ATLAS_SIZE + region.x + c) * 4;
      const s = slackAt(r);
      // across-row rest lengths carry the slack; along-column ones do not
      data.rest[t] = has(c + 1) ? dist(p, i, idx(r, c + 1)) * s : -1;
      data.rest[t + 1] = r + 1 < rows ? dist(p, i, idx(r + 1, c)) : -1;
      // a shear diagonal grows only in its across-row part, so it does not
      // fight the folds (entity-forge clothPanels)
      if (r + 1 < rows && has(c + 1)) {
        data.rest[t + 2] = Math.hypot(dist(p, i, idx(r, c + 1)) * s, dist(p, i, idx(r + 1, c)));
      } else data.rest[t + 2] = -1;
      if (r + 1 < rows && has(c - 1)) {
        data.rest[t + 3] = Math.hypot(dist(p, i, idx(r, c - 1)) * s, dist(p, i, idx(r + 1, c)));
      } else data.rest[t + 3] = -1;
      data.rest2[t] = has(c + 2) ? dist(p, i, idx(r, c + 2)) * s : -1;
      data.rest2[t + 1] = r + 2 < rows ? dist(p, i, idx(r + 2, c)) : -1;
      data.rest2[t + 2] = panel.bend;
      const [tetherSlot, tetherLen] = pinSlots[i] >= 0 ? [-1, 0] : tetherPin(i);
      data.rest2[t + 3] = tetherLen;
      data.grid[t] = c;
      data.grid[t + 1] = r;
      data.grid[t + 2] = wrap ? -cols : cols;
      data.grid[t + 3] = rows;
      data.meta[t] = garmentSlot;
      data.meta[t + 1] = pinSlots[i];
      data.meta[t + 2] = 1;
      data.meta[t + 3] = tetherSlot;
    }
  }
}

/** Mark a region unused again (its texels stop being stepped). */
export function clearGarment(data: AtlasData, region: AtlasRegion): void {
  for (let r = 0; r < region.rows; r++) {
    for (let c = 0; c < region.cols; c++) {
      const t = ((region.y + r) * ATLAS_SIZE + region.x + c) * 4;
      data.meta[t] = -1;
      data.meta[t + 1] = -1;
      data.meta[t + 2] = 0;
      data.meta[t + 3] = -1;
    }
  }
}

/** Texel-center UV of panel point (row, col) in a region. */
export function texelUv(region: AtlasRegion, r: number, c: number): [number, number] {
  return [(region.x + c + 0.5) / ATLAS_SIZE, (region.y + r + 0.5) / ATLAS_SIZE];
}
