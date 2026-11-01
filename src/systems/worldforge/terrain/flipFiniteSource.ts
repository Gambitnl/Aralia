/**
 * A finite, nonrecycling source for the existing GPU particle-water solver.
 *
 * Each scheduled packet owns a declared volume and can enter one buffer slot
 * once. Unreleased slots stay out of all transfers. Ending the schedule stops
 * admission, not the motion of water already released. This replaces neither
 * the river's source authority nor its receiver: callers must arrange that
 * handoff before using these packets as coupled river water.
 *
 * This is source infrastructure, not a qualification of MLS-MPM pressure,
 * terrain contact, optical thickness, incompressibility or thin-sheet resolution.
 * The original demo's recycling slug controls remain a separate API.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 14:25:12
 * Dependents: systems/worldforge/terrain/flipSourceMoments.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { Fn, If, float, instanceIndex, int, storage, uint } from 'three/tsl';
import { StorageBufferAttribute } from 'three/webgpu';
import { buildFlipKernels, MPM_REST_DENSITY, simSecondsPerUnit, type FlipBuffers, type FlipParams, type SpanGround, type FlipKernelOptions } from './flipCompute';

export interface FiniteWaterPacket {
  /** Physical source identity; duplicates are rejected rather than admitted twice. */
  id: string;
  /** Admission at this solver-step boundary. No render clock controls emission. */
  birthStep: number;
  volumeM3: number;
  positionM: [number, number, number];
  velocityMps: [number, number, number];
  /** APIC polynomial columns expressed in 1/s, not a random jitter.
   * DEBT: Copying a continuum gradient here does not preserve the finite
   * parcel's kinetic energy. The y76 waterfall inlet audit adds 101% grid
   * energy at dx=.25. Use flipSourceMoments for the finite ballistic material
   * moment mapping and measure its remaining loss. This raw option does not
   * establish a qualified inlet or a pressure-coupled upstream boundary.
   */
  affinePerSecond?: [number, number, number, number, number, number, number, number, number];
}

export interface FiniteSourcePlan {
  params: FlipParams;
  packets: readonly FiniteWaterPacket[];
  positions: Float32Array;
  velocities: Float32Array;
  masses: Float32Array;
  affine: Float32Array;
  birthSteps: Uint32Array;
  requestedVolumeM3: number;
  /** Rest-volume represented by f32 mass, independent of rendered surface volume. */
  representedVolumeM3: number;
  particleVolumeUnitM3: number;
}

/** Validate the complete release before allocating or changing any GPU water. */
export function planFiniteSource(params: FlipParams, packets: readonly FiniteWaterPacket[]): FiniteSourcePlan {
  if (!Number.isInteger(params.n) || params.n < 10 || !Number.isInteger(params.count) || params.count < 1
      || !(params.dx > 0) || !Number.isFinite(params.dx) || !params.origin.every(Number.isFinite)) {
    throw new Error('Invalid finite-source domain');
  }
  if (packets.length > params.count) throw new Error('Finite source exceeds capacity; existing water cannot be recycled');
  const positions = new Float32Array(params.count * 3);
  const velocities = new Float32Array(params.count * 3);
  const masses = new Float32Array(params.count);
  const affine = new Float32Array(params.count * 12);
  const birthSteps = new Uint32Array(params.count).fill(0xffffffff);
  const volumeUnit = params.dx ** 3 / MPM_REST_DENSITY;
  const timeUnit = simSecondsPerUnit(params.dx);
  const ids = new Set<string>();
  let requestedVolumeM3 = 0;
  let representedVolumeM3 = 0;
  packets.forEach((packet, p) => {
    if (!packet.id || ids.has(packet.id)) throw new Error('Duplicate or missing source packet identity');
    ids.add(packet.id);
    if (!Number.isInteger(packet.birthStep) || packet.birthStep < 0 || packet.birthStep >= 0xffffffff
        || !(packet.volumeM3 > 0) || !Number.isFinite(packet.volumeM3)
        || !packet.positionM.every(Number.isFinite) || !packet.velocityMps.every(Number.isFinite)) {
      throw new Error('Invalid finite water packet');
    }
    for (let axis = 0; axis < 3; axis++) {
      const grid = (packet.positionM[axis] - params.origin[axis]) / params.dx;
      // Keep source support out of the inherited predictive box-wall layer.
      // This is not a test for terrain clearance; the caller must verify that.
      if (grid < 4 || grid > params.n - 5) throw new Error('Source packet overlaps domain wall support');
      positions[p * 3 + axis] = grid;
      velocities[p * 3 + axis] = packet.velocityMps[axis] * timeUnit / params.dx;
      if (!Number.isFinite(velocities[p * 3 + axis])) throw new Error('Source velocity exceeds f32 representation');
    }
    if (packet.affinePerSecond && (packet.affinePerSecond.length !== 9 || !packet.affinePerSecond.every(Number.isFinite))) {
      throw Error('Invalid source affine velocity');
    }
    for (let column = 0; column < 3; column++) for (let axis = 0; axis < 3; axis++) {
      const i = p * 12 + column * 4 + axis;
      affine[i] = (packet.affinePerSecond?.[column * 3 + axis] ?? 0) * timeUnit;
      if (!Number.isFinite(affine[i])) throw Error('Source affine velocity exceeds f32 representation');
    }
    masses[p] = packet.volumeM3 / volumeUnit;
    if (!(masses[p] > 0) || !Number.isFinite(masses[p])) throw new Error('Source mass exceeds f32 representation');
    birthSteps[p] = packet.birthStep;
    requestedVolumeM3 += packet.volumeM3;
    representedVolumeM3 += masses[p] * volumeUnit;
  });
  return {
    params: { ...params, origin: [...params.origin] },
    packets: packets.map(packet => ({ ...packet, positionM: [...packet.positionM], velocityMps: [...packet.velocityMps], affinePerSecond: packet.affinePerSecond ? [...packet.affinePerSecond] : undefined })),
    positions, velocities, masses, affine, birthSteps, requestedVolumeM3, representedVolumeM3,
    particleVolumeUnitM3: volumeUnit,
  };
}

