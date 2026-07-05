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

/** Pre-generated look-alike variants per species (instanced; small on purpose). */
export const VARIANTS_PER_SPECIES = 3;

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

function buildConifer(rng: () => number): TreeGeometryData {
  const parts: MergePart[] = [];
  parts.push(trunkPart(rng, 0.38, 0.045 + rng() * 0.02, 0.028, BARK, 0.08));
  // Stacked cone tiers from ~0.22 up to exactly 1.0.
  const tiers = 3 + (rng() < 0.5 ? 1 : 0);
  let top = 1.0;
  let base = 0.22 + rng() * 0.05;
  for (let t = 0; t < tiers; t++) {
    const frac = t / tiers;
    const tierBase = base + (top - base) * frac * 0.82;
    const tierH = ((top - base) / tiers) * 1.65;
    const r = (0.3 - 0.2 * frac) * (0.9 + rng() * 0.25);
    const geom = new THREE.ConeGeometry(r, tierH, 7);
    const m = new THREE.Matrix4().makeTranslation(
      (rng() - 0.5) * 0.02,
      tierBase + tierH / 2,
      (rng() - 0.5) * 0.02,
    );
    const c = 0.78 + rng() * 0.12; // conifers slightly darker than broadleaf
    parts.push({ geom, matrix: m, color: [c * 0.9, c, c * 0.92] });
  }
  return mergeParts(parts);
}

function buildBroadleaf(rng: () => number): TreeGeometryData {
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
  const blobs = 3 + Math.floor(rng() * 3);
  const cy = 0.72;
  for (let b = 0; b < blobs; b++) {
    const r = 0.16 + rng() * 0.14;
    const ang = (b / blobs) * Math.PI * 2 + rng();
    const dist = b === 0 ? 0 : 0.08 + rng() * 0.14;
    const y = b === 0 ? cy + 0.08 : cy - 0.04 + rng() * 0.16;
    parts.push(blobPart(rng, r, Math.cos(ang) * dist, Math.min(y, 1 - r * 0.85), Math.sin(ang) * dist, rng()));
  }
  // Crown blob guarantees the unit height.
  parts.push(blobPart(rng, 0.15, 0, 0.87, 0, rng()));
  return mergeParts(parts);
}

function buildScrub(rng: () => number): TreeGeometryData {
  const parts: MergePart[] = [];
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

const BUILDERS: Record<TreeSpecies, (rng: () => number) => TreeGeometryData> = {
  conifer: buildConifer,
  broadleaf: buildBroadleaf,
  scrub: buildScrub,
};

/** Deterministic single-variant generator. */
export function generateTreeGeometry(species: TreeSpecies, seed: number): TreeGeometryData {
  const speciesSalt = TREE_SPECIES.indexOf(species) * 0x1f1f1f1f;
  return BUILDERS[species](mulberry32((seed ^ speciesSalt) >>> 0));
}

/** All variants for all species from one world seed. */
export function generateTreeVariantSet(seed: number): Record<TreeSpecies, TreeGeometryData[]> {
  const out = {} as Record<TreeSpecies, TreeGeometryData[]>;
  for (const species of TREE_SPECIES) {
    out[species] = [];
    for (let v = 0; v < VARIANTS_PER_SPECIES; v++) {
      out[species].push(generateTreeGeometry(species, seed + v * 7919));
    }
  }
  return out;
}
