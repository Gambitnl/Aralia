/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/entities3d/three/gpu/gpuMaterialSwap.ts
 *
 * Makes an assembled entity renderable under a WebGPURenderer.
 *
 * `assembleEntity` builds one object tree for both render paths. Rather than
 * thread a backend flag through that whole builder — a large file under
 * concurrent edit — this walks the finished tree and rebuilds only the two
 * materials that cannot cross: the ink outline and the blob shadow. Both are
 * found by the names stamped in `toon.ts`, never by guessing at
 * `instanceof ShaderMaterial`.
 *
 * Call it ONCE per assembled entity, right after `assembleEntity`, and only in
 * a WebGPU scene. It is idempotent: an already-swapped tree has no tagged
 * materials left to find.
 *
 * NO FALLBACK: a material that cannot be rebuilt is left exactly as it was and
 * reported in the result. It will fail loudly at draw time, which is correct —
 * silently swapping in a flat color would change the art without telling
 * anyone.
 */
import { Mesh, type Object3D, type Material } from 'three';
import {
    BLOB_SHADOW_MATERIAL_NAME,
    OUTLINE_MATERIAL_NAME,
} from '../toon';
import {
    blobShadowNodeMaterial,
    outlineNodeMaterial,
    type OutlineNodeParams,
} from './toonNodes';

export interface GpuSwapResult {
    /** Outline materials rebuilt as nodes. */
    outlines: number;
    /** Blob shadows rebuilt as nodes. */
    shadows: number;
    /** Tagged materials found but not rebuildable, with the reason. */
    skipped: string[];
}

/** Read the outline parameters the GLSL material carried for this purpose. */
function outlineParamsFrom(material: Material): OutlineNodeParams | null {
    const data = material.userData as Partial<OutlineNodeParams> | undefined;
    if (!data || typeof data.colorHex !== 'string') return null;
    return {
        colorHex: data.colorHex,
        thickness: typeof data.thickness === 'number' ? data.thickness : 0.02,
        opacity: typeof data.opacity === 'number' ? data.opacity : 1,
        perVertexScale: data.perVertexScale === true,
    };
}

/**
 * Rebuild the GLSL-only materials on an assembled entity as TSL node materials.
 *
 * @param root - The group returned by `assembleEntity`.
 * @returns What was rebuilt, and what was found but could not be.
 */
export function swapEntityMaterialsForGpu(root: Object3D): GpuSwapResult {
    const result: GpuSwapResult = { outlines: 0, shadows: 0, skipped: [] };
    // One rebuilt material per source material: an entity shares one outline
    // material across many meshes, and rebuilding per mesh would multiply the
    // pipeline count for no visual difference.
    const rebuilt = new Map<Material, Material>();

    root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const current = object.material as Material | Material[];
        if (Array.isArray(current)) {
            object.material = current.map((m) => rebuildOne(m, rebuilt, result));
            return;
        }
        object.material = rebuildOne(current, rebuilt, result);
    });

    return result;
}

function rebuildOne(
    material: Material,
    rebuilt: Map<Material, Material>,
    result: GpuSwapResult,
): Material {
    if (!material) return material;
    const cached = rebuilt.get(material);
    if (cached) return cached;

    if (material.name === OUTLINE_MATERIAL_NAME) {
        const params = outlineParamsFrom(material);
        if (!params) {
            result.skipped.push(`${OUTLINE_MATERIAL_NAME}: no params in userData`);
            return material;
        }
        const next = outlineNodeMaterial(params);
        rebuilt.set(material, next);
        material.dispose();
        result.outlines += 1;
        return next;
    }

    if (material.name === BLOB_SHADOW_MATERIAL_NAME) {
        const next = blobShadowNodeMaterial();
        rebuilt.set(material, next);
        material.dispose();
        result.shadows += 1;
        return next;
    }

    return material;
}
