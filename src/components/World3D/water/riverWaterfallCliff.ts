/**
 * Builds the exposed mountain rock around the river's existing launch opening.
 * Finite slabs have real tops, sides and undersides attached to the existing
 * rock surface. Measured relief and smaller fractures remain on those faces. The same boundary and height helpers
 * used by the real terrain close the upper edge, so this is the visible face of
 * that mountain rather than a decorative wall in front of another landscape.
 * Water movement and the receiving river's materials remain in their owners.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 17/10/2026, 05:21:18
 * Dependents: components/World3D/water/riverCliffFrame.ts, components/World3D/water/riverReachScene.ts, components/World3D/water/riverSistersCliffSurface.ts, components/World3D/water/riverWaterfallView.ts, components/World3D/water/waterfallContactView.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import Delaunator from 'delaunator';
import { toCreasedNormals, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { attribute, cameraViewMatrix, float, max, mix, normalWorld, positionWorld, select, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import { mulberry32, type RiverCourse, type RiverShape } from '@/systems/world3d/river/riverReach';
import { WATERFALL, waterfallHydraulics, waterfallRockBoundary, waterfallSourceRockHeight } from '@/systems/world3d/river/riverHeadwaters';
import { retainNativeCliffBoundary, bindNativeBoundaryEpoch } from './riverNativeBoundaryAtlas';
import scannedRelief from './riverCliffScanRelief.json';
import fractureTraces from './riverCliffFractureTraces.json';
import { sampleWaterfallRockAlbedo, type BoundarySurfaceSampler } from './riverBoundaryLight';

/** Read-only render attribution controls: default 1 retains all measured
 * detail; the proof viewer can independently disable color or mapped normals. */
export const waterfallRockDiagnostics = { albedoWeight: uniform(1), normalWeight: uniform(1) };

/** Continuous phases retain measured grain without lattice-shaped contrast
 * cells. Both projections keep the scan's physical scale; slow bounded UV
 * bends and a faint oblique second phase interrupt recognizable tile repetition.
 * Normals retain one coherent measured phase; averaging unrelated vectors
 * previously erased the directional relief while leaving diffuse mottling. */
function continuousRockSample(map: THREE.Texture, p: THREE.Node) {
  const warp = vec2(p.dot(vec2(0.037, 0.061)).sin(), p.dot(vec2(-0.047, 0.029)).cos()).mul(0.65);
  const q = p.add(warp);
  const other = vec2(q.x.mul(0.8).sub(q.y.mul(0.6)), q.x.mul(0.6).add(q.y.mul(0.8))).mul(1.017).add(vec2(0.37, 0.63));
  const a = texture(map, q);
  if (map === maps?.normal) return a;
  const raw = texture(map, other);
  let b: THREE.Node = raw;
  if (map === maps?.normal) {
    const tangent = raw.rgb.mul(2).sub(1);
    const restored = vec2(tangent.x.mul(0.8).add(tangent.y.mul(0.6)), tangent.y.mul(0.8).sub(tangent.x.mul(0.6)));
    b = vec4(restored.mul(0.5).add(0.5), tangent.z.mul(0.5).add(0.5), raw.a);
  }
  const blend = p.dot(vec2(0.029, -0.023)).sin().mul(0.03).add(0.08);
  return mix(a, b, blend);
}

let rockMapsReady: Promise<void> | null = null;
let maps: { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture } | null = null;
let boundaryPixels: ImageData | null = null;
let boundaryReadback: Promise<void> | null = null;
export const waterfallBoundaryReadback = { milliseconds: 0, bytes: 0 };
/** Base-level bilinear sampling of the SAME measured color map and world
 * projection as the rock shader. CPU rays use the geometric normal for their
 * Lambert bounce; native PBR, mapped normals and anisotropic mip filtering
 * remain approximations, rather than hidden substitutes for scene light. */
export { sampleWaterfallRockAlbedo } from './riverBoundaryLight';
const cliffBoundarySampler: BoundarySurfaceSampler = {
  supports: mesh => !!(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).userData.waterfallRockDiagnostics,
  prepare() {
    if (!boundaryReadback) boundaryReadback = rockMapsReady!.then(() => {
      const start = performance.now(), image = maps!.color.image as HTMLImageElement;
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) throw new Error('Cliff albedo readback needs a 2D canvas');
      context.drawImage(image, 0, 0); boundaryPixels = context.getImageData(0, 0, canvas.width, canvas.height);
      waterfallBoundaryReadback.milliseconds = performance.now() - start; waterfallBoundaryReadback.bytes = boundaryPixels.data.byteLength;
    });
    return boundaryReadback;
  },
  serialize() {
    if (!boundaryPixels) throw new Error('Cliff scan is not prepared');
    return { kind: 'cliff', pixels: boundaryPixels, diagnostic: waterfallRockDiagnostics.albedoWeight.value };
  },
  sample(hit) {
    if (!boundaryPixels) return null;
    const material = Array.isArray(hit.mesh.material) ? hit.mesh.material[0] : hit.mesh.material;
    const attribute = material.userData.boundaryUsesRockTone ? hit.mesh.geometry.getAttribute('rockTone') : null;
    const tone = attribute ? hit.indices.reduce((sum, i, k) => sum + attribute.getX(i) * hit.barycentric.getComponent(k), 0) : 1;
    return { albedo: sampleWaterfallRockAlbedo(boundaryPixels, hit.point, hit.normal, tone, waterfallRockDiagnostics.albedoWeight.value), normal: hit.normal.clone() };
  },
};
/** Shared only by mountain rock and source banks; no receiving-water shader changes. */
export function createWaterfallRockMaterial(): THREE.MeshStandardNodeMaterial {
  if (!maps) {
    const loader = new THREE.TextureLoader();
    const pending: Promise<void>[] = [];
    const load = (name: string, color = false): THREE.Texture => {
      let resolve!: () => void; let reject!: (reason: unknown) => void;
      pending.push(new Promise<void>((done, fail) => { resolve = done; reject = fail; }));
      const map = loader.load(import.meta.env.BASE_URL + 'assets/textures/river-cliff/gray-weathered-rock/' + name, resolve, undefined, reject);
      map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 8;
      map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return map;
    };
    maps = { color: load('rock_01_diff_2k.jpg', true), normal: load('rock_01_nor_gl_2k.jpg'), rough: load('rock_01_rough_2k.jpg') };
    rockMapsReady = Promise.all(pending).then(() => undefined);
    // Readiness awaits this promise below; also handle rejection when a source
    // bank creates the shared maps before the cliff is attached.
    void rockMapsReady.catch(() => undefined);
  }
  const material = new THREE.MeshStandardNodeMaterial(); material.side = THREE.DoubleSide;
  // This measured gray weathered scan has natural fine grain. The previous
  // rust-brown scan read as earth even with correct physical projection.
  // Retain its actual color and 1.5m size; provenance records the source.
  const scale = float(1 / 1.5);
  // A missing ground normal must not make triplanar weights normalize zero.
  // The upward fallback is only for invalid input; all valid rock retains
  // its actual slope, including vertical faces and the dry source shoulder.
  const n = select(normalWorld.length().greaterThan(0.0001), normalWorld, vec3(0, 1, 0));
  // Sharper geometric weights suppress cross-projection streaks. The same
  // continuous phase field drives color, roughness and normals.
  const magnitude = n.abs().pow(4); const weight = magnitude.div(magnitude.x.add(magnitude.y).add(magnitude.z).max(0.0001));
  const p = positionWorld.mul(scale);
  const cx = continuousRockSample(maps.color, p.yz).rgb;
  const cy = continuousRockSample(maps.color, p.zx).rgb;
  const cz = continuousRockSample(maps.color, p.xy).rgb;
  const albedo = cx.mul(weight.x).add(cy.mul(weight.y)).add(cz.mul(weight.z));
  material.colorNode = mix(vec3(0.42, 0.41, 0.39), albedo, waterfallRockDiagnostics.albedoWeight).mul(vec3(0.85, 0.88, 0.90));
  const rx = continuousRockSample(maps.rough, p.yz).r;
  const ry = continuousRockSample(maps.rough, p.zx).r;
  const rz = continuousRockSample(maps.rough, p.xy).r;
  material.roughnessNode = max(0.58, rx.mul(weight.x).add(ry.mul(weight.y)).add(rz.mul(weight.z)));
  // Orient measured tangent displacements along each world projection. No
  // ground UV derivative frame is required, even on a vertical source wall.
  const nx = continuousRockSample(maps.normal, p.yz).rgb.mul(2).sub(1);
  const ny = continuousRockSample(maps.normal, p.zx).rgb.mul(2).sub(1);
  const nz = continuousRockSample(maps.normal, p.xy).rgb.mul(2).sub(1);
  const bump = vec3(0, nx.x, nx.y).mul(weight.x)
    .add(vec3(ny.y, 0, ny.x).mul(weight.y)).add(vec3(nz.x, nz.y, 0).mul(weight.z));
  // Keep the scan's measured slopes at its recorded physical tile size.
  // Remove the component along the broad face so this adds surface relief,
  // rather than changing that face's overall direction or its silhouette.
  const tangentBump = bump.sub(n.mul(bump.dot(n)));
  const perturbed = n.add(tangentBump.mul(waterfallRockDiagnostics.normalWeight)).normalize();
  material.normalNode = cameraViewMatrix.mul(vec4(perturbed, 0)).xyz.normalize();
  material.userData.waterfallRockDiagnostics = waterfallRockDiagnostics;
  material.userData.boundarySurfaceSampler = cliffBoundarySampler;
  return material;
}

