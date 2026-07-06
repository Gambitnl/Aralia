/**
 * @file grassField.ts
 * @description Deterministic near-camera grass instances for the streamed 3D
 * world (beautification wave, vegetation lift). Pure: given a chunk's terrain
 * grid (positions + vertex colors) and its chunk coords, emit blade-cluster
 * instances (crossed-quad rendering happens in the component). Grass only
 * grows where the terrain vertex color reads green (grass-painted biomes), so
 * roads/rock/sand/water stay clean. Height comes from bilinear interpolation
 * of the terrain grid — blades sit ON the surface, not floating.
 *
 * Density falloff with distance is handled by the renderer only mounting
 * grass for chunks near the camera; within a chunk density is constant.
 */

export interface GrassFieldInstances {
  /** x,y,z per instance (chunk-local, y on the terrain surface). */
  positions: Float32Array;
  /** Uniform-ish scale per instance. */
  scales: Float32Array;
  /** Y rotation per instance. */
  rotations: Float32Array;
  /** r,g,b per instance — terrain color, slightly varied. */
  tints: Float32Array;
  count: number;
  cacheKey: string;
}

/**
 * Full-avalanche 3-input hash. The previous version only XORed `c` into the
 * state before a single weak mix, so streams that differed only by `c` (the
 * u vs v coordinate streams) came out affinely CORRELATED — every sample sat
 * on a handful of diagonal lines, which rendered as dotted rows marching
 * across the terrain. Each input now goes through its own multiply and the
 * result gets a proper fmix32-style avalanche.
 */
