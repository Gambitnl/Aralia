/**
 * @file toon.ts — shared toon-shading pieces, ported from the blobfolk
 * prototype: 3-step gradient ramp, inverse-hull outline, and a canvas-free
 * radial blob shadow (shader-based so it works headless).
 */
import {
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

/** How generated entity bodies are drawn. */
export type EntityRenderMode = 'solid' | 'wireframe';

/**
 * The global default look for generated entities. `wireframe` replaced the
 * solid metaball ("blob") surface 2026-07-12 (Remy): every consumer that does
 * not pass its own `renderMode` inherits this. Flip to `'solid'` to restore
 * the toon-shaded blobfolk body across the whole game in one line.
 */
export const ENTITY_RENDER_MODE: EntityRenderMode = 'wireframe';

let gradient: DataTexture | null = null;

/** The 3-step toon ramp all entity materials share. */
export function toonGradient(): DataTexture {
  if (!gradient) {
    gradient = new DataTexture(new Uint8Array([90, 180, 255]), 3, 1, RedFormat);
    gradient.minFilter = gradient.magFilter = NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export function toonMaterial(colorHex: string): MeshToonMaterial {
  // flatShading: the Dragon Forge trick — low-poly facets read as sculpted
  // form under lighting, for free (set post-construction: the 0.172 typings
  // omit it from the toon constructor props)
  const material = new MeshToonMaterial({ color: colorHex, gradientMap: toonGradient() });
  // runtime-supported on every lit material; this repo's 0.172 typings omit it
  (material as unknown as { flatShading: boolean }).flatShading = true;
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
export function entityMaterial(mode: EntityRenderMode): (colorHex: string) => MeshToonMaterial | MeshBasicMaterial {
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
export function outlineMaterial(colorHex: string, thickness = 0.02): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide,
    uniforms: {
      uC: { value: new Color(colorHex).multiplyScalar(0.22) },
      uT: { value: thickness },
    },
    vertexShader: `
      uniform float uT;
      #include <skinning_pars_vertex>
      void main() {
        #include <skinbase_vertex>
        vec3 transformed = position + normalize(normal) * uT;
        #include <skinning_vertex>
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uC;
      void main() { gl_FragColor = vec4(uC, 1.0); }`,
  });
}

/** Soft radial ground shadow without canvas textures (headless-safe). */
export function blobShadowMaterial(): ShaderMaterial {
  return new ShaderMaterial({
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
