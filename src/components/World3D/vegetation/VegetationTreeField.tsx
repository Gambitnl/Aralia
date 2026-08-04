// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/08/2026, 01:54:03
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file VegetationTreeField.tsx
 * @description Every loaded chunk's trees, drawn as ONE instanced mesh per
 * (species, variant, shadow tier) for the whole field.
 *
 * Replaces the per-chunk `VegetationTrees` layer. That layer rendered one
 * instanced mesh per (species, variant) per chunk, so a live frame at burg
 * Hajdured drew 2,340 trees through 379 instanced meshes — 379 of the scene's
 * 571 draw calls, averaging 6 trees each. Batching across chunks caps the count
 * at 24 no matter how many chunks are streamed in.
 *
 * Positions arrive in world/scene space from `buildTreeBatches`, so this
 * component sits at the scene root rather than inside a per-chunk group.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type {
  TreeGeometryData,
  TreeSpecies,
} from '@/systems/worldforge/vegetation/treeMeshGenerator';
import { generateEzTreeVariantSet } from '@/systems/worldforge/vegetation/ezTreeMeshSource';
import {
  buildTreeBatches,
  treeBatchKey,
  type TreeBatch,
  type TreeBatchInput,
} from '@/systems/worldforge/vegetation/treeBatching';

/** Fixed generation seed: tree SHAPES are a global art asset set; per-world
 * variety comes from which variants land where (position-hashed) + palette. */
const TREE_SET_SEED = 1337;

let sharedGeometries: Map<string, THREE.BufferGeometry> | null = null;

function toBufferGeometry(data: TreeGeometryData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  g.setIndex(new THREE.BufferAttribute(data.indices, 1));
  return g;
}

/** Lazy module-level cache: geometry built once, shared by every batch. */
function getTreeGeometry(species: TreeSpecies, variant: number): THREE.BufferGeometry {
  if (!sharedGeometries) {
    sharedGeometries = new Map();
    const set = generateEzTreeVariantSet(TREE_SET_SEED);
    for (const [sp, variants] of Object.entries(set)) {
      (variants as TreeGeometryData[]).forEach((data, v) => {
        sharedGeometries!.set(`${sp}|${v}`, toBufferGeometry(data));
      });
    }
  }
  return sharedGeometries.get(`${species}|${variant}`)!;
}

/*
 * Two settings changed when the geometry moved to ez-tree (2026-08-04).
 *
 * `flatShading` is off. It was right for the old builder, whose crowns were
 * stacked cones and blobs that wanted their facets read. ez-tree ships smooth
 * vertex normals along tapered limbs, and faceting them is exactly the
 * "faceted + flat-shaded up close" complaint from the 2026-07-27 in-game look.
 *
 * `side` is DoubleSide because ez-tree leaves are single quads. Back-face
 * culling them empties half of every crown seen from the wrong side. The
 * trunk's own back faces are inside a closed solid and never resolve, so the
 * cost is drawing them, not seeing them.
 */
const TREE_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  vertexColors: true,
  side: THREE.DoubleSide,
  roughness: 0.95,
});

const TreeBatchMesh: React.FC<{ batch: TreeBatch }> = ({ batch }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = getTreeGeometry(batch.species, batch.variant);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const position = new THREE.Vector3();
    const scaleV = new THREE.Vector3();
    const color = new THREE.Color();
    for (let n = 0; n < batch.count; n++) {
      position.set(batch.position[n * 3], batch.position[n * 3 + 1], batch.position[n * 3 + 2]);
      rotation.setFromAxisAngle(axis, batch.rotation[n]);
      const s = batch.scale[n];
      scaleV.set(s, s, s);
      matrix.compose(position, rotation, scaleV);
      mesh.setMatrixAt(n, matrix);
      if (batch.color) {
        // Palette floats are authored sRGB (see vegetationInstanceMatrices).
        color.setRGB(
          batch.color[n * 3],
          batch.color[n * 3 + 1],
          batch.color[n * 3 + 2],
          THREE.SRGBColorSpace,
        );
        mesh.setColorAt(n, color);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // The batch spans many chunks, so its bounds must come from the instances
    // rather than the single-tree geometry — otherwise culling uses a sphere
    // around the origin and pops the whole field in and out.
    mesh.computeBoundingSphere();
    // Recompile so the shader picks up USE_INSTANCING_COLOR.
    TREE_MATERIAL.needsUpdate = true;
  }, [batch]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, TREE_MATERIAL, batch.count]}
      castShadow={batch.castShadow}
    />
  );
};

/**
 * All trees for every loaded chunk. Mount once at the scene root.
 */
export const VegetationTreeField: React.FC<{ inputs: readonly TreeBatchInput[] }> = ({ inputs }) => {
  // Rebuild when the set of contributing chunks changes. The cache keys carry
  // the chunk payload fingerprints, so an identical worker re-clone does not
  // rewrite every matrix again (W3D-G25).
  const signature = inputs
    .map((i) => `${i.scatter.cacheKey}@${i.offset.join(',')}${i.castShadow ? '+s' : ''}`)
    .join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const batches = useMemo(() => buildTreeBatches(inputs), [signature]);

  return (
    <>
      {batches.map((b) => (
        <TreeBatchMesh key={treeBatchKey(b)} batch={b} />
      ))}
    </>
  );
};
