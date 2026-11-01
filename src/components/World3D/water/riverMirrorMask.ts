/**
 * THE MIRROR'S WATER MASK (2026-10-26): where on the mirror render the water
 * can read, as a coarse screen grid.
 *
 * The water reads the mirror render (`uReflection`) at the projection of a
 * point 18 m along its reflected ray, from the reflection plane under the
 * water pixel (riverWaterMaterial: `Pm + 18 R`). The rippled normal turns
 * that ray, and the rough-water gloss reads again along `Rup` (the reflected
 * ray turned up by 0.5). A plant whose mirror image lies outside every such
 * read never reaches the screen, so the mirror need not draw it.
 *
 * Measured 2026-10-26 (live page, 2560x1440, wide view): the plants cost
 * about 2.2 of the mirror's 2.7 ms; the ground about 0.1 ms. This mask lets
 * the vegetation cull drop the plants that no water pixel can reflect.
 *
 * The mask is conservative: each wet sample marks the screen box of its
 * three reads (the flat read, the flat ray's 18 m point and the gloss read),
 * grown by the ripple turn (`RIPPLE_REACH_M` at the read's depth) and by the
 * sample spacing. A cull that uses it can only drop a plant that no read can
 * reach. Uncertain: a slope steeper than the reach allows (white water) reads
 * further out; the reach is set for a slope of 0.2, a riffle's.
 */

/** The read distance along the reflected ray, m (riverWaterMaterial: 18.0). */
export const MIRROR_READ_M = 18;
/**
 * How far a ripple can move a read, m: a slope of 0.2 turns the reflected
 * ray by 2 atan(0.2) = 0.39 rad, which moves the 18 m read by 7.1 m. 8 m
 * keeps a margin.
 */
export const RIPPLE_REACH_M = 8;

export interface MirrorMaskGrid { nx: number; nz: number; dx: number; x0: number; z0: number }

export interface MirrorMask {
  cols: number;
  rows: number;
  /** Summed-area table, (cols + 1) x (rows + 1), of the marked cells. */
  sat: Int32Array;
  /** Marked cells, cols x rows (row 0 at the bottom of the image, NDC y = -1). */
  bits: Uint8Array;
  /** Wet samples that marked the mask. */
  samples: number;
  /** True when a read fell behind the eye: the whole mask is marked (no cull). */
  full: boolean;
}

/**
 * Build the mask. `vp` is the mirror's view-projection (column-major, the
 * matrix the vegetation cull tests against); `eye` is the main camera's
 * position (the reflected ray depends on it); `planeY` the reflection plane.
 */