/** Read back actual admission, not expected wall time or a submitted dispatch. */
export function finiteSourceInventory(plan: FiniteSourcePlan, observedMasses: ArrayLike<number>, observedStates?: ArrayLike<number>) {
  if (observedMasses.length !== plan.masses.length) throw new Error('Wrong source readback length');
  if (observedStates && observedStates.length !== plan.masses.length) throw new Error('Wrong lifecycle readback length');
  let admittedVolumeM3 = 0;
  let pendingVolumeM3 = 0;
  let admittedPackets = 0;
  let exportedVolumeM3 = 0;
  let exportedPackets = 0;
  for (let p = 0; p < plan.masses.length; p++) {
    const mass = observedMasses[p];
    const state = observedStates?.[p] ?? (mass > 0 ? 1 : 0);
    if (!Number.isFinite(mass) || (mass !== 0 && mass !== plan.masses[p])) {
      throw new Error('Unrecognized source ownership state');
    }
    if (![0, 1, 2].includes(state) || (state === 1 ? !(mass > 0) : mass !== 0)
        || (state !== 0 && !(plan.masses[p] > 0))) throw new Error('Inconsistent source lifecycle');
    if (mass > 0) {
      admittedPackets++;
      admittedVolumeM3 += mass * plan.particleVolumeUnitM3;
    } else if (state === 2) {
      admittedPackets++;
      exportedPackets++;
      const volume = plan.masses[p] * plan.particleVolumeUnitM3;
      admittedVolumeM3 += volume;
      exportedVolumeM3 += volume;
    } else {
      pendingVolumeM3 += plan.masses[p] * plan.particleVolumeUnitM3;
    }
  }
  return {
    admittedPackets, admittedVolumeM3, pendingVolumeM3,
    representationDifferenceM3: plan.representedVolumeM3 - plan.requestedVolumeM3,
    ownedRestVolumeM3: admittedVolumeM3 - exportedVolumeM3,
    exportedPackets, exportedVolumeM3,
  };
}

export interface FiniteExportSnapshot {
  /** Read all these buffers after a completed step, with the queue held still. */
  step: number;
  masses: ArrayLike<number>;
  states: ArrayLike<number>;
  positions: ArrayLike<number>;
  velocities: ArrayLike<number>;
  /** GPU vec3 readback uses four floats per element, including padding. */
  affineColumns: [ArrayLike<number>, ArrayLike<number>, ArrayLike<number>];
}

export interface FiniteExportRecord {
  readonly slot: number;
  readonly id: string;
  readonly volumeM3: number;
  readonly positionM: readonly number[];
  readonly velocityMps: readonly number[];
  readonly affinePerSecond: readonly number[];
  readonly centerKineticJ: number;
  readonly affineKineticJ: number;
  readonly potentialJ: number;
}

