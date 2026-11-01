/**
 * @file riverWorker.ts — the worker entry that builds the judged reach, runs
 * its flow to a steady state and builds its flow map, off the main thread.
 *
 * The run is about 11 s of work on this machine (the solver's 80 s of flow on
 * 36,000 active cells), which would freeze a page for that long. The worker
 * posts progress, then one message with every array the scene needs, moved
 * (transferred), not copied.
 *
 * Messages in:  { seed: number, shape?: RiverShape } (the shape from the river
 *                scene's panel; none means the judged default)
 * Messages out: { type: 'progress', f: 0..1, stage: string }
 *               { type: 'done', data: RiverReachData }
 *               { type: 'error', message: string }
 *
 * THE LIVE ROLE (2026-09-29, the live river editor): a 'live-start' message
 * turns the worker into the live solver (see `runLiveRole`, RiverLiveIn):
 * out go 'live-init' (a cold start's ground and rocks), 'live-ready',
 * 'live-patch' (each edit's bed patch), 'live-status' (a few times a second)
 * and 'live-error'; the field frames go to the flow-map worker's port.
 * Explicit 'live-inspect-cells' requests return at most 64 raw current cells.
 * They never make a displayed frame or advance the solver, including while paused.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 17/10/2026, 03:44:34
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx, components/World3D/water/riverDroppedObjectsView.ts, components/World3D/water/riverFloatersView.ts, components/World3D/water/riverFlowBlockersView.ts, components/World3D/water/riverLiveClient.ts, components/World3D/water/riverReachScene.ts, components/World3D/water/riverReceivingRefiner.ts, components/World3D/water/riverSurfaceMirror.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverTerrainBrushCommand, TerrainBrushBounds } from './riverTerrainBrush';
import {
  buildRiverReach, getRiverShape, isDefaultRiverShape, setRiverShape, setRiverWorldBed, RIVER_RENDER_DOMAIN,
  type Boulder, type RiverGridSpec, type RiverShape,
} from './riverReach';
import type { RiverWorldBedInit, RiverWorldCarry, WorldFineGroundPatch } from './riverWorldBed';
import { solveReach, buildFlowMap, countEddyCells } from './riverFlowField';
import type { RiverFlowMapStats } from './riverFlowField';
import type { RiverSolverStats } from './riverSolver';
import type { RiverGpuExecutor, RiverGpuFaceHandler, RiverGpuFaces, RiverGpuOutput } from './riverGpuStep';
import type { RiverGpuResidentExecutor, RiverGpuResidentOutput } from './riverGpuResident';
import { RiverWorkMeter } from './riverWorkMeter';
import { RiverSliceScheduler } from './riverSliceScheduler';
import type { RiverFloodOptions } from './riverFloodSurge';
import type { LiveCellInspection } from './riverCellInspection';
import {
  LiveRiver, RIVER_LIVE, liveFrameTransfer, liveMapperPatchTransfer, livePatchTransfer, type RiverEditState,
} from './riverLive';

/** Everything the scene draws and measures, as plain arrays. */
export interface RiverReachData {
  seed: number;
  /** The shape it was built with (the panel's); absent in data cached before the panel. */
  shape?: RiverShape;
  grid: RiverGridSpec;
  /** Ground (no boulders) at each solver cell center, m. */
  ground: Float32Array;
  /** The outer ground on a 2 m lattice over the render domain, m. */
  outer: { x0: number; z0: number; step: number; nx: number; nz: number; heights: Float32Array };
  boulders: Boulder[];
  /** Flow map (see RiverFlowMap). */
  t0: Float32Array;
  t1: Float32Array;
  /** Rock surface features (see RiverFlowMap.t2). */
  t2: Float32Array;
  surface: Float32Array;
  /** The steady field itself, for the measured half: depth and velocity. */
  h: Float32Array;
  u: Float32Array;
  v: Float32Array;
  uRms: Float32Array;
  /** Course samples (x, z, s, tx, tz) every 1 m, for poses and measurements. */
  course: Float32Array;
  solverStats: RiverSolverStats;
  mapStats: RiverFlowMapStats;
  eddyCells: number;
  buildMs: number;
}

/** The outer lattice step, m. */
export const RIVER_OUTER_STEP_M = 2;

