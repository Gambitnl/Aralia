/**
 * @file flipCompute.ts — particle water (MLS-MPM) as WebGPU compute passes.
 *
 * WHY A SECOND WATER MODEL EXISTS
 *
 * The cellular solver in fluidCompute.ts exchanges mass between neighbor
 * cells. It conserves exactly and it covers the whole bubble, but it has no
 * horizontal inertia: water creeps, and it can never splash. Remy asked for
 * the physics-engine answer, and for water that answer is a particle method.
 *
 * THIS IS A PORT, NOT AN INVENTION
 *
 * The kernels below are a faithful TSL port of matsuoka-601/webgpu-ocean
 * (MIT, vendored at vendor/webgpu-ocean): its five MLS-MPM kernels, its
 * constants, and its units. The first version of this file hand-rolled the
 * same method and mixed meter units with grid units — the sim froze. The
 * ported rules that matter:
 *
 *   - EVERYTHING RUNS IN GRID UNITS. Particle positions are measured in
 *     cells, dx = 1, and gravity is the demo's tuned -0.3 per time step.
 *     The scene converts to meters only at render and at terrain lookup.
 *   - Tait equation of state, exponent 5, and NO tension: pressure clamps
 *     at zero, which is what lets a sheet tear into droplets.
 *   - Viscosity enters as dynamic_viscosity * (C + Ct) in the stress.
 *   - Walls push back softly and predictively (wall_stiffness against the
 *     position k steps ahead), which reads as water, not rubber.
 *
 * The one addition to the port: the floor is the proof terrain, not a flat
 * box wall. Grid nodes and particles both collide against the same ground the
 * terrain mesh renders from.
 *
 * THE GROUND IS A VOLUME, NOT A HEIGHT (IMPL-3, ADR 0002 open item 2)
 *
 * That collision used to read ONE FLOAT per column: a height buffer, one floor
 * per column. It is the heightfield assumption, and it is exactly what ADR 0002
 * says the volume exists to break. Bore a tunnel through a hill and the column
 * has two places water can lie — the hillside on top, the tunnel floor beneath
 * — and a single height seals the tunnel shut. Fire the jet at the mouth and
 * the water piles up against a wall that is not there.
 *
 * The buffer is now the packed SPAN FIELD from `spanField.ts`: `SPAN_SLOTS`
 * (floor, ceiling) pairs per column, read out of the same `volumeSurface.ts`
 * span reader the mesher and the 2D solver use. At two slots a column is one
 * vec4, so the kernels read the SAME NUMBER of buffer elements they did with a
 * single height — the change is arithmetic, not bandwidth.
 *
 * A grid node inside rock is solid. A node inside a tunnel void is free. The
 * push points out along the local face normal, which is the round-3 tangent-
 * plane rule applied to a ceiling as well as a floor.
 *
 * FIXED-POINT ATOMICS, BECAUSE WGSL HAS NO FLOAT ATOMICS
 *
 * The particle-to-grid transfer is a scatter: many particles add into the
 * same node at once. atomicAdd on i32 with a 1e7 fixed-point scale makes the
 * accumulation exact. And one rule from this file's own history: NEVER plain-
 * assign into an atomic buffer view — WGSL forbids `=` on atomic<i32> and
 * the whole pipeline dies at shader compile. Clear through atomicStore.
 */
import {
  Fn,
  If,
  atomicAdd,
  atomicStore,
  cos,
  float,
  hash,
  instanceIndex,
  int,
  mix,
  modInt,
  normalize,
  sin,
  smoothstep,
  sqrt,
  step,
  storage,
  uniform,

  vec3,
} from 'three/tsl';
import { StorageBufferAttribute, Vector3 } from 'three/webgpu';
import type { ComputeNode } from 'three/webgpu';
import { SPAN_SKY } from './spanField';

// TSL node handles are structurally loose and three's TS types lag the
// runtime. One permissive alias, contained to this file, beats a cast at
// every stencil call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TSLNode = any;

/** Fixed-point scale for atomic accumulation. webgpu-ocean's value. */
const FP = 1e7;
/** webgpu-ocean's tuned constants, verbatim. */
export const MPM_STIFFNESS = 3;
export const MPM_REST_DENSITY = 4;
export const MPM_VISCOSITY = 0.1;
export const MPM_DT = 0.2;
export const MPM_GRAVITY = 0.3;

/**
 * REAL seconds per one sim-time unit, derived from gravity: the kernels run
 * g = 0.3 cells per sim-t², the world runs g = 9.81 m/s², and a cell is dx
 * meters. Matching the two gives T = sqrt(0.3 * dx / 9.81). At dx = 0.25 m
 * that is ~0.0875 s per sim-t, so one dt = 0.2 substep is ~17.5 ms of real
 * time and 2 substeps per display frame is ~2x real speed at 60 fps — the
 * vendor's exact cadence. Anything that wants a real-seconds constant in the
 * kernels (the foam lifetime) converts through this.
 */
export function simSecondsPerUnit(dx: number): number {
  return Math.sqrt((MPM_GRAVITY * dx) / 9.81);
}

/** Foam e-folding lifetime, REAL seconds. A few seconds, per the critic. */
export const FOAM_TAU_S = 2.5;

export interface FlipParams {
  /** Grid nodes per edge. */
  n: number;
  /** Node spacing in meters (render scale only — the sim runs at dx = 1). */
  dx: number;
  /** Domain origin in world meters (min corner). */
  origin: [number, number, number];
  /** Particle count. */
  count: number;
}