export interface FiniteExportBatch {
  readonly step: number;
  readonly records: readonly FiniteExportRecord[];
}

// A batch is a copy of actual water, not permission to discard it. Only its
// source owner may commit it, after a named receiver has accepted every record.
const exportPlans = new WeakMap<FiniteExportBatch, FiniteSourcePlan>();
export function captureFiniteExports(plan: FiniteSourcePlan, snapshot: FiniteExportSnapshot, slots: readonly number[]): FiniteExportBatch {
  finiteSourceInventory(plan, snapshot.masses, snapshot.states);
  if (!Number.isInteger(snapshot.step) || snapshot.step < 0 || snapshot.step >= 0xffffffff) throw Error('Invalid export step');
  if (snapshot.positions.length !== plan.params.count * 4 || snapshot.velocities.length !== plan.params.count * 4
      || snapshot.affineColumns.some(column => column.length !== plan.params.count * 4)) throw Error('Wrong export motion readback length');
  if (!slots.length || new Set(slots).size !== slots.length) throw Error('Empty or duplicate export selection');
  const time = simSecondsPerUnit(plan.params.dx);
  const records = slots.map(slot => {
    if (!Number.isInteger(slot) || slot < 0 || slot >= plan.packets.length || snapshot.states[slot] !== 1
        || plan.birthSteps[slot] >= snapshot.step) throw Error('Export requires a completed resident packet');
    const positionM = [0, 1, 2].map(axis => snapshot.positions[slot * 4 + axis] * plan.params.dx + plan.params.origin[axis]);
    const velocityMps = [0, 1, 2].map(axis => snapshot.velocities[slot * 4 + axis] * plan.params.dx / time);
    const affinePerSecond = snapshot.affineColumns.flatMap(column => [0, 1, 2].map(axis => column[slot * 4 + axis] / time));
    if (![...positionM, ...velocityMps, ...affinePerSecond].every(Number.isFinite)) throw Error('Nonfinite exported water');
    const volumeM3 = snapshot.masses[slot] * plan.particleVolumeUnitM3, massKg = 1000 * volumeM3;
    return Object.freeze({ slot, id: plan.packets[slot].id, volumeM3,
      centerKineticJ: .5 * massKg * velocityMps.reduce((s, v) => s + v * v, 0),
      affineKineticJ: .5 * massKg * plan.params.dx ** 2 / 4 * affinePerSecond.reduce((s, v) => s + v * v, 0),
      potentialJ: massKg * 9.81 * positionM[1],
      positionM: Object.freeze(positionM), velocityMps: Object.freeze(velocityMps), affinePerSecond: Object.freeze(affinePerSecond) });
  });
  const batch = Object.freeze({ step: snapshot.step, records: Object.freeze(records) });
  exportPlans.set(batch, plan);
  return batch;
}

/**
 * Bind only to fresh buffers. Order: admit, the five solver passes, finishStep.
 * The GPU step clock avoids multiple queued substeps seeing one final CPU
 * uniform value. There is deliberately no reset/recycle API on this owner.
 * Keep the returned masses passed into buildFlipKernels; omitting that argument
 * would make unadmitted slots contribute fictitious water.
 */
const ownedBuffers = new WeakSet<FlipBuffers>();

