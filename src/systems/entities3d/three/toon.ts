/**
 * @file toon.ts — shared toon-shading pieces, ported from the blobfolk
 * prototype: 3-step gradient ramp, inverse-hull outline, and a canvas-free
 * radial blob shadow (shader-based so it works headless).
 */
import {
  Color,
  DataTexture,
  DoubleSide,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  ShaderMaterial,
  BackSide,
} from 'three';

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
  return new MeshToonMaterial({ color: colorHex, gradientMap: toonGradient() });
}

/** Inverse-hull ink outline: render the same geometry inflated, back faces only. */
export function outlineMaterial(colorHex: string, thickness = 0.02): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide,
    uniforms: {
      uC: { value: new Color(colorHex).multiplyScalar(0.22) },
      uT: { value: thickness },
    },
    vertexShader: `
      uniform float uT;
      void main() {
        vec3 p = position + normalize(normal) * uT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
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
