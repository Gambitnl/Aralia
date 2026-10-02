/**
 * @file riverVegetation.ts — the trees and shrubs of the judged river reach.
 *
 * WHY THE WATER PIECE NEEDS THEM. Two of the three reference clips are mostly
 * about what the water REFLECTS and what stands beside it: the Nerang pool
 * mirrors a wall of trees, and the Merced banks are shrubs and boulders under a
 * forested mountainside. Water with bare hills around it has nothing to
 * reflect but the sky, and a critic judging a whole frame reads that first.
 *
 * TWO KINDS, BY DISTANCE FROM THE RIVER (a world-space rule, the same for
 * every camera):
 *   - within 60 m of the course: ez-tree trees and bushes (the vendored
 *     library the battle map uses), trimmed to about 5,000 triangles each and
 *     instanced per variant, with procedural leaf-cluster textures (the
 *     vendored textures are a stub, and a solid-color quad reads as a card);
 *   - past 60 m: canopy shapes, a few hundred triangles each, for the forest
 *     on the valley sides that the camera sees at 100 to 400 m through haze.
 *
 * THE REFLECTION'S STAND-INS (rivers round 4). Each instanced mesh carries in
 * `userData.lite` a cheaper geometry for the water's mirror pass: a crown
 * with every second leaf card at sqrt(2) times its size, each where it was
 * (the same cover and outline).
 * The scene draws them for the far instances in the mirror only; the camera
 * always sees the full trees. See `RiverReachView` (riverReachScene.ts).
 *
 * Placement is a jittered grid with a seeded generator: no tree in the
 * channel, on the wet bars (under 0.9 m over the water) or on slopes over 50
 * degrees. Pines on the Merced side (x < 135), broadleaf trees and dense
 * bushes on the Nerang side, reeds and shrubs on the island.
 *
 * WEBGPU (2026-09-30). The river scene draws with three's WebGPU renderer:
 * the plain standard materials (bark, grass) convert to node materials by
 * themselves; the two that carried a hook are node materials here: the canopy
 * shapes' foliage clumps (a `colorNode`, the WebGL hook's terms) and the leaf
 * cards, whose shadow keeps the leaves' cut-out (`castShadowNode`: WebGPU's
 * shadow pass copies the alpha test but not the map, and without it each card
 * cast a solid square).
 */
import * as THREE from 'three/webgpu';
import { Fn, float, fwidth, materialColor, mix, positionGeometry, positionWorld, smoothstep, texture, uv, vec4 } from 'three/tsl';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — vendored JS library, no type declarations
import { Tree, TreePreset } from '../../../../vendor/ez-tree/src/lib/index.js';
import { mulberry32 } from '@/systems/world3d/river/riverReach';
import { getRiverNoiseTexture } from './riverWaterMaterial';

interface TreeLike {
  branchesMesh: THREE.Mesh;
  leavesMesh: THREE.Mesh;
  loadFromJson: (o: unknown) => void;
}

