/**
 * @file treeMeshGenerator.ts
 * @description Owned seeded procedural tree meshes for the streamed 3D world
 * (world beautification wave, vegetation lift — MIT-lift direction from the
 * Braffolk/fable5-world-demo idea: a few pre-generated variants per species,
 * instanced everywhere; NEVER a unique mesh per tree).
 *
 * Pure + deterministic: same (species, seed) → bit-identical geometry arrays.
 * Geometry is authored in a unit frame: base of the trunk at y=0, total height
 * exactly 1.0, so instances scale it by a per-species world height in meters.
 *
 * Vertex colors carry the trunk/foliage split: trunks are baked bark-brown,
 * foliage is baked near-white so the per-instance biome palette tint
 * (InstancedMesh.setColorAt) multiplies through and drives the canopy color.
 * Standard indexed BufferGeometry attributes only — works on WebGLRenderer and
 * WebGPURenderer alike (no TSL, per renderer decision spec §8).
 */
import * as THREE from 'three';

export type TreeSpecies = 'conifer' | 'broadleaf' | 'scrub';

export const TREE_SPECIES: readonly TreeSpecies[] = ['conifer', 'broadleaf', 'scrub'];

/**
 * Distinct silhouettes per species.
 *
 * An in-game look (2026-07-27, burg Hajdured) found the world reading as one
 * tree shape at assorted sizes: every conifer was the same stack of cones, so a
 * hillside of them looked stamped. Scale variety is not shape variety. Each
 * species now carries forms that differ in OUTLINE — where the crown is widest
 * and how much bare trunk shows below it — and a variant set covers all of them.
 *
 * - conifer `spire`: many narrow tiers, widest low, canopy to near the ground.
 * - conifer `umbrella`: few wide tiers held high on a long bare trunk.
 * - broadleaf `dome`: rounded cluster crown (the original).
 * - broadleaf `spreading`: wide flat crown on splayed limbs.
 * - scrub `tussock`: few upright stems (the original).
 * - scrub `thicket`: many low blobs sprawling wider than tall.
 */
export const TREE_FORMS = {
  conifer: ['spire', 'umbrella'],
  broadleaf: ['dome', 'spreading'],
  scrub: ['tussock', 'thicket'],
} as const satisfies Record<TreeSpecies, readonly string[]>;

export type TreeForm = (typeof TREE_FORMS)[TreeSpecies][number];

/**
 * Pre-generated look-alike variants per species (instanced; small on purpose).
 * Two per form, so every silhouette appears and each still gets seed jitter.
 */
export const VARIANTS_PER_SPECIES = 4;

/** World height, in meters, that the unit-height geometry is scaled to (×instance scale). */
export const SPECIES_HEIGHT_M: Record<TreeSpecies, number> = {
  conifer: 9,
  broadleaf: 7,
  scrub: 2.6,
};

export interface TreeGeometryData {
  positions: Float32Array;
  normals: Float32Array;
  /** 3 floats per vertex; trunk = bark brown, foliage ≈ white (instance-tinted). */
  colors: Float32Array;
  indices: Uint32Array;
}

