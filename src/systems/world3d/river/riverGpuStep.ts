/** Runs the native river's shallow-water stages on the scene's existing device.
 * CPU snapshots remain available for editing, floaters and the existing flow
 * mapper. Airborne spill ownership can inspect face fluxes between stages;
 * no second renderer or independently simulated copy of water is created.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 21/10/2026, 13:13:41
 * Dependents: components/World3D/water/riverLiveClient.ts, systems/world3d/river/riverGpuResident.ts, systems/world3d/river/riverLive.ts, systems/world3d/river/riverSolver.ts, systems/world3d/river/riverWorker.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { assertRiverGpuBufferSizes, riverGpuDispatch } from './riverGpuLimits';

import { RIVER_GPU_SHADER } from './riverGpuKernel';
export interface RiverGpuInput {
 nx:number; nz:number; dx:number; dt:number; outEdge:number;
 /** Packed depth, x/z discharge and bed relative to a fixed vertical datum. */
 state:Float32Array; topology:Uint32Array; source:Float32Array;
 /** Native awake cells, including their dry receiving margin, in commit order. */
 activeCells?:Uint32Array;
 /** Host frontier/packing elapsed time, measured before posting the request. */
 prepareMs?:number;
}
export interface RiverGpuFaces { x:Float32Array; z:Float32Array; delta:Float32Array }
export interface RiverGpuProfile {
 activeCells:number; gridCells:number; prepareMs:number|null;
 setupMs:number; spillOwnerMs:number;
 uploadEncodeMs:number; mapWaitMs:number; copyValidateMs:number; elapsedMs:number;
 /** Sum of the two compute pass spans, excluding copies and queue waits. */
 devicePassMs:number|null;
 /** First-pass start to last-pass end; spill mode also includes its host gap. */
 deviceSpanMs:number|null;
 timestampsNs?:string[];
 timestampStatus:'available'|'unsupported'|'invalid'|'zero-duration';
}
export interface RiverGpuOutput { cells:Float32Array; elapsedMs:number; compact?:boolean; profile?:RiverGpuProfile }
export type RiverGpuFaceHandler=(faces:RiverGpuFaces)=>void|Promise<void>;
export type RiverGpuExecutor=(input:RiverGpuInput,spill?:RiverGpuFaceHandler)=>Promise<RiverGpuOutput>;