export function buildMirrorMask(
  vp: ArrayLike<number>,
  eye: { x: number; y: number; z: number },
  planeY: number,
  grid: MirrorMaskGrid,
  h: ArrayLike<number>,
  opts: { cols?: number; rows?: number; maxSamples?: number; wetMin?: number } = {},
): MirrorMask {
  const cols = opts.cols ?? 96;
  const rows = opts.rows ?? 54;
  const wetMin = opts.wetMin ?? 0.05;
  const bits = new Uint8Array(cols * rows);
  const { nx, nz, dx, x0, z0 } = grid;
  // Sample every s-th cell in each direction: at most maxSamples looked at.
  const s = Math.max(1, Math.ceil(Math.sqrt((nx * nz) / (opts.maxSamples ?? 20000))));
  const spacing = s * dx;
  let samples = 0;
  let full = false;
  const out = [0, 0, 0];
  // Project a world point; false when it lies behind the eye.
  const proj = (x: number, y: number, z: number): boolean => {
    const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (w <= 1e-3) return false;
    out[0] = (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w;
    out[1] = (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w;
    out[2] = w;
    return true;
  };
  // The NDC size of a world length at clip depth w: the x and y rows of vp.
  const sx = Math.hypot(vp[0], vp[4], vp[8]);
  const sy = Math.hypot(vp[1], vp[5], vp[9]);
  const scale = Math.max(sx, sy);
  for (let j = 0; j < nz && !full; j += s) {
    for (let i = 0; i < nx; i += s) {
      if (!(h[j * nx + i] > wetMin)) continue;
      const px = x0 + (i + 0.5) * dx;
      const pz = z0 + (j + 0.5) * dx;
      // The flat surface's reflected ray: the view ray from the eye with y turned.
      let vx = px - eye.x; let vy = planeY - eye.y; let vz = pz - eye.z;
      const vl = Math.hypot(vx, vy, vz) || 1;
      vx /= vl; vy = -vy / vl; vz /= vl;
      const ry = Math.max(vy, 0.02);
      // The gloss read: the ray turned up by 0.5, then normalized.
      const gy = Math.max(vy, 0) + 0.5;
      const gl = Math.hypot(vx, gy, vz) || 1;
      let xmin = Infinity; let xmax = -Infinity; let ymin = Infinity; let ymax = -Infinity;
      let reach = 0;
      const pts: Array<[number, number, number, number]> = [
        [px, planeY, pz, spacing],
        [px + MIRROR_READ_M * vx, planeY + MIRROR_READ_M * ry, pz + MIRROR_READ_M * vz, RIPPLE_REACH_M + spacing],
        [px + (MIRROR_READ_M * vx) / gl, planeY + (MIRROR_READ_M * gy) / gl, pz + (MIRROR_READ_M * vz) / gl, RIPPLE_REACH_M + spacing],
      ];
      let k = 0;
      for (; k < 3; k += 1) {
        const [x, y, z, r] = pts[k];
        if (!proj(x, y, z)) break;
        const rn = (r * scale) / out[2];
        xmin = Math.min(xmin, out[0] - rn); xmax = Math.max(xmax, out[0] + rn);
        ymin = Math.min(ymin, out[1] - rn); ymax = Math.max(ymax, out[1] + rn);
        reach = Math.max(reach, rn);
      }
      if (k < 3) {
        // A read behind the eye: the flat read alone cannot bound it. Mark all.
        if (k > 0) { full = true; break; }
        continue; // The water point itself is behind the eye: not on screen.
      }
      if (xmax < -1 || xmin > 1 || ymax < -1 || ymin > 1) continue;
      samples += 1;
      const c0 = Math.max(0, Math.floor((xmin * 0.5 + 0.5) * cols) - 1);
      const c1 = Math.min(cols - 1, Math.floor((xmax * 0.5 + 0.5) * cols) + 1);
      const r0 = Math.max(0, Math.floor((ymin * 0.5 + 0.5) * rows) - 1);
      const r1 = Math.min(rows - 1, Math.floor((ymax * 0.5 + 0.5) * rows) + 1);
      for (let r = r0; r <= r1; r += 1) bits.fill(1, r * cols + c0, r * cols + c1 + 1);
    }
  }
  if (full) bits.fill(1);
  const sat = new Int32Array((cols + 1) * (rows + 1));
  for (let r = 0; r < rows; r += 1) {
    let run = 0;
    for (let c = 0; c < cols; c += 1) {
      run += bits[r * cols + c];
      sat[(r + 1) * (cols + 1) + c + 1] = sat[r * (cols + 1) + c + 1] + run;
    }
  }
  return { cols, rows, sat, bits, samples, full };
}

/**
 * Can any water read reach this sphere's mirror image? True when the sphere
 * meets the eye plane (no bound) or its screen box covers a marked cell.
 */
export function mirrorMaskHits(m: MirrorMask, vp: ArrayLike<number>, cx: number, cy: number, cz: number, radius: number): boolean {
  if (m.full) return true;
  const w = vp[3] * cx + vp[7] * cy + vp[11] * cz + vp[15];
  if (w <= radius) return true;
  const x = (vp[0] * cx + vp[4] * cy + vp[8] * cz + vp[12]) / w;
  const y = (vp[1] * cx + vp[5] * cy + vp[9] * cz + vp[13]) / w;
  const scale = Math.max(Math.hypot(vp[0], vp[4], vp[8]), Math.hypot(vp[1], vp[5], vp[9]));
  const rn = (radius * scale) / w;
  const c0 = Math.max(0, Math.floor(((x - rn) * 0.5 + 0.5) * m.cols));
  const c1 = Math.min(m.cols - 1, Math.floor(((x + rn) * 0.5 + 0.5) * m.cols));
  const r0 = Math.max(0, Math.floor(((y - rn) * 0.5 + 0.5) * m.rows));
  const r1 = Math.min(m.rows - 1, Math.floor(((y + rn) * 0.5 + 0.5) * m.rows));
  if (c0 > c1 || r0 > r1) return false;
  const W = m.cols + 1;
  const sum = m.sat[(r1 + 1) * W + c1 + 1] - m.sat[r0 * W + c1 + 1] - m.sat[(r1 + 1) * W + c0] + m.sat[r0 * W + c0];
  return sum > 0;
}
