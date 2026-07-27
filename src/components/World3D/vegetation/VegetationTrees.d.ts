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
import React from 'react';
import type { VegetationScatter } from '@/systems/world3d/types';
/**
 * All trees of one chunk's scatter. Parent group supplies the chunk offset.
 */
export declare const VegetationTrees: React.FC<{
    scatter: VegetationScatter;
    castShadow?: boolean;
}>;
