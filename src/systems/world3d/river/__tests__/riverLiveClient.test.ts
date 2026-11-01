/** Checks snapshot elapsed telemetry without changing the mapper's acknowledgement contract. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RiverLiveClient, RIVER_CELL_INSPECTION_PENDING_LIMIT, RIVER_CELL_INSPECTION_TIMEOUT_MS } from '@/components/World3D/water/riverLiveClient';
import { getRiverShape } from '../riverReach';
import type { LiveFlowSnapshot } from '../riverLive';
import type { RiverReceivingConfiguration } from '@/components/World3D/water/riverReceivingRefiner';

let clock = 0;
const workers: FakeWorker[] = [];
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  sent: unknown[] = [];
  transfers: Transferable[][] = [];
  constructor() { workers.push(this); }
  postMessage(message: { type: string }, transfer: Transferable[] = []): void {
    this.transfers.push(transfer);
    this.sent.push(message);
    if (message.type === 'ack') clock += 2;
  }
  terminate(): void { /* Disposable worker fixture. */ }
}
function client(onSnapshot: (snapshot: LiveFlowSnapshot) => void, startPaused?: boolean, viewportVisible?: boolean): RiverLiveClient {
  workers.length = 0;
  clock = 100;
  vi.stubGlobal('Worker', FakeWorker);
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  return new RiverLiveClient({ seed: 1, edit: { shape: getRiverShape(), course: null }, speed: 'auto', field: null, startPaused, viewportVisible }, { onSnapshot });
}
const snapshot = { simTime: 5, ms: 7 } as LiveFlowSnapshot;
describe('compute fault status', () => {
  it('reports the worker stop immediately and replaces it only with a new accepted status', () => {
    const live = client(() => {});
    const accepted = { type: 'live-status', backend: 'gpu', simTime: 12, paused: false, rate: 1, stepsPerS: 20, volume: 15 };
    workers[0].onmessage?.({ data: accepted });
    workers[0].onmessage?.({ data: { type: 'live-error', message: '[river] GPU stepping stopped: capacity' } });
    expect(live.lastStatus).toMatchObject({ simTime: 12, volume: 15, paused: true, rate: 0, stepsPerS: 0, fault: '[river] GPU stepping stopped: capacity' });
    workers[0].onmessage?.({ data: { ...accepted, simTime: 13, volume: 16.5 } });
    expect(live.lastStatus).toMatchObject({ simTime: 13, paused: false, volume: 16.5 });
    expect(live.lastStatus?.fault).toBeUndefined();
    live.dispose();
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('ordered landscape batching',()=>{
  const dab={kind:'dab' as const,stroke:1,tool:'raise' as const,x:10,z:20,radius:3,strength:.1};
  it('bounds each batch and keeps later commands behind acknowledgement, without dropping finish',async()=>{
    vi.useFakeTimers();const live=client(()=>{}),solver=workers[0];
    const done=Array.from({length:140},(_,i)=>live.terrain({...dab,x:i}));
    done.push(live.terrain({kind:'finish'}));
    vi.advanceTimersByTime(16);
    const requests=()=>solver.sent.filter((m)=> (m as {type:string}).type==='live-terrain') as Array<{requestId:number;commands:unknown[]}>;
    expect(requests()).toHaveLength(1);expect(requests()[0].commands).toHaveLength(128);
    expect(requests()[0].commands[127]).toMatchObject({x:127});
    solver.onmessage?.({data:{type:'live-terrain-result',requestId:requests()[0].requestId,undoCount:1,patch:null}});
    expect(requests()).toHaveLength(2);expect(requests()[1].commands).toHaveLength(13);
    expect(requests()[1].commands[0]).toMatchObject({x:128});
    expect(requests()[1].commands.at(-1)).toEqual({kind:'finish'});
    solver.onmessage?.({data:{type:'live-terrain-result',requestId:requests()[1].requestId,undoCount:1,patch:null}});
    expect(await Promise.all(done)).toEqual(Array(141).fill({undoCount:1}));live.dispose();
  });
  it('rejects unsent work on disposal, and never retries a batch with unknown commit status',async()=>{
    vi.useFakeTimers();const live=client(()=>{}),solver=workers[0];
    const first=live.terrain(dab),firstCheck=expect(first).rejects.toThrow('acknowledgement timed out');
    vi.advanceTimersByTime(16);const second=live.terrain(dab),secondCheck=expect(second).rejects.toThrow('acknowledgement timed out');
    vi.advanceTimersByTime(60000);await firstCheck;await secondCheck;
    expect(solver.sent.filter(m=>(m as {type:string}).type==='live-terrain')).toHaveLength(1);
    await expect(live.terrain(dab)).rejects.toThrow('reload before painting');live.dispose();
    const other=client(()=>{}),queued=other.terrain(dab),check=expect(queued).rejects.toThrow();other.dispose();await check;
  });
});

describe('initial worker pause protocol', () => {
  it('combines zero-area and document visibility without overriding manual pause', () => {
    const page = new EventTarget() as EventTarget & { hidden: boolean };
    page.hidden = false;
    vi.stubGlobal('document', page);
    const live = client(() => {}, true, false), solver = workers[0];
    expect(solver.sent[0]).toMatchObject({ startPaused: true, startSuspended: true });
    live.setViewportVisible(false);
    page.dispatchEvent(new Event('visibilitychange'));
    expect(solver.sent).toHaveLength(1);
    page.hidden = true;
    live.setViewportVisible(true);
    expect(solver.sent).toHaveLength(1);
    page.hidden = false;
    page.dispatchEvent(new Event('visibilitychange'));
    expect(solver.sent.at(-1)).toEqual({ type: 'live-suspend', suspended: false });
    live.setPaused(false);
    live.setViewportVisible(false);
    expect(solver.sent.slice(-2)).toEqual([{ type: 'live-pause', paused: false }, { type: 'live-suspend', suspended: true }]);
    live.setViewportVisible(true);
    expect(solver.sent.at(-1)).toEqual({ type: 'live-suspend', suspended: false });
    live.dispose();
    const count = solver.sent.length;
    live.setViewportVisible(false);
    expect(solver.sent).toHaveLength(count);
  });

  it('suspends hidden pages independently of manual pause and removes its listener on disposal', () => {
    const page = new EventTarget() as EventTarget & { hidden: boolean };
    page.hidden = true;
    vi.stubGlobal('document', page);
    const live = client(() => {}, true), solver = workers[0];
    expect(solver.sent[0]).toMatchObject({ type: 'live-start', startPaused: true, startSuspended: true });
    page.hidden = false;
    page.dispatchEvent(new Event('visibilitychange'));
    expect(solver.sent.at(-1)).toEqual({ type: 'live-suspend', suspended: false });
    live.setPaused(false);
    page.hidden = true;
    page.dispatchEvent(new Event('visibilitychange'));
    expect(solver.sent.slice(-2)).toEqual([{ type: 'live-pause', paused: false }, { type: 'live-suspend', suspended: true }]);
    const remove = vi.spyOn(page, 'removeEventListener');
    live.dispose();
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    const count = solver.sent.length;
    page.hidden = false;
    page.dispatchEvent(new Event('visibilitychange'));
    expect(solver.sent).toHaveLength(count);
  });

  it.each([true, false, undefined])('forwards startPaused unchanged as %s', startPaused => {
    const live = client(() => {}, startPaused);
    expect(workers[0].sent[0]).toMatchObject({ type: 'live-start', startPaused });
    expect(workers[0].sent).toHaveLength(1);
    live.dispose();
  });
});

type InspectionRequest = { type: string; workerRunId: string; requestId: number; cellIds: number[] };
const inspectReply = (request: InspectionRequest) => ({ type: 'live-inspect-cells',
  workerRunId: request.workerRunId, requestId: request.requestId,
  inspection: { workerRunId: request.workerRunId, requestId: request.requestId,
    observationSequence: 1, displayPairing: 'unavailable', cells: [{ cellId: request.cellIds[0], h: 0.00000012 }] },
});

describe('on-demand current raw cell request lifecycle', () => {
  it('copies the bounded selection and correlates out-of-order replies without snapshot or mapper traffic', async () => {
    const live = client(() => { throw new Error('Inspection must not deliver a snapshot'); });
    const ids = [3], first = live.inspectCells(ids), one = workers[0].sent.at(-1) as InspectionRequest;
    ids[0] = 9;
    expect(one.cellIds).toEqual([3]);
    const second = live.inspectCells([7]), two = workers[0].sent.at(-1) as InspectionRequest;
    expect(one.workerRunId).toBe((workers[0].sent[0] as InspectionRequest).workerRunId);
    expect(workers[0].transfers.at(-1)).toEqual([]);
    workers[0].onmessage?.({ data: inspectReply(two) });
    workers[0].onmessage?.({ data: inspectReply(one) });
    expect((await first).cells[0].cellId).toBe(3);
    expect((await second).cells[0].cellId).toBe(7);
    expect(live.snapshotLog).toHaveLength(0);
    expect(workers[1].sent).toHaveLength(1);
    live.dispose();
  });

  it('rejects invalid selections locally without clamping or posting', async () => {
    const live = client(() => {}), solver = workers[0];
    for (const ids of [[], [1,1], [-1], [0.5], [NaN], Array.from({ length: 65 }, (_, i) => i)]) {
      await expect(live.inspectCells(ids)).rejects.toThrow(/Cell inspection/);
    }
    expect(solver.sent).toHaveLength(1);
    live.dispose();
  });

  it('ignores stale runs, unknown IDs and mismatched nested provenance, then resolves only the right reply', async () => {
    const live = client(() => {});
    let resolved = false;
    const result = live.inspectCells([3]).then(value => { resolved = true; return value; });
    const request = workers[0].sent.at(-1) as InspectionRequest;
    workers[0].onmessage?.({ data: inspectReply({ ...request, workerRunId: 'old-run' }) });
    workers[0].onmessage?.({ data: inspectReply({ ...request, requestId: request.requestId + 100 }) });
    const nestedMismatch = inspectReply(request);
    nestedMismatch.inspection.workerRunId = 'other-nested-run';
    workers[0].onmessage?.({ data: nestedMismatch });
    await Promise.resolve();
    expect(resolved).toBe(false);
    workers[0].onmessage?.({ data: inspectReply(request) });
    expect((await result).requestId).toBe(request.requestId);
    workers[0].onmessage?.({ data: inspectReply(request) }); // Duplicate has no remaining promise.
    live.dispose();
  });

  it('bounds pending work, times out requests, and ignores their late replies', async () => {
    vi.useFakeTimers();
    const live = client(() => {});
    const pending = Array.from({ length: RIVER_CELL_INSPECTION_PENDING_LIMIT }, (_, i) => live.inspectCells([i]).catch(error => error));
    const oldRequest = workers[0].sent.at(-1) as InspectionRequest;
    await expect(live.inspectCells([5])).rejects.toThrow(/Too many pending/);
    await vi.advanceTimersByTimeAsync(RIVER_CELL_INSPECTION_TIMEOUT_MS);
    for (const error of await Promise.all(pending)) expect(error.message).toMatch(/timed out/);
    let done = false;
    const next = live.inspectCells([8]).then(value => { done = true; return value; });
    workers[0].onmessage?.({ data: inspectReply(oldRequest) });
    await Promise.resolve();
    expect(done).toBe(false);
    workers[0].onmessage?.({ data: inspectReply(workers[0].sent.at(-1) as InspectionRequest) });
    expect((await next).cells[0].cellId).toBe(8);
    live.dispose();
  });

  it('rejects request-specific errors, runtime failure, disposal and post failure without retaining timers', async () => {
    vi.useFakeTimers();
    const live = client(() => {}), solver = workers[0];
    const first = live.inspectCells([1]), request = solver.sent.at(-1) as InspectionRequest;
    const rejected = expect(first).rejects.toThrow('Outside grid');
    solver.onmessage?.({ data: { type: 'live-inspect-cells-error', workerRunId: request.workerRunId,
      requestId: request.requestId, message: 'Outside grid' } });
    await rejected;
    const runtime = expect(live.inspectCells([2])).rejects.toThrow('Worker crashed');
    solver.onerror?.({ message: 'Worker crashed' });
    await runtime;
    const liveError = expect(live.inspectCells([2])).rejects.toThrow('Solver unavailable');
    solver.onmessage?.({ data: { type: 'live-error', message: 'Solver unavailable' } });
    await liveError;
    const post = vi.spyOn(solver, 'postMessage').mockImplementationOnce(() => { throw new Error('Post failed'); });
    await expect(live.inspectCells([3])).rejects.toThrow('Post failed');
    post.mockRestore();
    const disposed = expect(live.inspectCells([4])).rejects.toThrow('disposed');
    live.dispose();
    await disposed;
    await expect(live.inspectCells([5])).rejects.toThrow('disposed');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('river snapshot delivery measurement', () => {
  it('updates paused work telemetry without replacing the hydraulic readout or creating a snapshot', () => {
    const live = client(() => {});
    const readout = { meanSpeed: 1, meanDepth: 2, froude: 0.1, wetAreaM2: 30 };
    workers[0].onmessage?.({ data: { type: 'live-status', simTime: 5, readout, paused: false, fast: true } });
    workers[0].onmessage?.({ data: { type: 'live-work', work: { advanceMs: 0, busyShare: 0.001 }, paused: true, fast: true } });
    expect(live.lastStatus).toMatchObject({ simTime: 5, readout, paused: true, work: { advanceMs: 0, busyShare: 0.001 } });
    expect(live.snapshotLog).toHaveLength(0);
    live.dispose();
  });

  it('acknowledges only after application and keeps worker time separate', () => {
    const live = client(() => {
      expect(workers[1].sent.some(m => (m as { type: string }).type === 'ack')).toBe(false);
      clock += 35;
    });
    workers[1].onmessage?.({ data: { type: 'snapshot', snap: snapshot } });
    expect(live.snapshotLog).toEqual([{ at: 100, mapMs: 7, simTime: 5, applyMs: 35, ackMs: 2, handlerMs: 37 }]);
    live.dispose();
  });

  it('acknowledges and records a failed application while preserving its error', () => {
    const failure = new Error('view failed');
    const live = client(() => { clock += 10; throw failure; });
    expect(() => workers[1].onmessage?.({ data: { type: 'snapshot', snap: snapshot } })).toThrow(failure);
    expect(workers[1].sent.at(-1)).toEqual({ type: 'ack' });
    expect(live.snapshotLog[0]).toMatchObject({ applyMs: 10, handlerMs: 12 });
    live.dispose();
  });

  it('bounds telemetry and ignores delivery after disposal', () => {
    const live = client(() => { clock += 1; });
    for (let i = 0; i < 405; i += 1) workers[1].onmessage?.({ data: { type: 'snapshot', snap: snapshot } });
    expect(live.snapshotLog).toHaveLength(400);
    expect(live.snapshotLog[0].at).toBe(115);
    live.dispose();
    workers[1].onmessage?.({ data: { type: 'snapshot', snap: snapshot } });
    expect(live.snapshotLog).toHaveLength(400);
  });
});

describe('receiving worker ownership', () => {
  const configuration = (): RiverReceivingConfiguration => ({
    grid: { nx: 2, nz: 2, dx: 1, x0: 0, z0: 0 },
    mask: new Uint8Array([1,2,3,4]), maskVersion: 1, configId: 'first-view', enabled: true,
  });
  it('keeps the view mask attached and deduplicates only the same ownership state', () => {
    const live = client(() => {}), config = configuration();
    live.configureReceiving(config);
    live.configureReceiving(config);
    const mapper = workers[1];
    const packet = mapper.sent.at(-1) as { receiving: RiverReceivingConfiguration };
    expect(mapper.sent).toHaveLength(2); // Initial port and one ownership packet.
    expect(packet.receiving.mask).not.toBe(config.mask);
    expect(packet.receiving.mask).toEqual(config.mask);
    structuredClone(packet, { transfer: mapper.transfers.at(-1)! });
    expect(config.mask?.byteLength).toBe(4);
    expect(Array.from(config.mask!)).toEqual([1,2,3,4]);
    live.configureReceiving({ ...config, configId: 'replacement-view' });
    expect(mapper.sent).toHaveLength(3); // Same version still belongs to a new view.
    live.configureReceiving({ ...config, configId: 'disabled', enabled: false });
    expect((mapper.sent.at(-1) as { receiving: RiverReceivingConfiguration }).receiving.mask).toBeNull();
    live.configureReceiving({ ...config, configId: 'reenabled' });
    expect(mapper.sent).toHaveLength(5);
    live.dispose();
    live.configureReceiving({ ...config, configId: 'disposed' });
    expect(mapper.sent).toHaveLength(5);
  });
  it('delivers a refinement failure as an ordinary hydraulic snapshot and acknowledges it', () => {
    let delivered: unknown;
    const live = client(value => { delivered = value; clock += 3; });
    const failed = { ...snapshot, receivingError: 'invalid view ownership' };
    workers[1].onmessage?.({ data: { type: 'snapshot', snap: failed } });
    expect(delivered).toBe(failed);
    expect(workers[1].sent.at(-1)).toEqual({ type: 'ack' });
    expect(live.snapshotLog[0]).toMatchObject({ mapMs: 7, applyMs: 3, receivingError: failed.receivingError });
    live.dispose();
  });
});
