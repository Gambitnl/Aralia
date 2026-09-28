/**
 * @file oceanWakeTrail.ts — the wake's foam TRAIL (round 14): the texture
 * that makes the holes and the edges of the white water behind the hull,
 * and the CPU mirror of how the read lays it along the trail.
 *
 * WHY A NEW STRUCTURE. Rounds 5 to 13 drew the holes in the wake's foam
 * with the lace (`wakeLaceImage`: the raft's popped cells, a Worley-type
 * pattern of round holes, and the net's windows) and, in rounds 12 and 13,
 * cut popped bubbles out of the foam layer with the same lace's rank. Every
 * judge of rounds 6 to 13, in both judged views, named the same fault:
 * "hard-edged white blotches punched with round holes of nearly one size",
 * "leopard spots", "Voronoi or Worley dots". Measured on the judged crops
 * (`wake/r14/measure.py`), the round-13 quarter crop has 119 holes with a
 * median of 12 pixels and a mean axis ratio of 2.36 on screen; the
 * reference's quarter crop has 27 holes, a median of 43 pixels, a 90th to
 * 10th percentile area ratio of 24 and a mean axis ratio of 3.95, every
 * hole drawn out along the trail. So this round replaces the structure, not
 * its tuning: the holes come from a gradient-noise field of many octaves,
 * with no cell and no threshold of one scale, laid out along the trail by
 * the flow that makes a wake:
 *
 *   1. THE JET SHEARS IT. A propeller pushes the water in the middle of the
 *      trail aft, and the water at the sides less. So a parcel born at the
 *      transom at along-position s0 is at s0 - D(n, age) now, D the jet's
 *      displacement, largest on the track and gone at its sides
 *      (`wakeTrailShearM`). The read looks the texture up at the parcel's
 *      birth position s + D: every feature is sheared along the flow by
 *      dD/dn, more as it ages, and slides aft with the jet. The map never
 *      folds (its slope along the flow stays over 1 - dD/dage / U; tested).
 *   2. THE FLOW DRAWS IT OUT. The field is read drawn out along the flow by
 *      a fixed stretch, so every hole is longer along the trail than across
 *      it: a stretch that changes with age would be a warp of a coordinate
 *      hundreds of meters from its origin, and it folds (round 4).
 *   3. THE AMOUNT EATS IT. The wake's own amount (the churn, the breakers'
 *      deposit, the edge lines, their fades) sets how much of the field is
 *      foam, as the lace's did: the field is ranked, so an amount a covers
 *      the share a of the water. Where the amount is high only the field's
 *      deepest lows are holes, few and of many sizes; as it falls with age
 *      and toward the edges the holes grow, merge and open into lace; where
 *      it is low only the field's highs are foam, streaks along the flow.
 *
 * THE TEXTURE (`wakeTrailImage`, 512 x 512, tileable, built once at mount,
 * about 0.4 s on the CPU):
 *
 *   R  THE STRUCTURE. Gradient-noise fBm, `baseCells` cells a tile in its
 *      first octave (4 by default), doubling over `octaves` octaves (5) at
 *      a `gain` (0.55: rougher than 0.5, so the holes' edges are ragged at
 *      more scales), bent by a warp of 0.07 of a tile, ranked over the
 *      tile: uniform on 0 to 1.
 *   G  THE SECOND FIELD. The same kind of noise on its own seeds, 6 to 48
 *      cells a tile in four octaves, ranked. The read takes it at a finer
 *      tile, turned off the trail's axis, and mixes its rank into R's, so
 *      the edges fray into filaments and small holes that do not follow R's
 *      lattice.
 *   B, A  THE RELIEF. The slope of R blurred over a 64th of the tile, in
 *      tile units, stored as 0.5 + s / (2 gradScale): the heaps the read
 *      lights by the sun.
 *
 * Deterministic in `seed`. The sea stays a pure function of (seed, time):
 * the texture is fixed, and the read keys only on the trail's own frame
 * (along the course, across it) and its age, never on the camera.
 */
import { PeriodicGradientFbm, smoothstep } from './oceanWakeMath';

