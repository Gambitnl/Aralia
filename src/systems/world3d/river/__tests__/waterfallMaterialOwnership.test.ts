/** Checks the joint ownership handoff from pending Film releases to a staged
 * Reach epoch. The real owner APIs run against a fake GPU queue; no shader or
 * physical solve runs, and the manufactured receiver mesh is not a native inlet.
 * Publication is the final synchronous admission barrier. A coordinator must
 * roll back its outer Reach epoch when Flow rejects before calling the receiver.
 */
import {beforeAll,afterEach,describe,it,expect,vi} from 'vitest';
import {WaterfallContactFlow,type ContactSurface,type ContactSource,type ContactOriginalFilmRelease} from '../waterfallContactFlow';
import {WaterfallMaterialReachGpu} from '../waterfallMaterialReachCompute';
import type {ReachVec3} from '../waterfallMaterialReach';

const support:ContactSurface={id:'joint-ownership-ledge',vertices:[[-.5,2,-1],[.5,2,-1],[.5,2,1],[-.5,2,1]],normal:[0,1,0]};
const source:ContactSource={q:.02,width:.4,depth:.1,speed:.5,top:3,pool:0},off={...source,q:0};
function flow(){return new WaterfallContactFlow({startTime:0,dt:.01,parcelsPerStep:1,maxStepsPerAdvance:150,surfaces:[support],originalReleaseRouting:{ownerId:'joint-control',capacity:10000,select:r=>r.map(r=>r.id)}});}
let retained:ReturnType<WaterfallContactFlow['saveState']>;
beforeAll(()=>{const f=flow();f.advanceTo(1.2,t=>t<.025?source:off);retained=f.saveState();expect(f.pendingOriginalFilmReleases.length).toBeGreaterThan(2);});
afterEach(()=>vi.unstubAllGlobals());
function owners(){const f=flow();f.restoreState(structuredClone(retained));const batch=f.pendingOriginalFilmReleases.slice(0,2),volume=batch.reduce((s,r)=>s+r.outflow.volume,0);return {f,batch,volume};}

function reach(volume:number){
  vi.stubGlobal('GPUBufferUsage',{STORAGE:1,COPY_SRC:2,COPY_DST:4,VERTEX:8,INDEX:16,MAP_READ:32,UNIFORM:64});
  vi.stubGlobal('GPUShaderStage',{COMPUTE:1});vi.stubGlobal('GPUMapMode',{READ:1});
  type Copy={source:string;target:string};
  const copies:Copy[]=[],report=new Float32Array(32);
  const pass={setPipeline:()=>{},setBindGroup:()=>{},dispatchWorkgroups:()=>{},end:()=>{}};
  // Encoding alone does not publish or restore anything. Only submitted
  // command buffers count, so a missing queue submission fails these checks.
  const device={limits:{maxBufferSize:1e8,maxStorageBufferBindingSize:1e8},queue:{writeBuffer:()=>{},submit:(buffers:{copies:Copy[]}[])=>buffers.forEach(b=>copies.push(...b.copies))},
    createBuffer:({label}:{label:string})=>({label,destroy:()=>{},mapAsync:async()=>{},getMappedRange:()=>report.buffer,unmap:()=>{}}),
    createShaderModule:()=>({}),createBindGroupLayout:()=>({}),createPipelineLayout:()=>({}),createComputePipeline:()=>({}),createBindGroup:()=>({}),
    createCommandEncoder:()=>{const commands:Copy[]=[];return {copyBufferToBuffer:(a:{label:string},_offset:number,b:{label:string})=>commands.push({source:a.label,target:b.label}),beginComputePass:()=>pass,finish:()=>({copies:commands.slice()})};}};
  const triangle:ReachVec3[]=[[0,2,0],[1,2,0],[0,3,0]];
  // Only receiver ownership is modeled: its declared test mass equals the
  // selected source debit. This shape does not map original release geometry.
  const gpu=new WaterfallMaterialReachGpu(device as unknown as GPUDevice,{nodes:triangle.map(position=>({position,velocity:[0,0,0] as ReachVec3,mass:1000*volume/3})),faces:[{nodes:[0,1,2],volume}]},{nodeCapacity:3,faceCapacity:1,indexCapacity:24,maximumIterations:2,relativeMomentumResidual:1e-5,absoluteMomentumResidual:1e-6,maximumThicknessEdgeRatio:.1,minimumTriangleQuality:.01,stopBelowY:0,maximumIndependentVolumeError:.01,maximumNumericalEnergyLossFraction:.05});
  const publications=()=>copies.filter(c=>c.source==='material-reach:private trial optical surface'&&c.target==='material-reach:closed optical surface').length;
  const expectRollbackSubmission=()=>expect(copies.slice(-4)).toEqual([
    {source:'material-reach:ownership checkpoint',target:'material-reach:accepted material'},
    {source:'material-reach:optical epoch checkpoint',target:'material-reach:closed optical surface'},
    {source:'material-reach:index epoch checkpoint',target:'material-reach:closed optical indices'},
    {source:'material-reach:index epoch checkpoint',target:'material-reach:private trial optical indices'},
  ]);
  return {gpu,publications,expectRollbackSubmission};
}

