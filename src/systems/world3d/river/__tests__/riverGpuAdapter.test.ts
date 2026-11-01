/** Acceptance-boundary tests; actual GPU physics parity is measured separately. */
import { describe, expect, it } from 'vitest';
import { RiverFlowSolver } from '../riverSolver';
import type { RiverGpuOutput } from '../riverGpuStep';
import { RiverSpillTransfer } from '../riverSpillTransfer';
import type {RiverGpuResidentInput,RiverGpuResidentOutput} from '../riverGpuResident';

/** A fake device interval: two steps; `changes` lists the cells it changed
 * as (cell, h, hu, hv, the four integrals). Flags follow the uploaded reach. */
function interval(input:RiverGpuResidentInput,changes:[number,number,number,number,number,number,number,number][]=[],flags=1):RiverGpuResidentOutput{
  const journal=new Float32Array(16);journal.set([.01,3,0,input.nx*input.nz,.01,.02,0,1],0);journal.set([.01,3,0,input.nx*input.nz,.02,.04,0,1],8);
  const records=new Uint32Array(changes.length*8),values=new Float32Array(records.buffer);
  changes.forEach(([c,...rest],k)=>{records[k*8]=c<<4|flags;values.set(rest,k*8+1);});
  return{records,journal,steps:2,duration:.02,inVolume:.04,outVolume:0,lastMaxSpeed:3,awakeCells:12,uploadBytes:0,elapsedMs:1};
}

function river() {
  const solver = new RiverFlowSolver({ grid: { nx: 4, nz: 3, dx: 1, x0: 0, z0: 0 },
    bed: new Float64Array(12), manning: new Float32Array(12),
    dischargeM3S: 2, inflow: [{ c: 5, share: 1 }], inflowDir: [1, 0], inflowSpeedMS: 1,
    outflowEdge: 'east', maxDtS: .01 });
  solver.h.fill(.5);
  return solver;
}