/** A leaf-cluster texture drawn on a canvas: 'broad' leaves or 'needle' sprays. */
function leafTexture(kind: 'broad' | 'needle', seed: number): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const g = cv.getContext('2d');
  if (!g) throw new Error('[river] No 2D canvas for the leaf texture.');
  const r = mulberry32(seed);
  g.clearRect(0, 0, S, S);
  if (kind === 'broad') {
    for (let k = 0; k < 90; k += 1) {
      const a = r() * Math.PI * 2;
      const rad = Math.sqrt(r()) * S * 0.4;
      const x = S / 2 + Math.cos(a) * rad;
      const y = S / 2 + Math.sin(a) * rad;
      const len = 14 + r() * 16;
      const wid = 6 + r() * 7;
      const shade = 0.7 + 0.5 * r();
      // (Round 3: 1.4 times brighter; the clips' foliage is a mid green,
      // round 2's read near-black under the forest.)
      const cr = Math.round((56 + 56 * r()) * shade);
      const cgr = Math.round((98 + 77 * r()) * shade);
      const cb = Math.round((30 + 35 * r()) * shade);
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI * 2);
      g.fillStyle = `rgb(${cr},${cgr},${cb})`;
      g.beginPath();
      g.ellipse(0, 0, len / 2, wid / 2, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `rgba(20,35,12,0.5)`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-len / 2, 0);
      g.lineTo(len / 2, 0);
      g.stroke();
      g.restore();
    }
  } else {
    for (let k = 0; k < 220; k += 1) {
      const t = r();
      const x0 = S * 0.5 + (r() - 0.5) * S * 0.25;
      const y0 = S * (0.1 + 0.8 * t);
      const ang = (r() < 0.5 ? -1 : 1) * (0.5 + 0.7 * r());
      const len = 24 + 30 * r() * (1 - Math.abs(t - 0.5));
      const shade = 0.7 + 0.5 * r();
      g.strokeStyle = `rgb(${Math.round((38 + 34 * r()) * shade)},${Math.round((70 + 48 * r()) * shade)},${Math.round((36 + 24 * r()) * shade)})`;
      g.lineWidth = 1.6 + r();
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo(x0 + Math.sin(ang) * len * 0.5, y0 - len * 0.2, x0 + Math.sin(ang) * len, y0 - Math.cos(ang) * len * 0.35);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

interface Variant {
  preset: string;
  seed: number;
  /** Height in meters to scale the tree to (with a +-20 % spread). */
  heightM: number;
  leaf: 'broad' | 'needle';
  leafTint: number;
  barkTint: number;
  /** Trims: the most branches per level and leaves per branch, and the mesh detail. */
  children?: Record<string, number>;
  levels?: number;
  leaves?: number;
  leafSize?: number;
}

const VARIANTS: Variant[] = [
  { preset: 'Pine Medium', seed: 11, heightM: 22, leaf: 'needle', leafTint: 0x9aa890, barkTint: 0x5a4a3c, children: { 0: 42 }, leaves: 22, leafSize: 1.5 },
  { preset: 'Pine Large', seed: 12, heightM: 30, leaf: 'needle', leafTint: 0x8c9a84, barkTint: 0x4e4034, children: { 0: 48 }, leaves: 16, leafSize: 1.6 },
  { preset: 'Oak Medium', seed: 21, heightM: 14, leaf: 'broad', leafTint: 0xb4c09a, barkTint: 0x4a4038, levels: 2, children: { 0: 6, 1: 4 }, leaves: 26, leafSize: 1.9 },
  { preset: 'Ash Medium', seed: 22, heightM: 18, leaf: 'broad', leafTint: 0xa8b48c, barkTint: 0x6a6258, levels: 2, children: { 0: 7, 1: 4 }, leaves: 24, leafSize: 2.0 },
  { preset: 'Aspen Medium', seed: 23, heightM: 24, leaf: 'broad', leafTint: 0xbcc49c, barkTint: 0xb8b0a0, levels: 2, children: { 0: 10, 1: 3 }, leaves: 14, leafSize: 1.8 },
  { preset: 'Bush 1', seed: 31, heightM: 2.6, leaf: 'broad', leafTint: 0xa6b488, barkTint: 0x4a4034, levels: 2, children: { 0: 7, 1: 3 }, leaves: 14, leafSize: 1.6 },
  { preset: 'Bush 2', seed: 32, heightM: 1.8, leaf: 'broad', leafTint: 0xb0b890, barkTint: 0x4a4034 },
];

/** Build one variant's two geometries, scaled to 1 m of height (the instance scale sets the height). */
function buildVariant(v: Variant): { branches: THREE.BufferGeometry; leaves: THREE.BufferGeometry } {
  const preset = JSON.parse(JSON.stringify((TreePreset as Record<string, unknown>)[v.preset])) as Record<string, any>;
  preset.seed = v.seed;
  if (v.levels !== undefined) preset.branch.levels = Math.min(preset.branch.levels, v.levels);
  if (v.children) for (const [k, n] of Object.entries(v.children)) preset.branch.children[k] = Math.min(preset.branch.children[k] ?? n, n);
  if (v.leaves !== undefined) preset.leaves.count = v.leaves;
  if (v.leafSize !== undefined) preset.leaves.size *= v.leafSize;
  // Fewer sides on the branches: at the distances the judged views see a
  // branch from, 4 to 6 sides read as round.
  for (const k of Object.keys(preset.branch.segments)) preset.branch.segments[k] = Math.max(3, Math.min(preset.branch.segments[k], k === '0' ? 7 : 4));
  for (const k of Object.keys(preset.branch.sections)) preset.branch.sections[k] = Math.max(3, Math.round(preset.branch.sections[k] * 0.6));
  if (preset.bark) preset.bark.textured = false;
  const tree = new Tree() as TreeLike;
  tree.loadFromJson(preset);
  const b = (tree.branchesMesh.geometry as THREE.BufferGeometry).clone();
  const l = (tree.leavesMesh.geometry as THREE.BufferGeometry).clone();
  b.computeBoundingBox();
  const bb = new THREE.Box3().setFromBufferAttribute(b.getAttribute('position') as THREE.BufferAttribute);
  const lb = new THREE.Box3().setFromBufferAttribute(l.getAttribute('position') as THREE.BufferAttribute);
  const top = Math.max(bb.max.y, lb.max.y);
  const s = 1 / Math.max(0.01, top);
  b.scale(s, s, s);
  l.scale(s, s, s);
  return { branches: b, leaves: l };
}

/**
 * THE MIRROR'S STAND-IN LEAVES (rivers round 4): every `keep`-th leaf of the
 * full crown, each scaled by sqrt(keep) about its own stem point, so the
 * crown keeps its leaf area and every kept leaf stays where it was. A leaf is
 * one quad, or two crossed quads that share a stem point (ez-tree's double
 * billboard). A stand-in built from new, fewer leaves (the first cut) put
 * them in new places, and the far trees' mirror images changed shape: 7 % of
 * the calm-bridge frame moved by over 8/255.
 */
function decimateLeaves(g: THREE.BufferGeometry, keep: number): THREE.BufferGeometry {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nor = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
  const quads = Math.floor(pos.count / 4);
  // The stem point of quad q: the middle of its bottom edge (vertices 1 and 2).
  const stem = (q: number): [number, number, number] => [
    (pos.getX(q * 4 + 1) + pos.getX(q * 4 + 2)) / 2,
    (pos.getY(q * 4 + 1) + pos.getY(q * 4 + 2)) / 2,
    (pos.getZ(q * 4 + 1) + pos.getZ(q * 4 + 2)) / 2,
  ];
  const units: number[][] = [];
  for (let q = 0; q < quads; q += 1) {
    const a = stem(q);
    if (q + 1 < quads) {
      const b = stem(q + 1);
      if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 1e-6) {
        units.push([q, q + 1]);
        q += 1;
        continue;
      }
    }
    units.push([q]);
  }
  const sc = Math.sqrt(keep);
  const P: number[] = [];
  const N: number[] = [];
  const U: number[] = [];
  const I: number[] = [];
  units.forEach((u, ui) => {
    if (ui % keep !== 0) return;
    const [ox, oy, oz] = stem(u[0]);
    for (const q of u) {
      const base = P.length / 3;
      for (let k = 0; k < 4; k += 1) {
        const vi = q * 4 + k;
        P.push(ox + (pos.getX(vi) - ox) * sc, oy + (pos.getY(vi) - oy) * sc, oz + (pos.getZ(vi) - oz) * sc);
        if (nor) N.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi));
        if (uv) U.push(uv.getX(vi), uv.getY(vi));
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  if (nor) out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  if (uv) out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  out.setIndex(I);
  out.computeBoundingSphere();
  return out;
}

/** The canopy shapes of the far forest: a conifer spire and a broadleaf crown, 1 m tall (`detail` 1 for the mirror's stand-in). */
function canopyGeometry(kind: 'conifer' | 'broad', seed: number, detail = 2): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const r = mulberry32(seed);
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28];
  const v = new THREE.Vector3();
  for (let k = 0; k < p.count; k += 1) {
    v.fromBufferAttribute(p, k);
    const lump = 1 + 0.16 * Math.sin(v.x * 5 + ph[0]) * Math.sin(v.y * 4 + ph[1]) + 0.1 * Math.sin(v.z * 7 + ph[2]);
    if (kind === 'conifer') {
      // A tall crown, narrower at the top: a spire read as a party hat at
      // 200 m (round 5), so the top is rounded and the sides lumpy.
      const t = (v.y + 1) / 2;
      const w = 0.26 * (1 - t * 0.6) * lump;
      p.setXYZ(k, v.x * w, 0.2 + t * 0.8 * (1 - 0.08 * Math.abs(v.x + v.z)), v.z * w);
    } else {
      p.setXYZ(k, v.x * 0.42 * lump, 0.55 + v.y * 0.42 * lump, v.z * 0.42 * lump);
    }
  }
  g.computeVertexNormals();
  return g;
}

/**
 * A GRASS CLUMP, 1 m tall before scaling: 14 tapered blades from one base,
 * leaning outward, colored dark at the root and light at the tip (vertex
 * colors). Two triangles per blade. The Merced bed holds clumps of grass and
 * sedge on its bars between the rocks, and the Nerang margins are lined with
 * them; round 1 had none, and the bars read as bare paving.
 */
function grassClumpGeometry(seed: number): THREE.BufferGeometry {
  const r = mulberry32(seed);
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let b = 0; b < 14; b += 1) {
    const a = r() * Math.PI * 2;
    const lean = 0.15 + 0.45 * r();
    const h = 0.6 + 0.4 * r();
    const w = 0.035 + 0.02 * r();
    const bx = Math.cos(a) * 0.06 * r();
    const bz = Math.sin(a) * 0.06 * r();
    const tx = bx + Math.cos(a) * lean * h;
    const tz = bz + Math.sin(a) * lean * h;
    // The blade's flat side faces across its lean.
    const px = -Math.sin(a) * w;
    const pz = Math.cos(a) * w;
    const i = pos.length / 3;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, h, tz);
    const dark = [0.07, 0.1, 0.035];
    const tip = [0.32 + 0.1 * r(), 0.38 + 0.08 * r(), 0.14];
    col.push(...dark, ...dark, ...tip);
    idx.push(i, i + 1, i + 2);
    // A second, shorter blade on the same base for body.
    const j = pos.length / 3;
    const h2 = h * 0.6;
    pos.push(bx - pz * 0.8, 0, bz + px * 0.8, bx + pz * 0.8, 0, bz - px * 0.8, bx + Math.cos(a + 0.5) * lean * h2, h2, bz + Math.sin(a + 0.5) * lean * h2);
    col.push(...dark, ...dark, tip[0] * 0.8, tip[1] * 0.8, tip[2]);
    idx.push(j, j + 1, j + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export interface RiverVegetationInput {
  /** Ground height at (x, z), m. */
  groundAt: (x: number, z: number) => number;
  /** Height over the nearest water, m, or a large number far from any. */
  overWaterAt: (x: number, z: number) => number;
  /** Distance to the river course, m. */
  courseDistAt: (x: number, z: number) => number;
  /** Course distance s and signed offset n (positive left of the flow), m. */
  courseSNAt: (x: number, z: number) => { s: number; n: number };
  /** Half the channel width at course distance s, m. */
  halfWidthAt: (s: number) => number;
  /** The domain to plant, m. */
  domain: { x0: number; z0: number; x1: number; z1: number };
  seed: number;
  /**
   * CLEARINGS: places with no tree, each a stand point and a look direction.
   * The reference clips were shot from a walkway on the Merced bank and a road
   * bridge over the Nerang; the judged cameras stand in the same kind of place.
   * A clearing is a circle of `r` m around the stand point plus a 40 m wedge
   * of +-18 degrees toward the look point (the gap the photographer shot
   * through). It moves trees, never the water.
   */
  clearings?: Array<{ at: [number, number]; look: [number, number]; r: number; wedge?: boolean }>;
}

export interface RiverVegetation {
  group: THREE.Group;
  counts: Record<string, number>;
  triangles: number;
}

/** PLANT the reach. Deterministic: same seed, same forest. */
export function buildRiverVegetation(inp: RiverVegetationInput): RiverVegetation {
  const group = new THREE.Group();
  const rnd = mulberry32(inp.seed ^ 0x7ee5);
  const broadTex = leafTexture('broad', 101);
  const needleTex = leafTexture('needle', 102);
  const built = VARIANTS.map((v) => buildVariant(v));
  // The mirror's stand-in leaves: every second leaf, at sqrt(2) the size.
  const liteLeaves = built.map((b) => decimateLeaves(b.leaves, 2));
  const place: Array<Array<{ x: number; y: number; z: number; s: number; rot: number }>> = VARIANTS.map(() => []);
  const canopies: { conifer: THREE.Matrix4[]; broad: THREE.Matrix4[]; colors: { conifer: number[]; broad: number[] } } = {
    conifer: [], broad: [], colors: { conifer: [], broad: [] },
  };
  const slopeAt = (x: number, z: number): number => {
    const a = inp.groundAt(x + 1, z) - inp.groundAt(x - 1, z);
    const b = inp.groundAt(x, z + 1) - inp.groundAt(x, z - 1);
    return Math.hypot(a, b) / 2;
  };
  const D = inp.domain;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  // `lowOk`: shrubs stay in the wedge (they do not block a view from 6 m up),
  // only trees are cleared from it.
  const cleared = (x: number, z: number, lowOk = false): boolean => {
    for (const c of inp.clearings ?? []) {
      const dx = x - c.at[0];
      const dz = z - c.at[1];
      const dist = Math.hypot(dx, dz);
      if (dist < c.r) return true;
      // Trees keep 10 m more from a bank camera: a 30 m pine standing just
      // outside a 12 m stand hung its crown into the bank-along frame.
      if (!lowOk && c.wedge !== false && dist < c.r + 10) return true;
      if (lowOk || c.wedge === false) continue;
      const lx = c.look[0] - c.at[0];
      const lz = c.look[1] - c.at[1];
      const ll = Math.hypot(lx, lz) || 1;
      const cosA = (dx * lx + dz * lz) / (dist * ll);
      // +-30 degrees (round 3: the view's own half width; a pine at 25
      // degrees stood in the bank-along frame), and only BETWEEN the camera
      // and the water it looks at (0.9 of the distance to the look point):
      // trees beyond the water are its background and its reflection, and a
      // 50 m wedge had cleared the far bank's forest out of the riffle's
      // mirror (it reflected bare sky).
      if (dist < 0.9 * ll && cosA > Math.cos((30 * Math.PI) / 180)) return true;
    }
    return false;
  };
  // TOWARD THE WATER: the horizontal unit direction in which the distance to
  // the course falls (for leaning trees).
  const towardWater = (x: number, z: number): [number, number] => {
    const gx = inp.courseDistAt(x + 0.5, z) - inp.courseDistAt(x - 0.5, z);
    const gz = inp.courseDistAt(x, z + 0.5) - inp.courseDistAt(x, z - 0.5);
    const l = Math.hypot(gx, gz) || 1;
    return [-gx / l, -gz / l];
  };
  // Trees that lean over the water: a tilt about the horizontal axis across
  // the direction to the water.
  const lean: Array<Map<number, number>> = VARIANTS.map(() => new Map());
  const leanDir: Array<Map<number, [number, number]>> = VARIANTS.map(() => new Map());
  const push = (vi: number, x: number, z: number, s: number, tilt = 0): void => {
    const list = place[vi];
    if (tilt > 0) {
      lean[vi].set(list.length, tilt);
      leanDir[vi].set(list.length, towardWater(x, z));
    }
    list.push({ x, y: inp.groundAt(x, z) - 0.15, z, s, rot: rnd() * Math.PI * 2 });
  };
  const halfW = (x: number, z: number): number => {
    const sn = inp.courseSNAt(x, z);
    return inp.halfWidthAt(sn.s);
  };
  // Near band: a 5 m jittered grid within 60 m of the course; the far forest
  // on the same grid past it.
  for (let z = D.z0; z < D.z1; z += 5) {
    for (let x = D.x0; x < D.x1; x += 5) {
      const px = x + rnd() * 5;
      const pz = z + rnd() * 5;
      const d = inp.courseDistAt(px, pz);
      const roll = rnd();
      if (cleared(px, pz, true)) continue;
      const clearedTree = cleared(px, pz);
      const sn = inp.courseSNAt(px, pz);
      const merced = px < 135;
      // THE FAR SIDE OF THE MERCED REACH (rivers round 3): the right (south
      // and west) bank of the boulder reach and the bend, past its 10 m bar,
      // is a closed forest on a canyon side, as the far bank of both Merced
      // clips is: the water mirrors it, and it fills the frames' top third.
      // Both banks of the boulder reach and the bend (the north side is the
      // steep mountainside already): the bar is 10 m wide on the right bank
      // and 6 m on the left.
      const canyon = merced && sn.s < 150 && sn.s > -120;
      const edge = halfW(px, pz) + (canyon ? (sn.n < 0 ? 10 : 6) : 0);
      if (d > 60 || (canyon && d > edge + 12)) {
        if (d > 280) continue;
        const sl = slopeAt(px, pz);
        if (sl > 1.6) continue;
        // Density per 5 m cell: closed canopy on the canyon side, open
        // forest elsewhere (round 2: one tree per 125 m^2 everywhere).
        const p = canyon ? 0.85 : 0.42;
        if (roll > p) continue;
        const conifer = rnd() < (merced ? 0.7 : 0.25);
        const h = (conifer ? 15 + 12 * rnd() : 11 + 9 * rnd());
        const y = inp.groundAt(px, pz) - 0.5;
        q.setFromAxisAngle(up, rnd() * Math.PI * 2);
        m.compose(new THREE.Vector3(px, y, pz), q, new THREE.Vector3(h * (0.75 + 0.4 * rnd()), h, h * (0.75 + 0.4 * rnd())));
        (conifer ? canopies.conifer : canopies.broad).push(m.clone());
        (conifer ? canopies.colors.conifer : canopies.colors.broad).push(0.6 + 0.5 * rnd());
        continue;
      }
      const over = inp.overWaterAt(px, pz);
      // The island is planted on its own finer grid below.
      if (d < 9.5 && px > 160 && px < 212) continue;
      if (d < 9.5) continue;
      const sl = slopeAt(px, pz);
      if (sl > 1.4) continue;
      let vi = -1;
      let tilt = 0;
      if (canyon) {
        // The bar: bare rock with a few shrubs; the forest edge beyond it:
        // trees, mostly pines, as close as the bar allows.
        if (d < edge) { if (roll < 0.05 && over > 0.6) vi = 5; }
        else if (roll < 0.75) vi = rnd() < 0.62 ? (rnd() < 0.5 ? 0 : 1) : (rnd() < 0.5 ? 2 : 3);
        else if (!clearedTree && sn.n < 0) {
          // Understory between the trees on the far (right) bank: a low
          // broad crown (3 to 6 m), so the forest edge is a wall of foliage
          // and not trunks over a floor. (Not on the left bank, where both
          // Merced cameras stand: a canopy shape at 10 m reads as a green box.)
          const h = 3 + 3 * rnd();
          q.setFromAxisAngle(up, rnd() * Math.PI * 2);
          m.compose(new THREE.Vector3(px, inp.groundAt(px, pz) - 0.3, pz), q, new THREE.Vector3(h * 1.3, h, h * 1.3));
          canopies.broad.push(m.clone());
          canopies.colors.broad.push(0.7 + 0.4 * rnd());
        }
      } else if (merced) {
        if (over < 0.9) continue;
        if (d < 22) { if (roll < 0.1) vi = 5; else if (roll < 0.16) vi = 6; else if (roll < 0.19) vi = 2; }
        else if (roll < 0.22) vi = rnd() < 0.6 ? (rnd() < 0.5 ? 0 : 1) : 2;
        else if (roll < 0.3) vi = 5;
      } else {
        // THE NERANG BANKS (rivers round 3): dense growth right down to the
        // water. Trees at the edge lean out over it (12 to 26 degrees), the
        // way river trees grow toward the light over the channel.
        if (over < 0.3) continue;
        if (d < edge + 6) {
          if (roll < 0.3) { vi = [3, 4, 2][Math.floor(rnd() * 3)]; tilt = 0.21 + 0.24 * rnd(); }
          else if (roll < 0.7) vi = rnd() < 0.6 ? 5 : 6;
        } else if (roll < 0.62) vi = [2, 3, 4, 4, 3][Math.floor(rnd() * 5)];
        else if (roll < 0.85) vi = 5;
      }
      if (vi < 0) continue;
      if (clearedTree && VARIANTS[vi].heightM > 3) continue;
      const v = VARIANTS[vi];
      push(vi, px, pz, v.heightM * (0.8 + 0.4 * rnd()), tilt);
    }
  }
  // THE NERANG MARGINS on a 2.5 m grid (rivers round 3): shrubs from 0.25 m
  // over the water to 7 m back from the bank, so the growth reaches the
  // waterline and hangs over it; the 5 m grid left open lawn at the water.
  for (let z = D.z0; z < D.z1; z += 2.5) {
    for (let x = 135; x < D.x1; x += 2.5) {
      const px = x + rnd() * 2.5;
      const pz = z + rnd() * 2.5;
      const roll = rnd();
      const d = inp.courseDistAt(px, pz);
      if (d > 26 || d < 5) continue;
      if (d < 9.5 && px > 160 && px < 212) continue;
      const hw = halfW(px, pz);
      if (d < hw - 2 || d > hw + 7) continue;
      const over = inp.overWaterAt(px, pz);
      if (over < 0.25) continue;
      if (cleared(px, pz, true)) continue;
      if (roll > 0.55) continue;
      const vi = roll < 0.35 ? 5 : 6;
      // Shrubs at the very edge lean out a little too.
      push(vi, px, pz, (vi === 5 ? 2.4 : 1.8) * (0.8 + 0.5 * rnd()), d < hw + 1.5 ? 0.15 + 0.2 * rnd() : 0);
    }
  }
  // THE ISLAND (it stands on the course line, so the channel rule would
  // clear it): shrubs on a 2 m grid wherever it stands 0.5 m over the water;
  // its tall reeds are in the grass pass below.
  for (let z = 92; z < 120; z += 2) {
    for (let x = 160; x < 212; x += 2) {
      const px = x + rnd() * 2;
      const pz = z + rnd() * 2;
      if (inp.courseDistAt(px, pz) > 9.5 || inp.overWaterAt(px, pz) < 0.5 || cleared(px, pz, true)) continue;
      const roll = rnd();
      if (roll > 0.45) continue;
      const vi = roll < 0.2 ? 6 : 5;
      push(vi, px, pz, (vi === 6 ? 1.6 : 2.3) * (0.8 + 0.4 * rnd()));
    }
  }
  // GRASS AMONG THE BED ROCKS and along the margins: clumps on a 1.4 m
  // jittered grid within 16 m of the course, where the ground stands 0.08 to
  // 1.2 m over the water, in patches (a 7 m noise: grass takes the stable
  // parts of a bar, not all of it). A world-space rule, as every placement
  // here.
  const grass: THREE.Matrix4[] = [];
  for (let z = D.z0; z < D.z1; z += 1.4) {
    for (let x = D.x0; x < D.x1; x += 1.4) {
      const px = x + rnd() * 1.4;
      const pz = z + rnd() * 1.4;
      const roll = rnd();
      const d = inp.courseDistAt(px, pz);
      if (d > 20) continue;
      const over = inp.overWaterAt(px, pz);
      const nerang = px > 135;
      if (over < 0.08 || over > (nerang ? 3.0 : 1.2)) continue;
      if (cleared(px, pz, true)) continue;
      const island = d < 9.5 && px > 160 && px < 212;
      const patch = 0.5 + 0.5 * Math.sin(px * 0.9 + Math.sin(pz * 0.7) * 2.1) * Math.cos(pz * 0.8 + Math.sin(px * 0.6) * 1.7);
      if (!island && roll > (nerang ? 0.9 : 0.55) * patch) continue;
      if (island && roll > 0.85) continue;
      // Nerang side (x over 135): tall reed-grass and sedge. THE ISLAND is a
      // stand of reeds 2.2 to 3.4 m tall, as the Nerang island is (rivers
      // round 3; round 2's 1.3 m clumps left it a lawn); the banks carry
      // tussocks of 1.2 to 2.4 m. Merced side: low clumps on the bars.
      const sc = island ? 2.2 + 1.2 * rnd() : nerang ? 1.2 + 1.2 * rnd() : 0.45 + 0.5 * rnd();
      q.setFromAxisAngle(up, rnd() * Math.PI * 2);
      m.compose(new THREE.Vector3(px, inp.groundAt(px, pz) - 0.03, pz), q, new THREE.Vector3(sc, sc * (0.8 + 0.5 * rnd()), sc));
      grass.push(m.clone());
    }
  }
  let triangles = 0;
  const counts: Record<string, number> = {};
  counts.grass = grass.length;
  if (grass.length) {
    const gg = grassClumpGeometry(0x6a55);
    const gm = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
    const gi = new THREE.InstancedMesh(gg, gm, grass.length);
    grass.forEach((mm, k) => gi.setMatrixAt(k, mm));
    gi.castShadow = false;
    gi.receiveShadow = true;
    gi.computeBoundingSphere();
    group.add(gi);
    triangles += (gg.index ? gg.index.count / 3 : 0) * grass.length;
  }
  const tris = (g: THREE.BufferGeometry): number => (g.index ? g.index.count / 3 : g.getAttribute('position').count / 3);
  VARIANTS.forEach((v, i) => {
    const list = place[i];
    counts[v.preset] = list.length;
    if (list.length === 0) return;
    const bark = new THREE.MeshStandardMaterial({ color: v.barkTint, roughness: 0.92 });
    const leafMap = v.leaf === 'broad' ? broadTex : needleTex;
    const leaves = new THREE.MeshStandardNodeMaterial({
      color: v.leafTint,
      map: leafMap,
      alphaTest: 0.45,
      alphaToCoverage: true,
      side: THREE.DoubleSide,
      roughness: 0.82,
    });
    // WEBGL'S ALPHA TO COVERAGE, term by term (its alphatest chunk): the
    // leaf's alpha ramps from 0 at the 0.45 cut to 1 over one pixel's change,
    // so a leaf's inside covers the whole pixel and only its edge is partial,
    // and a fragment is discarded only at 0. three 0.172's node material
    // keeps the texture's own alpha as the coverage, and the crowns drew
    // thin and see-through (the sky through them also raised the meter's
    // average and darkened the whole frame).
    const leafA = materialColor.a;
    leaves.colorNode = vec4(materialColor.rgb, smoothstep(0.45, fwidth(leafA).add(0.45), leafA));
    leaves.alphaTestNode = float(0);
    // THE SHADOW PASS cuts the card at its own alpha, 0.45, and casts a full
    // shadow where it stands, as WebGL's depth material did. (three 0.172
    // scales a shadow by the alpha its caster writes, and a card's alpha of
    // 0.45 to 1 cast half shadows: the canopy's shade on the bars was nearly
    // gone. So the node discards below the cut and writes alpha 1.)
    leaves.castShadowNode = Fn(() => {
      texture(leafMap, uv()).a.lessThanEqual(0.45).discard();
      return vec4(0, 0, 0, 1);
    })();
    const bm = new THREE.InstancedMesh(built[i].branches, bark, list.length);
    const lm = new THREE.InstancedMesh(built[i].leaves, leaves, list.length);
    const qt = new THREE.Quaternion();
    const axis = new THREE.Vector3();
    list.forEach((t, k) => {
      q.setFromAxisAngle(up, t.rot);
      const tilt = lean[i].get(k);
      if (tilt) {
        // Lean toward the water: turn about the horizontal axis across the
        // direction to it (up x toward).
        const [wx, wz] = leanDir[i].get(k) ?? [1, 0];
        axis.set(wz, 0, -wx).normalize();
        qt.setFromAxisAngle(axis, tilt);
        q.premultiply(qt);
      }
      m.compose(new THREE.Vector3(t.x, t.y, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
      bm.setMatrixAt(k, m);
      lm.setMatrixAt(k, m);
    });
    // The branches keep their full mesh in the mirror (a cheaper branch mesh
    // bends the limbs differently); only the leaves have a stand-in.
    lm.userData.lite = liteLeaves[i];
    for (const im of [bm, lm]) {
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
    }
    triangles += (tris(built[i].branches) + tris(built[i].leaves)) * list.length;
  });
  for (const kind of ['conifer', 'broad'] as const) {
    const mats = canopies[kind];
    counts[`canopy-${kind}`] = mats.length;
    if (!mats.length) continue;
    const g = canopyGeometry(kind, kind === 'conifer' ? 7 : 8);
    const mat = new THREE.MeshStandardNodeMaterial({ color: kind === 'conifer' ? 0x34462c : 0x4a5e34, roughness: 0.95 });
    // FOLIAGE CLUMPS (rivers round 3): a canopy shape shaded flat reads as a
    // smooth green blob. Two scales of world-space noise (1.6 m and 5 m)
    // darken the gaps between leaf clumps to 45 %, and the lower third of
    // the crown is in its own shade: the far forest reads as a mass of
    // crowns, dark between them, as a forested slope does.
    const noiseTex = getRiverNoiseTexture();
    // (The WebGL hook's terms, after `color_fragment`: the instance color
    // still multiplies the result, as it did there. The crown's height is the
    // geometry's own y; the world point carries the instance's matrix.)
    const cw = positionWorld;
    const c1 = texture(noiseTex, cw.xz.div(1.6).add(cw.y.mul(0.21))).b;
    const c2 = texture(noiseTex, cw.xz.div(5.0).add(cw.y.mul(0.07)).add(0.37)).b;
    const clump = smoothstep(0.3, 0.7, c1.mul(0.6).add(c2.mul(0.4)));
    mat.colorNode = materialColor.mul(mix(0.45, 1.12, clump).mul(mix(0.55, 1.0, smoothstep(0.2, 0.6, positionGeometry.y))));
    const im = new THREE.InstancedMesh(g, mat, mats.length);
    // (No stand-in for a canopy shape: its 320 triangles are cheap, and the
    // quarter-size stand-in changed the far forest's outline in the mirror.)
    const col = new THREE.Color();
    mats.forEach((mm, k) => {
      im.setMatrixAt(k, mm);
      const c = canopies.colors[kind][k];
      im.setColorAt(k, col.setRGB(c, c, c * 0.95));
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
    triangles += tris(g) * mats.length;
  }
  return { group, counts, triangles };
}
