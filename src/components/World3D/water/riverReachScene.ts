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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 21/10/2026, 13:13:41
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx, components/DesignPreview/steps/water/riverSectionLabels.ts, components/World3D/water/RiverCavityPreviewPanel.tsx, components/World3D/water/RiverTerrainBrushView.ts, components/World3D/water/riverEditHandles.ts, components/World3D/water/riverExperimentStations.ts, components/World3D/water/waterfallTerrainComparisonView.ts
 * Imports: 37 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { riverRendererRequiredLimits } from '@/systems/world3d/river/riverGpuLimits';

import { WaterfallReconstructedFluid } from './waterfallReconstructedFluid';
import { runWaterfallMpmDiagnostic, DIAGNOSTIC_LEDGE, type WaterfallMpmStatus } from './waterfallMpmDiagnostic';
import { Fn, storage, instanceIndex } from 'three/tsl';
import { WaterfallTerrainComparisonView, type ComparisonState } from './waterfallTerrainComparisonView';
import { createWaterfallPaceMeter } from './waterfallPaceMeter';
import { appendWaterfallCoreCollar, createWaterfallCoreSampler, waterfallSourceShelfHeight } from './riverWaterfallCliff';
import { NativeCollarEdgeRecorder, nativeGroundBoundaryMetadata, bindNativeBoundaryEpoch } from './riverNativeBoundaryAtlas';
import * as THREE from 'three/webgpu';
import { RiverPerformanceHeatmap, type RiverHeatmapReading } from './riverPerformanceHeatmap';
import { withRiverGeometryDisposal } from './riverGeometryDisposal';
import { getPerfSessions } from '@/devtools/perf/perfRegistry';
import CubeRenderTarget from 'three/src/renderers/common/CubeRenderTarget.js';
import { configureHeadwatersGrid,riverReconstructionEnabled,mainReconstructionOwnership, WATERFALL, projectMainRapids, MAIN_CHANNEL_S, waterfallRockBoundary, riverHeadwatersEnabled } from '@/systems/world3d/river/riverHeadwaters';
import { RAPIDS_WATERFALL_SEQUENCE } from '@/systems/world3d/river/waterfallTerrainProfiles';
import { buildRiverLandTransition } from '@/systems/world3d/river/riverTerrainLod';
import {reconstructionSection,RECONSTRUCTION_FALLS} from '@/systems/world3d/river/riverRapidsReconstruction';
import {getSistersCliffSurface} from './riverSistersCliffSurface';
import {
  acesFilmicToneMapping, attribute, clamp, dot, ivec2, max, min, mix, modelWorldMatrix, normalize, positionGeometry, positionLocal, positionWorld, pow,
  screenCoordinate, screenUV, texture, uv, select, smoothstep, normalView, transformedNormalWorld, uniform, varying, vec2, vec3, vec4,
} from 'three/tsl';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { RiverReachData } from '@/systems/world3d/river/riverWorker';
// C12: one spawn owner for riverWorker, and the shared one-shot worker helper
// (always terminates the worker on done, error or crash).
import { spawnRiverWorker } from '@/systems/world3d/river/riverWorkerSpawn';
import { runWorkerTask } from '@/workers/workerClient';
import {
  boulderTopAt, boulderBounds, mainBoulderShape, courseKeyAt, defaultRiverCourse, getRiverCourseEdit, mulberry32, riverBaseHalfWidthAt, riverCourseFor, riverCoursePoints, riverLateralN, riverShapeKey, setRiverCourseEdit,
  setRiverShape, valueNoise, RIVER_SHAPE_DEFAULT, type Boulder, type RiverShape,
} from '@/systems/world3d/river/riverReach';
import type { WaterSheetArrays } from '@/systems/world3d/river/riverWaterSheet';
import type { RiverFlowMap } from '@/systems/world3d/river/riverFlowField';
import { inspectRiverQuad, type QuadSnapshotCertificate } from '@/systems/world3d/river/riverQuadInspection';
import type { LiveBedPatch, LiveFlowSnapshot } from '@/systems/world3d/river/riverLive';
import { RIVER_FAR_LEVEL, riverFarLevelAt, type RiverCoarseLevel } from '@/systems/world3d/river/riverFlowPatch';
import {
  buildRiverWaterGeometry, riverTexture, riverWaterGeometryFrom, riverStandingGeometryFrom, type RiverWaterMaterial,
} from './riverWaterMaterial';
import { createRiverBankMaterial, riverGroundSurfaceNodes } from './riverBankMaterial';
import { buildRiverVegetation } from './riverVegetation';
import { RiverSurfaceMirror } from './riverSurfaceMirror';
import { shareRiverWorldMatrices } from './riverFrameMatrices';
import { RiverGroundBatch } from './riverGroundBatch';
import { captureRiverBankTerrainSnapshot, type RiverBankTerrainSource, type RiverBankTerrainCaptureResult } from './riverBankTerrainSnapshot';
import { preparedReceivingGeometry, receivingSheetMatches, type RiverReceivingConfiguration,
  type RiverViewFlowSnapshot } from './riverReceivingRefiner';
import { RiverFloatersView } from './riverFloatersView';
import { RiverDroppedObjectsView } from './riverDroppedObjectsView';
import { createRiverCliffMaterial, RiverWaterfallView } from './riverWaterfallView';
import { RiverFlowBlockersView } from './riverFlowBlockersView';
import { RiverSpillView, trimSpillSurface } from './riverSpillView';
import type { RiverDropKind } from '@/systems/world3d/river/riverDroppedObjects';
import { RiverExperimentStations, type ExperimentStationReading } from './riverExperimentStations';
import { buildMirrorMask, mirrorMaskHits, type MirrorMask } from './riverMirrorMask';
import { RiverMirror } from './riverMirrorCamera';
import { RiverWaterLayer } from './riverWaterLayer';

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
  // The upstream sequence and both branches, without replacing the older
  // close views used to compare the original water treatment.
  'river-system': { pos: [45, 185, 92], look: [40, 5, 20], fov: 76 },
  'waterfall-pool': { pos: [-60, 75, 55], look: [-127, 40, -18], fov: 62 },
  // The raised pool, short outlet drop and sloping runoff can be inspected
  // together, using the same live water as the original downstream views.
  'pool-spill': { pos: [-79, 34, 8], look: [-115, 18, -12], fov: 55 },
  // Inspect the actual source surface and exposed lip, rather than judging
  // their material only through the distant main fall.
  'waterfall-side': { pos: [-90, 50, -48], look: [-153, 46, -34], fov: 85 },
  'waterfall-crest': { pos: [-160, 94, -60], look: [-164, 78, -41], fov: 58 },
  'rapids-split': { pos: [45, 100, 58], look: [35, 4, 24], fov: 60 },
  // Low on the main channel's north bank, looking upstream over its actual
  // rocks. This makes wave shape and motion judgeable beside Merced footage;
  // the aerial split view remains available for connectivity inspection.
  'rapids-along': { pos: [70, 6.2, -0.5], look: [35, 3.65, 17.9], fov: 58 },
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
  // C12: same request/reply protocol as before ({ seed, shape } -> progress* ->
  // done | error); runWorkerTask owns spawn and guaranteed termination.
  const data = await runWorkerTask<
    { seed: number; shape: RiverShape },
    { type: string; f?: number; stage?: string; data?: RiverReachData; message?: string },
    RiverReachData
  >({
    factory: spawnRiverWorker,
    request: { seed, shape },
    errorPrefix: '[river] The flow worker failed',
    handle: (m, settle) => {
      if (m.type === 'progress') onProgress?.(m.f ?? 0, m.stage ?? '');
      else if (m.type === 'done' && m.data) settle.resolve(m.data);
      else if (m.type === 'error') settle.reject(new Error(m.message));
    },
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


/** Main-channel optical correction has an explicit ownership map. A cell
 * belongs to the main rapids only when it is nearer than the original river,
 * inside the channel and within the reference's three-lip reach. */
export function mainRapidsOpticsMask(grid: RiverFlowMap['grid'], target?: THREE.DataTexture): THREE.DataTexture {
  const sameSize = target?.image.width === grid.nx && target.image.height === grid.nz;
  const bytes = sameSize ? target!.image.data as Uint8Array : new Uint8Array(grid.nx * grid.nz * 4);
  // Ownership follows the actual editable original curve. A dragged original
  // channel must not acquire main-channel optics from its former position.
  // Reuse bytes when refreshing so the floaters' CPU mask stays identical.
  const original = riverCourseFor(getRiverCourseEdit());
  const smooth = (v: number) => { const a = Math.max(0, Math.min(1, v)); return a * a * (3 - 2 * a); };
  for (let c = 0; c < grid.nx * grid.nz; c += 1) {
    const x = grid.x0 + (c % grid.nx + 0.5) * grid.dx;
    const z = grid.z0 + (Math.floor(c / grid.nx) + 0.5) * grid.dx;
    const main = projectMainRapids(x, z); const old = original.project(x, z);
    const u = main.s - MAIN_CHANNEL_S;
    // The fork joins two surface approximations with different facet/Fresnel
    // responses. Introduce the main treatment over its local channel width,
    // rather than two grid cells, as the branches separate. Distance difference
    // has gradient at most two, so this spans at least one half-width on land.
    // The two-meter original/source guard stays exactly zero. Downstream fully
    // separated interiors and their existing exit fade retain the main model.
    // One shared mask weights surface drivers, normals and geometry before
    // shading; this is not a final-color blend or a turbulent mixing model.
    const halfWidth = courseKeyAt(main.s).halfW;
    const transition = Math.max(4 * grid.dx, 2 * halfWidth);
    const ownership = smooth((old.d - main.d - 2) / transition);
    const share = ownership * smooth((u - 35) / transition) * smooth((113 - u) / 6) * smooth(halfWidth - main.d);
    bytes[c * 4] = Math.round(255 * share); bytes[c * 4 + 3] = 255;
  }
  const mask = target ?? new THREE.DataTexture(bytes, grid.nx, grid.nz, THREE.RGBAFormat, THREE.UnsignedByteType);
  if (!sameSize) mask.image = { data: bytes, width: grid.nx, height: grid.nz };
  mask.magFilter = THREE.LinearFilter; mask.minFilter = THREE.LinearFilter;
  mask.needsUpdate = true; return mask;
}

export function flowMapOf(d: RiverReachData): RiverFlowMap {
  return { grid: d.grid, t0: d.t0, t1: d.t1, t2: d.t2, surface: d.surface, stats: d.mapStats };
}

/**
 * THE GROUND: the solver grid's cells as vertices (0.5 m), and the outer
 * valley on its 2 m lattice. The outer mesh skips its quads inside the solver
 * grid and sinks its vertices inside the grid's edge band by up to 0.3 m, so
 * the fine mesh always wins where the two overlap and no crack opens at the
 * seam. Normals from central differences of the heights.
 */
/**
 * Keep the existing gradient normals outside the native cliff repair mask.
 * Three 0.172 accumulates each retained face into Float32 vertex normals,
 * then normalizes. Repeat that arithmetic and face order only for selected
 * vertices, avoiding a full copy just to restore every unselected normal.
 */
function computeSelectedGroundNormals(g: THREE.BufferGeometry, selected: Uint8Array): void {
  const index = g.index!;
  const position = g.getAttribute('position');
  const normal = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let v = 0; v < normal.count; v++) if (selected[v]) normal.setXYZ(v, 0, 0, 0);
  const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
  const nA = new THREE.Vector3(), nB = new THREE.Vector3(), nC = new THREE.Vector3();
  const cb = new THREE.Vector3(), ab = new THREE.Vector3();
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
    if (!selected[a] && !selected[b] && !selected[c]) continue;
    pA.fromBufferAttribute(position, a); pB.fromBufferAttribute(position, b); pC.fromBufferAttribute(position, c);
    cb.subVectors(pC, pB); ab.subVectors(pA, pB); cb.cross(ab);
    // Read all three before writing, matching Three even at a repeated index.
    if (selected[a]) nA.fromBufferAttribute(normal, a);
    if (selected[b]) nB.fromBufferAttribute(normal, b);
    if (selected[c]) nC.fromBufferAttribute(normal, c);
    if (selected[a]) nA.add(cb);
    if (selected[b]) nB.add(cb);
    if (selected[c]) nC.add(cb);
    if (selected[a]) normal.setXYZ(a, nA.x, nA.y, nA.z);
    if (selected[b]) normal.setXYZ(b, nB.x, nB.y, nB.z);
    if (selected[c]) normal.setXYZ(c, nC.x, nC.y, nC.z);
  }
  for (let v = 0; v < normal.count; v++) if (selected[v]) {
    nA.fromBufferAttribute(normal, v).normalize(); normal.setXYZ(v, nA.x, nA.y, nA.z);
  }
  normal.needsUpdate = true;
}

/**
 * Native ground construction finishes these reads synchronously, before a
 * later patch can edit its private input. Borrow unchanged heights and keep
 * only pages containing an exact source-shelf correction. Shared inputs keep
 * the former private Float64 snapshot so their ownership is unchanged.
 */
function nativeGroundHeightReader(d: RiverReachData): (cell: number) => number {
  const shared = typeof SharedArrayBuffer !== 'undefined' && d.ground.buffer instanceof SharedArrayBuffer;
  const heights = shared ? Float64Array.from(d.ground) : d.ground;
  const source = riverHeadwatersEnabled() ? defaultRiverCourse() : null;
  const { nx, dx, x0, z0 } = d.grid;
  const correctedHeight = (c: number): number => {
    const h = heights[c];
    if (!source || !(h > 76)) return h;
    const p = source.project(x0 + (c % nx + 0.5) * dx, z0 + (Math.floor(c / nx) + 0.5) * dx);
    return h + waterfallSourceShelfHeight(p.s - WATERFALL.crestS, p.n, 10 * (d.shape?.widthScale ?? 1));
  };
  if (shared) {
    if (source) for (let c = 0; c < heights.length; c++) heights[c] = correctedHeight(c);
    return c => heights[c];
  }
  const pageSize = 4_096;
  const pages = new Map<number, Float64Array>();
  let first = heights.length, last = -1;
  if (source) for (let c = 0; c < heights.length; c++) if (heights[c] > 76) {
    const h = correctedHeight(c);
    if (h === heights[c]) continue;
    const key = Math.floor(c / pageSize), start = key * pageSize;
    let page = pages.get(key);
    if (!page) {
      page = new Float64Array(Math.min(pageSize, heights.length - start));
      for (let q = 0; q < page.length; q++) page[q] = heights[start + q];
      pages.set(key, page);
    }
    page[c - start] = h;
    if (c < first) first = c;
    last = c;
  }
  return c => {
    if (c < first || c > last) return heights[c];
    const page = pages.get(Math.floor(c / pageSize));
    return page ? page[c % pageSize] : heights[c];
  };
}

/**
 * Build ground shading attributes only on the final drawing tiles. The same
 * Float32 positions, material choices and rounding produce the same values,
 * including duplicated tile vertices, without full-source copies to discard.
 * The untiled collar is its own final tile and keeps this same treatment.
 */
function decorateGroundTile(g0: THREE.BufferGeometry, sistersNative: unknown): void {
  const groundPos = g0.getAttribute('position');
  if (riverReconstructionEnabled()) {
    // Install one-hot owners before materials or cached batches see this tile.
    // Their interpolated weights blend soil/source/granite continuously;
    // changing the schema after batching would leave an older cached proxy.
    const kinds = g0.getAttribute('aKind');
    const weights = new Float32Array(groundPos.count * 3);
    for (let i = 0; i < groundPos.count; i += 1) {
      const kind = kinds.getX(i);
      weights[i * 3 + (kind > 1.5 ? 2 : kind > 0.5 ? 1 : 0)] = 1;
    }
    g0.setAttribute('aGroundSurfaceWeights', new THREE.BufferAttribute(weights, 3));
  }
  const groundUV = new Float32Array(groundPos.count * 2);
  for (let i = 0; i < groundPos.count; i += 1) {
    if(sistersNative){
      const frame=getSistersCliffSurface().crest,x=groundPos.getX(i)-frame.x,z=groundPos.getZ(i)-frame.z;
      groundUV[i*2]=(x*frame.tz-z*frame.tx)/2.4;groundUV[i*2+1]=groundPos.getY(i)/2.4;
    }else{groundUV[i * 2] = groundPos.getX(i) / 2.4; groundUV[i * 2 + 1] = groundPos.getZ(i) / 2.4;}
  }
  g0.setAttribute('uv', new THREE.BufferAttribute(groundUV, 2));
}

