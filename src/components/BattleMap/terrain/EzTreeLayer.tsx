/**
 * @file EzTreeLayer.tsx
 * Replaces the sphere-on-cylinder tree geometry with @dgreenheck/ez-tree procedural trees.
 *
 * Strategy: generate N tree variant groups (different presets + seeds), then use
 * THREE.InstancedMesh for branches and leaves so all trees share draw calls.
 * With 6 variants × 2 meshes = 12 draw calls for the entire forest, regardless
 * of tree count.
 *
 * Materials are overridden with solid MeshStandardMaterial to avoid uploading
 * ez-tree's 20 texture files to the GPU.
 */
import React, { useMemo, useEffect } from 'react';
import { Tree } from '@dgreenheck/ez-tree';
import * as THREE from 'three';
import { BattleMapData } from '../../../types/combat';

const TILE_SIZE = 1.0;
const ELEVATION_SCALE = 0.3;
const POSITION_JITTER = 0.28;

// [presetName, seed, uniformScale, branchColor, leafColor]
// Scale calibrated so trunk height ≈ 2-3 world units (one tile = 1 unit, camera at y=10).
// Oak Medium trunk length[0] = 37.24 → 37 * 0.065 ≈ 2.4 units tall.
const TREE_CONFIGS: [string, number, number, number, number][] = [
  ['Oak Medium',  101, 0.065, 0x6b4123, 0x2d7a1a],
  ['Oak Large',   202, 0.072, 0x5a3318, 0x1f5c12],
  ['Pine Medium', 303, 0.068, 0x4a3020, 0x1a3d1a],
  ['Ash Medium',  404, 0.060, 0x7a5535, 0x3a8a25],
  ['Aspen Small', 505, 0.052, 0x9a8070, 0x8aad3a],
  ['Oak Small',   606, 0.055, 0x5c3d1e, 0x356b1f],
];

interface EzTreeLayerProps {
  mapData: BattleMapData;
}

// Stable deterministic jitter / rotation from an integer index
function stableRand(i: number, offset = 0): number {
  const x = Math.sin(i * 127.1 + offset * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const EzTreeLayer: React.FC<EzTreeLayerProps> = ({ mapData }) => {
  // Generate tree variant geometries once — only geometry is used; materials are overridden
  const variants = useMemo(() => {
    return TREE_CONFIGS.map(([preset, seed]) => {
      const tree = new Tree();
      tree.loadPreset(preset);
      tree.options.seed = seed;
      tree.generate();
      return tree;
    });
  }, []); // presets are constant

  // Solid-color materials per variant — no texture uploads to GPU
  const variantMaterials = useMemo(() => {
    return TREE_CONFIGS.map(([, , , branchColor, leafColor]) => ({
      branch: new THREE.MeshStandardMaterial({
        color: branchColor,
        roughness: 0.92,
        metalness: 0.0,
      }),
      leaf: new THREE.MeshStandardMaterial({
        color: leafColor,
        roughness: 0.85,
        metalness: 0.0,
        side: THREE.DoubleSide,
        alphaTest: 0.1,
      }),
    }));
  }, []);

  // Collect all tree tile positions
  const treeTiles = useMemo(() => {
    const tiles: { x: number; y: number; elevation: number }[] = [];
    for (const [, tile] of mapData.tiles) {
      if (tile.decoration === 'tree') {
        tiles.push({
          x: tile.coordinates.x,
          y: tile.coordinates.y,
          elevation: tile.elevation,
        });
      }
    }
    return tiles;
  }, [mapData]);

  // Build InstancedMesh objects: one pair (branches + leaves) per variant
  const { branchMeshes, leafMeshes } = useMemo(() => {
    if (treeTiles.length === 0) return { branchMeshes: [], leafMeshes: [] };

    // Distribute tiles round-robin among variants
    const buckets: { x: number; y: number; elevation: number }[][] =
      TREE_CONFIGS.map(() => []);
    treeTiles.forEach((tile, i) => {
      buckets[i % TREE_CONFIGS.length].push(tile);
    });

    const branchMeshes: THREE.InstancedMesh[] = [];
    const leafMeshes: THREE.InstancedMesh[] = [];
    const dummy = new THREE.Object3D();

    for (let vi = 0; vi < variants.length; vi++) {
      const tree = variants[vi];
      const tiles = buckets[vi];
      if (tiles.length === 0) continue;

      const scale = TREE_CONFIGS[vi][2];
      const mats = variantMaterials[vi];

      const setMatrix = (mesh: THREE.InstancedMesh, idx: number, tile: { x: number; y: number; elevation: number }) => {
        const jx = (stableRand(idx, vi + 1) - 0.5) * 2 * POSITION_JITTER;
        const jz = (stableRand(idx, vi + 2) - 0.5) * 2 * POSITION_JITTER;
        const rotY = stableRand(idx, vi + 3) * Math.PI * 2;
        const sv = scale * (0.85 + stableRand(idx, vi + 4) * 0.30);

        dummy.position.set(
          tile.x * TILE_SIZE + 0.5 * TILE_SIZE + jx,
          tile.elevation * ELEVATION_SCALE,
          tile.y * TILE_SIZE + 0.5 * TILE_SIZE + jz,
        );
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.setScalar(sv);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      };

      // Branch InstancedMesh — use solid material, not ez-tree's textured one
      const bMesh = new THREE.InstancedMesh(
        tree.branchesMesh.geometry,
        mats.branch,
        tiles.length,
      );
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      tiles.forEach((tile, i) => setMatrix(bMesh, i, tile));
      bMesh.instanceMatrix.needsUpdate = true;
      branchMeshes.push(bMesh);

      // Leaf InstancedMesh — use solid material, not ez-tree's shader
      const lMesh = new THREE.InstancedMesh(
        tree.leavesMesh.geometry,
        mats.leaf,
        tiles.length,
      );
      lMesh.castShadow = true;
      lMesh.receiveShadow = true;
      tiles.forEach((tile, i) => setMatrix(lMesh, i, tile));
      lMesh.instanceMatrix.needsUpdate = true;
      leafMeshes.push(lMesh);
    }

    return { branchMeshes, leafMeshes };
  }, [treeTiles, variants, variantMaterials]);

  // Dispose GPU resources on unmount / mapData change
  useEffect(() => {
    return () => {
      branchMeshes.forEach(m => m.dispose());
      leafMeshes.forEach(m => m.dispose());
      variantMaterials.forEach(m => { m.branch.dispose(); m.leaf.dispose(); });
    };
  }, [branchMeshes, leafMeshes, variantMaterials]);

  if (treeTiles.length === 0) return null;

  return (
    <>
      {branchMeshes.map((mesh, i) => (
        <primitive key={`ez-branches-${i}`} object={mesh} />
      ))}
      {leafMeshes.map((mesh, i) => (
        <primitive key={`ez-leaves-${i}`} object={mesh} />
      ))}
    </>
  );
};

export default EzTreeLayer;
