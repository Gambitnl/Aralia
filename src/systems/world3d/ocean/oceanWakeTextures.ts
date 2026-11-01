/**
 * @file oceanWakeTextures.ts
 * The original periodic lace, net and mass texture builders for wake foam.
 * Seeded generators, rank equalization, array layout and sample order are retained.
 * Existing look presets read the same original lace weights.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 03:15:52
 * Dependents: systems/world3d/ocean/oceanWakeLook.ts, systems/world3d/ocean/oceanWakeMath.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { smoothstep } from './oceanWakeWaves';


/* ------------------------------------------------------------------ */
/* The foam lace texture                                               */
/* ------------------------------------------------------------------ */

/** 32-bit integer hash to [0, 1). PCG-style, deterministic. */
export function wakeHash01(x: number): number {
  let s = (Math.imul(x | 0, 747796405) + 2891336453) >>> 0;
  const w = Math.imul(((s >>> ((s >>> 28) + 4)) ^ s) >>> 0, 277803737) >>> 0;
  s = ((w >>> 22) ^ w) >>> 0;
  return s / 4294967296;
}

/**
 * A periodic value-noise lattice of nx by ny, precomputed. Filling the lace
 * texel by texel with a hash per corner took 4 s at 512 squared; with the
 * lattice and the hole cells below tabulated it is a small fraction of that.
 */
class ValueLattice {
  private readonly v: Float32Array;
  constructor(readonly nx: number, readonly ny: number, seed: number) {
    this.v = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) this.v[j * nx + i] = wakeHash01(i * 73856093 ^ j * 19349663 ^ seed * 83492791);
    }
  }
  /** Smooth-interpolated value at (x, y) in lattice units, wrapping. */
  at(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const i0 = ((xi % this.nx) + this.nx) % this.nx;
    const j0 = ((yi % this.ny) + this.ny) % this.ny;
    const i1 = (i0 + 1) % this.nx;
    const j1 = (j0 + 1) % this.ny;
    const a = this.v[j0 * this.nx + i0];
    const b = this.v[j0 * this.nx + i1];
    const c = this.v[j1 * this.nx + i0];
    const d = this.v[j1 * this.nx + i1];
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
}

