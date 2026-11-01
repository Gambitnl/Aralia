/** Meshes and surface riding for the user's drop menu. The existing water
 * mirror supplies both current and height. Every leaf and bubble has its
 * own body and mesh; clearing or expiry releases their GPU resources. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 17:10:12
 * Dependents: components/World3D/water/riverReachScene.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import { RiverDroppedObjects, RIVER_DROP_PROFILES, type RiverDropKind, type DroppedBody, type DroppedRock } from '@/systems/world3d/river/riverDroppedObjects';
import type { RiverReachData } from '@/systems/world3d/river/riverWorker';
import type { RiverSurfaceMirror } from './riverSurfaceMirror';
import { mainBoulderShape } from '@/systems/world3d/river/riverReach';

/** Keep submerged rocks too: a flood can release objects, then strand them again.
 * The same scaled, rotated granite triangles supply the drawn crest. The full
 * projected circle conservatively preserves the existing horizontal collision
 * approximation; it is not a detailed hull/triangle contact solver. */
function droppedRocks(data: RiverReachData): DroppedRock[] {
  return data.boulders.filter((b) => b.inChannel).map((b) => {
    const shape = mainBoulderShape(b);
    let r = 0;
    for (let k = 0; k < shape.positions.length; k += 3) {
      r = Math.max(r, Math.hypot(shape.positions[k] - b.x, shape.positions[k + 2] - b.z));
    }
    return { x: b.x, z: b.z, r, topY: shape.bounds.maxY };
  });
}