/** Build everything in the calling thread (the worker calls this; so do Node tests). */
export function buildRiverReachData(seed: number, onProgress?: (f: number, stage: string) => void): RiverReachData {
  const t0 = Date.now();
  onProgress?.(0, 'reach');
  const reach = buildRiverReach(seed);
  onProgress?.(0.05, 'flow');
  const field = solveReach(reach, { onProgress: (f) => onProgress?.(0.05 + 0.8 * f, 'flow') });
  onProgress?.(0.86, 'flow map');
  const map = buildFlowMap(field, reach.ground, reach.manning, reach.boulders);
  const eddyCells = countEddyCells(field, reach);
  onProgress?.(0.9, 'valley');
  const D = RIVER_RENDER_DOMAIN;
  const step = RIVER_OUTER_STEP_M;
  const onx = Math.floor((D.x1 - D.x0) / step) + 1;
  const onz = Math.floor((D.z1 - D.z0) / step) + 1;
  const heights = new Float32Array(onx * onz);
  for (let j = 0; j < onz; j += 1) {
    for (let i = 0; i < onx; i += 1) heights[j * onx + i] = reach.terrainHeight(D.x0 + i * step, D.z0 + j * step);
  }
  const cs: number[] = [];
  for (let s = -120; s <= 400; s += 1) {
    const p = reach.course.at(s);
    cs.push(p.x, p.z, p.s, p.tx, p.tz);
  }
  return {
    seed,
    shape: { ...getRiverShape() },
    grid: reach.grid,
    ground: Float32Array.from(reach.ground),
    outer: { x0: D.x0, z0: D.z0, step, nx: onx, nz: onz, heights },
    boulders: reach.boulders,
    t0: map.t0,
    t1: map.t1,
    t2: map.t2,
    surface: map.surface,
    h: field.h,
    u: field.u,
    v: field.v,
    uRms: field.uRms,
    course: Float32Array.from(cs),
    solverStats: field.stats,
    mapStats: map.stats,
    eddyCells,
    buildMs: Date.now() - t0,
  };
}

/** The buffers of a RiverReachData, for a transfer list. */
export function riverReachTransfer(d: RiverReachData): ArrayBuffer[] {
  return [d.ground, d.outer.heights, d.t0, d.t1, d.t2, d.surface, d.h, d.u, d.v, d.uRms, d.course].map((a) => a.buffer as ArrayBuffer);
}

/** How the live solver paces itself (see `runLiveRole`). */
export type RiverLiveSpeed = 'auto' | 'realtime' | 'fast';

/** How often the live solver sends a field frame to the flow mapper, ms. */
export const RIVER_LIVE_FRAME_MS = 250;