export interface FlipBuffers {
  params: FlipParams;
  /** Particle position, in GRID units (cells from the domain origin). */
  pos: StorageBufferAttribute;
  /** Particle velocity, grid units per time step. */
  vel: StorageBufferAttribute;
  /** APIC affine matrix COLUMNS. */
  c0: StorageBufferAttribute;
  c1: StorageBufferAttribute;
  c2: StorageBufferAttribute;
  /**
   * Per-particle foam scalar, 0..1: an exponentially DECAYING memory of
   * recent agitation (round 2's foam integrated all past agitation forever
   * and crusted the whole pool white). Fed each substep in g2p, rendered as
   * the whitewater channel.
   */
  foam: StorageBufferAttribute;
  /** Grid: fixed-point atomic accumulators. */
  gridMass: StorageBufferAttribute;
  gridMomX: StorageBufferAttribute;
  gridMomY: StorageBufferAttribute;
  gridMomZ: StorageBufferAttribute;
}

export function createFlipBuffers(params: FlipParams): FlipBuffers {
  const nodes = params.n ** 3;
  const c = params.count;
  return {
    params,
    pos: new StorageBufferAttribute(new Float32Array(c * 3), 3),
    vel: new StorageBufferAttribute(new Float32Array(c * 3), 3),
    c0: new StorageBufferAttribute(new Float32Array(c * 3), 3),
    c1: new StorageBufferAttribute(new Float32Array(c * 3), 3),
    c2: new StorageBufferAttribute(new Float32Array(c * 3), 3),
    foam: new StorageBufferAttribute(new Float32Array(c), 1),
    gridMass: new StorageBufferAttribute(new Int32Array(nodes), 1),
    gridMomX: new StorageBufferAttribute(new Int32Array(nodes), 1),
    gridMomY: new StorageBufferAttribute(new Int32Array(nodes), 1),
    gridMomZ: new StorageBufferAttribute(new Int32Array(nodes), 1),
  };
}

/**
 * Spawn a block of particles. World-meter arguments; grid-unit storage.
 * Spacing targets the rest density (~4 particles per cell), so the block
 * starts relaxed instead of exploding outward.
 *
 * `velGrid` launches every particle with one shared velocity, in GRID units
 * per sim-time unit — the same dimensionless units the kernels integrate
 * (`x += v·dt`, `v.y -= 0.3·dt`). A block with a velocity is a fired SLUG:
 * the jet moment, where a resting block is the dam moment.
 */
export function spawnBlock(
  bufs: FlipBuffers,
  minM: [number, number, number],
  sizeM: [number, number, number],
  velGrid?: [number, number, number],
): void {
  const { dx, origin, count } = bufs.params;
  const arr = bufs.pos.array as Float32Array;
  if (velGrid) {
    const varr = bufs.vel.array as Float32Array;
    for (let p = 0; p < count; p++) {
      varr[p * 3] = velGrid[0];
      varr[p * 3 + 1] = velGrid[1];
      varr[p * 3 + 2] = velGrid[2];
    }
  }
  const spacing = Math.cbrt(1 / MPM_REST_DENSITY); // grid units between particles
  const nx = Math.floor(sizeM[0] / dx / spacing);
  const ny = Math.floor(sizeM[1] / dx / spacing);
  const nz = Math.floor(sizeM[2] / dx / spacing);
  const g0 = [(minM[0] - origin[0]) / dx, (minM[1] - origin[1]) / dx, (minM[2] - origin[2]) / dx];
  let p = 0;
  for (let k = 0; k < nz && p < count; k++) {
    for (let j = 0; j < ny && p < count; j++) {
      for (let i = 0; i < nx && p < count; i++) {
        arr[p * 3] = g0[0] + (i + 0.2 + Math.random() * 0.6) * spacing;
        arr[p * 3 + 1] = g0[1] + (j + 0.2 + Math.random() * 0.6) * spacing;
        arr[p * 3 + 2] = g0[2] + (k + 0.2 + Math.random() * 0.6) * spacing;
        p++;
      }
    }
  }
  for (; p < count; p++) {
    arr[p * 3] = g0[0] + (Math.random() * sizeM[0]) / dx;
    arr[p * 3 + 1] = g0[1] + (Math.random() * sizeM[1]) / dx;
    arr[p * 3 + 2] = g0[2] + (Math.random() * sizeM[2]) / dx;
  }
  bufs.pos.needsUpdate = true;
}

export interface FlipKernels {
  clearGrid: ComputeNode;
  p2g1: ComputeNode;
  p2g2: ComputeNode;
  gridUpdate: ComputeNode;
  g2p: ComputeNode;
  uniforms: { dt: ReturnType<typeof uniform> };
}

/**
 * The ground the kernels collide against: the volume's spans, packed flat.
 *
 * `buffer` holds `slots` (floor, ceil) pairs per column with the Y values
 * already in GRID units above `origin[1]` (`spanFieldToGrid` does that once on
 * the CPU, so no kernel spends a subtract and a divide per lookup). The XZ
 * lattice is the span field's own — `n` columns at `cellM` meters, sampled at
 * cell centers — and need not match the sim grid.
 */
export interface SpanGround {
  buffer: StorageBufferAttribute;
  /** Columns per edge. */
  n: number;
  /** Column spacing, world meters. */
  cellM: number;
  /** World XZ of the field's min corner — column 0's centre sits half a cell in. */
  originXZ: [number, number];
  /** (floor, ceil) pairs per column. */
  slots: number;
}

