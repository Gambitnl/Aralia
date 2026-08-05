/**
 * @file understoryMeshSource.ts — the layer between the grass and the canopy.
 *
 * Aralia had nothing here. A forest was tree trunks standing in grass, with
 * bushes for punctuation, and that is the single biggest reason the floor read
 * as empty: a real wood's floor is the busiest surface in it. The species below
 * are the three that carry most of that read, taken from the jungle-trail
 * reference (MIT, vendor/jungle-trail/src/world/plants.js).
 *
 * The FORMS are ported, not the code. jungle-trail builds its plants against a
 * baked leaf atlas with custom rib/flex vertex attributes and a wind shader
 * that reads them, none of which Aralia's instanced world path has. Copying its
 * geometry code would drag that whole pipeline in for three plants. What is
 * worth taking is its observations about shape, and those are noted per species
 * below.
 *
 * Same contract as the trees: indexed BufferGeometry data, unit frame with the
 * base at y = 0 and total height 1, vertex colors carrying the woody/leafy
 * split so the per-instance biome tint multiplies through.
 */
import type { TreeGeometryData } from './treeMeshGenerator';
import { mulberry32 } from './treeMeshGenerator';

export type UnderstorySpecies = 'fern' | 'log' | 'sapling';

export const UNDERSTORY_SPECIES: readonly UnderstorySpecies[] = ['fern', 'log', 'sapling'];

/** Variants per species. Small on purpose — these are instanced by the thousand. */
export const UNDERSTORY_VARIANTS = 3;

/**
 * World size in meters the unit geometry is scaled to.
 *
 * A log is measured by LENGTH rather than height, which is why its number looks
 * out of line with the other two: its unit frame is built lying down, so the
 * scale that reaches it is applied along the trunk.
 */
export const UNDERSTORY_SIZE_M: Record<UnderstorySpecies, number> = {
  // Raised with the wider rosette: the size that read right as a narrow spike
  // is too small once the plant spreads, because height stopped being its
  // dominant dimension.
  fern: 1.05,
  log: 4.2,
  sapling: 2.4,
};

/** Woody parts bake brown; the instance tint barely moves them. */
const WOOD: readonly [number, number, number] = [0.31, 0.22, 0.15];
/** Leafy parts bake near-white so the biome tint decides the color. */
const LEAF: readonly [number, number, number] = [0.90, 0.97, 0.88];
/** Litter caught around a plant's base. The darkest value on any of these. */
const DEAD: readonly [number, number, number] = [0.44, 0.36, 0.27];
/**
 * A fallen log's bark, baked well ABOVE the litter it lies on.
 *
 * Split out of DEAD because the two were sharing a value and the log lost.
 * The per-instance tint that reaches this geometry is an understory GREEN
 * (roughly 0.26, 0.38, 0.17 — see the palette in the ground chunk loader), and
 * it multiplies through, so at DEAD the log resolved to about (0.11, 0.13,
 * 0.05): a near-black object lying in shade under a canopy. Lifted here and
 * pulled off green per instance in UnderstoryField, a log lands close to the
 * weathered gray-brown a dead trunk actually is.
 */
const BARK: readonly [number, number, number] = [0.72, 0.63, 0.52];

interface Mesh {
  pos: number[];
  nrm: number[];
  col: number[];
  idx: number[];
}

const empty = (): Mesh => ({ pos: [], nrm: [], col: [], idx: [] });

function vert(m: Mesh, x: number, y: number, z: number, nx: number, ny: number, nz: number, c: readonly [number, number, number]): number {
  const i = m.pos.length / 3;
  m.pos.push(x, y, z);
  m.nrm.push(nx, ny, nz);
  m.col.push(c[0], c[1], c[2]);
  return i;
}

function tri(m: Mesh, a: number, b: number, c: number): void {
  m.idx.push(a, b, c);
}