export function buildGround(d: RiverReachData): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const seamPositions: number[] = [];
  const sisters=riverReconstructionEnabled()?getSistersCliffSurface():null;
  const sistersCollars:number[]=[];
  const seamRecorder = new NativeCollarEdgeRecorder();
  const sourceCourseForSeams = riverHeadwatersEnabled() ? defaultRiverCourse() : null;
  const sampleCore = sourceCourseForSeams ? createWaterfallCoreSampler({ seed: d.seed, shape: d.shape ?? RIVER_SHAPE_DEFAULT, course: sourceCourseForSeams }) : null;
  const sourceCrest = sourceCourseForSeams?.at(WATERFALL.crestS);
  const { nx, nz, dx, x0, z0 } = d.grid;
  {
    const pos = new Float32Array(nx * nz * 3);
    const nor = new Float32Array(nx * nz * 3);
    const heightAt = nativeGroundHeightReader(d);
    const kind = new Float32Array(nx * nz);
    const tone = new Float32Array(nx * nz);
    const sourceCourse = riverHeadwatersEnabled() ? defaultRiverCourse() : null;
    const gorge = sourceCourse ? RAPIDS_WATERFALL_SEQUENCE[0] : null;
    for (let j = 0; j < nz; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = j * nx + i;
        pos[c * 3] = x0 + (i + 0.5) * dx;
        pos[c * 3 + 1] = heightAt(c);
        pos[c * 3 + 2] = z0 + (j + 0.5) * dx;
        if (sourceCourse && heightAt(c) > 76) {
          const source = sourceCourse.project(pos[c * 3], pos[c * 3 + 2]);
          // The source is cut into exposed granite, rather than a gravel
          // trough at the edge of a brown hillside. Reuse the existing rock
          // shader; ordinary downstream bed and bank treatment stays intact.
          if (source.s < -155 && Math.abs(source.n) < 144) {
            kind[c] = 1; tone[c] = 0.36;
          }
        }
        // The newly exposed gorge is bedrock, not downstream gravel stretched
        // up a cliff. Reuse the native granite/lichen/wet-stain shader. The
        // bounding check avoids projecting every distant terrain vertex, and
        // original-course ownership leaves the quiet river's surface intact.
        let soilTop=false,soilBank=false;
        if(sourceCourse&&riverReconstructionEnabled()&&pos[c*3]>75){
          const p=projectMainRapids(pos[c*3],pos[c*3+2]);
          const original=sourceCourse.project(pos[c*3],pos[c*3+2]);
          // Use the same valley ownership as the actual bed carve. Nearest
          // branch alone leaves old material on the broad exposed cliff.
          if(mainReconstructionOwnership(p.s-MAIN_CHANNEL_S,p.d,original.d,courseKeyAt(original.s).halfW)>.5){
            kind[c]=2;tone[c]=.36;
            soilBank=p.d>courseKeyAt(p.s).halfW+6;
            if(p.s>MAIN_CHANNEL_S+RECONSTRUCTION_FALLS[3].startM&&p.s<MAIN_CHANNEL_S+RECONSTRUCTION_FALLS[3].endM)soilTop=reconstructionSection(p.s-MAIN_CHANNEL_S,p.n).soilTop;
          }
        }
        if (sourceCourse && gorge && !riverReconstructionEnabled() && pos[c*3]>=gorge.start-40 && pos[c*3]<=gorge.start+gorge.length-10) {
          const p=projectMainRapids(pos[c*3],pos[c*3+2]),u=p.s-MAIN_CHANNEL_S;
          if(u>=gorge.start-4&&u<=gorge.start+gorge.length+10&&p.d<21
            &&sourceCourse.project(pos[c*3],pos[c*3+2]).d>p.d) {
            kind[c]=2; tone[c]=.36;
          }
        }
        const hl = heightAt(j * nx + Math.max(0, i - 1));
        const hr = heightAt(j * nx + Math.min(nx - 1, i + 1));
        const hd = heightAt(Math.max(0, j - 1) * nx + i);
        const hu = heightAt(Math.min(nz - 1, j + 1) * nx + i);
        const gx = (hr - hl) / (2 * dx);
        const gz = (hu - hd) / (2 * dx);
        // The actual raised top carries native soil/ground cover. Its steep
        // exposed sides and both chutes retain granite; water uses the same bed.
        if((soilTop||soilBank)&&Math.hypot(gx,gz)<.8){kind[c]=0;tone[c]=0;}
        const l = Math.hypot(gx, 1, gz);
        nor[c * 3] = -gx / l;
        nor[c * 3 + 1] = 1 / l;
        nor[c * 3 + 2] = -gz / l;
      }
    }
    // Remove only ground quads actually covered by the finite cliff, while
    // retaining the protected original channel. Adjacent native land closes
    // against the same finite surface; this is not a second overlapping wall.
    const sistersHole=sisters?new Uint8Array(nx*nz):null;
    if(sisters&&sistersHole){
      const i0=Math.max(0,Math.floor((sisters.bounds.min.x-x0)/dx)-1),i1=Math.min(nx-2,Math.ceil((sisters.bounds.max.x-x0)/dx));
      const j0=Math.max(0,Math.floor((sisters.bounds.min.z-z0)/dx)-1),j1=Math.min(nz-2,Math.ceil((sisters.bounds.max.z-z0)/dx));
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
        const x=x0+(i+1)*dx,z=z0+(j+1)*dx;
        if(!sisters.coversQuad(x,z,dx))continue;
        const old=sourceCourse!.project(x,z),main=projectMainRapids(x,z);
        if(mainReconstructionOwnership(main.s-MAIN_CHANNEL_S,main.d,old.d,courseKeyAt(old.s).halfW)===1)sistersHole[j*nx+i]=1;
      }
    }
    const repairNormals = new Uint8Array(nx * nz);
    const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
    let k = 0;
    for (let j = 0; j < nz - 1; j += 1) {
      for (let i = 0; i < nx - 1; i += 1) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const e = c + 1;
        if(sisters&&sistersHole?.[a]){
          const corners=[a,b,e,c],neighbors=[j>0?a-nx:-1,i<nx-2?a+1:-1,j<nz-2?a+nx:-1,i>0?a-1:-1];
          for(let edge=0;edge<4;edge++)if(neighbors[edge]<0||!sistersHole[neighbors[edge]]){
            const va=corners[edge],vb=corners[(edge+1)%4];
            appendWaterfallCoreCollar(sisters.sample,
              new THREE.Vector3(pos[va*3],pos[va*3+1],pos[va*3+2]),
              new THREE.Vector3(pos[vb*3],pos[vb*3+1],pos[vb*3+2]),sisters.crest,sistersCollars);
          }
          continue;
        }
        // A heightfield cannot represent the exposed overhang: triangles
        // across its seventy-meter boundary made a pale flat curtain behind
        // low drips. The dedicated rock cliff supplies this vertical face.
        // Preserve every ordinary channel/bank triangle.
        if (riverHeadwatersEnabled() && Math.max(heightAt(a), heightAt(b), heightAt(c), heightAt(e)) - Math.min(heightAt(a), heightAt(b), heightAt(c), heightAt(e)) > 30) {
          const cliff = defaultRiverCourse().project(x0 + (i + 1) * dx, z0 + (j + 1) * dx);
          const crest = sourceCourse!.at(WATERFALL.crestS);
          const px = x0 + (i + 1) * dx - crest.x; const pz = z0 + (j + 1) * dx - crest.z;
          const lateral = px * crest.tz - pz * crest.tx;
          const forward = px * crest.tx + pz * crest.tz;
          if (Math.abs(forward - waterfallRockBoundary(lateral, 10 * (d.shape?.widthScale ?? 1))) < 45 && Math.abs(lateral) < 144 - Math.SQRT2 * dx * 0.5) {
            // The core cliff owns this face. A restored heightfield wall
            // stood in front of the real falling water and hid it. Keep
            // only the far external junctions, beyond the core's wet and
            // visible face, as original terrain closure.
            // Close only horizontal rim/floor edges against the exact core.
            // A mixed high-low edge would recreate the occluding wall.
            const corners = [a, b, e, c];
            for (let edge = 0; edge < 4; edge += 1) {
              const va = corners[edge]; const vb = corners[(edge + 1) % 4];
              if (Math.abs(heightAt(va) - heightAt(vb)) > 2) continue;
              const pa = new THREE.Vector3(pos[va * 3], heightAt(va), pos[va * 3 + 2]);
              const pb = new THREE.Vector3(pos[vb * 3], heightAt(vb), pos[vb * 3 + 2]);
              // Follow native crest/floor and interior triangle bends,
              // rather than leaving a straight chord across their junction.
              appendWaterfallCoreCollar(sampleCore!, pa, pb, sourceCrest!, seamPositions,
                edge => seamRecorder.append({grid:'fine',vertices:[va,vb],...edge}));
            }
            for (const v of corners) {
              const vi = v % nx; const vj = Math.floor(v / nx);
              for (let dj = -1; dj <= 1; dj += 1) for (let di = -1; di <= 1; di += 1) {
                const ii = vi + di; const jj = vj + dj;
                if (ii >= 0 && ii < nx && jj >= 0 && jj < nz) repairNormals[jj * nx + ii] = 1;
              }
            }
            continue;
          }
          for (const v of [a, b, c, e]) if(kind[v]!==2)kind[v] = 1;
        }
        idx[k++] = a; idx[k++] = c; idx[k++] = b;
        idx[k++] = b; idx[k++] = c; idx[k++] = e;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    g.setAttribute('aTone', new THREE.BufferAttribute(tone, 1));
    g.setIndex(new THREE.BufferAttribute(idx.subarray(0, k), 1));
    if (riverHeadwatersEnabled()) {
      const points = g.getAttribute('position');
      const crest = defaultRiverCourse().at(WATERFALL.crestS);
      for (let v = 0; v < points.count; v += 1) {
        const x = points.getX(v) - crest.x; const z = points.getZ(v) - crest.z;
        const lateral = x * crest.tz - z * crest.tx;
        const forward = x * crest.tx + z * crest.tz;
        const local = Math.abs(lateral) < 145 && Math.abs(forward - waterfallRockBoundary(lateral, 10 * (d.shape?.widthScale ?? 1))) < 6;
        if (local) repairNormals[v] = 1;
      }
      computeSelectedGroundNormals(g, repairNormals);
    }
    // Retain the cliff-only repair region when ground is tiled. Bed edits
    // must use the faces actually drawn here, rather than the removed cliff wall.
    g.setAttribute('cliffNormalRepair', new THREE.BufferAttribute(new Float32Array(repairNormals), 1));
    // Cell identity must stay exact beyond Float32's 16,777,216 integer limit.
    // It joins copied tile normals after edits; it is not a height or position.
    g.setAttribute('groundVertex', new THREE.BufferAttribute(Uint32Array.from({length: nx * nz}, (_, v) => v), 1));
    g.computeBoundingSphere();
    bindNativeBoundaryEpoch(g,nativeGroundBoundaryMetadata('fine',{seed:d.seed,nx,nz,dx,x0,z0},sourceCrest??null,
      {minX:x0,maxX:x0+nx*dx,minZ:z0,maxZ:z0+nz*dx},2*d.outer.step));
    out.push(g);
  }
  {
    const o = d.outer;
    const finePositions=out[0].getAttribute('position');
    const transition=riverReconstructionEnabled()?buildRiverLandTransition(
      {x0:x0+dx*.5,z0:z0+dx*.5,step:dx,nx,nz,height:(i,j)=>finePositions.getY(j*nx+i)},
      {x0:o.x0,z0:o.z0,step:o.step,nx:o.nx,nz:o.nz,height:(i,j)=>o.heights[j*o.nx+i]}):null;
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
    const outerKind = new Float32Array(o.nx * o.nz);
    const outerTone = new Float32Array(o.nx * o.nz);
    if(riverReconstructionEnabled())for(let c=0;c<outerKind.length;c++){
      const x=pos[c*3],z=pos[c*3+2];
      if(x<=75)continue;
      const p=projectMainRapids(x,z);
      if(p.s>=MAIN_CHANNEL_S+120&&sourceCourseForSeams!.project(x,z).d>p.d){
        const gentle=nor[c*3+1]>1/Math.hypot(1,.8);
        outerKind[c]=gentle&&p.d>courseKeyAt(p.s).halfW+6?0:2;outerTone[c]=.36;
      }
    }
    const tri: number[] = [];
    for (let j = 0; j < o.nz - 1; j += 1) {
      for (let i = 0; i < o.nx - 1; i += 1) {
        const qx0 = o.x0 + i * o.step;
        const qz0 = o.z0 + j * o.step;
        // Skip a quad lying wholly inside the grid, past its edge band.
        if(transition){
          const h=transition.hole;
          if(qx0>=h.minX&&qx0+o.step<=h.maxX&&qz0>=h.minZ&&qz0+o.step<=h.maxZ)continue;
        }else if (qx0 > gx0 + band && qx0 + o.step < gx1 - band && qz0 > gz0 + band && qz0 + o.step < gz1 - band) continue;
        const a = j * o.nx + i;
        const b = a + 1;
        const c = a + o.nx;
        const e = c + 1;
        if (riverHeadwatersEnabled() && Math.max(H[a], H[b], H[c], H[e]) - Math.min(H[a], H[b], H[c], H[e]) > 30) {
          const px = qx0 + o.step * 0.5 - sourceCrest!.x;
          const pz = qz0 + o.step * 0.5 - sourceCrest!.z;
          const lateral = px * sourceCrest!.tz - pz * sourceCrest!.tx;
          const forward = px * sourceCrest!.tx + pz * sourceCrest!.tz;
          // The outer lattice overlaps the same cliff as the fine grid.
          // Retaining its height jump recreated an invisible backboard even
          // after the fine-grid face was removed. Omit only quads wholly
          // inside the actual core; outside terrain still closes the mountain.
          const insideCore = Math.abs(lateral) < 144 - Math.SQRT2 * o.step * 0.5;
          if (insideCore && Math.abs(forward - waterfallRockBoundary(lateral, 10 * (d.shape?.widthScale ?? 1))) < 45) {
            const corners = [a, b, e, c];
            for (let edge = 0; edge < 4; edge++) {
              const va = corners[edge], vb = corners[(edge + 1) % 4];
              if (Math.abs(H[va] - H[vb]) > 2) continue;
              const pa = new THREE.Vector3(pos[va * 3], pos[va * 3 + 1], pos[va * 3 + 2]);
              const pb = new THREE.Vector3(pos[vb * 3], pos[vb * 3 + 1], pos[vb * 3 + 2]);
              // Follow native crest/floor and interior triangle bends,
              // rather than leaving a straight chord across their junction.
              appendWaterfallCoreCollar(sampleCore!, pa, pb, sourceCrest!, seamPositions,
                edge => seamRecorder.append({grid:'outer',vertices:[va,vb],...edge}));
            }
            continue;
          }
          // A steep reference face keeps its selected granite. The original
          // source-cliff tint must not overwrite it merely for being tall.
          for (const v of [a, b, c, e]) if(outerKind[v]!==2)outerKind[v] = 1;
        }
        tri.push(a, c, b, b, c, e);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(outerKind, 1));
    g.setAttribute('aTone', new THREE.BufferAttribute(outerTone, 1));
    g.setIndex(tri);
    const repair = new Float32Array(o.nx * o.nz);
    if (riverHeadwatersEnabled()) {
      const old = nor.slice(); g.computeVertexNormals();
      const normals = g.getAttribute('normal');
      const crest = defaultRiverCourse().at(WATERFALL.crestS);
      for (let v = 0; v < repair.length; v += 1) {
        const x = pos[v * 3] - crest.x; const z = pos[v * 3 + 2] - crest.z;
        const lateral = x * crest.tz - z * crest.tx;
        const forward = x * crest.tx + z * crest.tz;
        repair[v] = Number(Math.abs(lateral) < 145 && Math.abs(forward - waterfallRockBoundary(lateral, 10 * (d.shape?.widthScale ?? 1))) < 6);
        if (!repair[v]) normals.setXYZ(v, old[v * 3], old[v * 3 + 1], old[v * 3 + 2]);
      }
    }
    g.setAttribute('cliffNormalRepair', new THREE.BufferAttribute(repair, 1));
    g.setAttribute('groundVertex', new THREE.BufferAttribute(Uint32Array.from({length: repair.length}, (_, v) => v), 1));
    g.computeBoundingSphere();
    bindNativeBoundaryEpoch(g,nativeGroundBoundaryMetadata('outer',{seed:d.seed,nx:o.nx,nz:o.nz,dx:o.step,x0:o.x0,z0:o.z0},sourceCrest??null,
      transition?.hole??{minX:gx0,maxX:gx1,minZ:gz0,maxZ:gz1},transition?0:band));
    out.push(g);
    if(transition){
      const t=new THREE.BufferGeometry(),p=transition.positions,kept:number[]=[];
      for(let q=0;q<transition.indices.length;q+=3){
        const ids=Array.from(transition.indices.subarray(q,q+3));
        const ys=ids.map(i=>p[i*3+1]);
        // Keep the same native source-cliff ownership used above: a land
        // transition must not recreate the removed curtain across its core.
        if(Math.max(...ys)-Math.min(...ys)>30&&sourceCrest){
          const x=ids.reduce((sum,i)=>sum+p[i*3],0)/3-sourceCrest.x;
          const z=ids.reduce((sum,i)=>sum+p[i*3+2],0)/3-sourceCrest.z;
          const n=x*sourceCrest.tz-z*sourceCrest.tx,f=x*sourceCrest.tx+z*sourceCrest.tz;
          if(Math.abs(n)<144&&Math.abs(f-waterfallRockBoundary(n,10*(d.shape?.widthScale??1)))<45)continue;
        }
        kept.push(...ids);
      }
      const kinds=new Float32Array(p.length/3),tones=new Float32Array(p.length/3);
      for(let i=0;i<kinds.length;i++){
        kinds[i]=p[i*3]>75?2:0;
        if(kinds[i]===0&&sourceCourseForSeams){const q=sourceCourseForSeams.project(p[i*3],p[i*3+2]);if(q.s<-155&&Math.abs(q.n)<144)kinds[i]=1;}
        tones[i]=kinds[i]===0?0:.36;
      }
      t.setAttribute('position',new THREE.BufferAttribute(p,3));
      t.setAttribute('aKind',new THREE.BufferAttribute(kinds,1));
      t.setAttribute('aTone',new THREE.BufferAttribute(tones,1));
      t.setIndex(kept);t.computeVertexNormals();t.computeBoundingSphere();
      const surfaceNormal=t.getAttribute('normal');
      for(let i=0;i<kinds.length;i++)if(kinds[i]===2&&surfaceNormal.getY(i)>1/Math.hypot(1,.8)){
        const q=projectMainRapids(p[i*3],p[i*3+2]);if(q.d>courseKeyAt(q.s).halfW+6)kinds[i]=0;
      }
      // DEBT: this mixed-resolution land strip follows committed build data.
      // Dynamic boundary edits and finite-solid qualification remain open;
      // the original editable river lies inside the fine grid. It is not a
      // pressure-bearing replacement for the native source cliff.
      out.push(t);
    }
  }
  if (seamPositions.length) {
    // Collars are separate from indexed cell surfaces, so bed-patch maps
    // retain their original fine/outer slots and every normal river edit.
    // Ground is viewed from above with a front-facing material. The
    // skipped edge can run in either direction, so orient each rim/floor
    // triangle upward; downward collars looked like missing white sky.
    for (let t = 0; t < seamPositions.length; t += 9) {
      const ax = seamPositions[t + 3] - seamPositions[t];
      const az = seamPositions[t + 5] - seamPositions[t + 2];
      const bx = seamPositions[t + 6] - seamPositions[t];
      const bz = seamPositions[t + 8] - seamPositions[t + 2];
      if (az * bx - ax * bz < 0) {
        for (let k = 0; k < 3; k += 1) {
          const value = seamPositions[t + 3 + k];
          seamPositions[t + 3 + k] = seamPositions[t + 6 + k];
          seamPositions[t + 6 + k] = value;
        }
      }
    }
    const seam = new THREE.BufferGeometry();
    seam.setAttribute('position', new THREE.Float32BufferAttribute(seamPositions, 3));
    seam.setAttribute('aKind', new THREE.Float32BufferAttribute(new Float32Array(seamPositions.length / 3).fill(1), 1));
    seam.setAttribute('aTone', new THREE.Float32BufferAttribute(new Float32Array(seamPositions.length / 3).fill(0.36), 1));
    seam.computeVertexNormals(); seam.computeBoundingSphere();
    // Only original constructor inputs/ranges remain resident. Exporters may
    // replay this native trace and compare its exact stored coordinates; this
    // metadata itself does not certify a closed solid or trim overlaps.
    bindNativeBoundaryEpoch(seam,{...seamRecorder.snapshot(),seed:d.seed,shape:{...(d.shape??RIVER_SHAPE_DEFAULT)},
      sourceFrame:sourceCrest?{...sourceCrest}:null});
    out.push(seam);
  }
  if(sisters){
    const native=sisters.geometry.clone(),count=native.getAttribute('position').count;
    native.setAttribute('aKind',new THREE.BufferAttribute(new Float32Array(count).fill(1),1));
    native.setAttribute('aTone',new THREE.BufferAttribute(new Float32Array(count).fill(.36),1));
    bindNativeBoundaryEpoch(native,{...sisters.geometry.userData.nativeBoundary,groundJoins:'visual-collar-candidate',waterAdmission:false});
    out.push(native);
    if(sistersCollars.length){
      // This is a visible native join candidate. Its folded bands are not a
      // closed-solid certificate; preserve the explicit physical limitation.
      for(let e=0;e<sistersCollars.length;e+=9){
        const ax=sistersCollars[e+3]-sistersCollars[e],az=sistersCollars[e+5]-sistersCollars[e+2];
        const bx=sistersCollars[e+6]-sistersCollars[e],bz=sistersCollars[e+8]-sistersCollars[e+2];
        if(az*bx-ax*bz<0)for(let k=0;k<3;k++)[sistersCollars[e+3+k],sistersCollars[e+6+k]]=[sistersCollars[e+6+k],sistersCollars[e+3+k]];
      }
      const join=new THREE.BufferGeometry(),vertices=sistersCollars.length/3;
      join.setAttribute('position',new THREE.Float32BufferAttribute(sistersCollars,3));
      join.setAttribute('aKind',new THREE.BufferAttribute(new Float32Array(vertices).fill(1),1));
      join.setAttribute('aTone',new THREE.BufferAttribute(new Float32Array(vertices).fill(.36),1));
      join.computeVertexNormals();join.computeBoundingSphere();join.userData.sistersNative=true;
      bindNativeBoundaryEpoch(join,{schema:'sisters-ground-collar-candidate-v1',owner:'rapids:seven-sisters',closedSolid:false,waterAdmission:false});out.push(join);
    }
  }
  return out;
}