/** Periodic fBm in [0, 1] (about) over precomputed lattices, doubling each octave. */
class PeriodicFbm {
  private readonly oct: ValueLattice[] = [];
  constructor(fu: number, fv: number, octaves: number, seed: number) {
    let mu = fu;
    let mv = fv;
    for (let o = 0; o < octaves; o += 1) {
      this.oct.push(new ValueLattice(mu, mv, seed + o * 17));
      mu *= 2;
      mv *= 2;
    }
  }
  /** At (u, v) in [0, 1) tile units. */
  at(u: number, v: number): number {
    let sum = 0;
    let norm = 0;
    let amp = 1;
    for (const l of this.oct) {
      sum += amp * l.at(u * l.nx, v * l.ny);
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  }
}

/**
 * Periodic bubble holes, precomputed per cell: 0 at a hole's center, 1 in
 * the foam. Each cell holds one hole at a jittered point, with its own
 * radius (0.18 to 0.55 of a cell), a stretch up to 1.8 across a random
 * axis (popped cells stretch in the shear), and, in `emptyShare` of the
 * cells, no hole at all, so the holes are of many sizes and unevenly
 * spread, as popped cells in a raft are.
 */
class PeriodicHoles {
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly inv: Float32Array;
  private readonly ca: Float32Array;
  private readonly sa: Float32Array;
  private readonly st: Float32Array;
  private readonly on: Uint8Array;
  constructor(readonly cells: number, seed: number, emptyShare: number) {
    const n = cells * cells;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.inv = new Float32Array(n);
    this.ca = new Float32Array(n);
    this.sa = new Float32Array(n);
    this.st = new Float32Array(n);
    this.on = new Uint8Array(n);
    for (let wj = 0; wj < cells; wj += 1) {
      for (let wi = 0; wi < cells; wi += 1) {
        const k = wj * cells + wi;
        const base = wi * 73856093 ^ wj * 19349663 ^ seed * 83492791;
        this.px[k] = 0.1 + 0.8 * wakeHash01(base);
        this.py[k] = 0.1 + 0.8 * wakeHash01(base + 1);
        this.on[k] = wakeHash01(base + 2) < emptyShare ? 0 : 1;
        this.inv[k] = 1 / (0.18 + 0.37 * wakeHash01(base + 3));
        const ang = 2 * Math.PI * wakeHash01(base + 4);
        this.ca[k] = Math.cos(ang);
        this.sa[k] = Math.sin(ang);
        this.st[k] = 1 + 0.8 * wakeHash01(base + 5);
      }
    }
  }
  /** At (u, v) in [0, 1) tile units. */
  at(u: number, v: number): number {
    const c = this.cells;
    const x = u * c;
    const y = v * c;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let h = 1;
    for (let dj = -1; dj <= 1; dj += 1) {
      const cj = yi + dj;
      const wj = ((cj % c) + c) % c;
      for (let di = -1; di <= 1; di += 1) {
        const ci = xi + di;
        const wi = ((ci % c) + c) % c;
        const k = wj * c + wi;
        if (this.on[k] === 0) continue;
        const dx = x - (ci + this.px[k]);
        const dy = y - (cj + this.py[k]);
        const a = dx * this.ca[k] + dy * this.sa[k];
        const b = (-dx * this.sa[k] + dy * this.ca[k]) * this.st[k];
        const d = Math.sqrt(a * a + b * b) * this.inv[k];
        if (d < 1.25) h = Math.min(h, smoothstep(0.35, 1.25, d));
      }
    }
    return h;
  }
}

/**
 * The foam lace: a tileable RGBA image the surface samples at several scales.
 *
 *   R  THE RAFT. Foam at the scales the eye reads in a trail: large gaps of
 *      open water, medium rafts, the popped cells inside them and a fine
 *      speckle of bubbles. Round 1 used popped cells alone (three octaves of
 *      round holes), and both blind critics read the trail as "one sheet
 *      punched with round holes of nearly the same size, like Swiss cheese".
 *      So the channel is a sum of standardized fields: a domain-warped fBm
 *      from 4 to 128 cells a tile (0.6 of the weight: the gaps and rafts,
 *      bent out of round by a 2-cell warp of a quarter tile), the popped
 *      cells (`PeriodicHoles`, 0.3) and an fBm speckle at 64 cells (0.1),
 *      then ranked over the tile, so the channel is uniform on 0 to 1. As
 *      the foam thins, the threshold climbs the rank: the big gaps open
 *      first and the rafts break up into lace with holes in it.
 *   G  CLUMPS. Five octaves of value noise: where foam gathers and thins.
 *   B  STREAKS. The same, 6 times finer across than along: the turbulence
 *      behind a hull draws its foam out along the track.
 *   A  PATCHES. Two coarse octaves: whole rafts that hold together as the
 *      trail breaks up.
 *
 * Each channel is 0 to 1. Deterministic in `seed`.
 */
export function wakeLaceImage(size = 512, seed = 0x3a7e): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const warpU = new PeriodicFbm(8, 8, 3, seed + 401);
  const warpV = new PeriodicFbm(8, 8, 3, seed + 409);
  const h1 = new PeriodicHoles(13, seed, 0.35);
  const h2 = new PeriodicHoles(29, seed + 7, 0.25);
  const h3 = new PeriodicHoles(67, seed + 13, 0.2);
  const raftWarpU = new PeriodicFbm(2, 2, 4, seed + 41);
  const raftWarpV = new PeriodicFbm(2, 2, 4, seed + 43);
  const raft = new PeriodicFbm(4, 4, 6, seed + 47);
  const speck = new PeriodicFbm(64, 64, 2, seed + 31);
  const fg = new PeriodicFbm(4, 4, 5, seed + 101);
  const fb = new PeriodicFbm(2, 12, 4, seed + 211);
  const fa = new PeriodicFbm(2, 2, 2, seed + 307);
  const stretch = (x: number) => Math.round(255 * Math.min(1, Math.max(0, (x - 0.5) * 1.9 + 0.5)));
  const wrap = (x: number) => x - Math.floor(x);
  const n = size * size;
  const fRaft = new Float32Array(n);
  const fHoles = new Float32Array(n);
  const fSpeck = new Float32Array(n);
  for (let j = 0; j < size; j += 1) {
    const v = j / size;
    for (let i = 0; i < size; i += 1) {
      const u = i / size;
      const k = j * size + i;
      // A warp of a tenth of a coarse cell bends the holes out of round
      // and out of line.
      const uu = wrap(u + 0.012 * (warpU.at(u, v) - 0.5));
      const vv = wrap(v + 0.012 * (warpV.at(u, v) - 0.5));
      fHoles[k] = Math.min(h1.at(uu, vv), h2.at(uu, vv), 0.25 + 0.75 * h3.at(uu, vv));
      const ru = wrap(u + 0.25 * (raftWarpU.at(u, v) - 0.5));
      const rv = wrap(v + 0.25 * (raftWarpV.at(u, v) - 0.5));
      fRaft[k] = raft.at(ru, rv);
      fSpeck[k] = speck.at(u, v);
      const o = k * 4;
      // Value-noise fBm sits in about 0.2..0.8; stretch it to fill 0..1.
      out[o + 1] = stretch(fg.at(u, v));
      out[o + 2] = stretch(fb.at(u, v));
      out[o + 3] = stretch(fa.at(u, v));
    }
  }
  const standard = (f: Float32Array) => {
    let m = 0;
    let m2 = 0;
    for (let k = 0; k < n; k += 1) { m += f[k]; m2 += f[k] * f[k]; }
    m /= n;
    const sd = Math.sqrt(Math.max(m2 / n - m * m, 1e-12));
    for (let k = 0; k < n; k += 1) f[k] = (f[k] - m) / sd;
  };
  standard(fRaft);
  standard(fHoles);
  standard(fSpeck);
  const sum = new Float32Array(n);
  for (let k = 0; k < n; k += 1) sum[k] = 0.6 * fRaft[k] + 0.3 * fHoles[k] + 0.1 * fSpeck[k];
  // Rank over the tile: a stable order, so the image is deterministic.
  const order = new Uint32Array(n);
  for (let k = 0; k < n; k += 1) order[k] = k;
  order.sort((x, y) => (sum[x] - sum[y]) || (x - y));
  for (let r = 0; r < n; r += 1) out[order[r] * 4] = Math.round((255 * r) / (n - 1));
  return out;
}

