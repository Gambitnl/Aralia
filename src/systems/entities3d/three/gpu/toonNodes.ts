/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/entities3d/three/gpu/toonNodes.ts
 *
 * TSL twins of the raw-GLSL and scene-lit entity materials.
 *
 * Generated entities use four materials.
 *   - `ShaderMaterial` ink outline and blob shadow carry raw GLSL, which does
 *     not compile on the WebGPU path (it emits WGSL). Rebuilt here as nodes.
 *   - `MeshToonMaterial` and `MeshBasicMaterial` ARE converted to their node
 *     twins by three 0.172 itself, so they compile — but `MeshToonNodeMaterial`
 *     is a LIT material, and the WebGPU battle scene deliberately carries NO
 *     scene lights (the node-path `LightsNode` never sees R3F-added lights,
 *     three #30044). A lit material in a lightless scene renders BLACK. So the
 *     toon body also gets a twin here: `bakedToonNodeMaterial`, an unlit
 *     `MeshBasicNodeMaterial` that bakes the same 6-band toon ramp against a
 *     constant sun + hemisphere, exactly the pattern the scene already uses for
 *     terrain, grass and props.
 *
 * This is why entity bodies showed as capsules in the WebGPU battle scene. The
 * scene's own header blamed the whole 1,491-line CharacterActor rig; the actual
 * blockers were these shaders plus the missing light path.
 *
 * NO FALLBACK: a swap that cannot rebuild a material leaves the original in
 * place and says so, rather than substituting a plain color that would quietly
 * change the art.
 */
import { BackSide, Color, DoubleSide, type MeshToonMaterial } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    attribute,
    cameraProjectionMatrix,
    dot,
    float,
    int,
    max as tslMax,
    mix,
    modelViewMatrix,
    normalize as tslNormalize,
    normalView,
    normalWorld,
    oneMinus,
    positionLocal,
    positionViewDirection,
    normalLocal,
    saturate,
    step,
    uniform,
    uv,
    vec3,
    vec4,
    smoothstep,
} from 'three/tsl';
import { INK_MAX_SCREEN_FRACTION } from '../toon';

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

    // Screen-space width cap — the exact mirror of the GLSL vertex shader in
    // toon.ts (see INK_MAX_SCREEN_FRACTION there for the derivation): the push
    // is clamped so its projected width never exceeds that fraction of the
    // viewport height. Depth uses the local (bind-pose) vertex; the node
    // renderer applies skinning around positionNode afterward, and centimeters
    // of pose error against meters of camera distance do not move a soft cap.
    const mvPos = modelViewMatrix.mul(vec4(positionLocal, 1.0));
    const orthoTerm = cameraProjectionMatrix.element(int(3)).element(int(3));
    const inkDepth = mix(mvPos.z.negate(), float(1.0), orthoTerm).max(float(0.0));
    const inkScale = modelViewMatrix.element(int(0)).xyz.length();
    const p11 = cameraProjectionMatrix.element(int(1)).element(int(1));
    const inkMax = float(2 * INK_MAX_SCREEN_FRACTION).mul(inkDepth).div(p11);
    const clamped = float(thickness).mul(inkScale).min(inkMax).div(inkScale);

    // A missing `aInk` attribute reads 0, which would erase the outline
    // entirely, so per-vertex weighting is opt-in exactly as in the GLSL path.
    const push = perVertexScale
        ? clamped.mul(attribute('aInk', 'float'))
        : clamped;

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

// ---------------------------------------------------------------------------
// Baked toon body material (WebGPU battle map).
// ---------------------------------------------------------------------------

/**
 * Key under which a baked toon material parks its death-fade uniform node.
 *
 * The fade lives on the material rather than on a scene graph flag because the
 * WebGPU path has no per-object tint hook, and rebuilding a material every time
 * a combatant drops would recompile a pipeline mid-encounter.
 */
export const DEATH_FADE_UNIFORM_KEY = 'gpuDeathFade';

/**
 * Keys under which a baked toon material parks its condition-tint uniform
 * nodes (task agora-f821.35, GG-227).
 *
 * Same reasoning as the death fade: conditions change mid-encounter, and
 * rebuilding the material to recolor a poisoned goblin would recompile a
 * pipeline mid-fight. The COLOR is a uniform too, not a material constant,
 * because one body can move between conditions without changing material.
 *
 * The hue and the strength both come from the shared palette
 * `src/utils/visuals/conditionPalette.ts`, the same file the WebGL body and
 * the 2D chip read, so the three renderers cannot drift apart again.
 */
