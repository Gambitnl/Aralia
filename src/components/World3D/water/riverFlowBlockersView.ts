/** Inspect the bed used by the solver, including submerged boulder barriers.
 * The overlay draws through water and terrain; it does not alter either.
 * Colors show geometry and depth, not a claim that every dry cell is a dam. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/10/2026, 17:10:12
 * Dependents: components/World3D/water/riverReachScene.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import * as THREE from 'three';
import type { RiverReachData } from '@/systems/world3d/river/riverWorker';
import { boulderTopAt, courseKeyAt, defaultRiverCourse, designLevelAt, riverChannelProjection } from '@/systems/world3d/river/riverReach';
import { airborneHeadwater } from '@/systems/world3d/river/riverHeadwaters';
export class RiverFlowBlockersView {
  readonly group = new THREE.Group();
  private stamp = -Infinity;
  constructor(private readonly data: RiverReachData) { this.group.visible = false; }
  private clear(): void {
    const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
    this.group.traverse((o) => { if (o instanceof THREE.LineSegments) { geometries.add(o.geometry); materials.add(o.material as THREE.Material); } });
    for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); this.group.clear();
  }
  dispose(): void { this.clear(); }
  update(t: number): void {
    if (!this.group.visible || t - this.stamp < 1) return;
    this.stamp = t;
    this.clear();
    const { nx, nz, dx, x0, z0 } = this.data.grid; const course = defaultRiverCourse();
    // Reconstruct the solver's exact boulder-height envelope with the same
    // helper it uses. Inspecting ground alone would miss submerged barriers.
    const bed = this.data.ground.slice();
    for (const b of this.data.boulders) if (b.inChannel) {
      const r = Math.max(b.rx, b.rz);
      const i0 = Math.max(0, Math.floor((b.x - r - x0) / dx)); const i1 = Math.min(nx - 1, Math.ceil((b.x + r - x0) / dx));
      const j0 = Math.max(0, Math.floor((b.z - r - z0) / dx)); const j1 = Math.min(nz - 1, Math.ceil((b.z + r - z0) / dx));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const c = j * nx + i; bed[c] = Math.max(bed[c], boulderTopAt(b, x0 + (i + 0.5) * dx, z0 + (j + 0.5) * dx));
      }
    }
    const pos: number[] = []; const color: number[] = [];
    for (let j = 0; j < nz - 4; j += 4) for (let i = 0; i < nx - 4; i += 4) {
      const x = x0 + (i + 0.5) * dx; const z = z0 + (j + 0.5) * dx; const c = j * nx + i;
      const p = riverChannelProjection(course, x, z);
      if (airborneHeadwater(p.s) || Math.abs(p.n) > courseKeyAt(p.s).halfW + 3) continue;
      const height = bed[c]; const depth = this.data.h[c];
      const rgb = height >= designLevelAt(p.s) ? [1, 0.12, 0.08] : depth < 0.08 ? [1, 0.65, 0.05] : [0.1, 0.8, 1];
      const line = (ii: number, jj: number): void => {
        pos.push(x, height + 0.05, z, x0 + (ii + 0.5) * dx, bed[jj * nx + ii] + 0.05, z0 + (jj + 0.5) * dx);
        color.push(...rgb, ...rgb);
      };
      line(i + 4, j); line(i, j + 4);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.65 }));
    lines.renderOrder = 100; this.group.add(lines);
    const unit = new THREE.SphereGeometry(1, 8, 5); const edges = new THREE.WireframeGeometry(unit); unit.dispose();
    const material = new THREE.LineBasicMaterial({ color: 0xff55dd, depthTest: false, depthWrite: false, transparent: true, opacity: 0.8 });
    for (const b of this.data.boulders) if (b.inChannel) {
      const rock = new THREE.LineSegments(edges, material); rock.position.set(b.x, b.y, b.z); rock.scale.set(b.rx, b.ry, b.rz); rock.renderOrder = 101; this.group.add(rock);
    }
  }
}
