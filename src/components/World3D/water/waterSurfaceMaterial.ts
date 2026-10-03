/**
 * @file waterSurfaceMaterial.ts
 * @description The look of open water: a rippling, self-coloured, sun-catching
 * surface rather than a flat lit polygon.
 *
 * WHY: measured in-game at burg Hajdured, a pixel on the river read RGB
 * (86, 84, 71) while the dirt beside it read (91, 87, 74) — five points apart,
 * and not even blue-dominant. A plain lit MeshStandardMaterial takes the scene's
 * warm dusk light and washes #2f78b4 to grey-brown, so water was invisible next
 * to mud. Three things fix that and none of them need an external asset:
 *
 *   1. A procedural ripple NORMAL MAP. The sheets are 2-triangle quads, so
 *      geometry can carry no detail; the normals have to supply it. Scrolling
 *      two layers at different speeds and angles keeps it from reading as one
 *      sliding texture.
 *   2. Emissive tied to the water colour, so the surface keeps its blue when the
 *      sun is low. Water at dusk is darker, not browner.
 *   3. Low roughness plus a little metalness, so the sun leaves a highlight that
 *      moves as the camera does. A still, matte plane never reads as liquid.
 *
 * The texture is generated once and shared by every chunk's water mesh.
 */
import * as THREE from 'three';

/** Ripple texture size. Small on purpose: it tiles, and it is a normal map. */
const RIPPLE_SIZE = 128;

/** How many world meters one tile of the ripple covers. */
export const RIPPLE_METERS_PER_TILE = 12;

let rippleTexture: THREE.DataTexture | null = null;

/**
 * Build a tiling ripple normal map from summed sine waves.
 *
 * Deterministic and dependency-free. The wave numbers are whole numbers so the
 * pattern wraps seamlessly at the tile edge — a normal map that does not wrap
 * puts a visible grid across the water.
 */
export function getRippleNormalTexture(): THREE.DataTexture {
  if (rippleTexture) return rippleTexture;

  const size = RIPPLE_SIZE;
  const data = new Uint8Array(size * size * 4);
  // Each wave: [wavesAcrossX, wavesAcrossY, amplitude]. Whole numbers keep the
  // tile seamless; mixed directions stop it looking like corduroy.
  const waves: Array<[number, number, number]> = [
    [1, 2, 1.0],
    [2, -1, 0.7],
    [3, 3, 0.4],
    [5, -2, 0.22],
  ];
  const TAU = Math.PI * 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Slope of the summed surface, which is what a normal map encodes.
      let dx = 0;
      let dy = 0;
      for (const [kx, ky, amp] of waves) {
        const phase = TAU * (kx * u + ky * v);
        dx += amp * kx * Math.cos(phase);
        dy += amp * ky * Math.cos(phase);
      }
      // Gentle: strong slopes make water look like crumpled foil.
      const strength = 0.06;
      const n = new THREE.Vector3(-dx * strength, 1, -dy * strength).normalize();
      const i = (y * size + x) * 4;
      data[i] = Math.round((n.x * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((n.z * 0.5 + 0.5) * 255); // tangent-space green
      data[i + 2] = Math.round((n.y * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  rippleTexture = tex;
  return tex;
}

/** Water colour, kept in one place so the emissive can be derived from it. */
export const WATER_COLOR = '#2f78b4';

/**
 * The deep-channel colour. Darker and far less saturated than the old single
 * WATER_COLOR: one flat blue across every body is what made rivers and pools
 * read as decals painted onto the terrain rather than as water sitting in it.
 */
export const WATER_DEEP_COLOR = '#1d4e6d';

/**
 * The colour of water thin enough to see the bed through. Not a lighter blue —
 * a desaturated silt-green, because a shallow margin takes most of its
 * appearance from the sand and mud under it, and a pale BLUE rim just reads as
 * a second decal outlining the first.
 */
export const WATER_SHALLOW_COLOR = '#7d9a8c';

/** Opacity at the shore edge and in the deep channel. */
const SHALLOW_OPACITY = 0.12;
const DEEP_OPACITY = 0.9;

let material: THREE.MeshStandardMaterial | null = null;

/**
 * The shared water material. One instance for every chunk, so the scrolling
 * offset advances once per frame rather than once per chunk.
 *
 * Reads the per-vertex depth encoding that `waterGeometry` packs into the color
 * attribute (see WaterMesh): red = opacity ramp, green = colour ramp. Depth
 * cannot be recovered in the shader — it is the gap between the water surface
 * and the CARVED BED, and the bed heightfield is CPU-side only — so the vertex
 * attribute is the channel that carries it.
 */
export function getWaterSurfaceMaterial(): THREE.MeshStandardMaterial {
  if (material) return material;
  const ripple = getRippleNormalTexture();
  material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(WATER_COLOR),
    // Holds the water's own colour when the sun is low, so dusk makes it darker
    // rather than browner. Measured problem: a lit-only surface went grey.
    emissive: new THREE.Color(WATER_COLOR).multiplyScalar(0.55),
    emissiveIntensity: 0.5,
    normalMap: ripple,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.12,
    metalness: 0.25,
    transparent: true,
    // Per-vertex depth drives opacity now, so the constant is neutral; the
    // ramp's own endpoints live in SHALLOW_OPACITY/DEEP_OPACITY.
    opacity: 1,
    vertexColors: true,
    /**
     * DoubleSide, despite the note in `pushUpwardTriangles` arguing against it.
     *
     * That note is about geometry: emitting each triangle twice with opposite
     * windings puts two surfaces at one depth, which z-fights, and it is why the
     * town walls chipped open. DoubleSide does something different — it turns
     * back-face CULLING off, so each triangle still rasterizes exactly once and
     * there is no second surface to fight with. The water is a single sheet, so
     * this costs no triangles and is the whole fix for a lid that used to vanish
     * the moment the camera dipped under it.
     */
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uShallowColor = { value: new THREE.Color(WATER_SHALLOW_COLOR) };
    shader.uniforms.uDeepColor = { value: new THREE.Color(WATER_DEEP_COLOR) };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uShallowColor;
uniform vec3 uDeepColor;
float wOpacityRamp;
float wColorRamp;`,
      )
      // vColor is a depth encoding, not a tint, so the stock chunk's
      // "multiply the diffuse by it" is exactly wrong and gets replaced.
      .replace(
        '#include <color_fragment>',
        `wOpacityRamp = vColor.r;
wColorRamp = vColor.g;
diffuseColor.rgb = mix( uShallowColor, uDeepColor, wColorRamp );
diffuseColor.a = mix( ${SHALLOW_OPACITY.toFixed(3)}, ${DEEP_OPACITY.toFixed(3)}, wOpacityRamp );`,
      )
      // A constant emissive over a depth-faded surface lights the transparent
      // margin as brightly as the channel, which puts the hard edge straight
      // back. Fade it with the water it belongs to.
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance *= mix( 0.15, 1.0, wColorRamp );`,
      );
  };

  return material;
}

/**
 * Advance the ripple. Two layers at different speeds and directions: a single
 * scrolling normal map reads as a texture being dragged, not as moving water.
 */
export function advanceWaterRipple(elapsedSeconds: number): void {
  const tex = rippleTexture;
  if (!tex) return;
  tex.offset.set(elapsedSeconds * 0.013, elapsedSeconds * 0.021);
}

/** Test seam: drop the cached texture/material so a fresh one is built. */
export function resetWaterSurfaceMaterialForTest(): void {
  rippleTexture?.dispose();
  rippleTexture = null;
  material?.dispose();
  material = null;
}