export class RiverGpuStep {
 private buffers:GPUBuffer[]=[];
 private size=0;
 private activeSize=0;
 private group:GPUBindGroup|null=null;
 private pending=false;
 private profiling=false;
 private clock:{queries:GPUQuerySet;resolve:GPUBuffer;read:GPUBuffer}|null=null;
 /** Bounded diagnostics only; no water arrays or frame history are retained. */
 readonly profiles:RiverGpuProfile[]=[];
 setProfiling(enabled:boolean):void{
  if(this.pending)throw Error('Wait for the river step before changing profiling');
  this.profiling=enabled;this.profiles.length=0;
 }
 private timingResources():typeof this.clock{
  if(!this.device.features.has('timestamp-query'))return null;
  return this.clock??={queries:this.device.createQuerySet({type:'timestamp',count:4}),
   resolve:this.device.createBuffer({size:32,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),
   read:this.device.createBuffer({size:32,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ})};
 }
 private constructor(private readonly device:GPUDevice,private readonly pipelines:GPUComputePipeline[]){}
 static async create(device:GPUDevice):Promise<RiverGpuStep>{
  const module=device.createShaderModule({code:RIVER_GPU_SHADER});
  const diagnostics=await module.getCompilationInfo();
  const errors=diagnostics.messages.filter(m=>m.type==='error');
  if(errors.length)throw Error(errors.map(m=>`${m.lineNum}: ${m.message}`).join('\n'));
  const layout=device.createBindGroupLayout({entries:Array.from({length:9},(_,binding)=>({binding,visibility:GPUShaderStage.COMPUTE,buffer:{type:binding===0?'uniform' as const:binding<=3||binding===8?'read-only-storage' as const:'storage' as const}}))});
  const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
  const pipelines=await Promise.all(['faces','gather','advance'].map(entryPoint=>device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint}})));
  return new RiverGpuStep(device,pipelines);
 }
 private allocate(n:number,activeCount:number):void{
  if(this.size===n&&this.activeSize>=activeCount)return;
  const capacity=Math.ceil(activeCount/4096)*4096;

  const storage=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;
  const sizes=[32,n*16,n*4,n*16,n*16,n*16,n*16,capacity*32,n*48,capacity*32,capacity*4];
  assertRiverGpuBufferSizes(this.device.limits,sizes,[1,2,3,4,5,6,7,10]);
  for(const buffer of this.buffers)buffer.destroy();
  this.buffers=sizes.map((size,i)=>this.device.createBuffer({size:Math.max(4,size),usage:i===0?GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST:i<8||i===10?storage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}));
  this.group=this.device.createBindGroup({layout:this.pipelines[0].getBindGroupLayout(0),entries:[...this.buffers.slice(0,8).map((buffer,binding)=>({binding,resource:{buffer}})),{binding:8,resource:{buffer:this.buffers[10]}}]});this.size=n;this.activeSize=capacity;
 }
 /** Serialized acceptance keeps terrain edits from racing a half-finished step. */
 async step(input:RiverGpuInput,spill?:RiverGpuFaceHandler):Promise<RiverGpuOutput>{
  if(this.pending)throw Error('A river GPU step is already pending');this.pending=true;
  try{
   const n=input.nx*input.nz;
   if(input.state.length!==n*4||input.topology.length!==n||input.source.length!==n*4)throw Error('River GPU snapshot has mismatched dimensions');
   const active=input.activeCells??Uint32Array.from({length:n},(_,c)=>c),count=active.length;
   if(!count)return{cells:new Float32Array(0),elapsedMs:0,compact:!!input.activeCells};
   const setupStart=performance.now();this.allocate(n,count);const b=this.buffers;const clock=this.profiling?this.timingResources():null;const start=performance.now();const setupMs=start-setupStart;
   const params=new ArrayBuffer(32);new Uint32Array(params).set([input.nx,input.nz,n,input.outEdge]);new Float32Array(params).set([input.dx,input.dt,1e-4,0],4);
   new Uint32Array(params)[7]=count;
   this.device.queue.writeBuffer(b[0],0,params);
   this.device.queue.writeBuffer(b[1],0,input.state as Float32Array<ArrayBuffer>);
   this.device.queue.writeBuffer(b[2],0,input.topology as Uint32Array<ArrayBuffer>);
   this.device.queue.writeBuffer(b[3],0,input.source as Float32Array<ArrayBuffer>);
   this.device.queue.writeBuffer(b[10],0,active as Uint32Array<ArrayBuffer>);
   // Own timestamps belong only to these passes. Do not wrap the device or
   // borrow the renderer's query pool; its FPS meter keeps its own ownership.
   const dispatch=(encoder:GPUCommandEncoder,stages:number[])=>{const first=stages[0]===0?0:2;const pass=encoder.beginComputePass(clock?{timestampWrites:{querySet:clock.queries,beginningOfPassWriteIndex:first,endOfPassWriteIndex:first+1}}:{});pass.setBindGroup(0,this.group!);for(const stage of stages){pass.setPipeline(this.pipelines[stage]);pass.dispatchWorkgroups(...riverGpuDispatch(Math.ceil(count/64)));}pass.end();};
   let mapWaitMs=0,copyValidateMs=0,hostSpillMs=0;
   let encoder=this.device.createCommandEncoder();dispatch(encoder,[0,1]);
   if(spill){
    // Preserve the existing CPU airborne law's exact position in the step:
    // remove launched receiving flux before wet-depth/friction advancement.
    encoder.copyBufferToBuffer(b[4],0,b[8],0,n*16);encoder.copyBufferToBuffer(b[5],0,b[8],n*16,n*16);encoder.copyBufferToBuffer(b[6],0,b[8],n*32,n*16);
    this.device.queue.submit([encoder.finish()]);let phaseStart=performance.now();await b[8].mapAsync(GPUMapMode.READ);mapWaitMs+=performance.now()-phaseStart;phaseStart=performance.now();
    const snapshot=new Float32Array(b[8].getMappedRange().slice(0));b[8].unmap();
    const faces={x:snapshot.subarray(0,n*4),z:snapshot.subarray(n*4,n*8),delta:snapshot.subarray(n*8)};copyValidateMs+=performance.now()-phaseStart;phaseStart=performance.now();await spill(faces);hostSpillMs=performance.now()-phaseStart;
    this.device.queue.writeBuffer(b[6],0,faces.delta);encoder=this.device.createCommandEncoder();
   }
   dispatch(encoder,[2]);encoder.copyBufferToBuffer(b[7],0,b[9],0,count*32);
   if(clock){encoder.resolveQuerySet(clock.queries,0,4,clock.resolve,0);encoder.copyBufferToBuffer(clock.resolve,0,clock.read,0,32);}
   this.device.queue.submit([encoder.finish()]);let phaseStart=performance.now();
   await Promise.all([b[9].mapAsync(GPUMapMode.READ),...(clock?[clock.read.mapAsync(GPUMapMode.READ)]:[])]);mapWaitMs+=performance.now()-phaseStart;phaseStart=performance.now();
   const cells=new Float32Array(b[9].getMappedRange().slice(0,count*32));b[9].unmap();
   if(!cells.every(Number.isFinite))throw Error('River GPU step produced a nonfinite state');
   copyValidateMs+=performance.now()-phaseStart;
   const elapsedMs=performance.now()-start;
   let profile:RiverGpuProfile|undefined;
   if(this.profiling){
    let devicePassMs:number|null=null,deviceSpanMs:number|null=null,timestampsNs:string[]|undefined;
    let timestampStatus:RiverGpuProfile['timestampStatus']='unsupported';
    if(clock){const q=new BigUint64Array(clock.read.getMappedRange());timestampsNs=Array.from(q,String);timestampStatus='invalid';
     if(q[0]>0n&&q[1]>=q[0]&&q[2]>=q[1]&&q[3]>=q[2]){const span=q[1]-q[0]+q[3]-q[2];timestampStatus=span>0n?'available':'zero-duration';if(span>0n){devicePassMs=Number(span)/1e6;deviceSpanMs=Number(q[3]-q[0])/1e6;}}clock.read.unmap();}
    profile={activeCells:count,gridCells:n,prepareMs:input.prepareMs??null,setupMs,spillOwnerMs:hostSpillMs,uploadEncodeMs:Math.max(0,elapsedMs-mapWaitMs-copyValidateMs-hostSpillMs),mapWaitMs,copyValidateMs,elapsedMs,devicePassMs,deviceSpanMs,timestampStatus,...(timestampsNs?{timestampsNs}:{})};
    this.profiles.push(profile);if(this.profiles.length>64)this.profiles.shift();
   }
   return{cells,elapsedMs,compact:!!input.activeCells,...(profile?{profile}:{})};
  }finally{if(this.clock?.read.mapState==='mapped')this.clock.read.unmap();this.pending=false;}
 }
 dispose():void{for(const buffer of this.buffers)buffer.destroy();this.clock?.queries.destroy();this.clock?.resolve.destroy();this.clock?.read.destroy();this.clock=null;this.buffers=[];this.size=0;this.activeSize=0;this.group=null;}
}
