/**
 * @file riverLiveClient.ts — the page's side of the live river (2026-09-29):
 * it starts the live solver (riverWorker.ts, its live role) and the flow-map
 * worker (riverMapWorker.ts), joins them with a port, sends the edits and
 * hands each bed patch and each flow snapshot to the view.
 *
 * ONE EDIT IN FLIGHT. A drag sends many edits; the client sends one, and the
 * next only when that one's patch comes back, so the worker never falls
 * behind a drag. The last edit is never lost: a newer edit replaces the one
 * that waits. The round trips give the update rate while dragging.
 */
import type { LiveBedPatch, LiveFlowReadout, LiveFlowSnapshot, RiverEditState } from '@/systems/world3d/river/riverLive';
import type { RiverLiveSpeed } from '@/systems/world3d/river/riverWorker';
import type { Boulder, RiverGridSpec } from '@/systems/world3d/river/riverReach';
import type { OuterLattice } from '@/systems/world3d/river/riverLive';

/** The live solver's status, a few times a second. */
export interface RiverLiveStatus {
  simTime: number;
  /** Seconds of flow per second of wall time over the last second. */
  rate: number;
  stepsPerS: number;
  /** The field frame's cost and the last patch's cost in the solver's worker, ms. */
  frameMs: number;
  patchMs: number;
  speed: RiverLiveSpeed;
  paused: boolean;
  /** True while the solver runs as fast as it can ('fast', or 'auto' after an edit). */
  fast: boolean;
  restores: number;
  healthy: boolean;
  /** True while an edit has left no wet inflow cell at the west edge; the solver keeps its last inflow. */
  inflowDry: boolean;
  readout: LiveFlowReadout;
  qIn: number;
  qOut: number;
  activeCells: number;
  breachCells: number;
  maxSpeed: number;
  /** The outflow smoothed over 10 s of flow (the auto pace's settle test), m^3/s. */
  qOutSmooth: number;
  /** The water on the grid, m^3. */
  volume: number;
  /** Wet cells on the grid's north and south edges: water against the edge of the simulated area. */
  edgeWetCells: number;
  /** The water the edits took and added, and the top-ups added, since the run started, m^3. */
  editLostM3: number;
  editAddedM3: number;
  topUpM3: number;
}

/** A cold start's first data (no cached field): the ground, the outer lattice, the rocks, the course. */
export interface RiverLiveInit {
  grid: RiverGridSpec;
  seed: number;
  ground: Float32Array;
  outer: OuterLattice;
  boulders: Boulder[];
  course: Float32Array;
}

export interface RiverLiveCallbacks {
  onProgress?: (f: number, stage: string) => void;
  onInit?: (d: RiverLiveInit) => void;
  onReady?: (cold: boolean) => void;
  onPatch?: (p: LiveBedPatch, roundTripMs: number | null) => void;
  /** Draw the snapshot; the next one is sent once this returns. */
  onSnapshot?: (s: LiveFlowSnapshot) => void;
  onStatus?: (s: RiverLiveStatus) => void;
  onError?: (message: string) => void;
}

export class RiverLiveClient {
  private readonly solver: Worker;
  private readonly mapper: Worker;
  private readonly cb: RiverLiveCallbacks;
  private inFlight: { edit: RiverEditState; at: number } | null = null;
  private waiting: RiverEditState | null = null;
  private dead = false;
  /** Measurement: each patch's round trip (edit sent to patch back), ms, and when it came back. */
  readonly patchLog: Array<{ at: number; rtt: number; workerMs: number; cells: number }> = [];
  /** Measurement: when each snapshot arrived, and its cost in the map worker, ms. */
  readonly snapshotLog: Array<{ at: number; mapMs: number; simTime: number }> = [];
  lastStatus: RiverLiveStatus | null = null;

