/**
 * @file mpmDomain.ts — a BOUNDED particle-water domain, on the CPU.
 *
 * ADR 0002's production plan for water is a hybrid: the 2D sheet is the
 * world's water, and particles arm only at a local violent event — a fall lip,
 * a breach, a jet — inside a small box around it. This file is that box.
 *
 * WHY THIS IS NOT flipCompute.ts
 *
 * `flipCompute.ts` is the same MLS-MPM method as WebGPU compute passes, and it
 * is the right code for a surface that owns a `WebGPURenderer`. The volume
 * sandbox does not: `?step=volume` is a WebGL R3F canvas with a voxel mesh, a
 * water sheet, fall curtains and a walker in it, and a WebGPU compute chain
 * cannot run in a WebGL context. A second canvas over the first would composite
 * without shared depth, so the splash would draw through the crater wall in
 * front of it — the exact fault `waterSheet.ts` was written to remove.
 *
 * So the domain runs on the CPU, in the same scene, with correct depth. That is
 * affordable only because it is BOUNDED: the budget is a few thousand particles
 * in a box a few meters across, not a bubble. The cost was measured, not
 * guessed — see `mpm-bench` in the test file.
 *
 * The kernels below mirror `flipCompute.ts` step for step, which mirrors
 * matsuoka-601/webgpu-ocean (MIT): the 27-node quadratic B-spline stencil, the
 * Tait equation of state at exponent 5 with pressure clamped at zero, APIC
 * transfers, and the slope-aware terrain collision that stopped round 3's
 * uphill geyser. Everything runs in GRID UNITS — dx = 1, gravity 0.3 per
 * sim-time unit — and converts to meters only at the domain edge.
 *
 * WHAT THIS FILE OWNS THAT THE GPU ONE DOES NOT
 *
 * A LIFECYCLE. Particles here are spawned by the handoff contract and RETIRED
 * back through it: a particle that has been at rest on the ground for a while
 * has stopped being a splash and started being a pool, and a pool is the
 * sheet's job. The GPU version recycles a fixed ring of particles forever
 * because it never has to hand mass back to anything.
 *
 * COLLISION IS AGAINST SPANS, NOT A HEIGHT (IMPL-3)
 *
 * Both this file and `flipCompute.ts` collided against one floor per column.
 * That is the heightfield assumption ADR 0002 exists to break: a bored hill has
 * two places water can lie and a single height seals the lower one shut. The
 * floor lookup here now resolves the SPAN containing the query height, from the
 * flat encoding in `spanField.ts`, and a node above a span's ceiling is solid
 * with the push pointing DOWN. On a column with one span — every column of open
 * ground — the arithmetic is identical to what it replaced.
 */

import {
  SPAN_SKY,
  SPAN_SLOTS,
  resolveSpanAt,
  spanFieldFromHeights,
} from './spanField';

/** Particles per cell at rest. webgpu-ocean's value; `particleVolumeM3` uses it. */
export const MPM_REST_DENSITY = 4;
/** Tait stiffness. */
const STIFFNESS = 3;
/** Dynamic viscosity in the stress term. */
const VISCOSITY = 0.1;
/** Sim-time per substep. */
export const MPM_DT = 0.2;
/** Gravity in grid units per sim-time squared. */
export const MPM_GRAVITY = 0.3;
const GRAVITY = MPM_GRAVITY;
/** Soft predictive wall stiffness. */
const WALL_K = 0.3;

/**
 * Displacement below which a particle counts as at rest, grid units per
 * substep.
 *
 * DISPLACEMENT, NOT SPEED, and that is a measurement, not a preference.
 *
 * Two cuts of this file asked whether the velocity was small. Both failed, for
 * the same reason and at different thresholds. A particle resting on the floor
 * is held there by the predictive spring, which is integrated explicitly: it
 * settles into a two-substep limit cycle where the velocity register flips
 * sign every substep and the POSITION never moves. Measured on a 500-particle
 * pool left to stand for 3,000 substeps: every remaining particle pinned at
 * y = 1.00 to two decimals, not one of them moving, and the mean speed sitting
 * at 0.209 forever with zero particles under a 0.18 gate. The pool had plainly
 * stopped; its velocities had not.
 *
 * Displacement asks the question we actually mean — has this stopped being a
 * splash — and it cannot be fooled by a register that oscillates in place. At
 * 0.02 a particle qualifying has moved less than a fiftieth of a cell.
 */