/**
 * A tapered quad strip along a path — the workhorse for fronds and stems.
 *
 * Emitted single-sided with an outward normal, and drawn with a DoubleSide
 * material. Emitting both windings here instead would double the triangles and
 * z-fight along every shared edge, which is a mistake this codebase has already
 * paid for once in the town walls.
 */
function ribbon(
  m: Mesh,
  pts: Array<[number, number, number]>,
  halfWidths: number[],
  c: readonly [number, number, number],
  axis: [number, number, number] = [1, 0, 0],
): void {
  let prev: [number, number] | null = null;
  for (let i = 0; i < pts.length; i++) {
    const [x, y, z] = pts[i];
    const w = halfWidths[i];
    const a = vert(m, x - axis[0] * w, y - axis[1] * w, z - axis[2] * w, 0, 1, 0, c);
    const b = vert(m, x + axis[0] * w, y + axis[1] * w, z + axis[2] * w, 0, 1, 0, c);
    if (prev) {
      tri(m, prev[0], prev[1], b);
      tri(m, prev[0], b, a);
    }
    prev = [a, b];
  }
}

type V3 = [number, number, number];

function normalize(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/**
 * One flat leaflet, as a quad with a real face normal.
 *
 * The ribbon above bakes (0,1,0) into every vertex, which is right for a
 * stem — a two-vertex cross-section cannot carry curvature anyway — but wrong
 * for a leaflet, because a rank of leaflets shaded with one shared up-normal
 * comes back as a single flat surface however ragged its outline is. jungle-
 * trail spends per-leaflet curl on the same problem; a true face normal is the
 * cheap version of it, and it is what makes overlapping leaflets shade each
 * other. Biased toward +Y so a leaflet standing on edge does not go black
 * under a sky-dominant light rig.
 */
function leaflet(m: Mesh, base: V3, dir: V3, along: V3, len: number, w0: number, w1: number, c: readonly [number, number, number]): void {
  const tipX = base[0] + dir[0] * len;
  const tipY = base[1] + dir[1] * len;
  const tipZ = base[2] + dir[2] * len;
  let n = normalize([
    along[1] * dir[2] - along[2] * dir[1],
    along[2] * dir[0] - along[0] * dir[2],
    along[0] * dir[1] - along[1] * dir[0],
  ]);
  if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
  n = normalize([n[0] * 0.6, n[1] * 0.6 + 0.55, n[2] * 0.6]);
  const a = vert(m, base[0] - along[0] * w0, base[1] - along[1] * w0, base[2] - along[2] * w0, n[0], n[1], n[2], c);
  const b = vert(m, base[0] + along[0] * w0, base[1] + along[1] * w0, base[2] + along[2] * w0, n[0], n[1], n[2], c);
  const d = vert(m, tipX + along[0] * w1, tipY + along[1] * w1, tipZ + along[2] * w1, n[0], n[1], n[2], c);
  const e = vert(m, tipX - along[0] * w1, tipY - along[1] * w1, tipZ - along[2] * w1, n[0], n[1], n[2], c);
  tri(m, a, b, d);
  tri(m, a, d, e);
}

/**
 * Ragged mat of dead matter around a plant's base.
 *
 * jungle-trail calls this a litter skirt and it earns its eight triangles
 * twice: it hides the hard line where a crown meets the terrain, which is what
 * makes a plant look pinned into the ground rather than grown out of it, and
 * it puts the darkest value on the plant at its base, so the rosette above
 * reads as lit from over the top instead of as a uniform green blob.
 */
function litterSkirt(m: Mesh, rng: () => number, radius: number, lobes: number): void {
  const hub = vert(m, 0, 0.012, 0, 0, 1, 0, DEAD);
  for (let i = 0; i < lobes; i++) {
    const a0 = (i / lobes) * Math.PI * 2 + rng() * 0.3;
    const a1 = ((i + 1) / lobes) * Math.PI * 2 + rng() * 0.3;
    const r0 = radius * (0.55 + rng() * 0.75);
    const r1 = radius * (0.55 + rng() * 0.75);
    const v0 = vert(m, Math.cos(a0) * r0, 0.002 + rng() * 0.012, Math.sin(a0) * r0, 0, 1, 0, DEAD);
    const v1 = vert(m, Math.cos(a1) * r1, 0.002 + rng() * 0.012, Math.sin(a1) * r1, 0, 1, 0, DEAD);
    tri(m, hub, v0, v1);
  }
}

/**
 * Fern — the plant that says "forest floor" more than any other.
 *
 * Two things from the reference are worth keeping. Fronds ARCH: they leave the
 * crown climbing and finish nodding over, so a fern read from the side is a
 * fountain rather than a starburst, and a straight-frond fern looks like a
 * palm seedling. And the leaflets get SMALLER toward the tip, which is what
 * gives the frond its taper without needing more geometry.
 */
function buildFern(rng: () => number): TreeGeometryData {
  const m = empty();
  /* Rebuilt PINNATE (2026-08-04, second pass).
   *
   * The first two attempts drew each frond as one solid tapered ribbon and
   * both read as a dark arrowhead — a seedling conifer, not a fern. Widening
   * the ribbon and adding more of them (the first retune) made it worse, not
   * better: it turned a rosette of spikes into a rosette of bigger spikes, and
   * from overhead the plant became a splat.
   *
   * A solid tapered ribbon ALWAYS reads as an arrowhead, at any width, because
   * the outline is the only information in it. What identifies a fern is not
   * the frond outline at all — it is the GAPS. A frond is pinnate: a thin
   * rachis with separate leaflets stepping off it, and the light coming
   * through between those leaflets is the signature. So the ribbon is gone and
   * each frond is now a drawn rachis plus two ranks of individual leaflets.
   *
   * Four form rules taken from jungle-trail's addPinnate (MIT,
   * vendor/jungle-trail/src/world/plants.js ~L393), which solved this same
   * problem against a baked leaf atlas Aralia does not have:
   *
   *  - Leaflet position along the rachis is JITTERED, never evenly pitched.
   *    An even rank of identical teeth is a comb, and a comb is what the eye
   *    calls out as procedural.
   *  - The rake OPENS toward the tip: leaflets at the base stand nearly square
   *    to the rachis and the ones at the end sweep forward almost parallel to
   *    it. That progression is most of what makes a frond read as having grown
   *    from one end rather than been stamped.
   *  - About a third of the leaflets sit ABOVE the rachis instead of drooping
   *    below it. All-drooping leaflets stay inside one plane hanging off one
   *    side, which is a louvre; letting them cross makes them overlap and
   *    shade each other.
   *  - Some leaflets are missing or bitten short. An intact frond grew this
   *    morning.
   */
  const TAU = Math.PI * 2;

  /* One crown-wide lean, applied as a per-frond PITCH and LENGTH bias rather
   * than as a rotation of the finished plant. Rotating the assembled rosette
   * pushes its downhill fronds below y = 0, and finish() then rebases the
   * whole plant off the ground to compensate, which floats the crown a
   * visible few centimeters. Biasing each frond as it is built keeps every
   * base at the origin and still breaks the radial symmetry that made this
   * plant read as a spider from directly above. */
  const leanA = rng() * TAU;
  const leanK = 0.25 + rng() * 0.5;

  const fronds = 7 + Math.floor(rng() * 3);
  for (let f = 0; f < fronds; f++) {
    // Jitter of nearly a whole slot. An even fan is a parasol.
    const yaw = (f / fronds) * TAU + (rng() - 0.5) * 1.5;
    const ox = Math.cos(yaw);
    const oz = Math.sin(yaw);
    const bias = Math.cos(yaw - leanA);
    const len = (0.80 + rng() * 0.42) * (1 + leanK * 0.30 * bias);

    /* The rachis as an arc walked in ARC LENGTH, not as a height curve over a
     * radius. Leaving the crown near vertical and finishing past horizontal is
     * what gives a fern its fountain profile; the previous height-over-radius
     * form could only ever produce a cone, which is why the plant came out
     * three times wider than it was tall. The 2.3 exponent holds the frond
     * steep through its lower half and whips it over near the tip — a linear
     * ramp bends evenly and reads as a wire hoop. Raised from 2.3 to 2.8 after
     * the first pinnate render measured 0.51 m tall against 1.05 m wide: at
     * 2.3 the fronds spend too much of their length past horizontal and the
     * rosette is still a saucer. */
    const a0 = 1.50 + (rng() - 0.5) * 0.26 - leanK * 0.34 * bias;
    const a1 = -0.42 - rng() * 0.45;
    const SEG = 8;
    const ds = len / SEG;
    /* Each frond starts a few centimeters out from the axis instead of all of
     * them at one point. Stacked on a single origin the lower leaflets of
     * every frond occupy the same volume and the middle of the plant fills in
     * solid, which is the arrowhead fault reappearing at rosette scale. */
    const bx = ox * 0.045;
    const bz = oz * 0.045;
    const spine: V3[] = [[bx, 0.05, bz]];
    const tangents: V3[] = [];
    let px = bx;
    let py = 0.05;
    let pz = bz;
    for (let s = 1; s <= SEG; s++) {
      const t = (s - 0.5) / SEG;
      const ang = a0 + (a1 - a0) * Math.pow(t, 2.8);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      px += ox * ca * ds;
      py += sa * ds;
      pz += oz * ca * ds;
      spine.push([px, py, pz]);
      tangents.push([ox * ca, sa, oz * ca]);
    }

    /* The rachis has to be drawn. A frond whose leaflets attach to nothing has
     * an empty line running down its middle, which is more conspicuous than
     * the leaflets are. Sampled at every other spine point: this is a
     * three-millimeter strap at world scale and no one will ever see the
     * facets, whereas eight extra triangles times five thousand instances is
     * a real number. */
    const rachisPts: V3[] = [];
    const rachisW: number[] = [];
    for (let s = 0; s <= SEG; s += 2) {
      rachisPts.push(spine[s]);
      rachisW.push(0.017 * (1 - (s / SEG) * 0.8) + 0.003);
    }
    ribbon(m, rachisPts, rachisW, LEAF, [-oz, 0, ox]);

    const pinnae = 6 + Math.floor(len * 2);
    for (let k = -1; k <= 1; k += 2) {
      for (let i = 0; i < pinnae; i++) {
        // Jittered by most of a slot, and offset per side so the two ranks are
        // never quite opposite each other.
        const sPos = Math.min(0.98, ((i + 0.2 + rng() * 0.85) / pinnae) * 0.82 + 0.17 + (k > 0 ? 0.03 : 0));
        if (rng() < 0.09) continue; // torn off
        const j = Math.min(SEG, Math.max(1, Math.round(sPos * SEG)));
        const at = spine[j];
        const T = tangents[j - 1];
        // The frond's own up: perpendicular to the rachis, in the vertical
        // plane the frond lies in.
        const sa = T[1];
        const ca = Math.hypot(T[0], T[2]);
        const U: V3 = [-ox * sa, ca, -oz * sa];
        const side: V3 = [-oz * k, 0, ox * k];

        const rake = 0.42 + 0.55 * sPos + (rng() - 0.5) * 0.34;
        // Biased so roughly a third of the rank comes out negative and lifts.
        const droop = 0.06 + 0.40 * sPos * sPos + rng() * 0.26 - (rng() - 0.35) * 0.42;
        const cr = Math.cos(rake);
        const sr = Math.sin(rake);
        const dir = normalize([
          side[0] * cr + T[0] * sr - U[0] * droop,
          side[1] * cr + T[1] * sr - U[1] * droop,
          side[2] * cr + T[2] * sr - U[2] * droop,
        ]);

        // Longest about a third along, short at both ends.
        const ext = Math.sin(Math.PI * Math.pow(sPos, 0.6)) * (0.74 + rng() * 0.36);
        const bitten = rng() < 0.13;
        const L = len * 0.24 * Math.min(1.15, ext) * (bitten ? 0.34 + rng() * 0.3 : 1);

        /* The leaflet's width runs along the RACHIS, so the gap between
         * successive leaflets is what the width eats into. Held at 0.20 of the
         * length rather than the 0.42 a real pinna carries: at 0.42 the rank
         * closes up and the frond is a solid ribbon again, which is the fault
         * being fixed. The gaps are the plant. */
        leaflet(m, at, dir, T, L, L * (bitten ? 0.30 : 0.20) + 0.004, L * 0.06 + 0.002, LEAF);
      }
    }
  }

  // Woody crown, then the litter caught around it.
  const cr = 0.045;
  const c0 = vert(m, 0, 0, 0, 0, 1, 0, WOOD);
  for (let i = 0; i < 5; i++) {
    const a0 = (i / 5) * TAU;
    const a1 = ((i + 1) / 5) * TAU;
    const v0 = vert(m, Math.cos(a0) * cr, 0.06, Math.sin(a0) * cr, 0, 1, 0, WOOD);
    const v1 = vert(m, Math.cos(a1) * cr, 0.06, Math.sin(a1) * cr, 0, 1, 0, WOOD);
    tri(m, c0, v0, v1);
  }
  litterSkirt(m, rng, 0.10, 8);
  return finish(m);
}

/**
 * Fallen log — the cheapest believability in a forest.
 *
 * Built lying along +x with a slight bow, because a trunk that fell is not
 * straight and a perfectly straight cylinder on the ground reads as a pipe. It
 * tapers toward one end and carries a broken stub or two, which is what makes
 * it read as having come off a tree rather than having been delivered.
 */
function buildLog(rng: () => number): TreeGeometryData {
  const m = empty();
  const segs = 8;
  const sides = 8;
  /* CENTERED on x, and that is a bug fix rather than a preference.
   *
   * finish() normalizes by max(height, maxSpan * 2), where maxSpan is the
   * largest |x| or |z|. Building the trunk from x = 0 to x = 1 made maxSpan 1,
   * so the divisor came out 2 and every log shipped at HALF the length
   * UNDERSTORY_SIZE_M asked for: a 4.2 m deadfall arrived as a 2.1 m branch
   * with a 36 cm bole. That, not the shading, is most of why logs were
   * invisible — they were the size of a thing you step over without noticing.
   * Centered, maxSpan is 0.5, the divisor is 1, and the log is the length it
   * says it is.
   */
  const r0 = 0.066 + rng() * 0.024;
  /* Bow UPWARD only. A sagging bow puts the belly of the log below its ends,
   * finish() rebases that belly to y = 0, and the log then rests on its middle
   * with both ends hanging in the air — the exact float this rig is supposed
   * to catch. Arched upward, the two ends are the low points and they are what
   * touches the ground, which is also how a real trunk lies once it has rotted
   * through in the middle. */
  const bow = rng() * 0.10;
  const rings: number[][] = [];
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const x = t - 0.5;
    const r = r0 * (1 - t * 0.34) * (0.9 + rng() * 0.2);
    const yc = r0 + Math.sin(t * Math.PI) * bow;
    const zc = Math.sin(t * Math.PI) * (rng() - 0.5) * 0.1;
    const ring: number[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const ny = Math.cos(a);
      const nz = Math.sin(a);
      ring.push(vert(m, x, yc + ny * r, zc + nz * r, 0, ny, nz, BARK));
    }
    rings.push(ring);
  }
  for (let s = 0; s < segs; s++) {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      tri(m, rings[s][i], rings[s + 1][i], rings[s + 1][j]);
      tri(m, rings[s][i], rings[s + 1][j], rings[s][j]);
    }
  }
  /* Capped at both ends. An open tube is fine until the player stands at the
   * end of one, and then it is a drainpipe: DoubleSide draws the inside of the
   * far wall and the log reads as hollow. Twelve triangles buys the two torn
   * faces that say this came off a tree. */
  for (const [end, ny] of [[0, -1], [segs, 1]] as const) {
    const ring = rings[end];
    const hub = vert(m, end === 0 ? -0.5 : 0.5, r0 + Math.sin((end / segs) * Math.PI) * bow, 0, ny, 0, 0, BARK);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      if (ny < 0) tri(m, hub, ring[j], ring[i]);
      else tri(m, hub, ring[i], ring[j]);
    }
  }
  /* Snapped limb stubs, now as tapered spurs instead of the single triangle
   * they used to be. One triangle vanishes from three quarters of the compass
   * — it has no thickness — so the log went back to being a fence rail from
   * most angles. Four faces cost eight triangles and read from everywhere. */
  const stubs = 2 + Math.floor(rng() * 2);
  for (let k = 0; k < stubs; k++) {
    const at = 0.2 + rng() * 0.6;
    const yaw = rng() * Math.PI * 2;
    const len = 0.055 + rng() * 0.075;
    const sr = r0 * 0.5;
    const bx = at - 0.5;
    const by = r0 + Math.sin(at * Math.PI) * bow;
    // Spurs point up and out; a stub aimed down is buried in the ground.
    const dy = 0.35 + Math.abs(Math.sin(yaw)) * 0.55;
    const dirX = Math.cos(yaw) * 0.5;
    const dirZ = Math.sin(yaw);
    const tipI = vert(m, bx + dirX * len, by + dy * len, by * 0 + dirZ * len, 0, 1, 0, BARK);
    const base: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      base.push(vert(m, bx + Math.cos(a) * sr * 0.6, by + Math.sin(a) * sr, Math.cos(a) * sr * 0.6, Math.cos(a), Math.sin(a), 0, BARK));
    }
    for (let i = 0; i < 4; i++) tri(m, base[i], base[(i + 1) % 4], tipI);
  }
  return finish(m);
}