/** Uplift of bank-rooted source shelves above the existing numerical bed.
 * The visual ground and prescribed approach water both call this helper.
 * Shelves occupy forward -40..-3 meters, extend at most 1.8 meters into the
 * approach, and rise at most 1.65 meters. They are absent from the launch
 * cross-section, receiving pool and the numerical shallow-water terrain. */
export function waterfallSourceShelfHeight(forward: number, lateral: number, width: number): number {
  if (forward >= -3 || forward <= -40) return 0;
  let uplift = 0;
  for (const [along, side, length, height, slant] of [
    [-9.5, -1, 4.5, 1.35, 0.20], [-18, 1, 6, 1.65, -0.12],
    [-29, -1, 6.5, 1.12, -0.17], [-35, 1, 4, 1.45, 0.24],
  ]) {
    const f = forward - along; const n = lateral - side * (width * 0.5 + 0.4);
    const distance = Math.max(Math.abs(f + n * slant) / length, Math.abs(n - f * slant) / 2.2);
    // A worn flat slab ends in a short sloping submerged shelf. Different
    // lengths, inclinations and sides interrupt the bank's straight contact.
    const edge = Math.max(0, Math.min(1, (1 - distance) / 0.38));
    uplift = Math.max(uplift, height * edge * Math.max(0.75, 1 - 0.08 * f / length));
  }
  const fade = Math.min(1, (-3 - forward) / 2, (forward + 40) / 2);
  return uplift * Math.max(0, fade);
}