describe('joint original Film and material Reach ownership',()=>{
  it('publishes a staged epoch and debits exact originals once at the final barrier',async()=>{
    const {f,batch,volume}=owners(),{gpu,publications}=reach(volume),pendingBefore=f.pendingOriginalFilmReleases,ownedBefore=f.totalOwnedVolume;
    gpu.beginEpoch('joint-success');await gpu.advance(.01);expect(gpu.indexCount).toBe(0);expect(publications()).toBe(0);
    const admit=vi.fn((records:readonly ContactOriginalFilmRelease[])=>{expect(records).toEqual(batch);expect(f.pendingOriginalFilmReleases).toEqual(pendingBefore);gpu.commitEpoch('joint-success');});
    const restore=vi.fn(()=>gpu.rollbackEpoch('joint-success'));
    f.acknowledgeOriginalFilmReleases(batch,{checkpoint:()=>null,admit,restore});
    expect(admit).toHaveBeenCalledTimes(1);expect(restore).not.toHaveBeenCalled();expect(publications()).toBe(1);expect(gpu.indexCount).toBe(24);
    expect(f.pendingOriginalFilmReleases).toEqual(pendingBefore.slice(2));expect(f.totalOwnedVolume).toBeCloseTo(ownedBefore-volume,14);
    const ledger=f.snapshot().receipt.originalReleaseOwnership!;expect(ledger.exportedVolume).toBeCloseTo(volume,14);expect(ledger.acknowledgedCount).toBe(2);expect(f.snapshot().receipt.budgetError).toBeCloseTo(0,12);
    expect(()=>f.acknowledgeOriginalFilmReleases(batch,{checkpoint:()=>null,admit,restore})).toThrow('Missing or altered');expect(admit).toHaveBeenCalledTimes(1);expect(publications()).toBe(1);
  });
  it('rolls back the outer Reach epoch when Flow preflight rejects before receiver entry',async()=>{
    const {f,batch,volume}=owners(),{gpu,publications,expectRollbackSubmission}=reach(volume),good=f.saveState(),overflow=structuredClone(good),reachBefore=gpu.boundaryState();
    overflow.originalReleaseOwnership!.acknowledgedCount=Number.MAX_SAFE_INTEGER;f.restoreState(overflow);
    gpu.beginEpoch('preflight');await gpu.advance(.01);const checkpoint=vi.fn(()=>null),admit=vi.fn(()=>gpu.commitEpoch('preflight')),restore=vi.fn(()=>gpu.rollbackEpoch('preflight'));
    expect(()=>{try{f.acknowledgeOriginalFilmReleases(batch,{checkpoint,admit,restore});}catch(error){gpu.rollbackEpoch('preflight');throw error;}}).toThrow('finite capacity');
    expect(checkpoint).not.toHaveBeenCalled();expect(admit).not.toHaveBeenCalled();expect(restore).not.toHaveBeenCalled();expect(publications()).toBe(0);expect(gpu.indexCount).toBe(0);expect(f.pendingOriginalFilmReleases).toEqual(good.originalReleaseOwnership!.pending);
    expect(gpu.boundaryState()).toEqual(reachBefore);expectRollbackSubmission();
    f.restoreState(good);gpu.beginEpoch('retry');await gpu.advance(.01);f.acknowledgeOriginalFilmReleases(batch,{checkpoint:()=>null,admit:()=>gpu.commitEpoch('retry'),restore:()=>gpu.rollbackEpoch('retry')});expect(publications()).toBe(1);expect(f.snapshot().receipt.originalReleaseOwnership!.acknowledgedCount).toBe(2);
  });
  it('retains exact originals when Reach refuses an unaccepted epoch commit',()=>{
    const {f,batch,volume}=owners(),{gpu,publications,expectRollbackSubmission}=reach(volume),before=f.snapshot().receipt,pending=f.pendingOriginalFilmReleases,reachBefore=gpu.boundaryState();
    gpu.beginEpoch('unaccepted');const restore=vi.fn(()=>gpu.rollbackEpoch('unaccepted'));
    expect(()=>f.acknowledgeOriginalFilmReleases(batch,{checkpoint:()=>null,admit:()=>gpu.commitEpoch('unaccepted'),restore})).toThrow('unaccepted');
    expect(restore).toHaveBeenCalledTimes(1);expect(gpu.indexCount).toBe(0);expect(publications()).toBe(0);expect(f.pendingOriginalFilmReleases).toEqual(pending);expect(f.snapshot().receipt).toEqual(before);
    expect(gpu.boundaryState()).toEqual(reachBefore);expectRollbackSubmission();
    gpu.beginEpoch('after-reject');gpu.rollbackEpoch('after-reject');
  });
  it('restores both owners when actual admission throws before its final publication barrier',async()=>{
    const {f,batch,volume}=owners(),{gpu,publications,expectRollbackSubmission}=reach(volume),before=f.snapshot().receipt,pending=f.pendingOriginalFilmReleases,reachBefore=gpu.boundaryState();
    gpu.beginEpoch('throw');await gpu.advance(.01);const restore=vi.fn(()=>gpu.rollbackEpoch('throw'));
    expect(()=>f.acknowledgeOriginalFilmReleases(batch,{checkpoint:()=>null,admit:records=>{records[0].outflow.volume=999;throw Error('cross-owner admit rejected');},restore})).toThrow('cross-owner admit rejected');
    expect(restore).toHaveBeenCalledTimes(1);expect(gpu.indexCount).toBe(0);expect(publications()).toBe(0);expect(f.pendingOriginalFilmReleases).toEqual(pending);expect(f.snapshot().receipt).toEqual(before);
    expect(gpu.boundaryState()).toEqual(reachBefore);expectRollbackSubmission();
    gpu.beginEpoch('after-throw');await gpu.advance(.01);f.acknowledgeOriginalFilmReleases(batch,{checkpoint:()=>null,admit:()=>gpu.commitEpoch('after-throw'),restore:()=>gpu.rollbackEpoch('after-throw')});expect(publications()).toBe(1);
    const remaining=f.pendingOriginalFilmReleases;f.advanceTo(1.21,()=>off);expect(f.pendingOriginalFilmReleases.slice(0,remaining.length)).toEqual(remaining);
    const emitted=f.snapshot().receipt.emittedVolume;f.advanceTo(1.24,()=>source);expect(f.snapshot().receipt.emittedVolume).toBeGreaterThan(emitted);expect(f.pendingOriginalFilmReleases.slice(0,remaining.length)).toEqual(remaining);expect(f.snapshot().receipt.originalReleaseOwnership!.acknowledgedCount).toBe(2);expect(f.snapshot().receipt.budgetError).toBeCloseTo(0,12);
  });
});
