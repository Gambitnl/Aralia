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
import {
  LiveFlowMapper, liveSnapshotTransfer, type LiveFieldFrame, type LiveMapperInit, type LiveMapperPatch,
} from './riverLive';

declare const WorkerGlobalScope: unknown;
if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined') {
  const scope = self as unknown as {
    onmessage: ((e: MessageEvent) => void) | null;
    postMessage: (m: unknown, t?: Transferable[]) => void;
  };
  let mapper: LiveFlowMapper | null = null;
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
      acked = false;
      scope.postMessage({ type: 'snapshot', snap }, liveSnapshotTransfer(snap));
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
      mapper = new LiveFlowMapper(m.init);
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
    const m = e.data as { type: string; port?: MessagePort };
    if (m.type === 'port' && m.port) {
      m.port.onmessage = fromPort;
    } else if (m.type === 'ack') {
      acked = true;
      schedule();
    }
  };
}
