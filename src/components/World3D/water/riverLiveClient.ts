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
 *
 * An explicit cell inspection uses a separate bounded promise queue. Its raw
 * current solver inventory has no certified pairing with the smoothed snapshot.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/10/2026, 03:44:34
 * Dependents: components/DesignPreview/steps/water/RiverScene.tsx
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { RiverTerrainBrushCommand, TerrainBrushBounds } from '@/systems/world3d/river/riverTerrainBrush';
import type { LiveBedPatch, LiveFlowReadout, LiveFlowSnapshot, RiverEditState } from '@/systems/world3d/river/riverLive';
import type { LiveFlowArrays } from '@/systems/world3d/river/riverFlowPatch';
import { applyRiverPatch } from '@/systems/world3d/river/riverFlowPatch';
import type { RiverReceivingConfiguration, RiverViewFlowSnapshot } from './riverReceivingRefiner';
import type { RiverFloodStatus } from '@/systems/world3d/river/riverFloodSurge';
import type { RiverLiveSpeed } from '@/systems/world3d/river/riverWorker';
// C12: the river workers have one spawn owner (riverWorkerSpawn.ts).
import { spawnRiverMapWorker, spawnRiverWorker } from '@/systems/world3d/river/riverWorkerSpawn';
import type { RiverWorkReading } from '@/systems/world3d/river/riverWorkMeter';
import type { Boulder, RiverGridSpec } from '@/systems/world3d/river/riverReach';
import type { RiverWaterExport, RiverWorldBedInit, RiverWorldCarry, WorldFineGroundPatch } from '@/systems/world3d/river/riverWorldBed';
import type { OuterLattice } from '@/systems/world3d/river/riverLive';
import { validateRiverCellIds, type LiveCellInspection } from '@/systems/world3d/river/riverCellInspection';
import { RiverGpuStep, type RiverGpuInput } from '@/systems/world3d/river/riverGpuStep';
import { RiverGpuResident, type RiverGpuResidentInput, type ResidentCpuWork } from '@/systems/world3d/river/riverGpuResident';

/** Explicit diagnostics stay small and cannot accumulate behind a busy solver. */
export const RIVER_CELL_INSPECTION_PENDING_LIMIT = 4;
export const RIVER_CELL_INSPECTION_TIMEOUT_MS = 5000;

/** The live solver's status, a few times a second. */
export interface RiverLiveStatus {
  /** Where depth/momentum actually advance; mapping and terrain remain CPU-owned. */
  backend?: 'cpu' | 'gpu-waiting' | 'gpu';
  /** Elapsed request/upload/readback spans, not isolated GPU execution time. */
  gpuTiming?: { cells: number; requestMs: number; deviceExchangeMs: number;mode?:'resident'|'synchronized';steps?:number;reason?:string|null;changedCells?:number;uploadBytes?:number;awakeCells?:number;spillLaunches?:number } | null;
  /** Source pulse and delayed landing; downstream speed still comes from the local solver. */
  flood?: RiverFloodStatus;
  simTime: number;
  /** Seconds of flow per second of wall time over the last second. */
  rate: number;
  stepsPerS: number;
  /** The field frame's cost and the last patch's cost in the solver's worker, ms. */
  frameMs: number;
  patchMs: number;
  /** Elapsed work in the latest completed worker window, including waiting in its denominator. */
  work: RiverWorkReading | null;
  workAgeMs: number | null;
  speed: RiverLiveSpeed;
  paused: boolean;
  /** A stopped calculation must not leave the last running status on screen. */
  fault?: string;
  /** The page is hidden or has no drawing area; water is retained without solver slices. */
  suspended?: boolean;
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
  /** How the water started (the warm start, or the filled basins and why not). */
  startNote?: string;
}

