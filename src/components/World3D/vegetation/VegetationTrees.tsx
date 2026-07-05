/**
 * @file VegetationTrees.tsx
 * @description Procedural instanced trees for the streamed 3D world
 * (beautification wave vegetation lift). Replaces the placeholder cone-trees:
 * consumes the SAME VegetationScatter positions the chunk loaders already
 * emit — only the visual representation changed.
 *
 * A small fixed set of pre-generated tree variants (3 species × 3 variants,
 * seeded, module-level shared geometry) is instanced; each chunk renders one
 * InstancedMesh per non-empty (species, variant) bucket. Standard
 * MeshStandardMaterial + vertex colors + instance colors — WebGL and WebGPU
 * compatible (no TSL).
 */
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { VegetationScatter } from '@/systems/world3d/types';
import {
  generateTreeVariantSet,
  SPECIES_HEIGHT_M,
  type TreeGeometryData,
  type TreeSpecies,
} from '@/systems/worldforge/vegetation/treeMeshGenerator';
import {
  partitionTreeInstances,
  type TreeInstanceBucket,
} from '@/systems/worldforge/vegetation/treeInstancePartition';

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

/** Lazy module-level cache: geometry built once, shared by every chunk. */
function getTreeGeometry(species: TreeSpecies, variant: number): THREE.BufferGeometry {
  if (!sharedGeometries) {
    sharedGeometries = new Map();
    const set = generateTreeVariantSet(TREE_SET_SEED);
    for (const [sp, variants] of Object.entries(set)) {
      variants.forEach((data, v) => {
        sharedGeometries!.set(`${sp}|${v}`, toBufferGeometry(data));
      });
    }
  }
  return sharedGeometries.get(`${species}|${variant}`)!;
}

const TREE_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  vertexColors: true,
  flatShading: true,
  roughness: 0.95,
});

const TreeBucketMesh: React.FC<{
  bucket: TreeInstanceBucket;
  scatter: VegetationScatter;
  castShadow: boolean;
}> = ({ bucket, scatter, castShadow }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = getTreeGeometry(bucket.species, bucket.variant);
  const count = bucket.instanceIndices.length;

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const position = new THREE.Vector3();
    const scaleV = new THREE.Vector3();
    const color = new THREE.Color();
    const baseH = SPECIES_HEIGHT_M[bucket.species];
    for (let n = 0; n < count; n++) {
      const i = bucket.instanceIndices[n];
      const s = scatter.scales[i] * baseH;
      rotation.setFromAxisAngle(axis, scatter.rotations[i]);
      // Geometry is authored base-at-y=0, so no yLift: base sits on the sample.
      position.set(
        scatter.positions[i * 3],
        scatter.positions[i * 3 + 1],
        scatter.positions[i * 3 + 2],
      );
      scaleV.set(s, s, s);
      matrix.compose(position, rotation, scaleV);
      mesh.setMatrixAt(n, matrix);
      if (scatter.colors) {
        // Palette floats are authored sRGB (see vegetationInstanceMatrices).
        color.setRGB(
          scatter.colors[i * 3],
          scatter.colors[i * 3 + 1],
          scatter.colors[i * 3 + 2],
          THREE.SRGBColorSpace,
        );
      } else {
        color.setRGB(0.35, 0.55, 0.3);
      }
      mesh.setColorAt(n, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Recompile so the shader picks up USE_INSTANCING_COLOR.
    TREE_MATERIAL.needsUpdate = true;
  }, [bucket, scatter, count]);

  if (count === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, TREE_MATERIAL, count]}
      castShadow={castShadow}
      frustumCulled={false}
    />
  );
};

/**
 * All trees of one chunk's scatter. Parent group supplies the chunk offset.
 */
export const VegetationTrees: React.FC<{
  scatter: VegetationScatter;
  castShadow?: boolean;
}> = ({ scatter, castShadow = false }) => {
  const buckets = useMemo(() => partitionTreeInstances(scatter), [scatter.cacheKey]);
  return (
    <>
      {buckets
        .filter((b) => b.instanceIndices.length > 0)
        .map((b) => (
          <TreeBucketMesh
            key={`${b.species}|${b.variant}|${scatter.cacheKey}`}
            bucket={b}
            scatter={scatter}
            castShadow={castShadow}
          />
        ))}
    </>
  );
};
