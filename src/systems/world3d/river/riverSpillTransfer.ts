/**
 * Moves native outgoing face water through a pressure-free airborne interval
 * and returns it at swept contact with the current river bed or water surface.
 * This is a reduced hydrostatic boundary, not a 3D pressure or splash solver.
 * HLL's pressure/numerical momentum is a separate boundary reaction; parcels
 * carry their donor's depth-averaged velocity, never momentum-flux / mass-flux.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 16/10/2026, 07:56:21
 * Dependents: components/World3D/water/riverSpillView.ts, systems/world3d/river/riverLive.ts, systems/world3d/river/riverSolver.ts, systems/world3d/river/riverTerrainCourse.ts, systems/world3d/river/riverTerrainRaster.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverSolverGrid } from './riverSolver';
import { riverCellWidth,riverCellX,riverEdgeX } from './riverRectGrid';
import { breakupLengthM, brokenJetCloud, brokenJetDrag } from '../waterfall/waterfallTypes';

export type SpillVec3 = [number, number, number];
export interface RiverSpillFace { from: number; to: number; axis: 'x' | 'z'; }
export interface RiverSpillPacket {
  id: number; faceId: string; from: number; to: number; faceAxis: 'x' | 'z';
  birth: number; releaseDuration: number; volume: number; width: number; depth: number;
  releasePosition: SpillVec3; releaseVelocity: SpillVec3;
  position: SpillVec3; velocity: SpillVec3; age: number;
  /** The age at which the parcel passed its break-up length and became a drop cloud (2026-11-01). */
  breakAge?: number;
  /** Gravity plus air drag at `age`, m/s^2; the view moves the parcel by it between snapshots. */
  acceleration?: SpillVec3;
}

/**
 * THE LIP'S SPAN of one grid face (2026-11-01). A diagonal lip is a stair of
 * x and z faces. The lip's real direction is horizontal and square to the
 * launch flow; the face's span projected on it is its share of the lip's true
 * length, so the unit discharge q = Q / lipWidth. A launch with no
 * horizontal speed keeps the face's own axis. `face` is the face's own
 * across axis in the caller's frame (the solver's or the world's).
 */
export function spillLipSpan(width: number, face: SpillVec3, releaseVelocity: SpillVec3): { across: SpillVec3; lipWidth: number } {
  const [vx, , vz] = releaseVelocity, vh = Math.hypot(vx, vz);
  if (!(vh > .05)) return { across: face, lipWidth: width };
  const sign = -vz * face[0] + vx * face[2] >= 0 ? 1 : -1;
  const across: SpillVec3 = [-vz / vh * sign, 0, vx / vh * sign];
  // The floor keeps a face that the flow runs along from an unbounded q.
  return { across, lipWidth: width * Math.max(.1, Math.abs(face[0] * across[0] + face[2] * across[2])) };
}
export interface RiverSpillReceipt {
  /** Native integration supplies these inventories. Standalone transport
   * leaves them absent rather than inventing a receiving-grid inventory. */
  wetVolume?: number; totalWetPlusAirVolume?: number;
  wetMomentum?: SpillVec3; totalMomentum?: SpillVec3;
  releasedVolume: number; airborneVolume: number; returnedVolume: number;
  releasedMomentum: SpillVec3; airborneMomentum: SpillVec3; returnedMomentum: SpillVec3;
  /** Impulse on transported water from gravity; momentum units are m^4/s. */
  gravityImpulse: SpillVec3;
  /** External reaction on the combined fluid: parcel momentum minus the
   * donor's HLL debit (pressure and numerical boundary closure). */
  pressureBoundaryImpulse: SpillVec3;
  /** Upward reaction removing vertical arrival momentum in depth-averaged SWE. */
  landingReaction: SpillVec3;
  /** Impulse of the air's drag on the broken water (2026-11-01); the air takes this momentum. */
  airDragImpulse: SpillVec3;
  volumeError: number; momentumError: SpillVec3;
}
/** Contact history is for delayed drawing only; these packets no longer own
 * airborne water. Their volume is already included in the receiving grid. */