/**
 * Sapling — the missing rung between a bush and a tree.
 *
 * A wood with only mature trees in it has no succession, which the eye reads
 * as a planted stand even when the spacing is right. A sapling is a whippy
 * leader with a few leaf sprays and almost no branching.
 */
function buildSapling(rng: () => number): TreeGeometryData {
  const m = empty();
  const lean = (rng() - 0.5) * 0.26;
  const steps = 6;
  const pts: Array<[number, number, number]> = [];
  const hw: number[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    pts.push([lean * t * t, t, 0]);
    hw.push(0.030 * (1 - t * 0.72) + 0.004);
  }
  ribbon(m, pts, hw, WOOD, [0, 0, 1]);
  ribbon(m, pts, hw, WOOD, [1, 0, 0]);

  /* The crown, rebuilt (2026-08-04). It used to be five leaf ribbons and the
   * sapling read as a bare stick with antennae — which is exactly what five
   * blades on a 2.4 m stem are. The stem is not the problem; the foliage was
   * never there. Forty leaves on eight shoots is.
   *
   * Shoots are pitched by the golden angle rather than a random yaw. Random
   * yaw over eight samples clumps — three shoots land within a few degrees and
   * one quadrant of the crown is empty — and an empty quadrant on a plant this
   * sparse reads as a modelling error rather than as variety. Phyllotaxy gives
   * an even spiral for free, which is also how a real leader arranges them.
   */
  const shoots = 7 + Math.floor(rng() * 3);
  const GOLDEN = 2.39996;
  for (let i = 0; i < shoots; i++) {
    const t = 0.33 + (i / shoots) * 0.63 + rng() * 0.04;
    const yaw = i * GOLDEN + rng() * 0.35;
    const ox = Math.cos(yaw);
    const oz = Math.sin(yaw);
    // Lower shoots sit out near horizontal, upper ones climb toward the leader.
    const rise = 0.16 + t * 0.72 + rng() * 0.28;
    const slen = 0.19 + rng() * 0.12;
    const cr = Math.cos(rise);
    const sr = Math.sin(rise);
    const bx = lean * t * t;
    const dir: V3 = [ox * cr, sr, oz * cr];

    const sp: Array<[number, number, number]> = [];
    const sw: number[] = [];
    for (let s = 0; s <= 2; s++) {
      const u = s / 2;
      // Droops under its own leaf load toward the far end.
      sp.push([bx + dir[0] * slen * u, t + dir[1] * slen * u - u * u * 0.05, dir[2] * slen * u]);
      sw.push(0.008 * (1 - u * 0.6) + 0.002);
    }
    ribbon(m, sp, sw, WOOD, [-oz, 0, ox]);

    const leaves = 4 + Math.floor(rng() * 2);
    for (let l = 0; l < leaves; l++) {
      const u = 0.24 + (l / leaves) * 0.78;
      const side = l % 2 === 0 ? 1 : -1;
      const at: V3 = [
        bx + dir[0] * slen * u,
        t + dir[1] * slen * u - u * u * 0.05,
        dir[2] * slen * u,
      ];
      // Out to the side of the shoot, raked forward, and hanging.
      const lat: V3 = [-oz * side, 0, ox * side];
      const ldir = normalize([
        lat[0] * 0.72 + dir[0] * 0.55,
        -0.34 + rng() * 0.30,
        lat[2] * 0.72 + dir[2] * 0.55,
      ]);
      const L = 0.085 + rng() * 0.05;
      leaflet(m, at, ldir, lat, L, L * 0.36, L * 0.14, LEAF);
    }
  }
  return finish(m);
}

