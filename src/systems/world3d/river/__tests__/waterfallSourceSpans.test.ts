/** Small source ownership proofs; separated admission changes actual intervals,
 * not the numerical model or native waterfall realism acceptance. */
import { describe, expect, it, vi } from 'vitest';
import { WaterfallContactFlow, type ContactSourceSpan } from '../waterfallContactFlow';
import { TERRAIN_COMPARISON_CASES } from '../waterfallTerrainProfiles';
import { GENERIC_TERRAIN_COMPARISON_CASES, TERRAIN_COMPARISON_DT, TERRAIN_COMPARISON_SOURCE } from '../waterfallTerrainComparisons';
const source={...TERRAIN_COMPARISON_SOURCE};
const terrain=()=>GENERIC_TERRAIN_COMPARISON_CASES[0].buildSurfaces();
const make=(spans?:readonly ContactSourceSpan[],n=6)=>new WaterfallContactFlow({startTime:0,dt:TERRAIN_COMPARISON_DT,parcelsPerStep:n,surfaces:terrain(),...(spans?{sourceSpans:spans}:{})});
describe('fixed terrain separated source intervals',()=>{
  it.each(['seven-sisters','latefossen','tvindefossen','stigfossen'])('admits %s intervals with equal total supply and preserves source-off ownership',id=>{
    const spans=TERRAIN_COMPARISON_CASES.find(c=>c.id===id)!.streamSpans!;
    const flow=make(spans,Math.max(6,spans.length));flow.advanceTo(TERRAIN_COMPARISON_DT,()=>source);
    const first=flow.snapshot();expect(flow.failureReason).toBeNull();expect(first.parcels).toHaveLength(Math.max(6,spans.length));
    expect(first.receipt.emittedVolume).toBeCloseTo(source.q*TERRAIN_COMPARISON_DT,15);
    for(const p of first.parcels){const release=p.sourceRelease!;expect(spans.some(s=>release.start[2]>=s.z0&&release.end[2]<=s.z1)).toBe(true);expect(p.volume).toBeGreaterThan(0);}
    const widths=first.parcels.reduce((sum,p)=>sum+p.sourceRelease!.end[2]-p.sourceRelease!.start[2],0);expect(widths).toBeCloseTo(10,12);
    flow.advanceTo(2*TERRAIN_COMPARISON_DT,()=>({...source,q:0}));expect(flow.snapshot().receipt.emittedVolume).toBe(first.receipt.emittedVolume);
    expect(flow.snapshot().parcels[0].position).not.toEqual(first.parcels[0].position);
  });
  it('copies configured spans and rejects mismatched public checkpoints before mutation',()=>{
    const spans=[{z0:-8,z1:-3},{z0:3,z1:8}],flow=make(spans);spans[0].z0=-99;
    flow.advanceTo(TERRAIN_COMPARISON_DT,()=>source);const before=flow.saveState(),token=flow.saveTransactionState();
    expect(before.sourceSpans![0].z0).toBe(-8);
    const wrong=structuredClone(before);wrong.sourceSpans=[{z0:-5,z1:0},{z0:0,z1:5}];wrong.snapshot.parcels[0].volume=999;
    expect(()=>flow.restoreState(wrong)).toThrow('source spans mismatch');expect(flow.saveState()).toEqual(before);
    const contiguous=make();const old=contiguous.saveState();expect(()=>contiguous.restoreState(before)).toThrow('source spans mismatch');expect(contiguous.saveState()).toEqual(old);
    flow.advanceTo(2*TERRAIN_COMPARISON_DT,()=>source);flow.restoreTransactionState(token);expect(flow.saveState()).toEqual(before);
    const copy=structuredClone(before);flow.restoreState(copy);(copy.sourceSpans as {z0:number;z1:number}[])[0].z0=999;expect(flow.saveState()).toEqual(before);
  });
  it('rejects invalid intervals and wet-width changes before admitting water',()=>{
    for(const spans of [[],[{z0:0,z1:0}],[{z0:NaN,z1:1}],[{z0:0,z1:6},{z0:5,z1:9}],[{z0:3,z1:8},{z0:-8,z1:-3}]])expect(()=>make(spans)).toThrow('invalid-fixed-terrain-source-spans');
    expect(()=>make([{z0:-8,z1:-3},{z0:3,z1:8}],1)).toThrow('invalid-fixed-terrain-source-spans');
    expect(()=>new WaterfallContactFlow({startTime:0,sourceSpans:[{z0:-5,z1:5}]})).toThrow('invalid-fixed-terrain-source-spans');
    expect(()=>new WaterfallContactFlow({startTime:0,impactMode:'junction',surfaces:terrain(),sourceSpans:[{z0:-5,z1:5}]})).toThrow('invalid-fixed-terrain-source-spans');
    const f=make([{z0:-8,z1:-3},{z0:3,z1:8}]);f.advanceTo(TERRAIN_COMPARISON_DT,()=>({...source,width:11}));expect(f.failureReason).toBe('source-spans-wet-width-mismatch');expect(f.time).toBe(0);expect(f.totalOwnedVolume).toBe(0);
    const tiny=make([{z0:-1,z1:0},{z0:1e-320,z1:2e-320}],2);tiny.advanceTo(TERRAIN_COMPARISON_DT,()=>({...source,width:1}));expect(tiny.failureReason).toBe('unsupported-source-span-admission');expect(tiny.totalOwnedVolume).toBe(0);
    const span={z0:1e308,z1:1e308+4e292},large=make([span],1);large.advanceTo(TERRAIN_COMPARISON_DT,()=>({...source,width:span.z1-span.z0}));expect(large.failureReason).toBeNull();expect(Number.isFinite(large.snapshot().parcels[0].position[2])).toBe(true);
  });
  it('retains the legacy contiguous source arithmetic and checkpoint shape',()=>{
    const a=make(),b=make();a.advanceTo(TERRAIN_COMPARISON_DT,()=>source);b.advanceTo(TERRAIN_COMPARISON_DT,()=>source);
    const x=a.saveState(),y=b.saveState();x.snapshot.receipt.lastAdvanceMilliseconds=0;y.snapshot.receipt.lastAdvanceMilliseconds=0;expect(x).toEqual(y);expect('sourceSpans' in x).toBe(false);
    expect(x.snapshot.parcels.map(p=>p.volume)).toEqual(Array(6).fill(source.q*TERRAIN_COMPARISON_DT/6));
    const f=make([{z0:-8,z1:-3},{z0:3,z1:8}]);f.advanceTo(TERRAIN_COMPARISON_DT,()=>source);const before=f.saveState();
    const spy=vi.spyOn(f as unknown as {move(...args:unknown[]):void},'move').mockImplementation(()=>{throw Error('injected-after-source-admission');});
    f.advanceTo(2*TERRAIN_COMPARISON_DT,()=>source);spy.mockRestore();const after=f.saveState();after.snapshot.receipt.failure=before.snapshot.receipt.failure;after.snapshot.receipt.lastAdvanceSteps=before.snapshot.receipt.lastAdvanceSteps;after.snapshot.receipt.lastAdvanceMilliseconds=before.snapshot.receipt.lastAdvanceMilliseconds;after.targetTime=before.targetTime;
    after.snapshot.receipt.lagSeconds=before.snapshot.receipt.lagSeconds;expect(after).toEqual(before);
  });
});