/** mulberry32 — tiny deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BARK: [number, number, number] = [0.34, 0.24, 0.16];
const BARK_SCRUB: [number, number, number] = [0.38, 0.3, 0.2];

interface MergePart {
  geom: THREE.BufferGeometry;
  matrix: THREE.Matrix4;
  color: [number, number, number];
}

/** Merge indexed geometries into flat arrays with a baked per-part vertex color. */
function mergeParts(parts: MergePart[]): TreeGeometryData {
  let vertCount = 0;
  let idxCount = 0;
  for (const p of parts) {
    vertCount += p.geom.attributes.position.count;
    idxCount += p.geom.index ? p.geom.index.count : p.geom.attributes.position.count;
  }
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const indices = new Uint32Array(idxCount);

  const v = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  let vOff = 0;
  let iOff = 0;
  for (const p of parts) {
    const pos = p.geom.attributes.position;
    const nrm = p.geom.attributes.normal;
    normalMatrix.getNormalMatrix(p.matrix);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(p.matrix);
      positions[(vOff + i) * 3] = v.x;
      positions[(vOff + i) * 3 + 1] = v.y;
      positions[(vOff + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(nrm, i).applyMatrix3(normalMatrix).normalize();
      normals[(vOff + i) * 3] = v.x;
      normals[(vOff + i) * 3 + 1] = v.y;
      normals[(vOff + i) * 3 + 2] = v.z;
      colors[(vOff + i) * 3] = p.color[0];
      colors[(vOff + i) * 3 + 1] = p.color[1];
      colors[(vOff + i) * 3 + 2] = p.color[2];
    }
    const idx = p.geom.index;
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices[iOff + i] = idx.getX(i) + vOff;
      iOff += idx.count;
    } else {
      for (let i = 0; i < pos.count; i++) indices[iOff + i] = vOff + i;
      iOff += pos.count;
    }
    vOff += pos.count;
    p.geom.dispose();
  }
  return { positions, normals, colors, indices };
}

function trunkPart(
  rng: () => number,
  height: number,
  rBottom: number,
  rTop: number,
  color: [number, number, number],
  lean = 0,
): MergePart {
  const geom = new THREE.CylinderGeometry(rTop, rBottom, height, 6, 1, false);
  const m = new THREE.Matrix4()
    .makeRotationZ((rng() - 0.5) * lean)
    .multiply(new THREE.Matrix4().makeTranslation(0, height / 2, 0));
  return { geom, matrix: m, color };
}

/** Foliage blob: low-detail icosahedron, deterministically squashed/placed. */
function blobPart(
  rng: () => number,
  radius: number,
  x: number,
  y: number,
  z: number,
  tint: number,
): MergePart {
  const geom = new THREE.IcosahedronGeometry(radius, 1);
  // Deterministic vertex jitter so blobs read organic, not CSG-spherical.
  const pos = geom.attributes.position;
  const jitterRng = mulberry32(Math.floor(rng() * 0xffffffff));
  for (let i = 0; i < pos.count; i++) {
    const j = 1 + (jitterRng() - 0.5) * 0.35;
    pos.setXYZ(i, pos.getX(i) * j, pos.getY(i) * j, pos.getZ(i) * j);
  }
  geom.computeVertexNormals();
  const m = new THREE.Matrix4()
    .makeTranslation(x, y, z)
    .multiply(new THREE.Matrix4().makeScale(1, 0.85, 1));
  const c = 0.85 + tint * 0.15;
  return { geom, matrix: m, color: [c * 0.95, c, c * 0.95] };
}

/**
 * Wide, shallow crown pad — the second foliage form.
 *
 * `blobPart` can only ever build rounded masses, so every broadleaf came out a
 * ball of them. This one is deliberately squashed and wide, so a crown built
 * from pads reads as a spreading canopy rather than a heap of spheres.
 */
function padPart(
  rng: () => number,
  radius: number,
  x: number,
  y: number,
  z: number,
  tint: number,
): MergePart {
  const geom = new THREE.IcosahedronGeometry(radius, 1);
  const pos = geom.attributes.position;
  const jitterRng = mulberry32(Math.floor(rng() * 0xffffffff));
  for (let i = 0; i < pos.count; i++) {
    const j = 1 + (jitterRng() - 0.5) * 0.3;
    // Flatten hard in Y, spread in XZ: a pad, not a ball.
    pos.setXYZ(i, pos.getX(i) * j * 1.25, pos.getY(i) * j * 0.42, pos.getZ(i) * j * 1.25);
  }
  geom.computeVertexNormals();
  const m = new THREE.Matrix4()
    .makeTranslation(x, y, z)
    .multiply(new THREE.Matrix4().makeRotationY(rng() * Math.PI));
  const c = 0.85 + tint * 0.15;
  return { geom, matrix: m, color: [c * 0.93, c, c * 0.93] };
}