export interface RiverSpillArrival extends RiverSpillPacket { arrivalTime: number; }
export interface RiverSpillSnapshot {
  time: number; packets: RiverSpillPacket[]; arrived: RiverSpillArrival[]; receipt: RiverSpillReceipt;
  /** Only faces that transferred actual outward water during the latest
   * native step. Submerged/backflow/attached faces retain their native sheet. */
  exposedFaces: RiverSpillFace[];
}
export interface RiverSpillState extends RiverSpillSnapshot { nextId: number; }
const zero = (): SpillVec3 => [0, 0, 0];
const add = (a: SpillVec3, b: SpillVec3, k = 1): void => { for (let i = 0; i < 3; i++) a[i] += b[i] * k; };
const clonePacket = (p: RiverSpillPacket): RiverSpillPacket => ({ ...p, position: [...p.position], velocity: [...p.velocity], releasePosition: [...p.releasePosition], releaseVelocity: [...p.releaseVelocity],
  ...(p.acceleration ? { acceleration: [...p.acceleration] as SpillVec3 } : {}) });

export class RiverSpillTransfer {
  private faces = new Map<string, RiverSpillFace>();
  private exposedFaces = new Map<string, RiverSpillFace>();
  private packets: RiverSpillPacket[] = [];
  private nextId = 1;
  private time = 0;
  private arrived: RiverSpillArrival[] = [];
  private releasedVolume = 0; private returnedVolume = 0;
  private releasedMomentum = zero(); private returnedMomentum = zero();
  private gravityImpulse = zero(); private pressureBoundaryImpulse = zero(); private landingReaction = zero();
  private airDragImpulse = zero();
  /**
   * AIR DRAG ON BROKEN WATER (2026-11-01, GG-572). Past its break-up length
   * (breakupLengthM) a parcel is a cloud of drops, and the air drags it
   * (brokenJetCloud, brokenJetDrag: the ocean splash's drop laws). Before
   * break-up the flight is the free parabola, as it was. Off keeps every
   * parcel on the free parabola (for a comparison only).
   */
  readonly airDrag: boolean;
  /**
   * DETECTED LIPS (2026-10-21). With `detect`, no face list chooses where water
   * leaves the ground. Every native face is tested each step against the free
   * flight of its own donor water (see `separates`). The face list is then
   * unused. Without `detect` the listed faces keep their earlier contract.
   */
  readonly detect: boolean;
  constructor(readonly grid: RiverSolverGrid, faces: readonly RiverSpillFace[], readonly gravity = 9.81, options: { detect?: boolean; airDrag?: boolean } = {}) {
    if (!Number.isFinite(gravity) || gravity < 0) throw Error('Invalid spill gravity');
    this.detect = options.detect ?? false;
    this.airDrag = options.airDrag ?? true;
    this.setFaces(faces);
  }
  /** Editing changes future departures only; existing water keeps its history. */
  setFaces(faces: readonly RiverSpillFace[]): void {
    const next = new Map<string, RiverSpillFace>();
    for (const f of faces) {
      const delta = f.to - f.from;
      if (!Number.isInteger(f.from) || !Number.isInteger(f.to) || f.from < 0 || f.to < 0
        || f.from >= this.grid.nx * this.grid.nz || f.to >= this.grid.nx * this.grid.nz
        || Math.abs(delta) !== (f.axis === 'x' ? 1 : this.grid.nx)
        || (f.axis === 'x' && Math.floor(f.from / this.grid.nx) !== Math.floor(f.to / this.grid.nx))
        || next.has(`${Math.min(f.from, f.to)}:${Math.max(f.from, f.to)}`)) throw Error('Invalid or duplicate spill face');
      // A diagonal cut has two distinct outward faces from one donor. Both
      // carry native HLL flux; selecting only the steeper one leaked the
      // other flux back into a terrain-following curtain.
      next.set(`${Math.min(f.from, f.to)}:${Math.max(f.from, f.to)}`, { ...f });
    }
    this.faces = next;
  }
  beginStep(): void { this.exposedFaces.clear(); }
  /** Check the current air inventory without cloning its full display history.
   * The terrain test calls this after every accepted step. It must still stop
   * on escaped water; a safety query does not need thousands of copied packet
   * positions, velocities and arrival records just to answer that question. */
  hasAirborneOutsideGrid(): boolean {
    const g=this.grid;
    return this.packets.some(p=>p.position[0]<g.x0||p.position[0]>=riverEdgeX(g,g.nx)
      ||p.position[2]<g.z0||p.position[2]>=g.z0+g.nz*g.dx);
  }
  /** Called only with the native reconstructed face flux. An exposed falling
   * face removes exactly that outgoing volume; all other faces remain HLL. */
  launch(cL: number, cR: number, axis: 'x' | 'z', massFlux: number, normalFlux: number, tangentFlux: number,
    h: Float64Array, bed: Float64Array, u: Float64Array, v: Float64Array, time: number, dt: number): number {
    let face: RiverSpillFace | undefined, sign: number, slope = 0;
    if (this.detect) {
      // The donor is the side the native mass flux leaves. A cheap bed test
      // rejects almost every face before any flight arithmetic.
      if (!(massFlux !== 0)) return 0;
      sign = massFlux > 0 ? 1 : -1;
      const from = sign > 0 ? cL : cR, to = sign > 0 ? cR : cL;
      if (!(bed[from] - bed[to] > h[from])) return 0;
      slope = this.separates(from, to, axis, h, bed, u, v);
      if (Number.isNaN(slope)) return 0;
      face = { from, to, axis };
    } else {
      face = this.faces.get(`${cL}:${cR}`);
      if (!face || face.axis !== axis) return 0;
      sign = face.from === cL ? 1 : -1;
    }
    const c = face.from, to = face.to;
    const normalSpeed = sign * (axis === 'x' ? u[c] : v[c]);
    // Flooded lips and backflow remain ordinary pressure-coupled SWE. A small
    // positive current may detach but lands promptly on the nearby runoff.
    // The 0.35 m floor belongs to the listed faces; detected faces passed the
    // flight test above, which already demands more than the flow depth.
    if (h[c] <= 1e-4 || normalSpeed <= 0 || sign * massFlux <= 0
      || (!this.detect && bed[c] - bed[to] < 0.35) || bed[to] + h[to] >= bed[c] - 1e-6) return 0;
    return this.release(c, to, axis, sign, massFlux, normalFlux, tangentFlux, h[c], u[c], v[c], slope, bed[c], time, dt);
  }
  /**
   * RELEASE ONE LAUNCHED FACE (2026-10-21, GG-429): the part of `launch` after
   * its tests, unchanged. The GPU resident path runs those tests on the device
   * and replays its launches here, step by step (beginStep, this step's
   * releases, advance). `depth`, `uFrom`, `vFrom` and `bedFrom` are the
   * donor's depth, velocity and bed at the step start; `slope` is the result
   * of `separates` (0 for a listed face). Returns `sign`.
   */
  release(c: number, to: number, axis: 'x' | 'z', sign: number, massFlux: number, normalFlux: number, tangentFlux: number,
    depth: number, uFrom: number, vFrom: number, slope: number, bedFrom: number, time: number, dt: number): number {
    const face: RiverSpillFace = { from: c, to, axis };
    const normalSpeed = sign * (axis === 'x' ? uFrom : vFrom);
    const i = c % this.grid.nx, j = Math.floor(c / this.grid.nx);
    const faceWidth=axis==='x'?this.grid.dx:riverCellWidth(this.grid,i);
    const volume = sign * massFlux * faceWidth * dt;
    const position: SpillVec3 = [riverCellX(this.grid,i),
      bedFrom + depth * .5, this.grid.z0 + (j + .5) * this.grid.dx];
    if(axis==='x'&&this.grid.xEdges)position[0]=riverEdgeX(this.grid,i+(sign>0?1:0))+sign*this.grid.dx*.000001;
    else position[axis === 'x' ? 0 : 2] += sign * this.grid.dx * .500001;
    // A detected donor that already slides down a slope leaves along that
    // slope. The depth-averaged solver has no vertical velocity, and on a steep
    // bed its speed is the speed ALONG the bed: the normal speed un turns down
    // the slope (angle θ, tan θ = slope) and keeps its size, un·cos θ across
    // and −un·sin θ down; the speed along the lip does not change. The
    // kinematic reading w = u·tan θ was tried first: on the Seven Sisters face
    // (slope ≈ 8) it gave −374 m/s, five times the free-fall speed of the
    // whole 250 m drop. Turning the speed keeps the solver's kinetic energy.
    const cosT = 1 / Math.sqrt(1 + slope * slope), w0 = slope > 0 ? -normalSpeed * slope * cosT : 0;
    const velocity: SpillVec3 = axis === 'x' ? [uFrom * cosT, w0, vFrom] : [uFrom, w0, vFrom * cosT];
    const faceId = `${c}:${to}`;
    const open = this.detect ? this.open.get(faceId) : undefined;
    // A parcel that is already a drop cloud no longer moves on the free
    // parabola that merge() restarts it on, so it takes no more water.
    if (open && open.packet.breakAge === undefined && time + dt - open.start <= RiverSpillTransfer.mergeWindowS) {
      this.merge(open.packet, volume, position, velocity, time, dt, depth);
    } else {
      const packet: RiverSpillPacket = { id: this.nextId++, faceId, from: c, to,
        faceAxis: axis, birth: time + dt * .5, releaseDuration: dt, volume, width: faceWidth, depth,
        releasePosition: [...position], releaseVelocity: [...velocity], position, velocity, age: 0 };
      this.packets.push(packet);
      if (this.detect) this.open.set(faceId, { packet, start: time });
    }
    this.releasedVolume += volume;
    this.exposedFaces.set(faceId, { ...face });
    add(this.releasedMomentum, velocity, volume);
    const removed: SpillVec3 = axis === 'x' ? [sign * normalFlux, 0, sign * tangentFlux] : [sign * tangentFlux, 0, sign * normalFlux];
    add(this.pressureBoundaryImpulse, removed, -faceWidth * dt);
    add(this.pressureBoundaryImpulse, velocity, volume);
    return sign;
  }
  /**
   * MERGED RELEASES (detected lips only). A lip emits one parcel per solver
   * step, and at a fast fall the step is a few milliseconds: a Top up on the
   * seven-falls course launched 82,000 parcels in 0.3 s of flow. The releases
   * of one face over at most `mergeWindowS` go into one parcel instead:
   *  - volume adds, and velocity, birth and release point are volume means,
   *    so the released volume and momentum are exact;
   *  - the parcel's age and place restart from the new birth, and the
   *    gravity impulse takes the change, so the ledger still closes to
   *    rounding (airborne + returned − released − gravity − landing = 0).
   * The cost: a release moves in time by at most half the window (0.05 s).
   */
  static readonly mergeWindowS = 0.1;
  private open = new Map<string, { packet: RiverSpillPacket; start: number }>();
  private merge(p: RiverSpillPacket, volume: number, position: SpillVec3, velocity: SpillVec3, time: number, dt: number, depth: number): void {
    const V1 = p.volume, V = V1 + volume, a1 = p.age, k = volume / V;
    for (let i = 0; i < 3; i++) {
      p.releaseVelocity[i] += (velocity[i] - p.releaseVelocity[i]) * k;
      p.releasePosition[i] += (position[i] - p.releasePosition[i]) * k;
    }
    p.birth += (time + dt * .5 - p.birth) * k;
    p.releaseDuration += dt; p.volume = V; p.depth = depth;
    const a = Math.max(0, time - p.birth);
    p.age = a;
    p.position = [p.releasePosition[0] + p.releaseVelocity[0] * a,
      p.releasePosition[1] + p.releaseVelocity[1] * a - .5 * this.gravity * a * a, p.releasePosition[2] + p.releaseVelocity[2] * a];
    p.velocity = [p.releaseVelocity[0], p.releaseVelocity[1] - this.gravity * a, p.releaseVelocity[2]];
    this.gravityImpulse[1] -= this.gravity * (V * a - V1 * a1);
  }
  /**
   * THE SEPARATION TEST of a detected lip. Read the bed as straight between
   * cell centers. The donor water moves toward the face at its normal speed
   * un along the bed slope S that it came down (from the cell behind it, only
   * when that cell is wet; else S = 0). Across the cell gap d it then moves
   * at un·cos θ and falls at un·sin θ (tan θ = S). In the time τ = d / (un·cos θ)
   * to the next center, a free jet falls S·d + ½·g·τ². The water leaves the
   * ground when the bed falls further than that: the bed curves away faster
   * than gravity can bend the flow (on a rim of radius R, u²/R > g). On a
   * straight slope the two falls differ by ½·g·τ² only, so water stays on it,
   * as on a real spillway face. Returns S (≥ 0), or NaN when the water stays
   * on the bed. No list and no course address takes part.
   */
  private separates(c: number, to: number, axis: 'x' | 'z', h: Float64Array, bed: Float64Array, u: Float64Array, v: Float64Array): number {
    const g = this.grid, step = to - c, i = c % g.nx;
    const un = (step > 0 ? 1 : -1) * (axis === 'x' ? u[c] : v[c]);
    if (!(un > 0)) return Number.NaN;
    const iTo = to % g.nx;
    const d = axis === 'x' ? Math.abs(riverCellX(g, iTo) - riverCellX(g, i)) : g.dx;
    // The cell behind the donor on the same line, when it exists.
    const back = c - step, iBack = back % g.nx;
    const inside = back >= 0 && back < g.nx * g.nz && (axis === 'z' || Math.floor(back / g.nx) === Math.floor(c / g.nx));
    let slope = 0;
    if (inside && h[back] > 1e-4 && bed[back] > bed[c]) {
      const dBack = axis === 'x' ? Math.abs(riverCellX(g, i) - riverCellX(g, iBack)) : g.dx;
      slope = (bed[back] - bed[c]) / dBack;
    }
    const tau = d * Math.sqrt(1 + slope * slope) / un;
    const fall = slope * d + .5 * this.gravity * tau * tau;
    return bed[c] - bed[to] > fall ? slope : Number.NaN;
  }
  /** Gravity, and air drag past break-up, plus a short swept search against
   * the live finite-volume surface. Contact time is retained exactly within
   * the SWE step; its grid credit occurs at that step's end, never before
   * contact.
   * THE FLIGHT IN SUBSTEPS (2026-11-01, GG-572). The flight moves in
   * substeps of at most 0.01 s or a fifth of a cell (the old sampling). Each
   * substep holds the acceleration of its start (gravity, plus the air's drag
   * once the parcel has broken up) and moves on that exact parabola, so a
   * parcel with no drag follows the same free parabola as before. Bisection
   * finds the first crossing inside the substep that crosses. */
  advance(end: number, surface: (x: number, z: number) => { cell: number; level: number } | null,
    deposit: (cell: number, volume: number, velocity: SpillVec3) => void): void {
    if (!Number.isFinite(end) || end < this.time) throw Error('Spill transport cannot reverse its owned history');
    const remaining: RiverSpillPacket[] = [];
    for (const p of this.packets) {
      const endAge = Math.max(0, end - p.birth), startAge = p.age;
      const breakM = breakupLengthM(Math.max(.05, Math.hypot(...p.releaseVelocity)), Math.max(.005, p.depth));
      const q = p.volume / (spillLipSpan(p.width, p.faceAxis === 'x' ? [0, 0, 1] : [-1, 0, 0], p.releaseVelocity).lipWidth * p.releaseDuration);
      const along = (x: SpillVec3) => Math.hypot(x[0] - p.releasePosition[0], x[1] - p.releasePosition[1], x[2] - p.releasePosition[2]);
      // Gravity, plus the drag on the drop cloud past break-up. The first
      // substep that starts past L_b records the parcel's break-up age.
      const accelAt = (x: SpillVec3, u: SpillVec3, age: number): SpillVec3 => {
        if (!this.airDrag) return [0, -this.gravity, 0];
        const s = along(x);
        if (p.breakAge === undefined) { if (s < breakM) return [0, -this.gravity, 0]; p.breakAge = age; }
        const d = brokenJetDrag(u, brokenJetCloud(s - breakM, age - p.breakAge, Math.hypot(...u), q));
        return [d[0], d[1] - this.gravity, d[2]];
      };
      let pos: SpillVec3 = [...p.position], vel: SpillVec3 = [...p.velocity], age = startAge;
      const sample = (s: number, a: SpillVec3) => {
        const x: SpillVec3 = [pos[0] + vel[0] * s + .5 * a[0] * s * s, pos[1] + vel[1] * s + .5 * a[1] * s * s, pos[2] + vel[2] * s + .5 * a[2] * s * s];
        const hit = surface(x[0], x[2]);
        return { pos: x, hit, d: hit ? x[1] - hit.level : Infinity };
      };
      const dragOf = (a: SpillVec3): SpillVec3 => [a[0], a[1] + this.gravity, a[2]];
      // Substeps span at most a fifth of a cell or 0.01 s. This also catches
      // a raised/edited bed.
      const count = Math.max(1, Math.ceil((endAge - startAge) / .01),
        Math.ceil(Math.hypot(p.velocity[0], p.velocity[2]) * (endAge - startAge) / (this.grid.dx * .2)));
      const step = (endAge - startAge) / count;
      let contact: ReturnType<typeof sample> | null = null, contactAge = endAge, contactVelocity: SpillVec3 = vel;
      const first = sample(0, [0, 0, 0]);
      if (first.d <= 0) { contact = first; contactAge = startAge; contactVelocity = [...vel]; }
      else for (let k = 0; k < count; k++) {
        const a = accelAt(pos, vel, age), next = sample(step, a);
        if (next.d <= 0) {
          let lo = 0, hi = step;
          for (let n = 0; n < 32; n++) { const mid = (lo + hi) * .5; if (sample(mid, a).d <= 0) hi = mid; else lo = mid; }
          let s = hi; contact = sample(hi, a);
          // A WALL HIT (2026-10-24). A parcel that crosses sideways into a
          // cell whose surface stands above the parcel has struck the side of
          // a step, not its top. Lips that step down across the grid (the
          // Latefossen staircase) made this common: the parcel landed on top
          // of the higher cell, 9 m above itself, so water climbed a wall.
          // It falls down the wall instead: it lands in the cell it was over
          // just before the wall, at that cell's own surface.
          const before = sample(lo, a);
          if (before.hit && contact.hit && before.hit.cell !== contact.hit.cell && contact.hit.level > before.pos[1]) {
            s = lo; contact = before;
          }
          contactAge = age + s;
          contactVelocity = [vel[0] + a[0] * s, vel[1] + a[1] * s, vel[2] + a[2] * s];
          add(this.airDragImpulse, dragOf(a), p.volume * s);
          break;
        }
        add(this.airDragImpulse, dragOf(a), p.volume * step);
        pos = next.pos; vel = [vel[0] + a[0] * step, vel[1] + a[1] * step, vel[2] + a[2] * step]; age += step;
      }
      const finalAge = contact ? contactAge : endAge;
      add(this.gravityImpulse, [0, -this.gravity, 0], p.volume * (finalAge - startAge));
      if (contact?.hit) {
        const velocity = contactVelocity;
        // SWE retains horizontal momentum; its missing vertical degree of
        // freedom is explicitly absorbed by the bed/water impact reaction.
        deposit(contact.hit.cell, p.volume, [velocity[0], 0, velocity[2]]);
        this.returnedVolume += p.volume; add(this.returnedMomentum, [velocity[0], 0, velocity[2]], p.volume);
        this.landingReaction[1] -= p.volume * velocity[1];
        const position = [...contact.pos] as SpillVec3; position[1] = contact.hit.level;
        this.arrived.push({ ...clonePacket(p), position, velocity, age: contactAge, arrivalTime: p.birth + contactAge });
        if (this.open.get(p.faceId)?.packet === p) this.open.delete(p.faceId);
      } else {
        p.position = pos; p.velocity = vel; p.age = endAge;
        p.acceleration = accelAt(pos, vel, endAge);
        remaining.push(p);
      }
    }
    this.packets = remaining;
    this.time = end;
    // Two seconds covers the ordinary quarter-second worker cadence. This
    // history is bounded independently of material ownership and its ledger.
    this.arrived = this.arrived.filter(p => p.arrivalTime >= end - 2).slice(-4096);
  }
  receipt(wet?: { volume: number; momentum: SpillVec3 }): RiverSpillReceipt {
    const airborneVolume = this.packets.reduce((s, p) => s + p.volume, 0), airborneMomentum = zero();
    for (const p of this.packets) add(airborneMomentum, p.velocity, p.volume);
    const momentumError = airborneMomentum.map((p, i) => p + this.returnedMomentum[i] - this.releasedMomentum[i] - this.gravityImpulse[i] - this.landingReaction[i] - this.airDragImpulse[i]) as SpillVec3;
    return { ...(wet ? { wetVolume: wet.volume, totalWetPlusAirVolume: wet.volume + airborneVolume,
      wetMomentum: [...wet.momentum] as SpillVec3, totalMomentum: wet.momentum.map((p, i) => p + airborneMomentum[i]) as SpillVec3 } : {}),
      releasedVolume: this.releasedVolume, airborneVolume, returnedVolume: this.returnedVolume,
      releasedMomentum: [...this.releasedMomentum], airborneMomentum, returnedMomentum: [...this.returnedMomentum],
      gravityImpulse: [...this.gravityImpulse], pressureBoundaryImpulse: [...this.pressureBoundaryImpulse], landingReaction: [...this.landingReaction], airDragImpulse: [...this.airDragImpulse],
      volumeError: airborneVolume + this.returnedVolume - this.releasedVolume, momentumError };
  }
  snapshot(wet?: { volume: number; momentum: SpillVec3 }): RiverSpillSnapshot { return { time: this.time, packets: this.packets.map(clonePacket), arrived: this.arrived.map(p => ({ ...clonePacket(p), arrivalTime: p.arrivalTime })), exposedFaces: [...this.exposedFaces.values()].map(f => ({ ...f })), receipt: this.receipt(wet) }; }
  saveState(): RiverSpillState { return { ...this.snapshot(), nextId: this.nextId }; }
  restoreState(state: RiverSpillState): void {
    this.packets = state.packets.map(clonePacket); this.nextId = state.nextId; this.time = state.time;
    this.arrived = state.arrived.map(p => ({ ...clonePacket(p), arrivalTime: p.arrivalTime }));
    this.exposedFaces = new Map(state.exposedFaces.map(f => [`${f.from}:${f.to}`, { ...f }]));
    this.releasedVolume = state.receipt.releasedVolume; this.returnedVolume = state.receipt.returnedVolume;
    for (const key of ['releasedMomentum', 'returnedMomentum', 'gravityImpulse', 'pressureBoundaryImpulse', 'landingReaction'] as const) this[key] = [...state.receipt[key]];
    // A state saved before the drag (2026-11-01) has no drag impulse yet.
    this.airDragImpulse = [...(state.receipt.airDragImpulse ?? zero())];
    // The open merge windows are not saved. Each face's newest parcel opens
    // again, from the start of its release span (exact for an unmerged one).
    this.open.clear();
    if (this.detect) for (const p of this.packets) {
      const o = this.open.get(p.faceId);
      if (!o || o.packet.id < p.id) this.open.set(p.faceId, { packet: p, start: p.birth - p.releaseDuration * .5 });
    }
  }
  /** Explicit cold initialization resets both owners; edits never call this. */
  reset(time: number): void {
    this.packets = []; this.arrived = []; this.exposedFaces.clear(); this.open.clear(); this.nextId = 1; this.time = time;
    this.releasedVolume = 0; this.returnedVolume = 0;
    this.releasedMomentum = zero(); this.returnedMomentum = zero(); this.gravityImpulse = zero(); this.pressureBoundaryImpulse = zero(); this.landingReaction = zero(); this.airDragImpulse = zero();
  }
}