/**
 * THE LACE SCALES, meters per texture tile, for the four channels of
 * `wakeLaceImage` (raft, clumps, streaks, patches). A 12 m raft tile puts
 * its gaps and rafts at 3 m and down and its popped cells 18 cm to 0.9 m
 * apart: the reference's holes at 20 to 36 m behind the stern are 5 to 25
 * px, 0.2 to 1 m (boat-w-23.png at about 0.035 m a pixel across and twice
 * that along the view). Round 1's 7 m tile of cells alone read as an even
 * salt of same-sized holes ("Swiss cheese"). The clumps are 23 m a tile
 * (about three beams); the streaks 19 m, drawn out three times along the
 * flow in the read, ribbons 1.6 m wide at their widest (at 41 m they were
 * 3.4 m wide and one of their gaps split the chase view's trail in two);
 * the patches 97 m. Primes, so the four never line up.
 */
export const WAKE_LACE_TILE_M = [12, 23, 19, 97] as const;

/**
 * THE LACE MIX: the channels' weights in the coverage noise. The raft
 * carries most of it, so thinning foam opens its gaps and cells; the
 * streaks draw it out along the track and the clumps shape where; the
 * patches keep whole rafts together. These are round 2's weights, the
 * read that won the chase view; round 3 moved the streaks to 0.1 (see
 * `WAKE_LOOK_ROUND3`) and lost it.
 */
export const WAKE_LACE_WEIGHTS = [0.4, 0.24, 0.22, 0.14] as const;

/** Knots of the lace's coverage table. */
export const WAKE_LACE_CDF_KNOTS = 64;

/**
 * The lace's coverage table: entry k is the share of the water whose mixed
 * noise (WAKE_LACE_WEIGHTS over the four channels) is under k / KNOTS.
 * The four channels are sampled at independent points, as the surface
 * reads them at incommensurate scales. With this table the surface maps
 * the noise to a uniform value, so a foam amount of a is a coverage of a:
 * the model's numbers (WAKE_STERN_FOAM_PEAK and the rest) are what shows.
 */