/** A seeded fracture network, rebuilt only when the selected opening changes. */
export function buildWaterfallCliffGeometry(options: { seed: number; shape: RiverShape; course: RiverCourse;
  /** Bounded diagnosis can retain exact constructor coordinates for selected
   * native vertex IDs. Ordinary builds store no additional per-vertex data. */
  observeVertex?:(vertex:{id:number;n:number;h:number;slabIndex:number})=>void;
  /** Exposes rejected constructor faces for bounded diagnosis. The default
   * mesh and its rejection rule are unchanged by observing them. */
  observeSkippedTriangle?:(triangle:{ids:number[];parameterArea:number})=>void;
  observeSmallDomain?:(domain:{polygon:Array<{n:number;h:number}>;parameterArea:number})=>void;
  /** The source keeps its attached slabs. A reference may use the same
   * conforming face scaffold without inheriting those source-specific blocks. */
  attachedSlabs?:boolean;
  /** A reference component can reuse the conforming fracture scaffold while
   * defining its own finite rock face. The original source omits this. */
  surfacePoint?:(point:{lateral:number;fraction:number;attachmentDepth:number})=>{forward:number;y:number};
}): THREE.BufferGeometry {
  const { seed, shape, course } = options; const random = mulberry32(seed + 1759);
  const crest = course.at(WATERFALL.crestS); const width = waterfallHydraulics(shape).width;
  const point = (f: number, n: number, y: number): THREE.Vector3 => new THREE.Vector3(crest.x + crest.tx * f + crest.tz * n, y, crest.z + crest.tz * f - crest.tx * n);
  const smooth = (t: number): number => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };
  const positions: number[] = []; const uvs: number[] = []; const tones: number[] = []; const wets: number[] = []; const indices: number[] = [];
  // Measured outcrop shape supplies midsize intersecting fissures and uneven
  // slab terminations. It is sampled directly into this shared mountain face,
  // not placed as disconnected rocks. The scan's provenance records its
  // source and the deliberate scaling; this is not Yosemite survey data.
  const sampleOutcrop = (u: number, v: number): number => {
    const size = scannedRelief.size; const x = Math.max(0, Math.min(size - 1.001, u * (size - 1))); const y = Math.max(0, Math.min(size - 1.001, v * (size - 1)));
    const i = Math.floor(x); const j = Math.floor(y); const a = x - i; const b = y - j;
    const values = scannedRelief.millimeters;
    return ((values[j * size + i] * (1 - a) + values[j * size + i + 1] * a) * (1 - b) + (values[(j + 1) * size + i] * (1 - a) + values[(j + 1) * size + i + 1] * a) * b) / 1000;
  };
  const mirror = (value: number): number => { const t = ((value % 2) + 2) % 2; return t > 1 ? 2 - t : t; };
  const outcropDepth = (n: number, h: number): number => {
    // The original outcrop spans about 5 by 3.5 meters. Its previous 70-meter
    // footprint erased midsize cracks while synthetic ten-meter plane offsets
    // dominated the scene. Here measured relief occupies roughly 10 by 7
    // meters, with modest scale/orientation changes between overlapping fields.
    // These coordinate bends vary where real scan features meet; they do not
    // invent random surface height or replace the measured fracture relief.
    const x = n + Math.sin(h * 0.071) * 1.2;
    const y = h + Math.sin(n * 0.047 + 1.1) * 1.0;
    // Favor oblique vertical scan features and omit extrapolated border
    // samples. Mirroring the full outline previously repeated its broad
    // horizontal shoulders into conspicuous bands across the entire wall.
    const a = sampleOutcrop(0.10 + 0.80 * mirror((y * 0.82 + x * 0.31 + 126) / 14.1), 0.12 + 0.76 * mirror((x - y * 0.12 + 11) / 11.0));
    const b = sampleOutcrop(mirror((108 - x + y * 0.29) / 13.1), mirror((y + x * 0.11 + 38) / 12.3));
    const c = sampleOutcrop(mirror((x * 0.92 - y * 0.24 + 77) / 9.8), mirror((y + x * 0.21 + 23) / 10.7));
    const blend = 0.42 + Math.sin(n * 0.039 + h * 0.026) * 0.17;
    return (a * 0.70 + b * blend * 0.20 + c * (1 - blend) * 0.20 + 1.76) * 1.15;
  };
  // The scan contains a broad leaning outcrop as well as its fractures.
  // Repeating that whole depth map made soft ramps across the mountain.
  // Subtract a local four-sided average to retain measured smaller relief;
  // vertically stretched physical patches follow the exposed granite sheets.
  const sheetRelief = (n: number, h: number): number => {
    const u = 0.16 + 0.68 * mirror((n + h * 0.055 + 84) / 7.6);
    const v = 0.16 + 0.68 * mirror((h - n * 0.12 + 23) / 18.5);
    const radius = 0.105;
    const broad = (sampleOutcrop(u - radius, v) + sampleOutcrop(u + radius, v)
      + sampleOutcrop(u, v - radius) + sampleOutcrop(u, v + radius)) * 0.25;
    return (sampleOutcrop(u, v) - broad) * 1.7;
  };
  // A fracture terminates where it meets another fracture. The previous bays
  // repeated every joint through the entire cliff height, making columns.
  // These unequal polygon faces instead share finite, intersecting edges.
  type FacePoint = { n: number; h: number };
  const seeds = [
    [-135, 18], [-99, 33], [-75, 12], [-37, 24], [-2, 14], [34, 20], [78, 14], [127, 25],
    [-128, 77], [-86, 89], [-43, 69], [-7, 82], [30, 73], [58, 95], [97, 71], [139, 88],
    [-113, 54], [-59, 43], [12, 43], [64, 49], [118, 49],
    [-29, 55], [-47, 92], [46, 35], [89, 95], [-139, 43], [138, 62],
  ].map(([n, h]) => ({ n: n + (random() - 0.5) * 9, h: h + (random() - 0.5) * 8, weight: random() * 210 }));
  // The weighted face partition lets several broad unbroken faces coexist
  // with smaller fractured corners. Every boundary uses one shared recessed
  // position, so finite joints remain closed rock rather than open mesh gaps.
  const clip = (polygon: FacePoint[], a: number, b: number, limit: number): FacePoint[] => {
    const result: FacePoint[] = [];
    for (let i = 0; i < polygon.length; i += 1) {
      const p = polygon[i]; const q = polygon[(i + 1) % polygon.length];
      const dp = a * p.n + b * p.h - limit; const dq = a * q.n + b * q.h - limit;
      if (dp <= 0) result.push(p);
      if ((dp <= 0) !== (dq <= 0)) { const t = dp / (dp - dq); result.push({ n: p.n + (q.n - p.n) * t, h: p.h + (q.h - p.h) * t }); }
    }
    return result;
  };
  const faces: { seedIndex: number; polygon: FacePoint[]; center: FacePoint; leanN: number; leanH: number; relief: number; tone: number; recess: number }[] = [];
  for (const seedFace of seeds) {
    let polygon: FacePoint[] = [{ n: -144, h: 0 }, { n: 144, h: 0 }, { n: 144, h: 100 }, { n: -144, h: 100 }];
    for (const other of seeds) if (other !== seedFace && polygon.length) {
      polygon = clip(polygon, 2 * (other.n - seedFace.n), 0.5 * (other.h - seedFace.h), other.n ** 2 + 0.25 * other.h ** 2 - other.weight - seedFace.n ** 2 - 0.25 * seedFace.h ** 2 + seedFace.weight);
    }
    if (polygon.length < 3) continue;
    const center = { n: polygon.reduce((s, p) => s + p.n, 0) / polygon.length, h: polygon.reduce((s, p) => s + p.h, 0) / polygon.length };
    faces.push({ seedIndex: seeds.indexOf(seedFace), polygon, center, leanN: (random() - 0.5) * 0.12, leanH: (random() - 0.5) * 0.10, relief: 0.4 + random() * 1.6, tone: 0.76 + random() * 0.41, recess: 0 });
  }
  // Keep each large face a genuine inclined plane. Moving its entire plane
  // back to meet the dry sightline limit avoids flattening arbitrary interior
  // samples with a clamp. Only narrow joint walls connect unequal planes.
  for (const face of faces) {
    const probes = [...face.polygon];
    for (let i = 0; i < face.polygon.length; i += 1) {
      const a = face.polygon[i], b = face.polygon[(i + 1) % face.polygon.length];
      for (const n of [-64, -22, 0, 22, 64]) if ((a.n - n) * (b.n - n) < 0) { const t = (n - a.n) / (b.n - a.n); probes.push({ n, h: a.h + (b.h - a.h) * t }); }
    }
    for (const p of probes) {
      const base = p.n < 0 ? -9 + 15 * (1 - p.h / 100) - p.n * 0.018 : -12 + 19 * (1 - p.h / 100) + p.n * 0.014;
      const limit = 2 + 13 * Math.max(0, Math.min(1, (Math.abs(p.n) - 22) / 42));
      face.recess = Math.max(face.recess, base + face.relief + (p.n - face.center.n) * face.leanN + (p.h - face.center.h) * face.leanH + 3.8 - limit);
    }
  }
  // Secondary joints follow measured sharp edges of the retained scan. Each
  // finite trace sits inside one parent face; its small recessed walls explain
  // local cracking without turning the entire mountain into repeated blocks.
  const secondary = faces.map((face, i) => {
    const trace = fractureTraces.traces[i % fractureTraces.traces.length];
    const centerX = trace.reduce((s, p) => s + p[0], 0) / trace.length;
    const centerY = trace.reduce((s, p) => s + p[1], 0) / trace.length;
    // The measured scan's long edges run across its local horizontal axis.
    // Stand those finite edges upright to match the reference's fracture
    // direction; their changes of angle and unequal lengths remain measured.
    const points = trace.map(p => ({ n: face.center.n + (p[1] - centerY) * 2.2,
      h: face.center.h + (p[0] - centerX) * 5.6 }));
    // The longest two measured segments keep real changes in direction while
    // bounding triangulation work. No cracks extend to the terrain interface.
    return points.slice(1).map((b, k) => ({ a: points[k], b }))
      .sort((a, b) => Math.hypot(b.b.n - b.a.n, b.b.h - b.a.h) - Math.hypot(a.b.n - a.a.n, a.b.h - a.a.h)).slice(0, 2);
  });
  const measuredJoints = secondary.flat();
  const measuredJointRecess = (n: number, h: number): number => {
    let depth = 0;
    for (const { a, b } of measuredJoints) {
      const dn = b.n - a.n, dh = b.h - a.h, square = dn * dn + dh * dh;
      if (square < 0.01) continue;
      const t = ((n - a.n) * dn + (h - a.h) * dh) / square;
      if (t <= 0 || t >= 1) continue;
      const across = Math.abs((n - a.n) * dh - (h - a.h) * dn) / Math.sqrt(square);
      // Worn shoulders share the existing 42cm triangulation rails. Every
      // trace fades before its endpoint, avoiding extruded full-height slots.
      const end = Math.min(1, t * Math.sqrt(square) / 0.8, (1 - t) * Math.sqrt(square) / 0.8);
      depth = Math.max(depth, Math.max(0, 1 - across / 0.42) * 0.72 * smooth(end));
    }
    return depth;
  };
  // Trace the actual fracture boundaries before triangulation. Resampling
  // narrow diagonal joints on a rectangular grid produced staircase shelves.
  // Each convex face and wet-corridor band shares exact edge subdivisions;
  // irregular interior points resolve scan relief without a visible row grid.
  // This is a reference-informed fracture hierarchy, not surveyed Yosemite
  // coordinates. Unequal finite joints change direction, split and stop at
  // cross-ledges. Width and recess vary along them, avoiding parallel slots
  // extruded through the full cliff height. Values use normalized rock height.
  type JointPoint = { n: number; h: number; width: number; depth: number };
  const joints: JointPoint[][] = [
    [[-108, 4, 0.6, 0], [-102, 36, 1.9, 3.4], [-107, 73, 0.8, 0]],
    [[-80, 22, 0.5, 0], [-69, 57, 2.1, 4.2], [-74, 98, 0.7, 0]],
    [[-51, 2, 0.7, 0], [-48, 31, 1.2, 2.8], [-37, 68, 1.8, 3.6], [-43, 94, 0.6, 0]],
    [[-27, 37, 0.6, 0], [-22, 63, 1.1, 2.7], [-29, 96, 0.8, 0]],
    [[24, 3, 0.6, 0], [29, 35, 1.5, 4.1], [21, 72, 1.0, 2.7], [26, 99, 0.8, 0]],
    [[49, 20, 0.5, 0], [42, 58, 2.0, 4.8], [51, 88, 0.6, 0]],
    [[72, 4, 0.7, 0], [81, 38, 1.6, 3.6], [70, 76, 2.2, 4.2], [75, 97, 0.6, 0]],
    [[111, 18, 0.5, 0], [100, 53, 1.7, 3.8], [108, 91, 0.9, 0]],
    [[128, 5, 0.6, 0], [123, 31, 1.0, 2.4], [130, 65, 0.5, 0]],
    // Short cross-ledges intersect a few parent joints, not the full face.
    [[-76, 43, 2.8, 0], [-53, 49, 4.0, 1.4], [-28, 58, 2.6, 0]],
    [[32, 39, 3.1, 0], [54, 45, 4.1, 1.6], [83, 54, 2.7, 0]],
  ].map(path => path.map(([n, h, width, depth]) => ({ n, h, width, depth })));
  const segments = joints.flatMap(path => path.slice(1).map((b, i) => ({ a: path[i], b })));
  const jointRecess = (n: number, h: number): number => {
    let recess = 0;
    for (const { a, b } of segments) {
      if (h < a.h || h > b.h) continue;
      const t = (h - a.h) / (b.h - a.h);
      const center = a.n + (b.n - a.n) * t;
      const width = a.width + (b.width - a.width) * t;
      const depth = a.depth + (b.depth - a.depth) * t;
      const distance = Math.abs(n - center) / width;
      const profile = distance < 0.22 ? 1 - distance * 0.55 : Math.max(0, (1 - distance) / 0.78) * 0.879;
      recess = Math.max(recess, profile * depth);
    }
    return recess;
  };
  // Broad, unequal bedrock shoulders connect those joints. Their subdued
  // relief never introduces the former closed polygon outlines or safety
  // recesses; measured midsize rock remains visible across every shoulder.
  const shoulders = [
    [-92, 31, 23, 34, 2.7, 0.09], [-56, 67, 20, 37, 3.4, -0.08], [-27, 39, 13, 25, 2.1, 0.13],
    [35, 63, 19, 42, 3.7, -0.11], [65, 31, 24, 30, 3.0, 0.10], [96, 74, 29, 33, 3.9, -0.07],
  ];
  const shoulderRelief = (n: number, h: number): number => {
    let relief = 0;
    for (const [cn, ch, wide, tall, depth, rake] of shoulders) {
      const cross = Math.max(0, 1 - Math.abs(n - cn - (h - ch) * rake) / wide);
      const along = Math.max(0, 1 - Math.abs(h - ch) / tall);
      relief = Math.max(relief, depth * cross * (along * along * (3 - 2 * along)));
    }
    return relief;
  };
  const vertexIds = new Map<string, number>();
  const constructedRails: {crest:number[];floor:number[]} = {crest:[],floor:[]};
  const openingAt = (h: number) => width * (0.5 + (1 - h / 100) * 0.75) + 0.8;
  const regionBounds = (h: number) => [-144, -openingAt(h) - 4.5, -openingAt(h), openingAt(h), openingAt(h) + 4.5, 144];
  const addVertex = (q: FacePoint, _face: typeof faces[number], slabIndex = -1): number => {
    const n = Math.round(q.n * 1e6) / 1e6; const h = Math.round(q.h * 1e6) / 1e6;
    const key = n + ':' + h + ':' + slabIndex; const prior = vertexIds.get(key); if (prior !== undefined) return prior;
    const v = h / 100; const opening = openingAt(h);
    // Polygon regions now control triangulation only. Their whole-face
    // safety recesses remained several meters deep after their visible
    // offsets were reduced, creating giant triangular cutouts. No region
    // identity, plane offset or synthetic crack changes this surface height.
    const boundary = waterfallRockBoundary(n, width);
    const safeBase = n < 0 ? -9 + 15 * (1 - v) - n * 0.018 : -12 + 19 * (1 - v) + n * 0.014;
    // The fixed dry crest projects forward by 8–15m. A face retreating to
    // -12m below it made a giant cap even after polygon offsets were removed.
    // Dry rock supports its lip just outside the widening wet notch. The
    // former twenty-meter shoulder blend kept this rock far behind its lip,
    // then advanced it by nineteen meters near the crest: a giant roof.
    // Retain the recessed water corridor and its worn transition below;
    // only the dry shoulder beyond that transition gains closer support.
    const support = smooth((Math.abs(n) - opening - 4.5) / 4);
    const supportedBase = boundary - 2.2 - 7 * (1 - v);
    const base = safeBase * (1 - support) + supportedBase * support;
    const midsize = outcropDepth(n, h);
    const broad = outcropDepth(n * 0.31 + 27, h * 0.36 + 15);
    // Large supports and joints remain intact. Smaller measured sheets and
    // finite scan cracks now break their broad planes instead of repeating
    // the scan's whole leaning block at every scale. The wet notch and exact
    // final crest transition below still override every dry-face offset.
    const relief = base + midsize * 0.38 + broad * 0.20 - 0.75 + sheetRelief(n, h)
      + shoulderRelief(n, h) - jointRecess(n, h) - measuredJointRecess(n, h);
    // Support the dry lip with rock immediately below it. The old near-fall
    // face stayed twenty meters behind this same lip, so its closing strip
    // became a giant roof. This only moves dry support; the recessed wet
    // corridor and the exact terrain/launch edge below still take precedence.
    const crestSupport = smooth((v - 0.68) / 0.16);
    const supportedLip = Math.max(boundary - 2.2, Math.min(boundary - 1, relief));
    const bounded = relief * (1 - crestSupport) + supportedLip * crestSupport;
      // The whole water corridor is a shared recessed face. Its boundary
      // columns are exact, so neighboring dry triangles cannot bridge it.
      const notch = 1 - Math.max(0, Math.min(1, (Math.abs(n) - opening) / 4.5));
      const dry = bounded * (1 - notch) - 3.8 * notch;
      const top = waterfallSourceRockHeight(n, width, boundary);
      // Dry shoulders rise gradually into the shared terrain lip. Bridging a
      // deeply recessed face in the last two meters made an enormous roof.
      // The wet notch retains its separate final-row launch transition.
      const dryRim = smooth((v - 0.84) / 0.16) * (1 - notch);
      const upper = Math.max(dryRim, smooth((v - 0.992) / 0.008));
      // Separate front vertices retain a real slab thickness. Their base
      // rings reuse the original core vertices when the side faces are joined.
      // One broad right buttress supports the lower/middle shoulder. The
      // previous nearest slab projected the same 1.8m at every height while
      // its base retreated downward, leaving a proud retaining-wall profile.
      // This support tapers into existing rock before the crest and floor;
      // the shared wet transition remains completely unchanged. All original
      // front, base and bridge indices stay connected, with no added plaque.
      const lowerSupport = smooth((h - 4) / 12) * (1 - smooth((h - 36) / 30));
      const buttressCenter = clearance + 14 + (h - 32) * 0.07;
      const crossSupport = Math.max(0, 1 - Math.abs(n - buttressCenter) / 18);
      const drySupport = smooth((n - opening - 4.5) / 4);
      const buttress = 6 * lowerSupport * crossSupport * drySupport * (1 - upper);
      const projection = slabIndex < 0 ? 0 : slabIndex === 3
        ? 0.2 + 1.6 * (1 - smooth((h - 45) / 20)) : slabs[slabIndex].depth;
      const p = point(dry * (1 - upper) + boundary * upper + buttress + projection, n, -4 + (top + 4) * v);
      if(options.surfacePoint){const q=options.surfacePoint({lateral:n,fraction:v,attachmentDepth:projection});p.copy(point(q.forward,n,q.y));}
      positions.push(p.x, p.y, p.z); uvs.push(n / 2.4, p.y / 2.4);
      const wet = Math.exp(-Math.pow((n + Math.sin(p.y * 0.13) * 1.6) / (width * 0.75 + 3), 2)) * (0.58 + 0.42 * smooth((p.y - 8) / 60));
      tones.push((0.97 + outcropDepth(n, h) * 0.014) * (1 - wet * 0.38)); wets.push(wet);

    const id = positions.length / 3 - 1;
    // Retain rail membership where it is constructed, before a later query
    // has to infer it from a height tolerance. Positions remain unchanged.
    if(h===100)constructedRails.crest.push(id);if(h===0)constructedRails.floor.push(id);
    vertexIds.set(key, id); options.observeVertex?.({id,n,h,slabIndex}); return id;
  };
  // These few inferred footprints describe rock mass, not texture noise or
  // Yosemite survey coordinates. They stay outside the widest wet corridor
  // at every height and stop before the shared floor and crest seam rails.
  const clearance = width * 1.25 + 8;
  const slabs = (options.attachedSlabs === false ? [] : [
    { n: -clearance - 9, h: 34, wide: 14, tall: 22, depth: 1.6 },
    { n: -clearance - 30, h: 70, wide: 18, tall: 19, depth: 2.1 },
    { n: -clearance - 68, h: 44, wide: 17, tall: 25, depth: 1.3 },
    { n: clearance + 10, h: 55, wide: 13, tall: 21, depth: 1.8 },
    { n: clearance + 48, h: 27, wide: 18, tall: 24, depth: 2.2 },
    { n: clearance + 89, h: 77, wide: 19, tall: 17, depth: 1.4 },
  ]).map(slab => ({ ...slab, polygon: [
    [-0.48, -0.45], [0.32, -0.5], [0.5, -0.27],
    [0.43, 0.44], [-0.26, 0.5], [-0.5, 0.28],
  ].map(([n, h]) => ({ n: slab.n + n * slab.wide, h: slab.h + h * slab.tall })) }));
  type Domain = { polygon: FacePoint[]; face: typeof faces[number]; slabIndex?: number };
  const domains: Domain[] = [];
  const areaOf = (p: FacePoint[]) => {
    const area=Math.abs(p.reduce((sum, a, i) => { const b = p[(i + 1) % p.length]; return sum + a.n * b.h - b.n * a.h; }, 0)) * 0.5;
    if(area>0&&area<=1e-6)options.observeSmallDomain?.({polygon:p,parameterArea:area});
    return area;
  };
  // Small is not empty: dropping finite joint intersections opened holes in
  // the native mountain. Test their area at the SAME existing millionth-unit
  // vertex addresses used by addVertex; do not weld or move their endpoints.
  const hasNativeArea = (p: FacePoint[]): boolean => {
    if(p.length<3)return false;
    const area=areaOf(p);if(area>1e-6)return true;if(area===0)return false;
    const q=p.map(v=>[BigInt(Math.round(v.n*1e6)),BigInt(Math.round(v.h*1e6))]);
    let twiceArea=0n;
    for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length];twiceArea+=a[0]*b[1]-b[0]*a[1];}
    return twiceArea!==0n;
  };
  const divide = (polygons: FacePoint[][], a: number, b: number, limit: number): FacePoint[][] => polygons.flatMap(polygon => {
    const low = clip(polygon, a, b, limit); const high = clip(polygon, -a, -b, -limit);
    return [low, high].filter(hasNativeArea);
  });
  for (const face of faces) for (let region = 0; region < 5; region += 1) {
    const lo = regionBounds(0)[region]; const loSlope = (regionBounds(100)[region] - lo) / 100;
    const hi = regionBounds(0)[region + 1]; const hiSlope = (regionBounds(100)[region + 1] - hi) / 100;
    let polygon = clip(face.polygon, -1, loSlope, -lo); polygon = clip(polygon, 1, -hiSlope, hi);
    if (!hasNativeArea(polygon)) continue;
    let pieces = [polygon];
    // Retain the shared fracture partition as a triangulation scaffold and
    // future reconstruction surface. It no longer imposes offsets or cracks
    // on the visible mountain; measured relief determines those features.
    for (let k = 0; k < face.polygon.length; k += 1) {
      const a = face.polygon[k], b = face.polygon[(k + 1) % face.polygon.length];
      const dn = b.n - a.n, dh = b.h - a.h, length = Math.hypot(dn, dh);
      if (length > 1e-6) pieces = divide(pieces, dh, -dn, dh * a.n - dn * a.h - 0.70 * length);
    }
    for (const { a, b } of secondary[faces.indexOf(face)]) {
      const dn = b.n - a.n, dh = b.h - a.h, length = Math.hypot(dn, dh);
      if (length < 0.05) continue;
      const across = dh * a.n - dn * a.h;
      for (const distance of [-0.42, 0, 0.42]) pieces = divide(pieces, dh, -dn, across + distance * length);
      const start = dn * a.n + dh * a.h;
      for (const distance of [0, Math.min(0.6, length / 2), Math.max(length - 0.6, length / 2), length])
        pieces = divide(pieces, dn, dh, start + distance * length);
    }
    // Constrain each finite joint's center and both worn shoulders exactly.
    // Only overlapping domains are split; shared line-point collection below
    // keeps neighboring pieces welded without a regular fracture grid.
    for (const { a, b } of segments) {
      const minN = Math.min(a.n - a.width, b.n - b.width), maxN = Math.max(a.n + a.width, b.n + b.width);
      const relevant = (p: FacePoint[]) => Math.max(...p.map(v => v.h)) > a.h && Math.min(...p.map(v => v.h)) < b.h && Math.max(...p.map(v => v.n)) > minN && Math.min(...p.map(v => v.n)) < maxN;
      pieces = pieces.flatMap(p => relevant(p) ? divide(divide([p], 0, 1, a.h), 0, 1, b.h) : [p]);
      const slope = (b.n - a.n) / (b.h - a.h), widthSlope = (b.width - a.width) / (b.h - a.h);
      pieces = pieces.flatMap(p => {
        const centerH = p.reduce((s, v) => s + v.h, 0) / p.length;
        if (!relevant(p) || centerH < a.h || centerH > b.h) return [p];
        let local = [p];
        for (const rail of [-1, -0.22, 0, 0.22, 1]) {
          const s = slope + rail * widthSlope;
          local = divide(local, 1, -s, a.n + rail * a.width - s * a.h);
        }
        return local;
      });
    }
    // Historical cross-cut support lines stay shared triangulation edges;
    // their former large synthetic steps no longer alter exposed positions.
    for (const n of [-82, -14, 16, 104]) pieces = divide(pieces, 1, 0, n);
    const cutPieces: FacePoint[][] = [];
    for (const piece of pieces) {
      const centerN = piece.reduce((sum, p) => sum + p.n, 0) / piece.length;
      if (centerN > -82 && centerN < -14) cutPieces.push(...divide(divide([piece], -0.19, 1, 41), -0.19, 1, 41.9));
      else if (centerN > 16 && centerN < 104) cutPieces.push(...divide(divide([piece], 0.11, 1, 64), 0.11, 1, 65.2));
      else cutPieces.push(piece);
    }
    for (const polygon of cutPieces) domains.push({ polygon, face });
  }
  // Cut each finite footprint out of the retained base, then move that
  // footprint's faces forward. Outside fragments remain ordinary core rock.
  // Splitting before the shared-edge pass lets neighboring core pieces and
  // slab rings agree on every edge point, including existing scan fractures.
  for (let slabIndex = 0; slabIndex < slabs.length; slabIndex += 1) {
    const slab = slabs[slabIndex]; const footprint = slab.polygon;
    const minN = Math.min(...footprint.map(p => p.n)), maxN = Math.max(...footprint.map(p => p.n));
    const minH = Math.min(...footprint.map(p => p.h)), maxH = Math.max(...footprint.map(p => p.h));
    const next: Domain[] = [];
    for (const domain of domains) {
      if (domain.slabIndex !== undefined || Math.max(...domain.polygon.map(p => p.n)) < minN
        || Math.min(...domain.polygon.map(p => p.n)) > maxN || Math.max(...domain.polygon.map(p => p.h)) < minH
        || Math.min(...domain.polygon.map(p => p.h)) > maxH) { next.push(domain); continue; }
      let interior = domain.polygon;
      for (let edge = 0; edge < footprint.length && interior.length >= 3; edge += 1) {
        const a = footprint[edge], b = footprint[(edge + 1) % footprint.length];
        const x = b.h - a.h, y = a.n - b.n, limit = x * a.n + y * a.h;
        const exterior = clip(interior, -x, -y, -limit);
        if (hasNativeArea(exterior)) next.push({ ...domain, polygon: exterior });
        interior = clip(interior, x, y, limit);
      }
      if (hasNativeArea(interior)) next.push({ ...domain, polygon: interior, slabIndex });
    }
    domains.splice(0, domains.length, ...next);
  }
  // A cross cut on one face can terminate on another face's long boundary.
  // Collect all collinear edge points first so BOTH sides share those points;
  // independently dividing polygons would leave hidden T-junction cracks.
  const linePoints = new Map<string, Map<string, FacePoint>>();
  const lineKey = (a: FacePoint, b: FacePoint) => {
    const length = Math.hypot(b.n - a.n, b.h - a.h); let x = (b.h - a.h) / length, y = (a.n - b.n) / length;
    if (x < -1e-8 || (Math.abs(x) <= 1e-8 && y < 0)) { x = -x; y = -y; }
    return [x, y, x * a.n + y * a.h].map(v => Math.round(v * 1e5)).join(':');
  };
  for (const { polygon } of domains) for (let k = 0; k < polygon.length; k += 1) {
    const a = polygon[k], b = polygon[(k + 1) % polygon.length]; const length = Math.hypot(b.n - a.n, b.h - a.h); if (length < 1e-7) continue;
    const key = lineKey(a, b); const group = linePoints.get(key) ?? new Map<string, FacePoint>();
    const steps = Math.ceil(length / 1.15);
    for (let step = 0; step <= steps; step += 1) { const t = step / steps, p = { n: a.n + (b.n - a.n) * t, h: a.h + (b.h - a.h) * t }; group.set(Math.round(p.n * 1e6) + ':' + Math.round(p.h * 1e6), p); }
    linePoints.set(key, group);
  }
  const slabEdges = slabs.map(() => new Map<string, { a: number; b: number; count: number; qa: FacePoint; qb: FacePoint; face: typeof faces[number] }>());
  const slabTriangles: number[][] = slabs.map(() => []);
  for (const { polygon, face, slabIndex = -1 } of domains) {
    const local: FacePoint[] = []; const localKeys = new Set<string>();
    const insert = (p: FacePoint) => { const key = Math.round(p.n * 1e6) + ':' + Math.round(p.h * 1e6); if (!localKeys.has(key)) { localKeys.add(key); local.push(p); } };
    for (let k = 0; k < polygon.length; k += 1) {
      const a = polygon[k], b = polygon[(k + 1) % polygon.length]; const dn = b.n - a.n, dh = b.h - a.h; const square = dn * dn + dh * dh;
      if (square < 1e-14) continue;
      for (const p of linePoints.get(lineKey(a, b))!.values()) {
        const t = ((p.n - a.n) * dn + (p.h - a.h) * dh) / square;
        if (t >= -1e-7 && t <= 1 + 1e-7) insert(p);
      }
    }
    const minN = Math.min(...polygon.map(p => p.n)), maxN = Math.max(...polygon.map(p => p.n));
    const minH = Math.min(...polygon.map(p => p.h)), maxH = Math.max(...polygon.map(p => p.h));
    for (let h = minH + 0.8; h < maxH; h += 0.45) for (let n = minN + 0.8; n < maxN; n += Math.abs(n) < 90 ? 0.45 : 0.9) {
      const candidate = { n: n + (random() - 0.5) * 0.18, h: h + (random() - 0.5) * 0.56 };
      let inside = true;
      for (let k = 0; k < polygon.length; k += 1) { const a = polygon[k], b = polygon[(k + 1) % polygon.length]; const cross = (b.n - a.n) * (candidate.h - a.h) - (b.h - a.h) * (candidate.n - a.n); if (cross < Math.hypot(b.n - a.n, b.h - a.h) * 0.38) { inside = false; break; } }
      if (inside) insert(candidate);
    }
    const ids = local.map(p => addVertex(p, face, slabIndex)); const triangulation = Delaunator.from(local, p => p.n, p => p.h);
    for (let i = 0; i < triangulation.triangles.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map(k => triangulation.triangles[i + k]);
      const area = (local[b].n - local[a].n) * (local[c].h - local[a].h) - (local[b].h - local[a].h) * (local[c].n - local[a].n);
      if (Math.abs(area) < 1e-8) {
        options.observeSkippedTriangle?.({ids:[ids[a],ids[b],ids[c]],parameterArea:area});
        continue;
      }
      const ordered = area > 0 ? [a, c, b] : [a, b, c];
      const triangleStart = indices.length; indices.push(...ordered.map(k => ids[k]));
      if (slabIndex >= 0) {
        slabTriangles[slabIndex].push(triangleStart);
        for (let edge = 0; edge < 3; edge += 1) {
          const ia = ordered[edge], ib = ordered[(edge + 1) % 3], va = ids[ia], vb = ids[ib];
          const key = Math.min(va, vb) + ':' + Math.max(va, vb); const edges = slabEdges[slabIndex];
          const existing = edges.get(key);
          if (existing) existing.count += 1;
          else edges.set(key, { a: va, b: vb, count: 1, qa: local[ia], qb: local[ib], face });
        }
      }
    }
  }
  const slabBridgeTriangles: number[][] = slabs.map(() => []);
  // Front faces have replaced the base inside each footprint. Only their
  // perimeter needs a joining ribbon. These real top, side and underside
  // faces close onto the retained mountain; no hidden base plaque remains.
  for (let slabIndex = 0; slabIndex < slabs.length; slabIndex += 1) for (const edge of slabEdges[slabIndex].values()) {
    if (edge.count !== 1) continue;
    const ba = addVertex(edge.qa, edge.face), bb = addVertex(edge.qb, edge.face);
    slabBridgeTriangles[slabIndex].push(indices.length, indices.length + 3);
    indices.push(edge.b, edge.a, ba, edge.b, ba, bb);
  }
  const geometry = new THREE.BufferGeometry();
  // Non-rendering provenance lets focused checks inspect actual inserted
  // faces and support rings without guessing which textured pixels are slabs.
  geometry.userData.constructedRails = constructedRails;
  geometry.userData.attachedSlabs = slabs.map((slab, i) => ({
    footprint: slab.polygon, depth: slab.depth, frontTriangles: slabTriangles[i], bridgeTriangles: slabBridgeTriangles[i],
  }));
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('rockTone', new THREE.Float32BufferAttribute(tones, 1));
  geometry.setAttribute('rockWet', new THREE.Float32BufferAttribute(wets, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

/** Finds the actual indexed cliff surface at a lateral offset and height.
 * The ground renderer uses this for short top and floor seam joins after
 * removing impossible heightfield cliffs. It never rebuilds a full-height
 * wall over the fall. Returned points lie on the core's real triangles. */
export type WaterfallCoreTraceKnot = { t: number; point: THREE.Vector3 };
export type WaterfallCoreFeature = {kind:'face';element:number;vertices:number[];cap:boolean}
  | {kind:'crest-rail'|'floor-rail';vertices:number[]};
export interface WaterfallCoreTraceObservation {
  kind:'rejected-face'|'merged-parameter'|'selected-span'|'merged-knot'|'forward-tie'|'face-piece'|'rail-crossing';
  reason?:string;face?:number;values?:number[];feature?:WaterfallCoreFeature;features?:WaterfallCoreFeature[];
  lo?:number;hi?:number;a?:number[];b?:number[];
}
export type WaterfallCoreTraceObserver = (event:WaterfallCoreTraceObservation)=>void;
export type WaterfallCoreSampler = ((lateral: number, height: number) => THREE.Vector3) & {
  traceEdge: (nA: number, yA: number, nB: number, yB: number, observe?:WaterfallCoreTraceObserver) => WaterfallCoreTraceKnot[];
  /** Visits the retained native buffers; no second core geometry is built. */
  nativeBoundary: {
    faceCount:number;constructedRails:{crest:number[];floor:number[]};legacyRails:{crest:number[];floor:number[]};
    vertex:(id:number)=>[number,number,number];
    forEachFace:(visit:(element:number,ids:number[],points:number[][],cap:boolean)=>void)=>void;
  };
};

export function createWaterfallCoreSampler(options: { seed: number; shape: RiverShape; course: RiverCourse }): WaterfallCoreSampler {
  const geometry = buildWaterfallCliffGeometry(options);
  const crest = options.course.at(WATERFALL.crestS); const width = waterfallHydraulics(options.shape).width;
  return createNativeCliffSampler({geometry,crest,lateralMin:-144,lateralMax:144,floorY:-4,
    analyticTop:n=>waterfallSourceRockHeight(n,width,waterfallRockBoundary(n,width)),disposeAfterIndex:true});
}

/** Query the actual stored native triangles in an explicit world frame.
 * A downstream cliff supplies its constructed rails, instead of inferring
 * them from the original source's elevation and width. This only qualifies
 * surface queries; ground joins and closed solid admission remain separate. */
export function createNativeCliffSampler(options:{
  geometry:THREE.BufferGeometry;crest:{x:number;z:number;tx:number;tz:number};
  lateralMin:number;lateralMax:number;floorY:number;
  rails?:{crest:readonly number[];floor:readonly number[]};
  analyticTop?:(lateral:number)=>number;disposeAfterIndex?:boolean;rejectChanges?:boolean;
}):WaterfallCoreSampler {
  const {geometry,crest,lateralMin,lateralMax,floorY}=options;
  if(![...Object.values(crest),lateralMin,lateralMax,floorY].every(Number.isFinite)
    ||lateralMin>=lateralMax||Math.abs(Math.hypot(crest.tx,crest.tz)-1)>1e-12)throw Error('Invalid native cliff frame');
  const positions=geometry.getAttribute('position');
  const nValues = new Float64Array(positions.count); const hValues = new Float64Array(positions.count); const fValues = new Float64Array(positions.count);
  const crestRail: number[] = options.rails?[...options.rails.crest]:[];
  const floorRail: number[] = options.rails?[...options.rails.floor]:[];
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i) - crest.x, z = positions.getZ(i) - crest.z;
    nValues[i] = x * crest.tz - z * crest.tx; hValues[i] = positions.getY(i); fValues[i] = x * crest.tx + z * crest.tz;
    if(!options.rails){
      if (Math.abs(hValues[i] - floorY) < 1e-5) floorRail.push(i);
      const top = options.analyticTop!(nValues[i]);
      if (Math.abs(hValues[i] - top) < 0.0001) crestRail.push(i);
    }
  }
  for(const rail of [crestRail,floorRail])if(rail.length<2||rail.some(i=>!Number.isSafeInteger(i)||i<0||i>=positions.count))throw Error('Invalid native cliff rail');
  crestRail.sort((a, b) => nValues[a] - nValues[b]); floorRail.sort((a, b) => nValues[a] - nValues[b]);
  // Shared polygon corners can repeat the same rail vertex. Keep real short
  // edges, removing only identical positions; distinct points at the same
  // lateral address would mean this boundary cannot be sampled as one rail.
  for (const rail of [crestRail, floorRail]) {
    for (let i = rail.length - 1; i > 0; i--) {
      const a = rail[i - 1], b = rail[i];
      if (nValues[a] === nValues[b] && hValues[a] === hValues[b] && fValues[a] === fValues[b]) rail.splice(i, 1);
      else if (nValues[a] === nValues[b]) throw new Error('Cliff rail has distinct points at the same lateral address');
    }
  }
  // The Scene joins onto these actual boundary edges. A height sampled
  // analytically between vertices can sit slightly above the triangulated
  // crest; nearest-vertex fallback then left the seam sideways. Interpolate
  // the real rail instead, retaining its position and short closing strip.
  const sampleRail = (rail: number[], n: number): THREE.Vector3 => {
    let lo = 0, hi = rail.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >>> 1; if (nValues[rail[mid]] <= n) lo = mid; else hi = mid; }
    const a = rail[lo], b = rail[hi]; const span = nValues[b] - nValues[a];
    const t = span > 1e-8 ? Math.max(0, Math.min(1, (n - nValues[a]) / span)) : 0;
    return new THREE.Vector3(positions.getX(a) + (positions.getX(b) - positions.getX(a)) * t,
      hValues[a] + (hValues[b] - hValues[a]) * t, positions.getZ(a) + (positions.getZ(b) - positions.getZ(a)) * t);
  };
  const indices = geometry.index!; const bins = new Map<string, number[]>(); const traceBins = new Map<string, number[]>(); const cell = 4;
  // Caps extend only along the forward axis, so they have no area in the
  // lateral/height query plane. Float32 world positions can give a cap a
  // microscopic false projected area; exclude these known joining faces
  // instead of allowing that rounding sliver to win a surface query.
  const caps = new Set<number>((geometry.userData.attachedSlabs as { bridgeTriangles: number[] }[]).flatMap(slab => slab.bridgeTriangles));
  for (let t = 0; t < indices.count; t += 3) {
    const ids = [indices.getX(t), indices.getX(t + 1), indices.getX(t + 2)];
    const x0 = Math.floor(Math.min(...ids.map(i => nValues[i])) / cell); const x1 = Math.floor(Math.max(...ids.map(i => nValues[i])) / cell);
    const y0 = Math.floor(Math.min(...ids.map(i => hValues[i])) / cell); const y1 = Math.floor(Math.max(...ids.map(i => hValues[i])) / cell);
    for (let x = x0; x <= x1; x += 1) for (let y = y0; y <= y1; y += 1) {
      const key = x + ':' + y; const trace = traceBins.get(key) ?? []; trace.push(t); traceBins.set(key, trace);
      if (!caps.has(t)) { const list = bins.get(key) ?? []; list.push(t); bins.set(key, list); }
    }
  }
  if(options.disposeAfterIndex)geometry.dispose();
  const version=()=> 'data' in positions?positions.data.version:positions.version;
  const originalVersion=version(),originalIndexVersion=indices.version;
  const assertCurrent=()=>{
    if(options.rejectChanges&&(geometry.getAttribute('position')!==positions||geometry.index!==indices
      ||version()!==originalVersion||indices.version!==originalIndexVersion))throw Error('Native cliff geometry changed; rebuild its sampler');
  };
  const sample = ((lateral: number, height: number): THREE.Vector3 => {
    assertCurrent();
    const n = Math.max(lateralMin, Math.min(lateralMax, lateral));
    const topPoint = sampleRail(crestRail, n); const top = topPoint.y; const y = Math.max(floorY, Math.min(top, height));
    const analyticTop = options.analyticTop?.(n)??top;
    if (height >= Math.min(top, analyticTop) - 1e-6) return topPoint;
    if (height <= floorY) return sampleRail(floorRail, n);
    const candidates = bins.get(Math.floor(n / cell) + ':' + Math.floor(y / cell)) ?? [];
    let hit: THREE.Vector3 | null = null; let front = -Infinity;
    for (const t of candidates) {
      const [i, j, k] = [indices.getX(t), indices.getX(t + 1), indices.getX(t + 2)];
      const den = (hValues[j] - hValues[k]) * (nValues[i] - nValues[k]) + (nValues[k] - nValues[j]) * (hValues[i] - hValues[k]);
      // Ledge caps can project to a line in this query plane. They do not
      // cover an area and must not divide by zero or hide a valid front face.
      if (Math.abs(den) < 1e-10) continue;
      const u = ((hValues[j] - hValues[k]) * (n - nValues[k]) + (nValues[k] - nValues[j]) * (y - hValues[k])) / den;
      const w = ((hValues[k] - hValues[i]) * (n - nValues[k]) + (nValues[i] - nValues[k]) * (y - hValues[k])) / den;
      const v = 1 - u - w; if (Math.min(u, w, v) < -1e-5) continue;
      const forward = fValues[i] * u + fValues[j] * w + fValues[k] * v;
      if (forward > front) {
        front = forward;
        hit = new THREE.Vector3(positions.getX(i) * u + positions.getX(j) * w + positions.getX(k) * v, y, positions.getZ(i) * u + positions.getZ(j) * w + positions.getZ(k) * v);
      }
    }
    if (hit) return hit;
    // Only a boundary rounding miss uses a nearest existing vertex. Interior
    // proof checks detect any uncovered domain instead of silently inventing
    // a plane across a missing face or the protected water corridor.
    let best = Infinity; let nearest = 0;
    for (let i = 0; i < positions.count; i += 1) { const d = (nValues[i] - n) ** 2 + (hValues[i] - y) ** 2; if (d < best) { best = d; nearest = i; } }
    return new THREE.Vector3(positions.getX(nearest), positions.getY(nearest), positions.getZ(nearest));
  }) as WaterfallCoreSampler;

  // The collars must follow each real triangle, not a chord between two
  // correct endpoints. Trace the terrain edge in the cliff's lateral/height
  // plane, splitting only at native edges and actual boundary crossings.
  // The original core and query bins supply all positions; no second mesh or
  // extra sampling grid is constructed for these terrain joins.
  sample.traceEdge = (nA, yA, nB, yB, observe) => {
    assertCurrent();
    type Piece = { lo: number; hi: number; a: THREE.Vector3; b: THREE.Vector3; feature?:WaterfallCoreFeature };
    const dn = nB - nA, dy = yB - yA;
    const breaks = [0, 1];
    const addBreak = (t: number) => { if (t > 0 && t < 1) breaks.push(t); };
    if (Math.abs(dn) > 1e-12) {
      for (const rail of [crestRail, floorRail]) for (const i of rail) addBreak((nValues[i] - nA) / dn);
      addBreak((lateralMin - nA) / dn); addBreak((lateralMax - nA) / dn);
    }
    if (Math.abs(dy) > 1e-12) addBreak((floorY - yA) / dy);
    const ordered = (values: number[]) => values.sort((a, b) => a - b).filter((t, i, all) => {
      const keep=!i || t-all[i-1]>1e-10;
      if(!keep)observe?.({kind:'merged-parameter',reason:'legacy-1e-10',values:[all[i-1],t]});
      return keep;
    });
    const railFeature=(rail:number[],n:number):WaterfallCoreFeature=>{
      let lo=0,hi=rail.length-1;while(hi-lo>1){const mid=(lo+hi)>>>1;if(nValues[rail[mid]]<=n)lo=mid;else hi=mid;}
      return {kind:rail===crestRail?'crest-rail':'floor-rail',vertices:[rail[lo],rail[hi]]};
    };
    let intervals = ordered(breaks);
    // Between rail vertices its height is linear, so the terrain edge's
    // crossing with the drawn crest has an exact solution.
    for (let i = 1; i < intervals.length; i++) {
      const a = intervals[i - 1], b = intervals[i];
      const da = yA + dy * a - sampleRail(crestRail, nA + dn * a).y;
      const db = yA + dy * b - sampleRail(crestRail, nA + dn * b).y;
      if (da * db < 0) {
        const t=a+(b-a)*da/(da-db);
        // The optional compiler sees the actual outer bracket and finite
        // endpoint rail choices needed to bound this event's arithmetic.
        observe?.({kind:'rail-crossing',values:[a,b,da,db,t],
          features:[railFeature(crestRail,nA+dn*a),railFeature(crestRail,nA+dn*b)]});
        addBreak(t);
      }
    }
    intervals = ordered(breaks);
    const pieces: Piece[] = [];
    const pointOn = (piece: Piece, t: number) => piece.a.clone().lerp(piece.b, (t - piece.lo) / (piece.hi - piece.lo));
    for (let span = 1; span < intervals.length; span++) {
      const lo = intervals[span - 1], hi = intervals[span], mid = (lo + hi) / 2;
      const n0 = Math.max(lateralMin, Math.min(lateralMax, nA + dn * lo)), n1 = Math.max(lateralMin, Math.min(lateralMax, nA + dn * hi));
      const ym = yA + dy * mid, nm = Math.max(lateralMin, Math.min(lateralMax, nA + dn * mid));
      if (ym >= sampleRail(crestRail, nm).y || ym <= floorY) {
        const rail = ym <= floorY ? floorRail : crestRail;
        pieces.push({ lo, hi, a: sampleRail(rail, n0), b: sampleRail(rail, n1),
          feature:observe?railFeature(rail,nm):undefined }); continue;
      }
      const y0 = yA + dy * lo, y1 = yA + dy * hi;
      const candidates = new Set<number>();
      for (let x = Math.floor(Math.min(n0, n1) / cell); x <= Math.floor(Math.max(n0, n1) / cell); x++) {
        for (let y = Math.floor(Math.min(y0, y1) / cell); y <= Math.floor(Math.max(y0, y1) / cell); y++) {
          for (const triangle of traceBins.get(x + ':' + y) ?? []) candidates.add(triangle);
        }
      }
      for (const triangle of candidates) {
        const ids = [indices.getX(triangle), indices.getX(triangle + 1), indices.getX(triangle + 2)];
        const [i, j, k] = ids;
        const den = (hValues[j] - hValues[k]) * (nValues[i] - nValues[k]) + (nValues[k] - nValues[j]) * (hValues[i] - hValues[k]);
        // The front/base rings have microscopic projected differences after
        // Float32 storage. Their real cap triangles close that tiny interval;
        // omitting them here would turn a connected ledge into a false gap.
        if (Math.abs(den) < (caps.has(triangle) ? 1e-14 : 1e-10)) {
          observe?.({kind:'rejected-face',reason:'projected-determinant',face:triangle,values:[den,caps.has(triangle)?1e-14:1e-10]});continue;
        }
        const weights = (n: number, y: number) => {
          const u = ((hValues[j] - hValues[k]) * (n - nValues[k]) + (nValues[k] - nValues[j]) * (y - hValues[k])) / den;
          const v = ((hValues[k] - hValues[i]) * (n - nValues[k]) + (nValues[i] - nValues[k]) * (y - hValues[k])) / den;
          return [u, v, 1 - u - v];
        };
        const wa = weights(n0, y0), wb = weights(n1, y1); let start = 0, end = 1;
        for (let k = 0; k < 3; k++) {
          const change = wb[k] - wa[k];
          if (Math.abs(change) < 1e-12) { if (wa[k] < -1e-8) end = -1; }
          else if (change > 0) start = Math.max(start, -wa[k] / change);
          else end = Math.min(end, -wa[k] / change);
        }
        if (end - start <= 1e-10) {
          observe?.({kind:'rejected-face',reason:'short-or-outside-interval',face:triangle,values:[start,end,...wa,...wb]});continue;
        }
        const at = (s: number) => {
          const p = new THREE.Vector3();
          ids.forEach((id, k) => p.addScaledVector(new THREE.Vector3().fromBufferAttribute(positions, id), wa[k] + (wb[k] - wa[k]) * s));
          return p;
        };
        observe?.({kind:'face-piece',feature:{kind:'face',element:triangle,vertices:ids,cap:caps.has(triangle)},
          values:[lo,hi,n0,n1,y0,y1,start,end,lo+(hi-lo)*start,lo+(hi-lo)*end,...wa,...wb]});
        pieces.push({ lo: lo + (hi - lo) * start, hi: lo + (hi - lo) * end, a: at(start), b: at(end),
          feature:observe?{kind:'face',element:triangle,vertices:ids,cap:caps.has(triangle)}:undefined });
      }
    }
    const crossings = pieces.flatMap(piece => [piece.lo, piece.hi]);
    // Ordinarily one face covers each interval. At a ledge or rounding
    // overlap retain the foremost face, including any exact crossing of two
    // face planes; a fixed choice could otherwise join rock behind the slab.
    const forward = (p: THREE.Vector3) => (p.x - crest.x) * crest.tx + (p.z - crest.z) * crest.tz;
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j], lo = Math.max(a.lo, b.lo), hi = Math.min(a.hi, b.hi);
      if (hi - lo <= 1e-10) continue;
      const da = forward(pointOn(a, lo)) - forward(pointOn(b, lo));
      const db = forward(pointOn(a, hi)) - forward(pointOn(b, hi));
      if (da * db < 0) crossings.push(lo + (hi - lo) * da / (da - db));
    }
    const cuts = ordered([0, 1, ...crossings]); const result: WaterfallCoreTraceKnot[] = [];
    const append = (t: number, point: THREE.Vector3) => {
      const prior = result[result.length - 1];
      if (!prior || Math.abs(prior.t - t) > 1e-10 || prior.point.distanceToSquared(point) > 1e-12) result.push({ t, point });
      else observe?.({kind:'merged-knot',reason:'legacy-t-or-point-dedup',values:[prior.t,t,prior.point.distanceToSquared(point)],a:prior.point.toArray(),b:point.toArray()});
    };
    for (let i = 1; i < cuts.length; i++) {
      const lo = cuts[i - 1], hi = cuts[i], mid = (lo + hi) / 2;
      let best: Piece | undefined; let front = -Infinity;
      for (const piece of pieces) if (mid >= piece.lo - 1e-10 && mid <= piece.hi + 1e-10) {
        const f = forward(pointOn(piece, mid));
        if(f===front&&best)observe?.({kind:'forward-tie',feature:piece.feature,lo,hi,values:[f]});
        if (f > front) { front = f; best = piece; }
      }
      if (!best) throw new Error(`Terrain collar crosses an uncovered cliff surface at ${nA + dn * mid}, ${yA + dy * mid} (${hi - lo})`);
      // Different incoming/outgoing positions at one t retain the real
      // forward cap. Never replace a slab transition with a diagonal chord.
      observe?.({kind:'selected-span',feature:best.feature,lo,hi,values:[best.lo,best.hi],a:pointOn(best,lo).toArray(),b:pointOn(best,hi).toArray()});
      append(lo, pointOn(best, lo)); append(hi, pointOn(best, hi));
    }
    return result;
  };
  // These references already belong to the legacy sampler. The visitor is
  // intentionally streaming so the paired compiler need not hold a second
  // full cliff. Its own candidate/output capacities still require accounting.
  sample.nativeBoundary={faceCount:indices.count/3,
    constructedRails:geometry.userData.constructedRails,
    legacyRails:{crest:crestRail,floor:floorRail},
    vertex:(id:number)=>{
      assertCurrent();
      if(!Number.isInteger(id)||id<0||id>=positions.count)throw Error('Invalid native vertex');
      return [positions.getX(id),positions.getY(id),positions.getZ(id)];
    },
    forEachFace:visit=>{assertCurrent();for(let t=0;t<indices.count;t+=3){
      const ids=[indices.getX(t),indices.getX(t+1),indices.getX(t+2)];
      visit(t,ids,ids.map(i=>[positions.getX(i),positions.getY(i),positions.getZ(i)]),caps.has(t));
    }},
  };
  return sample;
}

