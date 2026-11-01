/**
 * GPU reference for shallow water spreading on one physical rock plane.
 * The caller supplies Aralia's existing renderer device. This owns only its
 * small study buffers, never another device, renderer, source or water body.
 *
 * Each particle solves its own gather-density equation. A separate dispatch
 * then reads all converged densities for pressure and LF acceleration. This
 * bounded implementation sorts particle coordinates on the longest axis once
 * per evaluation, then queries each changing support radius. It retains the
 * strict 640-particle ceiling without a capped neighbor list. Time integration and live
 * source/terrain ownership are deliberately outside this equation evaluator.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/10/2026, 00:40:13
 * Dependents: systems/world3d/river/waterfallSphReceiverGpuCheck.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { SphReceiverForces, SphReceiverParticle, SphReceiverPlane } from './waterfallSphReceiver';
import {sphDeviceDensityWGSL} from './waterfallSphDeviceDensity';
import {auditSphDensity} from './waterfallSphDensityAudit';

const CAPACITY = 640;
export const sphReceiverWGSL = /* wgsl */ `
struct Params { count:u32, method:u32, traceIndex:u32, pad2:u32, gn:f32, gt:f32, rho0:f32, maxSupport:f32 }
struct Particle { state:vec4<f32>, properties:vec4<f32> }
@group(0) @binding(0) var<uniform> p:Params;
@group(0) @binding(1) var<storage,read> particles:array<Particle>;
@group(0) @binding(2) var<storage,read_write> density:array<vec4<f32>>;
@group(0) @binding(3) var<storage,read_write> health:array<vec4<f32>>;
@group(0) @binding(4) var<storage,read_write> acceleration:array<vec4<f32>>;
@group(0) @binding(5) var<storage,read_write> boundary:array<vec4<f32>>;
@group(0) @binding(6) var<storage,read_write> internalLF:array<vec4<f32>>;
@group(0) @binding(7) var<storage,read_write> iterationTrace:array<vec4<f32>>;
@group(0) @binding(8) var<storage,read_write> spatialOrder:array<vec2<u32>>;
var<workgroup> largestSupport:atomic<u32>;

// A bounded rank sort is rebuilt from the current positions on the device.
// Ties use original particle indices, so every slot has exactly one writer.
// Sorting costs one pair scan; the many density iterations reuse its result.
fn coordinate(i:u32)->f32 { return particles[i].state[p.pad2]; }
@compute @workgroup_size(64)
fn orderParticles(@builtin(global_invocation_id) gid:vec3<u32>) {
 let i=gid.x;if(i>=p.count){return;}
 let x=coordinate(i);var rank=0u;
 for(var j=0u;j<p.count;j++){
  let y=coordinate(j);if(y<x || (y==x && j<i)){rank++;}
 }
 spatialOrder[rank]=vec2<u32>(bitcast<u32>(x),i);
}
fn lowerCoordinate(x:f32)->u32 {
 var lo=0u;var hi=p.count;
 while(lo<hi){let mid=lo+(hi-lo)/2u;
  if(bitcast<f32>(spatialOrder[mid].x)<x){lo=mid+1u;}else{hi=mid;}
 }
 return lo;
}
fn nearby(i:u32,radius:f32)->vec2<u32> {
 let x=coordinate(i);
 // Broad-phase padding only admits extra candidates. The radial kernel below
 // still decides physical support; rounded interval endpoints never trim it.
 let padding=0.000001*(abs(x)+radius+1.0);
 return vec2<u32>(lowerCoordinate(x-radius-padding),lowerCoordinate(x+radius+padding));
}
const sigma:f32 = 0.4547284088339867;
fn weight(r:f32,h:f32)->f32 {
 let q=r/h;
 if(q>=2.0){return 0.0;}
 if(q<1.0){return sigma*(1.0-1.5*q*q+0.75*q*q*q)/(h*h);}
 let a=2.0-q;return sigma*0.25*a*a*a/(h*h);
}
fn radial(r:f32,h:f32)->f32 {
 let q=r/h;
 if(q>=2.0){return 0.0;}
 if(q<1.0){return sigma*(-3.0*q+2.25*q*q)/(h*h*h);}
 let a=2.0-q;return -sigma*0.75*a*a/(h*h*h);
}
fn positive(v:f32)->bool {return v>0.0 && v<3.402823e38;}
fn shape(q:f32)->f32 {
 if(q>=2.0){return 0.0;}
 if(q<1.0){return 1.0-1.5*q*q+0.75*q*q*q;}
 let a=2.0-q;return 0.25*a*a*a;
}
fn supportSum(i:u32,h:f32)->f32 {
 var sum=0.0;var correction=0.0;
 let range=nearby(i,2.0*h);
 for(var k=range.x;k<range.y;k++) {
  let j=spatialOrder[k].y;
  let b=particles[j];let q=length(particles[i].state.xy-b.state.xy)/h;
  let term=b.properties.x*sigma*shape(q)-correction;
  let next=sum+term;correction=(next-sum)-term;sum=next;
 }
 return sum;
}

// Report every term at a supplied support radius. This diagnostic does not
// advance water; it separates distance, division, polynomial and target error.
@compute @workgroup_size(64)
fn probeSupport(@builtin(global_invocation_id) gid:vec3<u32>) {
 let j=gid.x;if(j>=p.count){return;}
 let a=particles[p.traceIndex];let b=particles[j];let h=bitcast<f32>(p.pad2);
 let r=length(a.state.xy-b.state.xy);let q=r/h;let s=shape(q);
 density[j]=vec4<f32>(r,q,s,b.properties.x*sigma*s);
 if(j==0u){
  // Preserve the dense arithmetic probe independently of spatial ordering.
  var sum=0.0;var correction=0.0;
  for(var k=0u;k<p.count;k++){
   let term=particles[k].properties.x*sigma*shape(length(a.state.xy-particles[k].state.xy)/h)-correction;
   let next=sum+term;correction=(next-sum)-term;sum=next;
  }
  health[0]=vec4<f32>(p.rho0*a.properties.z*a.properties.z,sum,sigma,h);
 }
}

@compute @workgroup_size(64)
fn solveDensity(@builtin(global_invocation_id) gid:vec3<u32>) {
 let i=gid.x;if(i>=p.count){return;}
 let a=particles[i];
 density[i]=vec4<f32>(0.0);health[i]=vec4<f32>(0.0);
 if(a.properties.w==0.0){density[i]=vec4<f32>(p.rho0,a.properties.z,2.0*p.rho0,0.0);return;}
 var rho=a.properties.y;var h=a.properties.z;var residual=1.0;var it=0u;var done=false;
 if(p.method==1u) {
  // Multiplying the gather equation by h² gives a monotone support equation.
  // Bracketing changes the iteration, not the water equations or tolerance.
  // Its Float32 endpoints are numerical observations, not certified bounds.
  let requiredSupport=p.rho0*a.properties.z*a.properties.z;
  var lower=0.0;var upper=0.5*p.maxSupport;var coincident=0.0;var total=0.0;
  for(var j=0u;j<p.count;j++) {
   let b=particles[j];total+=b.properties.x*sigma;
   if(all(a.state.xy==b.state.xy)){coincident+=b.properties.x*sigma;}
  }
  if(requiredSupport<=coincident || requiredSupport>=total){health[i]=vec4<f32>(0.0,6.0,upper*2.0,1.0);return;}
  if(supportSum(i,upper)<requiredSupport){health[i]=vec4<f32>(0.0,1.0,upper*2.0,1.0);return;}
  for(var iteration=0u;iteration<64u;iteration++) {
   it=iteration+1u;h=lower+(upper-lower)*0.5;
   if(h==lower || h==upper){break;}
   let sum=supportSum(i,h);residual=abs(sum-requiredSupport)/requiredSupport;
   if(i==p.traceIndex){iterationTrace[iteration%8u]=vec4<f32>(h,sum,lower,upper);}
   if(residual<=1e-7){done=true;break;}
   if(sum<requiredSupport){lower=h;}else{upper=h;}
  }
  if(!done){health[i]=vec4<f32>(f32(it),5.0,2.0*h,residual);return;}
  rho=requiredSupport/(h*h);
 }else{
 for(var iteration=0u;iteration<100u;iteration++) {
  it=iteration+1u;h=a.properties.z*sqrt(p.rho0/rho);
  if(!positive(h) || 2.0*h>p.maxSupport){health[i]=vec4<f32>(f32(it),1.0,2.0*h,residual);return;}
  // Compensated summation reduces accumulation error without relaxing the
  // native reference's relative density tolerance or clamping its support.
  var sum=0.0;var correction=0.0;
  let range=nearby(i,2.0*h);
  for(var k=range.x;k<range.y;k++){
   let j=spatialOrder[k].y;
   let b=particles[j];let term=b.properties.x*weight(length(a.state.xy-b.state.xy),h)-correction;
   let next=sum+term;correction=(next-sum)-term;sum=next;
  }
  // Subtract before dividing: WGSL division may err by 2.5 ULP even near
  // one. Dividing first can therefore reject an exactly stationary iterate.
  // This is the same relative residual and retains the original 1e-7 guard.
  residual=abs(sum-rho)/rho;
  if(i==p.traceIndex){iterationTrace[iteration%8u]=vec4<f32>(rho,sum,h,residual);}
  if(residual<=1e-7){done=true;break;}
  if(!positive(sum)){health[i]=vec4<f32>(f32(it),2.0,2.0*h,residual);return;}
  rho=sum;
 }
 if(!done){health[i]=vec4<f32>(f32(it),3.0,2.0*h,residual);return;}
 }
 var alpha=0.0;var correction=0.0;
 let range=nearby(i,2.0*h);
 for(var k=range.x;k<range.y;k++){
  let j=spatialOrder[k].y;
  let b=particles[j];let r=length(a.state.xy-b.state.xy);
  let term=-b.properties.x*r*radial(r,h)-correction;let next=alpha+term;correction=(next-alpha)-term;alpha=next;
 }
 if(!positive(alpha)){health[i]=vec4<f32>(f32(it),4.0,2.0*h,residual);return;}
 density[i]=vec4<f32>(rho,h,alpha,residual);health[i]=vec4<f32>(f32(it),0.0,2.0*h,residual);
}

@compute @workgroup_size(64)
fn forces(@builtin(global_invocation_id) gid:vec3<u32>,@builtin(local_invocation_index) lane:u32) {
 // Pressure uses both particles' support radii. Reduce the actual largest
 // radius once per workgroup, including buffers, before excluding any pair.
 // All lanes reach both barriers, including lanes beyond the particle count.
 if(lane==0u){atomicStore(&largestSupport,0u);}workgroupBarrier();
 var localMaximum=0.0;
 for(var j=lane;j<p.count;j+=64u){localMaximum=max(localMaximum,density[j].y);}
 atomicMax(&largestSupport,bitcast<u32>(localMaximum));workgroupBarrier();
 let i=gid.x;if(i>=p.count){return;}
 acceleration[i]=vec4<f32>(0.0);boundary[i]=vec4<f32>(0.0);internalLF[i]=vec4<f32>(0.0);
 let a=particles[i];if(a.properties.w==0.0 || health[i].y!=0.0){return;}
 let da=density[i];let ci=p.gn/1000.0*da.x/da.z;
 let wave=sqrt(p.gn*da.x/1000.0);
 var acc=vec2<f32>(p.gt,0.0);var bf=vec2<f32>(0.0);var bp=0.0;var storagePower=0.0;
 var lfForce=vec2<f32>(0.0);var lfPower=0.0;var pairs=0.0;
 let range=nearby(i,2.0*bitcast<f32>(atomicLoad(&largestSupport)));
 for(var k=range.x;k<range.y;k++){
  let j=spatialOrder[k].y;
  let b=particles[j];let db=density[j];let delta=a.state.xy-b.state.xy;let r=length(delta);
  if(r==0.0 || health[j].y!=0.0 || (r>=2.0*da.y && r>=2.0*db.y)){continue;}
  pairs+=1.0;
  let di=radial(r,da.y);let dj=radial(r,db.y);
  let approach=dot(a.state.zw-b.state.zw,delta);var visc=0.0;
  if(approach<0.0){visc=-(wave+sqrt(p.gn*db.x/1000.0))/(da.x+db.x)*approach/sqrt(r*r+0.01*da.y*da.y);}
  let pressure=-b.properties.x*(ci*di+p.gn/1000.0*db.x/db.z*dj)/r;
  let lf=-b.properties.x*0.5*visc*(di+dj)/r;let pair=(pressure+lf)*delta;
  acc+=pair;
  if(b.properties.w==0.0){
   let f=a.properties.x*pair;bf+=f;bp+=dot(f,a.state.zw);
   storagePower+=a.properties.x*b.properties.x*ci*approach*di/r;
  }else{
   let f=a.properties.x*lf*delta;lfForce+=f;lfPower+=dot(f,a.state.zw);
  }
 }
 acceleration[i]=vec4<f32>(acc,storagePower,pairs);
 boundary[i]=vec4<f32>(bf,bp,0.0);internalLF[i]=vec4<f32>(lfForce,lfPower,0.0);
}
`;