/** The trail texture and the scale of its encoded slope. */
export interface WakeTrailImage {
  /** RGBA, size x size: see the file's header. */
  readonly data: Uint8Array;
  readonly size: number;
  /**
   * The relief's slope per tile width that B and A encode at their ends: a
   * slope s is stored as 0.5 + s / (2 gradScale), clamped.
   */
  readonly gradScale: number;
}

/** Rank a field over its texels: uniform on 0 to 1, ties by index. */
function rankField(f: Float32Array): Float32Array {
  const n = f.length;
  const order = new Uint32Array(n);
  for (let k = 0; k < n; k += 1) order[k] = k;
  order.sort((x, y) => (f[x] - f[y]) || (x - y));
  const r = new Float32Array(n);
  for (let q = 0; q < n; q += 1) r[order[q]] = q / (n - 1);
  return r;
}

/** Box blur of a wrapping size x size field, radius r texels, each axis. */
function blurWrap(f: Float32Array, size: number, r: number): Float32Array {
  const n = size * size;
  const tmp = new Float32Array(n);
  const out = new Float32Array(n);
  const w = 1 / (2 * r + 1);
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      let acc = 0;
      for (let d = -r; d <= r; d += 1) acc += f[j * size + ((i + d + size) % size)];
      tmp[j * size + i] = acc * w;
    }
  }
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) {
      let acc = 0;
      for (let d = -r; d <= r; d += 1) acc += tmp[((j + d + size) % size) * size + i];
      out[j * size + i] = acc * w;
    }
  }
  return out;
}

/**
 * THE TRAIL TEXTURE (round 14). See the file's header for the channels.
 * The first axis (u) runs along the flow when the read turns it to the
 * trail's frame.
 */
export function wakeTrailImage(
  size = 512, seed = 0x7a11, gain = 0.55, octaves = 5, baseCells = 4,
): WakeTrailImage {
  const n = size * size;
  const main = new PeriodicGradientFbm(baseCells, baseCells, octaves, seed + 3, gain);
  const second = new PeriodicGradientFbm(6, 6, 4, seed + 7, 0.5);
  const warpU = new PeriodicGradientFbm(3, 3, 3, seed + 11);
  const warpV = new PeriodicGradientFbm(3, 3, 3, seed + 13);
  const warp2U = new PeriodicGradientFbm(4, 4, 2, seed + 17);
  const warp2V = new PeriodicGradientFbm(4, 4, 2, seed + 19);
  const fR = new Float32Array(n);
  const fG = new Float32Array(n);
  const wrap = (x: number) => x - Math.floor(x);
  for (let j = 0; j < size; j += 1) {
    const v = j / size;
    for (let i = 0; i < size; i += 1) {
      const u = i / size;
      const k = j * size + i;
      fR[k] = main.at(wrap(u + 0.07 * warpU.at(u, v)), wrap(v + 0.07 * warpV.at(u, v)));
      fG[k] = second.at(wrap(u + 0.05 * warp2U.at(u, v)), wrap(v + 0.05 * warp2V.at(u, v)));
    }
  }
  const rR = rankField(fR);
  const rG = rankField(fG);
  // The relief: R's rank blurred over a 64th of the tile, standardized.
  const bl = blurWrap(rR, size, Math.max(1, Math.round(size / 64)));
  let mb = 0;
  let mb2 = 0;
  for (let k = 0; k < n; k += 1) {
    mb += bl[k];
    mb2 += bl[k] * bl[k];
  }
  mb /= n;
  const sd = Math.sqrt(Math.max(mb2 / n - mb * mb, 1e-12));
  const gu = new Float32Array(n);
  const gv = new Float32Array(n);
  const mags: number[] = [];
  for (let j = 0; j < size; j += 1) {
    const jm = ((j - 1 + size) % size) * size;
    const jp = ((j + 1) % size) * size;
    for (let i = 0; i < size; i += 1) {
      const im = (i - 1 + size) % size;
      const ip = (i + 1) % size;
      const k = j * size + i;
      gu[k] = (((bl[j * size + ip] - bl[j * size + im]) / 2) * size) / sd;
      gv[k] = (((bl[jp + i] - bl[jm + i]) / 2) * size) / sd;
      if ((k & 7) === 0) mags.push(Math.max(Math.abs(gu[k]), Math.abs(gv[k])));
    }
  }
  mags.sort((a, b) => a - b);
  const gradScale = Math.max(1e-3, mags[Math.floor(0.99 * (mags.length - 1))]);
  const data = new Uint8Array(n * 4);
  const enc = (x: number) => Math.round(255 * Math.min(1, Math.max(0, x)));
  for (let k = 0; k < n; k += 1) {
    data[k * 4] = enc(rR[k]);
    data[k * 4 + 1] = enc(rG[k]);
    data[k * 4 + 2] = enc(0.5 + gu[k] / (2 * gradScale));
    data[k * 4 + 3] = enc(0.5 + gv[k] / (2 * gradScale));
  }
  return { data, size, gradScale };
}