/** Extend one terrain edge onto the existing cliff, following every native
 * bend. Scene retains its upward winding repair after all collars are added. */
export function appendWaterfallCoreCollar(sample: WaterfallCoreSampler, pa: THREE.Vector3, pb: THREE.Vector3,
  crest: { x: number; z: number; tx: number; tz: number }, positions: number[],
  onConstruction?: (edge: { a: readonly [number,number,number]; b: readonly [number,number,number]; firstElement:number; elements:number }) => void): void {
  const firstElement=positions.length/3;
  const lateral = (p: THREE.Vector3) => (p.x - crest.x) * crest.tz - (p.z - crest.z) * crest.tx;
  const knots = sample.traceEdge(lateral(pa), pa.y, lateral(pb), pb.y);
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1], b = knots[i], ta = pa.clone().lerp(pb, a.t), tb = pa.clone().lerp(pb, b.t);
    positions.push(...ta.toArray(), ...tb.toArray(), ...a.point.toArray(), ...tb.toArray(), ...b.point.toArray(), ...a.point.toArray());
  }
  // Preserve the actual pre-Float32 edge recipe. This observer records no
  // extra water or geometry and is absent from callers that do not export it.
  onConstruction?.({a:[pa.x,pa.y,pa.z],b:[pb.x,pb.y,pb.z],firstElement,elements:positions.length/3-firstElement});
}