/** The live role's messages in (from the page). */
export type RiverLiveIn =
  | {
    type: 'live-start'; seed: number; edit: RiverEditState; speed: RiverLiveSpeed; headwaters?: boolean; spill?: boolean; contactWaterfall?: boolean;
    /** Full reference-scale serial course; retains the original source only. */
    reconstructed?: boolean;
    /** Hold the initial physical state through ready; explicit live-pause false resumes it. */
    startPaused?: boolean;
    /** Source-only inspection: no cached or design-level initial water. */
    dryStart?: boolean;
    /** With dryStart: fill every basin to its spill level (LiveRiver.fillBasinsToSpill, GG-427). */
    fillBasins?: boolean;
    /** With fillBasins: a saved steady run to start from (LiveRiver.startWarm); a mismatch fills the basins instead and says why. */
    warmState?: ArrayBuffer;
    /** Candidate backend uses the page renderer's device through serialized RPC. */
    gpu?: boolean;
    resident?: boolean;
    /** A hidden page retains its initial state until it becomes visible. */
    startSuspended?: boolean;
    /** The junction remains an explicit experimental preview selection. */
    contactImpactMode?: 'absorb' | 'junction';
    /** Unique client/worker incarnation, echoed only by explicit cell inspection replies. */
    workerRunId: string;
    /** A steady field to start from (the page's cached one), or none: start from the design level. */
    field: { h: Float32Array; u: Float32Array; v: Float32Array; uRms: Float32Array; t1: Float32Array } | null;
    /** The port to the flow-map worker (riverMapWorker.ts). */
    mapPort: MessagePort;
    /** The game world's terrain and river line as the bed (ADR 0009 slice 10); absent: the page's seeded valley. */
    worldBed?: RiverWorldBedInit;
    /** With worldBed and no field: the previous reach's water, taken where its box overlaps (one water, step 1). */
    carry?: RiverWorldCarry;
  }
  | { type: 'live-edit'; edit: RiverEditState }
  | { type: 'live-terrain'; requestId: number; commands: RiverTerrainBrushCommand[] }
  /** The world's one ground changed (groundRecord.ts, GG-533): new fine-ground values and the river-local box. */
  | { type: 'live-world-ground'; requestId: number; patch: WorldFineGroundPatch; box: TerrainBrushBounds }
  /** Copies of the solver's water and bed, for the next reach (one water, step 1, 2026-10-30). */
  | { type: 'live-export-water'; requestId: number }
  | { type: 'live-gpu-ready' }
  | { type: 'live-gpu-faces'; id: number; faces: RiverGpuFaces }
  | { type: 'live-gpu-result'; id: number; output?: RiverGpuOutput; error?: string }
  | { type: 'live-gpu-resident-result'; id: number; output?: RiverGpuResidentOutput; error?: string }
  | { type: 'live-speed'; speed: RiverLiveSpeed }
  | { type: 'live-pause'; paused: boolean }
  | { type: 'live-suspend'; suspended: boolean }
  | { type: 'live-source-pause'; paused: boolean }
  | { type: 'live-contact-waterfall'; enabled: boolean; impactMode?: 'absorb' | 'junction' }
  | ({ type: 'live-flood' } & RiverFloodOptions)
  | { type: 'live-flood-cancel' }
  /** On-demand raw inventory read, with no frame or advancement side effect. */
  | { type: 'live-inspect-cells'; requestId: number; workerRunId: string; cellIds: number[] }
  /** Top the channel up to the design level (LiveRiver.topUpToDesignLevel). */
  | { type: 'live-topup' };

/**
 * THE LIVE ROLE (the live river, 2026-09-29): the worker keeps a LiveRiver
 * and steps its solver without end, in slices of about 24 ms so the page's
 * edits get in between.
 *
 * - SPEED. 'fast' steps as fast as the worker can (about 7 times real time
 *   here); 'realtime' keeps the flow's clock on the wall clock; 'auto' (the
 *   default) runs fast after the start and after each edit until the river
 *   settles (RIVER_LIVE: at least fastAfterEditS of flow, then until the
 *   outflow is within settleShare of the inflow, at most fastMaxS), then
 *   in real time.
 * - FRAMES. Every RIVER_LIVE_FRAME_MS the field's smoothed mean goes to the
 *   flow-map worker as a frame; it makes the flow map and the sheet and sends
 *   them to the page.
 * - EDITS. An edit waits for the next slice; a newer one replaces an older one
 *   not yet applied. Each patch goes to the page (the ground, the rocks) and
 *   to the flow-map worker (the bed).
 */
