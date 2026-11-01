/**
 * THE LANDING SPRAY (2026-10-25). Where the river's airborne water lands, it
 * throws coarse splash and a rising mist. The amount comes from the landing
 * energy, by the law the headwaters fall already uses (waterfallTypes.ts
 * mistRatePerS: one mist puff per 25 kW of impact power, a 6 s life, a plume
 * that rises to 0.3 of the drop). Here each landed parcel adds puffs for its
 * own kinetic energy, one puff per 25 kJ, so a fall's spray grows with its
 * flow and its height, and a small spill makes only a few puffs.
 *
 * This is drawing only. The landed water is already in the solver; the puffs
 * carry no mass and never return water to it.
 */

import * as THREE from 'three/webgpu';
import { Fn, attribute, dot, float, max, pow, smoothstep, texture, uv, vec3, vec4 } from 'three/tsl';
import { getRiverNoiseTexture, type RiverWaterUniforms } from './riverWaterMaterial';
import { mistHeightM } from '@/systems/world3d/waterfall/waterfallTypes';

type Vec3 = [number, number, number];
/** One landing of airborne water: where, how fast, how much, from how high. */
export interface SprayLanding { id: number; at: Vec3; velocity: Vec3; volumeM3: number; dropM: number; time: number }

export const LANDING_SPRAY = {
  /** Landing energy per puff, J: the headwaters law's 25 kW per puff over one second. */
  joulesPerPuff: 25_000,
  /** Fine mist life, s (the headwaters law). Coarse splash lives 0.8 to 1.6 s. */
  fineLifeS: 6,
  /** The most puffs alive at once, over the whole course. */
  cap: 4000,
  /** Water density, kg/m^3. */
  rho: 1000,
} as const;