export const SCAN_PLACEMENTS = [
  { n: -32, y: 15, wideScale: 6.6, tallScale: 16, rake: 0.18, flip: 1 },
  { n: 31, y: 24, wideScale: 7.2, tallScale: 15, rake: -0.24, flip: -1 },
  { n: -75, y: 50, wideScale: 8.6, tallScale: 10, rake: -0.09, flip: -1 },
] as const;

/** Places an original scanned outcrop against the exact terrain closure.
 * Its open outline is buried behind that rock, while its measured interior
 * triangles and UVs remain intact. This does not add terrain or water mass. */
export function buildWaterfallOutcropGeometry(original: THREE.BufferGeometry, options: {
  course: RiverCourse; width: number; placement: typeof SCAN_PLACEMENTS[number];
}): THREE.BufferGeometry {
  const geometry = original.clone(); const positions = geometry.getAttribute('position'); const index = geometry.index!;
  const { course, width, placement } = options; const crest = course.at(WATERFALL.crestS);
  // Welding only the outline search preserves the scan's UV seams. Treating
  // every UV seam as an open edge would bury real fractures inside the rock.
  const canonical = new Map<string, number>(); const vertexIds: number[] = []; const neighbors: Set<number>[] = [];
  for (let i = 0; i < positions.count; i += 1) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v * 10000)).join(':');
    let id = canonical.get(key); if (id === undefined) { id = canonical.size; canonical.set(key, id); neighbors.push(new Set()); }
    vertexIds.push(id);
  }
  const edges = new Map<string, number>();
  for (let i = 0; i < index.count; i += 3) for (let k = 0; k < 3; k += 1) {
    const a = vertexIds[index.getX(i + k)]; const b = vertexIds[index.getX(i + (k + 1) % 3)];
    neighbors[a].add(b); neighbors[b].add(a); const key = a < b ? a + ':' + b : b + ':' + a;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  const distance = new Float32Array(canonical.size).fill(100); const queue: number[] = [];
  for (const [key, count] of edges) if (count === 1) for (const id of key.split(':').map(Number)) if (distance[id] !== 0) { distance[id] = 0; queue.push(id); }
  for (let k = 0; k < queue.length; k += 1) for (const neighbor of neighbors[queue[k]]) if (distance[neighbor] > distance[queue[k]] + 1) { distance[neighbor] = distance[queue[k]] + 1; queue.push(neighbor); }
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i) - 0.34315; const y = positions.getY(i); const depth = positions.getZ(i);
    const n = placement.n + x * placement.wideScale * placement.flip + (y - 1.75) * placement.rake;
    const height = placement.y + (y + 0.03436) * placement.tallScale;
    const boundary = waterfallRockBoundary(n, width);
    const edge = Math.min(1, distance[vertexIds[i]] / 7);
    // The source outline is deliberately embedded half a meter behind the
    // retained terrain face. Actual protruding scan planes emerge gradually;
    // there is no coplanar decorative rectangle along their open perimeter.
    const shoulder = Math.max(0, Math.min(1, (Math.abs(n) - width * 0.5 - 6) / 16));
    const relief = (depth + 3.5) * 2.4 * shoulder;
    let forward = boundary - 0.5 + edge * Math.max(0, relief);
    const fraction = Math.max(0, Math.min(1, (78 - height) / 70));
    if (Math.abs(n) < width * 0.5 + fraction * width * 0.75 + 1.2) forward = -4.3;
    positions.setXYZ(i, crest.x + crest.tx * forward + crest.tz * n, height, crest.z + crest.tz * forward - crest.tx * n);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

