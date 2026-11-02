/**
 * THE RIVER'S FOOTPRINT CUT (ADR 0009 step 6, slice 10, 2026-10-26).
 *
 * When the live river runs in the game world, the river draws its own bed
 * mesh in its footprint (the solver grid, a turned rectangle), and the
 * world's terrain and static water must not show there: the terrain would
 * z-fight the bed (both are the same drawn heights) and the static ribbons
 * would float over the live water. So the world's node materials DISCARD
 * their fragments inside the footprint. The bed's heights are the world's
 * own at the footprint edge (the same lattice triangles, `riverWorldBed.ts`),
 * so the hole has no gap and no cliff: the bed continues the ground.
 *
 * One cut for the whole world, as module uniforms: the site sets it, every
 * terrain and static-water material reads it. Off (the default) the branch
 * never fires and the materials draw as before.
 */
import { DataTexture, FloatType, NearestFilter, RedFormat, Vector2 } from 'three';
import { Discard, If, abs, clamp, positionWorld, texture, uniform, vec2 } from 'three/tsl';
import { corridorCenterAt } from '@/systems/world3d/river/riverWorldBed';
import type { TslNode } from '@/types/tslNode';

/* TSL node graphs chain operators that @types/three 0.172 does not model. */
type N = TslNode; // Shared TSL alias (GG-588): see src/types/tslNode.ts.

/** The footprint: a rectangle in river-local m, placed in the scene by an origin and a turn. */
export interface RiverFootprintCut {
  /** The river's local origin in scene coordinates (x, z). */
  origin: { x: number; z: number };
  /** The bearing of river-local +x in the scene's xz plane, radians. */
  yaw: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /**
   * Optional CORRIDOR along the river's course (agora-257c, 2026-10-28). With
   * it, the swap between the world's ground and the river's bed happens only
   * within `halfM` of the course, not over the whole rectangle: the bed's
   * river-page material (cobbles, gravel, soil, grass by height) had covered a
   * 350 x 140 m tilted rectangle of the town in dark ground with pale blotches.
   * The bed's heights are the world's own, so the swap line has no step.
   * `course` is river-local [x, z] points along the river.
   */
  corridor?: { course: ReadonlyArray<readonly [number, number]>; halfM: number; waterHalfM?: number };
}

const uOn = uniform(0);
const uOrigin = uniform(new Vector2());
/** (cos yaw, sin yaw). */
const uTurn = uniform(new Vector2(1, 0));
const uMin = uniform(new Vector2());
const uMax = uniform(new Vector2());

/** Corridor: on/off, half width (m), and the course's z center per local x. */
const uCorridorOn = uniform(0);
const uCorridorHalf = uniform(0);
/** Half width of the river's water inside the corridor, m (roads stop there). */
const uWaterHalf = uniform(0);
const CORRIDOR_SAMPLES = 512;
const corridorCenter = new DataTexture(new Float32Array(CORRIDOR_SAMPLES), CORRIDOR_SAMPLES, 1, RedFormat, FloatType);
corridorCenter.minFilter = NearestFilter;
corridorCenter.magFilter = NearestFilter;
corridorCenter.needsUpdate = true;

let active: RiverFootprintCut | null = null;

// The corridor's center line moved to riverWorldBed.ts (agora-257c, 2026-10-29):
// the river's bed blends to the drawn ground on the same line the cut uses, so
// both read one function. Re-exported here for the callers that import it here.
export { corridorCenterAt };

/** Set the cut, or clear it with null. */
export function setRiverFootprintCut(cut: RiverFootprintCut | null): void {
  active = cut;
  uOn.value = cut ? 1 : 0;
  uCorridorOn.value = cut?.corridor ? 1 : 0;
  if (!cut) return;
  uOrigin.value.set(cut.origin.x, cut.origin.z);
  uTurn.value.set(Math.cos(cut.yaw), Math.sin(cut.yaw));
  uMin.value.set(Math.min(cut.x0, cut.x1), Math.min(cut.z0, cut.z1));
  uMax.value.set(Math.max(cut.x0, cut.x1), Math.max(cut.z0, cut.z1));
  if (cut.corridor) {
    const data = corridorCenter.image.data as Float32Array;
    const x0 = uMin.value.x;
    const span = uMax.value.x - x0;
    for (let i = 0; i < CORRIDOR_SAMPLES; i++) {
      data[i] = corridorCenterAt(cut.corridor.course, x0 + ((i + 0.5) / CORRIDOR_SAMPLES) * span);
    }
    corridorCenter.needsUpdate = true;
    uCorridorHalf.value = cut.corridor.halfM;
    uWaterHalf.value = cut.corridor.waterHalfM ?? 0;
  }
}