/** Main-thread elapsed snapshot phases. Texture upload happens later, in the renderer. */
export interface RiverSnapshotReading {
  at: number; mapMs: number; simTime: number;
  applyMs: number; ackMs: number; handlerMs: number;
  /** Derived worker preparation, separate from base mapping and view application. */
  receivingMs?: number; receivingError?: string;
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
  /** Synchronous GPU exchange work on this page; excludes the asynchronous wait. */
  onGpuCpuWork?: ResidentCpuWork;
  onProgress?: (f: number, stage: string) => void;
  onInit?: (d: RiverLiveInit) => void;
  onReady?: (cold: boolean) => void;
  onPatch?: (p: LiveBedPatch, roundTripMs: number | null) => void;
  /** Draw the snapshot; the next one is sent once this returns. */
  onSnapshot?: (s: RiverViewFlowSnapshot) => void;
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
  private gpu: RiverGpuStep | null = null;
  private gpuBusy = false;
  private gpuInit: Promise<void> | null = null;
  private resident:RiverGpuResident|null=null;
  private residentRequested=false;
  private readonly gpuDeltas = new Map<number, { resolve: (delta: Float32Array) => void; reject: (error: Error) => void }>();

  /** Reuse the initialized scene device. Never create a second device/renderer.
   * Until attachment the candidate worker publishes its initial state but waits. */
  attachGpu(device: GPUDevice): Promise<void> {
    return this.gpuInit ??= Promise.all([RiverGpuStep.create(device),this.residentRequested?RiverGpuResident.create(device):Promise.resolve(null)]).then(([driver,resident]) => {
      if (this.dead) { driver.dispose(); return; }
      this.gpu = driver;
      this.resident=resident;
      this.solver.postMessage({ type: 'live-gpu-ready' });
    });
  }

