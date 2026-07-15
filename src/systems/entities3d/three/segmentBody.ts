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
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type { SegmentSink } from '../types';
import { outlineMaterial, toonMaterial, type EntityRenderMode } from './toon';
import { Color } from 'three';

export interface SegmentBodyOptions {
  renderMode: EntityRenderMode;
  colorHex: string;
  /** Inverse-hull outline thickness (solid mode), meters. */
  outlineThickness: number;
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
}

const UP = new Vector3(0, 1, 0);
const DIR = new Vector3();
const MID = new Vector3();
const QUAT = new Quaternion();

export function createSegmentBody(options: SegmentBodyOptions): SegmentBody {
  const wire = options.renderMode === 'wireframe';
  const root = new Group();
  root.name = 'segmentBody';

  const fillMaterial = wire ? null : toonMaterial(options.colorHex);
  const inkMaterial = wire ? null : outlineMaterial(options.colorHex, options.outlineThickness);
  const lineMaterial = wire
    ? new LineBasicMaterial({ color: new Color(options.colorHex).lerp(new Color('#ffffff'), 0.22) })
    : null;

  const nodes = new Map<string, Node>();
  let triangleTotal = 0;

  /** Wrap a base geometry as this body's render node(s). */
  function makeNode(id: string, geometry: CylinderGeometry | SphereGeometry): Node {
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
    const node: Node = { group, seen: true, triangles };
    nodes.set(id, node);
    root.add(group);
    return node;
  }

  const sink: SegmentSink = {
    seg(id, ax, ay, az, bx, by, bz, r0, r1) {
      let node = nodes.get(id);
      if (!node) {
        // unit-height tapered bone; joint spheres round the ends in solid mode
        const geometry = new CylinderGeometry(r1, r0, 1, 10, 1);
        node = makeNode(id, geometry);
        if (!wire) {
          for (const [endId, r] of [
            [`${id}.jointA`, r0],
            [`${id}.jointB`, r1],
          ] as const) {
            makeNode(endId, new SphereGeometry(r * 0.98, 8, 6));
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
        node = makeNode(id, new SphereGeometry(r, 12, 9));
      }
      node.seen = true;
      node.group.position.set(x, y, z);
    },
  };

  function beginFrame(): void {
    for (const node of nodes.values()) node.seen = false;
  }

  function finishFrame(): void {
    for (const node of nodes.values()) node.group.visible = node.seen;
  }

  function dispose(): void {
    root.traverse((o: Object3D) => {
      const m = o as Mesh;
      if ((m as Mesh).isMesh || (o as LineSegments).isLineSegments) {
        (m.geometry as { dispose?: () => void })?.dispose?.();
      }
    });
    for (const material of [fillMaterial, inkMaterial, lineMaterial]) {
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