export function getRiverFootprintCut(): RiverFootprintCut | null {
  return active;
}

/** Is a scene point inside the active cut? (CPU twin of the shader test, for tests and probes.) */
export function insideRiverFootprintCut(x: number, z: number, cut: RiverFootprintCut | null = active): boolean {
  if (!cut) return false;
  const c = Math.cos(cut.yaw);
  const s = Math.sin(cut.yaw);
  const dx = x - cut.origin.x;
  const dz = z - cut.origin.z;
  const lx = c * dx + s * dz;
  const lz = -s * dx + c * dz;
  const inside = lx >= Math.min(cut.x0, cut.x1) && lx <= Math.max(cut.x0, cut.x1) && lz >= Math.min(cut.z0, cut.z1) && lz <= Math.max(cut.z0, cut.z1);
  if (!inside || !cut.corridor) return inside;
  return Math.abs(lz - corridorCenterAt(cut.corridor.course, lx)) < cut.corridor.halfM;
}

/**
 * Discard the fragment when its world position lies in the footprint. Call
 * inside a material's color function (a TSL `Fn` body) before the color is
 * returned: the `If` joins that function's statement stack. (Not a `Fn` of
 * its own: a call whose result nothing reads is never built, so its
 * statements would never reach the shader.) The local position is
 * worldToRiverLocal (riverWorldBed.ts): x' = c dx + s dz, z' = -s dx + c dz.
 */
export function riverFootprintDiscard(): void {
  If(uOn.greaterThan(0.5), () => {
    If(riverOwned(), () => { Discard(); });
  });
}

/**
 * Is this fragment's world position the river's: inside the rectangle and, when
 * a corridor is set, within the corridor's half width of the course.
 */
function riverOwned(): N {
  const d: N = (positionWorld as N).xz.sub(uOrigin);
  const lx: N = d.x.mul(uTurn.x).add(d.y.mul(uTurn.y));
  const lz: N = d.x.mul(uTurn.y).negate().add(d.y.mul(uTurn.x));
  const inside: N = lx.greaterThanEqual(uMin.x).and(lx.lessThanEqual(uMax.x)).and(lz.greaterThanEqual(uMin.y)).and(lz.lessThanEqual(uMax.y));
  const u: N = clamp(lx.sub(uMin.x).div(uMax.x.sub(uMin.x)), 0, 1);
  const center: N = texture(corridorCenter, vec2(u, 0.5)).r;
  const inCorridor: N = uCorridorOn.lessThan(0.5).or(abs(lz.sub(center)).lessThan(uCorridorHalf));
  return inside.and(inCorridor);
}

/**
 * Discard a ROAD fragment over the river's water (agora-257c, 2026-10-28): a
 * road ribbon that runs on through the channel drew paving on the river bed
 * under its bridge. The test is narrower than the corridor (the water's half
 * width, `waterHalfM`), so a road still reaches its bridge's ends on the banks.
 * Off unless a corridor with a water half width is set.
 */
export function riverWaterDiscard(): void {
  If(uOn.greaterThan(0.5).and(uCorridorOn.greaterThan(0.5)).and(uWaterHalf.greaterThan(0)), () => {
    const d: N = (positionWorld as N).xz.sub(uOrigin);
    const lx: N = d.x.mul(uTurn.x).add(d.y.mul(uTurn.y));
    const lz: N = d.x.mul(uTurn.y).negate().add(d.y.mul(uTurn.x));
    const inside: N = lx.greaterThanEqual(uMin.x).and(lx.lessThanEqual(uMax.x)).and(lz.greaterThanEqual(uMin.y)).and(lz.lessThanEqual(uMax.y));
    const u: N = clamp(lx.sub(uMin.x).div(uMax.x.sub(uMin.x)), 0, 1);
    const center: N = texture(corridorCenter, vec2(u, 0.5)).r;
    If(inside.and(abs(lz.sub(center)).lessThan(uWaterHalf)), () => { Discard(); });
  });
}

/**
 * The bed's twin of `riverFootprintDiscard`: discard where the WORLD owns the
 * ground (outside the rectangle, or outside the corridor), so the bed draws only
 * where the world's terrain is cut. Off unless a cut is set.
 */
export function riverBedOutsideDiscard(): void {
  If(uOn.greaterThan(0.5), () => {
    If(riverOwned().not(), () => { Discard(); });
  });
}
