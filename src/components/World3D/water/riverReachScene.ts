/**
 * @file riverReachScene.ts — the judged river reach as a WebGPU scene (three's
 * WebGPURenderer since 2026-09-30; it was WebGL): ground, boulders, sky, sun,
 * and the flowing water, drawn in four passes.
 *
 * THE PASSES (one frame)
 *
 *   1. Reflection: the scene without the water, from the camera mirrored in
 *      the water plane, with an oblique near plane at that plane (the three.js
 *      Reflector's clip, in WebGPU's 0..1 depth range), into a half-size
 *      target.
 *   2. Opaque: the scene without the water, into a target with a depth
 *      texture. The water reads both: the color is what it refracts, the
 *      depth gives the true path length through the water.
 *   3. Water: the opaque color is copied to the output target with its depth
 *      (so the water is depth-tested against the real scene), and the water
 *      sheet draws over it. The water is opaque: it computes its own body
 *      color from the refracted scene, so there is no blending to sort.
 *   4. Output: ACES tone map (the output pass, with the auto exposure) and
 *      sRGB (the renderer's own output step), to the canvas.
 *
 * The shadow map is drawn once: nothing in the scene moves but the water, and
 * the water casts no shadow.
 *
 * DETERMINISM. `setTime(t)` pins the water clock; the frame is then a pure
 * function of (seed, t, pose). `setTime(null)` runs it on the wall clock.
 *
 * WEBGPU (2026-09-30; Remy: "can we move this to webGPU?"). The one water
 * needs one renderer, and the FFT ocean has no WebGL path. What changed with
 * the renderer:
 *   - `init()` must finish before the first frame (the adapter and the
 *     device come asynchronously). It fails when WebGPU is missing: there is
 *     no WebGL path, and a scene on the WebGL fallback would read the depth
 *     differently (see the water material).
 *   - `render()` returns a promise. A frame that must meter the exposure
 *     waits for the meter's read-back before its output pass; a render asked
 *     for while one waits returns that frame's promise. The probes that read
 *     pixels back (`readWaterInfo`, `readClassMap`, `readSurfaceHeight`,
 *     `measureFoam`, `debugTargetSum`) and `bench` are async for the same
 *     reason: WebGPU reads back asynchronously.
 *   - The shaders are TSL node graphs (the water, the banks, the canopy, the
 *     sky and the full-screen passes), term by term from the GLSL.
 *   - The opaque pass's depth is a multisampled texture (WebGPU has no depth
 *     resolve): the copy and the water read it at sample 0.
 *   - The shadow map is drawn once, as before, but WebGPU keys it on the
 *     light (`shadow.autoUpdate`, `needsUpdate`) and draws it with the layers
 *     of the camera of the render it runs in: the prime renders with the main
 *     camera, whose layers hold the camera's copy of every plant.
 */
import * as THREE from 'three/webgpu';
import {
  acesFilmicToneMapping, clamp, dot, ivec2, max, mix, modelWorldMatrix, normalize, positionGeometry, positionLocal, positionWorld, pow,
  screenCoordinate, screenUV, select, smoothstep, transformedNormalWorld, uniform, varying, vec2, vec3, vec4,
} from 'three/tsl';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RiverReachData } from '@/systems/world3d/river/riverWorker';
import {
  boulderTopAt, courseKeyAt, mulberry32, riverBaseHalfWidthAt, riverLateralN, riverShapeKey, setRiverCourseEdit,
  setRiverShape, valueNoise, RIVER_SHAPE_DEFAULT, type Boulder, type RiverShape,
} from '@/systems/world3d/river/riverReach';
import type { RiverFlowMap } from '@/systems/world3d/river/riverFlowField';
import type { LiveBedPatch, LiveFlowSnapshot } from '@/systems/world3d/river/riverLive';
import {
  buildRiverWaterGeometry, createRiverFlowTextures, createRiverWaterMaterial, riverTexture, riverWaterGeometryFrom, type RiverWaterMaterial,
} from './riverWaterMaterial';
import { createRiverBankMaterial } from './riverBankMaterial';
import { buildRiverVegetation } from './riverVegetation';
import { RiverSurfaceMirror } from './riverSurfaceMirror';
import { RiverFloatersView } from './riverFloatersView';

/** A camera pose: position, look point, vertical field of view in degrees. */
export interface RiverPose {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
}

/**
 * THE JUDGED POSES. Each is matched to one reference frame (the camera's
 * height over the water, its pitch, and the river's place and angle in the
 * frame); the report says how close each match is.
 */
export const RIVER_POSES: Record<string, RiverPose> = {
  /**
   * Merced merced01 (4:3): high on the north bank, 21 m over the water,
   * looking west-south-west up the boulder reach at 19 degrees down; the
   * near water at the bottom, the reach running away to the upper right,
   * the forested far bank across the top.
   */
  'bank-along': { pos: [60, 24, 6], look: [10, 3, 30], fov: 42 },
  /**
   * Merced merced03 (4:3; the same boulder bed as merced01, seen steeply):
   * 15 m over the water at 33 degrees down, on the riffle at the end of the
   * boulder reach where it turns into the bend; the calm bend pool at the
   * upper left, the white water at the lower right.
   */
  'riffle-down': { pos: [100, 17, 26], look: [104, 2.5, 46], fov: 42 },
  /**
   * Nerang nerang02 (16:9): from a bridge 7 m over the pool reach, down the
   * calm water to the island, the two channels mirroring the banks' trees.
   */
  'calm-bridge': { pos: [158, 8.5, 106], look: [215, 0.5, 107], fov: 38 },
  /**
   * The stream clip (16:9): 0.9 m over a 16 cm deep run on the boulder
   * reach's margin (0.66 m/s), looking almost straight down at the stones
   * through the moving water. DIAGNOSTIC, NOT JUDGED in round 1: at this
   * range the bed stones read as flat discs and the foam as cotton wool.
   */
  'pebble-close': { pos: [60.25, 4.5, 38.55], look: [60.25, 3.6, 38.25], fov: 40 },
};

/** The light of the judged scene: a hazy late-summer afternoon. */
export const RIVER_LIGHT = {
  /**
   * Sun from the south-east, 45 degrees up: a late-morning summer sun.
   * (Round 1 had it 38 degrees up in the south-west; the bank-along camera
   * then looked into it and saw every rock's shaded side, and a judge read
   * the rocks as dark grey eggs. A sun 58 degrees up in the south lit the
   * rocks but also the whole bed, and the riffles lost their dark water
   * between the bright facets. The light belongs to the world, not to a
   * pose: one sun for every view.)
   */
  sunDir: new THREE.Vector3(0.35, 0.72, 0.6).normalize(),
  sunColor: new THREE.Color(1.0, 0.95, 0.86),
  /*
   * RIVERS ROUND 3: A BRIGHT HAZY DAY. All three clips are shot under soft
   * light: a high thin overcast (the Nerang) and a hazy canyon (the Merced),
   * with soft shadows and a pale, bright sky. Round 2's clear-sky sun left
   * the new forest's understory in black shade, and the water mirrored a
   * blue sky the clips do not have. The sun is dimmed (1.75 to 1.1), the sky
   * light raised (1.2 to 1.9) and the sky made pale; one light for every
   * view, as before.
   */
  sunIntensity: 1.1,
  skyZenith: new THREE.Color(0.66, 0.72, 0.8),
  skyHorizon: new THREE.Color(0.93, 0.94, 0.94),
  hemiSky: new THREE.Color(0.78, 0.82, 0.86),
  hemiGround: new THREE.Color(0.3, 0.29, 0.22),
  hemiIntensity: 1.9,
  /** Aerial haze: FogExp2 density per meter. At 300 m it takes 37 % of a far hillside. */
  fogDensity: 0.0023,
  exposure: 1.0,
  /** The auto exposure's target log-average luminance (see RiverReachView.meter). */
  exposureKey: 0.125,
  /**
   * THE SKY'S RADIANCE against the land it lights (rivers round 3). A bright
   * overcast sky is several times brighter than the foliage under it: in
   * both clips it clips to white, and the water mirrors it as the brightest
   * thing in the frame (the Nerang water's 90th percentile luma is 0.82).
   * Round 2's sky dome was as bright as a lit leaf, so a 5 % Fresnel
   * reflection of it was nearly black. The dome, the mirror render's sky and
   * the water's own sky fallback are all scaled by this.
   */
  skyGain: 3.4,
};

// ---------------------------------------------------------------------------
// Loading (worker + a per-viewer cache)
// ---------------------------------------------------------------------------

/** Bump when the reach, the solver or the flow map changes what they produce. */
export const RIVER_DATA_VERSION = 'r4-2026-09-28e';

const DB_NAME = 'aralia-river-cache';

function idbOpen(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('reach');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<RiverReachData | null> {
  const db = await idbOpen();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('reach', 'readonly');
      const req = tx.objectStore('reach').get(key);
      req.onsuccess = () => resolve((req.result as RiverReachData) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(key: string, value: RiverReachData): Promise<void> {
  const db = await idbOpen();
  if (!db) return;
  try {
    const tx = db.transaction('reach', 'readwrite');
    tx.objectStore('reach').put(value, key);
  } catch {
    // A cache that cannot write only means the next load computes again.
  }
}

/**
 * Load the reach's data: from this viewer's cache when a run with the same
 * seed and version is stored there, else from the worker (about 11 s). The
 * cache is a convenience only: a private window computes, and gets the same
 * field, because the run is deterministic.
 */
export async function loadRiverReachData(
  seed: number,
  onProgress?: (f: number, stage: string) => void,
  useCache = true,
  // THE SHAPE from the river scene's panel (Remy, 2026-09-28). Each shape has
  // its own cache entry; the default keeps the judged field's old key.
  shape: RiverShape = RIVER_SHAPE_DEFAULT,
): Promise<{ data: RiverReachData; cached: boolean }> {
  const sk = riverShapeKey(shape);
  const key = sk ? `${RIVER_DATA_VERSION}:${seed}:${sk}` : `${RIVER_DATA_VERSION}:${seed}`;
  if (useCache) {
    const hit = await idbGet(key);
    if (hit && hit.t0 && hit.grid) return { data: hit, cached: true };
  }
  const data = await new Promise<RiverReachData>((resolve, reject) => {
    const worker = new Worker(new URL('../../../systems/world3d/river/riverWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; f?: number; stage?: string; data?: RiverReachData; message?: string };
      if (m.type === 'progress') onProgress?.(m.f ?? 0, m.stage ?? '');
      else if (m.type === 'done' && m.data) { worker.terminate(); resolve(m.data); }
      else if (m.type === 'error') { worker.terminate(); reject(new Error(m.message)); }
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(`[river] The flow worker failed: ${e.message}`)); };
    worker.postMessage({ seed, shape });
  });
  if (useCache) await idbPut(key, data);
  return { data, cached: false };
}

/**
 * THE LIVE RIVER's warm start: this viewer's cached steady field of the judged
 * river, or null (then the live solver starts from the design level). It only
 * reads the cache; it never solves.
 */
export async function readCachedRiverReachData(seed: number): Promise<RiverReachData | null> {
  const hit = await idbGet(`${RIVER_DATA_VERSION}:${seed}`);
  return hit && hit.t0 && hit.grid ? hit : null;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function flowMapOf(d: RiverReachData): RiverFlowMap {
  return { grid: d.grid, t0: d.t0, t1: d.t1, t2: d.t2, surface: d.surface, stats: d.mapStats };
}

/**
 * THE GROUND: the solver grid's cells as vertices (0.5 m), and the outer
 * valley on its 2 m lattice. The outer mesh skips its quads inside the solver
 * grid and sinks its vertices inside the grid's edge band by up to 0.3 m, so
 * the fine mesh always wins where the two overlap and no crack opens at the
 * seam. Normals from central differences of the heights.
 */
function buildGround(d: RiverReachData): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const { nx, nz, dx, x0, z0 } = d.grid;
  {
    const pos = new Float32Array(nx * nz * 3);
    const nor = new Float32Array(nx * nz * 3);
    const H = d.ground;
    for (let j = 0; j < nz; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = j * nx + i;
        pos[c * 3] = x0 + (i + 0.5) * dx;
        pos[c * 3 + 1] = H[c];
        pos[c * 3 + 2] = z0 + (j + 0.5) * dx;
        const hl = H[j * nx + Math.max(0, i - 1)];
        const hr = H[j * nx + Math.min(nx - 1, i + 1)];
        const hd = H[Math.max(0, j - 1) * nx + i];
        const hu = H[Math.min(nz - 1, j + 1) * nx + i];
        const gx = (hr - hl) / (2 * dx);
        const gz = (hu - hd) / (2 * dx);
        const l = Math.hypot(gx, 1, gz);
        nor[c * 3] = -gx / l;
        nor[c * 3 + 1] = 1 / l;
        nor[c * 3 + 2] = -gz / l;
      }
    }
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let k = 0;
    for (let j = 0; j < nz - 1; j += 1) {
      for (let i = 0; i < nx - 1; i += 1) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const e = c + 1;
        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = e;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(nx * nz), 1));
    g.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(nx * nz), 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    out.push(g);
  }
  {
    const o = d.outer;
    const gx0 = x0;
    const gx1 = x0 + nx * dx;
    const gz0 = z0;
    const gz1 = z0 + nz * dx;
    const pos = new Float32Array(o.nx * o.nz * 3);
    const nor = new Float32Array(o.nx * o.nz * 3);
    const H = o.heights;
    const band = 2 * o.step;
    for (let j = 0; j < o.nz; j += 1) {
      for (let i = 0; i < o.nx; i += 1) {
        const c = j * o.nx + i;
        const x = o.x0 + i * o.step;
        const z = o.z0 + j * o.step;
        const inside = Math.min(x - gx0, gx1 - x, z - gz0, gz1 - z);
        const sink = inside > 0 ? 0.3 * Math.min(1, inside / band) : 0;
        pos[c * 3] = x;
        pos[c * 3 + 1] = H[c] - sink;
        pos[c * 3 + 2] = z;
        const hl = H[j * o.nx + Math.max(0, i - 1)];
        const hr = H[j * o.nx + Math.min(o.nx - 1, i + 1)];
        const hd = H[Math.max(0, j - 1) * o.nx + i];
        const hu = H[Math.min(o.nz - 1, j + 1) * o.nx + i];
        const ggx = (hr - hl) / (2 * o.step);
        const ggz = (hu - hd) / (2 * o.step);
        const l = Math.hypot(ggx, 1, ggz);
        nor[c * 3] = -ggx / l;
        nor[c * 3 + 1] = 1 / l;
        nor[c * 3 + 2] = -ggz / l;
      }
    }
    const tri: number[] = [];
    for (let j = 0; j < o.nz - 1; j += 1) {
      for (let i = 0; i < o.nx - 1; i += 1) {
        const qx0 = o.x0 + i * o.step;
        const qz0 = o.z0 + j * o.step;
        // Skip a quad lying wholly inside the grid, past its edge band.
        if (qx0 > gx0 + band && qx0 + o.step < gx1 - band && qz0 > gz0 + band && qz0 + o.step < gz1 - band) continue;
        const a = j * o.nx + i;
        const b = a + 1;
        const c = a + o.nx;
        const e = c + 1;
        tri.push(a, c, b, b, c, e);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(o.nx * o.nz), 1));
    g.setAttribute('aTone', new THREE.BufferAttribute(new Float32Array(o.nx * o.nz), 1));
    g.setIndex(tri);
    g.computeBoundingSphere();
    out.push(g);
  }
  return out;
}

/**
 * SPLIT A MESH INTO SPATIAL TILES (rivers round 4): each triangle goes to the
 * tile of its centroid (`tileM` meters square in x and z), and each tile is
 * its own geometry with only its own vertices. One mesh over the whole reach
 * (the ground, the 2,600 rocks) was drawn whole in both passes, even the part
 * behind the camera; tiles let three.js's own frustum test skip them. The
 * triangles, their vertices and their order within a tile do not change, so
 * the drawn image does not either.
 */
function splitByTiles(
  g: THREE.BufferGeometry,
  tileM: number,
  // THE LIVE RIVER (2026-09-29): told of each tile's vertices (its index in
  // the result, the vertex's index in the tile and in the source), so an edit
  // can move a source vertex in every tile that holds it. It changes nothing.
  record?: (tile: number, local: number, global: number) => void,
): THREE.BufferGeometry[] {
  const index = g.index;
  if (!index) return [g];
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const names = Object.keys(g.attributes);
  const idx = index.array as ArrayLike<number>;
  const tiles = new Map<string, number[]>();
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t];
    const b = idx[t + 1];
    const c = idx[t + 2];
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    const key = `${Math.floor(cx / tileM)},${Math.floor(cz / tileM)}`;
    let list = tiles.get(key);
    if (!list) { list = []; tiles.set(key, list); }
    list.push(a, b, c);
  }
  const out: THREE.BufferGeometry[] = [];
  for (const list of tiles.values()) {
    const remap = new Map<number, number>();
    const order: number[] = [];
    const ni = new Uint32Array(list.length);
    for (let k = 0; k < list.length; k += 1) {
      let v = remap.get(list[k]);
      if (v === undefined) { v = order.length; remap.set(list[k], v); order.push(list[k]); }
      ni[k] = v;
    }
    const tg = new THREE.BufferGeometry();
    for (const name of names) {
      const src = g.getAttribute(name) as THREE.BufferAttribute;
      const n = src.itemSize;
      const arr = new Float32Array(order.length * n);
      for (let k = 0; k < order.length; k += 1) {
        for (let q = 0; q < n; q += 1) arr[k * n + q] = src.array[order[k] * n + q] as number;
      }
      tg.setAttribute(name, new THREE.BufferAttribute(arr, n));
    }
    tg.setIndex(new THREE.BufferAttribute(ni, 1));
    tg.computeBoundingSphere();
    if (record) for (let k = 0; k < order.length; k += 1) record(out.length, k, order[k]);
    out.push(tg);
  }
  g.dispose();
  return out;
}