  private async runGpuStep(id: number, input: RiverGpuInput, spill: boolean): Promise<void> {
    if (this.gpuBusy || !this.gpu) {
      this.solver.postMessage({ type: 'live-gpu-result', id, error: 'Shared river GPU is unavailable or busy' });
      return;
    }
    const driver = this.gpu;
    this.gpuBusy = true;
    try {
      const output = await driver.step(input, spill ? async faces => {
        const delta = await new Promise<Float32Array>((resolve, reject) => {
          this.gpuDeltas.set(id, { resolve, reject });
          // The native worker owns airborne admission. It returns only the
          // receiving correction before this device advances wet depths.
          this.solver.postMessage({ type: 'live-gpu-faces', id, faces });
        });
        if (delta.length !== faces.delta.length) throw Error('Invalid spill correction dimensions');
        faces.delta.set(delta);
      } : undefined);
      if (!this.dead) this.solver.postMessage({ type: 'live-gpu-result', id, output }, [output.cells.buffer as ArrayBuffer]);
    } catch (error) {
      if (!this.dead) this.solver.postMessage({ type: 'live-gpu-result', id, error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.gpuBusy = false;
      if (this.dead) { driver.dispose(); this.resident?.dispose(); }
    }
  }

  private async runResident(id:number,input:RiverGpuResidentInput):Promise<void>{
    if(this.gpuBusy||!this.resident){this.solver.postMessage({type:'live-gpu-resident-result',id,error:'Resident GPU unavailable or busy'});return;}
    this.gpuBusy=true;
    try{
      const output=await this.resident.run(input,this.cb.onGpuCpuWork);
      const arrays=[output.records,output.launches,output.journal];
      if(!this.dead)this.solver.postMessage({type:'live-gpu-resident-result',id,output},arrays.map(a=>a.buffer as ArrayBuffer));
    }catch(error){if(!this.dead)this.solver.postMessage({type:'live-gpu-resident-result',id,error:error instanceof Error?error.message:String(error)});}
    finally{this.gpuBusy=false;if(this.dead){this.gpu?.dispose();this.resident?.dispose();}}
  }
  // Hidden previews must not compete with the visible river. This is separate
  // from the user's Pause choice, which survives leaving and returning to a tab.
  private viewportVisible = true;
  private suspended = false;
  private readonly visibilityChanged = (): void => {
    const suspended = !this.viewportVisible || (typeof document !== 'undefined' && document.hidden);
    if (this.dead || suspended === this.suspended) return;
    this.suspended = suspended;
    this.solver.postMessage({ type: 'live-suspend', suspended });
  };

  /** Embedded previews can have zero area while the browser still says visible.
   * Retain their water and manual Pause choice, then resume without catching up
   * hidden wall time when the existing pane has a drawing area again. */
  setViewportVisible(visible: boolean): void {
    this.viewportVisible = visible;
    this.visibilityChanged();
  }
  private receivingKey: string | null = null;
  private readonly workerRunId = globalThis.crypto.randomUUID();
  private inspectionId = 0;
  private readonly inspections = new Map<number, {
    resolve: (inspection: LiveCellInspection) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  /** Measurement: each patch's round trip (edit sent to patch back), ms, and when it came back. */
  readonly patchLog: Array<{ at: number; rtt: number; workerMs: number; cells: number;commands?:number;viewMs?:number;timings?:Record<string,number> }> = [];
  /** Measurement: when each snapshot arrived, and its cost in the map worker, ms. */
  readonly snapshotLog: RiverSnapshotReading[] = [];
  lastStatus: RiverLiveStatus | null = null;

  constructor(
    start: {
      seed: number; edit: RiverEditState; speed: RiverLiveSpeed; headwaters?: boolean; spill?: boolean; contactWaterfall?: boolean;
      /** Candidate full serial terrain, using the same worker and source. */
      reconstructed?: boolean;
      /** Initialize without advancing until explicit resume; ordinary starts remain running. */
      startPaused?: boolean;
      /** Starts empty and rejects top-ups in the worker for source-only proof. */
      dryStart?: boolean;
      /** With dryStart: fill every basin to its spill level at once (GG-427),
       * so the falls run without the dry start's long fill. */
      fillBasins?: boolean;
      /** A saved steady run (data/river/seven-falls-warm.bin); transferred to the worker. */
      warmState?: ArrayBuffer;
      gpu?: boolean;
      resident?: boolean;
      /** Initial pane visibility, before its renderer finishes mounting. */
      viewportVisible?: boolean;
      /** Explicit preview opt-in; ordinary river and comparison runs retain absorption. */
      contactImpactMode?: 'absorb' | 'junction';
      field: { h: Float32Array; u: Float32Array; v: Float32Array; uRms: Float32Array; t1: Float32Array } | null;
      /** The game world's terrain and river line as the bed (ADR 0009 slice 10); the worker builds the reach on it. */
      worldBed?: RiverWorldBedInit;
      /** The previous reach's water, moved to the worker (one water, step 1, 2026-10-30). */
      carry?: RiverWorldCarry;
    },
    cb: RiverLiveCallbacks,
  ) {
    this.cb = cb;
    this.viewportVisible = start.viewportVisible ?? true;
    this.suspended = !this.viewportVisible || (typeof document !== 'undefined' && document.hidden);
    // C12: spawn through the shared river factories instead of a second copy of
    // the worker URLs. The live protocol below is unchanged.
    this.solver = spawnRiverWorker();
    this.mapper = spawnRiverMapWorker();
    const ch = new MessageChannel();
    this.mapper.postMessage({ type: 'port', port: ch.port2 }, [ch.port2]);
    this.solver.onmessage = (e: MessageEvent) => this.fromSolver(e.data as { type: string } & Record<string, unknown>);
    this.solver.onerror = (e) => {
      this.rejectInspections(new Error(`[river] The live solver failed: ${e.message}`));
      cb.onError?.(`[river] The live solver failed: ${e.message}`);
    };
    this.mapper.onmessage = (e: MessageEvent) => this.fromMapper(e.data as { type: string } & Record<string, unknown>);
    this.mapper.onerror = (e) => cb.onError?.(`[river] The flow-map worker failed: ${e.message}`);
    const transfer: Transferable[] = [ch.port1];
    if (start.field) for (const a of [start.field.h, start.field.u, start.field.v, start.field.uRms, start.field.t1]) transfer.push(a.buffer as ArrayBuffer);
    if (start.warmState) transfer.push(start.warmState);
    // The world terrain lattice moves to the worker (the client keeps no copy).
    if (start.worldBed) transfer.push(start.worldBed.lattice.heights.buffer as ArrayBuffer);
    if (start.carry) for (const a of [start.carry.h, start.carry.hu, start.carry.hv, start.carry.bed]) transfer.push(a.buffer as ArrayBuffer);
    this.residentRequested=!!start.resident;
    this.solver.postMessage({ type: 'live-start', ...start, gpu:!!start.gpu||!!start.resident, startSuspended: this.suspended,
      workerRunId: this.workerRunId, mapPort: ch.port1 }, transfer);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibilityChanged);
  }

  private fromSolver(m: { type: string } & Record<string, unknown>): void {
    if (this.dead) return;
    if (m.type === 'live-gpu-step') { void this.runGpuStep(m.id as number, m.input as RiverGpuInput, !!m.spill); return; }
    if (m.type === 'live-gpu-resident') { void this.runResident(m.id as number,m.input as RiverGpuResidentInput);return; }
    if (m.type === 'live-gpu-delta') {
      const pending = this.gpuDeltas.get(m.id as number);
      if (!pending) return;
      this.gpuDeltas.delete(m.id as number);
      if (m.error || !(m.delta instanceof Float32Array)) pending.reject(Error(String(m.error ?? 'Missing spill correction')));
      else pending.resolve(m.delta);
      return;
    }
    const cb = this.cb;
    if (m.type === 'live-inspect-cells' || m.type === 'live-inspect-cells-error') {
      // A delayed reply from another run, timed-out request, or duplicate reply
      // cannot resolve any current request. These are not displayed snapshots.
      if (m.workerRunId !== this.workerRunId || typeof m.requestId !== 'number') return;
      const pending = this.inspections.get(m.requestId);
      if (!pending) return;
      if (m.type === 'live-inspect-cells') {
        const inspection = m.inspection as LiveCellInspection | undefined;
        if (!inspection || inspection.workerRunId !== this.workerRunId || inspection.requestId !== m.requestId) return;
        clearTimeout(pending.timer);
        this.inspections.delete(m.requestId);
        pending.resolve(inspection);
      } else {
        clearTimeout(pending.timer);
        this.inspections.delete(m.requestId);
        pending.reject(new Error(String(m.message)));
      }
      return;
    }
    if (m.type === 'live-ready' && typeof m.carried === 'number') this.carriedCells = m.carried;
    if (m.type === 'live-export-water-result') {
      const pending = this.exportRequests.get(m.requestId as number);
      if (!pending) return;
      this.exportRequests.delete(m.requestId as number);
      clearTimeout(pending.timer);
      if (m.error) pending.reject(Error(String(m.error)));
      else pending.resolve({ h: m.h as Float32Array, hu: m.hu as Float32Array, hv: m.hv as Float32Array, bed: m.bed as Float32Array });
      return;
    }
    if (m.type === 'live-world-ground-result') {
      const pending = this.worldGroundRequests.get(m.requestId as number);
      if (!pending) return;
      this.worldGroundRequests.delete(m.requestId as number);
      clearTimeout(pending.timer);
      if (m.error) { pending.reject(Error(String(m.error))); return; }
      const p = m.patch as LiveBedPatch;
      cb.onPatch?.(p, performance.now() - pending.at);
      this.patchLog.push({ at: performance.now(), rtt: performance.now() - pending.at, workerMs: p.ms, cells: p.cells, timings: p.timings });
      if (this.patchLog.length > 400) this.patchLog.splice(0, this.patchLog.length - 400);
      pending.resolve(p);
      return;
    }
    if(m.type==='live-terrain-result'){
      const pending=this.terrainRequests.get(m.requestId as number);if(!pending)return;
      this.terrainRequests.delete(m.requestId as number);clearTimeout(pending.timer);
      this.terrainInFlight=false;
      if(m.error)pending.reject(Error(String(m.error)));
      else{
        if(m.patch){
          const p=m.patch as LiveBedPatch,at=performance.now();cb.onPatch?.(p,null);
          this.patchLog.push({at:performance.now(),rtt:performance.now()-pending.at,workerMs:p.ms,cells:p.cells,
            commands:pending.count,viewMs:performance.now()-at,timings:p.timings});
          if(this.patchLog.length>400)this.patchLog.splice(0,this.patchLog.length-400);
        }
        pending.resolve({undoCount:m.undoCount as number});
      }
      this.flushTerrain();
      return;
    }
    if (m.type === 'progress') cb.onProgress?.(m.f as number, m.stage as string);
    else if (m.type === 'live-init') cb.onInit?.(m as unknown as RiverLiveInit);
    else if (m.type === 'live-ready') cb.onReady?.(m.cold as boolean);
    else if (m.type === 'live-status') { this.lastStatus = m as unknown as RiverLiveStatus; cb.onStatus?.(this.lastStatus); }
    else if (m.type === 'live-work' && this.lastStatus) {
      // Worker utilization continues while fields are paused. Retain the last
      // hydraulic readout; never treat this telemetry message as a new field.
      this.lastStatus = { ...this.lastStatus, ...m } as unknown as RiverLiveStatus;
      cb.onStatus?.(this.lastStatus);
    }
    else if (m.type === 'live-error') {
      // The worker stops on this error. Retain its last water reading, while
      // reporting the stop immediately instead of waiting for another field.
      if (this.lastStatus) {
        this.lastStatus = { ...this.lastStatus, paused: true, rate: 0, stepsPerS: 0, fault: String(m.message) };
        cb.onStatus?.(this.lastStatus);
      }
      this.rejectInspections(new Error(String(m.message)));
      cb.onError?.(m.message as string);
    }
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

  /** The kept picture arrays (sparse pictures). */
  private flowArrays: LiveFlowArrays | null = null;

  private fromMapper(m: { type: string } & Record<string, unknown>): void {
    if (this.dead) return;
    if (m.type === 'snapshot') {
      const s = m.snap as RiverViewFlowSnapshot;
      const started = performance.now();
      // SPARSE PICTURES (2026-10-22, GG-430): a full picture becomes the kept
      // arrays; a patch picture writes its rows into them. Consumers always
      // see full arrays (the same objects each time) and `patch` for uploads.
      if (s.patch && this.flowArrays) {
        s.surfaceBeforeAt = applyRiverPatch(this.flowArrays, s.patch);
        Object.assign(s, this.flowArrays);
      } else if (!s.patch && s.t0 && s.t0.length > 0) {
        this.flowArrays = { t0: s.t0, t0h: s.t0h, t1h: s.t1h, t2h: s.t2h, surface: s.surface };
      }
      const reading: RiverSnapshotReading = { at: started, mapMs: s.ms, simTime: s.simTime, applyMs: 0, ackMs: 0, handlerMs: 0,
        ...(s.preparedReceiving ? { receivingMs: s.preparedReceiving.elapsedMs } : {}),
        ...(s.receivingError ? { receivingError: s.receivingError } : {}) };
      try {
        this.cb.onSnapshot?.(s);
      } finally {
        const applied = performance.now();
        reading.applyMs = applied - started;
        // A callback failure still releases mapper backpressure. Keep the
        // original error and record the elapsed attempt without growing a queue.
        try { this.mapper.postMessage({ type: 'ack' }); } finally {
          const finished = performance.now();
          reading.ackMs = finished - applied;
          reading.handlerMs = finished - started;
          this.snapshotLog.push(reading);
          if (this.snapshotLog.length > 400) this.snapshotLog.splice(0, this.snapshotLog.length - 400);
        }
      }
    } else if (m.type === 'map-error') {
      this.cb.onError?.(m.message as string);
    }
  }

  private terrainSequence = 0;
  private terrainRequests = new Map<number,{resolve:(value:{undoCount:number})=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>;at:number;count:number}>();
  private terrainQueued:Array<{command:RiverTerrainBrushCommand;resolve:(value:{undoCount:number})=>void;reject:(error:Error)=>void}>=[];
  private terrainInFlight=false;
  private terrainTimer:ReturnType<typeof setTimeout>|null=null;
  private terrainFault:Error|null=null;
  /** Preserve all dabs, but allow only one native rebuild in flight. New
   * pointer samples join the next ordered batch instead of flooding workers
   * and the main thread with a complete patch for every interpolated point. */
  terrain(command: RiverTerrainBrushCommand): Promise<{undoCount:number}> {
    if(this.dead)return Promise.reject(Error('The live river is closed'));
    if(this.terrainFault)return Promise.reject(this.terrainFault);
    return new Promise((resolve,reject)=>{
      this.terrainQueued.push({command,resolve,reject});
      if(!this.terrainInFlight&&this.terrainTimer===null)this.terrainTimer=setTimeout(()=>{this.terrainTimer=null;this.flushTerrain();},16);
    });
  }
  private flushTerrain():void {
    if(this.dead||this.terrainInFlight||this.terrainFault||!this.terrainQueued.length)return;
    const batch=this.terrainQueued.splice(0,128),at=performance.now();
    const requestId=++this.terrainSequence;
    const resolve=(value:{undoCount:number}):void=>{for(const item of batch)item.resolve(value);};
    const reject=(error:Error):void=>{for(const item of batch)item.reject(error);};
    const timer=setTimeout(()=>{
      // A lost acknowledgement has unknown commit status. Never resend a
      // brush batch and accidentally apply its land displacement twice.
      this.terrainFault=Error('Terrain edit acknowledgement timed out; reload before painting again');
      this.terrainRequests.delete(requestId);reject(this.terrainFault);
      for(const item of this.terrainQueued.splice(0))item.reject(this.terrainFault);
    },60000);
    this.terrainInFlight=true;
    this.terrainRequests.set(requestId,{resolve,reject,timer,at,count:batch.length});
    this.solver.postMessage({type:'live-terrain',requestId,commands:batch.map(item=>item.command)});
  }

  /** Cells the solver took from a carried reach at its start (one water, step 1); null before ready. */
  carriedCells: number | null = null;
  private exportSequence = 0;
  private exportRequests = new Map<number, { resolve: (w: RiverWaterExport) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  /**
   * THE WATER TO CARRY (one water, step 1, 2026-10-30): copies of the solver's
   * depth, discharges and bed, read between slices. A moved reach starts from
   * them where its box overlaps this one.
   */
  exportWater(): Promise<RiverWaterExport> {
    if (this.dead) return Promise.reject(Error('The live river is closed'));
    return new Promise((resolve, reject) => {
      const requestId = ++this.exportSequence;
      const timer = setTimeout(() => {
        this.exportRequests.delete(requestId);
        reject(Error('The river did not send its water within 30 s'));
      }, 30000);
      this.exportRequests.set(requestId, { resolve, reject, timer });
      this.solver.postMessage({ type: 'live-export-water', requestId });
    });
  }

  private worldGroundSequence = 0;
  private worldGroundRequests = new Map<number, { resolve: (p: LiveBedPatch) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout>; at: number }>();
  /**
   * THE WORLD'S GROUND CHANGED (agora-257c, 2026-10-29, GG-533): send the new
   * fine-ground values over the changed box (river-local m) to the solver,
   * which rebuilds its bed there with the water on it. Resolves with the bed
   * patch (also handed to `onPatch`). Each edit goes once: an edit is never
   * resent, so a lost reply cannot cut the same shape twice.
   */
  worldGround(patch: WorldFineGroundPatch, box: TerrainBrushBounds): Promise<LiveBedPatch> {
    if (this.dead) return Promise.reject(Error('The live river is closed'));
    return new Promise((resolve, reject) => {
      const requestId = ++this.worldGroundSequence;
      const timer = setTimeout(() => {
        this.worldGroundRequests.delete(requestId);
        reject(Error('The river did not answer a world-ground change within 60 s'));
      }, 60000);
      this.worldGroundRequests.set(requestId, { resolve, reject, timer, at: performance.now() });
      this.solver.postMessage({ type: 'live-world-ground', requestId, patch, box }, [patch.values.buffer as ArrayBuffer]);
    });
  }

  private send(e: RiverEditState): void {
    this.inFlight = { edit: e, at: performance.now() };
    this.solver.postMessage({ type: 'live-edit', edit: e });
  }

  private rejectInspections(error: Error): void {
    if(this.terrainTimer!==null){clearTimeout(this.terrainTimer);this.terrainTimer=null;}
    for(const item of this.terrainQueued.splice(0))item.reject(error);
    this.terrainFault=error;
    for(const pending of this.terrainRequests.values()){clearTimeout(pending.timer);pending.reject(error);}
    this.terrainRequests.clear();
    for (const pending of this.inspections.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.inspections.clear();
  }

  /** Inspect at most 64 unique cells in the current raw solver state. The worker
   * validates grid bounds and observes all records together. This has no proven
   * pairing to the displayed, smoothed frame and does not advance paused flow. */
  inspectCells(cellIds: readonly number[]): Promise<LiveCellInspection> {
    if (this.dead) return Promise.reject(new Error('[river] Cell inspection client is disposed.'));
    let ids: number[];
    try { ids = validateRiverCellIds(cellIds); } catch (err) { return Promise.reject(err); }
    if (this.inspections.size >= RIVER_CELL_INSPECTION_PENDING_LIMIT) {
      return Promise.reject(new Error('[river] Too many pending cell inspections.'));
    }
    const requestId = ++this.inspectionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.inspections.delete(requestId);
        reject(new Error('[river] Cell inspection timed out.'));
      }, RIVER_CELL_INSPECTION_TIMEOUT_MS);
      this.inspections.set(requestId, { resolve, reject, timer });
      try {
        this.solver.postMessage({ type: 'live-inspect-cells', requestId, workerRunId: this.workerRunId, cellIds: ids });
      } catch (err) {
        clearTimeout(timer);
        this.inspections.delete(requestId);
        reject(err);
      }
    });
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

  /** Send ownership only when its version/enable state changes. The page's
   * mask remains attached; transferring a private copy cannot alter floaters. */
  configureReceiving(config: RiverReceivingConfiguration): void {
    if (this.dead) return;
    const key = JSON.stringify([config.configId, config.enabled, config.maskVersion, config.grid]);
    if (key === this.receivingKey) return;
    const mask = config.enabled ? config.mask?.slice() ?? null : null;
    this.mapper.postMessage({ type: 'receiving', receiving: { ...config, mask } }, mask ? [mask.buffer] : []);
    this.receivingKey = key;
  }

  /** Release extra water at the source, leaving every downstream cell untouched. */
  startFlood(peakM3S: number, durationS: number): void {
    if (!this.dead) this.solver.postMessage({ type: 'live-flood', peakM3S, durationS });
  }

  /** Stop new excess water. The pulse already in flight or in the river continues. */
  cancelFlood(): void {
    if (!this.dead) this.solver.postMessage({ type: 'live-flood-cancel' });
  }

  setSpeed(speed: RiverLiveSpeed): void {
    this.solver.postMessage({ type: 'live-speed', speed });
  }

  /** Top the channel up to the design level (the water a narrowed channel lost, at once). */
  topUp(): void {
    this.solver.postMessage({ type: 'live-topup' });
  }

  /** Close only the source; the running solver carries admitted water onward. */
  /** The worker owns transport and sends the authoritative drawn parcels. */
  setContactWaterfall(enabled: boolean, impactMode: 'absorb' | 'junction' = 'absorb'): void {
    // Re-enabling a preview's stepped route must retain its chosen impact law.
    this.solver.postMessage({ type: 'live-contact-waterfall', enabled, impactMode });
  }

  setSourcePaused(paused: boolean): void {
    if (!this.dead) this.solver.postMessage({ type: 'live-source-pause', paused });
  }

  setPaused(paused: boolean): void {
    this.solver.postMessage({ type: 'live-pause', paused });
  }

  dispose(): void {
    this.dead = true;
    for (const pending of this.gpuDeltas.values()) pending.reject(Error('River GPU client disposed'));
    this.gpuDeltas.clear();
    if (!this.gpuBusy) { this.gpu?.dispose(); this.resident?.dispose(); }
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.rejectInspections(new Error('[river] Cell inspection client is disposed.'));
    this.solver.terminate();
    this.mapper.terminate();
  }
}
