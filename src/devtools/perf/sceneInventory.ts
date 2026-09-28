/**
 * @file sceneInventory.ts
 * What a surface's scenes hold, by group, and what its camera sees.
 *
 * The renderer counters say how many triangles a pass DREW. They cannot say
 * whose triangles they were, or how many the camera could have seen. This
 * walks the scenes the renderer probe saw in the last second and answers
 * three questions (Remy, 2026-09-29, on the river page):
 *
 * 1. WHICH GROUP costs the triangles: the trees, the stones, the water. A group
 *    is the nearest `userData.perfGroup` tag on the object or an ancestor;
 *    else the object's own name; else the nearest named ancestor; else
 *    "unnamed". An unnamed object is counted under "unnamed", never dropped,
 *    and the unnamed row is broken down by object, material and geometry
 *    type so it still points somewhere.
 * 2. WHAT THE CULL DID: triangles mounted (every visible object) against
 *    triangles in view (inside the camera's frustum), beside what the pass
 *    drew. The frustum test uses each object's bounding sphere, as three's
 *    own cull does.
 * 3. HOW FAR THE WATER IS: the distance from the camera to the nearest
 *    world-space bounding box of a group whose name says water (water, sea,
 *    ocean, river, lake, pond).
 *
 * It imports nothing from three. It reads the plain fields every three object
 * carries (`children`, `matrixWorld.elements`, `geometry.index`), so the
 * toolkit stays out of the main bundle's three chunk.
 */

// ── The slice of three this reads ─────────────────────────────────────────────

interface Sphere {
  center: { x: number; y: number; z: number };
  radius: number;
}

