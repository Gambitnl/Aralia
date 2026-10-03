/**
 * @file toon.ts — shared toon-shading pieces, ported from the blobfolk
 * prototype: 3-step gradient ramp, inverse-hull outline, and a canvas-free
 * radial blob shadow (shader-based so it works headless).
 */
import {
  BufferGeometry,
  Color,
  DataTexture,
  DoubleSide,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  ShaderMaterial,
  BackSide,
} from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MaterialSurface } from '../types';

/** How generated entity bodies are drawn. */
export type EntityRenderMode = 'solid' | 'wireframe';

/**
 * Names stamped on the two raw-GLSL materials below.
 *
 * They exist because those two, alone among the entity materials, cannot run
 * under a WebGPURenderer. `MeshToonMaterial` and `MeshBasicMaterial` are
 * converted to their node twins automatically by three 0.172; a `ShaderMaterial`
 * carrying GLSL source is not, because the WebGPU path compiles WGSL.
 *
 * The swap keys off these names rather than `instanceof ShaderMaterial`, so a
 * future hand-written shader is not silently misidentified as an outline.
 */
export const OUTLINE_MATERIAL_NAME = 'entity-ink-outline';
export const BLOB_SHADOW_MATERIAL_NAME = 'entity-blob-shadow';

/**
 * Ink-width ceiling as a fraction of viewport height (2026-08-18, Remy's
 * close-up eyeball). The hull push is a WORLD size (hM * 0.011), tuned for the
 * game camera. A zoomed-in camera magnified that same 2 cm into 30-60 px slabs
 * — fists and armpits flooded shut, the robe read as a black-flanked bell.
 * The vertex shader now caps the push so its projected width never exceeds
 * this fraction of the screen. 0.012 ≈ 13 px on a 1080-row view: above every
 * approved game-distance line (6-8 px), so far looks are untouched and only
 * close-ups thin down.
 */
export const INK_MAX_SCREEN_FRACTION = 0.012;

/**
 * The global default look for generated entities. Every consumer that does
 * not pass its own `renderMode` inherits this. `'solid'` (toon-shaded bodies
 * with ink outlines) is the shipping look; `'wireframe'` remains available as
 * an explicit opt-in (forge debug toggle) — it was the global default from
 * 2026-07-12 until the creature-quality pass made solid bodies the better
 * first impression everywhere.
 */
export const ENTITY_RENDER_MODE: EntityRenderMode = 'solid';

let gradient: DataTexture | null = null;

