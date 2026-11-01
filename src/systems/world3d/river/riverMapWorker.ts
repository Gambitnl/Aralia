/**
 * @file riverMapWorker.ts — the live river's flow-map worker (2026-09-29).
 *
 * The live solver (riverWorker.ts, its live role) sends a field frame a few
 * times a second through a port. This worker turns each frame into what the
 * page draws: the flow map (riverFlowField.ts `flowMapCore`, with the carried
 * foam moved on by the frame's own time), the water sheet and the half-float
 * textures (LiveFlowMapper, riverLive.ts). A map costs about 180 ms; in a
 * worker of its own it never slows the solver.
 *
 * LATEST WINS. While a map is being made or the page has not taken the last
 * one, newer frames replace older ones (their times add up, so the foam still
 * moves on by the whole time). The page sends 'ack' when it has drawn a
 * snapshot, and only then does the next one go out.
 *
 * Messages in (the page):   { type: 'port', port } (the solver's port), { type: 'ack' }
 * Messages in (the port):   { type: 'init', init }, { type: 'frame', frame }, { type: 'patch', patch }
 * Messages out (the page):  { type: 'snapshot', snap }, { type: 'map-error', message }
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/10/2026, 01:27:32
 * Dependents: components/World3D/water/riverLiveClient.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  LiveFlowMapper, liveSnapshotTransfer, type LiveFieldFrame, type LiveMapperInit, type LiveMapperPatch,
} from './riverLive';

import { RiverReceivingRefiner, receivingSheetTransfer, type RiverReceivingConfiguration,
  type RiverPreparedReceivingSheet } from '@/components/World3D/water/riverReceivingRefiner';

import { RiverFlowTextureDeltaTracker } from './riverFlowTextureDelta';

declare const WorkerGlobalScope: unknown;
if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined') {
  const scope = self as unknown as {
    onmessage: ((e: MessageEvent) => void) | null;
    postMessage: (m: unknown, t?: Transferable[]) => void;
  };
  let mapper: LiveFlowMapper | null = null;
  let flowDelta: RiverFlowTextureDeltaTracker | null = null;
  let grid: LiveMapperInit['grid'] | null = null;
  let receiving: RiverReceivingConfiguration | null = null;
  let refiner: RiverReceivingRefiner | null = null;
  let receivingError: string | undefined;
  const configureReceiving = (): void => {
    refiner = null; receivingError = undefined;
    if (!grid || !receiving?.enabled || !receiving.mask) return;
    try {
      if ((['nx','nz','dx','x0','z0'] as const).some(k => grid![k] !== receiving!.grid[k])) {
        throw new Error('Receiving configuration grid differs from mapper grid');
      }
      refiner = new RiverReceivingRefiner(grid, receiving.mask, receiving.maskVersion, receiving.configId);
    } catch (error) { receivingError = error instanceof Error ? error.message : String(error); }
  };
  let pending: LiveFieldFrame | null = null;
  let acked = true;
  let scheduled = false;
  const run = (): void => {
    scheduled = false;
    if (!mapper || !pending || !acked) return;
    const f = pending;
    pending = null;
    try {
      const snap = mapper.map(f);
      // Compare the full-resolution bits here, leaving the renderer free to
      // submit frames. No hydraulic or foam step is skipped or approximated.
      const deltaStart = performance.now();
      // A patch picture names its changed rows itself (2026-10-22, GG-430);
      // only a full picture needs the whole-texture comparison.
      if (!snap.patch) snap.flowDelta = flowDelta!.capture(grid!.nx, grid!.nz, [snap.t0h, snap.t1h, snap.t2h]);
      snap.timings.flowDelta = performance.now() - deltaStart;
      // Refinement failure must never drop a hydraulic field or wedge ACK.
      // Only derived arrays transfer; retain the original sheet for stale-mask
      // and disabled-view fallback. Latest-wins scheduling stays unchanged.
      let preparedReceiving: RiverPreparedReceivingSheet | undefined;
      let error = receivingError;
      // The refiner reads full arrays: the mapper's kept ones for a patch picture.
      if (refiner) try { preparedReceiving = refiner.refine(snap.patch && mapper.lastFull ? { ...snap, ...mapper.lastFull } : snap); }
      catch (failure) { error = failure instanceof Error ? failure.message : String(failure); }
      acked = false;
      scope.postMessage({ type: 'snapshot', snap: { ...snap, preparedReceiving, receivingError: error } },
        [...liveSnapshotTransfer(snap), ...(preparedReceiving ? receivingSheetTransfer(preparedReceiving) : [])]);
    } catch (err) {
      scope.postMessage({ type: 'map-error', message: err instanceof Error ? err.message : String(err) });
    }
  };
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(run, 0);
  };
  const fromPort = (e: MessageEvent): void => {
    const m = e.data as { type: string; init?: LiveMapperInit; frame?: LiveFieldFrame; patch?: LiveMapperPatch };
    if (m.type === 'init' && m.init) {
      flowDelta = new RiverFlowTextureDeltaTracker(crypto.randomUUID());
      mapper = new LiveFlowMapper(m.init); grid = m.init.grid; configureReceiving();
      schedule();
    } else if (m.type === 'frame' && m.frame) {
      // A newer frame replaces one not yet mapped; the foam moves on by both times.
      if (pending) m.frame.dtS += pending.dtS;
      pending = m.frame;
      schedule();
    } else if (m.type === 'patch' && m.patch) {
      mapper?.applyPatch(m.patch);
    }
  };
  scope.onmessage = (e: MessageEvent) => {
    const m = e.data as { type: string; port?: MessagePort; receiving?: RiverReceivingConfiguration };
    if (m.type === 'port' && m.port) {
      m.port.onmessage = fromPort;
    } else if (m.type === 'receiving' && m.receiving) {
      receiving = m.receiving; configureReceiving();
    } else if (m.type === 'ack') {
      acked = true;
      schedule();
    }
  };
}
