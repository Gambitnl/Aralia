/**
 * @file EzTreeLayer.tsx
 * Procedural trees using the vendored ez-tree library (vendor/ez-tree/).
 *
 * The npm package @dgreenheck/ez-tree has module-level TextureLoader side-effects
 * in textures.js that prevent R3F Canvas WebGL initialization. The vendored copy
 * stubs that file out so the Tree geometry generator can be imported safely.
 *
 * Strategy:
 * - Generate N tree variant geometries once (different presets + seeds per biome)
 * - Use THREE.InstancedMesh for branches and leaves — all trees share draw calls
 * - Override ALL materials with solid MeshStandardMaterial (no texture uploads)
 * - Biome configs own which species and seeds to use
 *
 * Scale calibration:
 * - Oak Medium: trunk length[0] = 37.24 native units
 * - At scale 0.065 → 37.24 * 0.065 ≈ 2.4 world units of trunk
 * - Full tree height ~3-4 world units (one tile = 1 world unit, camera at y=10)
 */
import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { BattleMapData } from '../../../types/combat';

// Vendored ez-tree — stub textures.js removes module-level TextureLoader side-effects.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — vendor JS library; types not required
import { Tree, TreePreset } from '../../../../vendor/ez-tree/src/lib/index.js';

// ---------------------------------------------------------------------------
// Biome tree configuration
// ---------------------------------------------------------------------------

interface TreeVariantConfig {
  preset: string;    // ez-tree preset name: 'Oak Medium', 'Pine Medium', etc.
  seed: number;      // Deterministic seed for this variant
  scale: number;     // Uniform world-space scale factor
  barkColor: number; // Hex color for branch material
  leafColor: number; // Hex color for leaf material
  weight: number;    // Relative spawn weight (values need not sum to 1)
}

interface BiomeTreeConfig {
  variants: TreeVariantConfig[];
}

/**
 * Per-biome tree species selection.
 * Add entries here when adding new biomes — EzTreeLayer reads this config.
 * Seed values are stable and should not be changed once committed (they define
 * the visual character of each variant across all maps).
 */
const BIOME_TREES: Record<string, BiomeTreeConfig> = {
  forest: {
    variants: [
      { preset: 'Oak Medium',  seed: 1001, scale: 0.065, barkColor: 0x5a3318, leafColor: 0x2d6b1a, weight: 3 },
      { preset: 'Oak Large',   seed: 1002, scale: 0.058, barkColor: 0x4a2a12, leafColor: 0x1f5212, weight: 2 },
      { preset: 'Pine Medium', seed: 1003, scale: 0.078, barkColor: 0x3d2a18, leafColor: 0x1a3a14, weight: 3 },
      { preset: 'Ash Medium',  seed: 1004, scale: 0.068, barkColor: 0x6a4a30, leafColor: 0x3a7020, weight: 2 },
    ],
  },
  swamp: {
    variants: [
      // Swamp uses ash and aspen — gnarled, moss-covered, muted palette
      { preset: 'Ash Large',   seed: 2001, scale: 0.056, barkColor: 0x5a4a38, leafColor: 0x3a5028, weight: 3 },
      { preset: 'Ash Medium',  seed: 2002, scale: 0.064, barkColor: 0x6a5848, leafColor: 0x2a4820, weight: 3 },
      { preset: 'Aspen Small', seed: 2003, scale: 0.062, barkColor: 0x8a7860, leafColor: 0x4a5c30, weight: 2 },
      { preset: 'Ash Small',   seed: 2004, scale: 0.060, barkColor: 0x6a5840, leafColor: 0x3a5030, weight: 2 },
    ],
  },
  desert: {
    // Desert: dead/dry trees and scrubby bushes — muted, sun-bleached
    variants: [
      { preset: 'Ash Small',   seed: 3001, scale: 0.058, barkColor: 0x8a7050, leafColor: 0x7a6038, weight: 2 },
      { preset: 'Bush 1',      seed: 3002, scale: 0.090, barkColor: 0x7a6040, leafColor: 0x8a7240, weight: 3 },
      { preset: 'Bush 2',      seed: 3003, scale: 0.080, barkColor: 0x8a6a38, leafColor: 0x7a6030, weight: 3 },
    ],
  },
  cave: {
    // Cave: sparse dark vegetation — fungal/shadowy palette
    variants: [
      { preset: 'Bush 2',      seed: 4001, scale: 0.080, barkColor: 0x3a2a40, leafColor: 0x4a3060, weight: 2 },
      { preset: 'Bush 3',      seed: 4002, scale: 0.075, barkColor: 0x2a2038, leafColor: 0x5a3878, weight: 2 },
      { preset: 'Ash Small',   seed: 4003, scale: 0.050, barkColor: 0x2a2030, leafColor: 0x1a1828, weight: 1 },
    ],
  },
  dungeon: {
    // Dungeon: bare/skeletal only — dark stone-grey
    variants: [
      { preset: 'Ash Small',   seed: 5001, scale: 0.048, barkColor: 0x3a3230, leafColor: 0x282620, weight: 1 },
    ],
  },
};

/** Fallback when biome is not configured */
const DEFAULT_BIOME_TREES = BIOME_TREES.forest;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const ELEVATION_SCALE = 0.3;
const POSITION_JITTER = 0.30;