export const SETTLE_MOVE = 0.02;
/**
 * Height above the floor, grid units, within which resting counts.
 *
 * Guards the ARC APEX: a particle thrown up is genuinely slow for a few
 * substeps at the top of its flight, and retiring it there would drop water
 * out of mid-air into the sheet below — volume arriving in the pool that the
 * picture never showed landing.
 */
export const SETTLE_HEIGHT = 3;
/** Consecutive substeps at rest before a particle is handed back. */
export const SETTLE_STEPS = 20;

export interface MpmDomain {
  /** Grid nodes per edge. */
  readonly n: number;
  /** Node spacing in world meters. */
  readonly dxM: number;
  /** Min corner in world meters. */
  readonly originM: [number, number, number];
  /** Particle capacity — the budget. */
  readonly capacity: number;
  /** Live particles occupy [0, live). Retirement swaps the last one down. */
  live: number;

  /** Position in GRID units from the origin, capacity * 3. */
  readonly pos: Float32Array;
  /** Velocity in grid units per sim-time, capacity * 3. */
  readonly vel: Float32Array;
  /** APIC affine matrix columns. */
  readonly c0: Float32Array;
  readonly c1: Float32Array;
  readonly c2: Float32Array;
  /** Consecutive substeps this particle has been at rest. */
  readonly still: Uint8Array;

  /** Node mass, n³. */
  readonly gMass: Float32Array;
  /** Node momentum, then velocity in place, n³ * 3. */
  readonly gMom: Float32Array;

  /**
   * The volume's open SPANS per domain column, in GRID units above the origin.
   *
   * `spanField.ts` owns the layout: `slots` (floor, ceil) pairs per column,
   * top-down, short columns padded by replicating the last real span. Sampled
   * once when the domain arms — a fall foot does not move while the domain
   * lives, and re-reading voxel columns per node per substep is the whole cost
   * of the kernel over again.
   *
   * This replaced a single float per column. A height has one floor; a bored
   * hill has two places water can lie, and the height sealed the lower one.
   */
  readonly spanG: Float32Array;
  /** Pairs per column in `spanG`. */
  readonly slots: number;

  /**
   * Displacement per substep under which a particle counts as at rest.
   *
   * A CONSTANT here would be a bug at any timestep but one. The rest test
   * measures how far a particle moved in one substep, so it scales with the
   * substep: halve `dt` and every particle in the domain moves half as far,
   * and a fixed threshold silently reclassifies a moving splash as a settled
   * pool. `dropletWater.ts` runs a much smaller `dt` than the vendor cadence
   * precisely so a coarse domain falls at real gravity, and it sets this to
   * match. Defaults to `SETTLE_MOVE`, so every existing caller is unchanged.
   */
  settleMoveG: number;
  /** Height above the floor within which resting counts, grid units. */
  settleHeightG: number;
}

export interface MpmDomainSpec {
  n: number;
  dxM: number;
  originM: [number, number, number];
  capacity: number;
  /**
   * World ground height at a world (x, z), meters. The heightfield case — one
   * floor, open sky above it, which is what open ground IS.
   */
  floorYAt: (xM: number, zM: number) => number;
  /**
   * The volume's spans, already packed and already in GRID units above
   * `originM[1]`, laid out for THIS domain's n × n columns (see
   * `spanFieldToGrid`). Overrides `floorYAt` when present.
   */
  spanG?: Float32Array;
  /** Pairs per column in `spanG`. Defaults to `SPAN_SLOTS`. */
  slots?: number;
  /** Rest displacement per substep, grid units. Defaults to `SETTLE_MOVE`. */
  settleMoveG?: number;
  /** Rest height above the floor, grid units. Defaults to `SETTLE_HEIGHT`. */
  settleHeightG?: number;
}

