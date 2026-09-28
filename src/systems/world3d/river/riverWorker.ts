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
 */
import {
  buildRiverReach, getRiverShape, isDefaultRiverShape, setRiverShape, RIVER_RENDER_DOMAIN,
  type Boulder, type RiverGridSpec, type RiverShape,
} from './riverReach';
import { solveReach, buildFlowMap, countEddyCells } from './riverFlowField';
import type { RiverFlowMapStats } from './riverFlowField';
import type { RiverSolverStats } from './riverSolver';
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
    type: 'live-start'; seed: number; edit: RiverEditState; speed: RiverLiveSpeed;
    /** A steady field to start from (the page's cached one), or none: start from the design level. */
    field: { h: Float32Array; u: Float32Array; v: Float32Array; uRms: Float32Array; t1: Float32Array } | null;
    /** The port to the flow-map worker (riverMapWorker.ts). */
    mapPort: MessagePort;
  }
  | { type: 'live-edit'; edit: RiverEditState }
  | { type: 'live-speed'; speed: RiverLiveSpeed }
  | { type: 'live-pause'; paused: boolean }
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
  // A top-up waits for the next slice, after any waiting edit (it fills to
  // the design level of the river as edited).
  let topUpDue = false;
  let speed: RiverLiveSpeed = start.speed;
  let paused = false;
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
  const mc = new MessageChannel();
  const soon = (): void => mc.port2.postMessage(0);
  const applyEdit = (e: RiverEditState): void => {
    if (!live) return;
    const p = live.applyEdit(e);
    lastPatchMs = p.ms;
    const mp = live.mapperPatch(p);
    port.postMessage({ type: 'patch', patch: mp }, liveMapperPatchTransfer(mp));
    post({ type: 'live-patch', patch: p }, livePatchTransfer(p));
    unsettle();
    frameDue = true;
  };
  const tick = (): void => {
    if (!live) return;
    if (pendingEdit) {
      const e = pendingEdit;
      pendingEdit = null;
      applyEdit(e);
    }
    if (topUpDue) {
      topUpDue = false;
      const added = live.topUpToDesignLevel();
      unsettle();
      frameDue = true;
      post({ type: 'live-topup', added });
    }
    const now = performance.now();
    let caughtUp = false;
    if (!paused) {
      const fast = isFast();
      if (fast) {
        steps += live.advance(24).steps;
        rtWall = performance.now();
        rtSim = live.simTime;
      } else {
        const target = rtSim + (now - rtWall) / 1000;
        if (live.simTime < target) steps += live.advance(24, target - live.simTime).steps;
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
    if ((frameDue || !paused) && now - lastFrame >= RIVER_LIVE_FRAME_MS) {
      lastFrame = now;
      frameDue = false;
      const f = live.frame();
      if (f.dtS > 0) {
        const a = 1 - Math.exp(-f.dtS / 10);
        qOutSmooth = Number.isNaN(qOutSmooth) ? f.qOut : qOutSmooth + a * (f.qOut - qOutSmooth);
      }
      const since = live.simTime - editAt;
      if (!settled && since >= RIVER_LIVE.fastAfterEditS
        && (Math.abs(qOutSmooth - f.qIn) <= RIVER_LIVE.settleShare * f.qIn || since >= RIVER_LIVE.fastMaxS)) settled = true;
      port.postMessage({ type: 'frame', frame: f }, liveFrameTransfer(f));
      post({
        type: 'live-status', simTime: live.simTime, rate, stepsPerS, frameMs: f.ms, patchMs: lastPatchMs,
        speed, paused, fast: isFast(), qOutSmooth,
        restores: live.restores, healthy: live.lastHealth.ok, inflowDry: f.inflowDry, readout: f.readout,
        qIn: f.qIn, qOut: f.qOut, activeCells: f.activeCells, breachCells: f.breachCells, maxSpeed: f.maxSpeed,
        volume: f.volume, edgeWetCells: f.edgeWetCells, editLostM3: f.editLostM3, editAddedM3: f.editAddedM3, topUpM3: f.topUpM3,
      });
    }
    if (caughtUp) setTimeout(tick, 8);
    else soon();
  };
  mc.port1.onmessage = tick;
  // THE START: the judged reach (about 2 s), its noise (0.1 s), the water.
  try {
    post({ type: 'progress', f: 0.1, stage: 'live river' });
    live = new LiveRiver(start.seed);
    live.warmNoise();
    if (start.field) live.startFromField(start.field);
    else live.startCold();
    port.postMessage({ type: 'init', init: live.mapperInit() });
    const cold = !start.field;
    if (cold) {
      const d = live.initialData();
      post({ type: 'live-init', grid: live.grid, seed: start.seed, ground: d.ground, outer: d.outer, boulders: d.boulders, course: d.course },
        [d.ground.buffer as ArrayBuffer, d.outer.heights.buffer as ArrayBuffer, d.course.buffer as ArrayBuffer]);
    }
    const e = start.edit;
    if (!isDefaultRiverShape(e.shape) || e.course) applyEdit(e);
    post({ type: 'live-ready', cold });
    rtWall = performance.now();
    rateWall = rtWall;
    soon();
  } catch (err) {
    post({ type: 'live-error', message: err instanceof Error ? err.message : String(err) });
  }
  return {
    onMessage: (m: RiverLiveIn) => {
      if (m.type === 'live-edit') { pendingEdit = m.edit; if (paused) soon(); }
      else if (m.type === 'live-speed') speed = m.speed;
      else if (m.type === 'live-pause') { paused = m.paused; if (!paused) soon(); }
      else if (m.type === 'live-topup') { topUpDue = true; if (paused) soon(); }
    },
  };
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
