/**
 * @file UnderstoryField.tsx — the forest floor, drawn as one instanced mesh per
 * (species, variant) for every loaded chunk at once.
 *
 * Batched across chunks for the same reason the trees are: the understory is
 * the most numerous thing in the world by a wide margin, and one instanced mesh
 * per species per chunk would put the draw-call count back where the tree
 * batching pass found it.
 *
 * Positions arrive in world/scene space, so this sits at the scene root rather
 * than inside a per-chunk group.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { TreeGeometryData } from '@/systems/worldforge/vegetation/treeMeshGenerator';
import {
  generateUnderstoryVariantSet,
  UNDERSTORY_SIZE_M,
  UNDERSTORY_VARIANTS,
  type UnderstorySpecies,
} from '@/systems/worldforge/vegetation/understoryMeshSource';

/** Fixed seed: understory SHAPES are a global art asset set, like the trees. */
const UNDERSTORY_SET_SEED = 4211;

export interface UnderstoryChunkInput {
  understory: {
    positions: Float32Array;
    scales: Float32Array;
    rotations: Float32Array;
    colors: Float32Array;
    species: UnderstorySpecies[];
    count: number;
  };
  offset: readonly [number, number, number];
}

let sharedGeometries: Map<string, THREE.BufferGeometry> | null = null;

function toBufferGeometry(data: TreeGeometryData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  g.setIndex(new THREE.BufferAttribute(data.indices, 1));
  g.computeBoundingSphere();
  return g;
}

function getGeometry(species: UnderstorySpecies, variant: number): THREE.BufferGeometry {
  if (!sharedGeometries) {
    sharedGeometries = new Map();
    const set = generateUnderstoryVariantSet(UNDERSTORY_SET_SEED);
    for (const [sp, variants] of Object.entries(set)) {
      (variants as TreeGeometryData[]).forEach((data, v) => {
        sharedGeometries!.set(`${sp}|${v}`, toBufferGeometry(data));
      });
    }
  }
  return sharedGeometries.get(`${species}|${variant}`)!;
}

/*
 * DoubleSide because fronds and leaf sprays are open ribbons — culled from
 * behind, half of every fern disappears depending on where the player stands.
 *
 * No shadow casting. The understory is the densest thing in the depth pass and
 * the least visible in it: a fern's shadow lands on the litter it is already
 * standing in. The trees above cast, which is what actually shapes the floor.
 */
const UNDERSTORY_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  vertexColors: true,
  side: THREE.DoubleSide,
  roughness: 0.92,
});

interface Batch {
  species: UnderstorySpecies;
  variant: number;
  position: number[];
  /** Per instance: horizontal size then vertical, so a rosette can be squat. */
  scale: number[];
  rotation: number[];
  color: number[];
  /** Estimated ground normal at each instance (see estimateNormals). */
  normal: number[];
  /** Extra lean off that normal, in radians, plus the azimuth it leans toward. */
  lean: number[];
}

/**
 * How much of the ground's slope each species takes on.
 *
 * A fallen log has no choice — it is lying on the surface, and any daylight
 * under one end is the most obvious fault on a forest floor, so it conforms
 * completely. A fern grows out of the litter it is rooted in and mostly
 * follows it. A sapling is the odd one: trees grow toward vertical whatever
 * they are standing on, so it takes only a third of the slope, which is the
 * amount a young stem on a hillside actually carries before it corrects.
 */
const CONFORM: Record<UnderstorySpecies, number> = { fern: 0.8, sapling: 0.32, log: 1 };

/** Random lean on top of the conform, radians. Nothing in a wood is plumb. */
const LEAN_MAX: Record<UnderstorySpecies, number> = { fern: 0.26, sapling: 0.14, log: 0.06 };

/**
 * Size band per species, as a multiplier on the incoming scale.
 *
 * The chunk loader already rides `dens` — a plant's depth into its thicket —
 * into the scale it hands over, and that is the right signal. What was missing
 * is that a thicket's interior saturates `dens` near 1, so most of a thicket's
 * ferns arrive within a few percent of each other and the intended spread only
 * exists at the margins. A per-instance jitter restores it everywhere; the
 * band then stops the two multipliers compounding into 30 cm seedlings and
 * two-meter monsters.
 */
const SCALE_BAND: Record<UnderstorySpecies, readonly [number, number]> = {
  fern: [0.45, 1.75],
  sapling: [0.5, 1.6],
  log: [0.7, 1.45],
};