function buildConifer(rng: () => number, form: TreeForm = 'spire'): TreeGeometryData {
  const parts: MergePart[] = [];
  const umbrella = form === 'umbrella';

  // An umbrella pine shows a long bare trunk; a spire is skirted almost to the
  // ground. The trunk carries the difference before any foliage is placed.
  const trunkH = umbrella ? 0.66 + rng() * 0.08 : 0.38;
  parts.push(trunkPart(rng, trunkH, 0.045 + rng() * 0.02, 0.028, BARK, umbrella ? 0.13 : 0.08));

  const tiers = umbrella ? 2 + (rng() < 0.5 ? 1 : 0) : 5 + (rng() < 0.5 ? 1 : 0);
  const top = 1.0;
  const base = umbrella ? trunkH - 0.06 : 0.16 + rng() * 0.05;

  for (let t = 0; t < tiers; t++) {
    const frac = t / tiers;
    const tierBase = base + (top - base) * frac * 0.82;
    const tierH = ((top - base) / tiers) * (umbrella ? 1.5 : 1.9);
    // Spires taper hard from a narrow base; umbrellas stay wide to the top.
    const r = umbrella
      ? (0.34 - 0.09 * frac) * (0.9 + rng() * 0.25)
      : (0.24 - 0.17 * frac) * (0.9 + rng() * 0.25);
    const geom = new THREE.ConeGeometry(r, tierH, 7);

    // Yaw each tier off its neighbours. Identical 7-gons stacked in phase line
    // their facets up into one flat face, which is what made a stack of cones
    // read as a single paper triangle from the side.
    const yaw = (t * Math.PI * 2) / 7 / 2 + rng() * 0.4;
    // Droop: lower the tier below its attach point so the rim sweeps down,
    // instead of every tier sitting level like a stack of hats.
    const droop = (umbrella ? 0.1 : 0.16) * tierH * (0.6 + rng() * 0.8);

    const m = new THREE.Matrix4()
      .makeTranslation(
        (rng() - 0.5) * 0.02,
        tierBase + tierH / 2 - droop,
        (rng() - 0.5) * 0.02,
      )
      .multiply(new THREE.Matrix4().makeRotationY(yaw));
    const c = 0.78 + rng() * 0.12; // conifers slightly darker than broadleaf
    parts.push({ geom, matrix: m, color: [c * 0.9, c, c * 0.92] });
  }

  // The droop offset can pull the highest tier under y=1; a slim crown cone
  // restores the unit frame the instancer scales against.
  parts.push({
    geom: new THREE.ConeGeometry(0.05, 0.2, 7),
    matrix: new THREE.Matrix4().makeTranslation(0, 0.9, 0),
    color: [0.7, 0.78, 0.72],
  });
  return mergeParts(parts);
}

function buildBroadleaf(rng: () => number, form: TreeForm = 'dome'): TreeGeometryData {
  if (form === 'spreading') return buildSpreadingBroadleaf(rng);
  const parts: MergePart[] = [];
  parts.push(trunkPart(rng, 0.5, 0.05 + rng() * 0.025, 0.035, BARK, 0.16));
  // 1-2 short branch stubs reaching into the canopy.
  const branches = 1 + Math.floor(rng() * 2);
  for (let b = 0; b < branches; b++) {
    const geom = new THREE.CylinderGeometry(0.018, 0.03, 0.3, 5, 1, false);
    const ang = rng() * Math.PI * 2;
    const tilt = 0.5 + rng() * 0.5;
    const m = new THREE.Matrix4()
      .makeTranslation(Math.cos(ang) * 0.08, 0.45 + rng() * 0.08, Math.sin(ang) * 0.08)
      .multiply(new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(Math.sin(ang), 0, -Math.cos(ang)).normalize(), tilt,
      ))
      .multiply(new THREE.Matrix4().makeTranslation(0, 0.15, 0));
    parts.push({ geom, matrix: m, color: BARK });
  }
  // Clustered canopy blobs, top of the cluster pinned at y=1.
  // Canopy radius + lateral spread are deliberately capped: a broadleaf at the
  // max instance scale (1.5 × 7 m ≈ 10.5 m) would, with the old 0.30-unit blob
  // radius and 0.22-unit offset, throw a ~5.5 m canopy edge that overhangs and
  // visually swallows an adjacent ~5 m town roof. Clamping the widest blob to
  // 0.22 unit and the offset to 0.13 unit keeps the worst-case canopy edge
  // near ~3.3 m at max scale — full and leafy, but no roof-swallowing.
  const blobs = 3 + Math.floor(rng() * 3);
  const cy = 0.72;
  for (let b = 0; b < blobs; b++) {
    const r = 0.15 + rng() * 0.07;
    const ang = (b / blobs) * Math.PI * 2 + rng();
    const dist = b === 0 ? 0 : 0.06 + rng() * 0.07;
    const y = b === 0 ? cy + 0.08 : cy - 0.04 + rng() * 0.16;
    parts.push(blobPart(rng, r, Math.cos(ang) * dist, Math.min(y, 1 - r * 0.85), Math.sin(ang) * dist, rng()));
  }
  // Crown blob guarantees the unit height.
  parts.push(blobPart(rng, 0.15, 0, 0.87, 0, rng()));
  return mergeParts(parts);
}

