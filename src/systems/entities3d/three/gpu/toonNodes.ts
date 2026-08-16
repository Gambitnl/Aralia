/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/entities3d/three/gpu/toonNodes.ts
 *
 * TSL twins of the two raw-GLSL entity materials.
 *
 * Generated entities use four materials. Three of them cross to WebGPU for
 * free: `MeshToonMaterial` and `MeshBasicMaterial` are converted to
 * `MeshToonNodeMaterial` / `MeshBasicNodeMaterial` by three 0.172 itself. The
 * other two are `ShaderMaterial` carrying GLSL source, and GLSL does not
 * compile on the WebGPU path, which emits WGSL. They are rebuilt here as node
 * materials instead.
 *
 * This is why entity bodies showed as capsules in the WebGPU battle scene. The
 * scene's own header blamed the whole 1,491-line CharacterActor rig; the actual
 * blocker was these two shaders, and the ink outline is the one that matters,
 * because the outline carries the entity look.
 *
 * NO FALLBACK: a swap that cannot rebuild a material leaves the original in
 * place and says so, rather than substituting a plain color that would quietly
 * change the art.
 */
import { BackSide, Color, DoubleSide } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    attribute,
    float,
    positionLocal,
    normalLocal,
    uniform,
    uv,
    vec3,
    vec4,
    smoothstep,
} from 'three/tsl';

export interface OutlineNodeParams {
    colorHex: string;
    thickness: number;
    opacity: number;
    /** True when the geometry carries the per-vertex `aInk` weight attribute. */
    perVertexScale: boolean;
}

/**
 * Inverse-hull ink outline as a node material.
 *
 * The GLSL original pushed each vertex along its normal by `uT` and drew the
 * back faces flat. This does the same through `positionNode`.
 *
 * Skinning needs no special handling here. On the node path the renderer
 * applies skinning around `positionLocal`, so a deforming body keeps its
 * outline — the GLSL version had to `#include <skinning_vertex>` by hand.
 */
export function outlineNodeMaterial(params: OutlineNodeParams): MeshBasicNodeMaterial {
    const { colorHex, thickness, opacity, perVertexScale } = params;
    const translucent = opacity < 1;

    const material = new MeshBasicNodeMaterial();
    material.side = BackSide;
    material.transparent = translucent;
    material.depthWrite = !translucent;

    // A missing `aInk` attribute reads 0, which would erase the outline
    // entirely, so per-vertex weighting is opt-in exactly as in the GLSL path.
    const push = perVertexScale
        ? float(thickness).mul(attribute('aInk', 'float'))
        : float(thickness);

    material.positionNode = positionLocal.add(normalLocal.normalize().mul(push));
    // The 0.22 multiplier is the original's ink darkening, kept identical so
    // the WebGPU look matches the WebGL one rather than merely resembling it.
    material.colorNode = uniform(new Color(colorHex).multiplyScalar(0.22));
    material.opacityNode = uniform(float(opacity));

    return material;
}

/**
 * Soft radial ground shadow as a node material. Canvas-free, like the original,
 * so it stays headless-safe.
 */
export function blobShadowNodeMaterial(): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    material.side = DoubleSide;

    const distanceFromCenter = uv().sub(vec2Center()).length();
    // smoothstep(0.5, 0.12, d): fully opaque at the middle, gone by the rim.
    const alpha = smoothstep(float(0.5), float(0.12), distanceFromCenter).mul(0.4);

    material.colorNode = vec3(0.08, 0.16, 0.1);
    material.opacityNode = alpha;
    return material;
}

/** The uv center, as its own node so the expression above reads plainly. */
function vec2Center() {
    return vec4(0.5, 0.5, 0, 0).xy;
}