/**
 * THE LIVE RIVER: where each source vertex went when a mesh was split into
 * tiles (see splitByTiles' `record`), as lists per source vertex: vertex g's
 * copies are (tile[q], local[q]) for q in start[g] .. start[g + 1].
 */
class TileMap {
  readonly start: Int32Array;
  readonly tile: Int32Array;
  readonly local: Int32Array;
  constructor(nGlobal: number, t: number[], l: number[], gl: number[]) {
    const start = new Int32Array(nGlobal + 1);
    for (const g of gl) start[g + 1] += 1;
    for (let k = 1; k <= nGlobal; k += 1) start[k] += start[k - 1];
    const fill = start.slice(0, nGlobal);
    this.tile = new Int32Array(gl.length);
    this.local = new Int32Array(gl.length);
    for (let q = 0; q < gl.length; q += 1) {
      const at = fill[gl[q]];
      this.tile[at] = t[q];
      this.local[at] = l[q];
      fill[gl[q]] = at + 1;
    }
    this.start = start;
  }
}

/** A recorder for splitByTiles and the lists it fills. */
function tileRecorder(): { rec: (t: number, l: number, g: number) => void; t: number[]; l: number[]; g: number[] } {
  const t: number[] = [];
  const l: number[] = [];
  const g: number[] = [];
  return { rec: (a, b, c) => { t.push(a); l.push(b); g.push(c); }, t, l, g };
}

/**
 * THE BOULDERS: one merged mesh. Each is an icosphere (detail 3, 642
 * vertices after the seams are welded) scaled to its ellipsoid, with a seeded
 * bump of up to +-19 % so no two read alike. The flow map runs the water on
 * over every rock's footprint, so where the drawn rock is lower than the
 * solver's ellipsoid the water covers it, and where it is higher it hides the
 * water. The lower half is squashed toward the bed, as a rock settled in
 * gravel is.
 *
 * WELDED FIRST: three.js builds an icosphere with a separate vertex per face
 * corner, and round 1's rocks came out faceted like cut gems (flat normals).
 */
function buildBoulders(list: Boulder[], ranges?: Int32Array): THREE.BufferGeometry {
  // TWO DETAIL LEVELS (rivers round 4): the low-water rock field brought the
  // count to about 2,600 rocks, and detail 3 for all of them (642 vertices
  // each) was 3.3 million triangles. A rock under 0.8 m of radius takes
  // detail 2 (162 vertices): at the judged distances its outline is under 40
  // pixels, and its cleavage planes and bumps still read.
  const makeBase = (detail: number): { bp: THREE.BufferAttribute; bi: number[] | null; geo: THREE.BufferGeometry } => {
    const raw = new THREE.IcosahedronGeometry(1, detail);
    raw.deleteAttribute('normal');
    raw.deleteAttribute('uv');
    const geo = mergeVertices(raw, 1e-4);
    raw.dispose();
    return { bp: geo.getAttribute('position') as THREE.BufferAttribute, bi: geo.index ? Array.from(geo.index.array as ArrayLike<number>) : null, geo };
  };
  const hi = makeBase(3);
  const lo = makeBase(2);
  const baseOf = (B: Boulder) => (Math.max(B.rx, B.rz) >= 0.8 ? hi : lo);
  let totalV = 0;
  for (const B of list) totalV += baseOf(B).bp.count;
  const pos = new Float32Array(totalV * 3);
  const kind = new Float32Array(totalV).fill(1);
  const tone = new Float32Array(totalV);
  const idx: number[] = [];
  const v = new THREE.Vector3();
  let vOff = 0;
  for (let b = 0; b < list.length; b += 1) {
    const B = list[b];
    const { bp, bi } = baseOf(B);
    const vCount = bp.count;
    const cos = Math.cos(B.rot);
    const sin = Math.sin(B.rot);
    const tn = ((B.seed >>> 7) % 1000) / 1000;
    // Some rocks are cut flat on top (a split granite block), most are round.
    const flatTop = ((B.seed >>> 3) % 5) === 0 ? 0.55 : 1.0;
    // CLEAVAGE PLANES (rivers round 2): three to five planes per rock, each
    // at 0.55 to 0.85 of the radius, cut its dome into flat faces with
    // rounded edges, the way granite splits along joints. Three judges read
    // round 1's rocks as "smooth, near-identical grey eggs".
    const rr = mulberry32(B.seed ^ 0x2c1b);
    const cuts: Array<[number, number, number, number]> = [];
    // (Round 3: 4 to 7 planes at 0.45 to 0.8 of the radius; round 2's 3 to
    // 5 soft cuts still read as "smooth, near-identical grey lozenges".)
    const nCuts = 4 + Math.floor(rr() * 4);
    for (let c = 0; c < nCuts; c += 1) {
      const th = rr() * Math.PI * 2;
      const ph = Math.acos(rr() * 1.6 - 0.6);
      cuts.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th), 0.45 + 0.35 * rr()]);
    }
    for (let k = 0; k < vCount; k += 1) {
      v.fromBufferAttribute(bp, k);
      for (const [cx, cy, cz, cd] of cuts) {
        const dp = v.x * cx + v.y * cy + v.z * cz;
        if (dp > cd) {
          // Pull the point back onto the plane, softly (0.2 of the excess
          // stays, so the edge rounds instead of creasing).
          const back = (dp - cd) * 0.92;
          v.x -= cx * back;
          v.y -= cy * back;
          v.z -= cz * back;
        }
      }
      const bump = 1 + 0.14 * valueNoise(v.x * 1.4 + B.seed % 97, v.z * 1.4 + v.y * 1.2, B.seed & 0xffff)
        + 0.05 * valueNoise(v.x * 4.5 + v.y * 2.5, v.z * 4.5, (B.seed >> 3) & 0xffff);
      let lx = v.x * B.rx * bump;
      let ly = v.y * B.ry * bump;
      let lz = v.z * B.rz * bump;
      if (ly < 0) ly *= 0.6;
      else if (ly > B.ry * flatTop) ly = B.ry * flatTop + (ly - B.ry * flatTop) * 0.15;
      tone[vOff + k] = tn;
      const wx = lx * cos - lz * sin;
      const wz = lx * sin + lz * cos;
      lx = wx;
      lz = wz;
      const o = (vOff + k) * 3;
      pos[o] = B.x + lx;
      pos[o + 1] = B.y + ly;
      pos[o + 2] = B.z + lz;
    }
    if (bi) for (const i of bi) idx.push(vOff + i);
    // THE LIVE RIVER: where each rock's vertices start (an edit moves a rock
    // as a whole). It changes nothing.
    if (ranges) ranges[b] = vOff;
    vOff += vCount;
  }
  if (ranges) ranges[list.length] = vOff;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  g.setAttribute('aTone', new THREE.BufferAttribute(tone, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  hi.geo.dispose();
  lo.geo.dispose();
  return g;
}

/**
 * THE SMALL ROCKS: 6,000 stones of 0.1 to 0.7 m radius on the beds, bars and
 * dry banks of the boulder reach, the bend and the riffle (the Merced banks
 * are rock fields), as one instanced mesh with a tone per stone.
 * They are UNDER the solver's 0.5 m cell, so they are drawn only: the flow
 * does not turn around them (a 0.3 m stone in 0.5 m cells is a bump the
 * solver cannot resolve), and none is placed where a boulder already stands.
 * The Merced reads as a dense field of rocks, and 150 boulders alone read as
 * a few loaves in a clear stream (round 5).
 */
function buildSmallRocks(
  d: RiverReachData,
  groundAt: (x: number, z: number) => number,
  mixed = false,
  // THE LIVE RIVER: each stone's place, five numbers (its 1 m course index,
  // its offset n, its two jitters and how deep it sits), so an edit can move
  // it with the channel. It changes nothing.
  rec?: number[],
): THREE.InstancedMesh {
  const raw = new THREE.IcosahedronGeometry(1, 1);
  raw.deleteAttribute('normal');
  raw.deleteAttribute('uv');
  const g = mergeVertices(raw, 1e-4);
  raw.dispose();
  const gp = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let k = 0; k < gp.count; k += 1) {
    v.fromBufferAttribute(gp, k);
    const b = 1 + 0.18 * valueNoise(v.x * 1.7 + 3.1, v.z * 1.7 + v.y * 1.3, 17);
    gp.setXYZ(k, v.x * b, v.y * b * (v.y < 0 ? 0.5 : 0.8), v.z * b);
  }
  g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(gp.count).fill(1), 1));
  g.computeVertexNormals();
  const tones: number[] = [];
  const rnd = mulberry32(d.seed ^ (mixed ? 0x7c3d : 0x51ab));
  const mats: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let tries = 0; tries < 36000 && mats.length < 7500; tries += 1) {
    // Along the course from s = -60 to 170 (the boulder reach, bend, riffle),
    // and from the 6,000th stone on, the pool reach's margins (s = 170 to
    // 280; rivers round 2: its banks read as bare concrete).
    const pool = mats.length >= 6000;
    const sIdx = pool ? Math.floor(170 + rnd() * 110 + 120) : Math.floor((rnd() * 230 - 60 + 120));
    const k = Math.max(0, Math.min(d.course.length / 5 - 1, sIdx)) * 5;
    const cx = d.course[k];
    const cz = d.course[k + 1];
    const tx = d.course[k + 3];
    const tz = d.course[k + 4];
    const key = courseKeyAt(d.course[k + 2]);
    const n = pool ? (rnd() < 0.5 ? -1 : 1) * (key.halfW * (0.75 + 0.45 * rnd())) : (rnd() * 2 - 1) * (key.halfW + 11);
    const jx = rnd() - 0.5;
    const x = cx + tz * n + jx;
    const jz = rnd() - 0.5;
    const z = cz - tx * n + jz;
    if (boulderTop(d.boulders, x, z) > -Infinity) continue;
    const u = rnd();
    // Bigger stones on the dry bank than in the bed: a flood leaves the big
    // ones on the bars.
    const dryBank = Math.abs(n) > key.halfW ? 1 : 0;
    let r = 0.1 + (0.3 + 0.3 * dryBank) * u * u * u;
    if (mixed) {
      // V4 (rivers round 5): MIXED SIZES IN CLUSTERS. The stones lie in
      // patches (a 6 m noise: gravel bars, cobble lags, sand between), and
      // their sizes run log-uniform from 4 cm to 45 cm, so no two stretches
      // show the same even spread of ovals.
      const patch = valueNoise(x * 0.17, z * 0.17, d.seed & 0xffff);
      if (rnd() > patch * patch * 1.6) continue;
      r = 0.04 * Math.pow(0.45 / 0.04, rnd() * rnd());
    }
    const sink = r * (0.15 + 0.25 * rnd());
    const y = groundAt(x, z) - sink;
    e.set((rnd() - 0.5) * 0.6, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.6);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r * (0.8 + 0.5 * rnd()), r, r * (0.8 + 0.5 * rnd())));
    mats.push(m.clone());
    tones.push(rnd());
    if (rec) rec.push(k / 5, n, jx, jz, sink);
  }
  // The tone rides per instance (the vertex shader reads aTone either way).
  g.setAttribute('aTone', new THREE.InstancedBufferAttribute(Float32Array.from(tones), 1));
  // The material is set by the caller (the shared bank material).
  const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial(), mats.length);
  mats.forEach((mm, i) => im.setMatrixAt(i, mm));
  im.computeBoundingSphere();
  return im;
}

// ---------------------------------------------------------------------------
// Full-screen passes and the sky (TSL node materials since the WebGPU port,
// 2026-09-30; the GLSL they replace is quoted in each one's note)
// ---------------------------------------------------------------------------

