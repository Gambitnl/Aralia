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
 * box wall. Grid nodes and particles both collide against the same column
 * heights the terrain mesh renders from.
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
  float,
  instanceIndex,
  int,
  storage,
  uniform,
  vec3,
} from 'three/tsl';
import { StorageBufferAttribute } from 'three/webgpu';
import type { ComputeNode } from 'three/webgpu';

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

export function buildFlipKernels(
  bufs: FlipBuffers,
  terrainH: StorageBufferAttribute,
  terrainN: number,
  terrainCell: number,
): FlipKernels {
  const { n, dx, origin, count } = bufs.params;
  const nodes = n ** 3;

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
  const terr = storage(terrainH, 'float', terrainH.count).toReadOnly();

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

  /** Terrain height at a GRID (x, z), returned in GRID units above origin. */
  const groundAt = (gx: TSLNode, gz: TSLNode) => {
    const wx = gx.mul(float(dx)).add(float(origin[0]));
    const wz = gz.mul(float(dx)).add(float(origin[2]));
    const cx = wx.div(float(terrainCell)).floor().toInt().clamp(int(0), int(terrainN - 1));
    const cz = wz.div(float(terrainCell)).floor().toInt().clamp(int(0), int(terrainN - 1));
    return terr.element(cz.mul(int(terrainN)).add(cx)).sub(float(origin[1])).div(float(dx));
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
      If(ix.lessThan(int(2)).or(ix.greaterThan(N.sub(int(3)))), () => v.x.assign(float(0)));
      If(iy.greaterThan(N.sub(int(3))), () => v.y.assign(v.y.min(float(0))));
      If(iz.lessThan(int(2)).or(iz.greaterThan(N.sub(int(3)))), () => v.z.assign(float(0)));

      // The floor is the terrain. At or under the surface: nothing enters
      // the ground, and friction eats most of the slide.
      const ground = groundAt(float(ix), float(iz));
      If(float(iy).lessThan(ground.add(float(1))), () => {
        v.y.assign(v.y.max(float(0)));
        v.x.mulAssign(float(0.6));
        v.z.mulAssign(float(0.6));
      });

      gMomXU.element(i).assign(encode(v.x));
      gMomYU.element(i).assign(encode(v.y));
      gMomZU.element(i).assign(encode(v.z));
    });
  })().compute(nodes);

  const g2p = Fn(() => {
    const p = int(instanceIndex);
    const xp = pos.element(p).toVar();

    const vNew = vec3(0, 0, 0).toVar();
    const b0 = vec3(0, 0, 0).toVar();
    const b1 = vec3(0, 0, 0).toVar();
    const b2 = vec3(0, 0, 0).toVar();
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
    If(xAhead.x.lessThan(wallMin), () => vNew.x.addAssign(wallMin.sub(xAhead.x).mul(K)));
    If(xAhead.x.greaterThan(wallMax), () => vNew.x.addAssign(wallMax.sub(xAhead.x).mul(K)));
    If(xAhead.y.greaterThan(wallMax), () => vNew.y.addAssign(wallMax.sub(xAhead.y).mul(K)));
    If(xAhead.z.lessThan(wallMin), () => vNew.z.addAssign(wallMin.sub(xAhead.z).mul(K)));
    If(xAhead.z.greaterThan(wallMax), () => vNew.z.addAssign(wallMax.sub(xAhead.z).mul(K)));

    // The terrain floor, in the same soft style, plus a hard safety clamp.
    const ground = groundAt(xNew.x, xNew.z);
    If(xAhead.y.lessThan(ground.add(float(1))), () => {
      vNew.y.addAssign(ground.add(float(1)).sub(xAhead.y).mul(K));
    });
    If(xNew.y.lessThan(ground.add(float(0.5))), () => {
      xNew.y.assign(ground.add(float(0.5)));
      vNew.y.assign(vNew.y.max(float(0)));
    });

    pos.element(p).assign(xNew);
    vel.element(p).assign(vNew);
  })().compute(count);

  return { clearGrid, p2g1, p2g2, gridUpdate, g2p, uniforms: { dt: dtU } };
}