/** Preserve cliff lighting after edits, including vertices copied into adjacent tiles. */
function repairPatchedCliffNormals(tiles: THREE.BufferGeometry[], touched: Set<THREE.BufferGeometry>): void {
  // A local brush on the downstream bank cannot change the omitted source
  // cliff faces. Only enter their global seam-normal repair when a touched
  // tile actually carries a repair vertex; preserve full repair at the source.
  let affected = false;
  for (const g of tiles) {
    if (!touched.has(g)) continue;
    const mask = g.getAttribute('cliffNormalRepair');
    if (mask) for (let v = 0; v < mask.count; v += 1) if (mask.getX(v)) { affected = true; break; }
    if (affected) break;
  }
  if (!affected) return;
  // Sum only retained face normals. A high neighbor across an omitted cliff
  // face must never turn a horizontal bank into a bright vertical fringe.
  // Shared source IDs keep the normal identical on both sides of tile seams.
  const sums = new Map<number, THREE.Vector3>();
  const ab = new THREE.Vector3(); const ac = new THREE.Vector3();
  for (const g of tiles) {
    const mask = g.getAttribute('cliffNormalRepair'); const ids = g.getAttribute('groundVertex');
    const p = g.getAttribute('position'); const idx = g.index;
    if (!mask || !ids || !idx) continue;
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t); const b = idx.getX(t + 1); const c = idx.getX(t + 2);
      if (!mask.getX(a) && !mask.getX(b) && !mask.getX(c)) continue;
      ab.set(p.getX(b) - p.getX(a), p.getY(b) - p.getY(a), p.getZ(b) - p.getZ(a));
      ac.set(p.getX(c) - p.getX(a), p.getY(c) - p.getY(a), p.getZ(c) - p.getZ(a));
      ab.cross(ac);
      for (const v of [a, b, c]) if (mask.getX(v)) {
        const id = ids.getX(v); let sum = sums.get(id);
        if (!sum) { sum = new THREE.Vector3(); sums.set(id, sum); }
        sum.add(ab);
      }
    }
  }
  for (const sum of sums.values()) sum.normalize();
  for (const g of tiles) {
    const mask = g.getAttribute('cliffNormalRepair'); const ids = g.getAttribute('groundVertex');
    const normal = g.getAttribute('normal'); if (!mask || !ids) continue;
    let changed = false;
    for (let v = 0; v < mask.count; v += 1) if (mask.getX(v)) {
      const sum = sums.get(ids.getX(v));
      if (sum && sum.lengthSq() > 0) { normal.setXYZ(v, sum.x, sum.y, sum.z); changed = true; }
    }
    if (changed) { normal.needsUpdate = true; touched.add(g); }
  }
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
  // Count by the same first-seen tile keys before allocating their storage.
  // One triangle number replaces three growable vertex entries. The second
  // pass keeps every triangle in native order; it does not simplify the land.
  const tiles = new Map<string, { count: number; start: number; next: number }>();
  const tileKey = (t: number): string => {
    const a = idx[t]; const b = idx[t + 1]; const c = idx[t + 2];
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    return `${Math.floor(cx / tileM)},${Math.floor(cz / tileM)}`;
  };
  for (let t = 0; t < idx.length; t += 3) {
    const key = tileKey(t); let tile = tiles.get(key);
    if (!tile) { tile = { count: 0, start: 0, next: 0 }; tiles.set(key, tile); }
    tile.count++;
  }
  const triangleCount = Math.ceil(idx.length / 3);
  // Uint32 covers this course. Retain exact ordinals for larger future inputs
  // too, without introducing a geometry or occupancy cap.
  const triangles = triangleCount - 1 <= 0xffff_ffff
    ? new Uint32Array(triangleCount) : new Float64Array(triangleCount);
  let start = 0;
  for (const tile of tiles.values()) { tile.start = tile.next = start; start += tile.count; }
  for (let t = 0; t < idx.length; t += 3) triangles[tiles.get(tileKey(t))!.next++] = t / 3;
  const out: THREE.BufferGeometry[] = [];
  for (const tile of tiles.values()) {
    const remap = new Map<number, number>();
    const order: number[] = [];
    const ni = new Uint32Array(tile.count * 3);
    let k = 0;
    for (let q = tile.start; q < tile.start + tile.count; q++) {
      const t = triangles[q] * 3;
      for (let corner = 0; corner < 3; corner++) {
        const source = idx[t + corner]; let v = remap.get(source);
        if (v === undefined) { v = order.length; remap.set(source, v); order.push(source); }
        ni[k++] = v;
      }
    }
    const tg = new THREE.BufferGeometry();
    for (const name of names) {
      const src = g.getAttribute(name) as THREE.BufferAttribute;
      const n = src.itemSize;
      // Preserve integer cell IDs when copying terrain into drawing tiles.
      // Positions and normals retain their original Float32 representation.
      const AttributeArray = src.array.constructor as new (length: number) => THREE.TypedArray;
      const arr = new AttributeArray(order.length * n);
      for (let k = 0; k < order.length; k += 1) {
        for (let q = 0; q < n; q += 1) arr[k * n + q] = src.array[order[k] * n + q] as number;
      }
      tg.setAttribute(name, new THREE.BufferAttribute(arr, n, src.normalized));
    }
    tg.setIndex(new THREE.BufferAttribute(ni, 1));
    if(g.userData.nativeBoundary)bindNativeBoundaryEpoch(tg,{...g.userData.nativeBoundary,sourceGeometryUuid:g.uuid,tileKey:out.length});
    tg.computeBoundingSphere();
    if (record) for (let k = 0; k < order.length; k += 1) record(out.length, k, order[k]);
    out.push(tg);
  }
  g.dispose();
  return out;
}

/**
 * The temporary edit record follows native tiling order. Only source IDs
 * need per-copy storage: each tile supplies locals 0..count-1 in one run.
 * Pages grow with the actual output; they do not cap terrain or omit copies.
 */
interface TileRecords {
  rec: (tile: number, local: number, global: number) => void;
  pages: Array<Uint32Array | Float64Array>;
  runs: Array<{ tile: number; count: number }>;
  count: number;
  pageSize: number;
}

/**
 * THE LIVE RIVER: where each source vertex went when a mesh was split into
 * tiles (see splitByTiles' record), as lists per source vertex: vertex g's
 * copies are (tile[q], local[q]) for q in start[g] .. start[g + 1].
 */
class TileMap {
  readonly start: Int32Array;
  readonly tile: Int32Array;
  readonly local: Int32Array;
  constructor(nGlobal: number, records: TileRecords) {
    const start = new Int32Array(nGlobal + 1);
    let remaining = records.count;
    for (const page of records.pages) {
      const used = Math.min(remaining, records.pageSize);
      for (let q = 0; q < used; q++) start[page[q] + 1] += 1;
      remaining -= used;
    }
    for (let k = 1; k <= nGlobal; k++) start[k] += start[k - 1];
    this.tile = new Int32Array(records.count);
    this.local = new Int32Array(records.count);
    // Construction is synchronous and the prefix remains private here.
    // Use its starts as cursors, then restore every start before publication;
    // a second nGlobal-sized fill buffer would hold the same information.
    let pageIndex = 0, offset = 0;
    for (const run of records.runs) {
      for (let local = 0; local < run.count; local++) {
        const source = records.pages[pageIndex][offset++];
        if (offset === records.pageSize) { pageIndex++; offset = 0; }
        const at = start[source]++;
        this.tile[at] = run.tile;
        this.local[at] = local;
      }
    }
    for (let k = nGlobal; k > 0; k--) start[k] = start[k - 1];
    start[0] = 0;
    this.start = start;
  }
}