/** A TSL node expression (see riverWaterMaterial.ts). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TslNode = any;

/**
 * THE SKY LIGHT ON THE SHADED NORMAL, IN ONE SPACE (2026-09-30). three
 * 0.172's hemisphere light node has two faults WebGL's light did not:
 *   - it weighs the sky and the ground by the plain vertex normal
 *     (`normalView`), where WebGL used the shaded normal (its
 *     `geometryNormal`: the stone bump, and flipped on a double-sided card's
 *     back face), so a leaf or a grass blade seen from below took the sky's
 *     light instead of the ground's;
 *   - it dots that view-space normal with the light's WORLD position as a
 *     direction, so the weight turned with the camera (a gray sphere under
 *     the river's lights drew 5 to 7 % darker than in WebGL; a flat plane
 *     under a 34-degree camera, 1 %).
 * This node is three's with the shaded normal in world space
 * (`transformedNormalWorld`) against the light's world direction. The
 * scene's hemisphere light is of the class below, and the view registers the
 * pair on its own renderer's node library (`init`), so no other page changes.
 */
export class RiverHemisphereLight extends THREE.HemisphereLight {}

// (three 0.172's node API, typed here: @types/three is 0.182's.)
const HemisphereLightNodeBase = THREE.HemisphereLightNode as unknown as new (light?: THREE.HemisphereLight) => {
  colorNode: TslNode;
  groundColorNode: TslNode;
  lightDirectionNode: TslNode;
};
class RiverHemisphereLightNode extends HemisphereLightNodeBase {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setup(builder: any): void {
    const dotNL = transformedNormalWorld.dot(this.lightDirectionNode);
    const hemiDiffuseWeight = dotNL.mul(0.5).add(0.5);
    const irradiance = mix(this.groundColorNode, this.colorNode, hemiDiffuseWeight);
    builder.context.irradiance.addAssign(irradiance);
  }
}

/**
 * A full-screen quad's vertex: its own corners, no camera (the GLSL's
 * QUAD_VERT). It reads the raw attribute: three 0.172's positionLocal is a
 * varying, and a varying read only in a custom vertex node breaks its WGSL
 * build.
 */
const quadVertex = (): TslNode => vec4(positionGeometry.xy, 0.0, 1.0);

/**
 * COPY COLOR AND DEPTH, so the water pass depth-tests against the real scene
 * (the GLSL's COPY_FRAG: the color at the pixel, and the depth written as the
 * fragment's). The depth is the opaque pass's multisampled depth at the
 * pixel, sample 0: WebGPU has no depth resolve (the WebGL build copied the
 * blit of its MSAA target).
 */
function createCopyPass(): { material: THREE.NodeMaterial; color: TslNode; depth: TslNode } {
  const color = riverTexture(new THREE.Texture());
  const depth = riverTexture(new THREE.DepthTexture(1, 1));
  const m = new THREE.NodeMaterial();
  m.name = 'river copy';
  m.vertexNode = quadVertex();
  m.fragmentNode = color.sample(screenUV);
  // (A load, no sampler: r172 has no .load(); a sample with the sampler off.)
  m.depthNode = depth.sample(ivec2(screenCoordinate.xy)).setSampler(false);
  m.depthTest = true;
  m.depthWrite = true;
  m.depthFunc = THREE.AlwaysDepth;
  m.fog = false;
  m.lights = false;
  return { material: m, color, depth };
}

/**
 * THE OUTPUT PASS: the ACES tone map with the auto exposure (the GLSL's
 * OUT_FRAG took both the tone map and the sRGB encoding from the renderer).
 * The renderer's own output step then encodes sRGB; its tone mapping is off,
 * so the edit handles, drawn after with `toneMapped` false, get sRGB only, as
 * they did in WebGL.
 */
function createOutPass(): { material: THREE.NodeMaterial; color: TslNode; exposure: TslNode } {
  const color = riverTexture(new THREE.Texture());
  const exposure = uniform(1);
  const m = new THREE.NodeMaterial();
  m.name = 'river output';
  m.vertexNode = quadVertex();
  const c = color.sample(screenUV);
  m.fragmentNode = vec4(acesFilmicToneMapping(c.rgb, exposure), c.a);
  m.depthTest = false;
  m.depthWrite = false;
  m.fog = false;
  m.lights = false;
  return { material: m, color, exposure };
}

/** A plain copy of a texture into the target (the mirror into its mip chain). */
function createBlitPass(): { material: THREE.NodeMaterial; color: TslNode } {
  const color = riverTexture(new THREE.Texture());
  const m = new THREE.NodeMaterial();
  m.name = 'river mirror copy';
  m.vertexNode = quadVertex();
  m.fragmentNode = color.sample(screenUV);
  m.depthTest = false;
  m.depthWrite = false;
  m.fog = false;
  m.lights = false;
  return { material: m, color };
}

/**
 * THE METER'S PASS (rivers round 3): a 4 x 4 box of taps per meter cell, so a
 * 48 x 27 grid reads the whole frame, not 1,296 single pixels. (WebGPU's uv
 * runs down; the taps are symmetric, so the grid reads the same cells.)
 */
function createMeterPass(): { material: THREE.NodeMaterial; color: TslNode } {
  const color = riverTexture(new THREE.Texture());
  const m = new THREE.NodeMaterial();
  m.name = 'river meter';
  m.vertexNode = quadVertex();
  let acc: TslNode = vec3(0, 0, 0);
  for (let j = 0; j < 4; j += 1) {
    for (let i = 0; i < 4; i += 1) {
      acc = acc.add(color.sample(screenUV.add(vec2((i - 1.5) / (48.0 * 4.0), (j - 1.5) / (27.0 * 4.0)))).rgb);
    }
  }
  m.fragmentNode = vec4(acc.div(16.0), 1.0);
  m.depthTest = false;
  m.depthWrite = false;
  m.fog = false;
  m.lights = false;
  return { material: m, color };
}

/**
 * THE SKY DOME'S MATERIAL (the GLSL's SKY_VERT and SKY_FRAG): the pale sky
 * gradient, its radiance gain, the sun's glow and disk, and the ground side.
 * The WebGL build drew the dome at the far plane (xyww); it is drawn first,
 * with no depth write, into a cleared target, so its depth changes nothing.
 */
function createSkyMaterial(L: typeof RIVER_LIGHT): { material: THREE.NodeMaterial; u: Record<string, TslNode> } {
  const u = {
    uSunDir: uniform(L.sunDir),
    uSunColor: uniform(new THREE.Color(L.sunColor).multiplyScalar(L.sunIntensity)),
    uZenith: uniform(L.skyZenith),
    uHorizon: uniform(L.skyHorizon),
    uSunDisk: uniform(1),
    uSkyGain: uniform(L.skyGain),
  };
  const vDir = varying(normalize(modelWorldMatrix.mul(vec4(positionLocal, 0.0)).xyz));
  const d = normalize(vDir);
  const up = clamp(d.y, 0.0, 1.0);
  const sd = max(dot(d, u.uSunDir), 0.0);
  const lit = mix(u.uHorizon, u.uZenith, pow(up, 0.5)).mul(u.uSkyGain)
    .add(u.uSunColor.mul(pow(sd, 12.0).mul(0.12).add(pow(sd, 400.0).mul(6.0).mul(u.uSunDisk))));
  const c = select(d.y.lessThan(0.0), mix(u.uHorizon, u.uHorizon.mul(0.8), smoothstep(0.0, -0.3, d.y)), lit);
  const m = new THREE.NodeMaterial();
  m.name = 'river sky';
  m.fragmentNode = vec4(c, 1.0);
  m.side = THREE.BackSide;
  m.depthWrite = false;
  m.fog = false;
  m.lights = false;
  return { material: m, u };
}

export type RiverAblatePart = 'water' | 'reflection' | 'caustics';

/** Bilinear read of a row-major grid at fractional cell coordinates. */
function bilinear(a: Float32Array, nx: number, nz: number, fx: number, fz: number): number {
  const x = Math.max(0, Math.min(nx - 1.001, fx));
  const z = Math.max(0, Math.min(nz - 1.001, fz));
  const i = Math.floor(x);
  const j = Math.floor(z);
  const tx = x - i;
  const tz = z - j;
  const p = a[j * nx + i] + (a[j * nx + i + 1] - a[j * nx + i]) * tx;
  const q = a[(j + 1) * nx + i] + (a[(j + 1) * nx + i + 1] - a[(j + 1) * nx + i]) * tx;
  return p + (q - p) * tz;
}

/** The ground and water samplers of a reach's data, for placing things on it. */
export function riverSamplers(d: RiverReachData): {
  groundAt: (x: number, z: number) => number;
  levelAt: (x: number, z: number) => number;
  courseDistAt: (x: number, z: number) => number;
  courseSNAt: (x: number, z: number) => { s: number; n: number };
} {
  const { nx, nz, dx, x0, z0 } = d.grid;
  const level = new Float32Array(nx * nz);
  for (let c = 0; c < nx * nz; c += 1) level[c] = d.t0[c * 4 + 3];
  const inGrid = (x: number, z: number): boolean => x > x0 + dx && x < x0 + (nx - 1) * dx && z > z0 + dx && z < z0 + (nz - 1) * dx;
  const o = d.outer;
  return {
    groundAt: (x, z) => (inGrid(x, z)
      ? bilinear(d.ground, nx, nz, (x - x0) / dx - 0.5, (z - z0) / dx - 0.5)
      : bilinear(o.heights, o.nx, o.nz, (x - o.x0) / o.step, (z - o.z0) / o.step)),
    levelAt: (x, z) => (inGrid(x, z) ? bilinear(level, nx, nz, (x - x0) / dx - 0.5, (z - z0) / dx - 0.5) : -100),
    courseDistAt: (x, z) => {
      let best = Infinity;
      for (let k = 0; k < d.course.length; k += 5) {
        const e = (d.course[k] - x) ** 2 + (d.course[k + 1] - z) ** 2;
        if (e < best) best = e;
      }
      return Math.sqrt(best);
    },
    courseSNAt: (x, z) => {
      let best = Infinity;
      let bk = 0;
      for (let k = 0; k < d.course.length; k += 5) {
        const e = (d.course[k] - x) ** 2 + (d.course[k + 1] - z) ** 2;
        if (e < best) { best = e; bk = k; }
      }
      const c = d.course;
      const ddx = x - c[bk];
      const ddz = z - c[bk + 1];
      return { s: c[bk + 2] + ddx * c[bk + 3] + ddz * c[bk + 4], n: ddx * c[bk + 4] - ddz * c[bk + 3] };
    },
  };
}

/**
 * PER-POSE VEGETATION CULLING AND THE MIRROR'S STAND-INS (rivers round 4).
 * Round 3's reflection pass redrew all 8.9 million triangles of vegetation
 * (the water cost 7.0 to 7.6 ms a frame). Each instanced vegetation mesh is
 * now split in three: the CAMERA's copy (layer 1), the MIRROR's near copy
 * (layer 2, the full tree) and the MIRROR's far copy (layer 2, the stand-in
 * geometry of `userData.lite`: every second leaf card at sqrt(2) times its
 * size, each where it was). Whenever the camera
 * moves, each copy is filled with only the instances whose bounding sphere
 * meets its own camera's frustum (the view's, or the mirrored view's), and
 * the mirror takes the stand-in past `RIVER_MIRROR_LITE_M` from the mirrored
 * eye. Culling by the frustum drops only what that camera cannot see, so the
 * camera's own image does not change; the stand-ins change only the far
 * trees in the rippled, half-size mirror. The shadow map is drawn once, with
 * every instance, before the first split (`primeShadows`).
 */
const LAYER_CAM = 1;
const LAYER_MIRROR = 2;
/**
 * Past this distance from the mirrored eye, the mirror draws a tree's
 * stand-in, m. (At 35 m the calm-bridge water's median luma fell by 0.03 and
 * 7 % of its pixels moved by over 8/255; at 100 m, 0.006 and 1.5 %: the
 * far crowns in a rippled, half-size mirror.)
 */
export const RIVER_MIRROR_LITE_M = 100;
/**
 * How fast a free camera's mirror plane may move toward the water it looks
 * at, m/s. A real change of water body (a pool 1.5 m below a raised stretch)
 * then takes under a second of camera motion, and never pops in one frame.
 */
export const RIVER_MIRROR_PLANE_RATE_M_PER_S = 2;

/**
 * How many instances a plant copy draws (WebGPU: its own geometry's
 * `instanceCount`; its `count` stays the capacity, see buildVegSets).
 */
function drawCount(im: THREE.InstancedMesh, n: number): void {
  (im.geometry as THREE.InstancedBufferGeometry).instanceCount = n;
}

interface VegSet {
  /** The camera's copy (the original mesh, layer 1). */
  mesh: THREE.InstancedMesh;
  /** The mirror's near copy (full geometry, layer 2). */
  refl: THREE.InstancedMesh;
  /** The mirror's far copy (stand-in geometry, layer 2), or none. */
  lite: THREE.InstancedMesh | null;
  /** Every instance's matrix and color, as built. */
  mats: Float32Array;
  cols: Float32Array | null;
  /** Per instance: bounding-sphere center x, y, z and radius, m. */
  sph: Float32Array;
  n: number;
  /** Triangles of one instance, full and stand-in. */
  tris: number;
  liteTris: number;
}

/** The judged scene: construct it on a canvas with the reach's data. */
export class RiverReachView {
  readonly renderer: THREE.WebGPURenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly data: RiverReachData;
  frames = 0;
  /** What the vegetation holds: instances per variant and triangles. */
  vegetation: { counts: Record<string, number>; triangles: number } = { counts: {}, triangles: 0 };
  /** Pinned water time, s, or null for the wall clock. */
  pinnedTime: number | null = null;
  reflPlaneY = 1.3;
  /** When `mirrorPlaneFromCamera` last eased the plane, ms, or null before its first call. */
  private planeEaseAt: number | null = null;
  /** Which target the output pass shows: 0 = the frame, 1 = the opaque pass, 2 = the reflection. */
  showTarget = 0;