/** The 6-step toon ramp all entity materials share. */
export function toonGradient(): DataTexture {
  if (!gradient) {
    // 6 bands give twice the value resolution of the old 3-step ramp —
    // every surface shows more dimensional response to light, and small
    // geometric detail that was invisible at 3 bands now produces a
    // readable value step. The spacing is roughly equal (≈35–50 per step)
    // with a slightly deeper shadow floor and a bright highlight cap.
    gradient = new DataTexture(new Uint8Array([40, 90, 140, 185, 220, 255]), 6, 1, RedFormat);
    gradient.minFilter = gradient.magFilter = NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

/**
 * Rim-light strength — kept as a module-level constant so every entity gets
 * the same rim without per-material uniform overhead. Subtle enough to add
 * dimensionality at grazing angles without overwhelming the toon look.
 * BG3 uses rim lighting as a primary readability tool; this is the
 * lightweight toon-friendly version.
 */
const RIM_STRENGTH = 0.12;
const RIM_POWER = 2.8;

export function toonMaterial(colorHex: string, surface: MaterialSurface = 'default'): MeshToonMaterial {
  // flatShading: the Dragon Forge trick — low-poly facets read as sculpted
  // form under lighting, for free (set post-construction: the 0.172 typings
  // omit it from the toon constructor props)
  const material = new MeshToonMaterial({ color: colorHex, gradientMap: toonGradient() });
  // runtime-supported on every lit material; this repo's 0.172 typings omit it
  (material as unknown as { flatShading: boolean }).flatShading = true;

  // Surface-specific tinting: each type shifts the base color slightly before
  // the toon ramp quantizes it, so the final result reads as a different
  // material without needing a second pass or custom shader.
  if (surface === 'metallic') {
    // Metals are lighter and cooler — push toward white/blue-grey.
    material.color.lerp(new Color('#c8d0e0'), 0.25);
    material.emissive = new Color('#000000');
  } else if (surface === 'emissive') {
    // Emissive surfaces glow softly — add a faint self-illumination tint.
    material.emissive = new Color(colorHex).multiplyScalar(0.25);
    material.emissiveIntensity = 0.35;
  } else if (surface === 'soft') {
    // Soft surfaces (skin, cloth) are warmer — shift toward the red/yellow axis.
    material.color.lerp(new Color('#e8c8a0'), 0.12);
  }

  // Rim uniforms shared between the material surface (for debugger access) and
  // the compiled shader (via onBeforeCompile). Same object references so that
  // changing `material.uniforms.uRimStrength.value` at runtime also changes the
  // value the fragment shader reads.
  const rimStrength = { value: RIM_STRENGTH };
  const rimPower = { value: RIM_POWER };
  (material as unknown as { uniforms: Record<string, { value: number }> }).uniforms = {
    uRimStrength: rimStrength,
    uRimPower: rimPower,
  };
  // Rim lighting: a Fresnel term added to the final color gives dimensionality
  // at grazing angles — every surface picks up a subtle bright edge where it
  // turns away from the camera. This replaces the deleted inverse-hull rim
  // shell (round 22, which drew a "sticker-edge halo") with a view-dependent
  // effect that scales with surface curvature instead of uniform width.
  material.onBeforeCompile = (shader) => {
    // Share the same uniform objects so runtime tweaks propagate to the shader.
    shader.uniforms.uRimStrength = rimStrength;
    shader.uniforms.uRimPower = rimPower;
    // Fragment only: inject uniforms at global scope, then rim math before
    // dithering. The `normal` varying (from <normal_fragment>) and
    // `vViewPosition` are already available in MeshToonMaterial's fragment
    // shader — no vertex injection needed.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nuniform float uRimStrength;\nuniform float uRimPower;',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `{
        vec3 _rimN = normalize(normal);
        vec3 _rimV = normalize(vViewPosition);
        float _rim = 1.0 - max(dot(_rimV, _rimN), 0.0);
        gl_FragColor.rgb += pow(_rim, uRimPower) * uRimStrength;
      }
      #include <dithering_fragment>`,
    );
  };
  return material;
}

/**
 * Unlit wireframe material — draws only the triangle edges of a mesh. The
 * colour is brightened a touch so the lines read against sky and ground
 * without a filled surface behind them.
 */
export function wireframeMaterial(colorHex: string): MeshBasicMaterial {
  const color = new Color(colorHex).lerp(new Color('#ffffff'), 0.18);
  return new MeshBasicMaterial({ color, wireframe: true });
}

/** The material factory for a render mode: toon-shaded solid, or wireframe. */
export function entityMaterial(mode: EntityRenderMode): (colorHex: string, surface?: MaterialSurface) => MeshToonMaterial | MeshBasicMaterial {
  return mode === 'wireframe' ? wireframeMaterial : toonMaterial;
}

/** Inverse-hull ink outline: render the same geometry inflated, back faces only.
 *
 * Skeleton pivot slice 1: the vertex shader now includes the three.js skinning
 * chunks. On a plain Mesh nothing changes (every chunk is guarded by
 * USE_SKINNING, which three only defines when the object is a SkinnedMesh),
 * but on a skinned body the ink shell follows the bones instead of freezing in
 * bind pose. The inflation happens in bind space along the bind normal, then
 * the bone transform carries the inflated vertex — exact for rigid weights. */