/**
 * Spreading broadleaf: an oak/elm outline — short thick bole, limbs thrown out
 * sideways, crown widest well above the trunk and flat on top. The canopy-width
 * cap from the dome form is respected: pads stay inside the same worst-case
 * radius so a max-scale tree still cannot swallow a neighbouring roof.
 */
function buildSpreadingBroadleaf(rng: () => number): TreeGeometryData {
  const parts: MergePart[] = [];
  const boleH = 0.34 + rng() * 0.06;
  parts.push(trunkPart(rng, boleH, 0.062 + rng() * 0.03, 0.042, BARK, 0.1));

  // Limbs splay outward and up — they set the crown's width, not the trunk.
  const limbs = 3 + Math.floor(rng() * 2);
  for (let b = 0; b < limbs; b++) {
    const geom = new THREE.CylinderGeometry(0.016, 0.032, 0.34, 5, 1, false);
    const ang = (b / limbs) * Math.PI * 2 + rng() * 0.5;
    const tilt = 0.85 + rng() * 0.35; // closer to horizontal than the dome's stubs
    const m = new THREE.Matrix4()
      .makeTranslation(Math.cos(ang) * 0.05, boleH - 0.04, Math.sin(ang) * 0.05)
      .multiply(new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(Math.sin(ang), 0, -Math.cos(ang)).normalize(), tilt,
      ))
      .multiply(new THREE.Matrix4().makeTranslation(0, 0.17, 0));
    parts.push({ geom, matrix: m, color: BARK });
  }

  // Crown: wide pads at limb ends, laid at a shallow height spread so the
  // silhouette is broad and flat-topped instead of a ball.
  const pads = 4 + Math.floor(rng() * 2);
  for (let p = 0; p < pads; p++) {
    const r = 0.17 + rng() * 0.05;
    const ang = (p / pads) * Math.PI * 2 + rng() * 0.4;
    const dist = 0.1 + rng() * 0.03;
    const y = 0.72 + rng() * 0.1;
    parts.push(padPart(rng, r, Math.cos(ang) * dist, Math.min(y, 1 - r * 0.42), Math.sin(ang) * dist, rng()));
  }
  // Centre pad pins the unit height.
  parts.push(padPart(rng, 0.16, 0, 0.93, 0, rng()));
  return mergeParts(parts);
}