export function buildFlipKernels(bufs: FlipBuffers, ground: SpanGround): FlipKernels {
  const { n, dx, origin, count } = bufs.params;
  const nodes = n ** 3;
  const spanN = ground.n;
  const spanCell = ground.cellM;
  const spanOx = ground.originXZ[0];
  const spanOz = ground.originXZ[1];
  const slots = ground.slots;
  /** vec4s per column. Two slots is four floats, which is one. */
  const VEC4S = Math.ceil((slots * 2) / 4);

  const pos = storage(bufs.pos, 'vec3', count);
  const vel = storage(bufs.vel, 'vec3', count);
  const c0 = storage(bufs.c0, 'vec3', count);
  const c1 = storage(bufs.c1, 'vec3', count);
  const c2 = storage(bufs.c2, 'vec3', count);
  const gMass = storage(bufs.gridMass, 'int', nodes).toAtomic();
  const gMomX = storage(bufs.gridMomX, 'int', nodes).toAtomic();
  const gMomY = storage(bufs.gridMomY, 'int', nodes).toAtomic();
  const gMomZ = storage(bufs.gridMomZ, 'int', nodes).toAtomic();
  const gMassR = storage(bufs.gridMass, 'int', nodes).toReadOnly();
  const gMomXR = storage(bufs.gridMomX, 'int', nodes).toReadOnly();
  const gMomYR = storage(bufs.gridMomY, 'int', nodes).toReadOnly();
  const gMomZR = storage(bufs.gridMomZ, 'int', nodes).toReadOnly();
  const spans = storage(ground.buffer, 'vec4', spanN * spanN * VEC4S).toReadOnly();

  const N = int(n);
  const dtU = uniform(MPM_DT);

  const encode = (v: TSLNode) => v.mul(float(FP)).round().toInt();
  const decode = (v: TSLNode) => float(v).div(float(FP));

  const nodeIndex = (ix: TSLNode, iy: TSLNode, iz: TSLNode) =>
    iy.clamp(int(0), N.sub(int(1)))
      .mul(N)
      .add(iz.clamp(int(0), N.sub(int(1))))
      .mul(N)
      .add(ix.clamp(int(0), N.sub(int(1))));

  /**
   * ONE COLUMN of the span field, resolved at height `y` (grid units).
   * Returns vec2(floorY, ceilY) of the span that contains y — or of the
   * deepest span, when y is below every floor.
   *
   * The rule, and it is the reference implementation's rule verbatim
   * (`spanField.resolveColumn` — any change here is a change there):
   *
   *   take the FIRST slot whose floor is at or below y;
   *   if none, take the LAST slot.
   *
   * The last slot is always the deepest REAL span because the packer pads
   * short columns by replicating it. That is what lets this be a straight
   * unrolled chain with no count, no length branch, and no second buffer.
   *
   * BRANCHLESS, and that was worth 0.9 ms a frame. The first cut wrote the
   * chain as `If(floor <= y) { out = slot }`, which is what the CPU twin does
   * in plain TypeScript. On the GPU it is a real branch, and this runs four
   * times per lookup and up to nine lookups per particle per substep: measured
   * at 2.45 ms a frame against the height buffer's 1.24. `step` and `mix` say
   * the same thing with no control flow — mix with a 0-or-1 factor picks one
   * value outright, it never blends.
   */
  const columnBase = (col: TSLNode) => col.mul(int(VEC4S));
  const slotIsHigh = (s: number) => s % 2 === 1;

  /** The floor of the resolved span in ONE column. A float, never a vec2. */
  const resolveFloor = (col: TSLNode, y: TSLNode) => {
    const base = columnBase(col);
    const e: TSLNode[] = [];
    for (let k = 0; k < VEC4S; k++) e.push(spans.element(base.add(int(k))));
    const f = (s: number) => (slotIsHigh(s) ? e[s >> 1].z : e[s >> 1].x);
    let out: TSLNode = f(slots - 1);
    // Downwards, so the LAST pick applied is the smallest qualifying slot —
    // the highest floor at or below y, which is the rule.
    for (let s = slots - 1; s >= 0; s--) out = mix(out, f(s), step(f(s), y));
    return out;
  };

  /** The ceiling of the resolved span in ONE column. */
  const resolveCeil = (col: TSLNode, y: TSLNode) => {
    const base = columnBase(col);
    const e: TSLNode[] = [];
    for (let k = 0; k < VEC4S; k++) e.push(spans.element(base.add(int(k))));
    const f = (s: number) => (slotIsHigh(s) ? e[s >> 1].z : e[s >> 1].x);
    const c = (s: number) => (slotIsHigh(s) ? e[s >> 1].w : e[s >> 1].y);
    let out: TSLNode = c(slots - 1);
    for (let s = slots - 1; s >= 0; s--) out = mix(out, c(s), step(f(s), y));
    return out;
  };

  /* Column index from a GRID position. The span lattice need not be the sim
   * grid, so this is the general mapping; on this page they are the same
   * lattice and it collapses to the identity. */
  const colFrac = (g: TSLNode, o: number) =>
    g.mul(float(dx)).add(float(o)).sub(float(o === origin[0] ? spanOx : spanOz)).div(float(spanCell)).sub(float(0.5));

  /**
   * THE FLOOR at a GRID (x, y, z), BILINEAR across the four nearest columns.
   *
   * A FLOAT, and that is a performance decision with a measurement behind it.
   * The first cut had one `spanAt` returning vec2(floor, ceil) and built the
   * normal from four of them. Every lookup then carried a ceiling nobody in
   * that path wanted, in a `toVar` the compiler could not eliminate, five
   * times per particle per substep — measured at 2.47 ms a frame against the
   * height buffer's 1.26. Ablation found it: not the buffer width, not the
   * select chain, not the roof branch. Register pressure from vec2 temporaries
   * in the normal, which is the only thing called four times.
   *
   * Rounds 1-2 used a nearest-cell lookup instead of bilinear, which turns
   * every slope into a STAIRCASE: a particle sliding across a cell boundary
   * sees the ground jump a step and the hard clamp lifts it WITHOUT
   * decelerating — potential energy injected at every riser, forever. That was
   * the last residual boil source after the tangent-plane collision landed.
   *
   * The bilinear floor is also what CONFINES a tunnel sideways. Approach the
   * rock beside a bore and the resolved floor climbs from the tunnel floor to
   * the hillside above inside one cell — a near-vertical face whose tangent
   * plane points back into the passage. There is no separate lateral-wall
   * test, and none is needed.
   */
  const floorAt = (gx: TSLNode, gy: TSLNode, gz: TSLNode) => {
    const fx = colFrac(gx, origin[0]);
    const fz = colFrac(gz, origin[2]);
    const ix0 = fx.floor().toInt().clamp(int(0), int(spanN - 1));
    const iz0 = fz.floor().toInt().clamp(int(0), int(spanN - 1));
    const ix1 = ix0.add(int(1)).clamp(int(0), int(spanN - 1));
    const iz1 = iz0.add(int(1)).clamp(int(0), int(spanN - 1));
    const tx = fx.fract();
    const tz = fz.fract();
    const at = (cz: TSLNode, cx: TSLNode) => resolveFloor(cz.mul(int(spanN)).add(cx), gy);
    const h0 = at(iz0, ix0).mul(float(1).sub(tx)).add(at(iz0, ix1).mul(tx));
    const h1 = at(iz1, ix0).mul(float(1).sub(tx)).add(at(iz1, ix1).mul(tx));
    return h0.mul(float(1).sub(tz)).add(h1.mul(tz));
  };

  /**
   * THE CEILING at a GRID (x, y, z), from the NEAREST column, never blended.
   *
   * A column beside a tunnel mouth is open sky, so its ceiling is the SPAN_SKY
   * sentinel, and lerping 1e9 against a real roof puts the roof half a million
   * meters up. A ceiling also has no staircase pump to fear: water does not
   * rest on a roof, and clamping down under one removes potential energy
   * rather than adding it. Nearest is the honest read and the cheap one.
   */
  const ceilAt = (gx: TSLNode, gy: TSLNode, gz: TSLNode) => {
    const fx = colFrac(gx, origin[0]);
    const fz = colFrac(gz, origin[2]);
    const cx = fx.add(float(0.5)).floor().toInt().clamp(int(0), int(spanN - 1));
    const cz = fz.add(float(0.5)).floor().toInt().clamp(int(0), int(spanN - 1));
    return resolveCeil(cz.mul(int(spanN)).add(cx), gy);
  };

  /**
   * Floor normal at a GRID (x, y, z), from central differences of the resolved
   * FLOOR at the same height.
   *
   * THE round-3 fix hangs off this: rounds 1-2 collided the sloped floor as
   * if it were the vendor's axis-aligned box floor (pure vertical clamps).
   * On a slope that deletes gravity's along-slope restoring force — water
   * slides uphill without ever decelerating — and the vertical position lift
   * pumps in potential energy every substep: the uphill-edge geyser and the
   * never-settling pool. Colliding against the actual tangent plane (zero
   * ONLY the into-ground normal component) removes the energy source; the
   * projection can only ever shrink |v|.
   *
   * Sampling the neighbours at the SAME y is what keeps it right inside a
   * tunnel: the differences run between tunnel floors, not between a tunnel
   * floor and the hillside forty meters over it.
   */
  const terrainNormalAt = (gx: TSLNode, gy: TSLNode, gz: TSLNode) =>
    normalize(
      vec3(
        floorAt(gx.sub(float(1)), gy, gz).sub(floorAt(gx.add(float(1)), gy, gz)),
        float(2),
        floorAt(gx, gy, gz.sub(float(1))).sub(floorAt(gx, gy, gz.add(float(1)))),
      ),
    );

  /**
   * Ceiling normal, pointing DOWN out of the roof — the mirror of the above.
   * A jet that meets a tunnel roof at an angle must slide along it rather than
   * stop dead, and that is the same tangent-plane projection against a
   * different surface.
   *
   * Beside a mouth one of the samples is the SPAN_SKY sentinel and the
   * difference is 1e9, which would steer the collision with a number that is
   * not a height. Straight down is the honest answer there.
   */
  const ceilingNormalAt = (gx: TSLNode, gy: TSLNode, gz: TSLNode) => {
    const ax = ceilAt(gx.add(float(1)), gy, gz).sub(ceilAt(gx.sub(float(1)), gy, gz)).toVar();
    const az = ceilAt(gx, gy, gz.add(float(1))).sub(ceilAt(gx, gy, gz.sub(float(1)))).toVar();
    const nrm = normalize(vec3(ax, float(-2), az)).toVar();
    If(ax.abs().greaterThan(float(1e6)).or(az.abs().greaterThan(float(1e6))), () => {
      nrm.assign(vec3(0, -1, 0));
    });
    return nrm;
  };

  const clearGrid = Fn(() => {
    const i = int(instanceIndex);
    // atomicStore, never plain assign — see the file header.
    atomicStore(gMass.element(i), int(0));
    atomicStore(gMomX.element(i), int(0));
    atomicStore(gMomY.element(i), int(0));
    atomicStore(gMomZ.element(i), int(0));
  })().compute(nodes);

  /**
   * The 27-node quadratic B-spline stencil, cell-centered, matching the
   * webgpu-ocean weights exactly. `body(wi, ni, dist)` gets the weight, the
   * node's flat index, and (cell center − particle) in grid units.
   */
  const stencil = (xp: TSLNode, body: (wi: TSLNode, ni: TSLNode, dist: TSLNode) => void) => {
    const cellIdx = xp.floor().toVar();
    const d = xp.sub(cellIdx.add(vec3(0.5, 0.5, 0.5))).toVar();
    const w0 = vec3(0.5, 0.5, 0.5).sub(d).pow(2).mul(0.5).toVar();
    const w1 = vec3(0.75, 0.75, 0.75).sub(d.mul(d)).toVar();
    const w2 = vec3(0.5, 0.5, 0.5).add(d).pow(2).mul(0.5).toVar();
    const w = [w0, w1, w2];
    for (let gx = 0; gx < 3; gx++) {
      for (let gy = 0; gy < 3; gy++) {
        for (let gz = 0; gz < 3; gz++) {
          const wi = w[gx].x.mul(w[gy].y).mul(w[gz].z);
          const cellX = cellIdx.add(vec3(gx - 1, gy - 1, gz - 1)).toVar();
          const dist = cellX.add(vec3(0.5, 0.5, 0.5)).sub(xp).toVar();
          const ni = nodeIndex(cellX.x.toInt(), cellX.y.toInt(), cellX.z.toInt());
          body(wi, ni, dist);
        }
      }
    }
  };

  const p2g1 = Fn(() => {
    const p = int(instanceIndex);
    const xp = pos.element(p).toVar();
    const vp = vel.element(p).toVar();
    const C0 = c0.element(p).toVar();
    const C1 = c1.element(p).toVar();
    const C2 = c2.element(p).toVar();

    stencil(xp, (wi, ni, dist) => {
      // Q = C * dist, with C stored as columns.
      const Q = C0.mul(dist.x).add(C1.mul(dist.y)).add(C2.mul(dist.z));
      const mom = vp.add(Q).mul(wi);
      atomicAdd(gMass.element(ni), encode(wi));
      atomicAdd(gMomX.element(ni), encode(mom.x));
      atomicAdd(gMomY.element(ni), encode(mom.y));
      atomicAdd(gMomZ.element(ni), encode(mom.z));
    });
  })().compute(count);

  const p2g2 = Fn(() => {
    const p = int(instanceIndex);
    const xp = pos.element(p).toVar();
    const C0 = c0.element(p).toVar();
    const C1 = c1.element(p).toVar();
    const C2 = c2.element(p).toVar();

    const density = float(0).toVar();
    stencil(xp, (wi, ni) => {
      density.addAssign(decode(gMassR.element(ni)).mul(wi));
    });

    const volume = float(1).div(density.max(float(1e-6)));
    // Tait EOS, exponent 5, no tension — webgpu-ocean's exact form.
    const pressure = float(MPM_STIFFNESS)
      .mul(density.div(float(MPM_REST_DENSITY)).pow(5).sub(float(1)))
      .max(float(0))
      .toVar();

    const scale = float(-4).mul(volume).mul(float(dtU)).toVar();

    stencil(xp, (wi, ni, dist) => {
      // stress * dist, with stress = -p*I + visc*(C + Ct).
      const Cd = C0.mul(dist.x).add(C1.mul(dist.y)).add(C2.mul(dist.z));
      const CtD = vec3(C0.dot(dist), C1.dot(dist), C2.dot(dist));
      const stressD = dist.mul(pressure.negate()).add(Cd.add(CtD).mul(float(MPM_VISCOSITY)));
      const mom = stressD.mul(scale).mul(wi);
      atomicAdd(gMomX.element(ni), encode(mom.x));
      atomicAdd(gMomY.element(ni), encode(mom.y));
      atomicAdd(gMomZ.element(ni), encode(mom.z));
    });
  })().compute(count);

  // Plain read-write views for the grid update: it runs as its own dispatch
  // after every atomicAdd has landed, so atomicity is unnecessary — and
  // binding one buffer as BOTH atomic and read-only in one kernel is a WGSL
  // aliasing error. One view per buffer per kernel.
  const gMassU = storage(bufs.gridMass, 'int', nodes).toReadOnly();
  const gMomXU = storage(bufs.gridMomX, 'int', nodes);
  const gMomYU = storage(bufs.gridMomY, 'int', nodes);
  const gMomZU = storage(bufs.gridMomZ, 'int', nodes);

  const gridUpdate = Fn(() => {
    const i = int(instanceIndex);
    const m = decode(gMassU.element(i)).toVar();
    If(m.greaterThan(float(0)), () => {
      const v = vec3(
        decode(gMomXU.element(i)),
        decode(gMomYU.element(i)),
        decode(gMomZU.element(i)),
      )
        .div(m)
        .toVar();
      v.y.subAssign(float(MPM_GRAVITY).mul(float(dtU)));

      // Unpack (y*n + z)*n + x.
      const ix = i.sub(i.div(N).mul(N));
      const iz = i.div(N).sub(i.div(N).div(N).mul(N));
      const iy = i.div(N.mul(N));

      // Box walls: zero the component within two nodes of a face.
      // GOTCHA (r172, cost a full debugging session): every If body MUST be a
      // block-bodied arrow. An expression arrow returns the assign node, TSL
      // emits `return <expr>;` inside the void compute entry, the WGSL fails
      // to compile, and the ONLY symptom is a silent no-op kernel plus an
      // uncapturederror on the device — never a JS exception.
      If(ix.lessThan(int(2)).or(ix.greaterThan(N.sub(int(3)))), () => {
        v.x.assign(float(0));
      });
      If(iy.greaterThan(N.sub(int(3))), () => {
        v.y.assign(v.y.min(float(0)));
      });
      If(iz.lessThan(int(2)).or(iz.greaterThan(N.sub(int(3)))), () => {
        v.z.assign(float(0));
      });

      /* THE SPAN TEST — the node against the volume.
       *
       * One resolve gives both boundaries of the span this node sits in. The
       * node is SOLID if it is under the floor or over the ceiling, and free
       * otherwise; a node inside a bored tunnel is free, which is the whole
       * point of the change. Free-slip against the TANGENT PLANE either way —
       * remove only the into-surface normal component, keep the tangential
       * part untouched. On flat ground the normal is (0,1,0) and the floor
       * branch reduces exactly to the vendor's `vy = max(vy, 0)`.
       *
       * Round 1's tangential friction (x0.6 per substep) killed all waves in
       * 2-4 s; round 2's vertical-only clamp on SLOPED ground let water slide
       * uphill forever (gravity's along-slope component vanished) — the
       * geyser. History: see terrainNormalAt above.
       *
       * The floor branch wins when the two overlap. They can only overlap in a
       * span thinner than two nodes, or in the blended face of a tunnel wall,
       * and in both places the wall is the surface worth resolving against. */
      const nodeFloor = floorAt(float(ix), float(iy), float(iz)).toVar();
      If(float(iy).lessThan(nodeFloor.add(float(1))), () => {
        const nrm = terrainNormalAt(float(ix), float(iy), float(iz)).toVar();
        const vn = v.dot(nrm).toVar();
        If(vn.lessThan(float(0)), () => {
          v.subAssign(nrm.mul(vn));
        });
      }).Else(() => {
        If(float(iy).greaterThan(ceilAt(float(ix), float(iy), float(iz)).sub(float(1))), () => {
          const nrm = ceilingNormalAt(float(ix), float(iy), float(iz)).toVar();
          const vn = v.dot(nrm).toVar();
          If(vn.lessThan(float(0)), () => {
            v.subAssign(nrm.mul(vn));
          });
        });
      });

      gMomXU.element(i).assign(encode(v.x));
      gMomYU.element(i).assign(encode(v.y));
      gMomZU.element(i).assign(encode(v.z));
    });
  })().compute(nodes);

  const foam = storage(bufs.foam, 'float', count);
  /** Foam decay per substep: exp(-substep-real-seconds / tau). */
  const foamDecay = Math.exp(-(MPM_DT * simSecondsPerUnit(dx)) / FOAM_TAU_S);

  const g2p = Fn(() => {
    const p = int(instanceIndex);
    const xp = pos.element(p).toVar();
    const vOld = vel.element(p).toVar();

    const vNew = vec3(0, 0, 0).toVar();
    const b0 = vec3(0, 0, 0).toVar();
    const b1 = vec3(0, 0, 0).toVar();
    const b2 = vec3(0, 0, 0).toVar();
    // Local density, for the ROUND 6 free-surface foam gate below.
    const dens = float(0).toVar();
    stencil(xp, (wi, ni, dist) => {
      const wv = vec3(
        decode(gMomXR.element(ni)),
        decode(gMomYR.element(ni)),
        decode(gMomZR.element(ni)),
      ).mul(wi);
      vNew.addAssign(wv);
      b0.addAssign(wv.mul(dist.x));
      b1.addAssign(wv.mul(dist.y));
      b2.addAssign(wv.mul(dist.z));
      dens.addAssign(decode(gMassR.element(ni)).mul(wi));
    });

    c0.element(p).assign(b0.mul(float(4)));
    c1.element(p).assign(b1.mul(float(4)));
    c2.element(p).assign(b2.mul(float(4)));

    const xNew = xp.add(vNew.mul(float(dtU))).toVar();
    xNew.assign(
      xNew.clamp(vec3(1, 1, 1), vec3(n - 2, n - 2, n - 2)),
    );

    // Soft predictive walls — webgpu-ocean's exact scheme.
    const xAhead = xNew.add(vNew.mul(float(dtU)).mul(float(3))).toVar();
    const wallMin = float(3);
    const wallMax = float(n - 4);
    const K = float(0.3);
    // Block bodies required — see the If GOTCHA in gridUpdate above.
    If(xAhead.x.lessThan(wallMin), () => {
      vNew.x.addAssign(wallMin.sub(xAhead.x).mul(K));
    });
    If(xAhead.x.greaterThan(wallMax), () => {
      vNew.x.addAssign(wallMax.sub(xAhead.x).mul(K));
    });
    If(xAhead.y.greaterThan(wallMax), () => {
      vNew.y.addAssign(wallMax.sub(xAhead.y).mul(K));
    });
    If(xAhead.z.lessThan(wallMin), () => {
      vNew.z.addAssign(wallMin.sub(xAhead.z).mul(K));
    });
    If(xAhead.z.greaterThan(wallMax), () => {
      vNew.z.addAssign(wallMax.sub(xAhead.z).mul(K));
    });

    // The terrain floor. The soft predictive push acts along the terrain
    // NORMAL (the vendor's spring style, but slope-aware): penetration is
    // measured vertically, converted to normal distance by n.y, and the
    // separation impulse points out of the surface — no vertical boost while
    // horizontal speed survives, which was round 2's energy pump on slopes.
    const ground = floorAt(xNew.x, xNew.y, xNew.z).toVar();
    const roof = ceilAt(xNew.x, xNew.y, xNew.z).toVar();
    const nrm = terrainNormalAt(xNew.x, xNew.y, xNew.z).toVar();
    If(xAhead.y.lessThan(ground.add(float(1))), () => {
      const penN = ground.add(float(1)).sub(xAhead.y).mul(nrm.y);
      vNew.addAssign(nrm.mul(penN.mul(K)));
    });
    /* THE HARD CLAMP, and WHICH WAY IT PUSHES DEPENDS ON THE SURFACE.
     *
     * Lift out of the ground, then project the velocity onto the tangent plane
     * (remove ONLY the into-ground component — never add speed). On flat ground
     * this is exactly `vy = max(vy, 0)`.
     *
     * The direction is what the volume added. The bilinear floor is ALSO a
     * tunnel's side wall: beside a bore it climbs from the tunnel floor to the
     * hillside inside one cell, and an unconditional VERTICAL lift onto that
     * "floor" teleports the particle up through the rock and out of the hill —
     * measured on the CPU twin's test bore at nineteen cells, straight through
     * the roof.
     *
     * A first fix capped the lift at one cell, on the argument that a real
     * floor is never further than that above a particle. It was wrong, and it
     * was THIS page that found it: 100,000 particles under a dam head put 2,400
     * of them inside rock, the deepest four metres in, 93% of them inside the
     * bore's own footprint. A depth cap is a CLIFF — whatever slips past a cell
     * has no floor at all any more, and pressure guarantees something slips.
     *
     * The discriminator is the SURFACE, not the depth. `nrm.y` is the cosine of
     * the face against horizontal: near 1 it is a floor and the vertical clamp
     * is right at any depth, near 0 it is a wall and the only honest response
     * is to push out of it. Half — a 60-degree face — splits them, and no slope
     * in the proof terrain exceeds 32 degrees, so open ground keeps exactly the
     * behaviour it has always had.
     *
     * The lateral push runs either way, scaled into normal space by nrm.y, so a
     * particle jammed into a tunnel wall is worked back into the passage rather
     * than held there by the pressure behind it. */
    If(xNew.y.lessThan(ground.add(float(0.5))), () => {
      const lift = ground.add(float(0.5)).sub(xNew.y).toVar();
      If(nrm.y.greaterThan(float(0.5)).or(lift.lessThanEqual(float(0.5))), () => {
        xNew.y.assign(ground.add(float(0.5)));
      }).Else(() => {
        xNew.y.addAssign(lift.mul(nrm.y).mul(nrm.y));
      });
      xNew.x.addAssign(nrm.x.mul(lift).mul(nrm.y));
      xNew.z.addAssign(nrm.z.mul(lift).mul(nrm.y));
      const vn = vNew.dot(nrm).toVar();
      If(vn.lessThan(float(0)), () => {
        vNew.subAssign(nrm.mul(vn));
      });
    });
    /* THE ROOF, the mirror of the floor, and it runs LAST on purpose.
     *
     * Open ground has no roof: `roof` is the SPAN_SKY sentinel and nothing can
     * compare true against it, so every line below is dead arithmetic outside a
     * tunnel.
     *
     * It runs after the floor because the two disagree in exactly one place and
     * the roof is the one telling the truth there. At a tunnel wall the floor is
     * a BLEND climbing toward the hillside while the ceiling is read from the
     * nearest column, so the "floor" can rise past the ceiling and describe a
     * span of negative thickness. A ceiling is a real horizontal surface at a
     * real height; the wall-blend floor is a fiction of the interpolation. Last
     * writer wins, and it must be the roof, or the particle is parked in stone. */
    If(roof.lessThan(float(SPAN_SKY)), () => {
      const cn = ceilingNormalAt(xNew.x, xNew.y, xNew.z).toVar();
      If(xAhead.y.greaterThan(roof.sub(float(1))), () => {
        const penN = xAhead.y.sub(roof.sub(float(1))).mul(cn.y.negate());
        vNew.addAssign(cn.mul(penN.mul(K)));
      });
      If(xNew.y.greaterThan(roof.sub(float(0.5))), () => {
        const drop = xNew.y.sub(roof.sub(float(0.5))).toVar();
        If(cn.y.lessThan(float(-0.5)), () => {
          xNew.y.assign(roof.sub(float(0.5)));
        }).Else(() => {
          xNew.y.subAssign(drop.mul(cn.y).mul(cn.y));
        });
        xNew.x.addAssign(cn.x.mul(drop).mul(cn.y.negate()));
        xNew.z.addAssign(cn.z.mul(drop).mul(cn.y.negate()));
        const vn = vNew.dot(cn).toVar();
        If(vn.lessThan(float(0)), () => {
          vNew.subAssign(cn.mul(vn));
        });
      });
    });

    // Foam: a decaying memory of CURRENT agitation. Sources: |divergence| of
    // the interpolated velocity field (trace of the new C — compression at
    // impacts, expansion in spray) and the substep velocity change (impacts,
    // shear). Quiet water feeds ~nothing (the 0.025 floor eats gravity's
    // per-substep dv of ~0.06*0.35), so a settled pool decays to blue in a
    // few real seconds — round 2's crust integrated agitation forever.
    // ROUND 4 GATING: round 3 fed foam from TOTAL agitation minus a small
    // floor, and during the collapse every particle in the moving body
    // cleared that floor — 120 substeps/s integrated the whole body to 1 in
    // under a second: the critic's "foam brick". Foam must be a crest/impact
    // ACCENT: each source now has its own DEADZONE (ordinary coherent flow —
    // sliding, falling, mild shear — feeds zero), the gains are lower, and
    // the per-substep feed is CAPPED so even a hard impact needs sustained
    // agitation to reach full white. Smooth ramp above the deadzone, never a
    // binary switch.
    const div = b0.x.add(b1.y).add(b2.z).mul(float(4));
    const dv = vNew.sub(vOld).length();
    // ROUND 6 — FREE-SURFACE GATE, the fix for the collapse foam brick. The
    // round-4 deadzones gate by agitation MAGNITUDE, and during a dam
    // collapse the whole moving body clears them: at 120 substeps/s the
    // entire body integrates to 1 in ~0.15 s — the critic's t≈0.9 s "one
    // opaque white slab". Real whitewater lives at the FREE SURFACE (crests,
    // splash crowns, aerated fronts), never in the coherent interior. The
    // interpolated local density says which is which for free: interior at
    // rest density (~4/cell) → gate 0, surface shell / spray (stencil half
    // empty) → gate 1. Smooth ramp, multiplied into the ADDITION only — the
    // τ decay is untouched, so foam carried INTO the body by mixing still
    // fades out instead of accumulating.
    const surfGate = float(1).sub(smoothstep(float(2.4), float(3.4), dens));
    const agit = div
      .abs()
      .sub(float(0.25))
      .max(float(0))
      .mul(float(0.08))
      .add(dv.sub(float(0.09)).max(float(0)).mul(float(0.22)))
      .min(float(0.06))
      .mul(surfGate);
    foam
      .element(p)
      .assign(foam.element(p).mul(float(foamDecay)).add(agit).clamp(float(0), float(1)));

    pos.element(p).assign(xNew);
    vel.element(p).assign(vNew);
  })().compute(count);

  return { clearGrid, p2g1, p2g2, gridUpdate, g2p, uniforms: { dt: dtU } };
}

