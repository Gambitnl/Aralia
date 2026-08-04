/**
 * @file ezTreeMeshSource.ts — the streamed world's tree geometry, built from
 * the vendored ez-tree library.
 *
 * The world and the combat map grew trees from two different generators. The
 * combat map has used ez-tree since the beautification wave; the streamed world
 * kept the hand-written `treeMeshGenerator`, whose three species and six forms
 * were always a placeholder. So the tree a player walks past and the tree they
 * fight beside were different objects, and only one of them had been art
 * directed. This file removes the second generator's reason to exist.
 *
 * What has to be true for a variant to drop into the world's renderer:
 *
 * 1. ONE indexed geometry per variant. The field draws a single InstancedMesh
 *    per (species, variant, shadow tier), so branches and leaves are merged
 *    here rather than kept as ez-tree's two meshes. Two meshes per variant
 *    would double a draw-call budget that was cut to 24 on purpose.
 * 2. UNIT FRAME. Trunk base at y = 0, total height exactly 1. Instances are
 *    scaled by SPECIES_HEIGHT_M, so a preset's own scale must be normalized
 *    away or every species inherits ez-tree's arbitrary native units.
 * 3. VERTEX COLORS carry the split. Bark is baked brown and foliage near-white,
 *    because the per-instance biome tint multiplies through and is what makes a
 *    taiga read cold and a rainforest read deep. Baking real leaf color here
 *    would cancel that.
 *
 * The presets are also trimmed on the way in, for the same reason the combat
 * map trims them: stock ez-tree presets are hero-tree detail at 30-60k
 * triangles, and the world draws thousands at once. Two branch levels and
 * fattened leaf clusters hold the silhouette at world distances for roughly a
 * quarter of the triangles.
 */
import * as THREE from 'three';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — vendored JS library; the stubbed textures.js has no types
import { Tree, TreePreset } from '../../../../vendor/ez-tree/src/lib/index.js';
import type { TreeGeometryData } from './treeMeshGenerator';
import { SPECIES_HEIGHT_M, TREE_SPECIES, VARIANTS_PER_SPECIES, type TreeSpecies } from './treeMeshGenerator';

/** Baked bark color. Warm and dark; the instance tint multiplies over it. */
const BARK_RGB: readonly [number, number, number] = [0.34, 0.24, 0.16];
/**
 * Baked foliage color. Near-white rather than white: a flat 1.0 leaves the
 * canopy entirely at the mercy of the palette tint, and a hair of green keeps
 * an untinted or badly-tinted instance from reading as snow.
 */
const LEAF_RGB: readonly [number, number, number] = [0.92, 0.97, 0.90];

/**
 * Which ez-tree preset backs each species, and how tall that species stands.
 *
 * The species list widened from three to six here. Three meant a taiga, a
 * temperate wood and a rainforest all drew from the same silhouettes, so the
 * only thing telling them apart was canopy tint — which is why every forest
 * in the world read as the same forest in a different color.
 */
export const SPECIES_PRESET: Record<TreeSpecies, string> = {
  conifer: 'Pine Medium',
  broadleaf: 'Oak Medium',
  ash: 'Ash Medium',
  aspen: 'Aspen Medium',
  scrub: 'Bush 1',
  palm: 'Aspen Large',
};

/**
 * Per-species preset overrides applied on top of the shared trim.
 *
 * `palm` has no ez-tree preset and never will — the library grows temperate
 * broadleaf and conifer forms. It is built from a large aspen stripped to a
 * bare trunk with its crown thrown to the top, which is a fair reading of a
 * palm at the distances the world draws one, and is honest about being an
 * approximation rather than pretending a palm asset exists.
 */
const SPECIES_TWEAK: Partial<Record<TreeSpecies, (p: Record<string, any>) => void>> = {
  palm: (p) => {
    if (p.branch) {
      p.branch.levels = 1;
      if (p.branch.children) p.branch.children['0'] = 7;
      if (p.branch.start) p.branch.start['0'] = 0.82; // crown only at the very top
    }
    if (p.leaves) {
      p.leaves.count = Math.round((p.leaves.count ?? 18) * 2.4);
      p.leaves.size = (p.leaves.size ?? 1) * 2.6; // long fronds
    }
  },
  scrub: (p) => {
    if (p.branch) p.branch.levels = Math.min(p.branch.levels ?? 2, 2);
  },
};

/** Trim a preset to world-instancing detail. Mutates the clone it is given. */
function trimPreset(p: Record<string, any>, seed: number, species: TreeSpecies): void {
  p.seed = seed;
  const branch = p.branch as { levels?: number; children?: Record<string, number> } | undefined;
  if (branch) {
    branch.levels = Math.min(branch.levels ?? 3, 2);
    if (branch.children) {
      branch.children = {
        ...branch.children,
        '0': Math.min(branch.children['0'] ?? 6, 5),
        '1': Math.min(branch.children['1'] ?? 4, 3),
      };
    }
  }
  const leaves = p.leaves as { count?: number; size?: number } | undefined;
  if (leaves) {
    // Fewer branches means fewer places to hang leaves, so each cluster has to
    // carry more of the canopy or the crown goes see-through at distance.
    //
    // The first pass used the combat map's 2x / 1.25x and shipped a visible
    // regression: at world distances the trees read WISPIER than the low-poly
    // cones they replaced, because a battle-map tree is judged from ten meters
    // and a world tree from a hundred. The old cones had no detail but they had
    // MASS, and mass is the only thing a crown a few pixels across can show.
    leaves.count = Math.round((leaves.count ?? 18) * 3.2);
    leaves.size = (leaves.size ?? 1) * 1.6;
  }
  if (p.bark && typeof p.bark === 'object') p.bark.textured = false;
  SPECIES_TWEAK[species]?.(p);
}