function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = (h ^ (h >>> 15)) | 0;
  h = (h + Math.imul(b ^ 0x7f4a7c15, 0xc2b2ae35)) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = (h + Math.imul(c ^ 0x94d049bb, 0x27d4eb2f)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

/**
 * Smooth seeded value noise in [0,1] over chunk-uv space (two octaves,
 * bilinear + smoothstep). Drives patchy density: clearings and thickets
 * instead of statistically flat coverage. Lattice values come from hash01 on
 * WORLD-space lattice coords so the field is continuous-ish per chunk and
 * fully deterministic from (cx, cy).
 */
function valueNoise2(u: number, v: number, salt: number, freq: number): number {
  const x = u * freq;
  const y = v * freq;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let tx = x - xi;
  let ty = y - yi;
  tx = tx * tx * (3 - 2 * tx);
  ty = ty * ty * (3 - 2 * ty);
  const v00 = hash01(xi, yi, salt);
  const v10 = hash01(xi + 1, yi, salt);
  const v01 = hash01(xi, yi + 1, salt);
  const v11 = hash01(xi + 1, yi + 1, salt);
  return (
    v00 * (1 - tx) * (1 - ty) +
    v10 * tx * (1 - ty) +
    v01 * (1 - tx) * ty +
    v11 * tx * ty
  );
}

export interface GrassFieldOptions {
  /** Candidate samples per chunk (survivors depend on green coverage). */
  samples?: number;
  /** Chunk world edge length in meters. */
  chunkSize: number;
}

export const GRASS_SAMPLES_PER_CHUNK = 2600;

/**
 * Build the grass instances for one chunk. Deterministic from (cx, cy) and the
 * terrain grid content.
 */
export function buildGrassField(
  terrain: { positions: Float32Array; colors: Float32Array },
  cx: number,
  cy: number,
  opts: GrassFieldOptions,
): GrassFieldInstances {
  const samples = opts.samples ?? GRASS_SAMPLES_PER_CHUNK;
  const S = opts.chunkSize;
  const vertCount = terrain.positions.length / 3;
  const res = Math.round(Math.sqrt(vertCount));
  const positions: number[] = [];
  const scales: number[] = [];
  const rotations: number[] = [];
  const tints: number[] = [];

  const salt = ((cx * 73856093) ^ (cy * 19349663)) | 0;

  // Stratified blue-noise-ish placement: one candidate per lattice cell,
  // jittered across the full cell, then thinned by a smooth seeded density
  // field so coverage is patchy (clearings and thickets). Mean keep rate is
  // ~0.72, so the lattice is oversized to keep survivor counts in the same
  // ballpark as the old flat sampler.
  const MEAN_KEEP = 0.72;
  const K = Math.max(1, Math.ceil(Math.sqrt(samples / MEAN_KEEP)));
  for (let n = 0; n < K * K; n++) {
    const ci = n % K;
    const cj = (n / K) | 0;
    // Full-cell jitter — decorrelated hash streams, no row structure.
    const u = (ci + hash01(n, salt, 3)) / K; // 0..1 across the chunk
    const v = (cj + hash01(n, salt, 5)) / K;

    // Patchy density: two octaves of seeded value noise, remapped so the
    // low end goes near-bald (clearings) and the high end stays dense.
    const noise =
      valueNoise2(u, v, salt ^ 0x51ab, 4) * 0.65 +
      valueNoise2(u, v, salt ^ 0x2c9d, 11) * 0.35;
    const keep = Math.min(1, Math.max(0.04, noise * 1.9 - 0.25));
    if (hash01(n, salt, 19) > keep) continue;

    // Grid-space coordinates for bilinear sampling.
    const gx = u * (res - 1);
    const gz = v * (res - 1);
    const i0 = Math.min(res - 2, Math.floor(gx));
    const j0 = Math.min(res - 2, Math.floor(gz));
    const fx = gx - i0;
    const fz = gz - j0;
    const idx00 = j0 * res + i0;
    const idx10 = idx00 + 1;
    const idx01 = idx00 + res;
    const idx11 = idx01 + 1;

    // Nearest-vertex color decides growth; must read green (grass paint).
    const nearest = (fx < 0.5 ? (fz < 0.5 ? idx00 : idx01) : (fz < 0.5 ? idx10 : idx11)) * 3;
    const r = terrain.colors[nearest];
    const g = terrain.colors[nearest + 1];
    const b = terrain.colors[nearest + 2];
    if (!(g > r * 1.04 && g > b * 1.2 && g > 0.15)) continue;

    const y =
      terrain.positions[idx00 * 3 + 1] * (1 - fx) * (1 - fz) +
      terrain.positions[idx10 * 3 + 1] * fx * (1 - fz) +
      terrain.positions[idx01 * 3 + 1] * (1 - fx) * fz +
      terrain.positions[idx11 * 3 + 1] * fx * fz;

    positions.push(u * S, y, v * S);
    // Wider height spread so a tuft reads as mixed blade lengths, not a uniform
    // brush. Blade geometry bakes a base→tip darkening gradient, so the tint
    // here is the TIP color (the base is multiplied down in the mesh).
    scales.push(0.55 + hash01(n, salt, 7) * 0.9);
    rotations.push(hash01(n, salt, 11) * Math.PI);
    // Tip tint: a lighter, faintly yellow-green highlight sampled from the
    // ground color. The blade's baked base→tip gradient (0.72 → 1.0) keeps the
    // root matched to the terrain while the tip catches this brighter green, so
    // near grass reads as sunlit grass rather than dark stubble. Green is
    // lifted slightly above ground; red gets a small warm push for the
    // sun-bleached tip; the renderer treats these floats as sRGB.
    const vary = 0.82 + hash01(n, salt, 13) * 0.18;
    const gTip = Math.min(1, g * (1.02 + hash01(n, salt, 17) * 0.16));
    tints.push(
      Math.min(1, r * (vary + 0.12)),
      gTip,
      b * vary * 0.9,
    );
  }

  return {
    positions: new Float32Array(positions),
    scales: new Float32Array(scales),
    rotations: new Float32Array(rotations),
    tints: new Float32Array(tints),
    count: positions.length / 3,
    cacheKey: `grass|${cx}|${cy}|${samples}|${vertCount}`,
  };
}