export function createDomain(spec: MpmDomainSpec): MpmDomain {
  const { n, dxM, originM, capacity } = spec;
  const slots = spec.slots ?? SPAN_SLOTS;
  let spanG: Float32Array;
  if (spec.spanG) {
    const want = n * n * slots * 2;
    if (spec.spanG.length !== want) {
      throw new Error(`mpmDomain: spanG is ${spec.spanG.length} floats, expected ${want}`);
    }
    spanG = spec.spanG;
  } else {
    // One span per column, open sky above it: the heightfield, in the span
    // encoding. Nothing downstream knows which constructor ran.
    const heights = new Float32Array(n * n);
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const wx = originM[0] + (x + 0.5) * dxM;
        const wz = originM[2] + (z + 0.5) * dxM;
        heights[z * n + x] = (spec.floorYAt(wx, wz) - originM[1]) / dxM;
      }
    }
    spanG = spanFieldFromHeights(heights, n, slots);
  }
  return {
    n,
    dxM,
    originM,
    capacity,
    live: 0,
    pos: new Float32Array(capacity * 3),
    vel: new Float32Array(capacity * 3),
    c0: new Float32Array(capacity * 3),
    c1: new Float32Array(capacity * 3),
    c2: new Float32Array(capacity * 3),
    still: new Uint8Array(capacity),
    gMass: new Float32Array(n ** 3),
    gMom: new Float32Array(n ** 3 * 3),
    spanG,
    slots,
    settleMoveG: spec.settleMoveG ?? SETTLE_MOVE,
    settleHeightG: spec.settleHeightG ?? SETTLE_HEIGHT,
  };
}

/* Scratch. Module-level so no kernel allocates. */
const nrm = new Float32Array(3);
const spanOut = new Float32Array(2);
const spanScratch = new Float32Array(2);

/**
 * The floor of the span containing `gy` at grid (gx, gz), grid units.
 *
 * The direct replacement for the old `groundAt`, and identical to it on a
 * column with one span — which is every column of open ground.
 */
function groundAt(d: MpmDomain, gx: number, gy: number, gz: number): number {
  resolveSpanAt(d.spanG, d.slots, d.n, gx, gy, gz, spanOut, spanScratch);
  return spanOut[0];
}

/** The ceiling above the span containing `gy`. SPAN_SKY under open sky. */
function ceilAt(d: MpmDomain, gx: number, gy: number, gz: number): number {
  resolveSpanAt(d.spanG, d.slots, d.n, gx, gy, gz, spanOut, spanScratch);
  return spanOut[1];
}

/**
 * Terrain normal at a grid (x, z) for the span containing `gy`, from central
 * differences of that span's FLOOR.
 *
 * The whole round-3 lesson hangs off this: colliding a sloped floor with a
 * vertical clamp deletes gravity's along-slope component, so water slides
 * uphill and never decelerates. Projecting onto the tangent plane can only
 * ever shrink the speed.
 *
 * Sampling the neighbours at the SAME y is what keeps it correct inside a
 * tunnel: the differences are taken between tunnel floors, not between a
 * tunnel floor and the hillside forty meters over it.
 */
function terrainNormal(d: MpmDomain, gx: number, gy: number, gz: number): void {
  const ax = groundAt(d, gx - 1, gy, gz) - groundAt(d, gx + 1, gy, gz);
  const az = groundAt(d, gx, gy, gz - 1) - groundAt(d, gx, gy, gz + 1);
  const len = Math.hypot(ax, 2, az);
  nrm[0] = ax / len;
  nrm[1] = 2 / len;
  nrm[2] = az / len;
}

/**
 * Normal of the CEILING above the span containing `gy`, pointing DOWN out of
 * the roof — the mirror of `terrainNormal`.
 *
 * A jet that hits a tunnel roof at an angle must slide along it, not stop dead.
 * The same tangent-plane projection does that; only the surface it is taken
 * from, and the sign of the y component, change.
 */
function ceilingNormal(d: MpmDomain, gx: number, gy: number, gz: number): void {
  const ax = ceilAt(d, gx + 1, gy, gz) - ceilAt(d, gx - 1, gy, gz);
  const az = ceilAt(d, gx, gy, gz + 1) - ceilAt(d, gx, gy, gz - 1);
  // A ceiling sampled beside a mouth reads SPAN_SKY, and a 1e9 difference would
  // produce a horizontal normal with no meaning. Fall back to straight down
  // rather than let the sentinel steer the collision.
  if (!Number.isFinite(ax) || Math.abs(ax) > 1e6 || Math.abs(az) > 1e6) {
    nrm[0] = 0;
    nrm[1] = -1;
    nrm[2] = 0;
    return;
  }
  const len = Math.hypot(ax, 2, az);
  nrm[0] = ax / len;
  nrm[1] = -2 / len;
  nrm[2] = az / len;
}