export const CONDITION_TINT_UNIFORM_KEY = 'gpuConditionTint';
export const CONDITION_TINT_STRENGTH_UNIFORM_KEY = 'gpuConditionTintStrength';

/**
 * Constant sun + hemisphere the baked entity body is lit by.
 *
 * These MIRROR the constants at the top of
 * `src/components/BattleMap/BattleMap3DGpuScene.tsx` (SUN_DIRECTION, SKY_COLOR,
 * GROUND_COLOR, SUN_COLOR, AMBIENT, SUN_INTENSITY, HEMI_INTENSITY). They are
 * duplicated rather than imported because `src/systems` must not depend on
 * `src/components`. If the scene's key light is retuned, retune this too or the
 * actors will read as lit from a different sun than the ground they stand on.
 */
export interface BakedEntityLight {
    sunDirection: [number, number, number];
    sunColor: string;
    skyColor: string;
    groundColor: string;
    ambient: number;
    sunIntensity: number;
    hemiIntensity: number;
}

export const BATTLE_MAP_BAKED_LIGHT: BakedEntityLight = {
    sunDirection: [12, 16, 12],
    sunColor: '#fff1da',
    skyColor: '#bcd6ff',
    groundColor: '#6b6048',
    ambient: 0.2,
    sunIntensity: 1.2,
    hemiIntensity: 0.55,
};

/**
 * View-dependent edge light for an entity body.
 *
 * MIRRORS the defaults in `components/BattleMap/characters/useFresnelRim.ts`
 * (DEFAULTS.rimColor / rimIntensity / rimPower). Duplicated, not imported, for
 * the same reason `BATTLE_MAP_BAKED_LIGHT` is: `src/systems` must not depend on
 * `src/components`. Retune one and retune the other, or the two render paths
 * will draw different silhouettes.
 */
export interface BakedEntityRim {
    /** Fresnel edge color. */
    colorHex: string;
    /** Edge strength; 0 is off. */
    intensity: number;
    /** Fresnel exponent — lower widens the band. */
    power: number;
}

export const BATTLE_MAP_ACTOR_RIM: BakedEntityRim = {
    colorHex: '#bfd8ff',
    intensity: 0.75,
    power: 2.6,
};

/**
 * The 6-band toon ramp from `toon.ts`, as fractions.
 *
 * Kept as literal numbers instead of sampling the shared `toonGradient()`
 * DataTexture: a RedFormat byte texture is one more thing to get wrong on the
 * WebGPU backend, and six constants compile to six `step`s with no sampler.
 * If the ramp in toon.ts changes, change it here too.
 */
const TOON_RAMP = [40, 90, 140, 185, 220, 255].map((v) => v / 255);

/* eslint-disable @typescript-eslint/no-explicit-any */
type TSLNode = any;

/**
 * Quantize a lambert term to the shared 6-band ramp.
 *
 * three's `getGradientIrradiance` samples the ramp at `dotNL * 0.5 + 0.5` with
 * a NearestFilter, so band `i` starts at `i / 6`. This reproduces that mapping
 * arithmetically instead of sampling.
 */
function toonRamp(dotNL: TSLNode): TSLNode {
    const coord = dotNL.mul(0.5).add(0.5);
    let acc: TSLNode = float(TOON_RAMP[0]);
    for (let i = 1; i < TOON_RAMP.length; i++) {
        acc = acc.add(float(TOON_RAMP[i] - TOON_RAMP[i - 1]).mul(step(float(i / TOON_RAMP.length), coord)));
    }
    return acc;
}

/**
 * Unlit twin of an assembled `MeshToonMaterial`, with the toon lighting baked in.
 *
 * Reads the FINISHED material rather than the recipe that built it, so every
 * surface tweak `toonMaterial()` already applied (metallic cool-shift, soft
 * warm-shift, emissive self-illumination) survives the crossing without this
 * file re-deriving it.
 *
 * The WebGL rim-light term is preserved too (task agora-a2b8). `toon.ts` and
 * `useFresnelRim.ts` inject it through `onBeforeCompile` GLSL, which the node
 * path cannot patch — so it is rebuilt here as the same arithmetic on TSL
 * nodes: `pow(1 - saturate(dot(normalView, viewDir)), power) * color *
 * intensity`, added at the final color stage, ON TOP of the death fade exactly
 * as the GLSL patch adds it on top of its status tint. Pass `rim = null` for a
 * scene that does not want it.
 *
 * NOT preserved: `useFresnelRim`'s status tint / desaturation stage. That is a
 * live per-character uniform driven by conditions, not a material constant, and
 * the WebGPU body already carries the defeat half of it through
 * `DEATH_FADE_UNIFORM_KEY`. The condition tint is NO LONGER a gap: it rides
 * `CONDITION_TINT_UNIFORM_KEY` and `CONDITION_TINT_STRENGTH_UNIFORM_KEY`,
 * driven per character by `setEntityConditionTint`. What is still missing is
 * the DESATURATION half of the WebGL patch; the palette carries a
 * `desaturate` number this path does not yet read.
 */