function buildScrub(rng: () => number, form: TreeForm = 'tussock'): TreeGeometryData {
  const parts: MergePart[] = [];
  if (form === 'thicket') {
    // Sprawls wider than it stands: many short stems, foliage kept low.
    const stems = 4 + Math.floor(rng() * 3);
    for (let s = 0; s < stems; s++) {
      parts.push(trunkPart(rng, 0.22 + rng() * 0.16, 0.024, 0.012, BARK_SCRUB, 1.5));
    }
    const pads = 3 + Math.floor(rng() * 3);
    for (let b = 0; b < pads; b++) {
      const r = 0.16 + rng() * 0.09;
      const ang = (b / pads) * Math.PI * 2 + rng();
      const dist = 0.06 + rng() * 0.14;
      const y = Math.min(0.3 + rng() * 0.28, 1 - r * 0.42);
      const p = padPart(rng, r, Math.cos(ang) * dist, y, Math.sin(ang) * dist, rng());
      p.color = [p.color[0] * 0.92, p.color[1] * 0.88, p.color[2] * 0.75];
      parts.push(p);
    }
    // Guarantee the unit frame — thickets are squat, so pin a small top blob.
    parts.push(blobPart(rng, 0.12, 0, 0.85, 0, rng()));
    return mergeParts(parts);
  }
  const stems = 2 + Math.floor(rng() * 2);
  for (let s = 0; s < stems; s++) {
    parts.push(trunkPart(rng, 0.4 + rng() * 0.25, 0.03, 0.015, BARK_SCRUB, 0.9));
  }
  const blobs = 2 + Math.floor(rng() * 2);
  for (let b = 0; b < blobs; b++) {
    const r = 0.14 + rng() * 0.12;
    const ang = rng() * Math.PI * 2;
    const dist = rng() * 0.16;
    const y = Math.min(0.45 + rng() * 0.4, 1 - r * 0.85);
    // Scrub foliage bakes duller (dry-biome sage read under a yellowish tint).
    const p = blobPart(rng, r, Math.cos(ang) * dist, y, Math.sin(ang) * dist, rng());
    p.color = [p.color[0] * 0.92, p.color[1] * 0.88, p.color[2] * 0.75];
    parts.push(p);
  }
  return mergeParts(parts);
}

const BUILDERS: Record<TreeSpecies, (rng: () => number, form: TreeForm) => TreeGeometryData> = {
  conifer: buildConifer,
  broadleaf: buildBroadleaf,
  scrub: buildScrub,
};

/**
 * Deterministic single-variant generator. `form` picks the silhouette; omitted,
 * it is chosen from the seed so old callers keep working and still get variety.
 */
export function generateTreeGeometry(
  species: TreeSpecies,
  seed: number,
  form?: TreeForm,
): TreeGeometryData {
  const speciesSalt = TREE_SPECIES.indexOf(species) * 0x1f1f1f1f;
  const rng = mulberry32((seed ^ speciesSalt) >>> 0);
  const forms = TREE_FORMS[species] as readonly TreeForm[];
  // Draw the form from the rng BEFORE the builder runs, so the same (species,
  // seed, form) triple always consumes the stream the same way.
  const picked = form ?? forms[Math.floor(rng() * forms.length) % forms.length];
  return BUILDERS[species](rng, picked);
}

/**
 * All variants for all species from one world seed.
 *
 * Forms are assigned round-robin rather than drawn at random: with only a
 * handful of variants, chance can hand every one of them the same silhouette,
 * which is the stamped-hillside look this replaced. Round-robin guarantees the
 * world shows every form while each variant still gets its own seed jitter.
 */
export function generateTreeVariantSet(seed: number): Record<TreeSpecies, TreeGeometryData[]> {
  const out = {} as Record<TreeSpecies, TreeGeometryData[]>;
  for (const species of TREE_SPECIES) {
    out[species] = treeVariantPlan(species, seed).map((v) =>
      generateTreeGeometry(species, v.seed, v.form),
    );
  }
  return out;
}

/** Per-variant seed stride. Exported so callers and tests share one schedule. */
export const VARIANT_SEED_STRIDE = 7919;

/**
 * The (form, seed) each variant of a species is built from. This is the plan
 * `generateTreeVariantSet` follows, exposed so a test can check form coverage
 * against the exact seeds used rather than re-deriving them.
 */
export function treeVariantPlan(
  species: TreeSpecies,
  seed: number,
): { form: TreeForm; seed: number }[] {
  const forms = TREE_FORMS[species] as readonly TreeForm[];
  return Array.from({ length: VARIANTS_PER_SPECIES }, (_, v) => ({
    form: forms[v % forms.length],
    seed: seed + v * VARIANT_SEED_STRIDE,
  }));
}