/** Record exact source IDs; tile/local values are implicit in native runs. */
function tileRecorder(nGlobal: number): TileRecords {
  const SourceIds = nGlobal - 1 <= 0xffff_ffff ? Uint32Array : Float64Array;
  const records: TileRecords = { pages: [], runs: [], count: 0, pageSize: 16_384,
    rec: (tile, local, source) => {
      let run = records.runs[records.runs.length - 1];
      if (!run || run.tile !== tile) {
        if (tile !== records.runs.length || local !== 0) throw new Error('Native edit tile order changed');
        run = { tile, count: 0 }; records.runs.push(run);
      }
      if (local !== run.count) throw new Error('Native edit vertex order changed');
      if (!Number.isSafeInteger(source) || source < 0 || source >= nGlobal) throw new RangeError('Native edit source ID is outside its geometry');
      const offset = records.count % records.pageSize;
      if (offset === 0) records.pages.push(new SourceIds(records.pageSize));
      records.pages[records.pages.length - 1][offset] = source;
      run.count++; records.count++;
    },
  };
  return records;
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
export function buildBoulders(list: Boulder[], ranges?: Int32Array): THREE.BufferGeometry {
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
    // Main rock triangles are also the collision surface. Leave the original
    // deformation branch below intact, including its editor ranges and tones.
    if (B.s !== undefined && B.s >= MAIN_CHANNEL_S) {
      const shape = mainBoulderShape(B);
      pos.set(shape.positions, vOff * 3);
      tone.fill(((B.seed >>> 7) % 1000) / 1000, vOff, vOff + vCount);
      for (const i of shape.indices) idx.push(vOff + i);
      if (ranges) ranges[b] = vOff;
      vOff += vCount;
      continue;
    }
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
  // These rocks are immutable during this placement pass. Keep their exact
  // bounds once so distant pebbles never rebuild shape-cache keys or test
  // triangles. Nearby overlaps still use the original collision shape, and
  // rejection consumes exactly the same random draws as before.
  const obstacles = d.boulders.map(b => ({ b, bounds: boulderBounds(b) }));
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
    if (obstacles.some(({ b, bounds }) =>
      x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ
      && boulderTopAt(b, x, z) > -Infinity)) continue;
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
export function createCopyPass(): { material: THREE.NodeMaterial; color: TslNode; depth: TslNode } {
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
export function createBlitPass(): { material: THREE.NodeMaterial; color: TslNode } {
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
function bilinear(a: Float32Array, nx: number, nz: number, fx: number, fz: number, stride = 1, offset = 0): number {
  const x = Math.max(0, Math.min(nx - 1.001, fx));
  const z = Math.max(0, Math.min(nz - 1.001, fz));
  const i = Math.floor(x);
  const j = Math.floor(z);
  const tx = x - i;
  const tz = z - j;
  const p = a[(j * nx + i) * stride + offset] + (a[(j * nx + i + 1) * stride + offset] - a[(j * nx + i) * stride + offset]) * tx;
  const q = a[((j + 1) * nx + i) * stride + offset] + (a[((j + 1) * nx + i + 1) * stride + offset] - a[((j + 1) * nx + i) * stride + offset]) * tx;
  return p + (q - p) * tz;
}

/** The ground and water samplers of a reach's data, for placing things on it. */
export function riverSamplers(d: RiverReachData, borrowSnapshot = false,
  /** A live picture's coarse far level (GG-430): the level of a cell marked RIVER_FAR_LEVEL. */
  coarse: RiverCoarseLevel | null = null): {
  groundAt: (x: number, z: number) => number;
  levelAt: (x: number, z: number) => number;
  courseDistAt: (x: number, z: number) => number;
  courseSNAt: (x: number, z: number) => { s: number; n: number };
} {
  const { nx, nz, dx, x0, z0 } = d.grid;
  // Read a live picture's fourth channel directly instead of allocating and
  // copying 24 MB after every packet (the scene makes new samplers after each
  // picture; since GG-430 the client patches the same arrays in place).
  // External callers keep the original captured-level behavior by default.
  // A far cell (RIVER_FAR_LEVEL) takes the coarse level the old map filled in.
  const far = (v: number, c: number): number => (v === RIVER_FAR_LEVEL && coarse ? riverFarLevelAt(coarse, c % nx, Math.floor(c / nx)) : v);
  const level = borrowSnapshot ? d.t0 : new Float32Array(nx * nz);
  if (!borrowSnapshot) for (let c = 0; c < nx * nz; c += 1) level[c] = far(d.t0[c * 4 + 3], c);
  const borrowedLevel = (fx: number, fz: number): number => {
    const x = Math.max(0, Math.min(nx - 1.001, fx));
    const z = Math.max(0, Math.min(nz - 1.001, fz));
    const i = Math.floor(x), j = Math.floor(z), tx = x - i, tz = z - j, c = j * nx + i;
    const a = far(level[c * 4 + 3], c), b = far(level[(c + 1) * 4 + 3], c + 1);
    const e = far(level[(c + nx) * 4 + 3], c + nx), f = far(level[(c + nx + 1) * 4 + 3], c + nx + 1);
    const p = a + (b - a) * tx, q = e + (f - e) * tx;
    return p + (q - p) * tz;
  };
  const inGrid = (x: number, z: number): boolean => x > x0 + dx && x < x0 + (nx - 1) * dx && z > z0 + dx && z < z0 + (nz - 1) * dx;
  const o = d.outer;
  return {
    groundAt: (x, z) => (inGrid(x, z)
      ? bilinear(d.ground, nx, nz, (x - x0) / dx - 0.5, (z - z0) / dx - 0.5)
      : bilinear(o.heights, o.nx, o.nz, (x - o.x0) / o.step, (z - o.z0) / o.step)),
    levelAt: (x, z) => (!inGrid(x, z) ? Number.NaN
      : borrowSnapshot ? borrowedLevel((x - x0) / dx - 0.5, (z - z0) / dx - 0.5)
        : bilinear(level, nx, nz, (x - x0) / dx - 0.5, (z - z0) / dx - 0.5)),
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
  /** The stand-in is for live pages only (branchStandInsOn; riverVegetation's liteBranches). */
  liteLiveOnly: boolean;
  /** Every instance's matrix and color, as built. */
  mats: Float32Array;
  cols: Float32Array | null;
  /** Per instance: bounding-sphere center x, y, z and radius, m. */
  sph: Float32Array;
  n: number;
  /** Tree instances only; mixed canopy draws also contain shrubs. */
  treeMask: Uint8Array;
  /** Triangles of one instance, full and stand-in. */
  tris: number;
  liteTris: number;
}

/** The judged scene: construct it on a canvas with the reach's data. */
export class RiverReachView {
  private mpmSurface: WaterfallReconstructedFluid | null = null;
  private mpmCancelled = false;
  private mpmRunning: Promise<unknown> | null = null;
  mpmReceipt: WaterfallMpmStatus | null = null;
  /** An isolated physical diagnostic on this renderer; the original river is
   * still available by returning to its URL. No second coupled source exists. */
  startMpmDiagnostic(status: (result: WaterfallMpmStatus) => void): void {
    if (this.mpmRunning) return;
    this.mpmCancelled = false;
    const flat=DIAGNOSTIC_LEDGE.triangles.flatMap(t=>t.flatMap(i=>[...DIAGNOSTIC_LEDGE.sourceVertices[i]]));
    this.showCavityStudy(flat,[],0);
    this.allowBelowGround=true; this.allowBelowWater=true;
    this.setPose({pos:[19,72,22],look:[1.5,68,0],fov:50});
    this.mpmRunning=runWaterfallMpmDiagnostic(this.renderer,{
      cancelled:()=>this.mpmCancelled,
      status:r=>{this.mpmReceipt=r;status(r);},
      attach:(b,source)=>{
        const centers=new THREE.StorageBufferAttribute(new Float32Array(b.params.count*4),4);
        const output=storage(centers,'vec4',b.params.count),p=storage(b.pos,'vec3',b.params.count),mass=storage(source.massBuffer,'float',b.params.count);
        const volume=mass.element(instanceIndex).mul(b.params.dx**3/4);
        // Exact equal-volume spheres: no enlarged glyphs or invented foam.
        // Overlap and screen filtering remain an unqualified reconstruction.
        const copy=Fn(()=>{output.element(instanceIndex).assign(vec4(p.element(instanceIndex).mul(b.params.dx).add(vec3(...b.params.origin)),pow(volume.mul(3/(4*Math.PI)),1/3)));})().compute(b.params.count);
        this.mpmSurface=new WaterfallReconstructedFluid(this.waterMat.uniforms,{centers,capacity:b.params.count});
        publish=async count=>{await this.renderer.computeAsync(copy);this.mpmSurface?.publishGpuEpoch(count);};
      },
      publish:count=>publish(count),
    });
    let publish: (count:number)=>Promise<void> = async()=>{};
  }
  stopMpmDiagnostic(): void {this.mpmCancelled=true;}
  renderer: THREE.WebGPURenderer;
  /** Device loss invalidates drawing resources, not the CPU river or its source. */
  rendererLoss: GPUDeviceLostInfo | null = null;
  onRendererLost: (() => void) | null = null;
  private rendererDisposed = false;
  private resourcesReleased = false;
  private rendererRecovery: Promise<void> | null = null;
  private rendererRequiresMpmLimits = false;
  readonly camera: THREE.PerspectiveCamera;
  readonly data: RiverReachData;
  frames = 0;
  /** Experimental A/B switch. Fixed-state normal frame tests showed no FPS
   * gain, so it stays off by default despite slightly faster drained frames. */
  shareOpaqueMatrices = false;
  /** Last completed snapshot application. Queueing textures does not measure their GPU upload. */
  snapshotTiming: { textureQueueMs: number; mirrorMs: number; geometryMs: number; totalMs: number } | null = null;
  /** What the vegetation holds: instances per variant and triangles. */
  vegetation: { counts: Record<string, number>; triangles: number } = { counts: {}, triangles: 0 };
  /** Pinned water time, s, or null for the wall clock. */
  pinnedTime: number | null = null;
  private appearanceFrozen = false;
  private appearanceReturnTime: number | null = null;
  /** The mirror plane's height, m (the water layer's mirror owns it; slice 3, 2026-10-26). */
  get reflPlaneY(): number { return this.reflection.planeY; }
  set reflPlaneY(y: number) { this.reflection.planeY = y; }
  /** When `mirrorPlaneFromCamera` last eased the plane, ms, or null before its first call. */
  private planeEaseAt: number | null = null;
  /** Which target the output pass shows: 0 = the frame, 1 = the opaque pass, 2 = the reflection. */
  showTarget = 0;

  comparisons: WaterfallTerrainComparisonView | null = null;
  private readonly measureComparisonPace = createWaterfallPaceMeter();
  /** A hidden preview retains its water, but starts a fresh visible speed window. */
  private comparisonPaceVisible = true;
  setComparisonPaceVisible(visible: boolean): void {
    const wasVisible = this.comparisonPaceVisible;
    this.comparisonPaceVisible = visible;
    if (visible) {
      if (!wasVisible) getPerfSessions().find(s => s.element === this.renderer.domElement)
        ?.setStat('worker: waterfall physical speed', 'Collecting physical speed…');
      return;
    }
    this.measureComparisonPace.suspend();
    getPerfSessions().find(s => s.element === this.renderer.domElement)
      ?.setStat('worker: waterfall physical speed', 'Preview hidden; physical speed is not measured');
  }
  // Lazy neighboring experiments use this renderer and leave the main river alone.
  enableComparisons(notify: (state: ComparisonState) => void): WaterfallTerrainComparisonView {
    const publish = (state: ComparisonState): void => {
      // Report delivered physical time, including worker/reply latency. This is
      // separate from FPS and does not claim that worker execution blocks input.
      const visible = this.comparisonPaceVisible && !document.hidden;
      // A reply already in flight can arrive while hidden. It still installs
      // its water, but must not restart the visible measurement window.
      if (!visible) this.measureComparisonPace.suspend();
      getPerfSessions().find(s => s.element === this.renderer.domElement)
        ?.setStat('worker: waterfall physical speed', visible
          ? this.measureComparisonPace(state, performance.now())
          : 'Preview hidden; physical speed is not measured');
      notify(state);
    };
    if (!this.comparisons) { this.comparisons = new WaterfallTerrainComparisonView((x,z) => this.groundAt(x,z), publish, this.waterMat.uniforms, this.groundMat, this.vegGroup?.children.find(object => { const mesh = object as THREE.InstancedMesh; const mat = mesh.material as THREE.MeshStandardNodeMaterial; return mesh.isInstancedMesh && mat?.color?.getHex() === 0x34462c; }) as THREE.InstancedMesh | undefined, this.originalWetLevelAt, (name,ms)=>{const session=getPerfSessions().find(s=>s.element===this.renderer.domElement);if(name.startsWith('worker:'))session?.setStat(name,ms.toFixed(1)+' ms elapsed, off main thread');else session?.recordOperation(name,ms);}, this.nativeGroundGeometry); this.scene.add(this.comparisons.group); this.waterScene.add(this.comparisons.water); }
    return this.comparisons;
  }

  private readonly scene = new THREE.Scene();
  private readonly skyScene = new THREE.Scene();
  /** The water scene (the water layer draws it: slice 4). */
  private readonly waterScene = new THREE.Scene();
  /**
   * THE MIRROR (the water layer's slice 3, 2026-10-26): camera, read matrix,
   * plane and targets live in `RiverMirror` (riverMirrorCamera.ts), which
   * the water layer holds; this view hosts its pass (sky, scene, copy).
   */
  private readonly reflection = new RiverMirror();
  private get reflCam(): THREE.PerspectiveCamera { return this.reflection.camera; }
  private airProbeRT: CubeRenderTarget | null = null;
  private airProbeCam: THREE.CubeCamera | null = null;
  private airProbePosition = new THREE.Vector3(Infinity, Infinity, Infinity);
  private airProbeRevision = 0;
  private airProbeDrawnRevision = -1;
  /** Number of six-face refreshes, for native cost/above-water checks. */
  airProbeRefreshes = 0;
  private readonly quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quadScene = new THREE.Scene();
  private readonly quad: THREE.Mesh;
  private readonly copyQ: ReturnType<typeof createCopyPass>;
  private readonly outQ: ReturnType<typeof createOutPass>;
  private readonly meterQ: ReturnType<typeof createMeterPass>;
  /**
   * THE WATER LAYER (2026-10-26, ADR 0009 step 6, slice 2): the water's own
   * parts (flow textures, optics mask, surface sampler, material, mesh) live
   * in `RiverWaterLayer`, which the game world will draw too. These getters
   * keep this view's names, so the code below reads as before.
   */
  private readonly waterLayer: RiverWaterLayer;
  private get waterMat(): RiverWaterMaterial { return this.waterLayer.waterMat; }
  private get normalWaterDepthTest(): boolean { return this.waterLayer.normalWaterDepthTest; }
  private readonly groundBatch: RiverGroundBatch;
  private useFlowTextureDeltas = true;
  // The neighboring native-water test reads the same original ground tiles
  // used for drawing/editing, including terrain beyond its added mountain.
  private nativeGroundGeometry: () => readonly THREE.BufferGeometry[] = () => [];
  private originalWetLevelAt = (x:number,z:number):number => {
    const g=this.data.grid,i=Math.floor((x-g.x0)/g.dx),j=Math.floor((z-g.z0)/g.dx);
    // Optical levels extend into dry banks. They previously depressed the new
    // source channel where no original water existed. Protect actual positive
    // depth only, including retained thin films; never an extended dry level.
    if(i<0||i>=g.nx||j<0||j>=g.nz||!(this.data.h[j*g.nx+i]>0))return -100;
    return this.samplers?.levelAt(x,z)??-100;
  };
  private readonly groundMat: THREE.MeshStandardNodeMaterial;
  private readonly sistersRockMat: THREE.MeshStandardNodeMaterial | null = null;
  private readonly bankMat: THREE.MeshStandardNodeMaterial;
  private readonly sky: THREE.Mesh;
  /** The sky dome's uniforms (the reflection pass turns its sun disk off). */
  private readonly skyU: Record<string, TslNode>;
  private get water(): THREE.Mesh { return this.waterLayer.water; }
  // The clone's stored study shares this renderer. Visibility is saved once
  // and restored when returning to the ordinary river; no live flow is changed.
  private cavityStudy: { terrain: THREE.Mesh; water: THREE.Mesh; hidden: Array<[THREE.Object3D, boolean]>; groundBatch: boolean } | null = null;
  // Retain only the already-owned sheet and geometry references. A query copies
  // its small witness; no grid clone or extra worker transfer happens per frame.
  private quadInstalled: { sheet: LiveFlowSnapshot['sheet']; geometry: THREE.BufferGeometry; certificate: QuadSnapshotCertificate } | null = null;
  private quadApplication = 0;
  // Original terrain remains authoritative even when a camera omits its tiles.
  // This list never includes opaque batch proxies or reflection stand-ins.
  private readonly bankTerrainTiles: RiverBankTerrainSource[] = [];
  private bankTerrainRevision = 0;
  private bankTerrainCommitted = true;
  /** The sun (its shadow map is drawn once; see `primeShadows`). */
  private readonly sun: THREE.DirectionalLight;
  private sceneRT: THREE.RenderTarget;
  private finalRT: THREE.RenderTarget;
  /** Optional visible-water perimeter. Allocated only when inspection enables it. */
  private waterOutlines = false;
  private waterOutlinePass: {
    target: THREE.RenderTarget; scene: THREE.Scene;
    depth: ReturnType<typeof createCopyPass>; edge: THREE.NodeMaterial;
    mask: TslNode; pixel: TslNode;
    proxies: Map<THREE.Mesh, { mesh: THREE.Mesh; material: THREE.NodeMaterial }>;
  } | null = null;
  /** The mirror's MSAA target and its mip-chain copy (see RiverMirror). */
  private get reflRT(): THREE.RenderTarget { return this.reflection.target; }
  private get reflMipRT(): THREE.RenderTarget { return this.reflection.mipTarget; }
  private readonly blitQ: ReturnType<typeof createBlitPass>;
  private get reflMatrix(): THREE.Matrix4 { return this.reflection.matrix; }
  private readonly t0 = performance.now();
  private width = 1;
  private height = 1;
  private pendingResize:{w:number;h:number}|null=null;
  private resizeWaiting=false;
  private readonly off: Record<RiverAblatePart, boolean> = { water: false, reflection: false, caustics: false };
  private vegGroup: THREE.Object3D | null = null;
  /** The drawn surface on the CPU (rivers round 4), and the paper boat and the ducks on it. */
  get mirror(): RiverSurfaceMirror { return this.waterLayer.surface; }
  floaters: RiverFloatersView;
  readonly droppedObjects: RiverDroppedObjectsView;
  readonly waterfall: RiverWaterfallView | null;
  private spillView: RiverSpillView | null = null;
  /** Diagnostics: the airborne falling sheet's longest drawn segments (RiverSpillView.report). */
  spillReport(): ReturnType<RiverSpillView['report']> | null { return this.spillView?.report() ?? null; }
  private get mainOpticsMask(): THREE.DataTexture | null { return this.waterLayer.mainOpticsMask; }
  private get mainOpticsPathKey(): string { return this.waterLayer.mainOpticsPathKey; }
  private set mainOpticsPathKey(k: string) { this.waterLayer.mainOpticsPathKey = k; }
  private receivingMaskVersion = 1;
  // A replacement view or any enable transition cannot consume old in-flight work.
  private receivingConfigId = crypto.randomUUID();
  // Prepare matching water geometry off the main thread to keep live input responsive.
  // Startup, changed masks and exposed spills retain the local preparation fallback.
  private receivingWorkerEnabled = true;
  readonly flowBlockers: RiverFlowBlockersView;
  /** Isolated studies are opt-in for this preview and never join its solver. */
  readonly experiments: RiverExperimentStations | null;
  private experimentVegetationMasks: Uint8Array[] = [];
  /** Number of plant render instances omitted only from the reserved study area. */
  experimentClearedInstances = 0;
  allowBelowGround = false;
  allowBelowWater = false;
  /** The floaters drawn and moving; off unless the page turns them on (never in a capture by default). */
  floatersOn = false;
  private vegSets: VegSet[] = [];
  /** Default-on visual preference, independent of source and terrain edits. */
  treesVisible = true;
  /** Rivers round 5: the round-4 small stones and the V4 mixed ones. */
  private stonesR4: THREE.InstancedMesh | null = null;
  private stonesMixed: THREE.InstancedMesh | null = null;
  /** The variant tunes now (see `setTunes`). */
  tunes = { slab: 0, v1: 0, v2: 0, v3: 0, v4: 0, film: 0 };
  private cullKey = '';
  /** Measurement switches (rivers round 4): per-pose culling, and the mirror's stand-ins. */
  cullOn = true;
  /** DEBUG: which copies the cull applies to (1 the camera's, 2 the mirror's). */
  cullBits = 3;
  standInsOn = true;
  /**
   * The far trees' stand-in BRANCHES in the mirror (liteBranches: the largest
   * 40 % of each tree's limb tubes). Off by default (static captures keep
   * the full branches); the live page switches it on with the light mirror.
   */
  branchStandInsOn = false;
  /** The stand-in distance, m (a measurement switch; the look uses RIVER_MIRROR_LITE_M). */
  liteM = RIVER_MIRROR_LITE_M;
  /** The mirror's MSAA samples (a measurement switch; see RiverMirror). */
  get mirrorSamples(): number { return this.reflection.samples; }
  setMirrorSamples(n: number): void { this.reflection.setSamples(n); }
  /** The mirror's size as a share of the frame (a measurement switch for the
   * water budget, 2026-10-26; 0.5 as shipped). */
  get mirrorScale(): number { return this.reflection.scale; }
  setMirrorScale(s: number): void { this.reflection.setScale(s); }
  /** What the last cull left to draw: triangles per pass. */
  lastCull = { camTris: 0, mirrorTris: 0, mirrorLiteTris: 0, allTris: 0 };
  /**
   * The mirror's water mask (riverMirrorMask): the mirror draws only the
   * plants whose image a water read can reach. Off by default (static
   * captures keep the shipped mirror); the live page switches it on.
   */
  mirrorMaskOn = false;
  /** The last mask: wet samples, cells marked, and whether it covered all. */
  lastMirrorMask: { samples: number; marked: number; full: boolean } | null = null;
  private mirrorMaskH: ArrayLike<number> | null = null;
  private mirrorMaskAt = 0;
  private mirrorMaskStamp = 0;

  /**
   * `editable` (the live river, 2026-09-29): keep the maps an edit needs to
   * move the ground's and the rocks' vertices, the stones and the plants in
   * place. The judged captures build without it; it changes no pixel.
   */
  constructor(canvas: HTMLCanvasElement, data: RiverReachData, opts: { editable?: boolean; experiments?: boolean; onExperimentChange?: (reading: ExperimentStationReading) => void; mpmDiagnostic?: boolean } = {}) {
    this.data = data;
    // Keep bounded phase receipts on this scene. A ready flag or a failed
    // browser observation cannot tell whether cold construction, ground
    // tiling or shader setup caused the long full-course preview start.
    const constructionStart = performance.now();
    let constructionPrevious = constructionStart;
    const constructionPhases: Record<string, number> = {};
    this.scene.userData.riverConstructionPhases = constructionPhases;
    const constructionPhase = (name: string): void => {
      const now = performance.now();
      constructionPhases[name] = now - constructionPrevious;
      constructionPrevious = now;
    };
    const editable = opts.editable === true;
    // The view reads courseKeyAt (the vegetation, the floaters' channel), so
    // the main thread takes the shape the data was built with. Data cached
    // before the panel has no shape, which is the default.
    configureHeadwatersGrid(data.grid);
    setRiverShape(data.shape ?? null);
    // WEBGPU (2026-09-30): an opaque canvas (the renderer's default is a
    // see-through one) and no fallback to its WebGL2 backend (`init` checks).
    this.rendererRequiresMpmLimits = opts.mpmDiagnostic === true;
    this.renderer = this.createRenderer(canvas);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.2, riverReconstructionEnabled()?6000:2500);
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
    // The full course spans kilometers. The original short-reach haze hid
    // the long reference faces completely; retain it for the original view.
    this.scene.fog = new THREE.FogExp2(L.skyHorizon.clone().multiplyScalar(0.95), (riverReconstructionEnabled()?.0004:L.fogDensity) / Math.SQRT2);
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

    // The water layer: the flow textures (current and previous live picture,
    // for the blend between pictures, 2026-10-21) and the main rapids' optics.
    // Banks and water share the same optical ownership and live impact nodes.
    // Edits and feature switches therefore cannot leave bed lighting animated
    // by a stale main-channel mask or a stopped impact source.
    this.waterLayer = new RiverWaterLayer(flowMapOf(data), riverHeadwatersEnabled() ? mainRapidsOpticsMask(data.grid) : null, JSON.stringify(riverCoursePoints()), this.reflection, this.waterScene);
    const flow = this.waterLayer.flowTex;
    const sharedRiverOptics = this.waterLayer.sharedOptics;
    this.bankMat = createRiverBankMaterial(flow, data.grid, sharedRiverOptics, this.waterLayer.coarseLevel);
    this.groundMat = this.bankMat;
    if (riverHeadwatersEnabled()) {
      const rock = createRiverCliffMaterial();
      this.groundMat = this.bankMat.clone();
      const surfaceKind = attribute('aKind', 'float');
      // Kind2 is exposed granite using the native bank material, not twice
      // the source-cliff blend. The first fresh render exposed negative
      // colors from treating that material identity as an unclamped weight.
      const granite = surfaceKind.greaterThan(1.5);
      // Kind0/2 interpolate across soil/granite edges. Their intermediate1
      // is not the original source cliff, whose actual owner lies upstream.
      const source = select(riverReconstructionEnabled()?granite.or(positionWorld.x.greaterThan(75)):granite, 0, clamp(surfaceKind, 0, 1));
      this.groundMat.colorNode = mix(this.bankMat.colorNode!, rock.colorNode!, source);
      // At the vertical source bank, the unused river bump can have a zero
      // derivative frame. Arithmetic mixing still propagates its NaN at a
      // weight of zero; selection keeps the actual rock normal intact.
      // Both expressions stay outside divergent branches for texture derivatives.
      this.groundMat.normalNode = select(granite, normalView,
        select(source.greaterThanEqual(0.99), rock.normalNode!,
          normalize(mix(this.bankMat.normalNode!, rock.normalNode!, source))));
      this.groundMat.roughnessNode = mix(this.bankMat.roughnessNode!, rock.roughnessNode!, source);
      if (riverReconstructionEnabled()) {
        // A triangle blends physical surface owners, not the category numbers
        // 0 and2. Their old intermediate1 accidentally selected source rock
        // and the original river's brown tint along reconstruction borders.
        const weights = attribute('aGroundSurfaceWeights', 'vec3');
        // Share the finite cliff's measured dry-rock color across exposed
        // reconstructed land, then apply the native bank's actual wet stains.
        const native = riverGroundSurfaceNodes(this.bankMat, rock.colorNode!);
        this.groundMat.colorNode = native.soil.xyz.mul(weights.x)
          .add(rock.colorNode!.mul(weights.y)).add(native.granite.xyz.mul(weights.z));
        // At a granite transition the derivative bump frame can collapse or
        // alias. Keep its real geometry normal; original terrain and source
        // vertices retain their existing normal treatment at zero ownership.
        this.groundMat.normalNode = select(weights.z.greaterThan(0), normalView, this.groundMat.normalNode!);
        this.groundMat.roughnessNode = mix(this.bankMat.roughnessNode!, rock.roughnessNode!, weights.y);
      }
      // A finite exposed cliff needs the cliff's own lighting/material model.
      // The same mesh whitened through the riverbed material; a frozen native
      // material swap verified this boundary. Keep ordinary ground unchanged.
      if(riverReconstructionEnabled())this.sistersRockMat=rock.clone();
      rock.dispose();
    }
    constructionPhase('materialsAndSetupMs');
    const bankU = this.bankMat.userData.riverUniforms as Record<string, TslNode>;
    bankU.uCausticSun.value.set(1, 1, 1);
    // (Rivers round 4: the ground and the rocks in 24 m tiles, so each pass
    // draws only the tiles its camera sees; see `splitByTiles`.)
    const groundMeshes: Array<THREE.Mesh<THREE.BufferGeometry, THREE.Material>> = [];
    const groundTiles: THREE.BufferGeometry[][] = [];
    const groundMaps: TileMap[] = [];
    for (const g0 of buildGround(data)) {
      // The source scan is physically tiled on the horizontal upland. UVs
      // also give its OpenGL tangent normal a correct derivative frame.

      const nGlobal = g0.getAttribute('position').count;
      const r = editable ? tileRecorder(nGlobal) : null;
      // The extended8m land lattice spans kilometers. Reuse native tiling
      // with larger distant-land groups instead of tens of thousands of24m
      // objects. Fine water-adjacent land keeps its existing vertices/tiles.
      const tileM=riverReconstructionEnabled()&&groundTiles.length===1?192:24;
      const tiles = splitByTiles(g0, tileM, r?.rec);
      for (const tile of tiles) decorateGroundTile(tile, g0.userData.sistersNative);
      groundTiles.push(tiles);
      if (r) groundMaps.push(new TileMap(nGlobal, r));
      for (const g of tiles) {
        const m = new THREE.Mesh(g, g0.userData.sistersNative && this.sistersRockMat ? this.sistersRockMat : this.groundMat);
        groundMeshes.push(m);
        this.bankTerrainTiles.push({ name: 'ground-' + this.bankTerrainTiles.length, mesh: m });
        m.receiveShadow = true;
        m.castShadow = true;
        this.scene.add(m);
      }
    }
    this.groundBatch = new RiverGroundBatch(this.scene, groundMeshes, {
      sourceRevision: () => this.bankTerrainCommitted ? this.bankTerrainRevision : null,
      maxVertices: 1_000_000, maxTiles: 256, bucketFormats: true,
    });
    this.nativeGroundGeometry = () => groundMeshes.map(mesh => mesh.geometry);
    constructionPhase('nativeGroundAndTilesMs');
    // Qualified batches keep every terrain triangle, native editing ownership
    // and shadow casters. Stable cameras submit fewer meshes; movement, edits
    // and unsupported layouts fall back automatically. This reduces draw work,
    // not the physical water timestep or its unresolved simulation cost.
    this.groundBatch.enabled = true;
    const rockRanges = editable ? new Int32Array(data.boulders.length + 1) : undefined;
    const rockGeo = buildBoulders(data.boulders, rockRanges);
    const rockN = rockGeo.getAttribute('position').count;
    const rr = editable ? tileRecorder(rockN) : null;
    const rockTiles = splitByTiles(rockGeo, 24, rr?.rec);
    for (const g of rockTiles) {
      const rocks = new THREE.Mesh(g, this.bankMat);
      this.bankTerrainTiles.push({ name: 'rock-' + this.bankTerrainTiles.length, mesh: rocks });
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
    const vegetationCrest = riverHeadwatersEnabled() ? defaultRiverCourse().at(WATERFALL.crestS) : null;
    const veg = buildRiverVegetation({
      // The new cliff exposes the roots of distant canopy-only trees.
      // Add their missing stems in this mountain region without moving
      // any tree or changing the original downstream forest.
      farTrunkAt: vegetationCrest ? (x, z) => smp.groundAt(x, z) > 30
        && Math.hypot(x - vegetationCrest.x, z - vegetationCrest.z) < 160 : undefined,
      groundAt: smp.groundAt,
      overWaterAt: (x, z) => {
        const lv = smp.levelAt(x, z);
        // Initial placement reads the planned channel level, including deep
        // negative elevations. Absence is explicit, never a height cutoff.
        return Number.isFinite(lv) ? smp.groundAt(x, z) - lv : 100;
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
      clearings: Object.entries(RIVER_POSES).filter(([k]) => k !== 'pebble-close'
        && (riverHeadwatersEnabled() || !['river-system', 'waterfall-pool', 'waterfall-crest', 'waterfall-side', 'pool-spill', 'rapids-split', 'rapids-along'].includes(k))).map(([k, p]) => ({
        at: [p.pos[0], p.pos[2]] as [number, number],
        look: [p.look[0], p.look[2]] as [number, number],
        r: k === 'calm-bridge' ? 6 : 12,
        wedge: k !== 'calm-bridge',
      })),
    });
    if(riverReconstructionEnabled()){
      // Keep the original forest's domain, seed and matrices intact. Reuse its
      // native plants in a separately seeded extension, masked out of existing
      // land except the newly exposed island top. No extra water is introduced.
      const islandAt=(x:number,z:number)=>{
        if(x<330||x>560)return false;
        const p=projectMainRapids(x,z);
        return p.s>MAIN_CHANNEL_S+RECONSTRUCTION_FALLS[3].startM&&p.s<MAIN_CHANNEL_S+RECONSTRUCTION_FALLS[3].endM&&reconstructionSection(p.s-MAIN_CHANNEL_S,p.n).soilTop;
      };
      const extension=buildRiverVegetation({groundAt:smp.groundAt,farTrunkAt:()=>true,
        overWaterAt:(x,z)=>{const lv=smp.levelAt(x,z);return Number.isFinite(lv)?smp.groundAt(x,z)-lv:100;},
        // The original samplers intentionally describe the quiet river only.
        // The extension must measure its actual downstream rapids, or far
        // falls are rejected as being hundreds of meters from any river.
        courseDistAt:(x,z)=>projectMainRapids(x,z).d,
        courseSNAt:(x,z)=>{const p=projectMainRapids(x,z);return {s:p.s,n:p.n};},halfWidthAt:s=>courseKeyAt(s).halfW,
        seed:data.seed^0x517e,domain:{x0:330,z0:-200,x1:data.grid.x0+data.grid.nx*data.grid.dx,z1:340},
        landIslandAt:islandAt,plantAllowedAt:(x,z)=>{
          if(islandAt(x,z))return true;
          if(x<460)return false;
          const p=projectMainRapids(x,z);return p.d>courseKeyAt(p.s).halfW+5;
        }});
      veg.group.add(...extension.group.children.slice());
      for(const [key,count] of Object.entries(extension.counts))veg.counts[key]=(veg.counts[key]??0)+count;
      veg.triangles+=extension.triangles;
    }
    this.scene.add(veg.group);
    this.vegGroup = veg.group;
    // THE FLOATERS (rivers round 4): a paper boat and five mallards on the
    // drawn water. Their meshes stay out of the shadow map and are hidden
    // while `floatersOn` is false, so the judged frames do not change.
    // The CPU sampler reads the same half texels as the shader from the start,
    // so the full cold flow maps do not need a second quantized Float32 copy.
    this.waterLayer.createSurface(data);
    this.floaters = new RiverFloatersView(data, this.mirror);
    this.floaters.group.visible = false;
    this.scene.add(this.floaters.group);
    this.droppedObjects = new RiverDroppedObjectsView(data, this.mirror);
    this.scene.add(this.droppedObjects.group);
    this.waterfall = riverHeadwatersEnabled() ? new RiverWaterfallView(data.seed, data.shape ?? RIVER_SHAPE_DEFAULT, this.mirror) : null;
    if (this.waterfall) this.scene.add(this.waterfall.group);
    this.flowBlockers = new RiverFlowBlockersView(data);
    this.waterScene.add(this.flowBlockers.group);
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

    // Floating objects and probes read the same quantized ownership mask
    // and feature flag as the rendered main-channel wave heights.
    this.mirror.setMainRapidsMorphology(this.mainOpticsMask ? this.mainOpticsMask.image.data as Uint8Array : null, !!this.mainOpticsMask);
    this.waterLayer.createMaterial();
    if (this.waterfall) { this.waterfall.useRiverShading(this.waterMat.uniforms); this.waterScene.add(this.waterfall.waterGroup); }
    this.waterLayer.setLighting({
      sunDir: L.sunDir,
      sunColor: new THREE.Color(L.sunColor).multiplyScalar(L.sunIntensity),
      skyZenith: L.skyZenith,
      skyHorizon: L.skyHorizon,
      skyGain: L.skyGain,
      fogColor: (this.scene.fog as THREE.FogExp2).color,
      fogDensity: riverReconstructionEnabled()?.0004:L.fogDensity,
    });
    const receivingGeometry = this.prepareReceivingGeometry(buildRiverWaterGeometry(flowMapOf(data)));
    this.waterLayer.createMesh(receivingGeometry);
    this.waterScene.add(this.water);
    this.experiments = opts.experiments ? new RiverExperimentStations((x,z)=>this.groundAt(x,z), opts.onExperimentChange ?? (()=>{}), this.waterScene, this.waterMat.uniforms) : null;
    if (this.experiments) { this.scene.add(this.experiments.group); this.reserveExperimentClearing(); }

    this.copyQ = createCopyPass();
    this.outQ = createOutPass();
    this.meterQ = createMeterPass();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyQ.material);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.sceneRT = this.makeSceneRT(1, 1);
    this.finalRT = this.makeFinalRT(1, 1);
    this.blitQ = createBlitPass();
    if (editable && rockRanges && rr && stoneRec && mixedRec) {
      const rockPos = new Float64Array(data.boulders.length * 3);
      data.boulders.forEach((b, k) => { rockPos[k * 3] = b.x; rockPos[k * 3 + 1] = b.y; rockPos[k * 3 + 2] = b.z; });
      this.edit = {
        groundTiles,
        groundMaps,
        rockTiles,
        rockMap: new TileMap(rockN, rr),
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
    constructionPhase('remainingSceneMs');
    constructionPhases.totalConstructorMs = performance.now() - constructionStart;
  }

  /**
   * START THE RENDERER (WebGPU: the adapter and the device come
   * asynchronously), then draw the shadow map once. Call it once, after the
   * constructor and before the first frame. It fails when WebGPU is missing:
   * the river has no WebGL path since 2026-09-30 (the no-fallback rule: one
   * real path, and an honest failure).
   */
  /** Recreate only device-owned drawing resources; retain geometry and water. */
  private createRenderer(canvas: HTMLCanvasElement): THREE.WebGPURenderer {
    const renderer = new THREE.WebGPURenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', ...(this.rendererRequiresMpmLimits ? {requiredLimits:{maxStorageBuffersPerShaderStage:16}} : {}) });
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
    return renderer;
  }

  /** Query capability before Three requests its shared render/solver device.
   * A default 128 MiB binding cannot hold the full reference course, even
   * when the adapter supports it. Recovery uses the same preparation path. */
  private async prepareRendererLimits(renderer: THREE.WebGPURenderer): Promise<void> {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('[river] WebGPU adapter is unavailable.');
    const backend = renderer.backend as unknown as { parameters: { requiredLimits?: Record<string, number> } };
    backend.parameters.requiredLimits = { ...backend.parameters.requiredLimits,
      ...riverRendererRequiredLimits(adapter.limits, this.data.grid.nx, this.data.grid.nz) };
  }

  private watchRendererLoss(renderer: THREE.WebGPURenderer): void {
    const device = (renderer.backend as unknown as {device: GPUDevice}).device;
    void device.lost.then(info => {
      if (this.rendererDisposed || this.renderer !== renderer) return;
      this.rendererLoss = info;
      this.onRendererLost?.();
    });
  }

  /** A lost renderer must not restart, refill or advance the water solver.
   * Raw GPU-only fluid diagnostics cannot be reconstructed from CPU geometry. */
  recoverRendererAfterLoss(): Promise<void> {
    if (this.rendererRecovery) return this.rendererRecovery;
    if (!this.rendererLoss) return Promise.reject(new Error('[river] Renderer recovery requires confirmed device loss.'));
    if (this.mpmRunning || this.mpmSurface) return Promise.reject(new Error('[river] GPU-only fluid state cannot be recovered without an explicit restart.'));
    this.rendererRecovery = this.rebuildLostRenderer().finally(() => { this.rendererRecovery = null; });
    return this.rendererRecovery;
  }

  private async rebuildLostRenderer(): Promise<void> {
    const held = this.holdLoop;
    this.holdLoop = true;
    try {
      // Settle the failed meter before swapping its device. Its rejection is
      // already reported by the page; it cannot contaminate the new meter.
      await this.metering?.catch(() => {});
      if (this.rendererDisposed) throw new Error('[river] The river view was closed during recovery.');
      const previous = this.renderer, canvas = previous.domElement;
      previous.dispose();
      const next = this.createRenderer(canvas);
      (next.library as unknown as {addLight(node: unknown, light: unknown): void}).addLight(RiverHemisphereLightNode, RiverHemisphereLight);
      await this.prepareRendererLimits(next);
      await next.init();
      if (this.rendererDisposed) { next.dispose(); throw new Error('[river] The river view was closed during recovery.'); }
      if ((next.backend as unknown as {isWebGPUBackend?: boolean}).isWebGPUBackend !== true) {
        next.dispose(); throw new Error('[river] Recovery requires WebGPU.');
      }
      next.setSize(this.width, this.height, false);
      this.renderer = next;
      this.rendererLoss = null;
      this.watchRendererLoss(next);
      this.meterDirty = true;
      this.reprimeShadows();
      await this.render();
      await this.device.queue.onSubmittedWorkDone();
      if (this.rendererLoss) throw new Error('[river] The replacement GPU device was lost.');
    } finally {
      this.holdLoop = held;
    }
  }

  async init(): Promise<void> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
      throw new Error('[river] WebGPU is not available in this browser. The river scene draws with WebGPU only (since 2026-09-30).');
    }
    // The river's sky light node (see RiverHemisphereLight), before any build.
    (this.renderer.library as unknown as { addLight(node: unknown, light: unknown): void }).addLight(RiverHemisphereLightNode, RiverHemisphereLight);
    const rendererStart = performance.now();
    await this.prepareRendererLimits(this.renderer);
    await this.renderer.init();
    this.scene.userData.riverConstructionPhases.rendererInitMs = performance.now() - rendererStart;
    this.watchRendererLoss(this.renderer);
    const backend = this.renderer.backend as unknown as { isWebGPUBackend?: boolean };
    if (backend.isWebGPUBackend !== true) {
      throw new Error('[river] The renderer started on its WebGL2 fallback, not WebGPU. The river scene draws with WebGPU only (since 2026-09-30).');
    }
    const shadowStart = performance.now();
    this.primeShadows();
    // This measures setup/submission only. It does not time GPU completion.
    this.scene.userData.riverConstructionPhases.shadowSetupSubmissionMs = performance.now() - shadowStart;
  }

  // -------------------------------------------------------------------------
  // THE LIVE RIVER (2026-09-29): the flow snapshots and the bed patches.
  // -------------------------------------------------------------------------

  /** The flow textures the water and the banks read (the live river replaces their data). */
  private get flowTex(): { flow0: THREE.DataTexture; flow1: THREE.DataTexture; flow2: THREE.DataTexture } { return this.waterLayer.flowTex; }
  /**
   * BLEND BETWEEN LIVE PICTURES (2026-10-21): the last picture's textures,
   * when it arrived, and the mean time between pictures. render() moves the
   * water material's uFlowBlend from 0 to 1 over that time.
   */
  private get flowPrev(): { flow0: THREE.DataTexture; flow1: THREE.DataTexture; flow2: THREE.DataTexture } { return this.waterLayer.flowPrev; }
  private flowBlendFrom = 0;
  private flowBlendSpanMs = 250;
  private flowLastPictureAt = 0;

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
  /** Bake broad standing geometry only when the hydraulic field changes.
   * Base normals stay unchanged: the shader already adds the native standing
   * slopes once. Refraction/depth use the displaced positions automatically. */
  setGroundBatch(enabled: boolean): void { this.groundBatch.enabled = enabled; }
  getGroundBatch(): boolean { return this.groundBatch.enabled; }

  /** Diagnostic comparison switch; stale packets cannot cross an enable transition. */
  setReceivingWorker(enabled: boolean): void {
    if (enabled === this.receivingWorkerEnabled) return;
    this.receivingWorkerEnabled = enabled; this.receivingConfigId = crypto.randomUUID();
  }

  receivingConfiguration(): RiverReceivingConfiguration {
    return { grid: this.data.grid, mask: this.mainOpticsMask?.image.data as Uint8Array | null ?? null,
      maskVersion: this.receivingMaskVersion, configId: this.receivingConfigId,
      enabled: this.receivingWorkerEnabled && !!this.mainOpticsMask && this.waterMat.uniforms.uMainRapidsOptics.value > 0 };
  }

  /** Both preparation locations install the same geometry and floater indices. */
  private installReceivingGeometry(geometry: THREE.BufferGeometry, owned: Uint32Array | null): THREE.BufferGeometry {
    riverSheetPreviousHeights(geometry, null, null, this.data.grid);
    this.mirror.setStandingTriangles(owned ? geometry.getAttribute('position').array as Float32Array : null, owned);
    this.mirror.setPoolImpactTriangles(geometry.getAttribute('position').array as Float32Array, geometry.getIndex()!.array as Uint32Array);
    return geometry;
  }

  private prepareReceivingGeometry(base: THREE.BufferGeometry | WaterSheetArrays): THREE.BufferGeometry {
    const geometry = base instanceof THREE.BufferGeometry ? base : null;
    const sheet = geometry ? {
      pos: geometry.getAttribute('position').array as Float32Array,
      nor: geometry.getAttribute('normal').array as Float32Array,
      index: geometry.getIndex()!.array as Uint32Array,
    } : base as WaterSheetArrays;
    if (!this.mainOpticsMask || this.waterMat.uniforms.uMainRapidsOptics.value <= 0) {
      return this.installReceivingGeometry(geometry ?? riverWaterGeometryFrom(sheet), null);
    }
    // Live snapshots already supply exact sheet arrays. Refine those directly:
    // constructing and bounding a temporary mesh adds work but changes no water.
    // Startup/edit callers may still pass their existing geometry wrapper.
    const refined = riverStandingGeometryFrom(sheet,
      (x, z) => this.mirror.mainRapidsShare(x, z), (x, z) => this.mirror.broadStandingHeightAt(x, z),
      (x, z) => this.mirror.broadStandingHeightAt(x, z, true), this.mirror.mainRapidsBounds);
    geometry?.dispose(); return this.installReceivingGeometry(refined, refined.userData.mainStandingTriangles as Uint32Array);
  }

  applyFlowSnapshot(s: RiverViewFlowSnapshot): void {
    const started = performance.now();
    // A failed application can leave new textures beside old geometry. Clear
    // their association before mutation; only the successful end certifies it.
    this.quadInstalled = null;
    // A surge reaches the crest before the pool. Its emission history drives
    // the falling body; the accepted landing still owns downstream mass.
    this.waterfall?.setFlood(s.flood?.pulse ?? null, s.simTime, s.flood?.source);
    if (s.spill && !this.spillView) {
      this.spillView = new RiverSpillView(this.waterMat.uniforms);
      this.waterScene.add(this.spillView.mesh);
    }
    this.spillView?.setSnapshot(s.spill ?? null);
    this.waterfall?.setContactSnapshot(s.contactWaterfall ?? null);
    this.waterfall?.setLanding(s.waterfallLanding ?? null);
    this.waterfall?.setSourceDischarge(s.flood?.sourceM3S ?? s.qIn);
    // Keep every incoming half-float value and the full-resolution textures.
    // Only unchanged texels avoid transfer; first use and unsupported GPU
    // states retain the native full upload. Physics and snapshot cadence stay intact.
    // The drawn water moves from the last picture to this one (see flowPrev).
    // Without a GPU copy (first pictures), this picture draws at once.
    const blended = this.waterLayer.updateFlowTextures(this.renderer, s, this.useFlowTextureDeltas);
    // A patch picture (GG-430) changed the kept surface in place: the cells
    // it replaced give their old values through surfaceBeforeAt.
    const prevSurface = s.surfaceBeforeAt ?? this.data.surface;
    const textureEnd = performance.now();
    const old = this.water.geometry;
    this.mirror.setFlowHalf(s.t0h, s.t1h, s.t2h, s.surface);
    // The accepted landing, not requested inlet Q, drives receiving-only
    // unresolved vertical-energy waves (RiverWaterLayer.setPoolImpact).
    this.waterLayer.setPoolImpact(riverHeadwatersEnabled() ? s.waterfallLanding ?? null : null);
    const mirrorEnd = performance.now();
    const config = this.receivingConfiguration();
    const prepared = s.preparedReceiving;
    // Airborne ownership breaks the height-field connection at actual exposed
    // faces. Build this experimental cut before standing-wave refinement.
    const detached = s.spill?.exposedFaces ?? [];
    const receivingGeometry = !detached.length && receivingSheetMatches(prepared, config.maskVersion, config.enabled, config.configId)
      ? this.installReceivingGeometry(preparedReceivingGeometry(prepared), prepared.mainStandingTriangles)
      : this.prepareReceivingGeometry(trimSpillSurface(s.sheet, this.data.grid, detached));
    if (blended) riverSheetPreviousHeights(receivingGeometry, prevSurface, s.surface, this.data.grid);
    this.water.geometry = receivingGeometry;
    old.dispose();
    const pictureAt = performance.now();
    if (this.flowLastPictureAt > 0) {
      // A mean of the time between pictures; one late picture does not stall
      // the water. The blend ends at 95 % of it, so the drawn water reaches
      // the newest picture just before the next one (measured live: at 0.3
      // weight and the full mean it reached only 0.7-0.9 of each change).
      const gap = Math.min(2000, pictureAt - this.flowLastPictureAt);
      this.flowBlendSpanMs += 0.5 * (0.95 * gap - this.flowBlendSpanMs);
    }
    this.flowLastPictureAt = pictureAt;
    this.flowBlendFrom = blended ? pictureAt : 0;
    const geometryEnd = performance.now();
    this.data.t0 = s.t0;
    this.data.surface = s.surface;
    this.flowCoarse = s.coarse ?? null;
    this.data.h = s.h;
    this.data.u = s.u;
    this.data.v = s.v;
    this.data.mapStats = s.mapStats;
    this.samplers = null;
    this.snapshotTiming = { textureQueueMs: textureEnd - started, mirrorMs: mirrorEnd - textureEnd,
      geometryMs: geometryEnd - mirrorEnd, totalMs: performance.now() - started };
    // Reaching this point proves the snapshot application completed. Client logs
    // written in finally cannot supply this certificate. Screen output remains
    // uncertified; this records CPU installation only.
    this.quadInstalled = { sheet: s.sheet, geometry: receivingGeometry, certificate: { simTime: s.simTime,
      application: ++this.quadApplication, kind: 'applyFlowSnapshot-returned-successfully' } };
    const perf = getPerfSessions().find(session => session.element === this.renderer.domElement);
    perf?.recordOperation('River snapshot: geometry and fields', this.snapshotTiming.totalMs);
    perf?.recordOperation('River snapshot: receiving geometry', this.snapshotTiming.geometryMs);
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
    this.performanceHeatmap?.refresh();
    // A thrown partial patch remains unavailable instead of certifying mixed bed.
    this.bankTerrainCommitted = false;
    this.airProbeRevision += 1;
    this.waterfall?.setShape(p.shape);
    const E = this.edit;
    if (!E) throw new Error('[river] This view was built without `editable`; it cannot take a bed patch.');
    setRiverShape(p.shape);
    setRiverCourseEdit(p.course);
    // Width/height-only bed patches leave ownership alone. Moving the curve
    // refreshes the existing GPU texture and shared CPU bytes before drawing.
    const opticsPathKey = JSON.stringify(riverCoursePoints());
    if (this.mainOpticsMask && opticsPathKey !== this.mainOpticsPathKey) {
      mainRapidsOpticsMask(this.data.grid, this.mainOpticsMask);
      this.mainOpticsPathKey = opticsPathKey; this.receivingMaskVersion += 1; this.receivingConfigId = crypto.randomUUID();
      this.mirror.setMainRapidsMorphology(this.mainOpticsMask.image.data as Uint8Array, this.waterMat.uniforms.uMainRapidsOptics.value > 0);
      const old = this.water.geometry;
      this.water.geometry = this.prepareReceivingGeometry(buildRiverWaterGeometry(flowMapOf(this.data)));
      old.dispose();
    }
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
    if (touchedN.size && riverHeadwatersEnabled()) {
      for (const tiles of E.groundTiles.slice(0, 2)) repairPatchedCliffNormals(tiles, touchedN);
    }
    for (const g of touched) {
      (g.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      if (touchedN.has(g)) (g.getAttribute('normal') as THREE.BufferAttribute).needsUpdate = true;
      g.computeBoundingSphere();
    }
    this.samplers = null;
    const smp = riverSamplers(d, false, this.flowCoarse);
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
    this.bankTerrainRevision += 1;
    this.bankTerrainCommitted = true;
  }

  /**
   * AFTER AN EDIT SETTLES (the page calls it when no patch has come for a
   * moment): the shadow map again with the moved ground, rocks and plants,
   * and the floaters started again on the new water.
   */
  settleEdit(): void {
    this.droppedObjects.refreshRocks();
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

  get waterOutlinesEnabled(): boolean { return this.waterOutlines; }

  setWaterOutlines(enabled: boolean): void {
    this.waterOutlines = enabled;
    if (!enabled) this.disposeWaterOutlinePass();
  }

  private disposeWaterOutlinePass(): void {
    const pass = this.waterOutlinePass; if (!pass) return;
    pass.target.dispose(); pass.depth.material.dispose(); pass.edge.dispose();
    for (const proxy of pass.proxies.values()) proxy.material.dispose();
    // Proxies borrow the current water geometry; its existing owner disposes it.
    this.waterOutlinePass = null;
  }

  /** The river sheet extends underneath dry banks. Trace the visible coverage
   * after terrain depth clips it, rather than tracing hidden triangle edges.
   * This also keeps isolated puddles and holes around rocks in the outline. */
  private drawWaterOutlines(): void {
    if (!this.waterOutlines || this.off.water || this.showTarget !== 0) return;
    if (!this.waterOutlinePass) {
      const target = this.makeFinalRT(this.width, this.height);
      const depth = createCopyPass(); depth.material.fragmentNode = vec4(0, 0, 0, 1);
      const mask = riverTexture(target.texture);
      const pixel = uniform(new THREE.Vector2(1 / this.width, 1 / this.height));
      const center = mask.sample(screenUV).r;
      const right = mask.sample(screenUV.add(vec2(pixel.x, 0))).r;
      const left = mask.sample(screenUV.sub(vec2(pixel.x, 0))).r;
      const up = mask.sample(screenUV.add(vec2(0, pixel.y))).r;
      const down = mask.sample(screenUV.sub(vec2(0, pixel.y))).r;
      const edge = new THREE.NodeMaterial();
      edge.name = 'visible water-body outlines'; edge.vertexNode = quadVertex();
      // Yellow inside, dark outside: preserve the water optics everywhere else.
      const nearby = max(max(right, left), max(up, down));
      const interior = center.sub(min(min(right, left), min(up, down))).max(0);
      const exterior = nearby.sub(center).max(0);
      edge.fragmentNode = vec4(mix(vec3(0.025, 0.04, 0.055), vec3(1, 0.9, 0.1), interior.greaterThan(0.1)), max(interior, exterior));
      edge.transparent = true; edge.depthTest = false; edge.depthWrite = false; edge.fog = false; edge.lights = false;
      this.waterOutlinePass = { target, scene: new THREE.Scene(), depth, edge, mask, pixel, proxies: new Map() };
    }
    const pass = this.waterOutlinePass;
    if (pass.target.width !== this.width || pass.target.height !== this.height) pass.target.setSize(this.width, this.height);
    pass.pixel.value.set(1 / this.width, 1 / this.height);
    const visible = new Set<THREE.Mesh>();
    this.waterScene.traverseVisible(object => {
      const source = object as THREE.Mesh;
      // Surface water uses the native river material (receiver, source approach,
      // isolated pools and frozen study). Airborne mist/volume envelopes are not
      // surface coverage and must never become false water-body borders.
      if (!source.isMesh || !(source.material instanceof THREE.NodeMaterial) || source.material.name !== 'river water') return;
      if (this.flowBlockers.group.getObjectById(source.id)) return;
      visible.add(source);
      let proxy = pass.proxies.get(source);
      if (!proxy) {
        const material = new THREE.NodeMaterial();
        material.name = 'water outline coverage';
        material.fragmentNode = vec4(1, 1, 1, 1);
        material.fog = false; material.lights = false; material.depthWrite = source.material.depthWrite;
        const mesh = new THREE.Mesh(source.geometry, material); mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
        proxy = { mesh, material }; pass.proxies.set(source, proxy); pass.scene.add(mesh);
      }
      // Borrow each replacement geometry and its native displacement, without
      // rebuilding or retaining old snapshots. Frozen study meshes work too.
      source.updateWorldMatrix(true, false);
      proxy.mesh.geometry = source.geometry; proxy.mesh.matrix.copy(source.matrixWorld);
      proxy.material.positionNode = source.material.positionNode;
      proxy.material.side = source.material.side;
      // Terrain stays authoritative even when a coverage diagnostic ignores it.
      proxy.material.depthTest = true;
    });
    for (const [source, proxy] of pass.proxies) if (!visible.has(source)) {
      pass.scene.remove(proxy.mesh); proxy.material.dispose(); pass.proxies.delete(source);
    }
    pass.depth.depth.value = this.sceneRT.depthTexture;
    const r = this.renderer;
    r.setRenderTarget(pass.target); r.clear();
    this.quad.material = pass.depth.material; r.render(this.quadScene, this.quadCam);
    r.render(pass.scene, this.camera);
    r.setRenderTarget(this.finalRT); this.quad.material = pass.edge; r.render(this.quadScene, this.quadCam);
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
      const treeMask = new Uint8Array(n);
      if (im.userData.riverTree === true) treeMask.fill(1);
      else for (const index of (im.userData.riverTreeIndices ?? []) as number[]) treeMask[index] = 1;
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
        r.userData.riverTree = im.userData.riverTree;
        r.userData.riverTreeIndices = im.userData.riverTreeIndices;
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
        mesh: im, refl: copy(im.geometry), lite: liteGeo ? copy(liteGeo) : null, liteLiveOnly: im.userData.liteLiveOnly === true, mats, cols, sph, n, treeMask,
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
  /** Reserve only the study floor and camera corridor. The existing forest
   * keeps its placement/matrices; the same mask applies to every render copy,
   * including the one-time shadow and environmental reflection captures. */
  private reserveExperimentClearing(): void {
    const matrix=new THREE.Matrix4(), bounds=new THREE.Box3();
    this.experimentVegetationMasks=this.vegSets.map(v=>{
      v.mesh.geometry.computeBoundingBox();const local=v.mesh.geometry.boundingBox!;
      const mask=new Uint8Array(v.n),packed=v.mesh.instanceMatrix.array as Float32Array;let count=0;
      for(let k=0;k<v.n;k++){
        matrix.fromArray(v.mats,k*16);bounds.copy(local).applyMatrix4(matrix);
        mask[k]=RiverExperimentStations.clearsFootprint(bounds)?1:0;
        if(mask[k]){this.experimentClearedInstances++;continue;}
        packed.set(v.mats.subarray(k*16,k*16+16),count*16);count++;
      }
      drawCount(v.mesh,count);v.mesh.instanceMatrix.needsUpdate=true;return mask;
    });
    this.cullKey='';
  }

  private cullVegetation(): void {
    const cam = this.camera;
    cam.updateMatrixWorld();
    this.updateReflection();
    // (The projection is WebGPU's: its near plane is z = 0 in clip space.)
    const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse), THREE.WebGPUCoordinateSystem);
    const frR = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, this.reflCam.matrixWorldInverse), THREE.WebGPUCoordinateSystem);
    const eye = this.reflCam.position;
    // The mirror's water mask (see mirrorMaskOn): above water only (an
    // underwater mirror reads the submerged bed, not the plants).
    const vpR = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, this.reflCam.matrixWorldInverse).elements;
    let mask: MirrorMask | null = null;
    if (this.mirrorMaskOn && this.cullOn && (this.cullBits & 2) !== 0 && !this.cavityStudy && this.underwaterCapturePlane() === null) {
      mask = buildMirrorMask(vpR, cam.position, this.reflPlaneY, this.data.grid, this.data.h);
      let marked = 0;
      for (let k = 0; k < mask.bits.length; k += 1) marked += mask.bits[k];
      this.lastMirrorMask = { samples: mask.samples, marked, full: mask.full };
    } else this.lastMirrorMask = null;
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
        if ((hidden && hidden[k]) || this.experimentVegetationMasks[vi]?.[k] || (!this.treesVisible && v.treeMask[k])) continue;
        sp.center.set(v.sph[k * 4], v.sph[k * 4 + 1], v.sph[k * 4 + 2]);
        sp.radius = v.sph[k * 4 + 3];
        const src = v.mats.subarray(k * 16, k * 16 + 16);
        const csrc = v.cols ? v.cols.subarray(k * 3, k * 3 + 3) : null;
        if (!this.cullOn || (this.cullBits & 1) === 0 || fr.intersectsSphere(sp)) {
          dm.set(src, nm * 16);
          if (cm && csrc) cm.set(csrc, nm * 3);
          nm += 1;
        }
        if ((!this.cullOn || (this.cullBits & 2) === 0 || frR.intersectsSphere(sp))
          && (!mask || mirrorMaskHits(mask, vpR, sp.center.x, sp.center.y, sp.center.z, sp.radius))) {
          const far = this.standInsOn && dl && (!v.liteLiveOnly || this.branchStandInsOn) && sp.center.distanceToSquared(eye) > liteD2;
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
      // A live-only stand-in (the branches) stays out of the scene graph walk
      // until the live page asks for it, so a static capture draws as before.
      if (v.lite && v.liteLiveOnly) v.lite.visible = this.branchStandInsOn;
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
    // The water's wet area moves the mirror's mask: re-cull at most every 2 s
    // after a new picture (a spell's new pond reflects within 2 s).
    if (this.mirrorMaskOn && this.data.h !== this.mirrorMaskH && performance.now() - this.mirrorMaskAt > 2000) {
      this.mirrorMaskH = this.data.h;
      this.mirrorMaskAt = performance.now();
      this.mirrorMaskStamp += 1;
    }
    const key = `${this.branchStandInsOn}|${this.mirrorMaskOn}|${this.mirrorMaskStamp}|${this.cullOn}|${this.cullBits}|${this.standInsOn}|${this.liteM}|${this.reflPlaneY}|${Array.from(e).map((x) => x.toFixed(4)).join(',')}|${pe[0].toFixed(5)},${pe[5].toFixed(5)}`;
    if (key === this.cullKey) return;
    this.cullKey = key;
    this.cullVegetation();
  }

  setSize(w: number, h: number): void {
    // Exposure metering awaits GPU readback after recording this frame's
    // targets. Disposing them during that wait produced black wide captures
    // and destroyed-texture submissions. Apply only the latest requested
    // size after that frame has resumed and submitted its output.
    if(this.metering){
      this.pendingResize={w,h};
      if(!this.resizeWaiting){
        this.resizeWaiting=true;
        void this.metering.then(()=>{
          this.resizeWaiting=false;const next=this.pendingResize;this.pendingResize=null;
          if(next)this.setSize(next.w,next.h);
        },()=>{this.resizeWaiting=false;this.pendingResize=null;});
      }
      return;
    }
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
    this.sceneRT = this.makeSceneRT(w, h);
    this.finalRT = this.makeFinalRT(w, h);
    this.reflection.setSize(w, h);
  }

  setPose(p: RiverPose, keepExposure = false): void {
    // (Rivers round 4: a camera that follows the paper boat moves every
    // frame; it keeps the exposure it metered when it started.)
    if (!keepExposure) this.meterDirty = true;
    this.camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
    // Presets can outlive a terrain edit. Apply the same permission-aware
    // floor as movement before looking at the target, so a new source bank
    // cannot put a stationary preset camera inside its mountain.
    this.keepCameraAboveFloor();
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
    const source = this.waterfall?.surfaceAt(x, z);
    if (source !== undefined && source !== null) return source;
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
    if (!this.samplers) this.samplers = riverSamplers(this.data, true, this.flowCoarse);
    return this.samplers.levelAt(x, z);
  }

  /** Show a frozen native capture separately from this clone's generated terrain.
   * Content identity cannot certify the clone until a matching capture exists.
   * The native water material is reused; there is no cosmetic covering sheet.
   */
  showCavityStudy(terrainPositions: number[], waterPositions: number[], timeSeconds: number): void {
    this.hideCavityStudy();
    const makeGeometry = (positions: number[]): THREE.BufferGeometry => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      return geometry;
    };
    const terrain = new THREE.Mesh(makeGeometry(terrainPositions), new THREE.MeshStandardNodeMaterial({ color: 0x776e5d, roughness: 0.94, side: THREE.DoubleSide }));
    const waterGeometry = makeGeometry(waterPositions);
    riverSheetPreviousHeights(waterGeometry, null, null, this.data.grid);
    const water = new THREE.Mesh(waterGeometry, this.waterMat.material);
    water.frustumCulled = false;
    const hidden: Array<[THREE.Object3D, boolean]> = [];
    for (const scene of [this.scene, this.waterScene]) for (const child of scene.children) {
      // Keep the native lights and sky. Captured solids replace the cloned
      // landscape only for this explicit historical study.
      if ((child as THREE.Light).isLight || !(child as THREE.Mesh).isMesh && !(child as THREE.Group).isGroup) continue;
      hidden.push([child, child.visible]); child.visible = false;
    }
    this.scene.add(terrain); this.waterScene.add(water);
    this.cavityStudy = { terrain, water, hidden, groundBatch: this.groundBatch.enabled };
    this.groundBatch.enabled = false;
    this.pinnedTime = timeSeconds;
  }

  hideCavityStudy(): void {
    const study = this.cavityStudy; if (!study) return;
    for (const [child, visible] of study.hidden) child.visible = visible;
    this.groundBatch.enabled = study.groundBatch;
    this.scene.remove(study.terrain); this.waterScene.remove(study.water);
    study.terrain.geometry.dispose(); (study.terrain.material as THREE.Material).dispose();
    study.water.geometry.dispose(); this.cavityStudy = null;
    this.pinnedTime = null;
  }

  /** Camera following pauses while stored geometry is under inspection. */
  get cavityStudyActive(): boolean { return this.cavityStudy !== null; }

  focusCavityPatch(terrainPositions?: number[]): void {
    const y = terrainPositions?.length ? terrainPositions.filter((_, i) => i % 3 === 1).reduce((a, b) => a + b, 0) / (terrainPositions.length / 3) : this.groundAt(37, 23);
    this.setPose({ pos: [40, y + 2.5, 27], look: [37, y, 23], fov: 45 });
  }

  /** Read one native quad without rendering, rebuilding water, or advancing flow. */
  inspectQuad(x: number, z: number): ReturnType<typeof inspectRiverQuad> {
    const position = this.water.geometry.getAttribute('position');
    const current = this.quadInstalled?.geometry === this.water.geometry ? this.quadInstalled : null;
    return inspectRiverQuad({ grid: this.data.grid, h: this.data.h, ground: this.data.ground, surface: this.data.surface,
      raw: current?.sheet ?? null,
      installed: position && !('isInterleavedBufferAttribute' in position)
        ? { pos: position.array, index: this.water.geometry.getIndex()?.array ?? null } : null,
      certificate: current?.certificate ?? null }, x, z);
  }

  /** Copy the material's installed half-float samples without advancing flow.
   * This is a CPU installation observation, not proof of a visible water pixel.
   * Impact height gates use the mirror sheet interpolation, not an individual
   * displaced/refined vertex; the copied uniforms remain available for review.
   */
  inspectMaterialAt(x: number, z: number) {
    const { x0, z0, nx, nz, dx } = this.data.grid;
    if (!Number.isFinite(x) || !Number.isFinite(z) || x < x0 || z < z0 || x >= x0 + nx * dx || z >= z0 + nz * dx) return null;
    const flow0 = this.mirror.flow(0, x, z, [0, 0, 0, 0]);
    const flow1 = this.mirror.flow(1, x, z, [0, 0, 0, 0]);
    const flow2 = this.mirror.flow(2, x, z, [0, 0, 0, 0]);
    const uniforms = this.waterMat.uniforms;
    const frame = (uniforms.uPoolImpactFrame.value as THREE.Vector4).toArray();
    const energy = (uniforms.uPoolImpactEnergy.value as THREE.Vector4).toArray();
    const poolLevel = uniforms.uPoolImpactLevel.value as number;
    const mainRapidsShare = this.mirror.mainRapidsShare(x, z), appearanceClock = this.waterTime();
    if (![...flow0, ...flow1, ...flow2, ...frame, ...energy, poolLevel, mainRapidsShare, appearanceClock].every(Number.isFinite)) return null;
    const sheetHeight = this.mirror.sheetAt(x, z), distanceM = Math.hypot(x - frame[0], z - frame[1]);
    const heightDifferenceM = Number.isFinite(sheetHeight) ? Math.abs(sheetHeight - poolLevel) : null;
    const gates = { dischargePositive: energy[0] > 0, impactDepthPositive: energy[3] > 0,
      distanceWithin8M: distanceM < 8, sheetHeightWithinHalfM: heightDifferenceM !== null && heightDifferenceM < 0.5,
      localDepthAbove002M: flow0[2] > 0.02 };
    const installed = this.quadInstalled?.geometry === this.water.geometry ? this.quadInstalled.certificate : null;
    return { x, z, flow0, flow1, flow2, speedMS: Math.hypot(flow0[0], flow0[1]), mainRapidsShare,
      channels: { velocityX: flow0[0], velocityZ: flow0[1], depthM: flow0[2], levelM: flow0[3],
        whiteWater: flow1[0], foamStreaks: flow1[1], wetDistanceM: flow1[2], turbulence: flow1[3],
        rockHeightM: flow2[0], wakeRidges: flow2[1], standingForcing: flow2[2], microRippleSlope: flow2[3] },
      impact: { frame, energy, poolLevel, distanceM, sheetHeight: Number.isFinite(sheetHeight) ? sheetHeight : null,
        heightDifferenceM, gates, applicableAtMirrorSheet: Object.values(gates).every(Boolean) },
      appearanceClock, appearanceFrozen: this.appearanceFrozen, pinnedTime: this.pinnedTime,
      application: installed ? { ...installed } : null,
      sampling: 'CPU mirror of installed half-float texels, bilinear and edge-clamped; no GPU upload certificate' };
  }

  /** Copy the fixed bank's original drawn terrain, never render or advance water.
   * This certifies a synchronous CPU scene observation, not raw worker pairing,
   * screen output, a single-valued bottom, or completeness of other scene solids.
   */
  captureBankTerrain(wholeRockObjects = false) {
    const patch = { minX: 36, maxX: 38, minZ: 22, maxZ: 24 };
    const unavailable = (message: string): Extract<RiverBankTerrainCaptureResult, { ok: false }> => ({ ok: false, code: 'incomplete', message,
      counters: { inputMeshes: 0, instances: 0, inputVertices: 0, rejectedBounds: 0, scannedTriangles: 0, outputTriangles: 0 } });
    if (!this.bankTerrainCommitted || this.bankTerrainTiles.length > 4096) return unavailable('Terrain patch not committed or retained-source count exceeded.');
    const installed = this.quadInstalled?.geometry === this.water.geometry ? this.quadInstalled.certificate : null;
    if (!installed || this.frames === 0) return unavailable('No completed CPU flow installation/initialized scene observation.');
    const stones = this.tunes.v4 > 0 ? this.stonesMixed : this.stonesR4;
    if (!stones || !stones.visible) return unavailable('The selected small-stone set is unavailable.');
    const sources: RiverBankTerrainSource[] = [];
    const originals = [...this.bankTerrainTiles];
    // buildCliff replaces this named group on edits. Resolve its CURRENT owner
    // each observation, never retain a removed cliff or silently omit it.
    const cliff = this.waterfall?.group.children.find(child => child.name === 'continuous waterfall mountain');
    let cliffWitness: { meshUuid: string; geometryUuid: string; positionVersion: number; worldMatrix: number[];
      scannedVertices: number; minX: number; maxX: number; minZ: number; maxZ: number; disjoint: boolean } | null = null;
    if (this.waterfall) {
      if (!cliff || !cliff.visible || cliff.children.length !== 1 || !(cliff.children[0] as THREE.Mesh).isMesh)
        return unavailable('Current native cliff source ownership unavailable.');
      const mesh = cliff.children[0] as THREE.Mesh, position = mesh.geometry.getAttribute('position');
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const nodes = material as THREE.Material & { positionNode?: unknown; vertexNode?: unknown; geometryNode?: unknown;
          displacementMap?: unknown; isShaderMaterial?: boolean };
        if (nodes.positionNode || nodes.vertexNode || nodes.geometryNode || nodes.displacementMap || nodes.isShaderMaterial
          || material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile)
          return unavailable('Current cliff exclusion cannot certify shader-modified positions.');
      }
      if (!mesh.visible || !position || position.itemSize !== 3 || position.count > 1000000
        || !mesh.matrixWorld.elements.every(Number.isFinite) || mesh.matrixWorld.elements[3] !== 0
        || mesh.matrixWorld.elements[7] !== 0 || mesh.matrixWorld.elements[11] !== 0 || mesh.matrixWorld.elements[15] !== 1)
        return unavailable('Cliff exclusion witness exceeds bounded static geometry contract.');
      const point = new THREE.Vector3();
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      // Exact conservative x/z vertex bounds of the current CPU triangles prove
      // exclusion at capture time without rebuilding any cliff or trusting a
      // wide spherical bound. Affine triangles lie within their vertex bounds.
      for (let i = 0; i < position.count; i += 1) {
        point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        if (!point.toArray().every(Number.isFinite)) return unavailable('Nonfinite current cliff exclusion geometry.');
        minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minZ = Math.min(minZ, point.z); maxZ = Math.max(maxZ, point.z);
      }
      const disjoint = maxX < patch.minX || minX > patch.maxX || maxZ < patch.minZ || minZ > patch.maxZ;
      cliffWitness = { meshUuid: mesh.uuid, geometryUuid: mesh.geometry.uuid,
        positionVersion: 'version' in position ? position.version : position.data.version,
        worldMatrix: mesh.matrixWorld.elements.slice(), scannedVertices: position.count, minX, maxX, minZ, maxZ, disjoint };
      if (!disjoint) originals.push({ name: 'current-waterfall-cliff', mesh });
    }
    // splitByTiles computed these spheres; applyBedPatch recomputes every touched
    // tile. They conservatively omit distant tiles, independent of camera frusta.
    // Unknown bounds or hidden originals fail; no visibility bypass or scene edit.
    for (const source of originals) {
      const mesh = source.mesh, position = mesh.geometry.getAttribute('position');
      const sphere = mesh.geometry.boundingSphere?.clone().applyMatrix4(mesh.matrixWorld);
      if ((source.name === 'current-waterfall-cliff' ? mesh.parent !== cliff : mesh.parent !== this.scene) || !mesh.visible || !position || !sphere
        || ![...sphere.center.toArray(), sphere.radius, ...mesh.matrixWorld.elements].every(Number.isFinite)
        || sphere.radius < 0) return unavailable('Original terrain ownership, visibility or conservative bounds unavailable.');
      if (sphere.center.x + sphere.radius < patch.minX || sphere.center.x - sphere.radius > patch.maxX
        || sphere.center.z + sphere.radius < patch.minZ || sphere.center.z - sphere.radius > patch.maxZ) continue;
      // Ground stays patch-local. A rock tile is a drawn object, not necessarily
      // a closed boulder: its retained faces still need cross-tile closure tests.
      sources.push(wholeRockObjects && source.name.startsWith('rock-')
        ? { ...source, retainIntersectingComponents: true } : source);
    }
    // Small stones are outside vegetation compaction. Copy their entire active
    // chosen set, including off-camera instances; the helper's bounds select it.
    sources.push({ name: this.tunes.v4 > 0 ? 'small-stones-mixed' : 'small-stones-r4', mesh: stones,
      ...(wholeRockObjects ? { retainWholeObject: true as const } : {}) });
    const consistencyToken = JSON.stringify({ scene: this.scene.uuid, terrainRevision: this.bankTerrainRevision,
      ...(wholeRockObjects ? { rockFaceSelection: 'whole-intersecting-object' } : {}),
      installedFlow: installed, currentCliff: cliff?.children[0].uuid ?? null, stoneVariant: this.tunes.v4 > 0 ? 'mixed' : 'r4', displayPairing: 'unavailable' });
    const result = captureRiverBankTerrainSnapshot({ sources, patch, consistencyToken, inputsComplete: true,
      caps: { inputMeshes: 256, instances: 8192, inputVertices: 1000000, scannedTriangles: 100000, outputTriangles: 20000 } });
    if (!result.ok) return result;
    // Plain numeric arrays survive CDP/JSON serialization. The helper enforced
    // the output cap first: at most 180000 copied coordinate numbers.
    return { ok: true as const, snapshot: { ...result.snapshot, vertices: Array.from(result.snapshot.vertices), cliffWitness,
      limitations: [...result.snapshot.limitations, 'Named original ground, boulders, current waterfall cliff and active small stones only; vegetation, dropped objects, blockers and study solids are excluded.',
        'Committed CPU terrain and installed display water share this observation token; current raw worker inventory pairing is unavailable.'] } };
  }

  /** The ground at (x, z) (the fine grid, the outer lattice past it), m. */
  groundAt(x: number, z: number): number {
    if (!this.samplers) this.samplers = riverSamplers(this.data, true, this.flowCoarse);
    return this.samplers.groundAt(x, z);
  }

  /** The velocity the water's texture rides at (x, z): the flow map's smoothed field, m/s. */
  /** The blend between live pictures (read-only; see flowPrev). */
  flowBlendInfo(): { value: number; spanMs: number; lastPictureAt: number } {
    const u = this.waterMat.uniforms.uFlowBlend;
    return { value: u ? Number(u.value) : 1, spanMs: this.flowBlendSpanMs, lastPictureAt: this.flowLastPictureAt };
  }

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
  setTunes(t: Partial<{ slab: number; v1: number; v2: number; v3: number; v4: number; film: number }>): void {
    const was4 = this.tunes.v4 > 0;
    this.tunes = { ...this.tunes, ...t };
    const T = this.tunes;
    (this.waterMat.uniforms.uTune.value as THREE.Vector4).set(T.v1, T.v2, T.v3, T.v4);
    this.waterMat.uniforms.uTuneSlab.value = T.slab;
    // film: 1 = water thickness across the surface (h cos θ), 0 = the old vertical column.
    this.waterMat.uniforms.uFilmOnSurface.value = T.film;
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
    this.airProbeRevision += 1;
    this.vegSets.forEach((v, vi) => {
      const hidden = this.edit ? this.edit.veg[vi].hidden : null;
      const dm = v.mesh.instanceMatrix.array as Float32Array;
      if (!hidden && !this.experimentVegetationMasks[vi] && this.treesVisible) {
        dm.set(v.mats);
        drawCount(v.mesh, v.n);
      } else {
        // (The live river: the plants an edit hides cast no shadow.)
        let m = 0;
        for (let k = 0; k < v.n; k += 1) {
          if (hidden?.[k] || this.experimentVegetationMasks[vi]?.[k] || (!this.treesVisible && v.treeMask[k])) continue;
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

  /** Hide trees in the camera, mirror, underwater capture and static shadows.
   * Existing edit masks and original matrices remain the restoration authority.
   */
  setTreesVisible(on: boolean): void {
    if (this.treesVisible === on) return;
    this.treesVisible = on;
    this.performanceHeatmap?.refresh();
    this.reprimeShadows();
    this.meterDirty = true;
  }

  ablate(part: RiverAblatePart, on: boolean): void {
    this.off[part] = !on;
    const bankU = this.bankMat.userData.riverUniforms as Record<string, TslNode>;
    bankU.uCausticSun.value.set(this.off.caustics ? 0 : 1, 1, 1);
  }

  /** Explicit comparison control for the main rapids reference correction.
   * The original river and the upstream approach retain their own optics. */
  setMainRapidsOptics(enabled: boolean): void {
    const active = enabled && riverHeadwatersEnabled();
    if ((this.waterMat.uniforms.uMainRapidsOptics.value > 0) !== active) this.receivingConfigId = crypto.randomUUID();
    this.waterMat.uniforms.uMainRapidsOptics.value = active ? 1 : 0;
    this.mirror.setMainRapidsMorphology(this.mainOpticsMask ? this.mainOpticsMask.image.data as Uint8Array : null, active);
    const old = this.water.geometry;
    this.water.geometry = this.prepareReceivingGeometry(buildRiverWaterGeometry(flowMapOf(this.data)));
    old.dispose();
  }

  setDebug(mode: number): void {
    this.waterMat.uniforms.uDebug.value = mode;
    // Compare the same receiving-water triangles against terrain depth. Only
    // this material bypasses depth; the solver, geometry and other water stay intact.
    const depthTest = mode === 15 ? false : this.normalWaterDepthTest;
    if (this.waterMat.material.depthTest !== depthTest) {
      this.waterMat.material.depthTest = depthTest;
      this.waterMat.material.needsUpdate = true;
    }
    if (mode === 0) this.setAppearanceFrozen(false);
  }

  /** Hold the current surface-animation phase without pausing physical flow. */
  setAppearanceFrozen(frozen: boolean): void {
    if (frozen === this.appearanceFrozen) return;
    if (frozen) {
      this.appearanceReturnTime = this.pinnedTime;
      // Capture the existing clock before pinning it, so checking the box does
      // not jump to a new wave phase. Existing capture-time pins are preserved.
      this.pinnedTime = this.waterTime();
    } else {
      this.pinnedTime = this.appearanceReturnTime;
      this.appearanceReturnTime = null;
    }
    this.appearanceFrozen = frozen;
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
    const smp = riverSamplers(this.data, false, this.flowCoarse);
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
   * where the point projects is read back. drawnGeometry selects debug 12,
   * the actual displaced triangle height relative to one shared probe level. The default
   * still measures optical noise/CPU parity. This path only rejects offscreen
   * projections: debug 10/12 contain no water-coverage marker. A separate
   * coverage observation is needed before claiming this is visible water.
   */
  async readSurfaceHeight(x: number, z: number, drawnGeometry = false): Promise<{ h: number; level: number; x: number; z: number; mirror: number } | null> {
    await this.settled();
    const lv = this.mirror.flow(0, x, z, [0, 0, 0, 0])[3];
    const [sx, sy] = this.worldToScreen(x, lv, z);
    // (The pixel's row from the TOP: WebGPU's read-back rows.)
    const px = Math.round(sx - 0.5);
    const py = Math.round(sy - 0.5);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return null;
    this.holdLoop = true;
    const dbg = this.waterMat.uniforms.uDebug.value;
    this.waterMat.uniforms.uDebug.value = drawnGeometry ? 12 : 10;
    // The pixel's world x and z come back relative to the asked point (half
    // floats: a small offset keeps them exact to about 3e-5 m).
    this.waterMat.uniforms.uProbe.value.set(x, z);
    this.waterMat.uniforms.uProbeLevel.value = lv;
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
    out.mirror = drawnGeometry
      ? this.mirror.surfaceAt(out.x, out.z, this.waterTime()) - lv
      : this.mirror.heightAt(out.x, out.z, this.waterTime());
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
  followBoatStep(dYaw = 0, dPitch = 0, zoom = 1, objectId?: number): boolean {
    const s = this.floaters.last;
    const body = objectId === undefined ? undefined : this.droppedObjects.sim.bodies.find((b) => b.id === objectId);
    if (objectId !== undefined && !body) { this.unpinBoat(); return false; }
    if (!s && !body) return false;
    const cam = this.camera;
    const tgt = body ? new THREE.Vector3(body.x, body.y + 0.15, body.z) : this.floaters.boatPosition().add(new THREE.Vector3(0, 0.03, 0));
    const heading = body?.heading ?? s!.boat.heading;
    const Y = new THREE.Vector3(0, 1, 0);
    if (!this.follow) {
      const p = body ? { pos: [body.x + 4, body.y + 3, body.z + 4], fov: 48 } : this.floaters.followPose();
      cam.position.set(p.pos[0], p.pos[1], p.pos[2]);
      cam.fov = p.fov;
      cam.updateProjectionMatrix();
      cam.lookAt(tgt);
      cam.updateMatrixWorld();
      this.follow = { heading, last: tgt.clone() };
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
    const pitch = Math.max(this.allowBelowWater ? -1.48 : 0.09, Math.min(1.48, down + dPitch)) - down;
    fwd.applyAxisAngle(right, -pitch);
    // The boat's turn: heading runs from +x toward +z, a turn about three's
    // +y the other way.
    const dh = Math.atan2(Math.sin(heading - f.heading), Math.cos(heading - f.heading));
    fwd.applyAxisAngle(Y, -dh);
    cam.position.copy(tgt).addScaledVector(fwd, -dist);
    if (!this.allowBelowWater && cam.position.y < tgt.y + 0.08) cam.position.y = tgt.y + 0.08;
    this.keepCameraAboveFloor(0.08);
    cam.lookAt(tgt);
    cam.updateMatrixWorld();
    f.heading = heading;
    f.last.copy(tgt);
    this.reflPlaneY = this.levelNear(tgt.x, tgt.z);
    return true;
  }

  /** Drop onto the visible water mesh; dry geometry and banks reject placement. */
  dropAtScreen(kind: RiverDropKind, px: number, py: number): number {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(px, py), this.camera);
    const hits = ray.intersectObject(this.water);
    for (const hit of hits) if (this.mirror.depth(hit.point.x, hit.point.z) > 0.02) {
      return this.droppedObjects.drop(kind, hit.point.x, hit.point.z);
    }
    return 0;
  }
  /** Named drop areas search nearby wet points, so a changed bed stays usable. */
  dropInReach(kind: RiverDropKind, location: string): number {
    const s = location === 'plunge-pool' ? -148 : location === 'rapids' ? -48 : 205;
    const course = defaultRiverCourse();
    for (const ds of [0, 3, -3, 7, -7, 12, -12]) for (const n of [0, 2, -2, 4, -4]) {
      const p = course.at(s + ds);
      const added = this.droppedObjects.drop(kind, p.x + n * p.tz, p.z - n * p.tx);
      if (added) return added;
    }
    return 0;
  }
  droppedObjectPose(): RiverPose | null {
    const b = this.droppedObjects.latest();
    if (!b) return null;
    return { pos: [b.x + 5, b.y + 4, b.z + 6], look: [b.x, b.y, b.z], fov: 48 };
  }

  /** The ground and water samplers, built once (for the free camera's floor). */
  private samplers: ReturnType<typeof riverSamplers> | null = null;
  /** The last live picture's coarse far level (GG-430; the samplers read it). */
  private flowCoarse: RiverCoarseLevel | null = null;

  /**
   * A FREE CAMERA'S FLOOR (rivers round 4): at least 0.25 m over the water
   * and the ground where it is, so a person flying low does not go under the
   * river or into a bank.
   */
  /** Read the SAME clearance used by movement without moving the camera. */
  cameraFloorInfo(minM = 0.25): { minimumY: number | null; atLimit: boolean } {
    if (!this.samplers) this.samplers = riverSamplers(this.data, true, this.flowCoarse);
    const c = this.camera.position, g = this.samplers.groundAt(c.x, c.z);
    const water = this.mirror.depth(c.x, c.z) > 0.01 ? this.samplers.levelAt(c.x, c.z) : -Infinity;
    const floor = Math.max(this.allowBelowGround ? -Infinity : g, this.allowBelowWater ? -Infinity : water) + minM;
    return { minimumY: Number.isFinite(floor) ? floor : null, atLimit: Number.isFinite(floor) && c.y <= floor + 0.0001 };
  }

  keepCameraAboveFloor(minM = 0.25): void {
    const c = this.camera.position, floor = this.cameraFloorInfo(minM).minimumY;
    // Each permission removes only its own floor; the readout uses this result.
    if (floor !== null && c.y < floor) {
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
    if (!this.samplers) this.samplers = riverSamplers(this.data, true, this.flowCoarse);
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
      const source = this.waterfall?.surfaceAt(x, z);
      if (source !== undefined && source !== null && y <= source) { target = source; break; }
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

  /** Only a wet surface directly over the camera determines its water medium. */
  private underwaterCapturePlane(): number | null {
    const eye = this.camera.position;
    const source = this.waterfall?.surfaceAt(eye.x, eye.z);
    let localLevel: number;
    if (source !== undefined && source !== null) localLevel = source;
    else {
      const { nx, nz, dx, x0, z0 } = this.data.grid;
      const i = Math.floor((eye.x - x0) / dx);
      const j = Math.floor((eye.z - z0) / dx);
      // A nearby pool cannot put a camera standing on a dry bank underwater.
      if (i < 0 || j < 0 || i >= nx || j >= nz || this.data.h[j * nx + i] <= 0.05) return null;
      localLevel = this.levelAt(eye.x, eye.z);
    }
    return eye.y < localLevel ? localLevel : null;
  }

  /** Supply offscreen trees inside Snell's window without repeating viewport edges. */
  private updateUnderwaterAirProbe(underwaterPlane: number | null): void {
    const wu = this.waterMat.uniforms;
    if (underwaterPlane === null) { wu.uAirProbeValid.value = 0; return; }
    const probePosition = new THREE.Vector3(this.camera.position.x, underwaterPlane + 0.08, this.camera.position.z);
    const moved = Math.hypot(probePosition.x - this.airProbePosition.x, probePosition.z - this.airProbePosition.z) >= 1
      || Math.abs(probePosition.y - this.airProbePosition.y) >= 0.2;
    if (!moved && this.airProbeDrawnRevision === this.airProbeRevision) { wu.uAirProbeValid.value = 1; return; }
    if (!this.airProbeRT) {
      this.airProbeRT = new CubeRenderTarget(256, { type: THREE.HalfFloatType, depthBuffer: true, generateMipmaps: false, minFilter: THREE.LinearFilter });
      this.airProbeCam = new THREE.CubeCamera(0.05, this.camera.far, this.airProbeRT);
      this.airProbeCam.layers.mask = this.camera.layers.mask;
      // Dispose the one-pixel placeholder once the real capture owns the binding.
      wu.uAirEnvironment.value.dispose();
      wu.uAirEnvironment.value = this.airProbeRT.texture;
    }
    const cube = this.airProbeCam!;
    cube.position.copy(probePosition);
    cube.updateMatrixWorld();
    // The six faces need scenery outside the player's current viewport. Fill
    // the existing camera copies with all non-hidden plants, then restore the
    // ordinary camera/mirror culling regardless of capture success.
    this.vegSets.forEach((v, vi) => {
      const hidden = this.edit ? this.edit.veg[vi].hidden : null;
      const matrices = v.mesh.instanceMatrix.array as Float32Array;
      const colors = v.mesh.instanceColor?.array as Float32Array | undefined;
      let count = 0;
      for (let k = 0; k < v.n; k += 1) {
        if (hidden?.[k] || this.experimentVegetationMasks[vi]?.[k] || (!this.treesVisible && v.treeMask[k])) continue;
        matrices.set(v.mats.subarray(k * 16, k * 16 + 16), count * 16);
        if (colors && v.cols) colors.set(v.cols.subarray(k * 3, k * 3 + 3), count * 3);
        count += 1;
      }
      drawCount(v.mesh, count);
      v.mesh.instanceMatrix.needsUpdate = true;
      if (v.mesh.instanceColor) v.mesh.instanceColor.needsUpdate = true;
    });
    const r = this.renderer;
    const previousSkyPosition = this.sky.position.clone();
    const previousAutoClear = r.autoClear;
    const previousTarget = r.getRenderTarget();
    const previousCubeFace = r.getActiveCubeFace();
    const previousMipmap = r.getActiveMipmapLevel();
    const previousXrEnabled = r.xr.enabled;
    this.sky.position.copy(probePosition);
    try {
      // CubeCamera supplies r172's WebGPU face orientation and restores the
      // render target. The adapter retains this scene's sky/opaque separation.
      cube.update({
        coordinateSystem: r.coordinateSystem, xr: r.xr,
        getRenderTarget: () => r.getRenderTarget(), getActiveCubeFace: () => r.getActiveCubeFace(),
        getActiveMipmapLevel: () => r.getActiveMipmapLevel(),
        setRenderTarget: (target, face, mip) => r.setRenderTarget(target, face, mip),
        render: (_scene, faceCamera) => {
          // Three r172's explicit clear does not set the active cube face.
          // Clearing through render uses the correct face, then the opaque
          // pass overlays it without erasing the sky behind the banks.
          r.autoClear = true;
          r.render(this.skyScene, faceCamera);
          r.autoClear = false;
          this.groundBatch.draw(faceCamera, () => r.render(this.scene, faceCamera));
        },
      }, this.scene);
      this.airProbePosition.copy(probePosition);
      this.airProbeDrawnRevision = this.airProbeRevision;
      this.airProbeRefreshes += 1;
      wu.uAirProbeValid.value = 1;
    } finally {
      r.autoClear = previousAutoClear;
      r.xr.enabled = previousXrEnabled;
      r.setRenderTarget(previousTarget, previousCubeFace, previousMipmap);
      this.sky.position.copy(previousSkyPosition);
      this.cullKey = '';
      this.cullIfMoved();
    }
    // DEBT: this local probe is a directional approximation for distant
    // scenery. Near-bank parallax and moving objects can lag until the camera
    // travels 1 m or the bank edit revision changes; validated screen hits
    // retain their foreground detail where the current capture supports it.
  }

  /**
   * Mirror the main camera in the plane y = reflPlaneY (the three.js
   * Reflector's method). The math lives in riverMirrorCamera.ts (the water
   * layer's slice 1, 2026-10-26), unchanged.
   */
  private updateReflection(underwaterPlane: number | null = this.underwaterCapturePlane()): void {
    this.reflection.update(this.camera, underwaterPlane);
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
  private performanceHeatmap: RiverPerformanceHeatmap | null = null;
  private performanceHeatmapPass: {
    target: THREE.RenderTarget; scene: THREE.Scene; depth: ReturnType<typeof createCopyPass>; composite: THREE.NodeMaterial;
    proxies: Map<THREE.Mesh, { mesh: THREE.Mesh; material: THREE.NodeMaterial; alpha: TslNode }>;
  } | null = null;
  setPerformanceHeatmap(on: boolean): void {
    if (on && !this.performanceHeatmap) this.performanceHeatmap = new RiverPerformanceHeatmap(this.renderer);
    this.performanceHeatmap?.setEnabled(on);
    if (!on) this.disposePerformanceHeatmapPass();
  }
  refreshPerformanceHeatmap(): void { this.performanceHeatmap?.refresh(); }
  performanceHeatmapReading(): RiverHeatmapReading {
    return this.performanceHeatmap?.reading() ?? { enabled:false,state:'off',completed:0,total:0,measuredAt:null,groups:[],message:'' };
  }
  private drawHeatmapScene(scene: THREE.Scene, camera: THREE.Camera, kind: string): void {
    if (this.performanceHeatmap?.enabled) this.performanceHeatmap.draw(scene,camera,kind,()=>this.renderer.render(scene,camera));
    else this.renderer.render(scene,camera);
  }
  private disposePerformanceHeatmapPass(): void {
    const pass=this.performanceHeatmapPass;
    if (!pass) return;
    pass.target.dispose();pass.depth.material.dispose();pass.composite.dispose();
    // All native geometry and instance buffers are borrowed, never disposed here.
    for (const p of pass.proxies.values()) p.material.dispose();
    this.performanceHeatmapPass=null;
  }
  private drawPerformanceHeatmap(): void {
    if (!this.performanceHeatmap?.enabled || this.showTarget!==0 || this.off.water) return;
    const colored=this.performanceHeatmap.coloredMeshes();
    if (!colored.length) return;
    if (!this.performanceHeatmapPass) {
      const target=this.makeFinalRT(this.width,this.height),depth=createCopyPass();
      depth.material.fragmentNode=vec4(0,0,0,0);
      const composite=new THREE.NodeMaterial();
      composite.name='river measured GPU cost composite';composite.vertexNode=quadVertex();
      composite.fragmentNode=vec4(1,0,0,riverTexture(target.texture).sample(screenUV).a);
      composite.transparent=true;composite.depthTest=false;composite.depthWrite=false;composite.fog=false;composite.lights=false;
      this.performanceHeatmapPass={target,scene:new THREE.Scene(),depth,composite,proxies:new Map()};
    }
    const pass=this.performanceHeatmapPass;
    if (pass.target.width!==this.width || pass.target.height!==this.height) pass.target.setSize(this.width,this.height);
    const visible=new Set<THREE.Mesh>();
    for (const {source,alpha} of colored) {
      visible.add(source);
      let proxy=pass.proxies.get(source);
      if (!proxy) {
        const material=new THREE.NodeMaterial(),a=uniform(alpha);
        material.name='river measured GPU cost coverage';
        const native=Array.isArray(source.material)?source.material[0]:source.material;
        const cutout=native as THREE.Material & {map?:THREE.Texture|null};
        material.fragmentNode=Fn(()=>{
          // Native alpha-cut leaves retain their leaf-shaped footprint.
          if(cutout.map && native.alphaTest>0) texture(cutout.map,uv()).a.lessThanEqual(native.alphaTest).discard();
          return vec4(1,0,0,a);
        })();
        material.fog=false;material.lights=false;material.depthTest=true;material.depthWrite=true;
        const im=source as THREE.InstancedMesh;
        const mesh=im.isInstancedMesh ? new THREE.InstancedMesh(source.geometry,material,im.count) : new THREE.Mesh(source.geometry,material);
        if (im.isInstancedMesh) (mesh as THREE.InstancedMesh).instanceMatrix=im.instanceMatrix;
        mesh.matrixAutoUpdate=false;mesh.frustumCulled=false;
        proxy={mesh,material,alpha:a};pass.proxies.set(source,proxy);pass.scene.add(mesh);
      }
      source.updateWorldMatrix(true,false);
      proxy.mesh.geometry=source.geometry;proxy.mesh.matrix.copy(source.matrixWorld);proxy.mesh.layers.mask=source.layers.mask;
      if ((source as THREE.InstancedMesh).isInstancedMesh) {
        const im=source as THREE.InstancedMesh,p=proxy.mesh as THREE.InstancedMesh;
        p.count=im.count;p.instanceMatrix=im.instanceMatrix;
      }
      const material=Array.isArray(source.material) ? source.material[0] : source.material;
      if (material instanceof THREE.NodeMaterial) proxy.material.positionNode=material.positionNode;
      proxy.material.side=material.side;proxy.alpha.value=alpha;
    }
    for (const [source,p] of pass.proxies) if (!visible.has(source)) {
      pass.scene.remove(p.mesh);p.material.dispose();pass.proxies.delete(source);
    }
    pass.depth.depth.value=this.sceneRT.depthTexture;
    const r=this.renderer;r.setRenderTarget(pass.target);r.clear();
    this.quad.material=pass.depth.material;r.render(this.quadScene,this.quadCam);r.render(pass.scene,this.camera);
    r.setRenderTarget(this.finalRT);this.quad.material=pass.composite;r.render(this.quadScene,this.quadCam);
  }

  async render(): Promise<void> {
    if (this.metering) return this.metering;
    const r = this.renderer;
    const t = this.waterTime();
    const wu = this.waterMat.uniforms;
    const bankU = this.bankMat.userData.riverUniforms as Record<string, TslNode>;
    wu.uTime.value = t;
    bankU.uTime.value = t;
    if (wu.uFlowBlend) wu.uFlowBlend.value = this.flowBlendFrom > 0 ? Math.min(1, (performance.now() - this.flowBlendFrom) / Math.max(1, this.flowBlendSpanMs)) : 1;
    this.floaters.group.visible = this.floatersOn;
    if (this.floatersOn) this.floaters.update(t - this.floaterT0);
    this.droppedObjects.update(t);
    // Name the actual water work inside the measured frame. These spans are
    // contained in CPU callback time, not extra costs to add on top of it.
    const perf = getPerfSessions().find(session => session.element === r.domElement);
    let waterStarted = performance.now();
    this.waterfall?.update(t, this.camera);
    perf?.span('Original waterfall display', performance.now() - waterStarted);
    waterStarted = performance.now();
    this.spillView?.update(this.camera);
    perf?.span('Secondary spill display', performance.now() - waterStarted);
    waterStarted = performance.now();
    this.comparisons?.tick();
    perf?.span('Comparison waterfall display', performance.now() - waterStarted);
    this.flowBlockers.update(t);
    this.cullIfMoved();
    // Normal river animation and culling can make children visible again.
    // Reapply study isolation after them, including objects created since selection.
    if (this.cavityStudy) {
      const study = this.cavityStudy;
      for (const scene of [this.scene, this.waterScene]) for (const child of scene.children) {
        if (child === study.terrain || child === study.water || (child as THREE.Light).isLight || !(child as THREE.Mesh).isMesh && !(child as THREE.Group).isGroup) continue;
        if (!study.hidden.some(([saved]) => saved === child)) study.hidden.push([child, child.visible]);
        child.visible = false;
      }
    }

    this.performanceHeatmap?.setCamera(this.camera);
    this.performanceHeatmap?.beginFrame(this.camera,this.width,this.height);
    this.drawRiverFrame();
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
    // Draw after exposure metering so inspection cannot change water optics.
    this.drawWaterOutlines();
    this.drawPerformanceHeatmap();
    // 4. Output.
    this.quad.material = this.outQ.material;
    this.outQ.color.value = this.showTarget === 1 || this.off.water ? this.sceneRT.texture
      : this.showTarget === 2 ? this.reflMipRT.texture : this.finalRT.texture;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
    // 5. The overlay (the live river's edit handles), over the finished frame.
    // X-ray diagnostic dots retain tiny positive water records without pretending
    // they occupy expanded liquid volumes or hiding them behind the rock.
    this.comparisons?.draw(r, this.camera);
    if (this.overlay && !this.cavityStudy) r.render(this.overlay, this.camera);
    this.frames += 1;
    this.performanceHeatmap?.step(() => this.drawRiverFrame(true));
  }

  /** Native offscreen draw shared by normal frames and frozen A/B probes. */
  private drawRiverFrame(profiling=false): void {
    const r=this.renderer;
    // Looking at another river level cannot move the interface over an
    // underwater camera. Above water, retain the existing look-based plane.
    const underwaterPlane = this.cavityStudy ? null : this.underwaterCapturePlane();
    if (!profiling) this.updateUnderwaterAirProbe(underwaterPlane);

    // Reflection and main rendering share unchanged opaque object positions.
    // Refresh once per frame; camera/material work still runs for each pass.
    const drawOpaque = (): void => {
    // 1. Reflection: the sky with the camera's own projection, then the
    // scene with the oblique clip.
    if (!this.off.reflection) {
      // (RiverMirror.draw: the mirror camera, the sky with the camera's own
      // projection, then the scene with the oblique clip, then the copy into
      // the mipmapped target. Under water no sky draws: the misses carry
      // transparent black, and the material supplies water radiance.)
      this.reflection.draw(r, this.camera, underwaterPlane, {
        drawSky: (mc) => {
          this.sky.position.copy(mc.position);
          // No sun disk in the mirror: the water's own glint (GGX on the
          // rippled normal) draws the sun's reflection. The mirror's copy of
          // the disk, blurred by the rough water's mip level, drew one smooth
          // white blob on the riffle (rivers round 2).
          this.skyU.uSunDisk.value = 0;
          r.render(this.skyScene, mc);
          this.skyU.uSunDisk.value = 1;
        },
        drawScene: (mc) => this.groundBatch.draw(mc, () => this.drawHeatmapScene(this.scene, mc, 'terrain')),
        blit: (source, target) => {
          this.quad.material = this.blitQ.material;
          this.blitQ.color.value = source;
          r.setRenderTarget(target);
          r.render(this.quadScene, this.quadCam);
        },
      });
    }
    // 2. Opaque.
    this.sky.position.copy(this.camera.position);
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(this.skyScene, this.camera);
    this.groundBatch.draw(this.camera, () => this.drawHeatmapScene(this.scene, this.camera, 'terrain'));
    };
    if (this.shareOpaqueMatrices) shareRiverWorldMatrices(this.scene, drawOpaque);
    else drawOpaque();
    // 3. Copy with depth, then the water. With the water ablated (a cost
    // measurement), the copy goes too: the frame is then the plain scene
    // through the same output pass, and the difference is the whole cost of
    // the water (with the reflection pass, when that is ablated as well).
    if (!this.off.water) {
      // (RiverWaterLayer.drawWater: the opaque copy, the frame's uniforms,
      // the water scene.)
      this.waterLayer.drawWater(this.camera, {
        sceneColor: this.sceneRT.texture, sceneDepth: this.sceneRT.depthTexture,
        width: this.width, height: this.height, target: this.finalRT,
        underwaterPlane, reflectionOn: !this.off.reflection,
      }, {
        copyOpaque: (target) => {
          this.quad.material = this.copyQ.material;
          this.copyQ.color.value = this.sceneRT.texture;
          this.copyQ.depth.value = this.sceneRT.depthTexture;
          r.setRenderTarget(target);
          r.clear();
          r.render(this.quadScene, this.quadCam);
        },
        drawScene: (scene, cam) => this.drawHeatmapScene(scene, cam, 'water'),
      });
      // The optional candidate reconstructs only airborne liquid using the
      // opaque capture above. Legacy mode performs no added render passes.
      if (!this.cavityStudy) this.waterfall?.renderReconstructedFluid(r,this.camera,this.finalRT,this.width,this.height);
      this.mpmSurface?.render(r,this.camera,this.finalRT,this.width,this.height);
    }
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
    if (this.resourcesReleased) return;
    this.rendererDisposed = true;
    this.onRendererLost = null;
    if (this.mpmRunning) {
      const pending=this.mpmRunning; this.mpmCancelled=true;
      void pending.finally(()=>{this.mpmRunning=null;this.dispose();});
      return;
    }
    // Camera and reflection geometry share GPU allocations while alive.
    // Release them once for this renderer, then restore its native method.
    withRiverGeometryDisposal(this.renderer, () => {
      this.mpmSurface?.dispose(); this.mpmSurface=null;
      this.comparisons?.dispose();
      this.disposeWaterOutlinePass();
      this.performanceHeatmap?.dispose();this.performanceHeatmap=null;this.disposePerformanceHeatmapPass();
      this.hideCavityStudy();
      this.bankTerrainCommitted = false;
      // Temporary inspection settings never survive scene teardown.
      this.setDebug(0);
      if (this.experiments) { this.scene.remove(this.experiments.group); this.experiments.dispose(); }
      if (this.airProbeRT) this.airProbeRT.dispose();
      else this.waterMat.uniforms.uAirEnvironment.value.dispose();
      this.mainOpticsMask?.dispose();
      this.droppedObjects.dispose();
      this.spillView?.dispose();
      if (this.waterfall) { this.scene.remove(this.waterfall.group); this.waterfall.dispose(); }
      this.flowBlockers.dispose();
      this.sceneRT.dispose();
      this.finalRT.dispose();
      this.reflection.dispose();
      this.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      this.water.geometry.dispose();
      this.waterMat.material.dispose();
      this.groundBatch.dispose();
      if (this.groundMat !== this.bankMat) this.groundMat.dispose();
      this.sistersRockMat?.dispose();
      this.bankMat.dispose();
      this.meterRT?.dispose();
      this.renderer.dispose();
      // createRenderer requests a device owned only by this view. Closing it
      // also releases renderer allocations outside geometry attribute lists.
      this.device?.destroy();
    });
    this.resourcesReleased = true;
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

/**
 * The previous height of each water-sheet vertex, for the blend between live
 * pictures (2026-10-21): its current height moved by the change of the drawn
 * surface level in its cell. Without both levels (a new or a dried cell, or
 * no previous picture) the vertex has no previous height of its own and
 * draws at its current height.
 */
export function riverSheetPreviousHeights(geometry: THREE.BufferGeometry, before: Float32Array | ((c: number) => number) | null, after: Float32Array | null, grid: { nx: number; nz: number; dx: number; x0: number; z0: number }): void {
  // (A function: a patch picture's surfaceBeforeAt, GG-430.)
  const beforeAt = typeof before === 'function' ? before : before ? (c: number) => before[c] : null;
  const pos = geometry.getAttribute('position').array as Float32Array;
  const prev = new Float32Array(pos.length / 3);
  for (let v = 0; v < prev.length; v++) {
    let y = pos[v * 3 + 1];
    if (beforeAt && after) {
      const i = Math.floor((pos[v * 3] - grid.x0) / grid.dx), j = Math.floor((pos[v * 3 + 2] - grid.z0) / grid.dx);
      if (i >= 0 && i < grid.nx && j >= 0 && j < grid.nz) {
        const c = j * grid.nx + i, a = beforeAt(c), b = after[c];
        if (Number.isFinite(a) && Number.isFinite(b)) y += a - b;
      }
    }
    prev[v] = y;
  }
  geometry.setAttribute('aPrevY', new THREE.BufferAttribute(prev, 1));
}