export function wakeLaceCdfTable(
  img: Uint8Array, size: number, samples = 200000, seed = 0x51ab,
  weights: readonly [number, number, number, number] = WAKE_LACE_WEIGHTS,
): number[] {
  const counts = new Float64Array(WAKE_LACE_CDF_KNOTS + 1);
  let h = seed;
  const next = () => { h = (h + 0x9e3779b9) | 0; return wakeHash01(h); };
  const cells = size * size;
  for (let s = 0; s < samples; s += 1) {
    let n = 0;
    for (let c = 0; c < 4; c += 1) {
      const idx = Math.min(cells - 1, Math.floor(next() * cells));
      n += weights[c] * (img[idx * 4 + c] / 255);
    }
    const k = Math.min(WAKE_LACE_CDF_KNOTS, Math.max(0, Math.ceil(n * WAKE_LACE_CDF_KNOTS)));
    counts[k] += 1;
  }
  const table: number[] = [];
  let acc = 0;
  for (let k = 0; k <= WAKE_LACE_CDF_KNOTS; k += 1) {
    acc += counts[k];
    table.push(acc / samples);
  }
  // Entry k counts noise at or under k / KNOTS; entry 0 is the share at 0.
  return table;
}

/** Apply the coverage table to a mixed noise value: its uniform rank, 0 to 1. */
export function wakeLaceRank(table: readonly number[], n: number): number {
  const x = Math.min(Math.max(n, 0), 1) * WAKE_LACE_CDF_KNOTS;
  const k = Math.min(Math.floor(x), WAKE_LACE_CDF_KNOTS - 1);
  return table[k] + (table[k + 1] - table[k]) * (x - k);
}

/* ------------------------------------------------------------------ */
/* The net lace (round 6)                                              */
/* ------------------------------------------------------------------ */

/**
 * A periodic foam net: the walls between windows of open water. One
 * jittered point per cell (nc by nc cells a tile); each cell joins its
 * right and its lower neighbor with chance `joinP` (bond percolation,
 * union-find, wrapping), so a window is one to many cells and the
 * windows are of many sizes, most small and a few large, as the burst
 * cells of a real foam raft are (bubbles pop into their neighbors and
 * the holes merge). `at` returns a texel's distance to the nearest wall,
 * half the gap between its nearest point and the nearest point of
 * another window (the F2 - F1 of a Voronoi diagram), in cell units.
 */
class PeriodicNet {
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly group: Int32Array;
  constructor(readonly nc: number, seed: number, joinP: number) {
    const n = nc * nc;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    const parent = new Int32Array(n);
    for (let k = 0; k < n; k += 1) parent[k] = k;
    const find = (k: number): number => {
      let r = k;
      while (parent[r] !== r) r = parent[r];
      while (parent[k] !== r) { const nx = parent[k]; parent[k] = r; k = nx; }
      return r;
    };
    const join = (a: number, b: number) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
    };
    for (let j = 0; j < nc; j += 1) {
      for (let i = 0; i < nc; i += 1) {
        const k = j * nc + i;
        const base = i * 73856093 ^ j * 19349663 ^ seed * 83492791;
        this.px[k] = 0.1 + 0.8 * wakeHash01(base);
        this.py[k] = 0.1 + 0.8 * wakeHash01(base + 1);
        if (wakeHash01(base + 2) < joinP) join(k, j * nc + ((i + 1) % nc));
        if (wakeHash01(base + 3) < joinP) join(k, ((j + 1) % nc) * nc + i);
      }
    }
    this.group = new Int32Array(n);
    for (let k = 0; k < n; k += 1) this.group[k] = find(k);
  }
  /** The distance to the nearest wall at (u, v) in [0, 1) tile units, cells. */
  at(u: number, v: number): number {
    const c = this.nc;
    const x = u * c;
    const y = v * c;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let d1 = Infinity;
    let g1 = -1;
    const ds: number[] = [];
    const gs: number[] = [];
    for (let dj = -2; dj <= 2; dj += 1) {
      const cj = yi + dj;
      const wj = ((cj % c) + c) % c;
      for (let di = -2; di <= 2; di += 1) {
        const ci = xi + di;
        const wi = ((ci % c) + c) % c;
        const k = wj * c + wi;
        const dx = x - (ci + this.px[k]);
        const dy = y - (cj + this.py[k]);
        const d = Math.sqrt(dx * dx + dy * dy);
        ds.push(d);
        gs.push(this.group[k]);
        if (d < d1) { d1 = d; g1 = this.group[k]; }
      }
    }
    let d2 = Infinity;
    for (let m = 0; m < ds.length; m += 1) if (gs[m] !== g1 && ds[m] < d2) d2 = ds[m];
    return Number.isFinite(d2) ? (d2 - d1) / 2 : 2;
  }
}