/**
 * Particles per fired slug. 4096 = a ~1.5 grid-radius... no: a ball of
 * radius cbrt(3 * 4096 / (4 * PI * REST_DENSITY)) ≈ 6.3 cells ≈ 1.6 m at
 * rest density — a readable water bomb that still leaves the pool ~96% of
 * its body per shot. Round 2's 16k lattice CUBE stamped square foam imprints
 * the critic could see from orbit.
 */
export const SLUG_COUNT = 4_096;

export interface SpawnKernels {
  /** Re-lattice EVERY particle into the dam block, at rest. */
  resetDam: ComputeNode;
  /** Respawn SLUG_COUNT particles (a rotating range) as a jittered BALL at the aim point. */
  fireSlug: ComputeNode;
  uniforms: {
    /** First particle index of the slug range (float; floor()ed in-kernel). */
    slugStart: ReturnType<typeof uniform>;
    /** Slug ball center, GRID units — set from the CLICK point per shot. */
    slugCenter: ReturnType<typeof uniform>;
    /** Slug launch velocity, GRID units per sim-time unit. */
    slugVel: ReturnType<typeof uniform>;
    /** Jitter seed; bump per spawn so lattices never repeat. */
    seed: ReturnType<typeof uniform>;
  };
}

/**
 * GPU spawn passes over the LIVE buffers — the fix for round 1's
 * rebuild-the-world-per-shot stall (the Canvas remount re-created the
 * renderer, terrain, and kernels: 500-600 ms hitches on every fire).
 * `needsUpdate` cannot re-upload GPU-resident storage; a compute pass can
 * rewrite it in place, so these two kernels are the ONLY reset paths.
 *
 * Both block corners arrive in GRID units and are baked as constants.
 */