export function outlineMaterial(colorHex: string, thickness = 0.02, opacity = 1, perVertexScale = false): ShaderMaterial {
  // round 7 (creature-anatomy): translucent bodies (opacity < 1) carry a
  // matching translucent ink — an opaque black hull around a see-through gel
  // read as "a green rock wall with heavy black outlines".
  const translucent = opacity < 1;
  // round 16 (humanoid-anatomy): optional per-vertex ink scale (`aInk` float
  // attribute, 1 = full weight). The uniform hull thickness (hM * 0.011) is
  // wider than the creases between hand-scale forms — it inked the thumb/palm
  // and knuckle valleys shut and rounded the fist back into the critic's
  // "featureless sphere". Only pass true when the geometry carries `aInk`
  // (a missing attribute reads 0 ⇒ no outline at all).
  return new ShaderMaterial({
    // Tagged so the WebGPU path can find and replace this material. Raw GLSL
    // ShaderMaterial cannot compile under WebGPURenderer (it emits WGSL), and
    // the ink outline is not optional — it carries the whole entity look. See
    // three/gpu/toonNodes.ts for the TSL twin and gpuMaterialSwap.ts for the
    // swap. The params ride in userData because a node material must be
    // REBUILT, not patched.
    name: OUTLINE_MATERIAL_NAME,
    userData: { colorHex, thickness, opacity, perVertexScale },
    side: BackSide,
    transparent: translucent,
    depthWrite: !translucent,
    uniforms: {
      uC: { value: new Color(colorHex).multiplyScalar(0.22) },
      uT: { value: thickness },
      uA: { value: opacity },
      uFMax: { value: INK_MAX_SCREEN_FRACTION },
    },
    // Screen-space width cap (see INK_MAX_SCREEN_FRACTION): the projected
    // height of a push `t` at view depth `w` is t * P[1][1] / w in NDC, and
    // NDC spans 2 screen heights. Depth comes from the BIND-pose vertex — for
    // a posed limb that is off by centimeters against meters of camera
    // distance, invisible in a soft cap. P[3][3] is 1 only for an
    // orthographic camera, where the depth term drops out. The modelView
    // column length undoes the object scale (the head shell divides its
    // thickness by skullR because its group is scaled by skullR — the cap
    // must compare WORLD sizes).
    vertexShader: `
      uniform float uT;
      uniform float uFMax;
      ${perVertexScale ? 'attribute float aInk;' : ''}
      #include <skinning_pars_vertex>
      void main() {
        #include <skinbase_vertex>
        vec4 inkMv = modelViewMatrix * vec4(position, 1.0);
        float inkW = max(mix(-inkMv.z, 1.0, projectionMatrix[3][3]), 0.0);
        float inkScale = length(modelViewMatrix[0].xyz);
        float inkMax = 2.0 * uFMax * inkW / projectionMatrix[1][1];
        float inkT = min(uT * inkScale, inkMax) / inkScale;
        vec3 transformed = position + normalize(normal) * inkT${perVertexScale ? ' * aInk' : ''};
        #include <skinning_vertex>
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uC;
      uniform float uA;
      void main() { gl_FragColor = vec4(uC, uA); }`,
  });
}

/**
 * Smooth-normal clone of a geometry, for the ink hull ONLY.
 *
 * Inflating flat-faceted geometry along its normals splits the hull at every
 * hard edge — each facet pushes in its own direction and the cracks show the
 * background through the ink (the hat-cone slivers and skirt wedges in Remy's
 * 2026-08-18 close-ups; the head loft hit the same failure in round 8 and
 * carries its own smooth shell). This rebuilds the surface as one welded
 * indexed mesh with vertex-averaged normals, so the hull inflates as a single
 * closed skin. Position-only on purpose: the hull shader reads nothing else,
 * and dropping the split normals is what lets mergeVertices weld the seams.
 */
export function smoothShellGeometry(geometry: BufferGeometry): BufferGeometry {
  const positionOnly = new BufferGeometry();
  positionOnly.setAttribute('position', geometry.getAttribute('position'));
  if (geometry.index) positionOnly.setIndex(geometry.index);
  const welded = mergeVertices(positionOnly, 1e-4);
  welded.computeVertexNormals();
  return welded;
}

/** Soft radial ground shadow without canvas textures (headless-safe). */
export function blobShadowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    // Tagged for the same WebGPU swap as the outline above.
    name: BLOB_SHADOW_MATERIAL_NAME,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uOpacity: { value: 0.4 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacity;
      void main() {
        float d = distance(vUv, vec2(0.5));
        float a = uOpacity * smoothstep(0.5, 0.12, d);
        gl_FragColor = vec4(0.08, 0.16, 0.10, a);
      }`,
  });
}

/**
 * Show or hide every painted ink outline under `root` — the inverse-hull
 * shells the assembler names `*Outline` and paints with the outline
 * material. A review toggle (Part Lab, Entity Debug, Entity Forge,
 * 2026-08-22): the fill stays, the contour line goes.
 */
export function setOutlineVisible(root: import('three').Object3D, visible: boolean): void {
  root.traverse((o) => {
    const mesh = o as import('three').Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as import('three').Material | import('three').Material[];
    const byMaterial = Array.isArray(mat) ? mat.some((m) => m.name === OUTLINE_MATERIAL_NAME) : mat?.name === OUTLINE_MATERIAL_NAME;
    if (byMaterial || /Outline$/.test(mesh.name)) mesh.visible = visible;
  });
}