/**
 * THE NET LACE (round 6, the look's laceNet): a tileable RGBA image of
 * foam walls around windows of open water, which the surface reads for
 * the lace of a trail a second or more old.
 *
 * WHY. The raft channel of `wakeLaceImage` is an fBm dotted with popped
 * cells. Its threshold draws foam as blobs with round holes in them: the
 * round-5b chase critic's "soft, cottony blobs with no interior" and "a
 * dalmatian spatter", the quarter critic's "one repeated cellular
 * stipple of one scale". A wake's foam a few seconds old is the other
 * topology: a connected lace of bright walls around dark windows of many
 * sizes, with ragged filament edges (the critics' own words). Folding the
 * raft's rank at its median (the look's laceFold) drew that topology but
 * traced a ring round every popped cell, a doily. So the walls are drawn
 * here directly.
 *
 *   R  THE COARSE NET. 9 cells a tile (1.3 m at a 12 m tile), cells joined
 *      at a chance of 0.38, so windows run from one cell to a dozen:
 *      1 to 5 m across.
 *   G  THE FINE NET. 23 cells a tile at a chance of 0.3: the smaller
 *      windows between (0.4 to 1.5 m at a 9 m tile).
 *   B  unused, 0. A 255.
 *
 * Each net's value is a wall of Gaussian profile, its thickness varied
 * over 0.5 to 1.5 of the mean by a slow fBm (walls thicken and thin, and
 * their junctions are the thickest), plus 0.12 of a window fBm (so a
 * window opens from its deepest part, and the order of equal values never
 * falls back to the scan order) and 0.14 of a fine speckle at 128 cells a
 * tile (the ragged, bubbly edge; at 0.08 and 64 cells the walls drew as
 * smooth white tubes), then ranked over the tile: each channel is uniform on 0 to 1,
 * high on the walls. A threshold at 1 - a covers a: at a small amount only
 * the thickest walls and the junctions stay (broken filaments), at a large
 * one only the window centers open. Deterministic in `seed`.
 */
export function wakeNetImage(size = 512, seed = 0x5e7a): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const n = size * size;
  const specs = [
    { nc: 9, joinP: 0.38, wall: 0.1, seed: seed + 3 },
    { nc: 23, joinP: 0.3, wall: 0.09, seed: seed + 5 },
  ];
  for (let c = 0; c < specs.length; c += 1) {
    const sp = specs[c];
    const net = new PeriodicNet(sp.nc, sp.seed, sp.joinP);
    const thick = new PeriodicFbm(4, 4, 3, sp.seed + 11);
    const win = new PeriodicFbm(Math.max(2, Math.round(sp.nc / 3)), Math.max(2, Math.round(sp.nc / 3)), 3, sp.seed + 13);
    const speck = new PeriodicFbm(128, 128, 2, sp.seed + 17);
    // A warp of about 0.7 of a cell bends the walls: straight Voronoi
    // walls read as cracked mud, not foam.
    const wu = new PeriodicFbm(Math.round(sp.nc * 0.7), Math.round(sp.nc * 0.7), 3, sp.seed + 19);
    const wv = new PeriodicFbm(Math.round(sp.nc * 0.7), Math.round(sp.nc * 0.7), 3, sp.seed + 23);
    const amp = 1.4 / sp.nc;
    const f = new Float32Array(n);
    for (let j = 0; j < size; j += 1) {
      const v = j / size;
      for (let i = 0; i < size; i += 1) {
        const u = i / size;
        const w = sp.wall * (0.5 + 1.0 * Math.min(1, Math.max(0, (thick.at(u, v) - 0.3) / 0.4)));
        const uu = u + amp * (wu.at(u, v) - 0.5);
        const vv = v + amp * (wv.at(u, v) - 0.5);
        const e = net.at(uu - Math.floor(uu), vv - Math.floor(vv)) / w;
        f[j * size + i] = 0.74 * Math.exp(-e * e) + 0.12 * win.at(u, v) + 0.14 * speck.at(u, v);
      }
    }
    const order = new Uint32Array(n);
    for (let k = 0; k < n; k += 1) order[k] = k;
    order.sort((x, y) => (f[x] - f[y]) || (x - y));
    for (let r = 0; r < n; r += 1) out[order[r] * 4 + c] = Math.round((255 * r) / (n - 1));
  }
  for (let k = 0; k < n; k += 1) out[k * 4 + 3] = 255;
  return out;
}