interface Part {
  geo: THREE.BufferGeometry;
  rgb: readonly [number, number, number];
}

/**
 * Merge parts into one indexed geometry in the unit frame.
 *
 * Normalization uses the merged bounding box rather than the trunk alone: a
 * preset's "height" is whatever its tallest leaf reaches, and sizing off the
 * trunk would leave every species overshooting its SPECIES_HEIGHT_M by however
 * much crown sits above the last branch.
 */
function mergeToUnitFrame(parts: Part[]): TreeGeometryData {
  let vertCount = 0;
  let idxCount = 0;
  for (const p of parts) {
    vertCount += p.geo.getAttribute('position').count;
    const idx = p.geo.getIndex();
    idxCount += idx ? idx.count : p.geo.getAttribute('position').count;
  }

  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const indices = new Uint32Array(idxCount);

  let vo = 0;
  let io = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  let cx = 0;
  let cz = 0;

  for (const p of parts) {
    const pos = p.geo.getAttribute('position');
    const nrm = p.geo.getAttribute('normal');
    const idx = p.geo.getIndex();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      positions[(vo + i) * 3] = x;
      positions[(vo + i) * 3 + 1] = y;
      positions[(vo + i) * 3 + 2] = z;
      if (nrm) {
        normals[(vo + i) * 3] = nrm.getX(i);
        normals[(vo + i) * 3 + 1] = nrm.getY(i);
        normals[(vo + i) * 3 + 2] = nrm.getZ(i);
      }
      colors[(vo + i) * 3] = p.rgb[0];
      colors[(vo + i) * 3 + 1] = p.rgb[1];
      colors[(vo + i) * 3 + 2] = p.rgb[2];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices[io + i] = idx.getX(i) + vo;
      io += idx.count;
    } else {
      for (let i = 0; i < pos.count; i++) indices[io + i] = vo + i;
      io += pos.count;
    }
    vo += pos.count;
  }

  // Center on the trunk axis and normalize height. A preset whose model is
  // already unit-height would divide by ~1 and be left alone.
  const span = maxY - minY;
  const k = span > 1e-6 ? 1 / span : 1;
  for (let i = 0; i < vertCount; i++) {
    cx += positions[i * 3];
    cz += positions[i * 3 + 2];
  }
  cx /= Math.max(1, vertCount);
  cz /= Math.max(1, vertCount);
  for (let i = 0; i < vertCount; i++) {
    positions[i * 3] = (positions[i * 3] - cx) * k;
    positions[i * 3 + 1] = (positions[i * 3 + 1] - minY) * k;
    positions[i * 3 + 2] = (positions[i * 3 + 2] - cz) * k;
  }

  return { positions, normals, colors, indices };
}

/** Per-variant seed stride, shared with the hand-written generator's schedule. */
export const EZ_VARIANT_SEED_STRIDE = 7919;

/** Build one species/variant. Exported for the asset-preview harness. */
export function generateEzTreeGeometry(species: TreeSpecies, seed: number): TreeGeometryData {
  const presetName = SPECIES_PRESET[species];
  const source = (TreePreset as Record<string, unknown>)[presetName]
    ?? (TreePreset as Record<string, unknown>)['Oak Medium'];
  const preset = JSON.parse(JSON.stringify(source)) as Record<string, any>;
  trimPreset(preset, seed, species);

  const tree = new Tree();
  // The vendored library's TreeOptions type is stricter than the preset JSON
  // it ships; the presets ARE its own data files.
  tree.loadFromJson(preset as never);

  return mergeToUnitFrame([
    { geo: tree.branchesMesh.geometry as THREE.BufferGeometry, rgb: BARK_RGB },
    { geo: tree.leavesMesh.geometry as THREE.BufferGeometry, rgb: LEAF_RGB },
  ]);
}

/**
 * Every species' variants from one world seed.
 *
 * Drop-in for `generateTreeVariantSet`: same signature, same unit frame, same
 * vertex-color convention, so instancing, batching and the species partition
 * are untouched.
 */
export function generateEzTreeVariantSet(seed: number): Record<TreeSpecies, TreeGeometryData[]> {
  const out = {} as Record<TreeSpecies, TreeGeometryData[]>;
  for (const species of TREE_SPECIES) {
    const variants: TreeGeometryData[] = [];
    for (let v = 0; v < VARIANTS_PER_SPECIES; v++) {
      variants.push(generateEzTreeGeometry(species, (seed + v * EZ_VARIANT_SEED_STRIDE) >>> 0));
    }
    out[species] = variants;
  }
  return out;
}

/** Re-exported so callers need only this module to place a tree. */
export { SPECIES_HEIGHT_M, TREE_SPECIES, type TreeSpecies };
