/**
 * @file terrainSurfaceNoise.ts — per-fragment world-space noise for the streamed
 * terrain surface.
 *
 * THE MEASUREMENT THIS EXISTS FOR (2026-08-04).
 *
 * Two faults were reported together, and they turn out to be one missing thing.
 *
 * 1. Natural material boundaries are dead-straight lines. Measured cause: the
 *    material field (`biomeIds`) lives on the 1.524 m ground-cell grid and is
 *    sampled NEAREST, but the terrain mesh carries it as per-VERTEX colour on a
 *    grid of CHUNK_WORLD_SIZE / (LOD_RESOLUTION.full - 1) = 128 / 16 = **8.0 m**
 *    (26 ft). So the material is under-sampled 5.25x and lands on an
 *    axis-aligned 8 m lattice; the fragment shader then interpolates linearly
 *    across each quad's two triangles. The result is a gradient whose iso-lines
 *    are exactly straight and whose crease sits on the quad diagonal — which is
 *    the straight diagonal seam in the frame.
 *
 * 2. The ground is flat plastic at close range. Measured on a walking-distance
 *    capture: per-channel standard deviation over a 500x250 px ground patch was
 *    0.93 / 0.62 / 0.53 of 255 — under 0.4% variation, i.e. numerically a plane.
 *
 * The common cause is a hole in the spatial frequency spectrum. `groundDetailTexture`
 * already supplies a detail map, but it tiles every GROUND_TEXTURE_METERS_PER_TILE
 * = 3 m and its coarsest octave is 4 cells across that tile, so ALL of its
 * content sits between ~0.09 m and ~0.75 m. There is nothing at all in the
 * **1 m to 40 m band** — the band that both faults live in. Sub-metre grain
 * cannot wobble an 8 m boundary, and it vanishes into a mip long before it can
 * give the ground character at walking distance.
 *
 * WHY THIS LEVER AND NOT THE OTHER TWO.
 *
 * - Higher mesh resolution: to resolve a 1.524 m material field you need res 85+
 *   per chunk against today's 17 — ~25x the vertices AND ~25x the per-chunk
 *   sampling work, on terrain that is rebuilt as the player walks. It also moves
 *   terrain geometry, which is snapshot-sensitive here. Rejected on cost.
 * - Per-vertex colour dithering at boundaries: a "dithered" vertex is an 8 m
 *   blob. The mottle would be three times WIDER than the transition it is meant
 *   to disguise. The vertex lattice band-limits any per-vertex scheme to 8 m,
 *   which is the wrong side of the problem. Rejected by the same measurement.
 * - This: a noise term evaluated PER FRAGMENT, so it is not band-limited by the
 *   vertex lattice at all. It costs ~4 hash-lattice evaluations per pixel, zero
 *   memory, zero streaming work, and does not touch a single generated array —
 *   so no golden hash moves.
 *
 * HOW IT STRAIGHTENS NOTHING AND BENDS EVERYTHING.
 *
 * Across a boundary the interpolated colour ramps by roughly 0.26 luma over the
 * 8 m quad, i.e. ~0.033 luma per metre. Perturbing the colour by +/-0.04 luma at
 * a few-metre scale therefore displaces each iso-line by ~1.2 m — the boundary
 * stops being a line and becomes a ragged interleaved band a few feet wide,
 * which is the brief. NOISE_AMP below is set from that arithmetic, not by eye.
 *
 * Man-made edges are untouched: roads, walls and paving are separate ribbon
 * meshes with their own materials, so this never runs on them and they stay
 * crisp.
 *
 * The channel weights make dark patches slightly cooler and light patches
 * slightly warmer, so the variation reads as damp and dry ground rather than as
 * grey dirt sprinkled over a colour.
 */
import * as THREE from 'three';

/**
 * Peak multiplicative swing of the noise, as a fraction of the base colour.
 *
 * 0.16 comes from the boundary arithmetic above: at a base luma near 0.25
 * (forest floor) it is ~0.04 luma, which buys the ~1.2 m iso-line displacement
 * that turns a straight edge into a ragged one. Pushed past ~0.25 the ground
 * starts to read as blotchy camouflage rather than as terrain.
 */
const NOISE_AMP = 0.16;