/**
 * Put `count` particles into the domain as a jittered ball.
 *
 * Returns how many were actually placed: the budget is the budget, and a caller
 * that asked for more than fits must know, because the volume it debited from
 * the sheet was sized by the number it asked for.
 */
export function spawnBall(
  d: MpmDomain,
  count: number,
  centerG: readonly [number, number, number],
  radiusG: number,
  velG: readonly [number, number, number],
  rand: () => number,
): number {
  const room = d.capacity - d.live;
  const put = Math.min(count, room);
  for (let k = 0; k < put; k++) {
    const p = d.live + k;
    // Uniform ball: direction from (cos phi, z), radius from cbrt(u).
    const z = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const ring = Math.sqrt(Math.max(0, 1 - z * z));
    const r = radiusG * Math.cbrt(rand());
    d.pos[p * 3] = centerG[0] + ring * Math.cos(phi) * r;
    d.pos[p * 3 + 1] = centerG[1] + z * r;
    d.pos[p * 3 + 2] = centerG[2] + ring * Math.sin(phi) * r;
    d.vel[p * 3] = velG[0];
    d.vel[p * 3 + 1] = velG[1];
    d.vel[p * 3 + 2] = velG[2];
    d.c0[p * 3] = d.c0[p * 3 + 1] = d.c0[p * 3 + 2] = 0;
    d.c1[p * 3] = d.c1[p * 3 + 1] = d.c1[p * 3 + 2] = 0;
    d.c2[p * 3] = d.c2[p * 3 + 1] = d.c2[p * 3 + 2] = 0;
    d.still[p] = 0;
  }
  d.live += put;
  return put;
}

/* Stencil scratch: weights and the node offsets, filled per particle. */
const wx = new Float32Array(3);
const wy = new Float32Array(3);
const wz = new Float32Array(3);

/** Fill the quadratic B-spline weights for one axis, cell-centered. */
function weights(dv: number, out: Float32Array): void {
  const a = 0.5 - dv;
  const b = 0.5 + dv;
  out[0] = 0.5 * a * a;
  out[1] = 0.75 - dv * dv;
  out[2] = 0.5 * b * b;
}