export interface SphReceiverGpuResult extends SphReceiverForces {
  /** Submission through readback, including queue contention; not GPU timestamps. */
  wallMilliseconds: number;
  /** Device pass durations when the existing device supports timestamps.
   * Null means unavailable; these exclude queue wait, readback and CPU audit. */
  gpuPassMilliseconds: {neighborhood:number|null;density:number|null;force:number|null;distances?:number|null;refinement?:number|null};
  /** Explicit diagnostic fields and compilation time; no scene integration. */
  alpha: number[];
  deviceCompilationMilliseconds?:number;
  precision: 'float32';
  method: 'fixed-point' | 'support-root' | 'mixed-precision' | 'device-density';
  densityAudit?: {repaired:number;falseSuccesses:number;alphaRepairs:number;maxResidual:number;maxCondition:number;cpuMilliseconds:number};
  /** Last eight iterations for a selected particle, in ring-buffer order. */
  densityTrace: number[][];
}

/** Pack explicit float32 input once so an independent CPU check can separate
 * storage quantization from shader arithmetic. Reject overflow/underflow. */
export function packSphReceiverParticles(particles: readonly SphReceiverParticle[]): Float32Array<ArrayBuffer> {
  if (!particles.length || particles.length > CAPACITY) throw Error('GPU receiver capacity must be 1..640');
  const out=new Float32Array(particles.length*8);
  particles.forEach((p,i)=>{
    out.set([p.x,p.y,p.vx,p.vy,p.mass,p.rho,p.h0,p.resident?1:0],i*8);
    const a=out.subarray(i*8,i*8+8);
    if(!a.every(Number.isFinite)||a[4]<=0||a[5]<=0||a[6]<=0)throw Error('Invalid float32 receiver input');
  });
  return out;
}