/**
 * THE NET'S SCALES AND MIX: meters per tile of the coarse and the fine
 * net, and their weights in the net's coverage noise (the fine net is read
 * at its own tile, so the two are independent and one coverage table,
 * `wakeLaceCdfTable` with these weights, equalizes the mix). 12 m puts the
 * coarse windows at 1 to 5 m, the size of the reference's dark holes in
 * the quarter view (t0027.png, 0.5 to 3 m); 9 m puts the fine ones at 0.4
 * to 1.5 m, the chase reference's holes 20 to 36 m behind the stern (0.2
 * to 1 m, boat-w-23.png).
 */
export const WAKE_NET_TILE_M = [12, 9] as const;
export const WAKE_NET_WEIGHTS = [0.6, 0.4, 0, 0] as const;

/* ------------------------------------------------------------------ */
/* The foam mass (round 12)                                            */
/* ------------------------------------------------------------------ */

/**
 * A periodic gradient-noise lattice (Perlin's noise with the quintic fade),
 * nx by ny cells a tile. Value noise (ValueLattice) puts its extremes on
 * the lattice's corners, so its thresholds draw blobs that line up on the
 * grid; gradient noise has its extremes between the corners and draws
 * blobs of no one shape or place.
 */
class GradientLattice {
  private readonly g: Float32Array;
  constructor(readonly nx: number, readonly ny: number, seed: number) {
    this.g = new Float32Array(nx * ny * 2);
    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const a = 2 * Math.PI * wakeHash01(i * 73856093 ^ j * 19349663 ^ seed * 83492791);
        this.g[(j * nx + i) * 2] = Math.cos(a);
        this.g[(j * nx + i) * 2 + 1] = Math.sin(a);
      }
    }
  }
  /** Noise at (x, y) in lattice units, x and y at or over 0: about -0.7 to 0.7, mean 0. */
  at(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const nx = this.nx;
    const i0 = xi % nx;
    const j0 = yi % this.ny;
    const i1 = i0 + 1 === nx ? 0 : i0 + 1;
    const j1 = j0 + 1 === this.ny ? 0 : j0 + 1;
    const g = this.g;
    const k00 = (j0 * nx + i0) * 2;
    const k10 = (j0 * nx + i1) * 2;
    const k01 = (j1 * nx + i0) * 2;
    const k11 = (j1 * nx + i1) * 2;
    const a = g[k00] * fx + g[k00 + 1] * fy;
    const b = g[k10] * (fx - 1) + g[k10 + 1] * fy;
    const c = g[k01] * fx + g[k01 + 1] * (fy - 1);
    const d = g[k11] * (fx - 1) + g[k11 + 1] * (fy - 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
}

/**
 * Periodic gradient-noise fBm over a tile, fu by fv cells in its first
 * octave, doubling each octave, amplitudes times `gain`. (Exported since
 * round 14: the trail texture of oceanWakeTrail.ts is made of it.)
 */
export class PeriodicGradientFbm {
  private readonly oct: GradientLattice[] = [];
  private readonly amp: number[] = [];
  constructor(fu: number, fv: number, octaves: number, seed: number, gain = 0.5) {
    let mu = fu;
    let mv = fv;
    let a = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o += 1) {
      this.oct.push(new GradientLattice(mu, mv, seed + o * 29));
      this.amp.push(a);
      norm += a;
      mu *= 2;
      mv *= 2;
      a *= gain;
    }
    for (let o = 0; o < octaves; o += 1) this.amp[o] /= norm;
  }
  /** At (u, v) in [0, 1) tile units. */
  at(u: number, v: number): number {
    let sum = 0;
    for (let o = 0; o < this.oct.length; o += 1) {
      const l = this.oct[o];
      const n = l.at(u * l.nx, v * l.ny);
      sum += this.amp[o] * n;
    }
    return sum;
  }
}