/** A small deterministic random, so the same landings give the same spray. */
function hash(n: number): number {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export class LandingSprayField {
  readonly born = new Float64Array(LANDING_SPRAY.cap);
  readonly life = new Float32Array(LANDING_SPRAY.cap);
  readonly origin = new Float32Array(LANDING_SPRAY.cap * 3);
  /** Per puff: outward x, outward z, drift x, drift z, upward speed, fall back (m/s^2), size seed, coarse (0 or 1). */
  readonly motion = new Float32Array(LANDING_SPRAY.cap * 8);
  /** Number of live slots in use (the ring fills, then the oldest is replaced). */
  count = 0;
  private next = 0;
  private serial = 0;
  private carry = 0;
  private seen = new Map<number, number>();

  /**
   * Add the puffs of new landings. A landing is counted once (by its id);
   * the fraction of a puff left over carries to the next landing.
   * Returns the number of puffs added.
   */
  add(landings: readonly SprayLanding[], now: number): number {
    let added = 0;
    for (const l of landings) {
      if (this.seen.has(l.id)) continue;
      this.seen.set(l.id, l.time);
      const [vx, vy, vz] = l.velocity, speed2 = vx * vx + vy * vy + vz * vz;
      const energyJ = 0.5 * LANDING_SPRAY.rho * Math.max(0, l.volumeM3) * speed2;
      this.carry += energyJ / LANDING_SPRAY.joulesPerPuff;
      const speed = Math.sqrt(speed2), horizontal = Math.hypot(vx, vz) || 1;
      const plumeTop = mistHeightM(Math.max(0, l.dropM));
      while (this.carry >= 1) {
        this.carry -= 1;
        const k = this.next, s = this.serial++;
        this.next = (this.next + 1) % LANDING_SPRAY.cap;
        this.count = Math.min(LANDING_SPRAY.cap, this.count + 1);
        const coarse = s % 3 === 0, lift = hash(s * 4 + 1), size = hash(s * 4 + 2), angle = hash(s * 4 + 3) * Math.PI * 2;
        const life = coarse ? 0.8 + lift * 0.8 : LANDING_SPRAY.fineLifeS * (0.7 + lift * 0.6);
        this.born[k] = l.time + hash(s * 4) * 0.05;
        this.life[k] = life;
        this.origin.set(l.at, k * 3);
        // Coarse splash flies out fast and falls back; fine mist drifts out
        // slowly and rises to the plume top within its life (the headwaters law).
        const outward = (coarse ? 1.4 + size * 3.6 : 0.4 + size * 1.2) * Math.min(1.6, 0.5 + speed / 20);
        const drift = Math.min(2.4, speed * 0.035) * (coarse ? 0.25 : 1);
        const upward = coarse ? Math.min(6, speed * 0.13) * (0.6 + lift * 0.7) : (2 * plumeTop / life) * (0.5 + lift * 0.8);
        const m = k * 8;
        this.motion[m] = Math.cos(angle) * outward; this.motion[m + 1] = Math.sin(angle) * outward;
        this.motion[m + 2] = (vx / horizontal) * drift; this.motion[m + 3] = (vz / horizontal) * drift;
        this.motion[m + 4] = upward; this.motion[m + 5] = coarse ? 4.905 : 0.35;
        this.motion[m + 6] = size; this.motion[m + 7] = coarse ? 1 : 0;
        added++;
      }
    }
    // Forget landings older than the snapshot history the view can still see.
    for (const [id, t] of this.seen) if (now - t > 5) this.seen.delete(id);
    return added;
  }

  /** A puff's place, size (m) and opacity share at time t; null when not alive. */
  puffAt(k: number, t: number, out: Vec3): { size: number; alpha: number } | null {
    const age = t - this.born[k], life = this.life[k];
    if (!(age >= 0 && age < life)) return null;
    const m = k * 8, coarse = this.motion[m + 7] > 0;
    out[0] = this.origin[k * 3] + (this.motion[m] + this.motion[m + 2]) * age;
    out[2] = this.origin[k * 3 + 2] + (this.motion[m + 1] + this.motion[m + 3]) * age;
    out[1] = this.origin[k * 3 + 1] + 0.08 + Math.max(0, this.motion[m + 4] * age - this.motion[m + 5] * age * age);
    const u = age / life;
    // A fine veil 0.5 m across at birth spreads to about 4.5 m; splash stays small.
    const size = coarse ? 0.25 + 0.3 * this.motion[m + 6] : 0.5 + 4 * u;
    const alpha = Math.min(1, u * 8) * (1 - u);
    return { size, alpha };
  }
}

/** The headwaters fall's mist look: a soft noisy disk tinted by the sky. */
export function landingSprayMaterial(U: RiverWaterUniforms): THREE.NodeMaterial {
  const material = new THREE.NodeMaterial();
  const noise = texture(getRiverNoiseTexture());
  material.fragmentNode = Fn(() => {
    const p = uv().sub(0.5).mul(2);
    const edge = pow(max(0, float(1).sub(dot(p, p))), 2);
    const cloud = noise.sample(uv().mul(0.18).add(U.uTime.mul(0.013))).b;
    return vec4(U.uSkyHorizon.mul(vec3(0.84, 0.87, 0.86)).mul(U.uSkyGain), edge.mul(smoothstep(0.2, 0.8, cloud)).mul(attribute('mistLife', 'float')).mul(0.045));
  })();
  material.transparent = true; material.depthWrite = false; material.side = THREE.DoubleSide;
  material.name = 'river landing spray';
  return material;
}

/** Draws the field as camera-facing quads. Returns the live puff count. */
export class LandingSprayView {
  readonly mesh: THREE.InstancedMesh;
  private readonly lifeAttr: THREE.InstancedBufferAttribute;
  private readonly m = new THREE.Matrix4();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly at: Vec3 = [0, 0, 0];
  constructor(uniforms: RiverWaterUniforms, readonly field = new LandingSprayField()) {
    // THE INSTANCE COUNT (2026-10-27). three r172 reads the matrices from a
    // uniform array, sized by the whole matrix array, when the mesh's count
    // is 1,000 or less at its first build. At count 0 and 4,000 slots that is
    // 256,000 bytes, over the 65,536-byte limit: the bind group failed, the
    // spray did not draw, and the shared device's error stopped the resident
    // GPU solver. Keep count at the capacity (the attribute path) and draw
    // the live puffs through the geometry's instanceCount.
    const geometry = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1) as unknown as THREE.InstancedBufferGeometry);
    geometry.instanceCount = 0;
    this.lifeAttr = new THREE.InstancedBufferAttribute(new Float32Array(LANDING_SPRAY.cap), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('mistLife', this.lifeAttr);
    this.mesh = new THREE.InstancedMesh(geometry, landingSprayMaterial(uniforms), LANDING_SPRAY.cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 12;
    this.mesh.name = 'Airborne spill landing spray';
  }
  draw(t: number, camera: THREE.Camera | null): number {
    let n = 0;
    const q = camera ? camera.quaternion : new THREE.Quaternion();
    for (let k = 0; k < this.field.count; k++) {
      const puff = this.field.puffAt(k, t, this.at);
      if (!puff) continue;
      this.m.compose(this.p.set(...this.at), q, this.s.set(puff.size, puff.size, puff.size));
      this.mesh.setMatrixAt(n, this.m);
      this.lifeAttr.setX(n, puff.alpha);
      n++;
    }
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n;
    if (n) { this.mesh.instanceMatrix.needsUpdate = true; this.lifeAttr.needsUpdate = true; }
    this.mesh.visible = n > 0;
    return n;
  }
  dispose(): void { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}