function runLiveRole(
  post: (m: unknown, t?: Transferable[]) => void,
  start: Extract<RiverLiveIn, { type: 'live-start' }>,
): { onMessage: (m: RiverLiveIn) => void } {
  const port = start.mapPort;
  let live: LiveRiver | null = null;
  let pendingEdit: RiverEditState | null = null;
  const workerRunId = start.workerRunId;
  let observationSequence = 0;
  let gpuReady = false;
  let slicePending = false;
  let gpuSequence = 0;
  let gpuPending: { id: number; at: number; cells: number; resolve: (value: RiverGpuOutput) => void; reject: (error: Error) => void; spill?: RiverGpuFaceHandler; cpuMs: number } | null = null;
  let gpuTiming: { cells: number; requestMs: number; deviceExchangeMs: number;mode:'resident'|'synchronized';steps:number;reason?:string|null;changedCells?:number;uploadBytes?:number;awakeCells?:number;spillLaunches?:number } | null = null;
  let residentPending:{id:number;at:number;cells:number;resolve:(output:RiverGpuResidentOutput)=>void;reject:(error:Error)=>void}|null=null;
  const queuedMessages: RiverLiveIn[] = [];
  // Worker work done while a resident interval is on the device (the field
  // frame); it is busy time, not device wait.
  let overlapMs = 0;
  const executeGpu: RiverGpuExecutor = (input, spill) => new Promise((resolve, reject) => {
    if (gpuPending) { reject(Error('River GPU request overlap')); return; }
    const id = ++gpuSequence, at = performance.now();
    // Device wait excludes the worker's own airborne face work during the step.
    const pending = { id, at, cells: input.nx * input.nz, resolve: (output: RiverGpuOutput) => { work.add('wait', performance.now() - at - pending.cpuMs); resolve(output); }, reject, spill, cpuMs: 0 };
    gpuPending = pending;
    post({ type: 'live-gpu-step', id, input, spill: !!spill }, [input.state.buffer as ArrayBuffer, input.source.buffer as ArrayBuffer, input.topology.buffer as ArrayBuffer, ...(input.activeCells ? [input.activeCells.buffer as ArrayBuffer] : [])]);
  });
  const executeResident:RiverGpuResidentExecutor=input=>new Promise((resolve,reject)=>{
    if(gpuPending||residentPending){reject(Error('River GPU request overlap'));return;}
    const id=++gpuSequence,at=performance.now();
    // The worker thread is idle while the device runs: count that time as
    // device wait, not worker busy time (RiverWorkMeter).
    overlapMs=0;
    residentPending={id,at,cells:input.nx*input.nz,resolve:output=>{work.add('wait',performance.now()-at-overlapMs);resolve(output);},reject};
    // Only the changed rows and cells cross to the page (2026-10-21).
    const {full,rows,cells}=input.upload;
    const arrays=[full?.state,full?.source,full?.flags,rows?.state,rows?.source,rows?.flags,cells?.index,cells?.source,cells?.flags,cells?.state];
    post({type:'live-gpu-resident',id,input},arrays.filter((a):a is NonNullable<typeof a>=>!!a).map(a=>a.buffer as ArrayBuffer));
  });
  // A top-up waits for the next slice, after any waiting edit (it fills to
  // the design level of the river as edited).
  let topUpDue = false;
  /** How the water started (warm start, or filled basins and why), for the page. */
  let startNote: string | undefined;
  let speed: RiverLiveSpeed = start.speed;
  // Set the pause before scheduling the first slice. Pausing after ready races
  // that slice; initialization and the initial frame may still complete here.
  let paused = start.startPaused ?? false;
  let suspended = start.startSuspended ?? false;
  // THE AUTO PACE (see RIVER_LIVE.settleShare): when the start or the last
  // edit was, the smoothed outflow, and whether the river has settled.
  let editAt = 0;
  let settled = false;
  let qOutSmooth = Number.NaN;
  const isFast = (): boolean => speed === 'fast' || (speed === 'auto' && !settled);
  const unsettle = (): void => {
    editAt = live ? live.simTime : 0;
    settled = false;
    qOutSmooth = Number.NaN;
  };
  let rtWall = 0;
  let rtSim = 0;
  let lastFrame = 0;
  let frameDue = true;
  // The rate over the last second of wall time.
  let rateWall = 0;
  let rateSim = 0;
  let rate = 0;
  let steps = 0;
  let stepsPerS = 0;
  let lastPatchMs = 0;
  let work = new RiverWorkMeter(performance.now());
  const mc = new MessageChannel();
  const scheduler = new RiverSliceScheduler(() => mc.port2.postMessage(0));
  const soon = (): void => scheduler.soon();
  const applyEdit = (e: RiverEditState): void => {
    if (!live) return;
    const editStart = performance.now();
    const p = live.applyEdit(e);
    lastPatchMs = p.ms;
    const mp = live.mapperPatch(p);
    port.postMessage({ type: 'patch', patch: mp }, liveMapperPatchTransfer(mp));
    post({ type: 'live-patch', patch: p }, livePatchTransfer(p));
    unsettle();
    frameDue = true;
    work.add('edit', performance.now() - editStart);
  };
  const tick = async (): Promise<void> => {
    scheduler.beginSlice();
    if (!live || slicePending) return;
    slicePending = true;
    try {
    const sliceStart = performance.now();
    if (pendingEdit) {
      const e = pendingEdit;
      pendingEdit = null;
      applyEdit(e);
    }
    if (topUpDue) {
      topUpDue = false;
      const topUpStart = performance.now();
      const added = live.topUpToDesignLevel();
      unsettle();
      frameDue = true;
      post({ type: 'live-topup', added });
      work.add('edit', performance.now() - topUpStart);
    }
    const now = performance.now();
    // Closures keep the narrowed (non-null) river of this slice.
    const river = live;
    const frameWanted = (): boolean => !suspended && (frameDue || !paused) && now - lastFrame >= RIVER_LIVE_FRAME_MS;
    const emitFrame = (): void => {
      lastFrame = now;
      frameDue = false;
      const fieldStart = performance.now();
      const f = river.frame();
      work.add('field', performance.now() - fieldStart);
      if (f.dtS > 0) {
        const a = 1 - Math.exp(-f.dtS / 10);
        qOutSmooth = Number.isNaN(qOutSmooth) ? f.qOut : qOutSmooth + a * (f.qOut - qOutSmooth);
      }
      const since = river.simTime - editAt;
      if (!settled && since >= RIVER_LIVE.fastAfterEditS
        && (Math.abs(qOutSmooth - f.qIn) <= RIVER_LIVE.settleShare * f.qIn || since >= RIVER_LIVE.fastMaxS)) settled = true;
      const transferStart = performance.now();
      port.postMessage({ type: 'frame', frame: f }, liveFrameTransfer(f));
      work.add('transfer', performance.now() - transferStart);
      post({
        type: 'live-status', backend: start.gpu ? (gpuReady ? 'gpu' : 'gpu-waiting') : 'cpu', gpuTiming, simTime: river.simTime, rate, stepsPerS, frameMs: f.ms, patchMs: lastPatchMs,
        // The latest completed wall-clock window includes idle time. It is
        // separate from render CPU and may be up to a second old.
        work: work.reading, workAgeMs: work.reading ? performance.now() - work.reading.endedAt : null,
        speed, paused, suspended, fast: isFast(), qOutSmooth,
        restores: river.restores, healthy: river.lastHealth.ok, inflowDry: f.inflowDry, readout: f.readout,
        qIn: f.qIn, qOut: f.qOut, activeCells: f.activeCells, breachCells: f.breachCells, maxSpeed: f.maxSpeed,
        flood: river.flood,
        volume: f.volume, edgeWetCells: f.edgeWetCells, editLostM3: f.editLostM3, editAddedM3: f.editAddedM3, topUpM3: f.topUpM3, startNote,
      });
    };
    // 2026-10-21: the resident GPU interval runs while this worker builds the
    // field frame. The frame reads the last accepted state, which no code
    // changes until the interval returns, so it equals a frame made just
    // before the request. The CPU and synchronized paths keep their order.
    const advanceResident = async (maxSimS?: number): Promise<{ steps: number }> => {
      const pending = river.advanceResidentOnGpu(executeResident, executeGpu, 24, maxSimS);
      if (frameWanted()) {
        const overlapStart = performance.now();
        emitFrame();
        if (residentPending) overlapMs += performance.now() - overlapStart;
        else if (gpuPending) gpuPending.cpuMs += performance.now() - overlapStart;
      }
      return pending;
    };
    let caughtUp = false;
    if (!paused && !suspended && (!start.gpu || gpuReady)) {
      const fast = isFast();
      if (fast) {
        const advanceStart = performance.now(), waitStart = work.sliceWait;
        const fieldBefore = work.sliceField;
        const advanced = start.resident ? await advanceResident() : start.gpu ? await live.advanceOnGpu(executeGpu, 24) : live.advance(24);
        steps += advanced.steps;
        // Native receiver backpressure freezes the physical clock. Leave an
        // idle gap so edits can repair it without a zero-progress busy loop.
        if (advanced.steps === 0) caughtUp = true;
        work.add('advance', performance.now() - advanceStart - (work.sliceWait - waitStart) - (work.sliceField - fieldBefore));
        rtWall = performance.now();
        rtSim = live.simTime;
      } else {
        const target = rtSim + (now - rtWall) / 1000;
        if (live.simTime < target) {
          const advanceStart = performance.now(), waitStart = work.sliceWait;
          const fieldBefore = work.sliceField;
          const advanced = start.resident ? await advanceResident(target-live.simTime) : start.gpu ? await live.advanceOnGpu(executeGpu, 24, target - live.simTime) : live.advance(24, target - live.simTime);
          steps += advanced.steps;
          if (advanced.steps === 0) caughtUp = true;
          work.add('advance', performance.now() - advanceStart - (work.sliceWait - waitStart) - (work.sliceField - fieldBefore));
        }
        else caughtUp = true;
      }
    } else {
      rtWall = now;
      rtSim = live.simTime;
      caughtUp = true;
    }
    if (now - rateWall >= 1000) {
      rate = (live.simTime - rateSim) / ((now - rateWall) / 1000);
      stepsPerS = steps / ((now - rateWall) / 1000);
      rateWall = now;
      rateSim = live.simTime;
      steps = 0;
    }
    if (frameWanted()) emitFrame();
    const previousWindow = work.reading;
    work.finishSlice(sliceStart, performance.now());
    if (work.reading !== previousWindow) {
      // Pausing stops field emission, but must not leave a fast-mode busy
      // reading on screen. Report work without constructing another field.
      post({ type: 'live-work', work: work.reading, workAgeMs: 0, speed, paused, suspended, fast: isFast(), rate, stepsPerS });
    }
    // A hidden page has no recurring solver timer. Explicit edits and inspection
    // still work; becoming visible schedules the next slice with no catch-up.
    if (suspended || (start.gpu && !gpuReady)) return;
    if (caughtUp) scheduler.idle();
    else soon();
    } catch (err) {
      paused = true;
      post({ type: 'live-error', message: `[river] ${start.gpu ? 'GPU' : 'CPU'} stepping stopped: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      slicePending = false;
      // Edits, source changes and inspections observe complete accepted epochs.
      // A queued pause can never race an uploaded half-step.
      for (const message of queuedMessages.splice(0)) onMessage(message);
    }
  };
  mc.port1.onmessage = tick;
  // THE START: the judged reach (about 2 s), its noise (0.1 s), the water.
  let carriedCells = 0;
  try {
    post({ type: 'progress', f: 0.1, stage: 'live river' });
    // The world's bed, when the game world is the host (slice 10): set before
    // the reach is built, so the course, the ground and the keys read it.
    setRiverWorldBed(start.worldBed ?? null);
    live = new LiveRiver(start.seed, start.headwaters ?? false, start.spill ?? false,start.reconstructed??false);
    live.warmNoise();
    if (start.dryStart) {
      // The warm start, else the filled basins; the page shows which and why.
      const refused = start.warmState ? live.startWarm(start.warmState) : 'no warm-start file';
      if (refused === null) startNote = 'Started from the saved steady river (warm start).';
      else { live.startDry(); if (start.fillBasins) { live.fillBasinsToSpill(); startNote = `Started with full basins: ${refused}.`; } }
    }
    else if (start.field) live.startFromField(start.field);
    else {
      live.startCold();
      // One water, step 1 (2026-10-30): a reach moved along the world's river
      // takes the previous reach's water where the two boxes overlap.
      if (start.carry && start.worldBed) carriedCells = live.overlayCarry(start.carry, start.worldBed.frame);
    }
    if (start.contactWaterfall) live.setContactWaterfall(true, start.contactImpactMode ?? 'absorb');
    port.postMessage({ type: 'init', init: live.mapperInit() });
    const cold = !!start.dryStart || !start.field;
    if (cold) {
      const d = live.initialData();
      post({ type: 'live-init', grid: live.grid, seed: start.seed, ground: d.ground, outer: d.outer, boulders: d.boulders, course: d.course },
        [d.ground.buffer as ArrayBuffer, d.outer.heights.buffer as ArrayBuffer, d.course.buffer as ArrayBuffer]);
    }
    const e = start.edit;
    if (!isDefaultRiverShape(e.shape) || e.course) applyEdit(e);
    post({ type: 'live-ready', cold, carried: carriedCells });
    rtWall = performance.now();
    rateWall = rtWall;
    // Cold construction is not ongoing solver utilization. Begin its window
    // when slices start, so the first reading has the same scope as later ones.
    work = new RiverWorkMeter(rtWall);
    soon();
  } catch (err) {
    post({ type: 'live-error', message: err instanceof Error ? err.message : String(err) });
  }
  const onMessage = (m: RiverLiveIn): void => {
      if(m.type==='live-gpu-resident-result'){
        const pending=residentPending;if(!pending||pending.id!==m.id)return;residentPending=null;
        if(m.error||!m.output)pending.reject(Error(m.error??'Missing resident GPU result'));
        else{gpuTiming={cells:pending.cells,requestMs:performance.now()-pending.at,deviceExchangeMs:m.output.elapsedMs,mode:'resident',steps:m.output.steps,changedCells:m.output.records?m.output.records.length/8:undefined,uploadBytes:m.output.uploadBytes,awakeCells:m.output.awakeCells,spillLaunches:m.output.launches?m.output.launches.length/12:undefined};pending.resolve(m.output);}
        return;
      }
      if (m.type === 'live-gpu-result') {
        const pending = gpuPending;
        if (!pending || pending.id !== m.id) return;
        gpuPending = null;
        if (m.error || !m.output) pending.reject(Error(m.error ?? 'Missing GPU result'));
        else {
          gpuTiming = { cells: pending.cells, requestMs: performance.now() - pending.at, deviceExchangeMs: m.output.elapsedMs,mode:'synchronized',steps:1,reason:start.resident?live?.residentSynchronization:null };
          pending.resolve(m.output);
        }
        return;
      }
      if (m.type === 'live-gpu-faces') {
        const pending = gpuPending;
        if (!pending || pending.id !== m.id || !pending.spill) return;
        const facesStart = performance.now();
        Promise.resolve().then(() => pending.spill!(m.faces)).then(() => {
          pending.cpuMs += performance.now() - facesStart;
          post({ type: 'live-gpu-delta', id: m.id, delta: m.faces.delta }, [m.faces.delta.buffer as ArrayBuffer]);
        }).catch(error => post({ type: 'live-gpu-delta', id: m.id, error: String(error) }));
        return;
      }
      if (slicePending) { queuedMessages.push(m); return; }
      if (m.type === 'live-terrain') {
        // This handler is behind slicePending: resident GPU water is accepted
        // before painting, and the next interval uploads the edited native bed.
        try {
          if(!live)throw Error('The live river is not ready');
          if(!Array.isArray(m.commands)||m.commands.length<1||m.commands.length>128)throw Error('Invalid terrain batch');
          const result=live.applyTerrainBrushBatch(m.commands),p=result.patch;
          if(p){const mp=live.mapperPatch(p);port.postMessage({type:'patch',patch:mp},liveMapperPatchTransfer(mp));unsettle();frameDue=true;}
          post({type:'live-terrain-result',requestId:m.requestId,patch:p,undoCount:result.undoCount},p?livePatchTransfer(p):[]);
          soon();
        }catch(error){post({type:'live-terrain-result',requestId:m.requestId,error:error instanceof Error?error.message:String(error)});}
        return;
      }
      if (m.type === 'live-world-ground') {
        // Behind slicePending as the brush is: the next interval uploads the new native bed.
        try {
          if (!live) throw Error('The live river is not ready');
          const p = live.applyWorldGround(m.patch, m.box);
          const mp = live.mapperPatch(p); port.postMessage({ type: 'patch', patch: mp }, liveMapperPatchTransfer(mp)); unsettle(); frameDue = true;
          post({ type: 'live-world-ground-result', requestId: m.requestId, patch: p }, livePatchTransfer(p));
          soon();
        } catch (error) { post({ type: 'live-world-ground-result', requestId: m.requestId, error: error instanceof Error ? error.message : String(error) }); }
        return;
      }
      if (m.type === 'live-export-water') {
        // One water, step 1: read between slices (as an inspection), no step, no edit.
        try {
          if (!live) throw Error('The live river is not ready');
          const w = live.exportWater();
          post({ type: 'live-export-water-result', requestId: m.requestId, ...w },
            [w.h.buffer as ArrayBuffer, w.hu.buffer as ArrayBuffer, w.hv.buffer as ArrayBuffer, w.bed.buffer as ArrayBuffer]);
        } catch (error) { post({ type: 'live-export-water-result', requestId: m.requestId, error: error instanceof Error ? error.message : String(error) }); }
        return;
      }
      if (m.type === 'live-gpu-ready') { gpuReady = true; soon(); return; }
      if (m.type === 'live-inspect-cells') {
        // GPU slices defer inspection until commit. Read one accepted state
        // while paused too; do not apply edits or schedule a slice.
        // A request for another worker incarnation must never read this run.
        if (m.workerRunId !== workerRunId) return;
        try {
          if (!Number.isSafeInteger(m.requestId) || m.requestId <= 0) throw new Error('[river] Invalid cell inspection request ID.');
          if (!live) throw new Error('[river] Live solver is unavailable for cell inspection.');
          const inspection: LiveCellInspection = {
            ...live.inspectCells(m.cellIds), requestId: m.requestId, workerRunId,
            observationSequence: ++observationSequence, pendingEdit: pendingEdit !== null,
            paused, displayPairing: 'unavailable',
          };
          // Scalar records only: no solver buffers are transferred or detached.
          post({ type: 'live-inspect-cells', requestId: m.requestId, workerRunId, inspection });
        } catch (err) {
          post({ type: 'live-inspect-cells-error', requestId: m.requestId, workerRunId,
            message: err instanceof Error ? err.message : String(err) });
        }
      }
      else if (m.type === 'live-edit') { pendingEdit = m.edit; if (paused || suspended) soon(); }
      else if (m.type === 'live-speed') speed = m.speed;
      else if (m.type === 'live-pause') {
        paused = m.paused;
        // A pause queued behind a device interval needs one final accepted
        // snapshot/status acknowledgement; it must not advance another step.
        frameDue=true;soon();
      }
      else if (m.type === 'live-suspend') {
        if (suspended === m.suspended) return;
        suspended = m.suspended;
        // Hidden wall time is not missing physical time to simulate on return.
        // Rebase measurements too, so the FPS panel cannot show stale busy work.
        rtWall = rateWall = performance.now();
        rtSim = rateSim = live?.simTime ?? 0;
        rate = steps = stepsPerS = 0;
        work = new RiverWorkMeter(rtWall);
        post({ type: 'live-work', work: null, workAgeMs: null, speed, paused, suspended, fast: isFast(), rate, stepsPerS });
        if (!suspended) { frameDue = true; soon(); }
      }
      // The seven-falls course's top-up fills basins to their spill level,
      // which a dry start may take too (GG-427); other dry starts stay source-only.
      else if (m.type === 'live-topup' && (!start.dryStart || start.reconstructed)) { topUpDue = true; if (paused || suspended) soon(); }
      else if (m.type === 'live-contact-waterfall') { live?.setContactWaterfall(m.enabled, m.impactMode ?? 'absorb'); frameDue = true; soon(); }
      else if (m.type === 'live-source-pause') { live?.setSourcePaused(m.paused); frameDue = true; soon(); }
      else if (m.type === 'live-flood') { live?.startFlood(m); frameDue = true; soon(); }
      else if (m.type === 'live-flood-cancel') { live?.cancelFlood(); frameDue = true; soon(); }
  };
  return { onMessage };
}

// The worker side. `self` is a DedicatedWorkerGlobalScope only inside a
// worker; the guard keeps a main-thread or Node import of this module inert.
declare const WorkerGlobalScope: unknown;
if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined') {
  const scope = self as unknown as {
    onmessage: ((e: MessageEvent) => void) | null;
    postMessage: (m: unknown, t?: Transferable[]) => void;
  };
  let liveRole: { onMessage: (m: RiverLiveIn) => void } | null = null;
  scope.onmessage = (e: MessageEvent) => {
    // THE LIVE ROLE (typed messages); a message with no type is the one-shot
    // build below, as before the live river.
    const t = (e.data as { type?: string }).type;
    if (t === 'live-start') {
      liveRole = runLiveRole((m, tr) => scope.postMessage(m, tr), e.data as Extract<RiverLiveIn, { type: 'live-start' }>);
      return;
    }
    if (t && t.startsWith('live-')) {
      liveRole?.onMessage(e.data as RiverLiveIn);
      return;
    }
    const seed = Number((e.data as { seed?: number }).seed ?? 20260928);
    try {
      // The shape goes on before the build: courseKeyAt and the design level read it.
      setRiverShape((e.data as { shape?: RiverShape }).shape ?? null);
      let last = -1;
      const data = buildRiverReachData(seed, (f, stage) => {
        const pct = Math.floor(f * 100);
        if (pct !== last) { last = pct; scope.postMessage({ type: 'progress', f, stage }); }
      });
      scope.postMessage({ type: 'done', data }, riverReachTransfer(data));
    } catch (err) {
      scope.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };
}