/** The foam mass texture and the scale of its encoded slope. */
export interface WakeMassImage {
  /** RGBA, size x size: see `wakeMassImage`. */
  readonly data: Uint8Array;
  readonly size: number;
  /**
   * The relief's slope per tile width that the B and A channels encode at
   * their ends: a slope s is stored as 0.5 + s / (2 gradScale), clamped.
   */
  readonly gradScale: number;
}

/**
 * THE FOAM MASS (round 12, the look's `mass`): a tileable RGBA image of a
 * churned foam layer: its THICKNESS, its VEINS and its RELIEF. The first
 * axis (u) runs along the flow when the read turns it to the trail's frame.
 *
 * WHY. Twelve quarter-view verdicts asked for one continuous, dense churned
 * band with volume, torn by soft boils, that breaks into lace only at its
 * edges. Every build before this one drew the trail's foam as a THRESHOLD
 * of a lace (the raft's popped cells, the net's windows): a cut through a
 * pattern with one cell size, which reads from the side as "an even lace
 * of same-size round holes", and whose foam has no height, so no light of
 * its own ("a flat decal"). A propeller's near wake seen from a drone is
 * the other way round: a white layer cut by a network of darker veins,
 * drawn out along the flow, that meander, vary in width and open into
 * boils where the water wells up; the white between them is heaped. Seen
 * from the side, the same veins foreshorten into the dark streaks along
 * the reference's band (t0027.png). A first build of a thickness alone
 * (no veins) drew soft white clouds from above ("cottony blobs", the
 * round-5b chase critic), so the veins carry the structure.
 *
 *   R  THE THICKNESS. Gradient-noise fBm, 3 to 48 cells a tile in five
 *      octaves, bent by a warp of 0.06 of a tile, ranked over the tile:
 *      uniform on 0 to 1. Its low values are where the layer thins: the
 *      boils and, at the band's edge and as it ages, the gaps. Gradient
 *      noise, not value noise: value noise puts its extremes on the
 *      lattice's corners, and its thresholds line up on the grid.
 *   G  THE VEINS. The magnitude of a gradient-noise fBm, 3 cells along the
 *      flow by 5 across in its first of four octaves (drawn out 1.7 times
 *      along the flow; at 2.5 times, and 1.4 more in the read, the streaks
 *      it shades ran the whole crop, "brush strokes"), bent by a warp of
 *      0.05, over twice its standard
 *      deviation, clamped: 0 on the noise's zero set, a network of lines
 *      that meander and never close into cells (a noise's zero set is not
 *      a Voronoi diagram), wide where the noise's slope is small, so a
 *      vein opens into a blob in places.
 *   B, A  THE RELIEF'S SLOPE, d H / du and d H / dv in tile units (central
 *      differences on the wrapping tile), stored as 0.5 + s / (2
 *      gradScale). H is the thickness blurred over a fiftieth of the tile
 *      and standardized: the layer's top stands where it is thick, heaps
 *      the read lights by the sun. (A first build put the veins' profile
 *      in H too, and lit, every vein was an embossed crack; blurred less,
 *      the thickness's fine octaves drew a crumpled foil.) The mip of a
 *      slope is the slope of the mip, so it filters as the heaps do.
 *
 * Deterministic in `seed`. About 0.26 s at 512 squared (Node).
 */
