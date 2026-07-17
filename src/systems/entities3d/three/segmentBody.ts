/**
 * @file segmentBody.ts — the body v2 renderer: one rigid mesh per skeleton
 * segment, re-transformed every frame.
 *
 * Drivers (and chain parts) write segments/balls into the sink each frame.
 * The first time an id appears its geometry is built (radii are
 * frame-constant per id by contract); afterwards only position, orientation,
 * and length change — no geometry work at runtime, which is what makes this
 * strictly cheaper than the old metaball field.
 *
 * Looks:
 *  - solid: shared toon material + an inverse-hull ink outline per node;
 *    joint spheres round the elbows/knees (mannequin style).
 *  - wireframe: LineSegments over EdgesGeometry per node — clean edge lines,
 *    no fill, no joint spheres (lines read connected without them).
 */
import {
  BoxGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { SegmentSink } from '../types';
import { createSweptTube, type SweptTube } from './sweptTube';
import { outlineMaterial, toonMaterial, type EntityRenderMode } from './toon';
import { Color } from 'three';

export interface SegmentBodyOptions {
  renderMode: EntityRenderMode;
  colorHex: string;
  /** Energy rings and other glow accents render in this color, unlit. */
  accentHex?: string;
  /** Inverse-hull outline thickness (solid mode), meters. */
  outlineThickness: number;
  /** Body translucency (< 1 = ghosts, oozes). Solid mode only; wireframe ignores. */
  opacity?: number;
}

export interface SegmentBody {
  readonly root: Group;
  readonly sink: SegmentSink;
  /** Mark all cached nodes unseen; call before the frame's sink writes. */
  beginFrame(): void;
  /** Hide nodes that were not written this frame (chains can shrink). */
  finishFrame(): void;
  segmentCount(): number;
  triangles(): number;
  dispose(): void;
}

interface Node {
  group: Group;
  seen: boolean;
  triangles: number;
  /** Cache key when the geometry is shared; absent = owned (wire mode). */
  geoKey?: string;
}

/**
 * Module-wide refcounted geometry cache. Segment radii repeat constantly
 * across entities (crowds of the same creature, mirrored limbs), so identical
 * quantized dimensions share ONE BufferGeometry. dispose() releases; the last
 * release frees GPU memory.
 */
type CachedGeometry = CylinderGeometry | SphereGeometry | BoxGeometry;
const GEO_CACHE = new Map<string, { geometry: CachedGeometry; refs: number }>();
const q = (v: number) => Math.round(v * 500); // 2 mm buckets

function acquireGeometry(key: string, build: () => CachedGeometry): CachedGeometry {
  let hit = GEO_CACHE.get(key);
  if (!hit) {
    hit = { geometry: build(), refs: 0 };
    GEO_CACHE.set(key, hit);
  }
  hit.refs++;
  return hit.geometry;
}

function releaseGeometry(key: string): void {
  const hit = GEO_CACHE.get(key);
  if (!hit) return;
  hit.refs--;
  if (hit.refs <= 0) {
    hit.geometry.dispose();
    GEO_CACHE.delete(key);
  }
}

const UP = new Vector3(0, 1, 0);
const FORWARD_Z = new Vector3(0, 0, 1);
const DIR = new Vector3();
const MID = new Vector3();
const QUAT = new Quaternion();

export function createSegmentBody(options: SegmentBodyOptions): SegmentBody {
  const wire = options.renderMode === 'wireframe';
  const root = new Group();
  root.name = 'segmentBody';

  const fillMaterial = wire ? null : toonMaterial(options.colorHex);
  if (fillMaterial && options.opacity !== undefined && options.opacity < 1) {
    fillMaterial.transparent = true;
    fillMaterial.opacity = options.opacity;
    fillMaterial.depthWrite = false; // translucent bodies must not self-occlude harshly
  }
  const inkMaterial = wire ? null : outlineMaterial(options.colorHex, options.outlineThickness);
  const lineMaterial = wire
    ? new LineBasicMaterial({ color: new Color(options.colorHex).lerp(new Color('#ffffff'), 0.22) })
    : null;
  const accentHex = options.accentHex ?? options.colorHex;
  // unlit = reads as glow against the toon world; built lazily (rings are rare)
  let accentMaterial: MeshBasicMaterial | null = null;
  let accentLineMaterial: LineBasicMaterial | null = null;

  const nodes = new Map<string, Node>();
  const tubes = new Map<string, { tube: SweptTube; node: Node; pts: Vector3[] }>();
  let triangleTotal = 0;

  /** Wrap a base geometry as this body's render node(s). */
  function makeNode(id: string, geometry: CylinderGeometry | SphereGeometry | BoxGeometry, geoKey?: string): Node {
    const group = new Group();
    group.name = `seg:${id}`;
    let triangles = 0;
    if (wire) {
      const edges = new EdgesGeometry(geometry, 24);
      group.add(new LineSegments(edges, lineMaterial!));
      triangles = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
      geometry.dispose(); // only the edges survive
    } else {
      const mesh = new Mesh(geometry, fillMaterial!);
      const shell = new Mesh(geometry, inkMaterial!);
      shell.name = 'segOutline';
      group.add(mesh, shell);
      triangles = (geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3) * 2;
    }
    triangleTotal += triangles;
    const node: Node = { group, seen: true, triangles, geoKey: wire ? undefined : geoKey };
    nodes.set(id, node);
    root.add(group);
    return node;
  }

  /** Solid mode shares quantized geometry; wire mode owns fresh (edges replace it). */
  function bodyGeometry(key: string, build: () => CachedGeometry): { geometry: CachedGeometry; key?: string } {
    if (wire) return { geometry: build() };
    return { geometry: acquireGeometry(key, build), key };
  }

  const sink: SegmentSink = {
    seg(id, ax, ay, az, bx, by, bz, r0, r1) {
      let node = nodes.get(id);
      if (!node) {
        // unit-height tapered bone; joint spheres round the ends in solid mode
        const cyl = bodyGeometry(`c:${q(r1)}:${q(r0)}`, () => new CylinderGeometry(r1, r0, 1, 10, 1));
        node = makeNode(id, cyl.geometry, cyl.key);
        if (!wire) {
          for (const [endId, r] of [
            [`${id}.jointA`, r0],
            [`${id}.jointB`, r1],
          ] as const) {
            const sph = bodyGeometry(`j:${q(r)}`, () => new SphereGeometry(r * 0.98, 8, 6));
            makeNode(endId, sph.geometry, sph.key);
          }
        }
      }
      node.seen = true;
      DIR.set(bx - ax, by - ay, bz - az);
      const len = Math.max(DIR.length(), 1e-4);
      MID.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      QUAT.setFromUnitVectors(UP, DIR.normalize());
      node.group.position.copy(MID);
      node.group.quaternion.copy(QUAT);
      node.group.scale.set(1, len, 1);
      if (!wire) {
        const jointA = nodes.get(`${id}.jointA`);
        if (jointA) {
          jointA.seen = true;
          jointA.group.position.set(ax, ay, az);
        }
        const jointB = nodes.get(`${id}.jointB`);
        if (jointB) {
          jointB.seen = true;
          jointB.group.position.set(bx, by, bz);
        }
      }
    },
    ball(id, x, y, z, r) {
      let node = nodes.get(id);
      if (!node) {
        const sph = bodyGeometry(`s:${q(r)}`, () => new SphereGeometry(r, 12, 9));
        node = makeNode(id, sph.geometry, sph.key);
      }
      node.seen = true;
      node.group.position.set(x, y, z);
    },
    box(id, ax, ay, az, bx, by, bz, w, h) {
      let node = nodes.get(id);
      if (!node) {
        // unit-depth slab; scale.z carries the live a→b length
        const slab = bodyGeometry(`b:${q(w)}:${q(h)}`, () => new BoxGeometry(w, h, 1));
        node = makeNode(id, slab.geometry, slab.key);
      }
      node.seen = true;
      DIR.set(bx - ax, by - ay, bz - az);
      const len = Math.max(DIR.length(), 1e-4);
      MID.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      QUAT.setFromUnitVectors(FORWARD_Z, DIR.normalize());
      node.group.position.copy(MID);
      node.group.quaternion.copy(QUAT);
      node.group.scale.set(1, 1, len);
    },
    // smooth swept bodies (solid mode; wireframe mode omits tube() entirely so
    // drivers fall back to crisp rigid segments)
    ...(wire
      ? {}
      : {
          tube(id: string, points: number[], radii: number[]) {
            let entry = tubes.get(id);
            if (!entry) {
              const stations = Math.min(64, Math.max(16, points.length * 6));
              const built = createSweptTube({
                stations,
                radial: 8,
                material: fillMaterial!,
                outlineMaterial: inkMaterial,
              });
              const group = new Group();
              group.name = `seg:${id}`;
              group.add(built.mesh);
              if (built.outline) group.add(built.outline);
              const node: Node = { group, seen: true, triangles: built.triangles() * 2 };
              triangleTotal += node.triangles;
              nodes.set(id, node);
              root.add(group);
              entry = { tube: built, node, pts: [] };
              tubes.set(id, entry);
            }
            entry.node.seen = true;
            const n = points.length / 3;
            while (entry.pts.length < n) entry.pts.push(new Vector3());
            entry.pts.length = n;
            for (let i = 0; i < n; i++) {
              entry.pts[i].set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
            }
            entry.tube.update(entry.pts, radii);
          },
        }),
    ring(id, x, y, z, nx, ny, nz, radius, tube) {
      let node = nodes.get(id);
      if (!node) {
        const geometry = new TorusGeometry(radius, tube, 8, 18);
        const group = new Group();
        group.name = `seg:${id}`;
        let triangles = 0;
        if (wire) {
          accentLineMaterial ??= new LineBasicMaterial({
            color: new Color(accentHex).lerp(new Color('#ffffff'), 0.15),
          });
          group.add(new LineSegments(new EdgesGeometry(geometry, 30), accentLineMaterial));
          triangles = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
          geometry.dispose();
        } else {
          accentMaterial ??= new MeshBasicMaterial({ color: accentHex });
          // no ink shell: rings glow, they are not inked bodies
          group.add(new Mesh(geometry, accentMaterial));
          triangles = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
        }
        triangleTotal += triangles;
        node = { group, seen: true, triangles };
        nodes.set(id, node);
        root.add(group);
      }
      node.seen = true;
      DIR.set(nx, ny, nz);
      if (DIR.lengthSq() < 1e-8) DIR.set(0, 1, 0);
      // TorusGeometry lies in the XY plane facing +Z
      QUAT.setFromUnitVectors(FORWARD_Z, DIR.normalize());
      node.group.position.set(x, y, z);
      node.group.quaternion.copy(QUAT);
    },
  };

  function beginFrame(): void {
    for (const node of nodes.values()) node.seen = false;
  }

  function finishFrame(): void {
    for (const node of nodes.values()) node.group.visible = node.seen;
  }

  function dispose(): void {
    for (const { tube } of tubes.values()) tube.dispose();
    for (const node of nodes.values()) {
      if (node.geoKey) {
        releaseGeometry(node.geoKey);
        continue;
      }
      node.group.traverse((o: Object3D) => {
        const m = o as Mesh;
        if ((m as Mesh).isMesh || (o as LineSegments).isLineSegments) {
          (m.geometry as { dispose?: () => void })?.dispose?.();
        }
      });
    }
    for (const material of [fillMaterial, inkMaterial, lineMaterial, accentMaterial, accentLineMaterial]) {
      (material as Material | null)?.dispose();
    }
    root.clear();
    nodes.clear();
  }

  return {
    root,
    sink,
    beginFrame,
    finishFrame,
    segmentCount: () => nodes.size,
    triangles: () => Math.round(triangleTotal),
    dispose,
  };
}

/** Convert a mesh-part object to clean edge lines in place (wireframe mode).
 * Every Mesh is replaced by LineSegments over its EdgesGeometry, colored from
 * the mesh's material, preserving transforms and group structure (wing groups
 * keep their names, so flap animation still works). */
export function wireframeifyPart(object: Object3D): void {
  const swaps: Array<{ mesh: Mesh; lines: LineSegments }> = [];
  object.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const color = (material as { color?: Color }).color ?? new Color('#ffffff');
    const lines = new LineSegments(
      new EdgesGeometry(mesh.geometry, 24),
      new LineBasicMaterial({ color: color.clone().lerp(new Color('#ffffff'), 0.22) }),
    );
    lines.position.copy(mesh.position);
    lines.quaternion.copy(mesh.quaternion);
    lines.scale.copy(mesh.scale);
    lines.name = mesh.name;
    swaps.push({ mesh, lines });
  });
  for (const { mesh, lines } of swaps) {
    const parent = mesh.parent;
    if (!parent) continue;
    parent.add(lines);
    parent.remove(mesh);
    mesh.geometry.dispose();
    const material = mesh.material as Material | Material[];
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
  }
}