/** Advance the domain one substep. Mirrors the five GPU kernels in order. */
export function stepDomain(d: MpmDomain, dt: number = MPM_DT): void {
  const n = d.n;
  const live = d.live;
  const { pos, vel, c0, c1, c2, gMass, gMom } = d;

  gMass.fill(0);
  gMom.fill(0);
  if (live === 0) return;

  const clampI = (v: number): number => (v < 0 ? 0 : v > n - 1 ? n - 1 : v);

  // ---- p2g1: mass and momentum ------------------------------------------
  for (let p = 0; p < live; p++) {
    const px = pos[p * 3];
    const py = pos[p * 3 + 1];
    const pz = pos[p * 3 + 2];
    const bx = Math.floor(px);
    const by = Math.floor(py);
    const bz = Math.floor(pz);
    weights(px - bx - 0.5, wx);
    weights(py - by - 0.5, wy);
    weights(pz - bz - 0.5, wz);
    const vx = vel[p * 3];
    const vy = vel[p * 3 + 1];
    const vz = vel[p * 3 + 2];
    for (let gy = 0; gy < 3; gy++) {
      const iy = clampI(by + gy - 1);
      const dy = by + gy - 1 + 0.5 - py;
      for (let gz = 0; gz < 3; gz++) {
        const iz = clampI(bz + gz - 1);
        const dz = bz + gz - 1 + 0.5 - pz;
        const wyz = wy[gy] * wz[gz];
        for (let gx = 0; gx < 3; gx++) {
          const ix = clampI(bx + gx - 1);
          const dx = bx + gx - 1 + 0.5 - px;
          const w = wyz * wx[gx];
          // Q = C * dist, C stored as columns.
          const qx = c0[p * 3] * dx + c1[p * 3] * dy + c2[p * 3] * dz;
          const qy = c0[p * 3 + 1] * dx + c1[p * 3 + 1] * dy + c2[p * 3 + 1] * dz;
          const qz = c0[p * 3 + 2] * dx + c1[p * 3 + 2] * dy + c2[p * 3 + 2] * dz;
          const ni = (iy * n + iz) * n + ix;
          gMass[ni] += w;
          gMom[ni * 3] += (vx + qx) * w;
          gMom[ni * 3 + 1] += (vy + qy) * w;
          gMom[ni * 3 + 2] += (vz + qz) * w;
        }
      }
    }
  }

  // ---- p2g2: pressure and viscous stress --------------------------------
  for (let p = 0; p < live; p++) {
    const px = pos[p * 3];
    const py = pos[p * 3 + 1];
    const pz = pos[p * 3 + 2];
    const bx = Math.floor(px);
    const by = Math.floor(py);
    const bz = Math.floor(pz);
    weights(px - bx - 0.5, wx);
    weights(py - by - 0.5, wy);
    weights(pz - bz - 0.5, wz);

    /* Density is RECOMPUTED from the grid every substep, never integrated.
     * nialltl's guide is explicit about it, and an integrated volume drifts
     * until the sim either freezes solid or blows apart. */
    let density = 0;
    for (let gy = 0; gy < 3; gy++) {
      const iy = clampI(by + gy - 1);
      for (let gz = 0; gz < 3; gz++) {
        const iz = clampI(bz + gz - 1);
        const wyz = wy[gy] * wz[gz];
        for (let gx = 0; gx < 3; gx++) {
          density += gMass[(iy * n + iz) * n + clampI(bx + gx - 1)] * wyz * wx[gx];
        }
      }
    }
    const volume = 1 / Math.max(density, 1e-6);
    // Tait, exponent 5, NO tension: pressure clamps at zero, which is what
    // lets a sheet tear into droplets instead of behaving like rubber.
    const ratio = density / MPM_REST_DENSITY;
    const pressure = Math.max(0, STIFFNESS * (ratio * ratio * ratio * ratio * ratio - 1));
    const scale = -4 * volume * dt;

    const a0 = c0[p * 3], a1 = c0[p * 3 + 1], a2 = c0[p * 3 + 2];
    const b0 = c1[p * 3], b1 = c1[p * 3 + 1], b2 = c1[p * 3 + 2];
    const e0 = c2[p * 3], e1 = c2[p * 3 + 1], e2 = c2[p * 3 + 2];

    for (let gy = 0; gy < 3; gy++) {
      const iy = clampI(by + gy - 1);
      const dy = by + gy - 1 + 0.5 - py;
      for (let gz = 0; gz < 3; gz++) {
        const iz = clampI(bz + gz - 1);
        const dz = bz + gz - 1 + 0.5 - pz;
        const wyz = wy[gy] * wz[gz];
        for (let gx = 0; gx < 3; gx++) {
          const ix = clampI(bx + gx - 1);
          const dx = bx + gx - 1 + 0.5 - px;
          const w = wyz * wx[gx];
          // stress * dist, stress = -p*I + visc*(C + Cᵀ).
          const cdx = a0 * dx + b0 * dy + e0 * dz;
          const cdy = a1 * dx + b1 * dy + e1 * dz;
          const cdz = a2 * dx + b2 * dy + e2 * dz;
          const ctx = a0 * dx + a1 * dy + a2 * dz;
          const cty = b0 * dx + b1 * dy + b2 * dz;
          const ctz = e0 * dx + e1 * dy + e2 * dz;
          const sx = -pressure * dx + VISCOSITY * (cdx + ctx);
          const sy = -pressure * dy + VISCOSITY * (cdy + cty);
          const sz = -pressure * dz + VISCOSITY * (cdz + ctz);
          const ni = (iy * n + iz) * n + ix;
          gMom[ni * 3] += sx * scale * w;
          gMom[ni * 3 + 1] += sy * scale * w;
          gMom[ni * 3 + 2] += sz * scale * w;
        }
      }
    }
  }

  // ---- gridUpdate: divide, gravity, walls, terrain ----------------------
  for (let iy = 0; iy < n; iy++) {
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const i = (iy * n + iz) * n + ix;
        const m = gMass[i];
        if (m <= 0) continue;
        let vx = gMom[i * 3] / m;
        let vy = gMom[i * 3 + 1] / m - GRAVITY * dt;
        let vz = gMom[i * 3 + 2] / m;
        if (ix < 2 || ix > n - 3) vx = 0;
        if (iy > n - 3 && vy > 0) vy = 0;
        if (iz < 2 || iz > n - 3) vz = 0;
        /* THE SPAN TEST. One resolve gives both boundaries of the span this
         * node sits in; the node is solid if it is under the floor or over the
         * ceiling, and the velocity is projected out along whichever surface it
         * is inside. Free-slip both ways — the projection can only ever shrink
         * |v|, which is the round-3 rule that stopped the uphill geyser. */
        resolveSpanAt(d.spanG, d.slots, n, ix, iy, iz, spanOut, spanScratch);
        const ground = spanOut[0];
        const roof = spanOut[1];
        if (iy < ground + 1) {
          terrainNormal(d, ix, iy, iz);
          const vn = vx * nrm[0] + vy * nrm[1] + vz * nrm[2];
          if (vn < 0) {
            vx -= nrm[0] * vn;
            vy -= nrm[1] * vn;
            vz -= nrm[2] * vn;
          }
        } else if (iy > roof - 1) {
          ceilingNormal(d, ix, iy, iz);
          const vn = vx * nrm[0] + vy * nrm[1] + vz * nrm[2];
          if (vn < 0) {
            vx -= nrm[0] * vn;
            vy -= nrm[1] * vn;
            vz -= nrm[2] * vn;
          }
        }
        gMom[i * 3] = vx;
        gMom[i * 3 + 1] = vy;
        gMom[i * 3 + 2] = vz;
      }
    }
  }

  // ---- g2p: interpolate back, advect, collide, judge rest ----------------
  const lo = 1;
  const hi = n - 2;
  const wallMin = 3;
  const wallMax = n - 4;
  for (let p = 0; p < live; p++) {
    const px = pos[p * 3];
    const py = pos[p * 3 + 1];
    const pz = pos[p * 3 + 2];
    const bx = Math.floor(px);
    const by = Math.floor(py);
    const bz = Math.floor(pz);
    weights(px - bx - 0.5, wx);
    weights(py - by - 0.5, wy);
    weights(pz - bz - 0.5, wz);

    let nvx = 0, nvy = 0, nvz = 0;
    let b00 = 0, b01 = 0, b02 = 0;
    let b10 = 0, b11 = 0, b12 = 0;
    let b20 = 0, b21 = 0, b22 = 0;
    for (let gy = 0; gy < 3; gy++) {
      const iy = clampI(by + gy - 1);
      const dy = by + gy - 1 + 0.5 - py;
      for (let gz = 0; gz < 3; gz++) {
        const iz = clampI(bz + gz - 1);
        const dz = bz + gz - 1 + 0.5 - pz;
        const wyz = wy[gy] * wz[gz];
        for (let gx = 0; gx < 3; gx++) {
          const ix = clampI(bx + gx - 1);
          const dx = bx + gx - 1 + 0.5 - px;
          const w = wyz * wx[gx];
          const ni = (iy * n + iz) * n + ix;
          const ax = gMom[ni * 3] * w;
          const ay = gMom[ni * 3 + 1] * w;
          const az = gMom[ni * 3 + 2] * w;
          nvx += ax; nvy += ay; nvz += az;
          b00 += ax * dx; b01 += ay * dx; b02 += az * dx;
          b10 += ax * dy; b11 += ay * dy; b12 += az * dy;
          b20 += ax * dz; b21 += ay * dz; b22 += az * dz;
        }
      }
    }
    c0[p * 3] = b00 * 4; c0[p * 3 + 1] = b01 * 4; c0[p * 3 + 2] = b02 * 4;
    c1[p * 3] = b10 * 4; c1[p * 3 + 1] = b11 * 4; c1[p * 3 + 2] = b12 * 4;
    c2[p * 3] = b20 * 4; c2[p * 3 + 1] = b21 * 4; c2[p * 3 + 2] = b22 * 4;

    let xn = px + nvx * dt;
    let yn = py + nvy * dt;
    let zn = pz + nvz * dt;
    xn = xn < lo ? lo : xn > hi ? hi : xn;
    yn = yn < lo ? lo : yn > hi ? hi : yn;
    zn = zn < lo ? lo : zn > hi ? hi : zn;

    // Soft PREDICTIVE walls: push against where the particle will be, not
    // where it is. A reactive wall reads as rubber; this reads as water.
    const ax2 = xn + nvx * dt * 3;
    const ay2 = yn + nvy * dt * 3;
    const az2 = zn + nvz * dt * 3;
    if (ax2 < wallMin) nvx += (wallMin - ax2) * WALL_K;
    if (ax2 > wallMax) nvx += (wallMax - ax2) * WALL_K;
    if (ay2 > wallMax) nvy += (wallMax - ay2) * WALL_K;
    if (az2 < wallMin) nvz += (wallMin - az2) * WALL_K;
    if (az2 > wallMax) nvz += (wallMax - az2) * WALL_K;

    /* The span the particle is moving into. Resolved at the NEW position and
     * the NEW height: a particle that has just fallen through a tunnel mouth
     * must be judged against the tunnel, not against the hillside it left. */
    resolveSpanAt(d.spanG, d.slots, n, xn, yn, zn, spanOut, spanScratch);
    const ground = spanOut[0];
    const roof = spanOut[1];
    terrainNormal(d, xn, yn, zn);
    if (ay2 < ground + 1) {
      const pen = (ground + 1 - ay2) * nrm[1];
      nvx += nrm[0] * pen * WALL_K;
      nvy += nrm[1] * pen * WALL_K;
      nvz += nrm[2] * pen * WALL_K;
    }
    /* THE HARD CLAMP, and WHICH WAY IT PUSHES DEPENDS ON THE SURFACE.
     *
     * This used to be an unconditional `yn = ground + 0.5`. On a heightfield
     * that is right: every column's floor is a floor, so lifting a buried
     * particle vertically puts it on the ground. Spans break it, because the
     * bilinear floor is ALSO what makes a tunnel's side WALL — beside a bore
     * the resolved floor climbs from the tunnel floor to the hillside inside
     * one cell — and lifting vertically against a wall teleports the particle
     * up through the rock and out of the hill. Measured on the test bore: a
     * lift of nineteen cells, straight through the roof.
     *
     * A first fix capped the reach at one cell, on the argument that a real
     * floor is never further than that above a particle. It was wrong, and the
     * GPU found it where 150 test particles could not: 100,000 under a dam
     * head, 2,400 of them ended up inside rock and the deepest sat four metres
     * in. A depth cap is a CLIFF — anything that slips past a cell has no floor
     * at all any more, and pressure guarantees something slips past.
     *
     * The discriminator is the surface, not the depth. `nrm[1]` is the cosine
     * of the surface against horizontal: near 1 it is a floor and the vertical
     * clamp is exactly right at any depth, near 0 it is a wall and the only
     * honest response is to push OUT of it. Half — a 60-degree face — splits
     * them, and every slope in the proof terrain is under 32 degrees, so open
     * ground keeps precisely the behaviour it always had.
     *
     * The lateral push runs either way, scaled into normal space by `nrm[1]`,
     * so a particle jammed into a tunnel wall is worked back into the passage
     * instead of held there by the pressure behind it. */
    if (yn < ground + 0.5) {
      const lift = ground + 0.5 - yn;
      if (nrm[1] > 0.5 || lift <= 0.5) yn = ground + 0.5;
      else yn += lift * nrm[1] * nrm[1];
      xn += nrm[0] * lift * nrm[1];
      zn += nrm[2] * lift * nrm[1];
      const vn = nvx * nrm[0] + nvy * nrm[1] + nvz * nrm[2];
      if (vn < 0) {
        nvx -= nrm[0] * vn;
        nvy -= nrm[1] * vn;
        nvz -= nrm[2] * vn;
      }
    }
    /* THE ROOF, the mirror of the floor, and it runs LAST on purpose.
     *
     * Open ground has no roof — `roof` is SPAN_SKY and no comparison against it
     * can be true — so this whole block is dead arithmetic outside a tunnel.
     *
     * It runs after the floor because the two disagree in exactly one place and
     * the roof is the one telling the truth there. At a tunnel wall the floor is
     * a BLEND climbing toward the hillside while the ceiling is read from the
     * nearest column, so the "floor" can rise past the ceiling and describe a
     * span of negative thickness. A ceiling is a real horizontal surface at a
     * real height; the wall-blend floor is a fiction of the interpolation. Last
     * writer wins, and it must be the roof, or the particle is parked in stone.
     */
    if (roof < SPAN_SKY) {
      ceilingNormal(d, xn, yn, zn);
      if (ay2 > roof - 1) {
        const pen = (ay2 - (roof - 1)) * -nrm[1];
        nvx += nrm[0] * pen * WALL_K;
        nvy += nrm[1] * pen * WALL_K;
        nvz += nrm[2] * pen * WALL_K;
      }
      if (yn > roof - 0.5) {
        const drop = yn - (roof - 0.5);
        if (nrm[1] < -0.5) yn = roof - 0.5;
        else yn -= drop * nrm[1] * nrm[1];
        xn += nrm[0] * drop * -nrm[1];
        zn += nrm[2] * drop * -nrm[1];
        const vn = nvx * nrm[0] + nvy * nrm[1] + nvz * nrm[2];
        if (vn < 0) {
          nvx -= nrm[0] * vn;
          nvy -= nrm[1] * vn;
          nvz -= nrm[2] * vn;
        }
      }
    }

    pos[p * 3] = xn; pos[p * 3 + 1] = yn; pos[p * 3 + 2] = zn;
    vel[p * 3] = nvx; vel[p * 3 + 1] = nvy; vel[p * 3 + 2] = nvz;

    /* Has it stopped being a splash?
     *
     * STILL AND LOW. Still alone catches the apex of every arc, where a
     * particle genuinely does not move for a substep and then falls again —
     * retiring there would drop water out of mid-air into the sheet below,
     * and the pool would gain volume the picture never showed arriving. */
    const mx = xn - px;
    const my = yn - py;
    const mz = zn - pz;
    const resting =
      mx * mx + my * my + mz * mz < d.settleMoveG * d.settleMoveG &&
      yn - ground < d.settleHeightG;
    d.still[p] = resting ? Math.min(255, d.still[p] + 1) : 0;
  }
}