/**
 * THE JET'S DISPLACEMENT, meters aft, at `lateralM` from the track and
 * `ageS` seconds behind the transom: dMaxM (1 - e^(-age / tauS)) e^(-(n /
 * widthM)^2). A propeller's race leaves the transom faster than the water
 * beside it and slows as it mixes, so the displacement grows and levels off;
 * its profile across the trail is the race's, largest on the track. The
 * read looks the trail texture up at s + D (the parcel's birth position),
 * so a feature is sheared along the flow by dD/dn: about 2 dMax / width x
 * 0.86 at the race's flanks (n = width / sqrt 2), none on the track itself.
 * The mirror of the read's node (oceanWake.ts), for the tests.
 */
export function wakeTrailShearM(lateralM: number, ageS: number, dMaxM: number, tauS: number, widthM: number): number {
  if (dMaxM <= 0) return 0;
  const g = 1 - Math.exp(-Math.max(ageS, 0) / Math.max(tauS, 1e-6));
  const q = lateralM / Math.max(widthM, 1e-6);
  return dMaxM * g * Math.exp(-q * q);
}

/**
 * THE LANES' DISPLACEMENT, meters (the look's trailLanes; the mirror of the
 * read's node). The race is lanes of faster and slower water side by side:
 * ampM (1 - e^(-age / tauS)) N(x), x = (n + wanderM (slow - 0.5) 2) /
 * laneM, N(x) = 0.6 sin(x + 0.3) + 0.4 sin(2.3 x + 1.7), with `slow` the
 * lace's slow warp (0 to 1, features about 24 m across), so the lanes
 * wander across the trail. Each lane shears the foam its own way, more as
 * it ages.
 */
export function wakeTrailLanesM(
  lateralM: number, ageS: number, slow: number, ampM: number, laneM: number, tauS: number, wanderM: number,
): number {
  if (ampM <= 0) return 0;
  const x = (lateralM + (slow - 0.5) * 2 * wanderM) / Math.max(laneM, 1e-6);
  const prof = 0.6 * Math.sin(x + 0.3) + 0.4 * Math.sin(2.3 * x + 1.7);
  return ampM * (1 - Math.exp(-Math.max(ageS, 0) / Math.max(tauS, 1e-6))) * prof;
}

/**
 * THE SHEET (round 16, the look's trailBand and trailBandAge; the mirror of
 * the read's node). The share the sheet gives at `lateralM` from the track,
 * `behindM` meters behind the transom and `ageS` seconds old, with the
 * edge moved by `wobble` (the second field's value there, 0 to 1): `peak`
 * inside a half-width of halfM + spread behindM, falling to 0 over softM
 * either side of it, grown in over the first meter; its peak holds to t0
 * s, falls to `floor` of itself by t1 s, then decays as e^(-(age - t1) /
 * tauS) (0 tauS: it holds). A share this high leaves only the field's
 * deepest lows as holes: one connected sheet.
 */
