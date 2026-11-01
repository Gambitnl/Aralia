/**
 * Experimental water spreading on one inclined rock plane after impact.
 *
 * This translates the audited PySPH shallow-water equations into Aralia's
 * TypeScript runtime. It is a bounded finite-pulse study, not the live river
 * solver. The existing impact junction supplies the inlet depth and speed.
 * No particle is deleted and no dry-depth threshold hides its water.
 *
 * Positions use physical distance along an orthonormal plane, not horizontal
 * map distance. Pressure uses gravity normal to that plane. Kernel support
 * broadens the shoreline; steep impacts, other faces and returning inlet
 * crossings need separate handling before this can drive a whole waterfall.
 * Source: pypr/pysph 1cd3dea9cfaac7d9f1bda2a2491ce4b42a31dbe5,
 * pysph/sph/swe/basic.py (density, LF acceleration and SWEStep).
 * Alpha intentionally uses destination support h_i, the derivative of this
 * gather-density constraint. Upstream CorrectionFactorVariableSmoothingLength
 * requests the averaged-support DWIJ instead. Thus the prior scalar-force
 * comparison validates supplied fields, not literal upstream alpha generation.
 * The plane-gravity adaptation and analytic kernel derivative are also explicit
 * differences from a complete PySPH engine execution.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 12/10/2026, 21:08:40
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { WaterfallImpactPort } from './waterfallImpactJunction';

type Pair = [number, number];
export interface SphReceiverParticle {
  x: number; y: number; vx: number; vy: number;
  mass: number; rho: number; h0: number; resident: boolean;
}
export interface SphReceiverForces {
  rho: number[]; h: number[]; acceleration: Pair[];
  bufferForce: Pair; bufferForcePower: number; bufferPressureStoragePower: number;
  internalLFForce: Pair; internalLFPower: number;
  densityIterations: number; densityResidual: number; pairCount: number;
}
export interface SphReceiverPlane {
  normalGravity: number; tangentGravity: number; referenceDepth: number;
  /** A work/capacity guard, never a smoothing-length clamp. */
  maximumSupportRadius: number;
}
const WATER_DENSITY = 1000;
const SIGMA = 10 / (7 * Math.PI);
const MAX_PARTICLES = 640;
const MAX_DENSITY_ITERATIONS = 100;
const DENSITY_TOLERANCE = 1e-7;

/** Normalized 2D cubic kernel and its radial derivative. */
export function sphReceiverKernel(r: number, h: number): Pair {
  return [kernelValue(r, h), kernelDerivative(r, h)];
}
function kernelValue(r: number, h: number): number {
  const q = r / h;
  if (q >= 2) return 0;
  const f = q < 1 ? 1 - 1.5 * q * q + .75 * q ** 3 : .25 * (2 - q) ** 3;
  return SIGMA * f / h ** 2;
}
function kernelDerivative(r: number, h: number): number {
  const q = r / h;
  if (q >= 2) return 0;
  const df = q < 1 ? -3 * q + 2.25 * q * q : -.75 * (2 - q) ** 2;
  return SIGMA * df / h ** 3;
}

/** Evaluate without changing ownership or input arrays. Internal LF force is
 * reported explicitly: upstream's destination-h regularizer is not exactly
 * antisymmetric. Its directed work must not be labeled guaranteed dissipation. */