  private readonly scene = new THREE.Scene();
  private readonly skyScene = new THREE.Scene();
  private readonly waterScene = new THREE.Scene();
  private readonly reflCam = new THREE.PerspectiveCamera();
  private readonly quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quadScene = new THREE.Scene();
  private readonly quad: THREE.Mesh;
  private readonly copyQ: ReturnType<typeof createCopyPass>;
  private readonly outQ: ReturnType<typeof createOutPass>;
  private readonly meterQ: ReturnType<typeof createMeterPass>;
  private readonly waterMat: RiverWaterMaterial;
  private readonly bankMat: THREE.MeshStandardNodeMaterial;
  private readonly sky: THREE.Mesh;
  /** The sky dome's uniforms (the reflection pass turns its sun disk off). */
  private readonly skyU: Record<string, TslNode>;
  private readonly water: THREE.Mesh;
  /** The sun (its shadow map is drawn once; see `primeShadows`). */
  private readonly sun: THREE.DirectionalLight;
  private sceneRT: THREE.RenderTarget;
  private finalRT: THREE.RenderTarget;
  private reflRT: THREE.RenderTarget;
  /**
   * The mirror with its mip chain (WebGPU, 2026-09-30): an MSAA texture has
   * one mip level only, so the mirror renders into `reflRT` (MSAA) and a copy
   * pass fills this target, whose mips are built after each copy. The water
   * reads this one. (WebGL resolved the MSAA mirror into a mipmapped texture
   * and built the chain in one target.)
   */
  private reflMipRT: THREE.RenderTarget;
  private readonly blitQ: ReturnType<typeof createBlitPass>;
  private readonly reflMatrix = new THREE.Matrix4();
  private readonly t0 = performance.now();
  private width = 1;
  private height = 1;
  private readonly off: Record<RiverAblatePart, boolean> = { water: false, reflection: false, caustics: false };
  private vegGroup: THREE.Object3D | null = null;
  /** The drawn surface on the CPU (rivers round 4), and the paper boat and the ducks on it. */
  readonly mirror: RiverSurfaceMirror;
  floaters: RiverFloatersView;
  /** The floaters drawn and moving; off unless the page turns them on (never in a capture by default). */
  floatersOn = false;
  private vegSets: VegSet[] = [];
  /** Rivers round 5: the round-4 small stones and the V4 mixed ones. */
  private stonesR4: THREE.InstancedMesh | null = null;
  private stonesMixed: THREE.InstancedMesh | null = null;
  /** The variant tunes now (see `setTunes`). */
  tunes = { slab: 0, v1: 0, v2: 0, v3: 0, v4: 0 };
  private cullKey = '';
  /** Measurement switches (rivers round 4): per-pose culling, and the mirror's stand-ins. */
  cullOn = true;
  /** DEBUG: which copies the cull applies to (1 the camera's, 2 the mirror's). */
  cullBits = 3;
  standInsOn = true;
  /** The stand-in distance, m (a measurement switch; the look uses RIVER_MIRROR_LITE_M). */
  liteM = RIVER_MIRROR_LITE_M;
  /** The mirror's MSAA samples (a measurement switch). */
  mirrorSamples = 4;
  setMirrorSamples(n: number): void {
    this.mirrorSamples = n;
    this.reflRT.dispose();
    this.reflRT = this.makeReflRT(this.width, this.height);
  }
  /** What the last cull left to draw: triangles per pass. */
  lastCull = { camTris: 0, mirrorTris: 0, mirrorLiteTris: 0, allTris: 0 };

  /**
   * `editable` (the live river, 2026-09-29): keep the maps an edit needs to
   * move the ground's and the rocks' vertices, the stones and the plants in
   * place. The judged captures build without it; it changes no pixel.
   */
  constructor(canvas: HTMLCanvasElement, data: RiverReachData, opts: { editable?: boolean } = {}) {
    this.data = data;
    const editable = opts.editable === true;
    // The view reads courseKeyAt (the vegetation, the floaters' channel), so
    // the main thread takes the shape the data was built with. Data cached
    // before the panel has no shape, which is the default.
    setRiverShape(data.shape ?? null);
    // WEBGPU (2026-09-30): an opaque canvas (the renderer's default is a
    // see-through one) and no fallback to its WebGL2 backend (`init` checks).
    const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    // Each pass clears its own target. With autoClear on, three.js clears at
    // the start of EVERY render() call, and the water pass wiped the copied
    // scene it was meant to draw over (the first frame was black but for the
    // water).
    renderer.autoClear = false;
    // The ACES tone map is the output pass's own (with the auto exposure); the
    // renderer encodes sRGB only (see createOutPass).
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.2, 2500);
    // WebGPU's clip space from the start: the mirror's oblique clip is built
    // on the camera's own projection before the first render would set it.
    this.camera.coordinateSystem = THREE.WebGPUCoordinateSystem;
    this.camera.updateProjectionMatrix();
    this.reflCam.coordinateSystem = THREE.WebGPUCoordinateSystem;

    const L = RIVER_LIGHT;
    // THE HAZE AT ITS WEBGL DENSITY (2026-09-30). three 0.172's node
    // materials apply the scene's fog TWICE: \`setupOutput\` writes the fogged
    // color to its output, and the fog node, which reads that output, is then
    // written again as the fragment's color (seen in the WGSL of a bank tile:
    // \`Output = mix(Output, fog, f)\`, then \`color = mix(Output, fog, f)\`). The
    // far forest drew about 1.85 times as hazy as in WebGL. Two passes of an
    // exponential-squared fog at d / sqrt(2) are one pass at d, exactly:
    // (exp(-(d z / sqrt 2)^2))^2 = exp(-(d z)^2). The water hazes itself at
    // the full density (its own uniform). When three is upgraded, check the
    // WGSL for one fog pass and set the density back to L.fogDensity.
    this.scene.fog = new THREE.FogExp2(L.skyHorizon.clone().multiplyScalar(0.95), L.fogDensity / Math.SQRT2);
    // (The river's own class: its light node reads the shaded normal.)
    const hemi = new RiverHemisphereLight(L.hemiSky, L.hemiGround, L.hemiIntensity);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(L.sunColor, L.sunIntensity);
    sun.position.copy(L.sunDir).multiplyScalar(300).add(new THREE.Vector3(115, 0, 70));
    sun.target.position.set(115, 0, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -200; sc.right = 200; sc.top = 150; sc.bottom = -150; sc.near = 10; sc.far = 700;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    // The shadow map is drawn once (nothing in the scene moves but the water,
    // and the water casts no shadow): WebGPU keys that on the light.
    sun.shadow.autoUpdate = false;
    this.sun = sun;
    this.scene.add(sun, sun.target);

    const flow = createRiverFlowTextures(flowMapOf(data));
    this.flowTex = flow;
    this.bankMat = createRiverBankMaterial(flow, data.grid);
    const bankU = this.bankMat.userData.riverUniforms as Record<string, TslNode>;
    bankU.uCausticSun.value.set(1, 1, 1);
    // (Rivers round 4: the ground and the rocks in 24 m tiles, so each pass
    // draws only the tiles its camera sees; see `splitByTiles`.)
    const groundTiles: THREE.BufferGeometry[][] = [];
    const groundMaps: TileMap[] = [];
    for (const g0 of buildGround(data)) {
      const nGlobal = g0.getAttribute('position').count;
      const r = editable ? tileRecorder() : null;
      const tiles = splitByTiles(g0, 24, r?.rec);
      groundTiles.push(tiles);
      if (r) groundMaps.push(new TileMap(nGlobal, r.t, r.l, r.g));
      for (const g of tiles) {
        const m = new THREE.Mesh(g, this.bankMat);
        m.receiveShadow = true;
        m.castShadow = true;
        this.scene.add(m);
      }
    }
    const rockRanges = editable ? new Int32Array(data.boulders.length + 1) : undefined;
    const rockGeo = buildBoulders(data.boulders, rockRanges);
    const rockN = rockGeo.getAttribute('position').count;
    const rr = editable ? tileRecorder() : null;
    const rockTiles = splitByTiles(rockGeo, 24, rr?.rec);
    for (const g of rockTiles) {
      const rocks = new THREE.Mesh(g, this.bankMat);
      rocks.castShadow = true;
      rocks.receiveShadow = true;
      this.scene.add(rocks);
    }

    const smp = riverSamplers(data);
    const stoneRec: number[] | undefined = editable ? [] : undefined;
    const mixedRec: number[] | undefined = editable ? [] : undefined;
    const stones = buildSmallRocks(data, smp.groundAt, false, stoneRec);
    this.stonesR4 = stones;
    // V4 (round 5): the mixed stones, hidden unless the tune is on.
    const mixedStones = buildSmallRocks(data, smp.groundAt, true, mixedRec);
    mixedStones.material = this.bankMat;
    mixedStones.castShadow = true;
    mixedStones.receiveShadow = true;
    mixedStones.visible = false;
    this.stonesMixed = mixedStones;
    this.scene.add(mixedStones);
    stones.material = this.bankMat;
    stones.castShadow = true;
    stones.receiveShadow = true;
    this.scene.add(stones);
    const veg = buildRiverVegetation({
      groundAt: smp.groundAt,
      overWaterAt: (x, z) => {
        const lv = smp.levelAt(x, z);
        return lv < -50 ? 100 : smp.groundAt(x, z) - lv;
      },
      courseDistAt: smp.courseDistAt,
      courseSNAt: smp.courseSNAt,
      halfWidthAt: (s) => courseKeyAt(s).halfW,
      domain: { x0: -230, z0: -200, x1: 460, z1: 340 },
      seed: data.seed,
      // The bank cameras keep a 12 m stand and a 40 m view wedge free of
      // trees. The bridge camera keeps only a 6 m stand: from 7 m over the
      // water the bank trees frame the pool (the Nerang frame is walled by
      // them), and round 2's wedge cleared both banks to lawn for 40 m.
      clearings: Object.entries(RIVER_POSES).filter(([k]) => k !== 'pebble-close').map(([k, p]) => ({
        at: [p.pos[0], p.pos[2]] as [number, number],
        look: [p.look[0], p.look[2]] as [number, number],
        r: k === 'calm-bridge' ? 6 : 12,
        wedge: k !== 'calm-bridge',
      })),
    });
    this.scene.add(veg.group);
    this.vegGroup = veg.group;
    // THE FLOATERS (rivers round 4): a paper boat and five mallards on the
    // drawn water. Their meshes stay out of the shadow map and are hidden
    // while `floatersOn` is false, so the judged frames do not change.
    this.mirror = new RiverSurfaceMirror(data);
    this.floaters = new RiverFloatersView(data, this.mirror);
    this.floaters.group.visible = false;
    this.scene.add(this.floaters.group);
    this.vegetation = { counts: veg.counts, triangles: veg.triangles };
    this.buildVegSets(veg.group);

    const skyM = createSkyMaterial(L);
    this.skyU = skyM.u;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyM.material);
    this.sky.frustumCulled = false;
    // Its own scene: the reflection pass draws the sky with the TRUE
    // projection before it switches to the oblique clip, which would clip the
    // dome's lower half and leave black under the banks' reflection (round 1:
    // a dark line along every bank).
    this.skyScene.add(this.sky);

    this.waterMat = createRiverWaterMaterial(flowMapOf(data), flow);
    const wu = this.waterMat.uniforms;
    wu.uSunDir.value = L.sunDir;
    wu.uSunColor.value = new THREE.Color(L.sunColor).multiplyScalar(L.sunIntensity);
    wu.uSkyZenith.value = L.skyZenith;
    wu.uSkyHorizon.value = L.skyHorizon;
    wu.uSkyGain.value = L.skyGain;
    wu.uFogColor.value = (this.scene.fog as THREE.FogExp2).color;
    wu.uFogDensity.value = L.fogDensity;
    this.water = new THREE.Mesh(buildRiverWaterGeometry(flowMapOf(data)), this.waterMat.material);
    this.water.frustumCulled = false;
    this.waterScene.add(this.water);