export function wakeTrailBandShare(
  lateralM: number, behindM: number, ageS: number, wobble: number,
  band: readonly [number, number, number, number, number, number],
  bandAge: readonly [number, number, number, number],
): number {
  const [peak, halfM, spread, softM, wobM] = band;
  if (peak <= 0) return 0;
  const [t0, t1, floor, tauS] = bandAge;
  const half = halfM + spread * Math.max(behindM, 0);
  const n = Math.abs(lateralM) + (wobM > 0 ? (wobble - 0.5) * 2 * wobM : 0);
  const prof = (1 - smoothstep(half - softM, half + softM, n)) * smoothstep(0, 1, Math.max(behindM, 0));
  let fade = 1 + (floor - 1) * smoothstep(t0, t1, ageS);
  if (tauS > 0) fade *= Math.exp(-Math.max(ageS - t1, 0) / tauS);
  return peak * prof * fade;
}

/**
 * THE ARMS AS CREST LINES (round 16, the look's trailArmLine; the mirror of
 * the read's node): a line of share `peak`, Gaussian of widthM across, at
 * halfTransomM + spread behindM from the track, fading as e^(-age / tauS),
 * grown in over 1.5 m, full where the wake's own height `heightM` passes
 * h0 to h1 and `floor` of itself in a trough.
 */
export function wakeTrailArmShare(
  lateralM: number, behindM: number, ageS: number, heightM: number, halfTransomM: number,
  arm: readonly [number, number, number, number, number, number, number],
): number {
  const [peak, spread, widthM, tauS, h0, h1, floor] = arm;
  if (peak <= 0) return 0;
  const off = (Math.abs(lateralM) - (halfTransomM + spread * Math.max(behindM, 0))) / widthM;
  let line = Math.exp(-off * off) * Math.exp(-Math.max(ageS, 0) / tauS) * smoothstep(0, 1.5, behindM) * peak;
  if (h1 > h0) line *= floor + (1 - floor) * smoothstep(h0, h1, heightM);
  return line;
}

/**
 * THE GRADED MARGIN (round 17, the look's trailFringe; the mirror of the
 * read's node). Under the cover's threshold `edge` (1 - the share), within
 * `reach` of rank, a translucent lace of up to `alpha`, fading out with the
 * distance under the threshold, cut into filaments by the second field's
 * value `fine` (fine0 to fine1), only where the share is over 0 (full by
 * 0.1), and only where the sharp cover `cover` is not.
 */
export function wakeTrailFringe(
  rank: number, edge: number, cover: number, fine: number, share: number,
  fringe: readonly [number, number, number, number, number, number],
): number {
  const [reach, alpha, fine0, fine1] = fringe;
  if (alpha <= 0) return 0;
  const under = edge - rank;
  return (1 - smoothstep(0, reach, under)) * smoothstep(fine0, fine1, fine) * smoothstep(0, 0.1, share) * (1 - cover) * alpha;
}

/**
 * THE MILKY WATER'S PROFILE (round 17, the look's trailMilkWater; the mirror
 * of the read's node): 1 inside the sheet's half-width `halfM` (at the
 * texel's moved offset `nM`), 0 by reachM past it, times e^(-age / tauS),
 * grown in over the first meter behind the transom. The bubble light's gain
 * and whiteness and its weight floor are this times gain, white and weight.
 */
export function wakeTrailMilkWater(nM: number, halfM: number, behindM: number, ageS: number, reachM: number, tauS: number): number {
  return (1 - smoothstep(halfM, halfM + reachM, nM)) * Math.exp(-Math.max(ageS, 0) / tauS) * smoothstep(0, 1, Math.max(behindM, 0));
}

/**
 * The trail's cover at an amount (the mirror of the read's node): the
 * ranked structure `rank` under the ramp at 1 - a, `soft` of rank either
 * side, with a = min(amount x gain, cap). A share a of uniform ranks is
 * covered, less the ramp's softening.
 */
export function wakeTrailCover(rank: number, amount: number, gain: number, cap: number, soft: number): number {
  const a = Math.min(Math.max(amount * gain, 0), cap);
  const edge = 1 - a;
  return smoothstep(edge - soft, edge + soft, rank);
}