/** The core uses the tileable scan at its measured 1.5m scale. An object
 * atlas has disconnected UV islands, so interpolating its UVs across this
 * mountain stretches unrelated islands into bands. World projections keep
 * grain size constant on recessed and inclined faces without those seams. */
function createWaterfallCoreMaterial(): THREE.MeshStandardNodeMaterial {
  const material = createWaterfallRockMaterial();
  material.userData.boundaryUsesRockTone = true;
  // Keep the same physical scan and tint on core, source rock and outcrops;
  // the existing attributes still darken wetted faces and reduce roughness.
  material.colorNode = material.colorNode!.mul(attribute('rockTone', 'float'));
  material.roughnessNode = mix(material.roughnessNode!, float(0.42), attribute('rockWet', 'float').mul(0.65));
  return material;
}
/** One visible mountain owns the entire crest-to-foot formation. Original
 * scan assets and the optional outcrop reconstruction helper are retained,
 * but the rejected isolated plaque layer is no longer added to this view. */
export function buildWaterfallCliff(options: { seed: number; shape: RiverShape; course: RiverCourse }): THREE.Group {
  const core = buildWaterfallCliffGeometry(options);
  // Rendering duplicates normals only across sharp physical creases. The
  // indexed core and exact sampler retain the same connected positions;
  // smooth averaging across deep fracture walls previously rounded their
  // lips and produced alternating triangular highlights along diagonals.
  const creased = toCreasedNormals(core, Math.PI / 5);
  const geometry = mergeVertices(creased, 1e-6);
  // Normal/crease conversion used to discard ledge ownership. Retain that
  // construction only after exact face-order/position comparison. A failed
  // experimental witness must not prevent the ordinary scene from drawing.
  try {
    const metadata=retainNativeCliffBoundary(core,geometry,{seed:options.seed,widthScale:options.shape.widthScale,
      depthScale:options.shape.depthScale,crest:options.course.at(WATERFALL.crestS)});
    bindNativeBoundaryEpoch(geometry,metadata);
  } catch(error) { geometry.userData.nativeBoundaryFailure=String(error); }
  core.dispose(); creased.dispose();
  const material = createWaterfallCoreMaterial();
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'continuous scan-informed fractured mountain';
  // Finite ledges need their actual cast/contact shadows. The Scene owner
  // refreshes its static shadow map when this mountain is rebuilt.
  mesh.castShadow = true; mesh.receiveShadow = true;
  const group = new THREE.Group(); group.name = 'continuous waterfall mountain'; group.add(mesh);
  // Preserve the viewer's established readiness contract, now fulfilled by
  // the maps used on this actual surface rather than an unused overlay asset.
  group.userData.outcropReady = rockMapsReady!.then(() => {
    if (group.userData.disposed) return;
    group.userData.coreMaterialMatched = true;
    group.userData.outcropLoaded = true;
  }).catch(error => { group.userData.outcropLoadError = String(error); });
  return group;
}

/** Prevent late texture readiness from reviving a removed cliff. Shared source
 * textures remain cached; only this group's owned meshes are disposed. */
export function disposeWaterfallCliff(group: THREE.Group): void {
  group.userData.disposed = true;
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material.dispose();
  });
}