export function buildFiniteSource(bufs: FlipBuffers, plan: FiniteSourcePlan) {
  const count = bufs.params.count;
  if (ownedBuffers.has(bufs)) throw new Error('Buffers already have a finite source owner');
  if (plan.masses.length !== count || plan.params.n !== bufs.params.n || plan.params.dx !== bufs.params.dx
      || plan.params.origin.some((value, axis) => value !== bufs.params.origin[axis])) {
    throw new Error('Source plan and buffer domain differ');
  }
  for (const buffer of [bufs.pos, bufs.vel, bufs.c0, bufs.c1, bufs.c2, bufs.foam]) {
    if (buffer.array.some(value => value !== 0)) throw new Error('Finite source requires fresh empty buffers');
  }
  const massBuffer = new StorageBufferAttribute(new Float32Array(count), 1);
  // Pending -> resident -> exported is irreversible. Zero mass alone cannot
  // distinguish future water from water already accepted by another owner.
  const stateBuffer = new StorageBufferAttribute(new Uint32Array(count), 1);
  const clockBuffer = new StorageBufferAttribute(new Uint32Array(1), 1);
  const incomingPosition = new StorageBufferAttribute(plan.positions.slice(), 3);
  const incomingVelocity = new StorageBufferAttribute(plan.velocities.slice(), 3);
  const incomingMass = new StorageBufferAttribute(plan.masses.slice(), 1);
  const incomingStep = new StorageBufferAttribute(plan.birthSteps.slice(), 1);
  const incomingAffine = new StorageBufferAttribute(plan.affine.slice(), 4);
  const masses = storage(massBuffer, 'float', count);
  const states = storage(stateBuffer, 'uint', count);
  const clock = storage(clockBuffer, 'uint', 1);
  const sourcePosition = storage(incomingPosition, 'vec3', count).toReadOnly();
  const sourceVelocity = storage(incomingVelocity, 'vec3', count).toReadOnly();
  const sourceMass = storage(incomingMass, 'float', count).toReadOnly();
  const sourceAffine = storage(incomingAffine, 'vec4', count * 3).toReadOnly();
  const sourceStep = storage(incomingStep, 'uint', count).toReadOnly();
  const pos = storage(bufs.pos, 'vec3', count);
  const vel = storage(bufs.vel, 'vec3', count);
  const c0 = storage(bufs.c0, 'vec3', count);
  const c1 = storage(bufs.c1, 'vec3', count);
  const c2 = storage(bufs.c2, 'vec3', count);
  const foam = storage(bufs.foam, 'float', count);
  const admit = Fn(() => {
    const p = int(instanceIndex);
    If(states.element(p).equal(uint(0)).and(masses.element(p).equal(float(0)))
      .and(sourceMass.element(p).greaterThan(float(0)))
      .and(sourceStep.element(p).lessThanEqual(clock.element(uint(0)))), () => {
      pos.element(p).assign(sourcePosition.element(p));
      vel.element(p).assign(sourceVelocity.element(p));
      c0.element(p).assign(sourceAffine.element(p.mul(int(3))).xyz);
      c1.element(p).assign(sourceAffine.element(p.mul(int(3)).add(int(1))).xyz);
      c2.element(p).assign(sourceAffine.element(p.mul(int(3)).add(int(2))).xyz);
      foam.element(p).assign(float(0));
      masses.element(p).assign(sourceMass.element(p));
      states.element(p).assign(uint(1));
    });
  })().compute(count);
  const finishStep = Fn(() => {
    clock.element(uint(0)).addAssign(uint(1));
  })().compute(1);
  ownedBuffers.add(bufs);
  return {
    admit, finishStep, massBuffer, stateBuffer, clockBuffer,
    /** The caller must retain the accepted motion/affine records under this
     * receipt before dispatch, then confirm state=2 by GPU readback. Hold the
     * solver queue between capture and commit. A stale step commits nothing.
     * This whole-packet handoff is not a geometric face-flux boundary and does
     * not prove clearance of the rock, downstream physics or surface volume.
     */
    acknowledgeExports: (batch: FiniteExportBatch, acknowledgment: { owner: string; receiptId: string; packetIds: readonly string[] }) => {
      if (exportPlans.get(batch) !== plan) throw Error('Export batch belongs to another source');
      if (!acknowledgment.owner.trim() || !acknowledgment.receiptId.trim()
          || acknowledgment.packetIds.length !== batch.records.length
          || new Set(acknowledgment.packetIds).size !== batch.records.length
          || batch.records.some(record => !acknowledgment.packetIds.includes(record.id))) throw Error('Incomplete receiver acknowledgment');
      const slotsBuffer = new StorageBufferAttribute(new Uint32Array(batch.records.map(record => record.slot)), 1);
      const slots = storage(slotsBuffer, 'uint', batch.records.length).toReadOnly();
      const commit = Fn(() => {
        const p = int(slots.element(instanceIndex));
        If(clock.element(uint(0)).equal(uint(batch.step)).and(states.element(p).equal(uint(1))), () => {
          masses.element(p).assign(float(0));
          states.element(p).assign(uint(2));
        });
      })().compute(batch.records.length);
      return { commit, buffers: [slotsBuffer], batch,
        acknowledgment: Object.freeze({ owner: acknowledgment.owner, receiptId: acknowledgment.receiptId }) };
    },
    /** Prefer this bound factory: it cannot accidentally omit the inactive-slot mask. */
    buildKernels: (ground: SpanGround, options?: FlipKernelOptions) => buildFlipKernels(bufs, ground, massBuffer, options),
    buffers: [massBuffer, stateBuffer, clockBuffer, incomingPosition, incomingVelocity, incomingMass, incomingStep, incomingAffine],
  };
}