/**
 * Hand every settled particle back, and retire it.
 *
 * World XZ of each retired particle is written into `outXZ` as pairs. The
 * domain does not know the sheet's grid, and giving it one would tie a local
 * sim to a global layout for no gain — the caller does the two divisions.
 *
 * Retirement is a swap with the last live particle. That reorders the array,
 * which nothing downstream may depend on: a renderer draws [0, live) and a
 * particle's identity across frames is not a thing this file promises.
 */
export function drainSettled(d: MpmDomain, outXZ: Float32Array): number {
  const cap = outXZ.length >> 1;
  let out = 0;
  let p = 0;
  while (p < d.live) {
    if (d.still[p] < SETTLE_STEPS || out >= cap) {
      p++;
      continue;
    }
    outXZ[out * 2] = d.originM[0] + d.pos[p * 3] * d.dxM;
    outXZ[out * 2 + 1] = d.originM[2] + d.pos[p * 3 + 2] * d.dxM;
    out++;
    const last = d.live - 1;
    if (p !== last) {
      for (let k = 0; k < 3; k++) {
        d.pos[p * 3 + k] = d.pos[last * 3 + k];
        d.vel[p * 3 + k] = d.vel[last * 3 + k];
        d.c0[p * 3 + k] = d.c0[last * 3 + k];
        d.c1[p * 3 + k] = d.c1[last * 3 + k];
        d.c2[p * 3 + k] = d.c2[last * 3 + k];
      }
      d.still[p] = d.still[last];
    }
    d.live = last;
  }
  return out;
}

/** Retire EVERY live particle, for a domain that is disarming. */
export function drainAll(d: MpmDomain, outXZ: Float32Array): number {
  const cap = outXZ.length >> 1;
  const take = Math.min(d.live, cap);
  for (let p = 0; p < take; p++) {
    outXZ[p * 2] = d.originM[0] + d.pos[p * 3] * d.dxM;
    outXZ[p * 2 + 1] = d.originM[2] + d.pos[p * 3 + 2] * d.dxM;
  }
  // Anything the buffer could not take stays live and drains next call.
  for (let p = take; p < d.live; p++) {
    for (let k = 0; k < 3; k++) {
      d.pos[(p - take) * 3 + k] = d.pos[p * 3 + k];
      d.vel[(p - take) * 3 + k] = d.vel[p * 3 + k];
      d.c0[(p - take) * 3 + k] = d.c0[p * 3 + k];
      d.c1[(p - take) * 3 + k] = d.c1[p * 3 + k];
      d.c2[(p - take) * 3 + k] = d.c2[p * 3 + k];
    }
    d.still[p - take] = d.still[p];
  }
  d.live -= take;
  return take;
}