/**
 * A log's instance color, replacing the understory green the loader assigns.
 *
 * The loader tints every understory instance from one green palette, which is
 * right for the two living species and wrong for the dead one: multiplied
 * through the log's bark it produced a near-black green object, and "too dark
 * to see" was half of why logs were invisible. Kept slightly warm and slightly
 * varied rather than flat gray — a weathered trunk is not one value.
 */
const LOG_TINT: readonly [number, number, number] = [0.62, 0.57, 0.53];

/** Ground-normal estimate grid, meters. */
const NORMAL_CELL_M = 4;

/**
 * Estimate the terrain normal under every instance from the instances alone.
 *
 * The understory arrives here as bare positions — the heightfield the loader
 * sampled to place them does not come with it, and reaching back for it would
 * mean this component owning a chunk-format dependency it currently does not
 * have. But there are thousands of these positions per window and each one
 * carries the surface height where it was placed, so the point cloud IS a
 * sampling of the terrain. Averaging it into 4 m cells and differencing
 * neighbors recovers the slope closely enough to lean a plant with.
 *
 * Cells with no neighbor on one side fall back to a one-sided difference, and
 * an isolated cell reports flat. A plant standing alone in a clearing losing
 * its lean is not a visible fault; a whole thicket standing plumb on a
 * hillside is, and that case always has the neighbors.
 */
function estimateNormals(
  xs: number[],
  ys: number[],
  zs: number[],
): Float32Array {
  const sum = new Map<string, [number, number]>();
  const n = xs.length;
  for (let i = 0; i < n; i++) {
    const key = `${Math.floor(xs[i] / NORMAL_CELL_M)},${Math.floor(zs[i] / NORMAL_CELL_M)}`;
    const e = sum.get(key);
    if (e) {
      e[0] += ys[i];
      e[1] += 1;
    } else {
      sum.set(key, [ys[i], 1]);
    }
  }
  const meanAt = (i: number, j: number): number | null => {
    const e = sum.get(`${i},${j}`);
    return e ? e[0] / e[1] : null;
  };
  /** Central difference where both neighbors exist, one-sided where one does. */
  const slope = (a: number | null, b: number | null, c: number): number => {
    if (a !== null && b !== null) return (b - a) / (2 * NORMAL_CELL_M);
    if (b !== null) return (b - c) / NORMAL_CELL_M;
    if (a !== null) return (c - a) / NORMAL_CELL_M;
    return 0;
  };
  const out = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const i = Math.floor(xs[k] / NORMAL_CELL_M);
    const j = Math.floor(zs[k] / NORMAL_CELL_M);
    const here = meanAt(i, j) ?? ys[k];
    let dx = slope(meanAt(i - 1, j), meanAt(i + 1, j), here);
    let dz = slope(meanAt(i, j - 1), meanAt(i, j + 1), here);
    /* Clamped at 45 degrees. The estimate is noisy where a cell holds two
     * plants at the top and bottom of a bank, and an unclamped gradient there
     * lays a fern flat on its side — a wrong lean is far more conspicuous than
     * no lean. */
    dx = Math.max(-1, Math.min(1, dx));
    dz = Math.max(-1, Math.min(1, dz));
    const inv = 1 / Math.hypot(dx, 1, dz);
    out[k * 3] = -dx * inv;
    out[k * 3 + 1] = inv;
    out[k * 3 + 2] = -dz * inv;
  }
  return out;
}

const UnderstoryBatchMesh: React.FC<{ batch: Batch }> = ({ batch }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = getGeometry(batch.species, batch.variant);
  const count = batch.rotation.length;

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const qYaw = new THREE.Quaternion();
    const qLean = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3();
    const leanAxis = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const col = new THREE.Color();
    const baseSize = UNDERSTORY_SIZE_M[batch.species];
    const conform = CONFORM[batch.species];
    for (let i = 0; i < count; i++) {
      pos.set(batch.position[i * 3], batch.position[i * 3 + 1], batch.position[i * 3 + 2]);

      /* Orientation is conform x lean x yaw, applied right to left: spin the
       * plant about its own stem first, tip it off plumb, then lay that whole
       * result onto the ground. Doing the conform first and the yaw last would
       * spin the plant about the WORLD up after it had been tilted, which
       * shears it back off the surface — the bug that makes conformed
       * vegetation on a hillside look like it is sliding downhill. */
      normal.set(batch.normal[i * 3], batch.normal[i * 3 + 1], batch.normal[i * 3 + 2]);
      normal.lerp(up, 1 - conform).normalize();
      quat.setFromUnitVectors(up, normal);
      const leanAngle = batch.lean[i * 2];
      if (leanAngle > 1e-4) {
        const az = batch.lean[i * 2 + 1];
        leanAxis.set(Math.cos(az), 0, Math.sin(az));
        qLean.setFromAxisAngle(leanAxis, leanAngle);
        quat.multiply(qLean);
      }
      qYaw.setFromAxisAngle(up, batch.rotation[i]);
      quat.multiply(qYaw);

      const sx = batch.scale[i * 2] * baseSize;
      const sy = batch.scale[i * 2 + 1] * baseSize;
      scl.set(sx, sy, sx);
      matrix.compose(pos, quat, scl);
      mesh.setMatrixAt(i, matrix);
      col.setRGB(batch.color[i * 3], batch.color[i * 3 + 1], batch.color[i * 3 + 2]);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [batch, count]);

  if (count === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, UNDERSTORY_MATERIAL, count]}
      receiveShadow
    />
  );
};