export function buildSpawnKernels(
  bufs: FlipBuffers,
  damMinGrid: [number, number, number],
): SpawnKernels {
  const { count } = bufs.params;
  const pos = storage(bufs.pos, 'vec3', count);
  const vel = storage(bufs.vel, 'vec3', count);
  const c0 = storage(bufs.c0, 'vec3', count);
  const c1 = storage(bufs.c1, 'vec3', count);
  const c2 = storage(bufs.c2, 'vec3', count);
  const foam = storage(bufs.foam, 'float', count);

  const spacing = Math.cbrt(1 / MPM_REST_DENSITY);
  const slugStart = uniform(0);
  const slugCenter = uniform(new Vector3(0, 0, 0));
  const slugVel = uniform(new Vector3(0, 0, 0));
  const seed = uniform(1);

  /** Lattice + hash jitter, the GPU twin of spawnBlock's CPU loop. */
  const latticePos = (
    i: TSLNode,
    nx: number,
    ny: number,
    minGrid: [number, number, number],
  ) => {
    const ix = i.modInt(int(nx));
    const iy = i.div(int(nx)).modInt(int(ny));
    const iz = i.div(int(nx * ny));
    const cell = vec3(float(ix), float(iy), float(iz));
    const h = float(i).mul(float(3)).add(float(seed).mul(float(7.13)));
    const jitter = vec3(hash(h), hash(h.add(float(1))), hash(h.add(float(2))))
      .mul(float(0.6))
      .add(vec3(0.2, 0.2, 0.2));
    return cell.add(jitter).mul(float(spacing)).add(vec3(...minGrid));
  };

  const damN = Math.ceil(Math.cbrt(count));
  const resetDam = Fn(() => {
    const p = int(instanceIndex);
    pos.element(p).assign(latticePos(p, damN, damN, damMinGrid));
    vel.element(p).assign(vec3(0, 0, 0));
    c0.element(p).assign(vec3(0, 0, 0));
    c1.element(p).assign(vec3(0, 0, 0));
    c2.element(p).assign(vec3(0, 0, 0));
    foam.element(p).assign(float(0));
  })().compute(count);

  const fireSlug = Fn(() => {
    const i = int(instanceIndex);
    // Rotating range: successive shots recycle different particles, so the
    // pool keeps most of its body while the slug flies.
    const p = modInt(float(slugStart).floor().toInt().add(i), int(count));
    // A jittered BALL at rest density, not a lattice cube — cubes stamped
    // square foam imprints. Uniform ball sampling: direction from (cosPhi,
    // z) and radius from cbrt(u) so density is even.
    const h = float(i).mul(float(3)).add(float(seed).mul(float(7.13)));
    const u1 = hash(h);
    const u2 = hash(h.add(float(1)));
    const u3 = hash(h.add(float(2)));
    const z = u1.mul(float(2)).sub(float(1));
    const phi = u2.mul(float(6.2831853));
    const ring = sqrt(float(1).sub(z.mul(z)).max(float(0)));
    const r = float(slugRadiusGrid()).mul(u3.pow(float(1 / 3)));
    const dir = vec3(ring.mul(cos(phi)), z, ring.mul(sin(phi)));
    pos.element(p).assign(vec3(slugCenter.x, slugCenter.y, slugCenter.z).add(dir.mul(r)));
    vel.element(p).assign(vec3(slugVel.x, slugVel.y, slugVel.z));
    c0.element(p).assign(vec3(0, 0, 0));
    c1.element(p).assign(vec3(0, 0, 0));
    c2.element(p).assign(vec3(0, 0, 0));
    foam.element(p).assign(float(0));
  })().compute(SLUG_COUNT);

  return { resetDam, fireSlug, uniforms: { slugStart, slugCenter, slugVel, seed } };
}

/** Grid-unit radius of the fired slug's spawn ball (rest density inside). */
export function slugRadiusGrid(): number {
  return Math.cbrt((3 * SLUG_COUNT) / (4 * Math.PI * MPM_REST_DENSITY));
}

/** Grid-unit edge length of the full dam block. */
export function damSideGrid(count: number): number {
  return Math.ceil(Math.cbrt(count)) * Math.cbrt(1 / MPM_REST_DENSITY);
}
