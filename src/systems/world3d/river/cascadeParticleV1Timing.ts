/** Optional instrumentation for one unchanged control step. Pass intervals omit
 * submission gaps and CPU waits, so their sum is not a total elapsed GPU frame. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 14:12:27
 * Dependents: systems/world3d/river/cascadeParticleV1.ts, systems/world3d/river/cascadeParticleV1Compute.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export class CascadeParticleTiming {
 readonly capacity=512;readonly query:GPUQuerySet|null;private resolve:GPUBuffer|null=null;private readback:GPUBuffer|null=null;
 scope='unspecified';private records:{label:string;begin:number;end:number}[]=[];
 readonly cpu:Record<string,number>={};readonly queued={divergence:0,density:0};
 constructor(private device:GPUDevice){this.query=device.features.has('timestamp-query')?device.createQuerySet({type:'timestamp',count:this.capacity}):null;if(this.query){this.resolve=device.createBuffer({size:this.capacity*8,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC});this.readback=device.createBuffer({size:this.capacity*8,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});}}
 pair(label:string):{querySet:GPUQuerySet;beginningOfPassWriteIndex?:number;endOfPassWriteIndex?:number}|undefined{if(!this.query)return undefined;if((this.records.length+1)*2>this.capacity)throw Error('Declared timestamp capacity exhausted');const begin=this.records.length*2;this.records.push({label,begin,end:begin+1});return{querySet:this.query,beginningOfPassWriteIndex:begin,endOfPassWriteIndex:begin+1};}
 /** Native encoder methods retain their receiver. Only timestamp descriptors are
  * added; command order, dispatch size and buffer bindings stay unchanged. */
 encoder(e:GPUCommandEncoder):GPUCommandEncoder{const self=this;return new Proxy(e,{get(target,key){if(key==='beginComputePass'||key==='beginRenderPass')return(descriptor:GPUComputePassDescriptor|GPURenderPassDescriptor={})=>{const stamp=descriptor.timestampWrites??(self.scope.startsWith('pressure.')?undefined:self.pair(self.scope));return (target[key] as (d:unknown)=>unknown).call(target,{...descriptor,...stamp?{timestampWrites:stamp}:{}});};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});}
 addCpu(label:string,milliseconds:number):void{this.cpu[label]=(this.cpu[label]??0)+milliseconds;}
 async finish(useful:{divergence:number;density:number}){const started=performance.now();let samples:{label:string;milliseconds:number;qualified:boolean}[]=[];if(this.query&&this.records.length){const count=this.records.length*2,e=this.device.createCommandEncoder();e.resolveQuerySet(this.query,0,count,this.resolve!,0);e.copyBufferToBuffer(this.resolve!,0,this.readback!,0,count*8);this.device.queue.submit([e.finish()]);await this.readback!.mapAsync(GPUMapMode.READ);const values=new BigUint64Array(this.readback!.getMappedRange().slice(0));samples=this.records.map(r=>({label:r.label,milliseconds:Number(values[r.end]-values[r.begin])/1e6,qualified:values[r.end]>=values[r.begin]&&values[r.begin]>0n}));this.readback!.unmap();}this.addCpu('timestamp resolve/map wall',performance.now()-started);const stages:Record<string,number>={};for(const s of samples){if(!s.qualified)continue;const match=/^pressure\.(divergence|density)\.iteration\.(\d+)$/.exec(s.label);const label=match?`${match[1]} ${Number(match[2])<=useful[match[1] as keyof typeof useful]?'useful':'post-convergence queued'} iterations`:s.label;stages[label]=(stages[label]??0)+s.milliseconds;}return{available:!!this.query,capacity:this.capacity,usedQueries:this.records.length*2,queuedIterations:{...this.queued},usefulIterations:useful,stages,samples,cpu:this.cpu,qualification:'Timestamp nanoseconds converted to ms; browser quantization/calibration unavailable. Iteration spans include their internal pass gaps. Disjoint sampled spans omit unmeasured gaps, CPU waits and presentation; backward or zero absolute timestamps are excluded; zero elapsed spans can reflect timer quantization and remain valid in aggregates. CPU spans overlap GPU work; do not add them to stage sums or call sums total GPU frame.'};}
 dispose():void{this.query?.destroy();this.resolve?.destroy();this.readback?.destroy();}
}
