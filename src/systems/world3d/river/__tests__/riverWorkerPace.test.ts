/** Drive the actual worker's pace policy with staged field clocks. These
 * fixtures verify lifecycle decisions without claiming hydraulic settling. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getRiverShape } from '../riverReach';

const flow = vi.hoisted(() => ({ clock: 0, nextSim: 0, qOut: 1.5, advanceCalls: 0,
  advanceDuration: undefined as number | undefined,
  frameCalls: 0, editCalls: 0, topUpCalls: 0, inspections: 0, scheduled: 0, transfers: [] as unknown[] }));
vi.mock('../riverLive', async importOriginal => {
  const actual = await importOriginal<typeof import('../riverLive')>();
  return { ...actual,
    liveFrameTransfer: () => [], liveMapperPatchTransfer: () => [], livePatchTransfer: () => [],
    LiveRiver: class {
      simTime = 0; restores = 0; lastHealth = { ok: true }; private frameAt = 0;
      warmNoise(): void {}
      startFromField(): void {}
      mapperInit(): unknown { return {}; }
      mapperPatch(): unknown { return {}; }
      applyEdit(): unknown { flow.editCalls++; return { ms: 0 }; }
      topUpToDesignLevel(): number { flow.topUpCalls++; return 0; }
      inspectCells(ids: unknown): unknown {
        flow.inspections++;
        const selected = actual.LiveRiver.prototype.inspectCells.call(Object.assign(Object.create(actual.LiveRiver.prototype), {
          grid: { nx: 8, nz: 8, dx: 0.5, x0: 0, z0: 0 }, ground: new Float64Array(64),
          solver: { h: new Float64Array(64).fill(0.00000012), hu: new Float64Array(64), hv: new Float64Array(64),
            bed: new Float64Array(64), time: 1.75, steps: 42 }, simTime: this.simTime,
        }), ids);
        return selected;
      }
      advance(_budget: number, duration?: number): { steps: number } {
        flow.advanceCalls++; flow.advanceDuration = duration; this.simTime = flow.nextSim; return { steps: 1 };
      }
      async advanceOnGpu(execute: import('../riverGpuStep').RiverGpuExecutor): Promise<{ steps: number }> {
        flow.advanceCalls++;
        await execute({ nx: 1, nz: 1, dx: 1, dt: .01, outEdge: 0, state: new Float32Array(4), topology: new Uint32Array([1]), source: new Float32Array(4) });
        this.simTime = flow.nextSim; return { steps: 1 };
      }
      async advanceResidentOnGpu(execute:import('../riverGpuResident').RiverGpuResidentExecutor):Promise<{steps:number}>{
        flow.advanceCalls++;
        const output=await execute({session:1,nx:1,nz:1,dx:1,outEdge:0,expansion:false,maxDt:.05,cfl:.45,lastMaxSpeed:1,discharge:0,slots:8,duration:.2,upload:{full:{state:new Float32Array(4),source:new Float32Array(4),flags:new Uint32Array([1])},resync:true}});
        this.simTime=flow.nextSim;return{steps:output.steps};
      }
      frame(): unknown {
        flow.frameCalls++;
        const dtS = this.simTime - this.frameAt; this.frameAt = this.simTime;
        return { simTime: this.simTime, dtS, qIn: 1.5, qOut: flow.qOut, ms: 0, readout: {} };
      }
    },
  };
});

type Status = { type: string; fast: boolean; simTime: number; qOutSmooth: number; paused: boolean; suspended?: boolean };
let tick: () => void;
let send: (data: unknown) => void;
const statuses: Status[] = [];
class TickChannel {
  port1 = { onmessage: null as (() => void) | null };
  port2 = { postMessage: () => { flow.scheduled++; } };
  constructor() { tick = () => this.port1.onmessage!(); }
}
const step = (simTime: number): Status => {
  flow.nextSim = simTime; flow.clock += 500; tick();
  return statuses.filter(s => s.type === 'live-status').at(-1)!;
};
const startLive = (startPaused?: boolean, startSuspended?: boolean, gpu = false, resident=false): void => {
  const a = new Float32Array(0);
  send({ type: 'live-start', workerRunId: 'pace-test-run', seed: 1, edit: { shape: getRiverShape(), course: null }, speed: 'auto', startPaused, startSuspended, gpu:gpu||resident,resident,
    field: { h: a, u: a, v: a, uRms: a, t1: a }, mapPort: { postMessage: () => {} } });
};

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); statuses.length = 0;
  Object.assign(flow, { clock: 0, nextSim: 0, qOut: 1.5, advanceCalls: 0,
    advanceDuration: undefined,
    frameCalls: 0, editCalls: 0, topUpCalls: 0, inspections: 0, scheduled: 0, transfers: [] });
  vi.spyOn(performance, 'now').mockImplementation(() => flow.clock);
  vi.stubGlobal('MessageChannel', TickChannel);
  vi.stubGlobal('WorkerGlobalScope', function WorkerGlobalScope() {});
  const scope = { onmessage: null as ((event: { data: unknown }) => void) | null,
    postMessage: (value: Status, transfer?: unknown[]) => { statuses.push(value); flow.transfers.push(transfer); } };
  vi.stubGlobal('self', scope);
  await import('../riverWorker');
  send = data => scope.onmessage!({ data });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('native worker shared-device GPU stepping', () => {
  it('queues resident controls and inspection until the complete interval returns',async()=>{
    startLive(false,false,true,true);step(1);expect(flow.advanceCalls).toBe(0);
    send({type:'live-gpu-ready'});flow.clock+=500;flow.nextSim=2;tick();
    const request=statuses.find(s=>s.type==='live-gpu-resident') as unknown as {id:number};expect(request).toBeDefined();
    send({type:'live-pause',paused:true});send({type:'live-inspect-cells',requestId:1,workerRunId:'pace-test-run',cellIds:[1]});tick();
    expect(flow.inspections).toBe(0);expect(flow.advanceCalls).toBe(1);
    send({type:'live-gpu-resident-result',id:request.id,output:{steps:4,elapsedMs:2}});
    for(let i=0;i<8;i++)await Promise.resolve();expect(flow.inspections).toBe(1);
    expect(step(3)).toMatchObject({paused:true});expect(flow.advanceCalls).toBe(1);
  });
  it('stops resident failures without requesting another interval or CPU step',async()=>{
    startLive(false,false,true,true);send({type:'live-gpu-ready'});flow.clock+=500;tick();
    const request=statuses.find(s=>s.type==='live-gpu-resident') as unknown as {id:number};
    send({type:'live-gpu-resident-result',id:request.id,error:'resident epoch rejected'});
    for(let i=0;i<8;i++)await Promise.resolve();expect(statuses.some(s=>s.type==='live-error')).toBe(true);
    flow.clock+=500;tick();expect(flow.advanceCalls).toBe(1);
  });
  it('waits for the scene device and defers edits and inspection until its result commits', async () => {
    startLive(false, false, true); step(1);expect(flow.advanceCalls).toBe(0);
    send({ type: 'live-gpu-ready' });flow.nextSim=2;flow.clock+=500;tick();
    const request = statuses.find(s=>s.type==='live-gpu-step') as unknown as {id:number};
    expect(request).toBeDefined();expect(flow.advanceCalls).toBe(1);
    send({type:'live-edit',edit:{shape:getRiverShape(),course:null}});
    send({type:'live-inspect-cells',requestId:1,workerRunId:'pace-test-run',cellIds:[1]});
    tick();expect(flow.advanceCalls).toBe(1);expect(flow.editCalls).toBe(0);expect(flow.inspections).toBe(0);
    send({type:'live-gpu-result',id:request.id,output:{cells:new Float32Array(8),elapsedMs:1}});
    for(let i=0;i<6;i++)await Promise.resolve();
    expect(flow.inspections).toBe(1);expect(flow.editCalls).toBe(0);
    // The queued edit is applied at the following slice, before another request.
    flow.clock+=500;tick();expect(flow.editCalls).toBe(1);
  });
  it('stops after GPU failure without silently advancing on the CPU', async () => {
    startLive(false,false,true);send({type:'live-gpu-ready'});flow.clock+=500;tick();
    const request=statuses.find(s=>s.type==='live-gpu-step') as unknown as {id:number};
    send({type:'live-gpu-result',id:request.id,error:'manufactured device loss'});
    for(let i=0;i<6;i++)await Promise.resolve();
    expect(statuses.some(s=>s.type==='live-error')).toBe(true);
    flow.clock+=500;tick();expect(flow.advanceCalls).toBe(1);
  });
});

describe('native worker initial pause', () => {
  it('holds a hidden start without advancing, mapping or scheduling a recurring timer', () => {
    startLive(false, true);
    step(1);
    expect(flow.advanceCalls).toBe(0);
    expect(flow.frameCalls).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    send({ type: 'live-suspend', suspended: false });
    expect(step(2)).toMatchObject({ paused: false, suspended: false, simTime: 2 });
  });

  it('retains manual pause and processes edits while hidden without advancing water', () => {
    startLive(true);
    step(1);
    send({ type: 'live-suspend', suspended: true });
    send({ type: 'live-edit', edit: { shape: getRiverShape(), course: null } });
    step(2);
    expect(flow.editCalls).toBe(1);
    expect(flow.advanceCalls).toBe(0);
    send({ type: 'live-suspend', suspended: false });
    expect(step(3)).toMatchObject({ paused: true, suspended: false, simTime: 0 });
    expect(flow.advanceCalls).toBe(0);
  });

  it('does not catch up hidden wall time or keep producing fields after suspension', () => {
    startLive();
    step(45); // Ordinary auto settlement; real-time stepping starts next.
    send({ type: 'live-suspend', suspended: true });
    const before = { advances: flow.advanceCalls, frames: flow.frameCalls };
    step(46); // Consume a slice already queued at the visibility change.
    expect({ advances: flow.advanceCalls, frames: flow.frameCalls }).toEqual(before);
    expect(vi.getTimerCount()).toBe(0);
    flow.clock += 60_000;
    send({ type: 'live-suspend', suspended: false });
    expect(step(45.5)).toMatchObject({ paused: false, suspended: false, simTime: 45.5 });
    expect(flow.advanceDuration).toBeCloseTo(0.5, 12);
    expect(flow.advanceCalls).toBe(before.advances + 1);
  });

  it('initializes and publishes while holding zero advances until explicit unpause', () => {
    startLive(true);
    expect(statuses.some(s => s.type === 'live-ready')).toBe(true);
    expect(flow.advanceCalls).toBe(0);
    for (const prospectiveTime of [1, 2, 3]) {
      expect(step(prospectiveTime)).toMatchObject({ paused: true, simTime: 0 });
      expect(flow.advanceCalls).toBe(0);
    }
    expect(flow.frameCalls).toBe(1);
    send({ type: 'live-pause', paused: false });
    expect(step(4)).toMatchObject({ paused: false, simTime: 4 });
    expect(flow.advanceCalls).toBe(1);
  });

  it.each([undefined, false])('preserves immediate advancement when startPaused is %s', startPaused => {
    startLive(startPaused);
    expect(flow.advanceCalls).toBe(0);
    expect(step(1)).toMatchObject({ paused: false, simTime: 1 });
    expect(flow.advanceCalls).toBe(1);
  });
});

describe('native worker auto pace policy', () => {
  beforeEach(() => startLive());
  it('observes current cells atomically while paused with a pending edit, without scheduling or broad transfers', () => {
    send({ type: 'live-pause', paused: true });
    send({ type: 'live-edit', edit: { shape: getRiverShape(), course: null } });
    send({ type: 'live-topup' });
    const before = { advance: flow.advanceCalls, frame: flow.frameCalls, edit: flow.editCalls,
      topUp: flow.topUpCalls, scheduled: flow.scheduled };
    send({ type: 'live-inspect-cells', workerRunId: 'pace-test-run', requestId: 1, cellIds: [3, 7] });
    const message = statuses.at(-1) as unknown as { type: string; inspection: import('../riverCellInspection').LiveCellInspection };
    expect(message.type).toBe('live-inspect-cells');
    expect(message.inspection).toMatchObject({ requestId: 1, workerRunId: 'pace-test-run', observationSequence: 1,
      pendingEdit: true, paused: true, displayPairing: 'unavailable', solverTime: 1.75, solverSteps: 42, liveSimTime: 0 });
    expect(message.inspection.cells.map(c => [c.cellId, c.h])).toEqual([[3, 0.00000012], [7, 0.00000012]]);
    expect(flow.transfers.at(-1)).toBeUndefined();
    expect({ advance: flow.advanceCalls, frame: flow.frameCalls, edit: flow.editCalls,
      topUp: flow.topUpCalls, scheduled: flow.scheduled }).toEqual(before);
    send({ type: 'live-inspect-cells', workerRunId: 'pace-test-run', requestId: 2, cellIds: [3] });
    expect((statuses.at(-1) as unknown as typeof message).inspection.observationSequence).toBe(2);
  });

  it('rejects invalid selections and ignores a request for a different worker run', () => {
    for(const cellIds of [[], [64], [1, 1], Array.from({ length: 65 }, (_, i) => i)]) {
      send({ type: 'live-inspect-cells', workerRunId: 'pace-test-run', requestId: 1, cellIds });
      expect(statuses.at(-1)).toMatchObject({ type: 'live-inspect-cells-error', requestId: 1, workerRunId: 'pace-test-run' });
    }
    const before = statuses.length, reads = flow.inspections;
    send({ type: 'live-inspect-cells', workerRunId: 'other-run', requestId: 9, cellIds: [1] });
    expect(statuses).toHaveLength(before);
    expect(flow.inspections).toBe(reads);
    expect(flow.advanceCalls).toBe(0);
    expect(flow.frameCalls).toBe(0);
  });
  it('requires 45 seconds after an edit even when outflow already matches', () => {
    expect(step(44.99).fast).toBe(true);
    expect(step(45).fast).toBe(false);
    send({ type: 'live-edit', edit: { shape: getRiverShape(), course: null } });
    expect(step(45).fast).toBe(true);
    expect(step(89.99).fast).toBe(true);
    expect(step(90).fast).toBe(false);
  });

  it('uses the unchanged 900-second cap when discharge does not settle', () => {
    flow.qOut = 3;
    expect(step(45).fast).toBe(true);
    expect(step(899.99).fast).toBe(true);
    expect(step(900).fast).toBe(false);
    expect(step(901).fast).toBe(false);
    expect(statuses.filter(s => s.type === 'live-status').at(-1)!.qOutSmooth).toBe(3);
  });

  it('top-up restarts auto settling and explicit fast pace keeps stepping after settlement', () => {
    expect(step(45).fast).toBe(false);
    send({ type: 'live-topup' });
    expect(step(45).fast).toBe(true);
    expect(step(90).fast).toBe(false);
    send({ type: 'live-speed', speed: 'fast' });
    expect(step(91).fast).toBe(true);
    send({ type: 'live-speed', speed: 'auto' });
    expect(step(92).fast).toBe(false);
  });

  it('applies edits while paused and defers new stepping until resume', () => {
    expect(step(45).fast).toBe(false);
    send({ type: 'live-pause', paused: true });
    send({ type: 'live-edit', edit: { shape: getRiverShape(), course: null } });
    const before = flow.advanceCalls;
    expect(step(46)).toMatchObject({ fast: true, simTime: 45, paused: true });
    expect(flow.advanceCalls).toBe(before);
    send({ type: 'live-pause', paused: false });
    expect(step(46)).toMatchObject({ fast: true, simTime: 46, paused: false });
    expect(flow.advanceCalls).toBe(before + 1);
  });
});