export function wakeMassImage(size = 512, seed = 0x6d41): WakeMassImage {
  const n = size * size;
  const thick = new PeriodicGradientFbm(3, 3, 5, seed + 3, 0.5);
  const vein = new PeriodicGradientFbm(3, 5, 4, seed + 5, 0.5);
  const warpU = new PeriodicGradientFbm(3, 3, 3, seed + 11);
  const warpV = new PeriodicGradientFbm(3, 3, 3, seed + 13);
  const fT = new Float32Array(n);
  const fV = new Float32Array(n);
  const wrap = (x: number) => x - Math.floor(x);
  let m2 = 0;
  for (let j = 0; j < size; j += 1) {
    const v = j / size;
    for (let i = 0; i < size; i += 1) {
      const u = i / size;
      const k = j * size + i;
      const wu = warpU.at(u, v);
      const wv = warpV.at(u, v);
      fT[k] = thick.at(wrap(u + 0.06 * wu), wrap(v + 0.06 * wv));
      fV[k] = vein.at(wrap(u + 0.05 * wv), wrap(v + 0.05 * wu));
      m2 += fV[k] * fV[k];
    }
  }
  const sdV = Math.sqrt(Math.max(m2 / n, 1e-12));
  const order = new Uint32Array(n);
  for (let k = 0; k < n; k += 1) order[k] = k;
  order.sort((x, y) => (fT[x] - fT[y]) || (x - y));
  const rT = new Float32Array(n);
  for (let q = 0; q < n; q += 1) rT[order[q]] = q / (n - 1);
  const gV = new Float32Array(n);
  for (let k = 0; k < n; k += 1) gV[k] = Math.min(1, Math.abs(fV[k]) / (2 * sdV));
  // The thickness blurred (a box of a fiftieth of the tile each way) and
  // standardized, for the relief's heaps.
  const r = Math.max(1, Math.round(size / 50));
  const tmp = new Float32Array(n);
  const bl = new Float32Array(n);
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      let acc = 0;
      for (let d = -r; d <= r; d += 1) acc += rT[j * size + ((i + d + size) % size)];
      tmp[j * size + i] = acc / (2 * r + 1);
    }
  }
  let mb = 0;
  let mb2 = 0;
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      let acc = 0;
      for (let d = -r; d <= r; d += 1) acc += tmp[((j + d + size) % size) * size + i];
      const x = acc / (2 * r + 1);
      bl[j * size + i] = x;
      mb += x;
      mb2 += x * x;
    }
  }
  mb /= n;
  const sdB = Math.sqrt(Math.max(mb2 / n - mb * mb, 1e-12));
  const H = new Float32Array(n);
  for (let k = 0; k < n; k += 1) H[k] = (bl[k] - mb) / sdB;
  // The relief's slope per tile width, and the scale that holds 99% of it.
  const gu = new Float32Array(n);
  const gv = new Float32Array(n);
  const mags = new Float32Array(Math.ceil(n / 8));
  let nm = 0;
  for (let j = 0; j < size; j += 1) {
    const jm = ((j - 1 + size) % size) * size;
    const jp = ((j + 1) % size) * size;
    for (let i = 0; i < size; i += 1) {
      const im = (i - 1 + size) % size;
      const ip = (i + 1) % size;
      const k = j * size + i;
      gu[k] = ((H[j * size + ip] - H[j * size + im]) / 2) * size;
      gv[k] = ((H[jp + i] - H[jm + i]) / 2) * size;
      if ((k & 7) === 0) mags[nm++] = Math.max(Math.abs(gu[k]), Math.abs(gv[k]));
    }
  }
  const sorted = mags.subarray(0, nm).sort();
  const gradScale = Math.max(1e-3, sorted[Math.floor(0.99 * (nm - 1))]);
  const data = new Uint8Array(n * 4);
  const enc = (x: number) => Math.round(255 * Math.min(1, Math.max(0, x)));
  for (let k = 0; k < n; k += 1) {
    data[k * 4] = enc(rT[k]);
    data[k * 4 + 1] = enc(gV[k]);
    data[k * 4 + 2] = enc(0.5 + gu[k] / (2 * gradScale));
    data[k * 4 + 3] = enc(0.5 + gv[k] / (2 * gradScale));
  }
  return { data, size, gradScale };
}