/** Stable deterministic float [0,1) from integers — no Math.random() */
function stableRand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Pick variant index by weighted random given a stable seed */
function pickVariant(variants: TreeVariantConfig[], tileIdx: number): number {
  const totalWeight = variants.reduce((s, v) => s + v.weight, 0);
  let cursor = stableRand(tileIdx, 9999) * totalWeight;
  for (let vi = 0; vi < variants.length; vi++) {
    cursor -= variants[vi].weight;
    if (cursor <= 0) return vi;
  }
  return variants.length - 1;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EzTreeLayerProps {
  mapData: BattleMapData;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EzTreeLayer: React.FC<EzTreeLayerProps> = ({ mapData }) => {
  const biome = (mapData as BattleMapData & { biome?: string }).biome ?? 'forest';
  const biomeConfig = BIOME_TREES[biome] ?? DEFAULT_BIOME_TREES;

  // --- Collect tile positions that have tree decoration ---
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

  // --- Generate tree variant geometries (runs once per biome config change) ---
  const variantGeometries = useMemo(() => {
    return biomeConfig.variants.map((cfg) => {
      const tree = new Tree();

      // Get preset JSON, override seed and disable textures (we override materials anyway)
      const presetData = (TreePreset as Record<string, unknown>)[cfg.preset] ?? TreePreset['Oak Medium'];
      const presetClone = JSON.parse(JSON.stringify(presetData)) as Record<string, unknown>;
      presetClone.seed = cfg.seed;
      // Disable texture loading — our textures.js stub returns null anyway,
      // but this avoids the null assignment to material maps
      if (presetClone.bark && typeof presetClone.bark === 'object') {
        (presetClone.bark as Record<string, unknown>).textured = false;
      }
      tree.loadFromJson(presetClone as any);

      return {
        branches: tree.branchesMesh.geometry as THREE.BufferGeometry,
        leaves: tree.leavesMesh.geometry as THREE.BufferGeometry,
      };
    });
  }, [biomeConfig]);

  // --- Solid-color materials per variant (no texture uploads) ---
  const variantMaterials = useMemo(() => {
    return biomeConfig.variants.map((cfg) => ({
      branch: new THREE.MeshStandardMaterial({
        color: cfg.barkColor,
        roughness: 0.92,
        metalness: 0.0,
      }),
      leaf: new THREE.MeshStandardMaterial({
        color: cfg.leafColor,
        roughness: 0.80,
        metalness: 0.0,
        side: THREE.DoubleSide,
        // Slight transparency makes leaf clusters feel less solid
        transparent: true,
        opacity: 0.92,
      }),
    }));
  }, [biomeConfig]);

  // --- Build per-variant tile buckets, then InstancedMeshes ---
  const { branchMeshes, leafMeshes } = useMemo(() => {
    if (treeTiles.length === 0) return { branchMeshes: [], leafMeshes: [] };

    const numVariants = biomeConfig.variants.length;

    // Assign each tile to a variant by weighted random
    const buckets: { x: number; y: number; elevation: number }[][] =
      Array.from({ length: numVariants }, () => []);
    treeTiles.forEach((tile, i) => {
      const vi = pickVariant(biomeConfig.variants, i);
      buckets[vi].push(tile);
    });

    const dummy = new THREE.Object3D();
    const branchMeshes: THREE.InstancedMesh[] = [];
    const leafMeshes: THREE.InstancedMesh[] = [];

    for (let vi = 0; vi < numVariants; vi++) {
      const tiles = buckets[vi];
      if (tiles.length === 0) continue;

      const cfg = biomeConfig.variants[vi];
      const geo = variantGeometries[vi];
      const mat = variantMaterials[vi];

      const setMatrix = (mesh: THREE.InstancedMesh, idx: number, tile: { x: number; y: number; elevation: number }) => {
        const jx = (stableRand(idx, vi + 1) - 0.5) * 2 * POSITION_JITTER;
        const jz = (stableRand(idx, vi + 2) - 0.5) * 2 * POSITION_JITTER;
        const rotY = stableRand(idx, vi + 3) * Math.PI * 2;
        // Scale variation ±22%
        const sv = cfg.scale * (0.82 + stableRand(idx, vi + 4) * 0.40);

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

      // Branch instances
      const bMesh = new THREE.InstancedMesh(geo.branches, mat.branch, tiles.length);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      tiles.forEach((tile, i) => setMatrix(bMesh, i, tile));
      bMesh.instanceMatrix.needsUpdate = true;
      branchMeshes.push(bMesh);

      // Leaf instances
      const lMesh = new THREE.InstancedMesh(geo.leaves, mat.leaf, tiles.length);
      lMesh.castShadow = true;
      lMesh.receiveShadow = true;
      tiles.forEach((tile, i) => setMatrix(lMesh, i, tile));
      lMesh.instanceMatrix.needsUpdate = true;
      leafMeshes.push(lMesh);
    }

    return { branchMeshes, leafMeshes };
  }, [treeTiles, biomeConfig, variantGeometries, variantMaterials]);

  // --- Dispose GPU resources on unmount / data change ---
  useEffect(() => {
    return () => {
      branchMeshes.forEach(m => m.dispose());
      leafMeshes.forEach(m => m.dispose());
      variantMaterials.forEach(m => { m.branch.dispose(); m.leaf.dispose(); });
      variantGeometries.forEach(g => { g.branches.dispose(); g.leaves.dispose(); });
    };
  }, [branchMeshes, leafMeshes, variantMaterials, variantGeometries]);

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