export async function createSphReceiverGpu(device:GPUDevice) {
  const buffers:GPUBuffer[]=[];
  let timestamps:GPUQuerySet|undefined;
  const make=(size:number,usage:GPUBufferUsageFlags,label:string)=>{const b=device.createBuffer({size,usage,label});buffers.push(b);return b;};
  const common=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST;
  const params=make(32,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST,'SWE receiver physical plane');
  const input=make(CAPACITY*32,common,'SWE receiver finite particles');
  const outputs=Array.from({length:5},(_,i)=>make(CAPACITY*16,common,`SWE receiver output ${i}`));
  const trace=make(8*16,common,'SWE receiver bounded density trace');
  const order=make(CAPACITY*8,common,'SWE receiver spatial ordering');
  const readback=make(CAPACITY*16*5+8*16,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ,'SWE receiver readback');
  try {
    // Reuse optional features already enabled on the renderer's device.
    // Never create a second device merely to obtain a timing measurement.
    timestamps=device.features.has('timestamp-query')?device.createQuerySet({type:'timestamp',count:10}):undefined;
    const timestampResolve=timestamps?make(80,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC,'SWE receiver timestamp resolve'):undefined;
    const timestampReadback=timestamps?make(80,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ,'SWE receiver timestamp readback'):undefined;
    const module=device.createShaderModule({code:sphReceiverWGSL,label:'physical-plane SWE receiver'});
    const info=await module.getCompilationInfo();
    const errors=info.messages.filter(m=>m.type==='error');
    if(errors.length)throw Error(errors.map(e=>`${e.lineNum}:${e.message}`).join('\n'));
    const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'uniform'}},
      {binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:'read-only-storage'}},
      ...[...outputs,trace,order].map((_,i)=>({binding:i+2,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage' as const}}))]});
    const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});
    const densityPipeline=await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:'solveDensity'}});
    const orderPipeline=await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:'orderParticles'}});
    const forcePipeline=await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:'forces'}});
    const probePipeline=await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:'probeSupport'}});
    const group=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:params}},{binding:1,resource:{buffer:input}},
      ...[...outputs,trace,order].map((buffer,i)=>({binding:i+2,resource:{buffer}}))]});
    let busy=false,disposed=false;
    // Allocate and compile only when this explicit experiment is requested.
    // A cached all-pairs distance table avoids repeating software square roots
    // during root iterations. Its full construction is included in GPU timing.
    let distancePipeline:GPUComputePipeline|undefined,refinePipeline:GPUComputePipeline|undefined,softGroup:GPUBindGroup|undefined;
    let deviceCompilationMilliseconds=0;
    const prepareDeviceDensity=async()=>{
      if(refinePipeline)return;
      const before=performance.now();
      const module=device.createShaderModule({code:sphDeviceDensityWGSL,label:'bounded device density candidate'});
      const info=await module.getCompilationInfo();const errors=info.messages.filter(m=>m.type==='error');
      if(errors.length)throw Error(errors.map(e=>e.lineNum+':'+e.message).join('\n'));
      distancePipeline=await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:'cacheDistances'}});
      refinePipeline=await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:'solveDeviceDensity'}});
      const cache=make(CAPACITY*CAPACITY*16,common,'SWE receiver exact uploaded distances');
      softGroup=device.createBindGroup({layout,entries:[{binding:0,resource:{buffer:params}},{binding:1,resource:{buffer:input}},
        ...[...outputs,cache,order].map((buffer,i)=>({binding:i+2,resource:{buffer}}))]});
      deviceCompilationMilliseconds=performance.now()-before;
    };
    return {
      async probeSupport(particles:readonly SphReceiverParticle[],plane:SphReceiverPlane,index:number,radii:readonly number[]){
        if(busy||disposed)throw Error('GPU receiver is busy or disposed');
        const packed=packSphReceiverParticles(particles),n=particles.length;
        if(!Number.isInteger(index)||index<0||index>=n||radii.length>8||radii.some(h=>!(h>0)||!Number.isFinite(h)))throw Error('Invalid bounded support probe');
        busy=true;
        try{
          device.queue.writeBuffer(input,0,packed);
          device.queue.writeBuffer(params,16,new Float32Array([plane.normalGravity,plane.tangentGravity,1000*plane.referenceDepth,plane.maximumSupportRadius]));
          const samples=[];
          for(const radius of radii){
            const radiusBits=new Uint32Array(new Float32Array([radius]).buffer)[0];
            device.queue.writeBuffer(params,0,new Uint32Array([n,0,index,radiusBits]));
            const encoder=device.createCommandEncoder({label:'SWE receiver arithmetic isolation'});
            const pass=encoder.beginComputePass();pass.setPipeline(probePipeline);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(n/64));pass.end();
            encoder.copyBufferToBuffer(outputs[0],0,readback,0,n*16);
            encoder.copyBufferToBuffer(outputs[1],0,readback,n*16,16);
            device.queue.submit([encoder.finish()]);await readback.mapAsync(GPUMapMode.READ);
            const values=new Float32Array(readback.getMappedRange().slice(0,n*16+16));readback.unmap();
            samples.push({h:Math.fround(radius),summary:Array.from(values.subarray(n*4,n*4+4)),terms:Array.from({length:n},(_,j)=>Array.from(values.subarray(j*4,j*4+4)))});
          }
          return samples;
        }finally{busy=false;}
      },
      async evaluate(particles:readonly SphReceiverParticle[],plane:SphReceiverPlane,method:'fixed-point'|'support-root'|'mixed-precision'|'device-density'='fixed-point'):Promise<SphReceiverGpuResult>{
        if(busy||disposed)throw Error('GPU receiver is busy or disposed');
        const packed=packSphReceiverParticles(particles),n=particles.length;
        const pf=new Float32Array([plane.normalGravity,plane.tangentGravity,1000*plane.referenceDepth,plane.maximumSupportRadius]);
        if(!pf.every(Number.isFinite)||pf[0]<=0||pf[2]<=0||pf[3]<=0)throw Error('Invalid GPU receiver plane');
        busy=true;const started=performance.now();
        const gpuPassMilliseconds:SphReceiverGpuResult['gpuPassMilliseconds']={neighborhood:null,density:null,force:null};
        try{
          if(method==='device-density')await prepareDeviceDensity();
          // A slow compiler is not permission to launch work after this study's setup budget.
          if(method==='device-density'&&performance.now()-started>60000)throw Error('Device density setup ceiling before dispatch');
          device.queue.writeBuffer(input,0,packed);
          const xs=Array.from({length:n},(_,i)=>packed[8*i]),ys=Array.from({length:n},(_,i)=>packed[8*i+1]);
          const axis=Math.max(...ys)-Math.min(...ys)>Math.max(...xs)-Math.min(...xs)?1:0;
          device.queue.writeBuffer(params,0,new Uint32Array([n,method==='fixed-point'?0:1,28,axis]));device.queue.writeBuffer(params,16,pf);
          device.queue.writeBuffer(trace,0,new Float32Array(32));
          const dispatch=async(pipelines:GPUComputePipeline[])=>{
            const encoder=device.createCommandEncoder({label:'bounded SWE receiver equations'});
            for(let index=0;index<pipelines.length;index++){
              const pipeline=pipelines[index];
              const pass=encoder.beginComputePass(timestamps?{timestampWrites:{querySet:timestamps,beginningOfPassWriteIndex:2*index,endOfPassWriteIndex:2*index+1}}:undefined);
              pass.setPipeline(pipeline);pass.setBindGroup(0,(pipeline===distancePipeline||pipeline===refinePipeline)?softGroup!:group);
              pass.dispatchWorkgroups(Math.ceil(pipeline===distancePipeline?n*n/64:pipeline===refinePipeline?n/32:n/64));pass.end();
            }
            outputs.forEach((b,i)=>encoder.copyBufferToBuffer(b,0,readback,i*n*16,n*16));
            encoder.copyBufferToBuffer(trace,0,readback,n*80,128);
            if(timestamps&&timestampResolve&&timestampReadback){
              encoder.resolveQuerySet(timestamps,0,pipelines.length*2,timestampResolve,0);
              encoder.copyBufferToBuffer(timestampResolve,0,timestampReadback,0,pipelines.length*16);
            }
            device.queue.submit([encoder.finish()]);
            await Promise.all([readback.mapAsync(GPUMapMode.READ),timestampReadback?.mapAsync(GPUMapMode.READ)]);
            if(timestampReadback){
              const times=new BigUint64Array(timestampReadback.getMappedRange());
              pipelines.forEach((pipeline,index)=>{
                const duration=Number(times[2*index+1]-times[2*index])/1e6;
                gpuPassMilliseconds[pipeline===orderPipeline?'neighborhood':pipeline===densityPipeline?'density':pipeline===distancePipeline?'distances':pipeline===refinePipeline?'refinement':'force']=duration>=0&&Number.isFinite(duration)?duration:null;
              });
              timestampReadback.unmap();
            }
            const values=new Float32Array(readback.getMappedRange().slice(0,n*16*5+128));readback.unmap();return values;
          };
          let data=await dispatch(method==='device-density'?[orderPipeline,densityPipeline,distancePipeline!,refinePipeline!,forcePipeline]:method==='mixed-precision'?[orderPipeline,densityPipeline]:[orderPipeline,densityPipeline,forcePipeline]);
          let densityAudit:SphReceiverGpuResult['densityAudit'];
          if(method==='mixed-precision'){
            // This opt-in study synchronizes before forces. Audit all returned
            // densities, not just failure flags, on the exact uploaded inputs.
            // No pressure force sees a rejected or partially repaired field.
            const uploaded=particles.map((a,i)=>({...a,x:packed[8*i],y:packed[8*i+1],vx:packed[8*i+2],vy:packed[8*i+3],mass:packed[8*i+4],rho:packed[8*i+5],h0:packed[8*i+6]}));
            const before=performance.now();
            const audited=auditSphDensity(uploaded,{normalGravity:pf[0],tangentGravity:pf[1],referenceDepth:pf[2]/1000,maximumSupportRadius:pf[3]},
              uploaded.map((_,i)=>({rho:data[4*i],h:data[4*i+1],alpha:data[4*i+2],code:data[n*4+4*i+1]})));
            const {fields,...counts}=audited;densityAudit={...counts,cpuMilliseconds:performance.now()-before};
            const checkedHealth=new Float32Array(n*4);
            uploaded.forEach((_,i)=>checkedHealth.set([data[n*4+4*i],0,2*fields[4*i+1],fields[4*i+3]],4*i));
            device.queue.writeBuffer(outputs[0],0,fields);device.queue.writeBuffer(outputs[1],0,checkedHealth);
            data=await dispatch([forcePipeline]);
          }
          if(method==='device-density'){
            // Read-only verification AFTER the completed device force pass.
            // A candidate needing any CPU repair fails; its results never feed
            // the live water or receive a hidden corrected pressure dispatch.
            const uploaded=particles.map((a,i)=>({...a,x:packed[8*i],y:packed[8*i+1],vx:packed[8*i+2],vy:packed[8*i+3],mass:packed[8*i+4],rho:packed[8*i+5],h0:packed[8*i+6]}));
            const before=performance.now();
            const audited=auditSphDensity(uploaded,{normalGravity:pf[0],tangentGravity:pf[1],referenceDepth:pf[2]/1000,maximumSupportRadius:pf[3]},
              uploaded.map((_,i)=>({rho:data[4*i],h:data[4*i+1],alpha:data[4*i+2],code:data[n*4+4*i+1]})));
            const {fields,...counts}=audited;densityAudit={...counts,cpuMilliseconds:performance.now()-before};
            if(audited.repaired||audited.alphaRepairs)throw Error('Device density requires CPU correction: '+JSON.stringify(counts));
          }
          const densityTrace=Array.from({length:8},(_,i)=>Array.from(data.subarray(n*20+i*4,n*20+i*4+4)));
          if(!data.every(Number.isFinite))throw Error('Nonfinite GPU receiver output');
          const result:SphReceiverGpuResult={rho:[],h:[],alpha:[],deviceCompilationMilliseconds:method==='device-density'?deviceCompilationMilliseconds:undefined,acceleration:[],bufferForce:[0,0],bufferForcePower:0,
            bufferPressureStoragePower:0,internalLFForce:[0,0],internalLFPower:0,densityIterations:0,densityResidual:0,pairCount:0,
            wallMilliseconds:performance.now()-started,gpuPassMilliseconds,precision:'float32',method,densityTrace,densityAudit};
          for(let i=0;i<n;i++){
            const d=data.subarray(i*4,i*4+4),diag=data.subarray(n*4+i*4,n*4+i*4+4),a=data.subarray(n*8+i*4,n*8+i*4+4);
            const b=data.subarray(n*12+i*4,n*12+i*4+4),lf=data.subarray(n*16+i*4,n*16+i*4+4);
            if(diag[1]!==0)throw Object.assign(Error(`GPU receiver rejected particle ${i}: code ${diag[1]}, iteration ${diag[0]}, residual ${diag[3]}`),{method,densityTrace});
            result.rho.push(d[0]);result.h.push(d[1]);result.alpha.push(d[2]);result.acceleration.push([a[0],a[1]]);
            result.densityIterations=Math.max(result.densityIterations,diag[0]);result.densityResidual=Math.max(result.densityResidual,d[3]);
            result.bufferForcePower+=b[2];result.bufferPressureStoragePower+=a[2];result.internalLFPower+=lf[2];result.pairCount+=a[3];
            for(let axis=0;axis<2;axis++){result.bufferForce[axis]+=b[axis];result.internalLFForce[axis]+=lf[axis];}
          }
          return result;
        }finally{busy=false;}
      },
      dispose(){if(busy)throw Error('Cannot dispose an active GPU receiver');if(!disposed){buffers.forEach(b=>b.destroy());timestamps?.destroy();disposed=true;}}
    };
  }catch(error){buffers.forEach(b=>b.destroy());timestamps?.destroy();throw error;}
}