export function bakedToonNodeMaterial(
    source: MeshToonMaterial,
    light: BakedEntityLight = BATTLE_MAP_BAKED_LIGHT,
    rim: BakedEntityRim | null = BATTLE_MAP_ACTOR_RIM,
): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial();
    material.side = source.side;
    material.transparent = source.transparent;
    material.opacity = source.opacity;
    material.depthWrite = source.depthWrite;
    // NOT copied from the source: `flatShading`. toonMaterial sets it so low-poly
    // facets read as sculpted form, but three 0.172 implements flat normals with
    // `dpdx`/`dpdy`, and on this material the normal is resolved in the VERTEX
    // stage, where WGSL forbids derivatives:
    //   "built-in cannot be used by vertex pipeline stage ... normalFlat =
    //    normalize( cross( dpdx( v_positionView ), -dpdy( v_positionView ) ) )"
    // The pipeline then fails to create and the body does not draw at all. Smooth
    // normals are the honest cost; the faceting is a real, small look gap.

    const base = source.color;
    const sun = new Color(light.sunColor);
    const sky = new Color(light.skyColor);
    const ground = new Color(light.groundColor);
    const [sx, sy, sz] = light.sunDirection;
    const sunDir = tslNormalize(vec3(sx, sy, sz));

    const dotNL = dot(normalWorld, sunDir);
    const direct = vec3(sun.r, sun.g, sun.b).mul(light.sunIntensity).mul(toonRamp(dotNL));
    const hemiMix = normalWorld.y.mul(0.5).add(0.5);
    const hemi = vec3(ground.r, ground.g, ground.b)
        .mix(vec3(sky.r, sky.g, sky.b), hemiMix)
        .mul(light.hemiIntensity);
    const irradiance = direct.add(hemi).add(vec3(light.ambient));

    let lit: TSLNode = vec3(base.r, base.g, base.b).mul(irradiance);
    const emissive = source.emissive;
    if (emissive && (emissive.r > 0 || emissive.g > 0 || emissive.b > 0)) {
        const k = source.emissiveIntensity ?? 1;
        lit = lit.add(vec3(emissive.r * k, emissive.g * k, emissive.b * k));
    }

    // Death fade — the WebGPU token used to swap its whole body to a flat grey
    // when a combatant dropped. That affordance is preserved here as a 0..1
    // uniform so a real body can desaturate in place instead of being replaced.
    // Condition tint, BEFORE the death fade: a corpse must not keep glowing
    // poison green, and the fade is what says "not a live combatant". White
    // at strength 0 is a no-op mix, so an unafflicted body is untouched.
    const conditionTint = uniform(new Color(0xffffff));
    const conditionTintStrength = uniform(0);
    const afflicted = mix(lit, conditionTint, saturate(conditionTintStrength));

    const death = uniform(0);
    const luma = dot(afflicted, vec3(0.2126, 0.7152, 0.0722));
    const corpse = vec3(luma, luma, luma).mul(0.55);
    let out: TSLNode = mix(afflicted, corpse, tslMax(0.0, death));

    // Silhouette rim, last: a defeated body keeps its edge separation from the
    // terrain, which is the whole point of the WebGL term this rebuilds.
    if (rim && rim.intensity > 0) {
        const rimColor = new Color(rim.colorHex);
        const facing = saturate(dot(tslNormalize(normalView), positionViewDirection));
        const fresnel = oneMinus(facing).pow(float(rim.power));
        out = out.add(vec3(rimColor.r, rimColor.g, rimColor.b).mul(fresnel).mul(float(rim.intensity)));
    }

    material.colorNode = out;
    material.userData = {
        ...(source.userData ?? {}),
        [DEATH_FADE_UNIFORM_KEY]: death,
        [CONDITION_TINT_UNIFORM_KEY]: conditionTint,
        [CONDITION_TINT_STRENGTH_UNIFORM_KEY]: conditionTintStrength,
    };

    return material;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
