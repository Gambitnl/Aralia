/** A live free-flight comparison in the river's existing renderer.
 * Material below the detached entrance owns its volume and connectivity.
 * This view never injects water into the pool: the existing river arrival
 * model remains unchanged. Consequently this is a development comparison,
 * not an accepted coupled waterfall, crest, breakup or impact simulation.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 09:59:45
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three/webgpu';
import { WaterfallThinDynamics, type ThinSource } from '@/systems/world3d/river/waterfallThinDynamics';
import type { RiverWaterUniforms } from './riverWaterMaterial';
import { createWaterfallFiniteLiquidMaterial } from './waterfallContactView';

const CAPACITY = 20000 * 24;
export class WaterfallThinLiveView {
  readonly mesh: THREE.Mesh;
  private model: WaterfallThinDynamics;
  private origin: number | null = null;
  private previousQ = NaN;
  private time = -1;
  private requestedTime = 0;
  private failure: string | null = null;
  private readonly p = new THREE.BufferAttribute(new Float32Array(CAPACITY * 3), 3).setUsage(THREE.DynamicDrawUsage);
  private readonly n = new THREE.BufferAttribute(new Float32Array(CAPACITY * 3), 3).setUsage(THREE.DynamicDrawUsage);
  private readonly h = new THREE.BufferAttribute(new Float32Array(CAPACITY), 1).setUsage(THREE.DynamicDrawUsage);
  private readonly material: THREE.NodeMaterial;
  private readonly source: ThinSource;
  readonly entranceDelay: number;
  constructor(private readonly crest: { x: number; z: number; tx: number; tz: number },
    U: RiverWaterUniforms, top: number, private readonly bottom: number, width: number, depth: number, speed: number) {
    // Keep the reduced sheet away from the thick crest. The upstream two-meter
    // ballistic entrance is an explicit approximation, not a pressure solve.
    this.entranceDelay = Math.sqrt(4 / 9.81);
    this.source = { q: 0, width, depth, speed, top: top - 2, verticalSpeed: -9.81 * this.entranceDelay, turbulence: 0 };
    this.model = new WaterfallThinDynamics({ dt: .01, emissionStep: .04, across: 8, mode: 'fixed-air',
      crest: top - 2, pool: bottom, rupture: false, conservativeAdmission: true });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.p); geometry.setAttribute('normal', this.n); geometry.setAttribute('liquidDiameter', this.h);
    geometry.setDrawRange(0, 0);
    this.material = createWaterfallFiniteLiquidMaterial(U);
    this.material.name = 'live material free-flight comparison';
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 10;
  }
  update(physicalTime: number, q: number) {
    if (this.failure) return;
    this.origin ??= physicalTime;
    const target = physicalTime - this.origin;
    this.requestedTime = target;
    try {
      if (target < this.time - 1e-9) throw Error('Physical clock rewound; restart the comparison');
      if (q !== this.previousQ) {
        // Source changes reach this detached plane after the upstream travel
        // delay. Existing rows remain material; shutdown creates no new bridge.
        const speed = q / (this.source.width * this.source.depth);
        this.model.recordSource(target + this.entranceDelay, { ...this.source, q, speed, forward: speed * this.entranceDelay });
        this.previousQ = q;
      }
      if (target <= this.time + 1e-9) return;
      // A delayed snapshot is not permission to skip physical steps, nor a
      // reason to block the UI with an unbounded catch-up loop. Retain backlog
      // and report it; this CPU comparison has no real-time acceptance.
      this.model.advanceTo(Math.min(target, Math.max(0, this.time) + .05));
      this.time = this.model.receipt().time;
      const snapshot = this.model.snapshot();
      const vertices = new Map(snapshot.vertices.map(v => [v.id, v]));
      const offsets = new Map<number, THREE.Vector3>(), weights = new Map<number, number>();
      const edges = new Map<string, { a: number; b: number; count: number }>();
      const thickness = new Map<number, number>();
      for (const face of snapshot.patches) {
        for (let k = 0; k < 3; k++) {
          const id = face.vertices[k], b = face.vertices[(k + 1) % 3];
          const sum = offsets.get(id) ?? new THREE.Vector3();
          sum.addScaledVector(new THREE.Vector3(...face.normal), face.volume);
          offsets.set(id, sum); weights.set(id, (weights.get(id) ?? 0) + face.volume);
          thickness.set(id, (thickness.get(id) ?? 0) + face.volume * face.thickness);
          const key = [Math.min(id, b), Math.max(id, b)].join(':');
          const edge = edges.get(key); if (edge) edge.count++; else edges.set(key, { a: id, b, count: 1 });
        }
      }
      // Share both interfaces at material edges. Drawing a separate closed
      // prism per face creates artificial internal reflecting walls. The
      // smoothed finite extrusion's exact volume is not qualified here.
      for (const [id, normal] of offsets) {
        const depth = thickness.get(id)! / weights.get(id)!;
        if (!(depth > 0) || !Number.isFinite(depth) || normal.lengthSq() < 1e-20) throw Error('Invalid live material geometry');
        thickness.set(id, depth); normal.normalize().multiplyScalar(depth * .5);
      }
      let count = 0;
      const position = (id: number, sign: number) => {
        const local = new THREE.Vector3(...vertices.get(id)!.position).addScaledVector(offsets.get(id)!, sign);
        return new THREE.Vector3(this.crest.x + this.crest.tx * local.x + this.crest.tz * local.z,
          local.y, this.crest.z + this.crest.tz * local.x - this.crest.tx * local.z);
      };
      const triangle = (ids: [number, number, number], signs: [number, number, number]) => {
        if (count + 3 > CAPACITY) throw Error('Live material geometry capacity exceeded');
        const points = ids.map((id, k) => position(id, signs[k]));
        const normal = new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]), points[2].clone().sub(points[0])).normalize();
        for (let k = 0; k < 3; k++, count++) {
          this.p.setXYZ(count, points[k].x, points[k].y, points[k].z); this.n.setXYZ(count, normal.x, normal.y, normal.z); this.h.setX(count, thickness.get(ids[k])!);
        }
      };
      for (const face of snapshot.patches) {
        const [a, b, c] = face.vertices;
        // The crest's forward/across basis reflects local coordinates.
        triangle([a, c, b], [1, 1, 1]); triangle([a, b, c], [-1, -1, -1]);
      }
      for (const edge of edges.values()) if (edge.count === 1) {
        triangle([edge.a, edge.b, edge.a], [1, 1, -1]); triangle([edge.a, edge.b, edge.b], [-1, 1, -1]);
      }
      this.mesh.geometry.setDrawRange(0, count);
      for (const attr of [this.p, this.n, this.h]) {
        attr.clearUpdateRanges(); if (count) attr.addUpdateRange(0, count * attr.itemSize); attr.needsUpdate = true;
      }
    } catch (error) { this.failure = String(error); this.mesh.geometry.setDrawRange(0, 0); }
  }
  receipt() { return { ...this.model.receipt(), failure: this.failure ?? this.model.receipt().failure,
    backlogSeconds: Math.max(0, this.requestedTime - this.model.receipt().time),
    drawnVertices: this.mesh.geometry.drawRange.count, coupledToPool: false,
    limitation: 'Free-flight comparison only; prescribed entrance, approximate extrusion and retirement; no breakup or accepted impact' }; }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.material.dispose(); }
}