describe('native river GPU result acceptance', () => {
  it('uploads every cell first, then only the changes, and accepts changed cells only',async()=>{
    const solver=river(),uploads:RiverGpuResidentInput['upload'][]=[];
    const result=await solver.intervalOnGpu(async input=>{
      const {full}=input.upload;expect(full?.state.length).toBe(48);expect(full?.flags[5]).toBe(1|4);
      const delivered=structuredClone(input,{transfer:[full!.state.buffer,full!.source.buffer,full!.flags.buffer]});
      expect(input.upload.full!.state.length).toBe(0);expect(solver.time).toBe(0);expect(()=>solver.step()).toThrow('must finish');
      uploads.push(delivered.upload);return interval(delivered,[[5,.54,.1,0,.0108,.002,0,.0004]]);
    },.2);
    expect(result.steps).toBe(2);expect(solver.steps).toBe(2);expect(solver.time).toBe(.02);expect(solver.inVolume).toBe(.04);
    expect(solver.h[5]).toBeCloseTo(.54,6);expect(solver.hu[5]).toBeCloseTo(.1,6);expect(solver.h[4]).toBe(.5);
    // A second interval with no CPU change uploads nothing.
    await solver.intervalOnGpu(async input=>{uploads.push(input.upload);return interval(input);},.2);
    expect(uploads[1]).toEqual({rows:null,cells:null,resync:false});
    // A new inlet sends both the old and the new inlet cell, and resyncs flags.
    solver.setInflow(2,[{c:6,share:1}],[1,0],1);
    await solver.intervalOnGpu(async input=>{uploads.push(input.upload);return interval(input);},.2);
    expect([...uploads[2].cells!.index].sort()).toEqual([5,6]);expect(uploads[2].resync).toBe(true);
    expect(uploads[2].cells!.flags[[...uploads[2].cells!.index].indexOf(6)]&4).toBe(4);
    expect(uploads[2].cells!.source[[...uploads[2].cells!.index].indexOf(5)*4]).toBe(0);
    // A bed edit sends its rows (with their water) and nothing else.
    const bed=solver.bed.slice();bed[9]=.1;solver.updateBed(1,2,1,2,bed,new Float32Array(12),null);
    await solver.intervalOnGpu(async input=>{uploads.push(input.upload);return interval(input);},.2);
    expect(uploads[3].rows).toMatchObject({j0:2,j1:2});expect(uploads[3].rows!.state[1*4+3]).toBeCloseTo(.1,6);expect(uploads[3].cells).toBeNull();
  });
  it.each(['device','late average','clock','negative'] as const)('rejects resident %s failure before any native commit, then uploads every cell',async failure=>{
    const solver=river(),before=solver.saveState();
    await solver.intervalOnGpu(async input=>interval(input),.2);
    const accepted=solver.saveState(),time=solver.time;
    await expect(solver.intervalOnGpu(async input=>{
      if(failure==='device')throw Error('device lost');const out=interval(input,[[0,.9,0,0,.009,0,0,0],[11,.4,0,0,.004,0,0,0]]);
      const values=new Float32Array(out.records.buffer);
      if(failure==='late average')values[15]=NaN;
      if(failure==='clock')out.duration=.1;
      if(failure==='negative')values[9]=-.1;
      return out;
    },.2)).rejects.toThrow();
    expect(solver.h).toEqual(accepted.h);expect(before.h).toEqual(accepted.h);expect(solver.time).toBe(time);expect(solver.steps).toBe(2);expect(()=>solver.step()).not.toThrow();
    let full=false;await solver.intervalOnGpu(async input=>{full=!!input.upload.full;return interval(input);},.2).catch(()=>{});
    expect(full).toBe(true);
  });
  it('reports sleeping cells and builds its runs again only when they are read',async()=>{
    const solver=river();
    await solver.intervalOnGpu(async input=>interval(input,[[0,0,0,0,0,0,0,0]],0),.2);
    expect(solver.activeCells).toBe(12);
    expect(solver.health().ok).toBe(true);expect(solver.activeCells).toBe(12);
  });
  it('commits accepted water after the worker transfers and detaches all packed inputs', async () => {
    const solver = river();
    await solver.stepOnGpu(async input => {
      const delivered = structuredClone(input, { transfer: [input.state.buffer, input.topology.buffer, input.source.buffer, input.activeCells!.buffer] });
      expect(input.topology.length).toBe(0);
      const cells = new Float32Array(12 * 8);
      for (let c = 0; c < 12; c++) { cells[c * 8] = delivered.state[c * 4]; cells[c * 8 + 3] = 3; }
      cells[5 * 8] += .02;
      return { cells, elapsedMs: 1 };
    });
    expect(solver.h[5]).toBeCloseTo(.52, 6);expect(solver.volume()).toBeCloseTo(6.02, 6);
  });
  it('maps compact sparse output back to native cell IDs without touching sleeping water', async () => {
    const bed = new Float64Array(64), ceiling = new Float64Array(64).fill(-1);ceiling[27] = 1;
    const solver = new RiverFlowSolver({ grid: { nx: 8, nz: 8, dx: 1, x0: 0, z0: 0 }, bed,
      manning: new Float32Array(64), dischargeM3S: 0, inflow: [], inflowDir: [1, 0], inflowSpeedMS: 0,
      outflowEdge: 'east', maxDtS: .01 }, ceiling);
    solver.h[27] = .5;
    await solver.stepOnGpu(async input => {
      expect(input.activeCells!.length).toBe(9);
      const cells = new Float32Array(input.activeCells!.length * 8);
      input.activeCells!.forEach((c,k) => { cells[k * 8] = input.state[c * 4] + (c === 27 ? .02 : 0); });
      return { cells, elapsedMs: 1, compact: true };
    });
    expect(solver.h[27]).toBeCloseTo(.52, 6);expect(solver.h[0]).toBe(0);expect(solver.volume()).toBeCloseTo(.52, 6);
  });
  it('restores airborne ownership when a device fails after the spill callback', async () => {
    const solver = river(), transfer = new RiverSpillTransfer(solver.grid, [{ from: 5, to: 6, axis: 'x' }]);
    solver.setSpillTransfer(transfer);solver.bed[5] = 4;solver.h[6] = 0;solver.hu[5] = 1;
    const before = transfer.saveState(), initial = solver.h.slice();
    await expect(solver.stepOnGpu(async (_input, spill) => {
      const x = new Float32Array(48), z = new Float32Array(48), delta = new Float32Array(48);
      x.set([1, 3.22625, 0, 3], 6 * 4);
      spill!({ x, z, delta });
      expect(transfer.receipt().releasedVolume).toBeGreaterThan(0);
      throw Error('device lost after face readback');
    })).rejects.toThrow('device lost');
    expect(transfer.saveState()).toEqual(before);expect(solver.h).toEqual(initial);expect(solver.steps).toBe(0);
  });
  it('keeps the public state and ledgers at the old epoch until valid output arrives', async () => {
    const solver = river();
    let accept!: (value: RiverGpuOutput) => void;
    const pending = solver.stepOnGpu(async () => new Promise(resolve => { accept = resolve; }));
    expect(solver.time).toBe(0); expect(solver.inVolume).toBe(0); expect(solver.volume()).toBe(6);
    expect(() => solver.step()).toThrow('must finish');
    await expect(solver.stepOnGpu(async () => { throw Error('must not run'); })).rejects.toThrow('already pending');
    const cells = new Float32Array(12 * 8);
    for (let c = 0; c < 12; c++) { cells[c * 8] = .5; cells[c * 8 + 3] = 3; }
    cells[5 * 8] += .02;
    accept({ cells, elapsedMs: 1 });
    expect(await pending).toBe(.01);
    expect(solver.steps).toBe(1); expect(solver.time).toBe(.01); expect(solver.inVolume).toBe(.02);
    expect(solver.volume()).toBeCloseTo(6.02, 6);
  });

  it.each(['device', 'length', 'nonfinite', 'negative'] as const)('rejects %s failure without a partial depth or ledger commit', async failure => {
    const solver = river(), initial = solver.saveState();
    await expect(solver.stepOnGpu(async () => {
      if (failure === 'device') throw Error('device lost');
      const cells = new Float32Array(failure === 'length' ? 1 : 12 * 8);
      for (let c = 0; c < 12 && cells.length > c * 8; c++) cells[c * 8] = .6;
      if (failure === 'nonfinite') cells[11 * 8] = NaN;
      if (failure === 'negative') cells[11 * 8] = -.1;
      return { cells, elapsedMs: 1 };
    })).rejects.toThrow();
    expect(solver.h).toEqual(initial.h); expect(solver.hu).toEqual(initial.hu); expect(solver.hv).toEqual(initial.hv);
    expect(solver.time).toBe(0); expect(solver.steps).toBe(0); expect(solver.inVolume).toBe(0); expect(solver.outVolume).toBe(0);
    expect(() => solver.step()).not.toThrow();
  });
});