/**
 * Bucket every loaded chunk's understory into (species, variant) batches.
 *
 * Variant comes from a position hash rather than a counter, so the same plant
 * keeps the same shape as chunks stream in and out around it — a fern that
 * changes species when you walk away and come back is worse than no variety.
 */
function buildBatches(chunks: readonly UnderstoryChunkInput[]): Batch[] {
  // Flatten first: the ground-normal estimate needs every instance in the
  // window at once, and it has to run before anything is bucketed by species.
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (const chunk of chunks) {
    const u = chunk.understory;
    const [ox, oy, oz] = chunk.offset;
    for (let i = 0; i < u.count; i++) {
      xs.push(u.positions[i * 3] + ox);
      ys.push(u.positions[i * 3 + 1] + oy);
      zs.push(u.positions[i * 3 + 2] + oz);
    }
  }
  const normals = estimateNormals(xs, ys, zs);

  const byKey = new Map<string, Batch>();
  let k = 0;
  for (const chunk of chunks) {
    const u = chunk.understory;
    for (let i = 0; i < u.count; i++, k++) {
      const x = xs[k];
      const y = ys[k];
      const z = zs[k];
      const species = u.species[i];
      let h = Math.imul(Math.round(x * 8) + 0x9e3779b9, 0x85ebca6b)
        ^ Math.imul(Math.round(z * 8) + 0x27d4eb2f, 0xc2b2ae35);
      h = (h ^ (h >>> 15)) >>> 0;
      const variant = h % UNDERSTORY_VARIANTS;
      // Three more decorrelated streams off the same hash. Reusing `h` itself
      // for size would tie a plant's size to its variant, and every large fern
      // in the world would be the same three shapes.
      const h1 = ((h * 0x2545f491) >>> 8) / 0xffffff;
      const h2 = ((h * 0x9e3779b1) >>> 8) / 0xffffff;
      const h3 = ((h * 0x85ebca77) >>> 8) / 0xffffff;

      const key = `${species}|${variant}`;
      let batch = byKey.get(key);
      if (!batch) {
        batch = {
          species,
          variant,
          position: [],
          scale: [],
          rotation: [],
          color: [],
          normal: [],
          lean: [],
        };
        byKey.set(key, batch);
      }
      batch.position.push(x, y, z);

      const band = SCALE_BAND[species];
      const s = Math.max(band[0], Math.min(band[1], u.scales[i] * (0.76 + h1 * 0.5)));
      /* Height varies independently of spread on the two living species. Two
       * ferns at the same overall size but different proportions read as two
       * plants; scaled uniformly they read as one plant at two distances,
       * which is the failure mode a pure size jitter has on its own. Logs stay
       * uniform — a log squashed on one axis is an oval trunk. */
      batch.scale.push(s, species === 'log' ? s : s * (0.86 + h2 * 0.34));

      batch.rotation.push(u.rotations[i]);
      batch.normal.push(normals[k * 3], normals[k * 3 + 1], normals[k * 3 + 2]);
      batch.lean.push(h2 * LEAN_MAX[species], h3 * Math.PI * 2);

      if (species === 'log') {
        const v = 0.9 + h1 * 0.24;
        batch.color.push(LOG_TINT[0] * v, LOG_TINT[1] * v, LOG_TINT[2] * v);
      } else {
        batch.color.push(u.colors[i * 3], u.colors[i * 3 + 1], u.colors[i * 3 + 2]);
      }
    }
  }
  return [...byKey.values()];
}

export const UnderstoryField: React.FC<{ chunks: readonly UnderstoryChunkInput[] }> = ({
  chunks,
}) => {
  const batches = useMemo(() => buildBatches(chunks), [chunks]);
  return (
    <>
      {batches.map((b) => (
        <UnderstoryBatchMesh key={`${b.species}|${b.variant}`} batch={b} />
      ))}
    </>
  );
};

export default UnderstoryField;