    this.copyQ = createCopyPass();
    this.outQ = createOutPass();
    this.meterQ = createMeterPass();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyQ.material);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.sceneRT = this.makeSceneRT(1, 1);
    this.finalRT = this.makeFinalRT(1, 1);
    this.reflRT = this.makeReflRT(1, 1);
    this.reflMipRT = this.makeReflMipRT(1, 1);
    this.blitQ = createBlitPass();
    if (editable && rockRanges && rr && stoneRec && mixedRec) {
      const rockPos = new Float64Array(data.boulders.length * 3);
      data.boulders.forEach((b, k) => { rockPos[k * 3] = b.x; rockPos[k * 3 + 1] = b.y; rockPos[k * 3 + 2] = b.z; });
      this.edit = {
        groundTiles,
        groundMaps,
        rockTiles,
        rockMap: new TileMap(rockN, rr.t, rr.l, rr.g),
        rockRanges,
        rockPos,
        rockDef: rockPos.slice(),
        stones: [
          { mesh: stones, rec: Float32Array.from(stoneRec) },
          { mesh: mixedStones, rec: Float32Array.from(mixedRec) },
        ],
        groundDef: data.ground.slice(),
        outerDef: data.outer.heights.slice(),
        courseDef: data.course.slice(),
        veg: this.vegSets.map((v) => {
          const y0 = new Float32Array(v.n);
          const sy0 = new Float32Array(v.n);
          for (let k = 0; k < v.n; k += 1) { y0[k] = v.mats[k * 16 + 13]; sy0[k] = v.sph[k * 4 + 1]; }
          return { y0, sy0, inDef: new Int8Array(v.n).fill(-1), hidden: new Uint8Array(v.n) };
        }),
      };
    }
  }

  /**
   * START THE RENDERER (WebGPU: the adapter and the device come
   * asynchronously), then draw the shadow map once. Call it once, after the
   * constructor and before the first frame. It fails when WebGPU is missing:
   * the river has no WebGL path since 2026-09-30 (the no-fallback rule: one
   * real path, and an honest failure).
   */
  async init(): Promise<void> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      throw new Error('[river] WebGPU is not available in this browser. The river scene draws with WebGPU only (since 2026-09-30).');
    }
    // The river's sky light node (see RiverHemisphereLight), before any build.
    (this.renderer.library as unknown as { addLight(node: unknown, light: unknown): void }).addLight(RiverHemisphereLightNode, RiverHemisphereLight);
    await this.renderer.init();
    const backend = this.renderer.backend as unknown as { isWebGPUBackend?: boolean };
    if (backend.isWebGPUBackend !== true) {
      throw new Error('[river] The renderer started on its WebGL2 fallback, not WebGPU. The river scene draws with WebGPU only (since 2026-09-30).');
    }
    this.primeShadows();
  }

  // -------------------------------------------------------------------------
  // THE LIVE RIVER (2026-09-29): the flow snapshots and the bed patches.
  // -------------------------------------------------------------------------

  /** The flow textures the water and the banks read (the live river replaces their data). */
  private readonly flowTex: { flow0: THREE.DataTexture; flow1: THREE.DataTexture; flow2: THREE.DataTexture };

  /** What an edit moves in place (an editable view only; see the constructor's `editable`). */
  private edit: {
    groundTiles: THREE.BufferGeometry[][];
    groundMaps: TileMap[];
    rockTiles: THREE.BufferGeometry[];
    rockMap: TileMap;
    rockRanges: Int32Array;
    /** Each rock's place as drawn now, and as built (x, y, z). */
    rockPos: Float64Array;
    rockDef: Float64Array;
    stones: Array<{ mesh: THREE.InstancedMesh; rec: Float32Array }>;
    /** The judged ground, outer lattice and course, as built. */
    groundDef: Float32Array;
    outerDef: Float32Array;
    courseDef: Float32Array;
    /** Per vegetation set: each plant's judged height and sphere height, whether it stood in the judged channel (-1 not known yet), and whether an edit hides it. */
    veg: Array<{ y0: Float32Array; sy0: Float32Array; inDef: Int8Array; hidden: Uint8Array }>;
  } | null = null;

  /** Things drawn over the finished frame, with no depth test (the edit mode's handles). */
  overlay: THREE.Scene | null = null;

  /** True when the view keeps the maps an edit needs. */
  get editable(): boolean {
    return this.edit !== null;
  }

  /** What the edits moved (a probe): plants hidden and moved, rocks moved, and plants moved off the ground's change. */
  editInfo(): { hiddenPlants: number; movedPlants: number; movedRocks: number } | null {
    const E = this.edit;
    if (!E) return null;
    let hidden = 0;
    let moved = 0;
    this.vegSets.forEach((v, i) => {
      const vd = E.veg[i];
      for (let k = 0; k < v.n; k += 1) {
        if (vd.hidden[k]) hidden += 1;
        if (v.mats[k * 16 + 13] !== vd.y0[k]) moved += 1;
      }
    });
    let rocks = 0;
    this.data.boulders.forEach((b, k) => {
      if (b.x !== E.rockDef[k * 3] || b.y !== E.rockDef[k * 3 + 1] || b.z !== E.rockDef[k * 3 + 2]) rocks += 1;
    });
    return { hiddenPlants: hidden, movedPlants: moved, movedRocks: rocks };
  }

  /** The drawn water sheet's vertex count (the live river's proof reads it). */
  get sheetVertexCount(): number {
    return this.water.geometry.getAttribute('position').count;
  }

  /**
   * DRAW A LIVE FLOW SNAPSHOT: the flow textures take its half floats (the
   * water and the banks' wet band and caustics read them), the water sheet
   * its geometry, the floaters' water its arrays, and the probes (`levelAt`,
   * `modelAt`, `drawnFlowAt`) its field. The data's t1 and t2 float arrays
   * keep the start's values: only the textures and the mirror read them.
   */
  applyFlowSnapshot(s: LiveFlowSnapshot): void {
    const set = (tex: THREE.DataTexture, a: Uint16Array): void => {
      (tex.image as { data: Uint16Array }).data = a;
      tex.needsUpdate = true;
    };
    set(this.flowTex.flow0, s.t0h);
    set(this.flowTex.flow1, s.t1h);
    set(this.flowTex.flow2, s.t2h);
    const old = this.water.geometry;
    this.water.geometry = riverWaterGeometryFrom(s.sheet);
    old.dispose();
    this.mirror.setFlowHalf(s.t0h, s.t1h, s.t2h, s.surface);
    this.data.t0 = s.t0;
    this.data.surface = s.surface;
    this.data.h = s.h;
    this.data.u = s.u;
    this.data.v = s.v;
    this.data.mapStats = s.mapStats;
    this.samplers = null;
  }

  /**
   * APPLY A BED PATCH (riverLive.ts): the ground's vertices and normals in the
   * patch's box, the outer lattice's, each moved rock (a move of all its
   * vertices), the small stones and the plants in the patch's world box, the
   * course samples, and this thread's shape and course edit (the key table
   * the stones and the plants read). The shadow map is left until the edit
   * settles (`settleEdit`).
   */
  applyBedPatch(p: LiveBedPatch): void {
    const E = this.edit;
    if (!E) throw new Error('[river] This view was built without `editable`; it cannot take a bed patch.');
    setRiverShape(p.shape);
    setRiverCourseEdit(p.course);
    const d = this.data;
    const { nx, nz, dx, x0, z0 } = d.grid;
    if (p.course1m) d.course = p.course1m;
    const touched = new Set<THREE.BufferGeometry>();
    const touchedN = new Set<THREE.BufferGeometry>();
    // THE FINE GROUND over the box (and one cell round it, whose normals read it).
    if (p.box && p.ground) {
      const b = p.box;
      const bw = b.i1 - b.i0 + 1;
      for (let j = b.j0; j <= b.j1; j += 1) {
        for (let i = b.i0; i <= b.i1; i += 1) d.ground[j * nx + i] = p.ground[(j - b.j0) * bw + (i - b.i0)];
      }
      const H = d.ground;
      const map = E.groundMaps[0];
      const tiles = E.groundTiles[0];
      for (let j = Math.max(0, b.j0 - 1); j <= Math.min(nz - 1, b.j1 + 1); j += 1) {
        for (let i = Math.max(0, b.i0 - 1); i <= Math.min(nx - 1, b.i1 + 1); i += 1) {
          const c = j * nx + i;
          const hl = H[j * nx + Math.max(0, i - 1)];
          const hr = H[j * nx + Math.min(nx - 1, i + 1)];
          const hd = H[Math.max(0, j - 1) * nx + i];
          const hu = H[Math.min(nz - 1, j + 1) * nx + i];
          const gx = (hr - hl) / (2 * dx);
          const gz = (hu - hd) / (2 * dx);
          const l = Math.hypot(gx, 1, gz);
          for (let q = map.start[c]; q < map.start[c + 1]; q += 1) {
            const g = tiles[map.tile[q]];
            const lv = map.local[q];
            const pos = g.getAttribute('position') as THREE.BufferAttribute;
            const nor = g.getAttribute('normal') as THREE.BufferAttribute;
            pos.setY(lv, H[c]);
            nor.setXYZ(lv, -gx / l, 1 / l, -gz / l);
            touched.add(g);
            touchedN.add(g);
          }
        }
      }
    }
    // THE OUTER LATTICE (with the fine mesh's edge band sunk, as built).
    if (p.outerBox && p.outer) {
      const o = d.outer;
      const b = p.outerBox;
      const bw = b.i1 - b.i0 + 1;
      for (let j = b.j0; j <= b.j1; j += 1) {
        for (let i = b.i0; i <= b.i1; i += 1) o.heights[j * o.nx + i] = p.outer[(j - b.j0) * bw + (i - b.i0)];
      }
      const H = o.heights;
      const map = E.groundMaps[1];
      const tiles = E.groundTiles[1];
      const gx0 = x0;
      const gx1 = x0 + nx * dx;
      const gz0 = z0;
      const gz1 = z0 + nz * dx;
      const band = 2 * o.step;
      for (let j = Math.max(0, b.j0 - 1); j <= Math.min(o.nz - 1, b.j1 + 1); j += 1) {
        for (let i = Math.max(0, b.i0 - 1); i <= Math.min(o.nx - 1, b.i1 + 1); i += 1) {
          const c = j * o.nx + i;
          const x = o.x0 + i * o.step;
          const z = o.z0 + j * o.step;
          const inside = Math.min(x - gx0, gx1 - x, z - gz0, gz1 - z);
          const sink = inside > 0 ? 0.3 * Math.min(1, inside / band) : 0;
          const hl = H[j * o.nx + Math.max(0, i - 1)];
          const hr = H[j * o.nx + Math.min(o.nx - 1, i + 1)];
          const hd = H[Math.max(0, j - 1) * o.nx + i];
          const hu = H[Math.min(o.nz - 1, j + 1) * o.nx + i];
          const ggx = (hr - hl) / (2 * o.step);
          const ggz = (hu - hd) / (2 * o.step);
          const l = Math.hypot(ggx, 1, ggz);
          for (let q = map.start[c]; q < map.start[c + 1]; q += 1) {
            const g = tiles[map.tile[q]];
            const lv = map.local[q];
            (g.getAttribute('position') as THREE.BufferAttribute).setY(lv, H[c] - sink);
            (g.getAttribute('normal') as THREE.BufferAttribute).setXYZ(lv, -ggx / l, 1 / l, -ggz / l);
            touched.add(g);
            touchedN.add(g);
          }
        }
      }
    }
    // THE ROCKS: each moved rock's vertices move by its move (its shape and
    // its normals stay).
    const mv = p.boulderMoves;
    for (let q = 0; q + 3 < mv.length; q += 4) {
      const k = mv[q];
      const ddx = mv[q + 1] - E.rockPos[k * 3];
      const ddy = mv[q + 2] - E.rockPos[k * 3 + 1];
      const ddz = mv[q + 3] - E.rockPos[k * 3 + 2];
      E.rockPos[k * 3] = mv[q + 1];
      E.rockPos[k * 3 + 1] = mv[q + 2];
      E.rockPos[k * 3 + 2] = mv[q + 3];
      const b = d.boulders[k];
      b.x = mv[q + 1]; b.y = mv[q + 2]; b.z = mv[q + 3];
      for (let v = E.rockRanges[k]; v < E.rockRanges[k + 1]; v += 1) {
        for (let r = E.rockMap.start[v]; r < E.rockMap.start[v + 1]; r += 1) {
          const g = E.rockTiles[E.rockMap.tile[r]];
          const pos = g.getAttribute('position') as THREE.BufferAttribute;
          const lv = E.rockMap.local[r];
          pos.setXYZ(lv, pos.getX(lv) + ddx, pos.getY(lv) + ddy, pos.getZ(lv) + ddz);
          touched.add(g);
        }
      }
    }
    for (const g of touched) {
      (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      if (touchedN.has(g)) (g.getAttribute('normal') as THREE.BufferAttribute).needsUpdate = true;
      g.computeBoundingSphere();
    }
    this.samplers = null;
    const smp = riverSamplers(d);
    const W = p.world;
    if (W) {
      const inW = (x: number, z: number): boolean => x >= W.x0 && x <= W.x1 && z >= W.z0 && z <= W.z1;
      // THE SMALL STONES ride their place on the course and the ground.
      const c1 = d.course;
      for (const st of E.stones) {
        const arr = st.mesh.instanceMatrix.array as Float32Array;
        let any = false;
        for (let k = 0; k < st.mesh.count; k += 1) {
          const r = k * 5;
          const ci = st.rec[r] * 5;
          const n0 = st.rec[r + 1];
          const s = c1[ci + 2];
          const nn = riverLateralN(s, n0);
          const x = c1[ci] + c1[ci + 4] * nn + st.rec[r + 2];
          const z = c1[ci + 1] - c1[ci + 3] * nn + st.rec[r + 3];
          const ox = arr[k * 16 + 12];
          const oz = arr[k * 16 + 14];
          if (!inW(x, z) && !inW(ox, oz)) continue;
          arr[k * 16 + 12] = x;
          arr[k * 16 + 13] = smp.groundAt(x, z) - st.rec[r + 4];
          arr[k * 16 + 14] = z;
          any = true;
        }
        if (any) {
          st.mesh.instanceMatrix.needsUpdate = true;
          st.mesh.computeBoundingSphere();
        }
      }
      // THE PLANTS stay where they grow; they ride the ground's change, and an
      // edit hides the ones the new channel runs over (and shows them again
      // when it leaves).
      const defSN = riverSamplers({ ...d, course: E.courseDef });
      const groundDefAt = (x: number, z: number): number => {
        const fi = (x - x0) / dx - 0.5;
        const fj = (z - z0) / dx - 0.5;
        if (fi > 0 && fi < nx - 1 && fj > 0 && fj < nz - 1) return bilinear(E.groundDef, nx, nz, fi, fj);
        const o = d.outer;
        return bilinear(E.outerDef, o.nx, o.nz, (x - o.x0) / o.step, (z - o.z0) / o.step);
      };
      const inChannel = (sn: { s: number; n: number }, hw: number): boolean => Math.abs(sn.n) < hw + 0.5;
      this.vegSets.forEach((v, si) => {
        const vd = E.veg[si];
        let changed = false;
        for (let k = 0; k < v.n; k += 1) {
          const x = v.mats[k * 16 + 12];
          const z = v.mats[k * 16 + 14];
          if (!inW(x, z)) continue;
          const y = vd.y0[k] + (smp.groundAt(x, z) - groundDefAt(x, z));
          if (v.mats[k * 16 + 13] !== y) {
            v.mats[k * 16 + 13] = y;
            v.sph[k * 4 + 1] = vd.sy0[k] + (y - vd.y0[k]);
            changed = true;
          }
          if (vd.inDef[k] < 0) {
            const sn0 = defSN.courseSNAt(x, z);
            vd.inDef[k] = inChannel(sn0, riverBaseHalfWidthAt(sn0.s)) ? 1 : 0;
          }
          const sn = smp.courseSNAt(x, z);
          const hide = vd.inDef[k] === 0 && inChannel(sn, courseKeyAt(sn.s).halfW) ? 1 : 0;
          if (vd.hidden[k] !== hide) { vd.hidden[k] = hide; changed = true; }
        }
        if (changed) this.cullKey = '';
      });
    }
  }

  /**
   * AFTER AN EDIT SETTLES (the page calls it when no patch has come for a
   * moment): the shadow map again with the moved ground, rocks and plants,
   * and the floaters started again on the new water.
   */
  settleEdit(): void {
    this.reprimeShadows();
    this.scene.remove(this.floaters.group);
    this.floaters = new RiverFloatersView(this.data, this.mirror);
    this.floaters.group.visible = this.floatersOn;
    this.scene.add(this.floaters.group);
    this.floaterT0 = this.waterTime();
    this.follow = null;
  }

  /** The water time the floaters started at (0, or when an edit last settled), s. */
  private floaterT0 = 0;

  private makeSceneRT(w: number, h: number): THREE.RenderTarget {
    const rt = new THREE.RenderTarget(w, h, {
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(w, h, THREE.FloatType),
      samples: 4,
    });
    rt.texture.minFilter = THREE.LinearFilter;
    rt.texture.generateMipmaps = false;
    return rt;
  }

  private makeFinalRT(w: number, h: number): THREE.RenderTarget {
    return new THREE.RenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, samples: 4 });
  }

  private makeReflRT(w: number, h: number): THREE.RenderTarget {
    // Half size. (The mip chain is the copy's: see reflMipRT.)
    const rt = new THREE.RenderTarget(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2)), {
      type: THREE.HalfFloatType, depthBuffer: true, samples: this.mirrorSamples,
    });
    rt.texture.generateMipmaps = false;
    rt.texture.minFilter = THREE.LinearFilter;
    return rt;
  }

  private makeReflMipRT(w: number, h: number): THREE.RenderTarget {
    // Half size, with a mip chain: the water reads it at a level set by its
    // roughness (a glossy reflection), so the chain is built every frame.
    const rt = new THREE.RenderTarget(Math.max(1, Math.floor(w / 2)), Math.max(1, Math.floor(h / 2)), {
      type: THREE.HalfFloatType, depthBuffer: false,
    });
    rt.texture.generateMipmaps = true;
    rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
    return rt;
  }

  private buildVegSets(group: THREE.Group): void {
    const tris = (g: THREE.BufferGeometry): number => (g.index ? g.index.count / 3 : g.getAttribute('position').count / 3);
    // WEBGPU (2026-09-30): EACH COPY DRAWS ITS GEOMETRY'S `instanceCount`,
    // and its `count` stays the capacity. three 0.172 builds an instanced
    // mesh's matrix read from its `count` at the mesh's first draw: under
    // 1,001 it reads a uniform array of that length (sized by the whole
    // matrix array), over it an instanced attribute. The cull changed `count`
    // at every camera move (the mirror's copies started at 0), so a copy
    // would read the wrong matrices, or fail WebGPU's 64 KB uniform limit.
    // three draws an instanced geometry's `instanceCount` instead of the
    // mesh's `count`. Each copy gets its own geometry object over the same
    // attributes (the camera's and the mirror's counts differ).
    const ownInstanced = (g: THREE.BufferGeometry, count: number): THREE.InstancedBufferGeometry => {
      const ig = new THREE.InstancedBufferGeometry();
      ig.setIndex(g.index);
      for (const [name, a] of Object.entries(g.attributes)) ig.setAttribute(name, a);
      ig.boundingSphere = g.boundingSphere;
      ig.boundingBox = g.boundingBox;
      ig.instanceCount = count;
      return ig;
    };
    const m = new THREE.Matrix4();
    const c = new THREE.Vector3();
    for (const child of group.children.slice()) {
      const im = child as THREE.InstancedMesh;
      if (!im.isInstancedMesh) continue;
      const n = im.count;
      const mats = Float32Array.from(im.instanceMatrix.array as Float32Array);
      const cols = im.instanceColor ? Float32Array.from(im.instanceColor.array as Float32Array) : null;
      im.geometry.computeBoundingSphere();
      const bs = im.geometry.boundingSphere as THREE.Sphere;
      const sph = new Float32Array(n * 4);
      for (let k = 0; k < n; k += 1) {
        m.fromArray(mats, k * 16);
        c.copy(bs.center).applyMatrix4(m);
        sph[k * 4] = c.x;
        sph[k * 4 + 1] = c.y;
        sph[k * 4 + 2] = c.z;
        sph[k * 4 + 3] = bs.radius * m.getMaxScaleOnAxis();
      }
      const copy = (geo: THREE.BufferGeometry): THREE.InstancedMesh => {
        const r = new THREE.InstancedMesh(ownInstanced(geo, 0), im.material, n);
        r.frustumCulled = false;
        r.castShadow = false;
        r.receiveShadow = im.receiveShadow;
        if (cols) r.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
        r.layers.set(LAYER_MIRROR);
        group.add(r);
        return r;
      };
      im.layers.set(LAYER_CAM);
      im.geometry = ownInstanced(im.geometry, n);
      const liteGeo = im.userData.lite as THREE.BufferGeometry | undefined;
      this.vegSets.push({
        mesh: im, refl: copy(im.geometry), lite: liteGeo ? copy(liteGeo) : null, mats, cols, sph, n,
        tris: tris(im.geometry), liteTris: liteGeo ? tris(liteGeo) : 0,
      });
    }
    this.camera.layers.enable(LAYER_CAM);
    this.reflCam.layers.enable(LAYER_MIRROR);
    // (The shadow map is drawn in `init`: WebGPU cannot render before it.)
  }

  /**
   * THE SHADOW MAP, drawn once with every vegetation instance (three.js tests
   * each caster against the layers of the camera it renders with, and the
   * shadow map is static: the light's `autoUpdate` is off). WebGPU draws a
   * light's shadow in the first render after `needsUpdate`, with that
   * render's camera's layers, so the prime renders with the main camera (the
   * mirror's camera holds none of the camera's copies of the plants).
   */
  private primeShadows(): void {
    const r = this.renderer;
    const rt = new THREE.RenderTarget(1, 1);
    r.setRenderTarget(rt);
    // WebGPU keeps a shadow map per camera (three 0.172 keys its lights on
    // the scene and the camera), so the mirror's camera has a map of its own.
    // It is drawn with the main camera's layers (the camera's copies of the
    // plants cast; the mirror's copies do not), as WebGL's one map was.
    const mirrorMask = this.reflCam.layers.mask;
    for (const cam of [this.camera, this.reflCam]) {
      if (cam === this.reflCam) cam.layers.mask = this.camera.layers.mask;
      // Twice: in the very first render the leaf cards cast nothing (their
      // shadow pass runs before their first frame is complete; measured
      // 2026-09-30: the canopy's shade on the bars was missing until a
      // second draw).
      for (let k = 0; k < 2; k += 1) {
        this.sun.shadow.needsUpdate = true;
        r.render(this.scene, cam);
      }
    }
    this.reflCam.layers.mask = mirrorMask;
    r.setRenderTarget(null);
    rt.dispose();
  }

  /** Fill each copy with the instances its camera can see (see `VegSet`). */
  private cullVegetation(): void {
    const cam = this.camera;
    cam.updateMatrixWorld();
    this.updateReflection();
    // (The projection is WebGPU's: its near plane is z = 0 in clip space.)
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse), THREE.WebGPUCoordinateSystem);
    const frR = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, this.reflCam.matrixWorldInverse), THREE.WebGPUCoordinateSystem);
    const eye = this.reflCam.position;
    const sp = new THREE.Sphere();
    const liteD2 = this.liteM * this.liteM;
    const stat = { camTris: 0, mirrorTris: 0, mirrorLiteTris: 0, allTris: 0 };
    for (let vi = 0; vi < this.vegSets.length; vi += 1) {
      const v = this.vegSets[vi];
      // (The live river: the plants an edit's channel runs over are hidden.)
      const hidden = this.edit ? this.edit.veg[vi].hidden : null;
      const dm = v.mesh.instanceMatrix.array as Float32Array;
      const dr = v.refl.instanceMatrix.array as Float32Array;
      const dl = v.lite ? (v.lite.instanceMatrix.array as Float32Array) : null;
      const cm = v.mesh.instanceColor ? (v.mesh.instanceColor.array as Float32Array) : null;
      const cr = v.refl.instanceColor ? (v.refl.instanceColor.array as Float32Array) : null;
      const cl = v.lite && v.lite.instanceColor ? (v.lite.instanceColor.array as Float32Array) : null;
      let nm = 0;
      let nr = 0;
      let nl = 0;
      for (let k = 0; k < v.n; k += 1) {
        if (hidden && hidden[k]) continue;
        sp.center.set(v.sph[k * 4], v.sph[k * 4 + 1], v.sph[k * 4 + 2]);
        sp.radius = v.sph[k * 4 + 3];
        const src = v.mats.subarray(k * 16, k * 16 + 16);
        const csrc = v.cols ? v.cols.subarray(k * 3, k * 3 + 3) : null;
        if (!this.cullOn || (this.cullBits & 1) === 0 || fr.intersectsSphere(sp)) {
          dm.set(src, nm * 16);
          if (cm && csrc) cm.set(csrc, nm * 3);
          nm += 1;
        }
        if (!this.cullOn || (this.cullBits & 2) === 0 || frR.intersectsSphere(sp)) {
          const far = this.standInsOn && dl && sp.center.distanceToSquared(eye) > liteD2;
          if (far && dl) {
            dl.set(src, nl * 16);
            if (cl && csrc) cl.set(csrc, nl * 3);
            nl += 1;
          } else {
            dr.set(src, nr * 16);
            if (cr && csrc) cr.set(csrc, nr * 3);
            nr += 1;
          }
        }
      }
      // (WebGPU: the counts go to the copies' own geometries; see buildVegSets.)
      drawCount(v.mesh, nm);
      drawCount(v.refl, nr);
      if (v.lite) drawCount(v.lite, nl);
      for (const im of [v.mesh, v.refl, v.lite]) {
        if (!im) continue;
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
      stat.camTris += nm * v.tris;
      stat.mirrorTris += nr * v.tris;
      stat.mirrorLiteTris += nl * v.liteTris;
      stat.allTris += v.n * v.tris;
    }
    this.lastCull = stat;
  }

  /**
   * READ A TEXTURE'S PIXELS BACK (WebGPU): a copy to a buffer, then its map.
   * Rows come back from the TOP (WebGPU's first row is the image's top; the
   * WebGL reads came from the bottom). three 0.172's own read-back pads each
   * row to 256 bytes but sizes its buffer without the padding, so a width
   * whose row is not a multiple of 256 bytes (1,200 px of half floats, the
   * meter's 48) fails its validation; this one pads and strips. The copy is
   * submitted before the first await, so it follows every pass already
   * submitted and nothing drawn later.
   */
  private readPixels(tex: THREE.Texture, x: number, y: number, w: number, h: number): Promise<Uint16Array | Float32Array | Uint8Array> {
    const backend = this.renderer.backend as unknown as {
      device: GPUDevice;
      get(o: object): { texture: GPUTexture; textureDescriptorGPU: { format: GPUTextureFormat } };
    };
    const device = backend.device;
    const td = backend.get(tex);
    const format = td.textureDescriptorGPU.format;
    const bpt = format === 'rgba32float' ? 16 : format === 'rgba16float' ? 8 : 4;
    const rowBytes = w * bpt;
    const padded = Math.ceil(rowBytes / 256) * 256;
    const buf = device.createBuffer({ size: padded * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = device.createCommandEncoder();
    enc.copyTextureToBuffer({ texture: td.texture, origin: { x, y, z: 0 } }, { buffer: buf, bytesPerRow: padded }, { width: w, height: h });
    device.queue.submit([enc.finish()]);
    return buf.mapAsync(GPUMapMode.READ).then(() => {
      const src = new Uint8Array(buf.getMappedRange());
      const out = new Uint8Array(rowBytes * h);
      for (let r = 0; r < h; r += 1) out.set(src.subarray(r * padded, r * padded + rowBytes), r * rowBytes);
      buf.unmap();
      buf.destroy();
      return format === 'rgba32float' ? new Float32Array(out.buffer) : format === 'rgba16float' ? new Uint16Array(out.buffer) : out;
    });
  }

  /** The GPU device (WebGPU), for a fence. */
  private get device(): GPUDevice {
    return (this.renderer.backend as unknown as { device: GPUDevice }).device;
  }

  /**
   * HOLD THE PAGE'S LOOP (WebGPU: a probe's frames and read-backs span
   * awaits, and a frame of the page's loop between them would draw into the
   * same targets). The page's loop skips its frame while this is true.
   */
  holdLoop = false;

  /** Wait until no frame waits for its meter. */
  private async settled(): Promise<void> {
    while (this.metering) await this.metering;
  }

  /** DEBUG (rivers round 4): a checksum of a render target's HDR pixels (0 scene, 1 final, 2 mirror). */
  async debugTargetSum(which: number): Promise<number[]> {
    await this.settled();
    const rt = which === 0 ? this.sceneRT : which === 1 ? this.finalRT : this.reflMipRT;
    const w = rt.width;
    const h = rt.height;
    const buf = await this.readPixels(rt.texture, 0, 0, w, h) as Uint16Array;
    let s0 = 0; let s1 = 0; let s2 = 0;
    for (let i = 0; i < buf.length; i += 4) { s0 += buf[i]; s1 += buf[i + 1] * ((i >> 2) % 7); s2 += buf[i + 2] * ((i >> 2) % 13); }
    return [w, h, s0, s1, s2];
  }

  /** Cull again only when the camera has moved (a pose, a size, a field of view). */
  private cullIfMoved(): void {
    const e = this.camera.matrixWorld.elements;
    const pe = this.camera.projectionMatrix.elements;
    const key = `${this.cullOn}|${this.cullBits}|${this.standInsOn}|${this.liteM}|${this.reflPlaneY}|${Array.from(e).map((x) => x.toFixed(4)).join(',')}|${pe[0].toFixed(5)},${pe[5].toFixed(5)}`;
    if (key === this.cullKey) return;
    this.cullKey = key;
    this.cullVegetation();
  }

  setSize(w: number, h: number): void {
    // (Rivers round 4: a resize callback with the same size rebuilt every
    // target and re-metered the exposure; a capture then caught that first
    // frame now and then. The same size is no change.)
    if (w === this.width && h === this.height) return;
    this.meterDirty = true;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.sceneRT.dispose();
    this.finalRT.dispose();
    this.reflRT.dispose();
    this.reflMipRT.dispose();
    this.sceneRT = this.makeSceneRT(w, h);
    this.finalRT = this.makeFinalRT(w, h);
    this.reflRT = this.makeReflRT(w, h);
    this.reflMipRT = this.makeReflMipRT(w, h);
  }

  setPose(p: RiverPose, keepExposure = false): void {
    // (Rivers round 4: a camera that follows the paper boat moves every
    // frame; it keeps the exposure it metered when it started.)
    if (!keepExposure) this.meterDirty = true;
    this.camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
    this.camera.fov = p.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(p.look[0], p.look[1], p.look[2]);
    this.camera.updateMatrixWorld();
    // The mirror plane: the water level at the look point's nearest water,
    // read from the flow map. This picks WHICH plane the reflection is drawn
    // in, not how much reflection there is; each fragment then samples at
    // its own position.
    this.reflPlaneY = this.levelNear(p.look[0], p.look[2]);
  }

  /** The water level at (x, z), m, from the flow map, or the nearest wet cell's within 40 m. */
  levelNear(x: number, z: number): number {
    const { nx, nz, dx, x0, z0 } = this.data.grid;
    const i0 = Math.floor((x - x0) / dx);
    const j0 = Math.floor((z - z0) / dx);
    for (let r = 0; r < 80; r += 1) {
      for (let dj = -r; dj <= r; dj += 1) {
        for (let di = -r; di <= r; di += 1) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = i0 + di;
          const j = j0 + dj;
          if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
          const c = j * nx + i;
          if (this.data.h[c] > 0.05) return this.data.t0[c * 4 + 3];
        }
      }
    }
    return 1.3;
  }

  /** The world point at course distance s and lateral offset n (positive left of the flow), m. */
  courseAt(s: number, n: number): { x: number; z: number } {
    const k = Math.max(0, Math.min(this.data.course.length / 5 - 1, Math.round(s) + 120)) * 5;
    const c = this.data.course;
    return { x: c[k] + c[k + 4] * n, z: c[k + 1] - c[k + 3] * n };
  }

  /** The water level at (x, z) from the flow map (smooth past the banks), m. */
  levelAt(x: number, z: number): number {
    // (The samplers are built once per flow map: the live river's edit
    // handles read hundreds of points a patch, and building them costs 2 ms.)
    if (!this.samplers) this.samplers = riverSamplers(this.data);
    return this.samplers.levelAt(x, z);
  }

  /** The ground at (x, z) (the fine grid, the outer lattice past it), m. */
  groundAt(x: number, z: number): number {
    if (!this.samplers) this.samplers = riverSamplers(this.data);
    return this.samplers.groundAt(x, z);
  }

  /** The velocity the water's texture rides at (x, z): the flow map's smoothed field, m/s. */
  drawnFlowAt(x: number, z: number): { u: number; v: number } {
    const { nx, nz, dx, x0, z0 } = this.data.grid;
    const i = Math.max(0, Math.min(nx - 1, Math.floor((x - x0) / dx)));
    const j = Math.max(0, Math.min(nz - 1, Math.floor((z - z0) / dx)));
    const c = j * nx + i;
    return { u: this.data.t0[c * 4], v: this.data.t0[c * 4 + 1] };
  }

  /** The steady model at (x, z): depth, velocity. */
  modelAt(x: number, z: number): { h: number; u: number; v: number; speed: number; rms: number } {
    const { nx, nz, dx, x0, z0 } = this.data.grid;
    const i = Math.max(0, Math.min(nx - 1, Math.floor((x - x0) / dx)));
    const j = Math.max(0, Math.min(nz - 1, Math.floor((z - z0) / dx)));
    const c = j * nx + i;
    const u = this.data.u[c];
    const v = this.data.v[c];
    return { h: this.data.h[c], u, v, speed: Math.hypot(u, v), rms: this.data.uRms[c] };
  }

  /**
   * THE VARIANT TUNES (rivers round 5, step 1: a variant round, each lever at
   * full strength; see riverWaterMaterial.ts `uTune`). `slab` fixes the white
   * slabs (every variant has it); v1 rock contact, v2 white water placed by
   * the flow, v3 depth and direction, v4 stones and wet margins. All 0 draws
   * round 4, pixel for pixel. V4 swaps the small stones for mixed ones, so
   * the shadow map is drawn again with every instance.
   */
  setTunes(t: Partial<{ slab: number; v1: number; v2: number; v3: number; v4: number }>): void {
    const was4 = this.tunes.v4 > 0;
    this.tunes = { ...this.tunes, ...t };
    const T = this.tunes;
    (this.waterMat.uniforms.uTune.value as THREE.Vector4).set(T.v1, T.v2, T.v3, T.v4);
    this.waterMat.uniforms.uTuneSlab.value = T.slab;
    ((this.bankMat.userData.riverUniforms as Record<string, TslNode>).uTune.value as THREE.Vector4).set(T.v1, T.v2, T.v3, T.v4);
    const is4 = T.v4 > 0;
    if (is4 !== was4 && this.stonesR4 && this.stonesMixed) {
      this.stonesR4.visible = !is4;
      this.stonesMixed.visible = is4;
      this.reprimeShadows();
    }
    this.meterDirty = true;
  }

  /** The shadow map again, with every vegetation instance (then cull again). */
  private reprimeShadows(): void {
    this.vegSets.forEach((v, vi) => {
      const hidden = this.edit ? this.edit.veg[vi].hidden : null;
      const dm = v.mesh.instanceMatrix.array as Float32Array;
      if (!hidden) {
        dm.set(v.mats);
        drawCount(v.mesh, v.n);
      } else {
        // (The live river: the plants an edit hides cast no shadow.)
        let m = 0;
        for (let k = 0; k < v.n; k += 1) {
          if (hidden[k]) continue;
          dm.set(v.mats.subarray(k * 16, k * 16 + 16), m * 16);
          m += 1;
        }
        drawCount(v.mesh, m);
      }
      v.mesh.instanceMatrix.needsUpdate = true;
    });
    this.primeShadows();
    this.cullKey = '';
  }

  ablate(part: RiverAblatePart, on: boolean): void {
    this.off[part] = !on;
    const bankU = this.bankMat.userData.riverUniforms as Record<string, TslNode>;
    bankU.uCausticSun.value.set(this.off.caustics ? 0 : 1, 1, 1);
  }

  setDebug(mode: number): void {
    this.waterMat.uniforms.uDebug.value = mode;
  }

  /**
   * MEASUREMENT ONLY: 1 = the plain two-phase blend (linear weights, no
   * variance keeping); 0 or false = the judged look.
   */
  setNaiveBlend(mode: boolean | number): void {
    const v = typeof mode === 'number' ? mode : mode ? 1 : 0;
    this.waterMat.uniforms.uNaive.value = v;
    (this.bankMat.userData.riverUniforms as Record<string, TslNode>).uNaive.value = v;
  }

  /**
   * THE WATER INFO MAP at the current pose and size, for the still-frame
   * statistics: the water pass writes (depth m, speed m/s, drawn foam) into
   * the output target (debug output 5) and the target is read back. Returns
   * base64 RGBA bytes, rows from the top: R = depth x 50, G = speed x 50,
   * B = foam x 255, A = 255 on a whole water pixel, else 0.
   */
  async readWaterInfo(): Promise<{ w: number; h: number; data: string }> {
    await this.settled();
    this.holdLoop = true;
    const dbg = this.waterMat.uniforms.uDebug.value;
    this.waterMat.uniforms.uDebug.value = 5;
    await this.render();
    const w = this.width;
    const h = this.height;
    const pending = this.readPixels(this.finalRT.texture, 0, 0, w, h);
    this.waterMat.uniforms.uDebug.value = dbg;
    const buf = await pending as Uint16Array;
    const out = new Uint8Array(w * h * 4);
    const f = THREE.DataUtils.fromHalfFloat;
    for (let y = 0; y < h; y += 1) {
      // (WebGPU's rows come from the top already.)
      const src = y * w;
      for (let x = 0; x < w; x += 1) {
        const k = (src + x) * 4;
        const o = (y * w + x) * 4;
        const a = f(buf[k + 3]);
        if (Math.abs(a - 0.25) > 0.02) continue;
        out[o] = Math.min(255, Math.round(f(buf[k]) * 50));
        out[o + 1] = Math.min(255, Math.round(f(buf[k + 1]) * 50));
        out[o + 2] = Math.min(255, Math.round(f(buf[k + 2]) * 255));
        out[o + 3] = 255;
      }
    }
    let bin = '';
    for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode(...out.subarray(i, i + 0x8000));
    await this.render();
    this.holdLoop = false;
    return { w, h, data: btoa(bin) };
  }

  /**
   * THE CLASS MAP at the current pose and size (rivers round 4, for the
   * wetted share of the channel against the clips). Per pixel, rows from the
   * top: 0 = sky or nothing, 1 = vegetation in front, 2 = CHANNEL ground or
   * rock (the bed, the bars and the rocks less than `channelM` over the local
   * water level), 3 = higher ground (the valley sides). The water itself is
   * not drawn here; the caller takes it from `readWaterInfo`.
   * Method: a pass with the vegetation hidden writes each pixel's world
   * position; the opaque pass with and without the vegetation marks where
   * the vegetation changed the pixel (the shadow map is not redrawn, so the
   * trees' shadows stay and do not count). MEASUREMENT ONLY.
   */
  async readClassMap(channelM = 1.8): Promise<{ w: number; h: number; data: string }> {
    await this.settled();
    this.holdLoop = true;
    const r = this.renderer;
    const w = this.width;
    const h = this.height;
    const veg = this.vegGroup;
    const readScene = async (): Promise<Uint16Array> => {
      const rt = new THREE.RenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true });
      this.sky.position.copy(this.camera.position);
      r.setRenderTarget(rt);
      r.clear();
      r.render(this.skyScene, this.camera);
      r.render(this.scene, this.camera);
      r.setRenderTarget(null);
      const b = await this.readPixels(rt.texture, 0, 0, w, h) as Uint16Array;
      rt.dispose();
      return b;
    };
    const withVeg = await readScene();
    if (veg) veg.visible = false;
    const noVeg = await readScene();
    // World positions, vegetation hidden (the world point carries the
    // instance's matrix, as the GLSL's USE_INSTANCING branch did).
    const posRT = new THREE.RenderTarget(w, h, { type: THREE.FloatType, depthBuffer: true });
    const posMat = new THREE.NodeMaterial();
    posMat.fragmentNode = vec4(positionWorld, 1.0);
    posMat.fog = false;
    posMat.lights = false;
    this.scene.overrideMaterial = posMat;
    // (three 0.172 copies into any color; its type asks for a Color4.)
    const cc = r.getClearColor(new THREE.Color() as unknown as Parameters<typeof r.getClearColor>[0]);
    const ca = r.getClearAlpha();
    r.setRenderTarget(posRT);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, this.camera);
    r.setClearColor(cc, ca);
    r.setRenderTarget(null);
    this.scene.overrideMaterial = null;
    if (veg) veg.visible = true;
    const pos = await this.readPixels(posRT.texture, 0, 0, w, h) as Float32Array;
    posRT.dispose();
    posMat.dispose();
    const f = THREE.DataUtils.fromHalfFloat;
    const smp = riverSamplers(this.data);
    const out = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) {
      // (WebGPU's rows come from the top already.)
      const src = y * w;
      for (let x = 0; x < w; x += 1) {
        const k = (src + x) * 4;
        const o = y * w + x;
        const d = Math.abs(f(withVeg[k]) - f(noVeg[k])) + Math.abs(f(withVeg[k + 1]) - f(noVeg[k + 1]))
          + Math.abs(f(withVeg[k + 2]) - f(noVeg[k + 2]));
        if (d > 0.02) { out[o] = 1; continue; }
        if (pos[k + 3] < 0.5) { out[o] = 0; continue; }
        const lv = smp.levelAt(pos[k], pos[k + 2]);
        out[o] = pos[k + 1] - lv < channelM ? 2 : 3;
      }
    }
    let bin = '';
    for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode(...out.subarray(i, i + 0x8000));
    await this.render();
    this.holdLoop = false;
    return { w, h, data: btoa(bin) };
  }

  /**
   * THE SHADER'S SURFACE HEIGHT at a world point (rivers round 4, for the
   * floaters' proof): the water pass writes its `hWaves`, the flow map's
   * level and the pixel's own world x and z (debug output 10); the pixel
   * where the point projects is read back. Returns null off the water.
   */
  async readSurfaceHeight(x: number, z: number): Promise<{ h: number; level: number; x: number; z: number; mirror: number } | null> {
    await this.settled();
    const lv = this.mirror.flow(0, x, z, [0, 0, 0, 0])[3];
    const [sx, sy] = this.worldToScreen(x, lv, z);
    // (The pixel's row from the TOP: WebGPU's read-back rows.)
    const px = Math.round(sx - 0.5);
    const py = Math.round(sy - 0.5);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return null;
    this.holdLoop = true;
    const dbg = this.waterMat.uniforms.uDebug.value;
    this.waterMat.uniforms.uDebug.value = 10;
    // The pixel's world x and z come back relative to the asked point (half
    // floats: a small offset keeps them exact to about 3e-5 m).
    this.waterMat.uniforms.uProbe.value.set(x, z);
    await this.render();
    const pending = this.readPixels(this.finalRT.texture, px, py, 1, 1);
    this.waterMat.uniforms.uDebug.value = dbg;
    const buf = await pending as Uint16Array;
    await this.render();
    this.holdLoop = false;
    const f = THREE.DataUtils.fromHalfFloat;
    const out = { h: f(buf[0]), level: f(buf[1]), x: x + f(buf[2]), z: z + f(buf[3]), mirror: 0 };
    // The mirror at the pixel's own world point (the pixel center, not the
    // asked point), at the same time.
    out.mirror = this.mirror.heightAt(out.x, out.z, this.waterTime());
    return out;
  }

  /**
   * THE DRAWN FOAM SHARE by cell class, over the frames of the given poses:
   * the water pass writes (foam, fast-shallow, slow-deep) into the output
   * target and the target is read back. Returns the mean drawn foam over the
   * fast-shallow pixels and over the slow-deep pixels, and their counts.
   */
  async measureFoam(poses: RiverPose[]): Promise<{ fastShallow: number; slowDeep: number; nFast: number; nSlow: number }> {
    await this.settled();
    this.holdLoop = true;
    const saved = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone(), fov: this.camera.fov };
    const dbg = this.waterMat.uniforms.uDebug.value;
    this.waterMat.uniforms.uDebug.value = 3;
    let fSum = 0; let fN = 0; let sSum = 0; let sN = 0;
    const w = this.width;
    const h = this.height;
    for (const p of poses) {
      this.setPose(p);
      await this.render();
      const buf = await this.readPixels(this.finalRT.texture, 0, 0, w, h) as Uint16Array;
      for (let k = 0; k < w * h; k += 1) {
        const foam = THREE.DataUtils.fromHalfFloat(buf[k * 4]);
        const fs = THREE.DataUtils.fromHalfFloat(buf[k * 4 + 1]);
        const sd = THREE.DataUtils.fromHalfFloat(buf[k * 4 + 2]);
        const a = THREE.DataUtils.fromHalfFloat(buf[k * 4 + 3]);
        // Alpha 0.25 marks a whole water pixel (the copied scene carries
        // alpha 1; a pixel on the water's edge resolves in between and is
        // left out).
        if (Math.abs(a - 0.25) > 0.02) continue;
        if (fs > 0.5) { fSum += foam; fN += 1; }
        if (sd > 0.5) { sSum += foam; sN += 1; }
      }
    }
    this.waterMat.uniforms.uDebug.value = dbg;
    this.camera.position.copy(saved.pos);
    this.camera.quaternion.copy(saved.quat);
    this.camera.fov = saved.fov;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.holdLoop = false;
    return { fastShallow: fN ? fSum / fN : 0, slowDeep: sN ? sSum / sN : 0, nFast: fN, nSlow: sN };
  }

  /** The boat camera's state while it is pinned: the boat's heading and place last frame. */
  private follow: { heading: number; last: THREE.Vector3 } | null = null;

  /**
   * THE BOAT CAMERA, ONE FRAME (rivers round 4; the ocean viewer's
   * `followStep`, SideBySideOcean.tsx). Call it EVERY frame while the camera
   * is pinned, after the floaters have moved to this frame's time and with
   * this frame's drag and wheel input:
   *   1. read the boat's place and heading now;
   *   2. take the camera's distance to where the boat WAS last frame (the
   *      wheel scales it by `zoom`);
   *   3. take the camera's own forward direction (a drag turns it: `dYaw`
   *      about the vertical, `dPitch` up or down);
   *   4. turn that direction by the boat's change of heading;
   *   5. put the camera at the boat less that direction times the distance;
   *   6. look at the boat.
   * The first frame starts from `followPose` (a three-quarter view from
   * behind). The camera keeps the exposure it metered then. `null` clears it.
   */
  followBoatStep(dYaw = 0, dPitch = 0, zoom = 1): void {
    const s = this.floaters.last;
    if (!s) return;
    const cam = this.camera;
    const tgt = this.floaters.boatPosition().add(new THREE.Vector3(0, 0.03, 0));
    const Y = new THREE.Vector3(0, 1, 0);
    if (!this.follow) {
      const p = this.floaters.followPose();
      cam.position.set(p.pos[0], p.pos[1], p.pos[2]);
      cam.fov = p.fov;
      cam.updateProjectionMatrix();
      cam.lookAt(tgt);
      cam.updateMatrixWorld();
      this.follow = { heading: s.boat.heading, last: tgt.clone() };
      this.meterDirty = true;
    }
    const f = this.follow;
    const dist = Math.max(0.3, Math.min(15, cam.position.distanceTo(f.last) * zoom));
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    // The drag: yaw about the vertical, then pitch about the camera's right
    // axis, kept between 5 and 85 degrees down.
    fwd.applyAxisAngle(Y, -dYaw);
    const right = new THREE.Vector3().crossVectors(fwd, Y).normalize();
    const down = Math.asin(Math.max(-1, Math.min(1, -fwd.y)));
    const pitch = Math.max(0.09, Math.min(1.48, down + dPitch)) - down;
    fwd.applyAxisAngle(right, -pitch);
    // The boat's turn: heading runs from +x toward +z, a turn about three's
    // +y the other way.
    const dh = Math.atan2(Math.sin(s.boat.heading - f.heading), Math.cos(s.boat.heading - f.heading));
    fwd.applyAxisAngle(Y, -dh);
    cam.position.copy(tgt).addScaledVector(fwd, -dist);
    if (cam.position.y < tgt.y + 0.08) cam.position.y = tgt.y + 0.08;
    cam.lookAt(tgt);
    cam.updateMatrixWorld();
    f.heading = s.boat.heading;
    f.last.copy(tgt);
    this.reflPlaneY = this.levelNear(tgt.x, tgt.z);
  }

  /** The ground and water samplers, built once (for the free camera's floor). */
  private samplers: ReturnType<typeof riverSamplers> | null = null;

  /**
   * A FREE CAMERA'S FLOOR (rivers round 4): at least 0.25 m over the water
   * and the ground where it is, so a person flying low does not go under the
   * river or into a bank.
   */
  keepCameraAboveFloor(minM = 0.25): void {
    if (!this.samplers) this.samplers = riverSamplers(this.data);
    const c = this.camera.position;
    const g = this.samplers.groundAt(c.x, c.z);
    const lv = this.samplers.levelAt(c.x, c.z);
    const floor = Math.max(g, lv) + minM;
    if (c.y < floor) {
      c.y = floor;
      this.camera.updateMatrixWorld();
    }
  }

  /**
   * The mirror plane for a free camera: the water level where its view meets
   * the water.
   *
   * THE FLIP (Remy, 2026-09-29: the reflection "flippers" when the camera
   * turns). The old rule found the look point by cutting the view ray with the
   * PREVIOUS plane, then read the water level there. On a river with two
   * levels (a node raised 5 m beside a pool 1.5 m lower) that fed back on
   * itself: a high plane cut the ray short, onto the low pool; the low plane
   * cut it long, onto the high water; and the plane alternated between 2.56 m
   * and 4.06 m on every step of one drag (`.agent/scratch/river-live/flip`,
   * steps 22 to 25). Two changes, both only on this free-camera path (a pinned
   * pose and the boat camera set the plane as before, so the captures do not
   * change):
   *   1. The ray is walked until it meets the water or the ground, so the look
   *      point never depends on the last plane.
   *   2. The plane eases toward that level at a bounded rate, so a real change
   *      of water body never pops within one frame.
   */
  mirrorPlaneFromCamera(): void {
    if (!this.samplers) this.samplers = riverSamplers(this.data);
    const smp = this.samplers;
    const { nx, nz, dx, x0, z0 } = this.data.grid;
    const wetAt = (x: number, z: number): boolean => {
      const i = Math.floor((x - x0) / dx);
      const j = Math.floor((z - z0) / dx);
      return i >= 0 && j >= 0 && i < nx && j < nz && this.data.h[j * nx + i] > 0.05;
    };
    const c = this.camera.position;
    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f);
    let target: number | null = null;
    // Walk the view ray one grid cell at a time, to 120 m.
    for (let d = dx; d <= 120; d += dx) {
      const x = c.x + f.x * d;
      const y = c.y + f.y * d;
      const z = c.z + f.z * d;
      if (wetAt(x, z) && y <= smp.levelAt(x, z)) { target = this.levelNear(x, z); break; }
      if (y <= smp.groundAt(x, z)) { target = this.levelNear(x, z); break; }
    }
    // The view meets nothing within reach (the sky, or past the grid): the
    // water nearest the camera itself.
    if (target === null) target = this.levelNear(c.x, c.z);
    const now = performance.now();
    const dt = this.planeEaseAt === null ? 0.1 : Math.min(0.1, (now - this.planeEaseAt) / 1000);
    this.planeEaseAt = now;
    const maxStep = dt * RIVER_MIRROR_PLANE_RATE_M_PER_S;
    const diff = target - this.reflPlaneY;
    this.reflPlaneY += Math.max(-maxStep, Math.min(maxStep, diff));
  }

  /** Let the boat camera go (the next `followBoatStep` starts it again). */
  unpinBoat(): void {
    this.follow = null;
  }

  /** The water clock now, s (pinned or running). */
  get clock(): number {
    return this.waterTime();
  }

  /** The floaters' own clock, s: the water clock less when an edit last started them again. */
  get floaterClock(): number {
    return this.waterTime() - this.floaterT0;
  }

  private waterTime(): number {
    return this.pinnedTime ?? (performance.now() - this.t0) / 1000;
  }

  /** Mirror the main camera in the plane y = reflPlaneY (the three.js Reflector's method). */
  private updateReflection(): void {
    const cam = this.camera;
    const y0 = this.reflPlaneY;
    const normal = new THREE.Vector3(0, 1, 0);
    const planePoint = new THREE.Vector3(cam.position.x, y0, cam.position.z);
    const view = new THREE.Vector3().subVectors(planePoint, cam.position);
    view.reflect(normal).negate().add(planePoint);
    const rot = new THREE.Matrix4().extractRotation(cam.matrixWorld);
    const lookAt = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(cam.position);
    const target = new THREE.Vector3().subVectors(planePoint, lookAt);
    target.reflect(normal).negate().add(planePoint);
    const rc = this.reflCam;
    rc.position.copy(view);
    rc.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    rc.lookAt(target);
    rc.far = cam.far;
    rc.near = cam.near;
    rc.updateMatrixWorld();
    rc.projectionMatrix.copy(cam.projectionMatrix);
    rc.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
    this.reflMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.reflMatrix.multiply(rc.projectionMatrix);
    this.reflMatrix.multiply(rc.matrixWorldInverse);
    // Oblique near plane at the water plane (Lengyel 2005), so the bed and
    // anything else under the water never draws into the reflection.
    // WEBGPU'S DEPTH RUNS 0..1 (2026-09-30). In WebGL's clip space the near
    // plane is z = -w, so the third row was 2 C / (C . q) + (0, 0, 1, 0). In
    // WebGPU's it is z = 0, so the plane C itself is the near plane: the third
    // row is C / (C . q), with no + 1 (three's ReflectorNode does the same).
    // q is the far corner in view space: (1 + P[10]) / P[14] is 1 / far in
    // both conventions. The WebGL build's bias of 0.003 on its 2 / (C . q)
    // scale kept a slack of 0.0015 |z| below the plane; 0.0015 on this scale
    // keeps the same slack.
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, planePoint);
    plane.applyMatrix4(rc.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = rc.projectionMatrix;
    const q = new THREE.Vector4(
      (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0],
      (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5],
      -1,
      (1 + pm.elements[10]) / pm.elements[14],
    );
    clip.multiplyScalar(1 / clip.dot(q));
    pm.elements[2] = clip.x;
    pm.elements[6] = clip.y;
    pm.elements[10] = clip.z - 0.0015;
    pm.elements[14] = clip.w;
  }

  /**
   * THE CAMERA'S AUTO EXPOSURE (rivers round 3). All three clips are
   * auto-exposed video: the Merced camera stopped down for its bright
   * granite, the Nerang camera opened up for its dark forest (its sky clips
   * to white and its water mirrors that). One fixed exposure put our Nerang
   * frame 30 % under the clip and the Merced frames 15 % over. This meters
   * the whole frame as a camera does, the log-average luminance of the HDR
   * frame on a 48 x 27 grid with a mild center weight, and sets the exposure
   * to bring it to `RIVER_LIGHT.exposureKey`, within 0.5 to 2.2. It is one
   * number for the whole frame (the water, the rocks and the forest alike),
   * metered again when the pose or the size changes, so a capture at a pinned
   * time is still a pure function of (seed, time, pose).
   */
  exposure = RIVER_LIGHT.exposure;
  meterDirty = true;
  lastMeter = { logAvg: 0, exposure: 1 };
  autoExposure = true;

  private async meter(): Promise<void> {
    this.meterDirty = false;
    if (!this.autoExposure) { this.exposure = RIVER_LIGHT.exposure; return; }
    const r = this.renderer;
    const W = 48;
    const H = 27;
    if (!this.meterRT) this.meterRT = new THREE.RenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: false });
    this.quad.material = this.meterQ.material;
    this.meterQ.color.value = this.off.water ? this.sceneRT.texture : this.finalRT.texture;
    r.setRenderTarget(this.meterRT);
    r.render(this.quadScene, this.quadCam);
    r.setRenderTarget(null);
    // (WebGPU reads back asynchronously; the frame waits for it, see render.
    // The rows come from the top; the center weight is the same either way.)
    const buf = await this.readPixels(this.meterRT.texture, 0, 0, W, H) as Uint16Array;
    const f = THREE.DataUtils.fromHalfFloat;
    let sw = 0;
    let sl = 0;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const k = (y * W + x) * 4;
        const lum = 0.2126 * f(buf[k]) + 0.7152 * f(buf[k + 1]) + 0.0722 * f(buf[k + 2]);
        const cx = (x + 0.5) / W - 0.5;
        const cy = (y + 0.5) / H - 0.5;
        const w = 1 - 0.6 * Math.min(1, (cx * cx + cy * cy) * 4);
        sl += w * Math.log(Math.max(lum, 1e-4));
        sw += w;
      }
    }
    const logAvg = Math.exp(sl / sw);
    this.exposure = Math.min(2.2, Math.max(0.5, RIVER_LIGHT.exposureKey / logAvg));
    this.lastMeter = { logAvg, exposure: this.exposure };
  }

  private meterRT: THREE.RenderTarget | null = null;
  /** The meter a frame waits for (WebGPU), or null. */
  private metering: Promise<void> | null = null;

  /**
   * Draw one frame. The promise resolves when the frame is out (at once,
   * unless the frame meters the exposure first: see `meter`). A call while a
   * frame waits for its meter returns that frame's promise and draws nothing.
   */
  async render(): Promise<void> {
    if (this.metering) return this.metering;
    const r = this.renderer;
    const t = this.waterTime();
    const wu = this.waterMat.uniforms;
    const bankU = this.bankMat.userData.riverUniforms as Record<string, TslNode>;
    wu.uTime.value = t;
    bankU.uTime.value = t;
    this.floaters.group.visible = this.floatersOn;
    if (this.floatersOn) this.floaters.update(t - this.floaterT0);
    this.cullIfMoved();

    // 1. Reflection: the sky with the camera's own projection, then the
    // scene with the oblique clip.
    if (!this.off.reflection) {
      this.updateReflection();
      const oblique = this.reflCam.projectionMatrix.clone();
      this.reflCam.projectionMatrix.copy(this.camera.projectionMatrix);
      this.sky.position.copy(this.reflCam.position);
      // No sun disk in the mirror: the water's own glint (GGX on the rippled
      // normal) draws the sun's reflection. The mirror's copy of the disk,
      // blurred by the rough water's mip level, drew one smooth white blob
      // on the riffle (rivers round 2).
      this.skyU.uSunDisk.value = 0;
      r.setRenderTarget(this.reflRT);
      r.clear();
      r.render(this.skyScene, this.reflCam);
      this.skyU.uSunDisk.value = 1;
      this.reflCam.projectionMatrix.copy(oblique);
      r.render(this.scene, this.reflCam);
      // The copy into the mipmapped target (see reflMipRT).
      this.quad.material = this.blitQ.material;
      this.blitQ.color.value = this.reflRT.texture;
      r.setRenderTarget(this.reflMipRT);
      r.render(this.quadScene, this.quadCam);
    }
    // 2. Opaque.
    this.sky.position.copy(this.camera.position);
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(this.skyScene, this.camera);
    r.render(this.scene, this.camera);
    // 3. Copy with depth, then the water. With the water ablated (a cost
    // measurement), the copy goes too: the frame is then the plain scene
    // through the same output pass, and the difference is the whole cost of
    // the water (with the reflection pass, when that is ablated as well).
    if (!this.off.water) {
      this.quad.material = this.copyQ.material;
      this.copyQ.color.value = this.sceneRT.texture;
      this.copyQ.depth.value = this.sceneRT.depthTexture;
      r.setRenderTarget(this.finalRT);
      r.clear();
      r.render(this.quadScene, this.quadCam);
      wu.uSceneColor.value = this.sceneRT.texture;
      wu.uSceneDepth.value = this.sceneRT.depthTexture;
      wu.uReflection.value = this.reflMipRT.texture;
      wu.uReflMatrix.value.copy(this.reflMatrix);
      wu.uReflPlaneY.value = this.reflPlaneY;
      wu.uResolution.value.set(this.width, this.height);
      wu.uNear.value = this.camera.near;
      wu.uFar.value = this.camera.far;
      r.render(this.waterScene, this.camera);
    }
    // 3b. METERING (rivers round 3): the camera's auto exposure, as a video
    // camera's. See `meter`. (WebGPU: the frame waits for the read-back, so
    // it goes out with its own exposure, as it did in WebGL.)
    if (this.meterDirty) {
      const m = this.meter();
      this.metering = m;
      try {
        await m;
      } finally {
        this.metering = null;
      }
    }
    this.outQ.exposure.value = this.exposure;
    // 4. Output.
    this.quad.material = this.outQ.material;
    this.outQ.color.value = this.showTarget === 1 || this.off.water ? this.sceneRT.texture
      : this.showTarget === 2 ? this.reflMipRT.texture : this.finalRT.texture;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
    // 5. The overlay (the live river's edit handles), over the finished frame.
    if (this.overlay) r.render(this.overlay, this.camera);
    this.frames += 1;
  }

  /**
   * Time n frames with the GPU finished each time (WebGPU: the queue's
   * submitted work done; WebGL read a 1 x 1 pixel). Returns ms per frame. The
   * page's loop is held while it runs. Use A/B in the same minutes: the GPU
   * is shared with other work on this machine.
   */
  async bench(n = 60): Promise<{ msPerFrame: number; frames: number }> {
    await this.settled();
    this.holdLoop = true;
    try {
      const device = this.device;
      await this.render();
      await device.queue.onSubmittedWorkDone();
      const t0 = performance.now();
      for (let i = 0; i < n; i += 1) {
        await this.render();
        await device.queue.onSubmittedWorkDone();
      }
      return { msPerFrame: (performance.now() - t0) / n, frames: n };
    } finally {
      this.holdLoop = false;
    }
  }

  /** Project a world point to canvas pixels (y down). */
  worldToScreen(x: number, y: number, z: number): [number, number] {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * this.width, (1 - (v.y * 0.5 + 0.5)) * this.height];
  }

  dispose(): void {
    this.sceneRT.dispose();
    this.finalRT.dispose();
    this.reflRT.dispose();
    this.reflMipRT.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.water.geometry.dispose();
    this.waterMat.material.dispose();
    this.bankMat.dispose();
    this.meterRT?.dispose();
    this.renderer.dispose();
  }
}

/** Boulder top at (x, z), m, over all boulders, or -Infinity (for probes). */
export function boulderTop(list: Boulder[], x: number, z: number): number {
  let top = -Infinity;
  for (const b of list) {
    const t = boulderTopAt(b, x, z);
    if (t > top) top = t;
  }
  return top;
}