function model(kind: RiverDropKind, phase: number): THREE.Group {
  const g = new THREE.Group();
  const mat = (color: number, roughness = 0.6): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ color, roughness });
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); g.add(m); return m;
  };
  const ellipsoid = (material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number): THREE.Mesh => {
    const m = add(new THREE.SphereGeometry(1, 16, 10), material, x, y, z); m.scale.set(sx, sy, sz); return m;
  };
  const twig = (a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material): void => {
    const d = b.clone().sub(a); const m = add(new THREE.CylinderGeometry(radius * 0.7, radius, d.length(), 7), material, 0, 0, 0);
    m.position.copy(a.clone().add(b).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  };
  if (kind === 'rubber-duck') {
    const yellow = mat(0xffd21c, 0.28); const orange = mat(0xff7c12, 0.35); const black = mat(0x101010);
    ellipsoid(yellow, 0, 0.1, 0, 0.24, 0.15, 0.16);
    ellipsoid(yellow, 0.13, 0.3, 0, 0.12, 0.12, 0.105);
    ellipsoid(orange, 0.245, 0.285, 0, 0.085, 0.027, 0.065);
    for (const side of [-1, 1]) {
      ellipsoid(black, 0.175, 0.335, side * 0.09, 0.014, 0.014, 0.008);
      ellipsoid(yellow, -0.025, 0.13, side * 0.15, 0.14, 0.06, 0.035);
    }
    const tail = add(new THREE.ConeGeometry(0.08, 0.15, 10), yellow, -0.2, 0.2, 0); tail.rotation.z = 0.7;
  } else if (kind === 'rowboat') {
    // An open, pointed wooden hull; the seats and oars make its scale legible.
    const wood = mat(0x885032); const rim = mat(0xc29461); const dark = mat(0x452a1c);
    add(new THREE.BoxGeometry(1.9, 0.09, 0.68), dark, 0, 0.02, 0);
    for (const side of [-1, 1]) {
      const wall = add(new THREE.BoxGeometry(2.15, 0.43, 0.065), wood, 0, 0.23, side * 0.43); wall.rotation.x = side * 0.23;
      add(new THREE.BoxGeometry(2.2, 0.065, 0.1), rim, 0, 0.46, side * 0.48);
      for (const end of [-1, 1]) {
        const bow = add(new THREE.BoxGeometry(0.62, 0.43, 0.065), wood, end * 1.2, 0.23, side * 0.25);
        bow.rotation.y = end * side * 0.72;
      }
    }
    for (const x of [-0.6, 0.45]) add(new THREE.BoxGeometry(0.2, 0.075, 0.87), rim, x, 0.35, 0);
    for (const side of [-1, 1]) {
      twig(new THREE.Vector3(-0.4, 0.47, side * 0.1), new THREE.Vector3(0.65, 0.48, side * 1.1), 0.025, rim);
      const blade = add(new THREE.BoxGeometry(0.28, 0.035, 0.12), wood, 0.64, 0.48, side * 1.05); blade.rotation.y = side * -0.65;
    }
  } else if (kind === 'stick' || kind === 'branch') {
    const wood = mat(0x654831); const length = kind === 'branch' ? 1.4 : 0.65; const radius = kind === 'branch' ? 0.065 : 0.04;
    twig(new THREE.Vector3(-length / 2, radius, 0), new THREE.Vector3(length / 2, radius + 0.035, 0.03), radius, wood);
    if (kind === 'branch') for (const side of [-1, 1]) {
      twig(new THREE.Vector3(-0.25 * side, 0.08, 0), new THREE.Vector3(0.3 * side, 0.12, side * 0.43), 0.032, wood);
      twig(new THREE.Vector3(0.23 * side, 0.12, side * 0.37), new THREE.Vector3(0.44 * side, 0.16, side * 0.55), 0.016, wood);
    }
  } else if (kind === 'leaves') {
    const shape = new THREE.Shape(); shape.moveTo(-0.14, 0); shape.quadraticCurveTo(-0.03, 0.095, 0.14, 0); shape.quadraticCurveTo(-0.03, -0.095, -0.14, 0);
    const colors = [0xcc7c27, 0x9b381b, 0xe5af39, 0x657f35];
    const leafMat = mat(colors[Math.floor(phase) % colors.length]); leafMat.side = THREE.DoubleSide;
    const m = add(new THREE.ShapeGeometry(shape, 8), leafMat, 0, 0.018, 0); m.rotation.x = -Math.PI / 2;
    twig(new THREE.Vector3(-0.17, 0.025, 0), new THREE.Vector3(0.12, 0.025, 0), 0.003, mat(0x4b331a));
  } else {
    const bubble = new THREE.MeshStandardMaterial({ color: 0xf6fcff, roughness: 0.1, transparent: true, opacity: 0.72, depthWrite: false });
    ellipsoid(bubble, 0, 0.022, 0, 0.11, 0.035, 0.11);
    add(new THREE.TorusGeometry(0.11, 0.012, 5, 14), bubble, 0, 0.025, 0).rotation.x = Math.PI / 2;
  }
  return g;
}
function release(g: THREE.Group): void {
  const materials = new Set<THREE.Material>();
  g.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
  for (const m of materials) m.dispose();
}
export class RiverDroppedObjectsView {
  readonly group = new THREE.Group();
  readonly sim: RiverDroppedObjects;
  private readonly meshes = new Map<number, THREE.Group>();
  private clock: number | null = null;
  private time = 0;
  constructor(private readonly data: RiverReachData, private readonly mirror: RiverSurfaceMirror) {
    const d = data.grid;
    this.sim = new RiverDroppedObjects({
      velocity: (x, z, out) => mirror.velocity(x, z, out), depth: (x, z) => mirror.depth(x, z),
      surface: (x, z) => {
        const y = mirror.surfaceAt(x, z, this.time);
        if (Number.isFinite(y)) return y;
        // A draining river strands its objects on the bed rather than
        // leaving them suspended at the last wet waterline.
        const i = Math.max(0, Math.min(d.nx - 1, Math.floor((x - d.x0) / d.dx)));
        const j = Math.max(0, Math.min(d.nz - 1, Math.floor((z - d.z0) / d.dx)));
        return data.ground[j * d.nx + i];
      },
    }, droppedRocks(data), data.seed + 17, { x0: d.x0, z0: d.z0, x1: d.x0 + d.nx * d.dx, z1: d.z0 + d.nz * d.dx });
  }
  drop(kind: RiverDropKind, x: number, z: number): number { return this.sim.drop(kind, x, z); }
  clear(): void { this.sim.clear(); this.update(this.time); }
  refreshRocks(): void { this.sim.setRocks(droppedRocks(this.data)); }
  latest(): DroppedBody | undefined { return this.sim.bodies.at(-1); }
  update(t: number): void {
    this.time = t;
    // A suspended tab never integrates minutes in a single render frame.
    if (this.clock !== null) this.sim.advance(Math.max(0, Math.min(0.2, t - this.clock)));
    this.clock = t;
    const ids = new Set(this.sim.bodies.map((b) => b.id));
    for (const [id, mesh] of this.meshes) if (!ids.has(id)) { this.group.remove(mesh); release(mesh); this.meshes.delete(id); }
    for (const b of this.sim.bodies) {
      let mesh = this.meshes.get(b.id);
      if (!mesh) { mesh = model(b.kind, b.phase); this.meshes.set(b.id, mesh); this.group.add(mesh); }
      mesh.position.set(b.x, b.y, b.z); mesh.rotation.set(0, -b.heading, 0);
      const r = Math.min(0.5, RIVER_DROP_PROFILES[b.kind].radius);
      const front = this.mirror.surfaceAt(b.x + Math.cos(b.heading) * r, b.z + Math.sin(b.heading) * r, t);
      const rear = this.mirror.surfaceAt(b.x - Math.cos(b.heading) * r, b.z - Math.sin(b.heading) * r, t);
      if (Number.isFinite(front + rear)) mesh.rotation.z = Math.atan2(front - rear, 2 * r);
      if (b.kind === 'foam') {
        const pop = Math.max(0, 1 - (b.lifetime - b.age) / 0.25);
        mesh.scale.setScalar(1 + pop * 1.2);
        mesh.traverse((o) => { if (o instanceof THREE.Mesh) (o.material as THREE.MeshStandardMaterial).opacity = 0.72 * (1 - pop); });
      }
    }
  }
  dispose(): void { this.clear(); }
}
