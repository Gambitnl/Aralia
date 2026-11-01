/**
 * The isolated waterfall's published DFSPH pressure stages, executed on its
 * renderer-owned GPU device. Fluid pairs use matched gather forces. Stationary
 * Akinci samples contribute to every matching wall term. Trial forces never
 * enter the physical impulse ledger; only the final applied force does.
 * Pinned formulation: SPlisHSPlasH f3f677140761db7637b5443beb54f19f1f835ed4.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 14:12:27
 * Dependents: systems/world3d/river/cascadeParticleV1.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { cascadeParticleHashWGSL } from './cascadeParticleV1Neighbors';

import type { CascadeParticleTiming } from './cascadeParticleV1Timing';
/** Batch boundaries only limit queued work. A failed100th iterate remains
 * failed; the caller still applies the same final iterate once for capture. */
export async function cascadeParticleRunBatches(run:(begin:number,end:number,initialize:boolean)=>Promise<Float32Array>):Promise<Float32Array>{let summary:Float32Array=new Float32Array();for(let begin=0;begin<100;begin+=4){summary=await run(begin,begin+4,begin===0);if(!summary.every(Number.isFinite))throw Error('Nonfinite batched solve summary');if(summary[0]===1)break;}return summary;}
export interface CascadeParticleComputeBuffers {positions:GPUBuffer;velocities:GPUBuffer;data:GPUBuffer;pressureA:GPUBuffer;pressureB:GPUBuffer;acceleration:GPUBuffer;boundaries:GPUBuffer;ranges:GPUBuffer;indices:GPUBuffer;ledger:GPUBuffer;params:GPUBuffer;capacity:number;bins:number}
export interface CascadeParticleCompute {encodeDensity(e:GPUCommandEncoder,count:number):void;encodeRate(e:GPUCommandEncoder,count:number):void;encodeSolve(e:GPUCommandEncoder,count:number,divergence:boolean,timing?:CascadeParticleTiming,begin?:number,end?:number,initialize?:boolean,applyFinal?:boolean):void;encodeGravity(e:GPUCommandEncoder,count:number):void;validateShaders():Promise<string[]>;dispose():void;bytes:number}

/** Cubic kernel support is twice spacing; the reference's h is that support. */
export const cascadeParticleKernelWGSL=`
fn W(r:vec3<f32>,d:f32)->f32{let q=length(r)/(2.0*d);let k=1.0/(3.141592653589793*d*d*d);if(q>1.0){return 0.0;}if(q<=0.5){return k*(6.0*q*q*q-6.0*q*q+1.0);}return k*2.0*pow(1.0-q,3.0);}
fn gradW(r:vec3<f32>,d:f32)->vec3<f32>{let len=length(r);let q=len/(2.0*d);if(len<=1e-9||q>1.0){return vec3<f32>(0);}let k=1.0/(3.141592653589793*d*d*d);var f= -6.0*(1.0-q)*(1.0-q);if(q<=0.5){f=18.0*q*q-12.0*q;}return r/len*(k*f/(2.0*d));}`;

/** Bounded Float64 audit of a captured control, outside timed production work.
 * It independently gathers all pairs, without the GPU hash or reductions. */
