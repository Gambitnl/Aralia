/**
 * Objects the user drops into the river. Each body reads the existing water
 * velocity, depth and drawn height; leaves and foam are individual bodies.
 * Draft controls immersion and grounding, while drag controls how quickly
 * the current carries each body. This is a small buoyancy approximation,
 * not a rigid-body fluid solver. Existing paper boats and mallards stay separate.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 04/10/2026, 17:10:12
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx, components/World3D/water/RiverDropMenu.tsx, components/World3D/water/riverDroppedObjectsView.ts, components/World3D/water/riverReachScene.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { RockGrid, wrapAngle, type FloaterRock, type FloaterWaterSampler } from './riverFloaters';
import { mulberry32 } from './riverReach';

export type RiverDropKind = 'rubber-duck' | 'rowboat' | 'stick' | 'branch' | 'leaves' | 'foam';
export interface DropProfile {
  label: string; draft: number; radius: number; height: number; dragS: number;
  count: number; spread: number; flotation: number; description: string;
  /** Lowest drawn hull point below its origin, m; matches riverDroppedObjectsView. */
  hullBelowOrigin?: number;
}
// Flotation is the model's fraction above water, not a measured rating for
// real objects. Draft and response time remain visible in the menu.
export const RIVER_DROP_PROFILES: Record<RiverDropKind, DropProfile> = {
  'rubber-duck': { label: 'Rubber ducky', draft: 0.07, radius: 0.24, height: 0.35, dragS: 0.35, count: 1, spread: 0, flotation: 80, hullBelowOrigin: 0.05, description: 'Light, buoyant; bobs and turns with the current.' },
  rowboat: { label: 'Small rowboat', draft: 0.24, radius: 1.25, height: 0.6, dragS: 1.8, count: 1, spread: 0, flotation: 60, hullBelowOrigin: 0.025, description: 'Heavy response; draws more water and grounds in shallows.' },
  stick: { label: 'Stick', draft: 0.04, radius: 0.35, height: 0.1, dragS: 0.55, count: 1, spread: 0, flotation: 60, description: 'Partly immersed; aligns lengthwise with the flow.' },
  branch: { label: 'Branch', draft: 0.09, radius: 0.75, height: 0.16, dragS: 0.9, count: 1, spread: 0, flotation: 44, description: 'Sits lower and catches against exposed rocks.' },
  leaves: { label: 'Sprinkle leaves', draft: 0.002, radius: 0.1, height: 0.02, dragS: 0.15, count: 24, spread: 2.8, flotation: 90, description: '24 separate leaves; scatter, spin and follow local currents.' },
  foam: { label: 'Foam bubbles', draft: 0.001, radius: 0.13, height: 0.025, dragS: 0.08, count: 32, spread: 1.2, flotation: 96, hullBelowOrigin: 0.013, description: '32 separate bubbles; disperse and pop after 6–18 seconds.' },
};
export interface DropWater extends FloaterWaterSampler { surface(x: number, z: number): number }
/** The drawn rock's full footprint and crest, retained through floods and recession. */
export interface DroppedRock extends FloaterRock { topY?: number }
export interface DroppedBody {
  id: number; kind: RiverDropKind; x: number; z: number; y: number;
  vx: number; vz: number; vy: number; heading: number; phase: number;
  age: number; lifetime: number; grounded: boolean;
}
export class RiverDroppedObjects {
  readonly bodies: DroppedBody[] = [];
  readonly limit = 320;
  private serial = 0;
  private readonly random: () => number;
  private rocks: RockGrid;
  private readonly near: DroppedRock[] = [];
  private readonly velocity: [number, number] = [0, 0];
  constructor(private readonly water: DropWater, rocks: DroppedRock[], seed: number,
    private readonly domain: { x0: number; z0: number; x1: number; z1: number }) {
    this.random = mulberry32(seed); this.rocks = new RockGrid(rocks);
  }
  setRocks(rocks: DroppedRock[]): void { this.rocks = new RockGrid(rocks); }
  clear(): void { this.bodies.length = 0; }
  private inside(x: number, z: number): boolean {
    const d = this.domain;
    return x > d.x0 && x < d.x1 && z > d.z0 && z < d.z1;
  }
  drop(kind: RiverDropKind, x: number, z: number): number {
    const p = RIVER_DROP_PROFILES[kind];
    if (this.bodies.length + p.count > this.limit || !this.inside(x, z) || this.water.depth(x, z) < p.draft + 0.01) return 0;
    let added = 0;
    for (let n = 0; n < p.count; n += 1) {
      let xx = x; let zz = z;
      // Each particle gets its own position. Retry only onto wet ground so
      // a sprinkle at a bank does not silently place half its leaves on land.
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const a = this.random() * Math.PI * 2; const r = Math.sqrt(this.random()) * p.spread;
        const cx = x + Math.cos(a) * r; const cz = z + Math.sin(a) * r;
        if (this.inside(cx, cz) && this.water.depth(cx, cz) > p.draft + 0.01) { xx = cx; zz = cz; break; }
      }
      const h = this.water.surface(xx, zz);
      if (!Number.isFinite(h)) continue;
      this.bodies.push({ id: ++this.serial, kind, x: xx, z: zz, y: h + 0.8 + this.random() * 0.4,
        vx: 0, vz: 0, vy: 0, heading: this.random() * Math.PI * 2, phase: this.random() * 100,
        age: 0, lifetime: kind === 'foam' ? 6 + this.random() * 12 : Infinity, grounded: false });
      added += 1;
    }
    return added;
  }
  advance(seconds: number): void {
    // Small substeps keep a fast current from skipping through a boulder.
    const steps = Math.ceil(Math.max(0, seconds) * 60);
    if (!steps) return;
    const dt = seconds / steps;
    for (let step = 0; step < steps; step += 1) {
      for (let i = this.bodies.length - 1; i >= 0; i -= 1) {
        const b = this.bodies[i]; const p = RIVER_DROP_PROFILES[b.kind];
        b.age += dt;
        if (b.age >= b.lifetime || !this.inside(b.x, b.z)) { this.bodies.splice(i, 1); continue; }
        const surface = this.water.surface(b.x, b.z); const depth = this.water.depth(b.x, b.z);
        if (!Number.isFinite(surface)) { b.grounded = true; continue; }
        const target = surface - Math.min(p.draft, Math.max(0, depth));
        if (b.y > surface + 0.08) { b.vy -= 9.81 * dt; b.y += b.vy * dt; }
        else {
          // A damped buoyancy spring allows the initial splash and wave bob;
          // a boat's larger draft visibly rides lower than leaves or foam.
          b.vy += ((target - b.y) * 45 - b.vy * 11) * dt; b.y += b.vy * dt;
          b.grounded = depth < p.draft + 0.01;
          if (b.grounded) { b.vx *= Math.exp(-8 * dt); b.vz *= Math.exp(-8 * dt); }
          else {
            this.water.velocity(b.x, b.z, this.velocity);
            const wx = this.velocity[0]; const wz = this.velocity[1]; const speed = Math.hypot(wx, wz);
            // Small lightweight bodies respond to unresolved eddies with
            // independent phases, so a batch stretches and disperses.
            const wander = b.kind === 'leaves' || b.kind === 'foam' ? 0.14 * Math.min(3, speed + 0.2) : 0;
            const a = 1 - Math.exp(-dt / p.dragS);
            b.vx += (wx + wander * Math.sin(b.phase + b.age * 1.7) - b.vx) * a;
            b.vz += (wz + wander * Math.cos(b.phase * 1.3 + b.age * 1.2) - b.vz) * a;
            b.heading = wrapAngle(b.heading + wrapAngle(Math.atan2(wz, wx) - b.heading) * dt * Math.min(1, speed)
              + (b.kind === 'leaves' || b.kind === 'foam' ? Math.sin(b.phase + b.age) * dt : 0));
          }
          const x = b.x + b.vx * dt; const z = b.z + b.vz * dt;
          if (this.water.depth(x, z) >= p.draft + 0.01) { b.x = x; b.z = z; }
          else { b.grounded = true; b.vx = 0; b.vz = 0; }
          for (const rock of this.rocks.near(b.x, b.z, p.radius + 1, this.near)) {
            const dx = b.x - rock.x; const dz = b.z - rock.z; const d = Math.hypot(dx, dz); const r = p.radius + rock.r;
            if (d >= r) continue;
            const crest = (rock as DroppedRock).topY;
            // Floodwater releases a body only when its draft AND its rising
            // hull clear the drawn crest. Read the local water every step:
            // recession restores contact, and a deep boat can still catch
            // where a duck or leaf floats across. Heightless legacy circles
            // retain their original permanent-contact behavior.
            const rockSurface = this.water.surface(rock.x, rock.z);
            const hullBelow = p.hullBelowOrigin ?? 0;
            if (crest !== undefined && Math.min(surface, rockSurface) - p.draft - hullBelow >= crest + 0.01 && b.y - hullBelow >= crest + 0.01) continue;
            b.grounded = true;
            const nx = d > 1e-6 ? dx / d : Math.cos(b.phase); const nz = d > 1e-6 ? dz / d : Math.sin(b.phase);
            const rx = rock.x + nx * r; const rz = rock.z + nz * r;
            if (this.water.depth(rx, rz) > p.draft) { b.x = rx; b.z = rz; }
            const inward = Math.min(0, b.vx * nx + b.vz * nz);
            b.vx -= inward * nx; b.vz -= inward * nz;
          }
        }
      }
    }
  }
}
