/**
 * ADR 0009 step 2: characters in the game world on WebGPU.
 *
 * The toon character materials (`toon.ts`) are GLSL: an `onBeforeCompile` rim,
 * an outline hull `ShaderMaterial` and a blob shadow `ShaderMaterial`. Under
 * WebGPURenderer the rim is lost silently and the two `ShaderMaterial`s draw
 * nothing. `swapEntityMaterialsForGpu` (the battle map's proven swap) rebuilds
 * them as TSL node materials after a body is assembled, so `toon.ts` keeps its
 * WebGL users unchanged. A material the swap cannot rebuild is left in place
 * and reported, never hidden.
 */
import type { Object3D } from 'three';
import { swapEntityMaterialsForGpu } from '@/systems/entities3d/three/gpu/gpuMaterialSwap';

export function adaptWorldEntityForWebGpu(root: Object3D): void {
  const result = swapEntityMaterialsForGpu(root);
  if (result.skipped.length > 0) {
    // eslint-disable-next-line no-console
    console.error('[world3d-webgpu] entity material swap left materials unconverted:', result.skipped);
  }
}