/**
 * Octave wavelengths in world metres, coarse to fine, with their weights.
 *
 * Deliberately confined to the 2.4-41 m band the existing detail map leaves
 * empty (see file header). Going finer than ~2 m would only duplicate what
 * `groundDetailTexture` already does better and more cheaply via a mipmapped
 * lookup; going coarser than ~40 m starts to fight the biome colours themselves.
 * The wavelengths are not power-of-two multiples of each other on purpose —
 * octaves at exact 2x line their lattices up and the sum shows a grid.
 */
const OCTAVES: Array<[metres: number, weight: number]> = [
  [41, 1.0],
  [17, 0.55],
  [6.5, 0.3],
  [2.4, 0.18],
];

const WEIGHT_SUM = OCTAVES.reduce((s, [, w]) => s + w, 0);

const NOISE_GLSL = /* glsl */ `
// Hash without sin(): trigonometric hashes lose precision at the world
// coordinates this runs at (thousands of metres) and band across the terrain.
float araliaTsnHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Value noise, smoothstep-interpolated. Linear interpolation here shows the
// lattice as a diamond grid, which would replace one straight-line artifact
// with another.
float araliaTsnNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = araliaTsnHash(i);
  float b = araliaTsnHash(i + vec2(1.0, 0.0));
  float c = araliaTsnHash(i + vec2(0.0, 1.0));
  float d = araliaTsnHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
`;

function fbmGlsl(): string {
  const terms = OCTAVES.map(
    ([m, w]) => `  s += ${w.toFixed(3)} * araliaTsnNoise(p / ${m.toFixed(2)});`,
  ).join('\n');
  return /* glsl */ `
float araliaTerrainFbm(vec2 p) {
  float s = 0.0;
${terms}
  // Centre on zero so the term is a perturbation, not a brightening: the mean
  // colour of the terrain must not move, or every biome shifts value.
  return s / ${WEIGHT_SUM.toFixed(3)} * 2.0 - 1.0;
}
`;
}

/**
 * Install the surface-noise term on a terrain material.
 *
 * Applied through `onBeforeCompile` rather than by swapping in a ShaderMaterial
 * so the terrain keeps every bit of MeshStandardMaterial it already relies on —
 * the detail map, the normal map, shadow receiving and the scene's lighting.
 * `customProgramCacheKey` is set because three keys compiled programs on the
 * material's defines plus this string; without it two materials that differ only
 * in their `onBeforeCompile` share one program.
 */
export function applyTerrainSurfaceNoise(shader: {
  vertexShader: string;
  fragmentShader: string;
}): void {
  shader.vertexShader = `varying vec2 vAraliaTerrainXZ;\n${shader.vertexShader}`.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
  // World XZ, not chunk-local: chunk-local coordinates restart the noise field
  // at every chunk boundary and put a visible seam on every edge — the same
  // reason the terrain UVs are built from world position.
  vAraliaTerrainXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`,
  );

  shader.fragmentShader = `varying vec2 vAraliaTerrainXZ;\n${NOISE_GLSL}${fbmGlsl()}${shader.fragmentShader}`.replace(
    '#include <color_fragment>',
    `#include <color_fragment>
  {
    // Runs AFTER color_fragment so it perturbs the finished per-vertex biome
    // colour. Running before it would be multiplied away by vColor and would
    // not move the boundary iso-lines at all.
    float araliaN = araliaTerrainFbm(vAraliaTerrainXZ);
    vec3 araliaTint = vec3(
      1.0 + araliaN * ${NOISE_AMP.toFixed(3)} * 1.15,
      1.0 + araliaN * ${NOISE_AMP.toFixed(3)},
      1.0 + araliaN * ${NOISE_AMP.toFixed(3)} * 0.75
    );
    diffuseColor.rgb *= araliaTint;
  }`,
  );
}

/** Stable cache key for the injected program variant (see applyTerrainSurfaceNoise). */
export const TERRAIN_SURFACE_NOISE_CACHE_KEY = `aralia-terrain-noise-${NOISE_AMP}-${OCTAVES.map(
  ([m, w]) => `${m}x${w}`,
).join('_')}`;

/** Exported for the unit test: the wavelength band the term covers, in metres. */
export const TERRAIN_NOISE_BAND_M: [number, number] = [
  Math.min(...OCTAVES.map(([m]) => m)),
  Math.max(...OCTAVES.map(([m]) => m)),
];

/** Re-exported so callers do not have to import THREE just to type the hook. */
export type TerrainNoiseHook = (
  shader: Parameters<NonNullable<THREE.Material['onBeforeCompile']>>[0],
) => void;