/** Normalize into the unit frame and pack into typed arrays. */
function finish(m: Mesh): TreeGeometryData {
  const n = m.pos.length / 3;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxSpan = 0;
  for (let i = 0; i < n; i++) {
    const y = m.pos[i * 3 + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    maxSpan = Math.max(maxSpan, Math.abs(m.pos[i * 3]), Math.abs(m.pos[i * 3 + 2]));
  }
  /* A log is longer than it is tall, so normalizing it by HEIGHT would blow it
   * up to a four-meter-thick barrel. Whichever dimension dominates is the one
   * that gets driven to 1, and UNDERSTORY_SIZE_M is written to match. */
  const span = Math.max(maxY - minY, maxSpan * 2);
  const k = span > 1e-6 ? 1 / span : 1;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = m.pos[i * 3] * k;
    positions[i * 3 + 1] = (m.pos[i * 3 + 1] - minY) * k;
    positions[i * 3 + 2] = m.pos[i * 3 + 2] * k;
  }
  return {
    positions,
    normals: new Float32Array(m.nrm),
    colors: new Float32Array(m.col),
    indices: new Uint32Array(m.idx),
  };
}

const BUILDERS: Record<UnderstorySpecies, (rng: () => number) => TreeGeometryData> = {
  fern: buildFern,
  log: buildLog,
  sapling: buildSapling,
};

/** Deterministic: same (species, seed) → bit-identical arrays. */
export function generateUnderstoryGeometry(
  species: UnderstorySpecies,
  seed: number,
): TreeGeometryData {
  return BUILDERS[species](mulberry32(seed >>> 0));
}

/** Every species' variants from one world seed. */
export function generateUnderstoryVariantSet(
  seed: number,
): Record<UnderstorySpecies, TreeGeometryData[]> {
  const out = {} as Record<UnderstorySpecies, TreeGeometryData[]>;
  for (const [si, species] of UNDERSTORY_SPECIES.entries()) {
    const variants: TreeGeometryData[] = [];
    for (let v = 0; v < UNDERSTORY_VARIANTS; v++) {
      variants.push(generateUnderstoryGeometry(species, seed + si * 5171 + v * 7919));
    }
    out[species] = variants;
  }
  return out;
}