export function cascadeParticleReferenceState(positions:ArrayLike<number>,velocities:ArrayLike<number>,d:number,boundaries:ArrayLike<number>=[],pressures:ArrayLike<number>=[]):{data:Float64Array;acceleration:Float64Array}{
 const count=positions.length/4;if(count>4096)throw Error('Captured-state audit is limited to compact controls');const data=new Float64Array(count*4),acceleration=new Float64Array(count*3),volume=d**3;
 const kernel=(r:number)=>{const q=r/(2*d);return(q>1?0:q<=.5?6*q**3-6*q*q+1:2*(1-q)**3)/(Math.PI*d**3);};
 for(let i=0;i<count;i++){if(positions[4*i+3]!==1)continue;let rho=volume*kernel(0),square=0,rate=0,neighbors=0;const sum=[0,0,0];
 for(let j=0;j<count+boundaries.length/4;j++){const wall=j>=count,index=wall?j-count:j,array=wall?boundaries:positions;if(!wall&&(index===i||array[4*index+3]!==1))continue;const r=[0,1,2].map(k=>positions[4*i+k]-array[4*index+k]),len=Math.hypot(...r);if(len>=2*d)continue;const V=wall?array[4*index+3]:volume;rho+=V*kernel(len);neighbors++;const q=len/(2*d),f=len<=1e-9?0:(q<=.5?18*q*q-12*q:-6*(1-q)**2)/(2*Math.PI*d**4*len),g=r.map(x=>V*f*x);for(let k=0;k<3;k++){sum[k]+=g[k];rate+=(velocities[4*i+k]-(wall?0:velocities[4*index+k]))*g[k];const pressure=pressures[i]??0,pair=pressure+(wall?0:pressures[index]??0);if(Math.abs(pair)>1e-5)acceleration[3*i+k]-=pair*g[k];}if(!wall)square+=g.reduce((s,v)=>s+v*v,0);}
 square+=sum.reduce((s,v)=>s+v*v,0);data.set([rho,square>1e-5?1/square:0,rate,neighbors],4*i);}return{data,acceleration};
}

/** The same pinned Jacobi iteration on a small frozen state, in Float64.
 * This is a diagnostic, never an alternate runtime or a repaired pressure rule. */
export function cascadeParticleReferenceSolve(positions:ArrayLike<number>,velocities:ArrayLike<number>,d:number,dt:number,boundaries:ArrayLike<number>,divergence=false){
 const initial=cascadeParticleReferenceState(positions,velocities,d,boundaries),count=positions.length/4,neighbors:{j:number;g:number[]}[][]=Array.from({length:count},()=>[]),V=d**3;
 for(let i=0;i<count;i++)if(positions[i*4+3]===1)for(let j=0;j<count+boundaries.length/4;j++){const wall=j>=count,k=wall?j-count:j,a=wall?boundaries:positions;if(!wall&&(k===i||a[k*4+3]!==1))continue;const r=[0,1,2].map(axis=>positions[i*4+axis]-a[k*4+axis]),len=Math.hypot(...r);if(len>=2*d)continue;const q=len/(2*d),f=len<=1e-9?0:(q<=.5?18*q*q-12*q:-6*(1-q)**2)/(2*Math.PI*d**4*len);neighbors[i].push({j:wall?-1:k,g:r.map(x=>x*f*(wall?a[k*4+3]:V))});}
 const scale=divergence?dt:dt*dt,source=new Float64Array(count);let pressure=new Float64Array(count);for(let i=0;i<count;i++){source[i]=divergence?-initial.data[i*4+2]:1-initial.data[i*4]-dt*initial.data[i*4+2];pressure[i]=Math.max(-source[i],0)*initial.data[i*4+1]/scale;if(divergence&&initial.data[i*4+3]<20)pressure[i]=0;}
 const acceleration=(p:Float64Array)=>{const a=new Float64Array(count*3);for(let i=0;i<count;i++)for(const n of neighbors[i]){const pair=p[i]+(n.j<0?0:p[n.j]);if(Math.abs(pair)>1e-5)for(let k=0;k<3;k++)a[i*3+k]-=pair*n.g[k];}return a;};
 let raw=0,masked=0,iteration=0;for(;iteration<100;){const a=acceleration(pressure),next=new Float64Array(count);raw=masked=0;let live=0;for(let i=0;i<count;i++){if(positions[i*4+3]!==1)continue;live++;let ap=0;for(const n of neighbors[i])for(let k=0;k<3;k++)ap+=(a[i*3+k]-(n.j<0?0:a[n.j*3+k]))*n.g[k];const residual=source[i]-scale*ap,error=Math.max(-residual,0);raw+=error;if(!divergence||initial.data[i*4+3]>=20)masked+=error;next[i]=Math.max(pressure[i]-.5*residual*initial.data[i*4+1]/scale,0);}pressure=next;raw/=Math.max(1,live);masked/=Math.max(1,live);iteration++;if(iteration>=(divergence?1:2)&&masked<=(divergence?.001/dt:.0001))break;}
 return{initialData:initial.data,source,pressure,acceleration:acceleration(pressure),iterations:iteration,rawResidual:raw,maskedResidual:masked,converged:masked<=(divergence?.001/dt:.0001)};
}

