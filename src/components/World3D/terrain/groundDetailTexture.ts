/**
 * @file groundDetailTexture.ts — procedural surface detail for the streamed
 * terrain.
 *
 * Why this exists: the terrain material binds `map` from `ForgeAssetContext`,
 * but `useForgeTexture` returns undefined whenever no asset service is present —
 * which is the case in the capture rig and in plain ground mode. So the ground
 * rendered as one flat colour per biome, with no material read at any distance
 * (BG3-parity target #1a). A generated texture removes that dependency
 * entirely: Aralia is procedural, so its ground detail should be too.
 *
 * Built as a `DataTexture` from summed value noise, the same dependency-free
 * approach `water/waterSurfaceMaterial.ts` uses for its ripple normal map.
 *
 * TWO MAPS, because they do different jobs:
 * - A **roughness/AO-ish luminance map** modulates the existing per-vertex biome
 *   colour so grass reads as grass rather than as paint. It is deliberately low
 *   contrast: the vertex colours carry the biome identity and must survive.
 * - A **normal map** gives the surface something to catch the sun, which is what
 *   actually reads as "material" at grazing angles.
 *
 * SEAMLESSNESS IS NOT OPTIONAL. The terrain UVs are world-space, so the pattern
 * repeats across the whole world; any discontinuity at the tile edge becomes a
 * visible grid over the landscape. Every octave below uses whole-number lattice
 * frequencies and wraps its lattice indices, so the tile is seamless by
 * construction rather than by blending.
 */
import * as THREE from 'three';

const SIZE = 256;

/** Deterministic hash → [0,1). Same lattice value for the same wrapped cell. */
function hash2(ix: number, iy: number, period: number, seed: number): number {
  // Wrapping the lattice index is what makes the tile seamless: the cell east of
  // the last one IS cell zero.
  const x = ((ix % period) + period) % period;
  const y = ((iy % period) + period) % period;
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smoothstep — value noise with linear interpolation shows its lattice. */
const fade = (t: number): number => t * t * (3 - 2 * t);

/** One octave of tiling value noise at `period` cells across the tile. */
function valueNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const a = hash2(ix, iy, period, seed);
  const b = hash2(ix + 1, iy, period, seed);
  const c = hash2(ix, iy + 1, period, seed);
  const d = hash2(ix + 1, iy + 1, period, seed);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

/** Summed octaves, normalized to [0,1]. */
function fbm(u: number, v: number, seed: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  // 4, 8, 16, 32 cells across the tile: broad mottling down to fine grain.
  for (let octave = 0; octave < 4; octave++) {
    const period = 4 << octave;
    sum += valueNoise(u, v, period, seed + octave * 101) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

let detailMap: THREE.DataTexture | null = null;
let normalMap: THREE.DataTexture | null = null;

function finish(tex: THREE.DataTexture): THREE.DataTexture {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Greyscale mottling to multiply against the terrain's vertex colours.
 *
 * Centred near white and deliberately shallow (±~18%). The vertex colours carry
 * biome identity — a high-contrast map here would repaint the world in grey and
 * undo the biome work.
 */
export function getGroundDetailTexture(): THREE.DataTexture {
  if (detailMap) return detailMap;
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n = fbm(x / SIZE, y / SIZE, 1337);
      const shade = 0.90 + n * 0.20; // ~0.90 .. 1.10 — biome colour must survive
      const c = Math.max(0, Math.min(255, Math.round(shade * 255)));
      const i = (y * SIZE + x) * 4;
      data[i] = c;
      data[i + 1] = c;
      data[i + 2] = c;
      data[i + 3] = 255;
    }
  }
  detailMap = finish(new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat));
  return detailMap;
}

/**
 * Matching normal map, derived from the SAME noise field so the bumps line up
 * with the mottling instead of fighting it.
 *
 * This is what makes the ground read as a surface when the sun is low: a colour
 * map alone still shades like flat paint.
 */
export function getGroundNormalTexture(): THREE.DataTexture {
  if (normalMap) return normalMap;
  const data = new Uint8Array(SIZE * SIZE * 4);
  const texel = 1 / SIZE;
  // Keep the normal NEAR-VERTICAL. First attempt built it as
  // `Vector3(-dx * 2.2, texel * 2, -dy * 2.2)` — a Y term of ~0.008 against an X
  // term of ~2.2 — so almost every normal came out nearly horizontal and the
  // ground rendered as harsh light/dark blotches, like leopard print. Y is 1
  // here and the slope term is small, the same shape the water ripple uses and
  // for the same reason: strong slopes make a surface look like crumpled foil.
  const strength = 0.5;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      // Central differences on the height field give its slope.
      const dx = fbm(u + texel, v, 1337) - fbm(u - texel, v, 1337);
      const dy = fbm(u, v + texel, 1337) - fbm(u, v - texel, 1337);
      const n = new THREE.Vector3(-dx * strength, 1, -dy * strength).normalize();
      const i = (y * SIZE + x) * 4;
      data[i] = Math.round((n.x * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((n.z * 0.5 + 0.5) * 255); // tangent-space green
      data[i + 2] = Math.round((n.y * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  normalMap = finish(new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat));
  return normalMap;
}