export function evaluateSphReceiver(particles: readonly SphReceiverParticle[], plane: SphReceiverPlane,
  tolerance = DENSITY_TOLERANCE): SphReceiverForces {
  const n = particles.length;
  if (n > MAX_PARTICLES || !Number.isFinite(plane.normalGravity) || plane.normalGravity <= 0
    || !Number.isFinite(plane.tangentGravity) || !(plane.referenceDepth > 0)
    || !Number.isFinite(plane.referenceDepth) || !(plane.maximumSupportRadius > 0)
    || !Number.isFinite(plane.maximumSupportRadius) || !(tolerance > 0 && tolerance <= DENSITY_TOLERANCE)) {
    throw Error('Invalid or unsupported receiver capacity/plane');
  }
  for (const p of particles) if (![p.x, p.y, p.vx, p.vy, p.mass, p.rho, p.h0].every(Number.isFinite)
    || p.mass <= 0 || p.rho <= 0 || p.h0 <= 0) throw Error('Invalid receiver particle');
  const rho0 = WATER_DENSITY * plane.referenceDepth;
  const rho = particles.map(p => p.resident ? p.rho : rho0);
  const h = particles.map(p => p.h0);
  const acceleration: Pair[] = particles.map(() => [0, 0]);
  const result: SphReceiverForces = {rho, h, acceleration, bufferForce: [0, 0],
    bufferForcePower: 0, bufferPressureStoragePower: 0, internalLFForce: [0, 0],
    internalLFPower: 0, densityIterations: 0, densityResidual: 0, pairCount: 0};
  if (!particles.some(p => p.resident)) return result;

  // Only exact zero-support pairs are excluded. When a density iteration
  // expands support, rebuild before summing so newly reached neighbors count.
  let bound = 0;
  let pairs: {i: number; j: number; r: number; dx: number; dy: number}[] = [];
  let converged = false;
  for (let iteration = 0; iteration < MAX_DENSITY_ITERATIONS; iteration++) {
    for (let i = 0; i < n; i++) h[i] = particles[i].h0 * Math.sqrt(rho0 / rho[i]);
    const needed = 2 * Math.max(...h);
    if (!Number.isFinite(needed) || needed > plane.maximumSupportRadius) throw Error('Receiver support capacity exceeded');
    if (needed > bound) {
      bound = needed;
      pairs = [];
      const buckets = new Map<string, number[]>();
      for (let j = 0; j < n; j++) {
        const key = `${Math.floor(particles[j].x / bound)},${Math.floor(particles[j].y / bound)}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(j); else buckets.set(key, [j]);
      }
      for (let i = 0; i < n; i++) {
        if (!particles[i].resident) continue;
        const bx = Math.floor(particles[i].x / bound), by = Math.floor(particles[i].y / bound);
        const neighbors: number[] = [];
        for (let x = bx - 1; x <= bx + 1; x++) for (let y = by - 1; y <= by + 1; y++) {
          const bucket = buckets.get(`${x},${y}`); if (bucket) neighbors.push(...bucket);
        }
        // Preserve summation order against the dense reference. Buckets only
        // skip impossible pairs; they never truncate an occupied neighborhood.
        neighbors.sort((a, b) => a - b);
        for (const j of neighbors) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const r = Math.hypot(dx, dy);
          if (r <= bound) pairs.push({i, j, r, dx, dy});
        }
      }
    }
    const sum = new Float64Array(n);
    for (const {i, j, r} of pairs) sum[i] += particles[j].mass * kernelValue(r, h[i]);
    let residual = 0;
    for (let i = 0; i < n; i++) if (particles[i].resident) residual = Math.max(residual, Math.abs(sum[i] / rho[i] - 1));
    result.densityIterations = iteration + 1; result.densityResidual = residual;
    if (residual <= tolerance) { converged = true; break; }
    for (let i = 0; i < n; i++) if (particles[i].resident) {
      if (!(sum[i] > 0) || !Number.isFinite(sum[i])) throw Error('Invalid receiver density');
      rho[i] = sum[i];
    }
  }
  if (!converged) throw Error('Receiver density did not converge');
  const alpha = new Float64Array(n);
  for (const {i, j, r} of pairs) alpha[i] -= particles[j].mass * r * kernelDerivative(r, h[i]);
  const coefficient = new Float64Array(n), wave = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (!particles[i].resident) alpha[i] = 2 * rho[i];
    if (!(alpha[i] > 0)) throw Error('Unsupported isolated water retained');
    coefficient[i] = plane.normalGravity / WATER_DENSITY * rho[i] / alpha[i];
    wave[i] = Math.sqrt(plane.normalGravity * rho[i] / WATER_DENSITY);
    if (particles[i].resident) acceleration[i][0] = plane.tangentGravity;
  }
  for (const {i, j, r, dx, dy} of pairs) {
    if (!particles[i].resident || r === 0) continue;
    const a = particles[i], b = particles[j];
    const di = kernelDerivative(r, h[i]), dj = kernelDerivative(r, h[j]);
    const approach = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
    const visc = approach < 0 ? -(wave[i] + wave[j]) / (rho[i] + rho[j]) * approach / Math.sqrt(r * r + .01 * h[i] ** 2) : 0;
    const pressure = -b.mass * (coefficient[i] * di + coefficient[j] * dj) / r;
    const lf = -b.mass * .5 * visc * (di + dj) / r;
    const fx = a.mass * (pressure + lf) * dx, fy = a.mass * (pressure + lf) * dy;
    acceleration[i][0] += (pressure + lf) * dx; acceleration[i][1] += (pressure + lf) * dy;
    if (b.resident) {
      result.internalLFForce[0] += a.mass * lf * dx;
      result.internalLFForce[1] += a.mass * lf * dy;
      result.internalLFPower += a.mass * lf * (dx * a.vx + dy * a.vy);
    } else {
      result.bufferForce[0] += fx; result.bufferForce[1] += fy;
      result.bufferForcePower += fx * a.vx + fy * a.vy;
      // Moving exterior neighbors change resident pressure storage as well
      // as kinetic energy. Force dot velocity alone omits this second term.
      result.bufferPressureStoragePower += a.mass * b.mass * coefficient[i] * approach * di / r;
    }
  }
  result.pairCount = pairs.length;
  return result;
}

function energy(particles: readonly SphReceiverParticle[], plane: SphReceiverPlane): number {
  return particles.reduce((sum, p) => sum + (p.resident ? p.mass *
    (.5 * (p.vx ** 2 + p.vy ** 2) - plane.tangentGravity * p.x + .5 * plane.normalGravity * p.rho / WATER_DENSITY) : 0), 0);
}

export interface SphReceiverPulseSpec extends SphReceiverPlane {
  port: WaterfallImpactPort; width: number; pulseLength: number; spacing: number;
  /** Even number makes the half-cell inlet events exact integer steps. */
  stepsPerRow?: number;
}

/** A finite external reservoir and one plane. No source is debited by creating
 * this study; a future live ownership adapter must transfer both impact ports.
 * Each step commits atomically. Capacity/convergence failure leaves the last
 * completed water state available for inspection, without retry or fallback. */
export class WaterfallSphReceiverPulse {
  private particles: SphReceiverParticle[];
  private half: Pair[];
  private stepIndex = 0;
  private readonly births: number[];
  readonly dt: number;
  readonly totalSteps: number;
  readonly requestedVolume: number;
  private readonly spec: SphReceiverPulseSpec;
  private accounting = {admissionEnergy: 0, carriedEnergy: 0, bufferForceWork: 0,
    bufferPressureStorage: 0, internalLFWork: 0, internalLFImpulse: [0, 0] as Pair};
  private lastForces: SphReceiverForces;
  constructor(input: SphReceiverPulseSpec) {
    const spec = this.spec = {...input, port: {...input.port}};
    const steps = spec.stepsPerRow ?? 20;
    if (![spec.width, spec.pulseLength, spec.spacing, spec.port.s, spec.port.h, spec.port.q].every(v => Number.isFinite(v) && v > 0)
      || !Number.isFinite(spec.port.ve) || !Number.isInteger(steps) || steps < 20 || steps > 200 || steps % 2
      || Math.abs(spec.port.q - spec.port.h * spec.port.s) > 1e-10 * spec.port.q
      || spec.referenceDepth !== spec.port.h) throw Error('Unsupported finite receiver inlet');
    const rows = Math.round(spec.pulseLength / spec.spacing), cols = Math.round(spec.width / spec.spacing);
    if (rows < 1 || cols < 1 || rows * cols > MAX_PARTICLES
      || Math.abs(rows * spec.spacing - spec.pulseLength) > 1e-12 * spec.pulseLength
      || Math.abs(cols * spec.spacing - spec.width) > 1e-12 * spec.width) throw Error('Unsupported receiver pulse partition');
    this.dt = spec.spacing / spec.port.s / steps;
    this.totalSteps = rows * steps * 3;
    this.requestedVolume = spec.width * spec.pulseLength * spec.port.h;
    this.particles = []; this.half = []; this.births = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      this.births.push((row + .5) * steps);
      this.particles.push({x: -(row + .5) * spec.spacing, y: (col + .5) * spec.spacing - spec.width / 2,
        vx: spec.port.s, vy: spec.port.ve, mass: WATER_DENSITY * spec.port.h * spec.spacing ** 2,
        rho: WATER_DENSITY * spec.port.h, h0: 1.2 * spec.spacing, resident: false});
      this.half.push([spec.port.s, spec.port.ve]);
    }
    this.lastForces = evaluateSphReceiver(this.particles, spec);
  }

  step(): ReturnType<WaterfallSphReceiverPulse['snapshot']> {
    if (this.stepIndex >= this.totalSteps) return this.snapshot();
    const p = this.particles.map(a => ({...a})), half = this.half.map(a => [...a] as Pair);
    const ledger = {...this.accounting, internalLFImpulse: [...this.accounting.internalLFImpulse] as Pair};
    const apply = (forces: SphReceiverForces) => p.forEach((a, i) => {a.rho = forces.rho[i];});
    // Evaluate ownership before drift. Incoming rows cross at x=0, with the
    // prescribed buffer density retained on the pre-crossing side.
    const newIds = p.map((a, i) => !a.resident && this.births[i] === this.stepIndex ? i : -1).filter(i => i >= 0);
    let forces = evaluateSphReceiver(p, this.spec); apply(forces);
    if (newIds.length) {
      const before = energy(p, this.spec);
      for (const i of newIds) {
        const a = p[i];
        ledger.carriedEnergy += a.mass * (.5 * (a.vx ** 2 + a.vy ** 2) - this.spec.tangentGravity * a.x
          + .5 * this.spec.normalGravity * a.rho / WATER_DENSITY);
        a.resident = true;
      }
      forces = evaluateSphReceiver(p, this.spec); apply(forces);
      ledger.admissionEnergy += energy(p, this.spec) - before;
      for (const i of newIds) half[i] = [p[i].vx - .5 * this.dt * forces.acceleration[i][0], p[i].vy - .5 * this.dt * forces.acceleration[i][1]];
    }
    const cfl = Math.max(...p.map((a, i) => this.dt * (Math.hypot(a.vx, a.vy) + Math.sqrt(this.spec.normalGravity * a.rho / WATER_DENSITY)) / forces.h[i]));
    if (cfl > .1) throw Error('Receiver CFL exceeds declared 0.1 bound');
    ledger.bufferForceWork += forces.bufferForcePower * this.dt;
    ledger.bufferPressureStorage += forces.bufferPressureStoragePower * this.dt;
    ledger.internalLFWork += forces.internalLFPower * this.dt;
    for (let a = 0; a < 2; a++) ledger.internalLFImpulse[a] += forces.internalLFForce[a] * this.dt;
    const nextStep = this.stepIndex + 1;
    p.forEach((a, i) => {
      if (a.resident) {
        half[i][0] += this.dt * forces.acceleration[i][0]; half[i][1] += this.dt * forces.acceleration[i][1];
        a.x += this.dt * half[i][0]; a.y += this.dt * half[i][1];
        a.vx = half[i][0] + .5 * this.dt * forces.acceleration[i][0]; a.vy = half[i][1] + .5 * this.dt * forces.acceleration[i][1];
        if (a.x < -1e-12) throw Error('Receiver return crossing needs explicit exporter');
      } else {
        a.x = this.spec.port.s * (nextStep - this.births[i]) * this.dt;
        a.y += this.spec.port.ve * this.dt;
      }
    });
    // Publish densities at the actual new positions, never a stale-height
    // picture. This costs an extra solve in the initial CPU reference path.
    const final = evaluateSphReceiver(p, this.spec); apply(final);
    this.particles = p; this.half = half; this.accounting = ledger;
    this.stepIndex = nextStep; this.lastForces = final;
    return this.snapshot();
  }

  snapshot() {
    const residentVolume = this.particles.reduce((s, p) => s + (p.resident ? p.mass / WATER_DENSITY : 0), 0);
    const residentEnergy = energy(this.particles, this.spec), a = this.accounting;
    return {qualification: 'EXPERIMENTAL_PLANE_RECEIVER' as const, time: this.stepIndex * this.dt,
      done: this.stepIndex === this.totalSteps, requestedVolume: this.requestedVolume, residentVolume,
      bufferVolume: this.requestedVolume - residentVolume, residentEnergy,
      accounting: {...a, internalLFImpulse: [...a.internalLFImpulse] as Pair,
        reclassificationEnergy: a.admissionEnergy - a.carriedEnergy,
        residual: residentEnergy - a.admissionEnergy - a.bufferForceWork - a.bufferPressureStorage - a.internalLFWork},
      densityIterations: this.lastForces.densityIterations, densityResidual: this.lastForces.densityResidual,
      pairCount: this.lastForces.pairCount,
      particles: this.particles.map((p, i) => ({...p, h: this.lastForces.h[i]}))};
  }
}