export function createCascadeParticleCompute(device:GPUDevice,b:CascadeParticleComputeBuffers):CascadeParticleCompute {
 const common=`struct Params{d:f32,dt:f32,time:f32,count:f32,rho:f32,capacity:f32,boundaryCount:f32,bins:f32,nx:f32,ny:f32,nz:f32,pad:f32,extra:vec4<f32>};
 @group(0) @binding(0)var<uniform>p:Params;
 @group(0) @binding(1)var<storage,read>x:array<vec4<f32>>;
 @group(0) @binding(2)var<storage,read_write>v:array<vec4<f32>>;
 @group(0) @binding(3)var<storage,read_write>data:array<vec4<f32>>;
 @group(0) @binding(4)var<storage,read_write>pressure:array<vec4<f32>>;
 @group(0) @binding(5)var<storage,read_write>acc:array<vec4<f32>>;
 @group(0) @binding(6)var<storage,read>wall:array<vec4<f32>>;
 @group(0) @binding(7)var<storage,read>ranges:array<u32>;
 @group(0) @binding(8)var<storage,read>indices:array<u32>;
 ${cascadeParticleHashWGSL}${cascadeParticleKernelWGSL}`;
 // A hash collision never changes the neighbor set. The exact targetCell cell and
 // support distance are checked before evaluating a fluid or boundary term.
 const neighbors=(body:string,readVelocity=false)=>`let base=cell(x[i].xyz,p.d);for(var zz=-1;zz<=1;zz++){for(var yy=-1;yy<=1;yy++){for(var xx=-1;xx<=1;xx++){let targetCell=base+vec3<i32>(xx,yy,zz);let h=bucket(targetCell,u32(p.bins));let start=ranges[u32(p.bins)+h];let end=start+ranges[h];for(var at=start;at<end;at++){let id=indices[at];let isWall=(id&0x80000000u)!=0u;let j=id&0x7fffffffu;var xj:vec3<f32>;var vj=vec3<f32>(0);var Vj=p.d*p.d*p.d;if(isWall){xj=wall[j].xyz;Vj=wall[j].w;}else{if(j==i||x[j].w!=1.0){continue;}xj=x[j].xyz;${readVelocity?'vj=v[j].xyz;':''}}if(any(cell(xj,p.d)!=targetCell)){continue;}let r=x[i].xyz-xj;if(dot(r,r)>=4.0*p.d*p.d){continue;}let g=Vj*gradW(r,p.d);${body}}}}}`;
 const modules:GPUShaderModule[]=[];const pipeline=(code:string,entryPoint:string)=>{const module=device.createShaderModule({label:`DFSPH ${entryPoint}`,code});modules.push(module);return device.createComputePipeline({layout:'auto',compute:{module,entryPoint}});};
 const density=pipeline(common+`@compute @workgroup_size(128)fn density(@builtin(global_invocation_id)gid:vec3<u32>){let i=gid.x;if(i>=u32(p.count)||x[i].w!=1.0){return;}var rho=p.d*p.d*p.d*W(vec3<f32>(0),p.d);var sumGrad=vec3<f32>(0);var squared=0.0;var count=0.0;${neighbors('rho+=Vj*W(r,p.d);sumGrad+=g;if(!isWall){squared+=dot(g,g);}count+=1.0;')}squared+=dot(sumGrad,sumGrad);var factor=0.0;if(squared>1e-5){factor=1.0/squared;}data[i]=vec4<f32>(rho,factor,0,count);}`,'density');
 const init=(div:boolean)=>pipeline(common+`@compute @workgroup_size(128)fn init(@builtin(global_invocation_id)gid:vec3<u32>){let i=gid.x;if(i==0u){data[u32(p.capacity)]=vec4<f32>(0);}if(i>=u32(p.count)||x[i].w!=1.0){return;}var rate=0.0;${neighbors('rate+=dot(v[i].xyz-vj,g);',true)}data[i].z=rate;var source=${div?'-rate':'1.0-data[i].x-p.dt*rate'};let factor=data[i].y/${div?'p.dt':'(p.dt*p.dt)'};var positive=max(-source,0.0);${div?'if(data[i].w<20.0){positive=0.0;}':''}pressure[i]=vec4<f32>(positive*factor,source,0,0);}`,'init');
 const rate=pipeline(common+`@compute @workgroup_size(128)fn rate(@builtin(global_invocation_id)gid:vec3<u32>){let i=gid.x;if(i>=u32(p.count)||x[i].w!=1.0){return;}var value=0.0;${neighbors('value+=dot(v[i].xyz-vj,g);',true)}data[i].z=value;}`,'rate');
 const acceleration=(skip:boolean)=>pipeline(common+`@compute @workgroup_size(128)fn accel(@builtin(global_invocation_id)gid:vec3<u32>){let i=gid.x;if(i>=u32(p.count)||x[i].w!=1.0){return;}${skip?'if(data[u32(p.capacity)].x>0.0){return;}':''}var a=vec3<f32>(0);var boundary=vec3<f32>(0);let pi=pressure[i].x;${neighbors('if(isWall){if(abs(pi)>1e-5){let force= -pi*g;a+=force;boundary+=force;}}else{let pj=pressure[j].x;if(abs(pi+pj)>1e-5){a-=(pi+pj)*g;}}')}acc[i]=vec4<f32>(a,0);acc[u32(p.capacity)+i]=vec4<f32>(boundary,0);}`,'accel');
 // The pressure output is a distinct global iterate. All acceleration reads
 // refer to the complete prior iterate; no workgroup-local Jacobi shortcut.
 const jacobi=(div:boolean)=>pipeline(common+`@group(0) @binding(9)var<storage,read_write>nextPressure:array<vec4<f32>>;
 @compute @workgroup_size(128)fn jacobi(@builtin(global_invocation_id)gid:vec3<u32>){let i=gid.x;if(i>=u32(p.count)||x[i].w!=1.0){return;}if(data[u32(p.capacity)].x>0.0){nextPressure[i]=pressure[i];return;}var ap=0.0;${neighbors('var aj=vec3<f32>(0);if(!isWall){aj=acc[j].xyz;}ap+=dot(acc[i].xyz-aj,g);')}let scale=${div?'p.dt':'p.dt*p.dt'};let residual=pressure[i].y-scale*ap;let raw=max(-residual,0.0);var masked=raw;${div?'if(data[i].w<20.0){masked=0.0;}':''}nextPressure[i]=vec4<f32>(max(pressure[i].x-0.5*residual*data[i].y/scale,0.0),pressure[i].y,raw,masked);}`,'jacobi');
 // Jacobi has nine declared storage fields, but v is unused in this kernel,
 // hence eight actual bindings. Automatic layouts omit unused declarations.
 const reductionCode=`struct P{d:f32,dt:f32,time:f32,count:f32,rho:f32,capacity:f32,boundary:f32,bins:f32};
 @group(0) @binding(0)var<uniform>p:P;@group(0) @binding(1)var<storage,read>pressure:array<vec4<f32>>;@group(0) @binding(2)var<storage,read>x:array<vec4<f32>>;@group(0) @binding(3)var<storage,read_write>data:array<vec4<f32>>;@group(0) @binding(4)var<storage,read_write>sums:array<vec4<f32>>;var<workgroup>reduceScratch:array<vec4<f32>,128>;
 @compute @workgroup_size(128)fn reduce(@builtin(global_invocation_id)gid:vec3<u32>,@builtin(local_invocation_index)l:u32,@builtin(workgroup_id)wg:vec3<u32>){var s=vec4<f32>(0);if(gid.x<u32(p.count)&&x[gid.x].w==1.0){s=vec4<f32>(pressure[gid.x].z,pressure[gid.x].w,1,0);}reduceScratch[l]=s;workgroupBarrier();var step=64u;loop{if(step==0u){break;}if(l<step){reduceScratch[l]+=reduceScratch[l+step];}workgroupBarrier();step/=2u;}if(l==0u){sums[wg.x]=reduceScratch[0];}}
 @compute @workgroup_size(128)fn finish(@builtin(local_invocation_index)l:u32){var s=vec4<f32>(0);for(var j=l;j<(u32(p.count)+127u)/128u;j+=128u){s+=sums[j];}reduceScratch[l]=s;workgroupBarrier();var step=64u;loop{if(step==0u){break;}if(l<step){reduceScratch[l]+=reduceScratch[l+step];}workgroupBarrier();step/=2u;}if(l==0u&&data[u32(p.capacity)].x==0.0){let total=reduceScratch[0];let mean=total.y/max(total.z,1.0);let iteration=data[u32(p.capacity)].y+1.0;data[u32(p.capacity)]=vec4<f32>(select(0.0,1.0,mean<=THRESHOLD&&iteration>=MINIMUM),iteration,total.x/max(total.z,1.0),mean);}}`;
 const sums=device.createBuffer({size:Math.ceil(b.capacity/128)*16,usage:GPUBufferUsage.STORAGE});
 const reducers=[false,true].map(div=>({reduce:pipeline(reductionCode.replace('THRESHOLD',div?'0.001/p.dt':'0.0001').replace('MINIMUM',div?'1.0':'2.0'),'reduce'),finish:pipeline(reductionCode.replace('THRESHOLD',div?'0.001/p.dt':'0.0001').replace('MINIMUM',div?'1.0':'2.0'),'finish')}));
 const applyCode=`struct P{d:f32,dt:f32,time:f32,count:f32,rho:f32,capacity:f32,boundary:f32,bins:f32};@group(0) @binding(0)var<uniform>p:P;
 @group(0) @binding(1)var<storage,read>x:array<vec4<f32>>;@group(0) @binding(2)var<storage,read_write>v:array<vec4<f32>>;@group(0) @binding(3)var<storage,read>acc:array<vec4<f32>>;@group(0) @binding(4)var<storage,read_write>ledger:array<vec4<f32>>;
 @compute @workgroup_size(128)fn apply(@builtin(global_invocation_id)g:vec3<u32>){let i=g.x;if(i>=u32(p.count)||x[i].w!=1.0){return;}v[i]=vec4<f32>(v[i].xyz+p.dt*acc[i].xyz,v[i].w);ledger[i]=vec4<f32>(ledger[i].xyz+p.rho*p.d*p.d*p.d*p.dt*acc[u32(p.capacity)+i].xyz,ledger[i].w);}
 @compute @workgroup_size(128)fn gravity(@builtin(global_invocation_id)g:vec3<u32>){let i=g.x;if(i>=u32(p.count)||x[i].w!=1.0){return;}v[i].y-=9.81*p.dt;ledger[u32(p.capacity)+i].y-=p.rho*p.d*p.d*p.d*9.81*p.dt;}`;
 const apply=pipeline(applyCode,'apply'),gravity=pipeline(applyCode,'gravity');
 const resource=(binding:number,buffer:GPUBuffer)=>({binding,resource:{buffer}});
 const group=(pipe:GPUComputePipeline,bindings:[number,GPUBuffer][])=>device.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:bindings.map(([i,v])=>resource(i,v))});
 const base=(pressure:GPUBuffer):[number,GPUBuffer][]=>[[0,b.params],[1,b.positions],[2,b.velocities],[3,b.data],[4,pressure],[5,b.acceleration],[6,b.boundaries],[7,b.ranges],[8,b.indices]];
 const pick=(a:[number,GPUBuffer][],ids:number[])=>a.filter(([id])=>ids.includes(id));
 const densityGroup=group(density,pick(base(b.pressureA),[0,1,3,6,7,8]));
 const rateGroup=group(rate,pick(base(b.pressureA),[0,1,2,3,6,7,8]));
 const initPipes=[init(false),init(true)],skipAccel=acceleration(true),finalAccel=acceleration(false),jacobiPipes=[jacobi(false),jacobi(true)];
 const applyGroup=group(apply,[[0,b.params],[1,b.positions],[2,b.velocities],[3,b.acceleration],[4,b.ledger]]),gravityGroup=group(gravity,[[0,b.params],[1,b.positions],[2,b.velocities],[4,b.ledger]]);
 const dispatch=(e:GPUCommandEncoder,pipe:GPUComputePipeline,group:GPUBindGroup,n:number,timestampWrites?:GPUComputePassTimestampWrites)=>{const pass=e.beginComputePass({timestampWrites});pass.setPipeline(pipe);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.max(1,Math.ceil(n/128)));pass.end();};
 const sets=[false,true].map((div,index)=>{const p=jacobiPipes[index],r=reducers[index];return {init:group(initPipes[index],pick(base(b.pressureA),[0,1,2,3,4,6,7,8])),iter:[b.pressureA,b.pressureB].map((buffer,i)=>({acc:group(skipAccel,pick(base(buffer),[0,1,3,4,5,6,7,8])),jacobi:group(p,[...pick(base(buffer),[0,1,3,4,5,6,7,8]),[9,i===0?b.pressureB:b.pressureA]]),reduce:group(r.reduce,[[0,b.params],[1,i===0?b.pressureB:b.pressureA],[2,b.positions],[4,sums]]),finish:group(r.finish,[[0,b.params],[3,b.data],[4,sums]])})),final:group(finalAccel,pick(base(b.pressureA),[0,1,4,5,6,7,8]))};});
 return {bytes:sums.size,encodeDensity(e,n){dispatch(e,density,densityGroup,n);},encodeRate(e,n){dispatch(e,rate,rateGroup,n);},encodeSolve(e,n,div,timing,begin=0,end=100,initialize=true,applyFinal=true){const k=div?1:0,s=sets[k];if(initialize)dispatch(e,initPipes[k],s.init,n);if(timing)timing.queued[div?'divergence':'density']+=end-begin;for(let iteration=begin;iteration<end;iteration++){const a=s.iter[iteration%2];if(timing)timing.scope=`pressure.${div?'divergence':'density'}.iteration.${iteration+1}`;const stamp=timing?.pair(timing.scope);dispatch(e,skipAccel,a.acc,n,stamp?{querySet:stamp.querySet,beginningOfPassWriteIndex:stamp.beginningOfPassWriteIndex}:undefined);dispatch(e,jacobiPipes[k],a.jacobi,n);dispatch(e,reducers[k].reduce,a.reduce,n);dispatch(e,reducers[k].finish,a.finish,128,stamp?{querySet:stamp.querySet,endOfPassWriteIndex:stamp.endOfPassWriteIndex}:undefined);}if(timing)timing.scope=`${div?'divergence':'density'} final acceleration/apply`;if(applyFinal){dispatch(e,finalAccel,s.final,n);dispatch(e,apply,applyGroup,n);}},encodeGravity(e,n){dispatch(e,gravity,gravityGroup,n);},async validateShaders(){const failures:string[]=[];for(const module of modules){const info=await module.getCompilationInfo();failures.push(...info.messages.filter(m=>m.type==='error').map(m=>`${m.lineNum}: ${m.message}`));}return failures;},dispose(){sums.destroy();}};
}