  constructor(
    start: {
      seed: number; edit: RiverEditState; speed: RiverLiveSpeed;
      field: { h: Float32Array; u: Float32Array; v: Float32Array; uRms: Float32Array; t1: Float32Array } | null;
    },
    cb: RiverLiveCallbacks,
  ) {
    this.cb = cb;
    this.solver = new Worker(new URL('../../../systems/world3d/river/riverWorker.ts', import.meta.url), { type: 'module' });
    this.mapper = new Worker(new URL('../../../systems/world3d/river/riverMapWorker.ts', import.meta.url), { type: 'module' });
    const ch = new MessageChannel();
    this.mapper.postMessage({ type: 'port', port: ch.port2 }, [ch.port2]);
    this.solver.onmessage = (e: MessageEvent) => this.fromSolver(e.data as { type: string } & Record<string, unknown>);
    this.solver.onerror = (e) => cb.onError?.(`[river] The live solver failed: ${e.message}`);
    this.mapper.onmessage = (e: MessageEvent) => this.fromMapper(e.data as { type: string } & Record<string, unknown>);
    this.mapper.onerror = (e) => cb.onError?.(`[river] The flow-map worker failed: ${e.message}`);
    const transfer: Transferable[] = [ch.port1];
    if (start.field) for (const a of [start.field.h, start.field.u, start.field.v, start.field.uRms, start.field.t1]) transfer.push(a.buffer as ArrayBuffer);
    this.solver.postMessage({ type: 'live-start', ...start, mapPort: ch.port1 }, transfer);
  }

  private fromSolver(m: { type: string } & Record<string, unknown>): void {
    if (this.dead) return;
    const cb = this.cb;
    if (m.type === 'progress') cb.onProgress?.(m.f as number, m.stage as string);
    else if (m.type === 'live-init') cb.onInit?.(m as unknown as RiverLiveInit);
    else if (m.type === 'live-ready') cb.onReady?.(m.cold as boolean);
    else if (m.type === 'live-status') { this.lastStatus = m as unknown as RiverLiveStatus; cb.onStatus?.(this.lastStatus); }
    else if (m.type === 'live-error') cb.onError?.(m.message as string);
    else if (m.type === 'live-patch') {
      const p = m.patch as LiveBedPatch;
      const now = performance.now();
      const rtt = this.inFlight ? now - this.inFlight.at : null;
      if (rtt !== null) this.patchLog.push({ at: now, rtt, workerMs: p.ms, cells: p.cells });
      if (this.patchLog.length > 400) this.patchLog.splice(0, this.patchLog.length - 400);
      this.inFlight = null;
      cb.onPatch?.(p, rtt);
      if (this.waiting) {
        const e = this.waiting;
        this.waiting = null;
        this.send(e);
      }
    }
  }

  private fromMapper(m: { type: string } & Record<string, unknown>): void {
    if (this.dead) return;
    if (m.type === 'snapshot') {
      const s = m.snap as LiveFlowSnapshot;
      this.snapshotLog.push({ at: performance.now(), mapMs: s.ms, simTime: s.simTime });
      if (this.snapshotLog.length > 400) this.snapshotLog.splice(0, this.snapshotLog.length - 400);
      try {
        this.cb.onSnapshot?.(s);
      } finally {
        this.mapper.postMessage({ type: 'ack' });
      }
    } else if (m.type === 'map-error') {
      this.cb.onError?.(m.message as string);
    }
  }

  private send(e: RiverEditState): void {
    this.inFlight = { edit: e, at: performance.now() };
    this.solver.postMessage({ type: 'live-edit', edit: e });
  }

  /** Send an edit (the latest wins; one in flight at a time). */
  edit(e: RiverEditState): void {
    if (this.dead) return;
    if (this.inFlight) this.waiting = e;
    else this.send(e);
  }

  /** True while an edit waits for its patch. */
  get busy(): boolean {
    return this.inFlight !== null || this.waiting !== null;
  }

  setSpeed(speed: RiverLiveSpeed): void {
    this.solver.postMessage({ type: 'live-speed', speed });
  }

  /** Top the channel up to the design level (the water a narrowed channel lost, at once). */
  topUp(): void {
    this.solver.postMessage({ type: 'live-topup' });
  }

  setPaused(paused: boolean): void {
    this.solver.postMessage({ type: 'live-pause', paused });
  }

  dispose(): void {
    this.dead = true;
    this.solver.terminate();
    this.mapper.terminate();
  }
}
