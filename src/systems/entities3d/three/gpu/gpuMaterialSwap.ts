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
 * concurrent edit — this walks the finished tree and rebuilds the materials
 * that cannot cross as they are:
 *   - the ink outline and the blob shadow, raw-GLSL `ShaderMaterial`s that a
 *     WGSL-emitting backend cannot compile. Found by the names stamped in
 *     `toon.ts`, never by guessing at `instanceof ShaderMaterial`.
 *   - the toon body, whose node twin is LIT. In a scene with no lights — the
 *     WebGPU battle map, deliberately, because the node-path `LightsNode`
 *     never sees R3F-added lights — a lit material renders BLACK. `toon:
 *     'baked'` (the default) rebuilds it as an unlit material carrying the
 *     same 6-band ramp against a constant sun. `toon: 'keep'` leaves it for a
 *     WebGPU scene that does light itself.
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
import { Color, Mesh, MeshToonMaterial, type Object3D, type Material } from 'three';
import {
    BLOB_SHADOW_MATERIAL_NAME,
    OUTLINE_MATERIAL_NAME,
} from '../toon';
import {
    bakedToonNodeMaterial,
    blobShadowNodeMaterial,
    outlineNodeMaterial,
    DEATH_FADE_UNIFORM_KEY,
    CONDITION_TINT_UNIFORM_KEY,
    CONDITION_TINT_STRENGTH_UNIFORM_KEY,
    type BakedEntityLight,
    type OutlineNodeParams,
} from './toonNodes';

export interface GpuSwapResult {
    /** Outline materials rebuilt as nodes. */
    outlines: number;
    /** Blob shadows rebuilt as nodes. */
    shadows: number;
    /** Toon bodies rebuilt as unlit baked-ramp nodes. */
    toons: number;
    /** Tagged materials found but not rebuildable, with the reason. */
    skipped: string[];
}

export interface GpuSwapOptions {
    /**
     * `'baked'` (default) rebuilds every `MeshToonMaterial` as an unlit node
     * material with the toon ramp baked against a constant sun — required for
     * a scene with no lights. `'keep'` leaves toon materials for three's own
     * lit conversion, for a WebGPU scene that does add lights.
     */
    toon?: 'baked' | 'keep';
    /** Override the constant sun the bake uses. Defaults to the battle map\u2019s. */
    light?: BakedEntityLight;
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
export function swapEntityMaterialsForGpu(
    root: Object3D,
    options: GpuSwapOptions = {},
): GpuSwapResult {
    const result: GpuSwapResult = { outlines: 0, shadows: 0, toons: 0, skipped: [] };
    // One rebuilt material per source material: an entity shares one outline
    // material across many meshes, and rebuilding per mesh would multiply the
    // pipeline count for no visual difference.
    const rebuilt = new Map<Material, Material>();

    root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const current = object.material as Material | Material[];
        if (Array.isArray(current)) {
            object.material = current.map((m) => rebuildOne(m, rebuilt, result, options));
            return;
        }
        object.material = rebuildOne(current, rebuilt, result, options);
    });

    return result;
}

function rebuildOne(
    material: Material,
    rebuilt: Map<Material, Material>,
    result: GpuSwapResult,
    options: GpuSwapOptions,
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

    // A toon body compiles fine on the node path but needs lights it will not
    // get. Identified by the three class rather than by name: unlike
    // ShaderMaterial, MeshToonMaterial is unambiguous.
    if (options.toon !== 'keep' && material instanceof MeshToonMaterial) {
        const next = bakedToonNodeMaterial(material, options.light);
        rebuilt.set(material, next);
        material.dispose();
        result.toons += 1;
        return next;
    }

    return material;
}

/**
 * Drive the death fade on every baked toon material under `root`.
 *
 * Preserves the WebGPU token affordance this replaced: a downed combatant went
 * flat grey. Now the real body desaturates in place. Materials that carry no
 * fade uniform (eyes, ink, blob shadow) are skipped, so a corpse keeps its ink
 * outline — which is what makes it still readable lying down.
 *
 * @param root - The group returned by `assembleEntity`, already swapped.
 * @param amount - 0 = alive, 1 = fully drained.
 * @returns How many materials the fade was applied to.
 */
export function setEntityDeathFade(root: Object3D, amount: number): number {
    let applied = 0;
    const seen = new Set<Material>();
    root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
            if (!material || seen.has(material)) continue;
            seen.add(material);
            const node = (material.userData as Record<string, unknown> | undefined)?.[
                DEATH_FADE_UNIFORM_KEY
            ] as { value?: number } | undefined;
            if (!node || typeof node.value !== 'number') continue;
            node.value = amount;
            applied += 1;
        }
    });
    return applied;
}

/**
 * Drive the condition body tint on every baked toon material under `root`
 * (task agora-f821.35, GG-227).
 *
 * This is the WebGPU half of the cue the WebGL body already shows: a poisoned
 * creature reads green at tactical zoom, where a 14px chip does not. The hue
 * and strength are the shared palette's numbers
 * (`src/utils/visuals/conditionPalette.ts`), passed in by the caller rather
 * than looked up here, because `src/systems` must not reach into the combat
 * UI's idea of which condition is dominant.
 *
 * Materials without the uniforms (eyes, ink, blob shadow) are skipped, so a
 * tinted body keeps its ink outline and its eye whites.
 *
 * @param root - The group returned by `assembleEntity`, already swapped.
 * @param tintColor - 0xRRGGBB overlay hue, or null for no condition tint.
 * @param strength - 0 = untouched, 1 = fully the tint color.
 * @returns How many materials the tint was applied to.
 */
export function setEntityConditionTint(
    root: Object3D,
    tintColor: number | null,
    strength: number,
): number {
    // A null hue and a zero strength are the same picture, and mixing toward a
    // stale color at strength 0 is a no-op, so null simply parks the strength.
    const amount = tintColor === null ? 0 : Math.max(0, Math.min(1, strength));
    let applied = 0;
    const seen = new Set<Material>();
    root.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
            if (!material || seen.has(material)) continue;
            seen.add(material);
            const userData = material.userData as Record<string, unknown> | undefined;
            const strengthNode = userData?.[CONDITION_TINT_STRENGTH_UNIFORM_KEY] as
                | { value?: number }
                | undefined;
            const colorNode = userData?.[CONDITION_TINT_UNIFORM_KEY] as
                | { value?: Color }
                | undefined;
            if (!strengthNode || typeof strengthNode.value !== 'number') continue;
            if (tintColor !== null && colorNode?.value instanceof Color) {
                colorNode.value.setHex(tintColor);
            }
            strengthNode.value = amount;
            applied += 1;
        }
    });
    return applied;
}