interface Box {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

interface NodeLike {
  name?: string;
  type?: string;
  visible?: boolean;
  castShadow?: boolean;
  frustumCulled?: boolean;
  isMesh?: boolean;
  isInstancedMesh?: boolean;
  isBatchedMesh?: boolean;
  isScene?: boolean;
  count?: number;
  parent?: NodeLike | null;
  children?: NodeLike[];
  userData?: Record<string, unknown>;
  layers?: { mask: number };
  matrixWorld?: { elements: ArrayLike<number> };
  boundingSphere?: Sphere | null;
  boundingBox?: Box | null;
  geometry?: {
    type?: string;
    index?: { count: number } | null;
    attributes?: { position?: { count: number } };
    drawRange?: { start: number; count: number };
    boundingSphere?: Sphere | null;
    boundingBox?: Box | null;
    computeBoundingBox?: () => void;
  };
  material?: { type?: string } | { type?: string }[];
}

export interface CameraLike {
  name?: string;
  type?: string;
  userData?: Record<string, unknown>;
  layers?: { mask: number };
  projectionMatrix?: { elements: ArrayLike<number> };
  matrixWorldInverse?: { elements: ArrayLike<number> };
  matrixWorld?: { elements: ArrayLike<number> };
}

// ── Output ────────────────────────────────────────────────────────────────────

export interface InventoryGroup {
  name: string;
  /** How the name was found, so a reader knows whether the scene named it. */
  source: 'tag' | 'name' | 'ancestor' | 'unnamed';
  meshes: number;
  instances: number;
  triangles: number;
  inViewTriangles: number;
  shadowCasters: number;
}

export interface UnnamedKind {
  kind: string;
  meshes: number;
  triangles: number;
}

export interface InventoryScene {
  /** The probe's small id for the scene, to pair it with the passes that drew it. */
  sceneKey: number;
  label: string;
  camera: string;
  mountedTriangles: number;
  inViewTriangles: number;
  /** Objects whose bounds three had not computed; counted as in view. */
  unknownBounds: number;
}

export interface SceneInventory {
  /** `performance.now()` when the walk ran. */
  at: number;
  /** What the walk itself cost, so the tool's own price is on the panel. */
  tookMs: number;
  objects: number;
  groups: InventoryGroup[];
  unnamed: UnnamedKind[];
  scenes: InventoryScene[];
  mountedTriangles: number;
  inViewTriangles: number;
  /** Null when no group's name says water. */
  nearestWater: { group: string; distanceM: number } | null;
  /** True when at least one group's name says water. */
  waterNamed: boolean;
}

// ── Math ──────────────────────────────────────────────────────────────────────

type Plane = [number, number, number, number];

/**
 * The six frustum planes of `projection x view`, as (a, b, c, d) with the
 * normal pointing inward. three stores matrices column-major.
 */
export function frustumPlanes(projection: ArrayLike<number>, view: ArrayLike<number>): Plane[] {
  const m = multiply(projection, view);
  // Row i of a column-major matrix: m[i], m[i+4], m[i+8], m[i+12].
  const row = (i: number) => [m[i], m[i + 4], m[i + 8], m[i + 12]];
  const r0 = row(0), r1 = row(1), r2 = row(2), r3 = row(3);
  const planes: Plane[] = [
    [r3[0] + r0[0], r3[1] + r0[1], r3[2] + r0[2], r3[3] + r0[3]],
    [r3[0] - r0[0], r3[1] - r0[1], r3[2] - r0[2], r3[3] - r0[3]],
    [r3[0] + r1[0], r3[1] + r1[1], r3[2] + r1[2], r3[3] + r1[3]],
    [r3[0] - r1[0], r3[1] - r1[1], r3[2] - r1[2], r3[3] - r1[3]],
    [r3[0] + r2[0], r3[1] + r2[1], r3[2] + r2[2], r3[3] + r2[3]],
    [r3[0] - r2[0], r3[1] - r2[1], r3[2] - r2[2], r3[3] - r2[3]],
  ];
  for (const p of planes) {
    const len = Math.hypot(p[0], p[1], p[2]) || 1;
    p[0] /= len; p[1] /= len; p[2] /= len; p[3] /= len;
  }
  return planes;
}

function multiply(a: ArrayLike<number>, b: ArrayLike<number>): number[] {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

/** A bounding sphere moved into world space. */
export function worldSphere(sphere: Sphere, world: ArrayLike<number>): { x: number; y: number; z: number; r: number } {
  const { x, y, z } = sphere.center;
  const e = world;
  const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
  const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
  const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
  const sx = e[0] * e[0] + e[1] * e[1] + e[2] * e[2];
  const sy = e[4] * e[4] + e[5] * e[5] + e[6] * e[6];
  const sz = e[8] * e[8] + e[9] * e[9] + e[10] * e[10];
  return { x: wx, y: wy, z: wz, r: sphere.radius * Math.sqrt(Math.max(sx, sy, sz)) };
}

/**
 * Distance from a point to a box given in local space and moved to world
 * space. The box's eight corners are transformed and re-boxed, which can only
 * grow the box, so the distance is never overstated.
 */
export function distanceToBox(p: { x: number; y: number; z: number }, box: Box, world: ArrayLike<number>): number {
  const e = world;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? box.max.x : box.min.x;
    const y = i & 2 ? box.max.y : box.min.y;
    const z = i & 4 ? box.max.z : box.min.z;
    const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
    const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
    const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
    minX = Math.min(minX, wx); maxX = Math.max(maxX, wx);
    minY = Math.min(minY, wy); maxY = Math.max(maxY, wy);
    minZ = Math.min(minZ, wz); maxZ = Math.max(maxZ, wz);
  }
  const dx = Math.max(minX - p.x, 0, p.x - maxX);
  const dy = Math.max(minY - p.y, 0, p.y - maxY);
  const dz = Math.max(minZ - p.z, 0, p.z - maxZ);
  return Math.hypot(dx, dy, dz);
}

export function sphereInFrustum(planes: Plane[], s: { x: number; y: number; z: number; r: number }): boolean {
  for (const p of planes) {
    if (p[0] * s.x + p[1] * s.y + p[2] * s.z + p[3] < -s.r) return false;
  }
  return true;
}

// ── Grouping ──────────────────────────────────────────────────────────────────

/** The group an object belongs to, and how that was decided. */
export function groupOf(obj: NodeLike): { name: string; source: InventoryGroup['source'] } {
  for (let n: NodeLike | null | undefined = obj; n && !n.isScene; n = n.parent) {
    const tag = n.userData?.perfGroup;
    if (typeof tag === 'string' && tag.trim()) return { name: tag.trim(), source: 'tag' };
  }
  if (obj.name && obj.name.trim()) return { name: obj.name.trim(), source: 'name' };
  for (let n = obj.parent; n && !n.isScene; n = n.parent) {
    if (n.name && n.name.trim()) return { name: n.name.trim(), source: 'ancestor' };
  }
  return { name: 'unnamed', source: 'unnamed' };
}

/** Triangles one draw of this object submits, honoring index, draw range and instance count. */
export function trianglesOf(obj: NodeLike): number {
  if (!obj.isMesh) return 0;
  const g = obj.geometry;
  if (!g) return 0;
  let n = g.index ? g.index.count : g.attributes?.position?.count ?? 0;
  const dr = g.drawRange;
  if (dr && Number.isFinite(dr.count)) n = Math.max(0, Math.min(n - dr.start, dr.count));
  const instances = obj.isInstancedMesh ? obj.count ?? 1 : 1;
  return Math.floor(n / 3) * instances;
}

/**
 * A group name that says water, as a whole word: "water", "river_water",
 * "Sea". Not "OceanSky.mesh" (the ocean viewer's SKY, which the first test
 * took for water) and not "seabed".
 */
const WATER = /(^|[^a-z])(water|sea|ocean|river|lake|pond)([^a-z]|$)/i;

function materialType(m: NodeLike['material']): string {
  if (!m) return 'no material';
  if (Array.isArray(m)) return m.length ? `${m[0]?.type ?? 'Material'}×${m.length}` : 'no material';
  return m.type ?? 'Material';
}

function labelOf(o: { name?: string; type?: string; userData?: Record<string, unknown> }, fallback: string): string {
  const tag = o.userData?.perfPass ?? o.userData?.perfGroup;
  if (typeof tag === 'string' && tag.trim()) return tag.trim();
  if (o.name && o.name.trim() && o.name !== 'Scene') return o.name.trim();
  return fallback;
}

// ── The walk ──────────────────────────────────────────────────────────────────

export interface InventoryInput {
  sceneKey: number;
  /** What the panel calls the scene; the probe passes the same name its passes use. */
  label?: string;
  scene: NodeLike;
  camera: CameraLike | null;
}

/**
 * Walk every scene once. It changes nothing on the objects it reads, except
 * to compute a water mesh's bounding box when three has not (see below).
 */
export function takeInventory(inputs: InventoryInput[], nowMs = performance.now()): SceneInventory {
  const t0 = performance.now();
  const groups = new Map<string, InventoryGroup>();
  const unnamed = new Map<string, UnnamedKind>();
  const scenes: InventoryScene[] = [];
  let objects = 0;
  let nearestWater: SceneInventory['nearestWater'] = null;
  let waterNamed = false;

  for (const { sceneKey, scene, camera, label } of inputs) {
    const planes =
      camera?.projectionMatrix?.elements && camera.matrixWorldInverse?.elements
        ? frustumPlanes(camera.projectionMatrix.elements, camera.matrixWorldInverse.elements)
        : null;
    const cam = camera?.matrixWorld?.elements;
    const camPos = cam ? { x: cam[12], y: cam[13], z: cam[14] } : null;
    const camMask = camera?.layers?.mask ?? 0xffffffff;
    const summary: InventoryScene = {
      sceneKey,
      label: label ?? labelOf(scene, `scene ${sceneKey}`),
      camera: camera ? labelOf(camera, camera.type ?? 'camera') : 'no camera',
      mountedTriangles: 0,
      inViewTriangles: 0,
      unknownBounds: 0,
    };

    const stack: NodeLike[] = [...(scene.children ?? [])];
    while (stack.length) {
      const obj = stack.pop()!;
      if (obj.visible === false) continue;
      objects++;
      if (obj.children?.length) stack.push(...obj.children);
      const tris = trianglesOf(obj);
      if (tris === 0) continue;

      const { name, source } = groupOf(obj);
      let g = groups.get(name);
      if (!g) {
        g = { name, source, meshes: 0, instances: 0, triangles: 0, inViewTriangles: 0, shadowCasters: 0 };
        groups.set(name, g);
      }
      g.meshes++;
      g.instances += obj.isInstancedMesh ? obj.count ?? 1 : 1;
      g.triangles += tris;
      if (obj.castShadow) g.shadowCasters++;
      summary.mountedTriangles += tris;

      if (source === 'unnamed') {
        // Short forms, the same as the screen share uses: "Mesh · Standard · Buffer".
        const mat = materialType(obj.material).replace(/Material/, '').replace(/^Mesh(?=[A-Z])/, '');
        const geo = (obj.geometry?.type ?? 'BufferGeometry').replace(/Geometry$/, '');
        const kind = `${obj.type ?? 'Mesh'} · ${mat} · ${geo}`;
        const u = unnamed.get(kind) ?? { kind, meshes: 0, triangles: 0 };
        u.meshes++;
        u.triangles += tris;
        unnamed.set(kind, u);
      }

      // In view: the camera's layers must include the object, then its sphere
      // must touch the frustum. An object three never culls is always in view.
      const layerOk = ((obj.layers?.mask ?? 1) & camMask) !== 0;
      let inView = layerOk;
      const sphere = obj.boundingSphere ?? obj.geometry?.boundingSphere ?? null;
      const world = obj.matrixWorld?.elements;
      const ws = sphere && world ? worldSphere(sphere, world) : null;
      if (inView && planes && obj.frustumCulled !== false) {
        if (ws) inView = sphereInFrustum(planes, ws);
        else summary.unknownBounds++;
      }
      if (inView) {
        g.inViewTriangles += tris;
        summary.inViewTriangles += tris;
      }

      if (WATER.test(name)) {
        waterNamed = true;
        // A box, not the sphere: a camera 10 m above a wide water sheet sits
        // INSIDE the sheet's bounding sphere. three computes a geometry's box
        // only on demand, so this computes it once for a water mesh (the one
        // write this walk makes, and only to the water's own geometry).
        if (!obj.boundingBox && !obj.geometry?.boundingBox) obj.geometry?.computeBoundingBox?.();
        const box = obj.boundingBox ?? obj.geometry?.boundingBox ?? null;
        if (camPos && world && box) {
          const d = distanceToBox(camPos, box, world);
          if (!nearestWater || d < nearestWater.distanceM) nearestWater = { group: name, distanceM: d };
        }
      }
    }
    scenes.push(summary);
  }

  const sortedGroups = [...groups.values()].sort((a, b) => b.triangles - a.triangles);
  return {
    at: nowMs,
    tookMs: performance.now() - t0,
    objects,
    groups: sortedGroups,
    unnamed: [...unnamed.values()].sort((a, b) => b.triangles - a.triangles),
    scenes,
    mountedTriangles: scenes.reduce((a, s) => a + s.mountedTriangles, 0),
    inViewTriangles: scenes.reduce((a, s) => a + s.inViewTriangles, 0),
    nearestWater,
    waterNamed,
  };
}
