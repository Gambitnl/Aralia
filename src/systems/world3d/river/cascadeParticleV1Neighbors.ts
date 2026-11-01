/**
 * Builds complete particle and stationary-wall neighbor ranges on the GPU.
 * Hash collisions only add search work: consumers check the exact spatial cell.
 * Slots retain stable material identity; only the index list is reordered.
 * This isolated DFSPH experiment does not change native water.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 13:29:11
 * Dependents: systems/world3d/river/cascadeParticleV1.ts, systems/world3d/river/cascadeParticleV1Compute.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const cascadeParticleHashWGSL = `
fn cell(p:vec3<f32>, d:f32)->vec3<i32>{return vec3<i32>(floor(p/(2.0*d)));}
fn bucket(c:vec3<i32>, n:u32)->u32{
 return ((u32(c.x)*73856093u)^(u32(c.y)*19349663u)^(u32(c.z)*83492791u)) & (n-1u);
}`;

export interface CascadeParticleNeighbors {
  ranges:GPUBuffer; indices:GPUBuffer; bytes:number;
  encode(encoder:GPUCommandEncoder,count:number,boundaryCount:number):void;
  dispose():void;
}

/** Every global scan dependency is a separate dispatch, including block totals. */
export function createCascadeParticleNeighbors(device:GPUDevice,positions:GPUBuffer,boundaries:GPUBuffer,capacity:number,boundaryCapacity:number,bins:number,d:number):CascadeParticleNeighbors {
 const owned:GPUBuffer[]=[];
 const make=(bytes:number,label:string)=>{const b=device.createBuffer({label,size:Math.max(4,bytes),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});owned.push(b);return b;};
 const ranges=make(bins*8,'complete neighbor counts/offsets'),indices=make((capacity+boundaryCapacity)*4,'stable fluid/boundary indices'),cursor=make(bins*4,'scatter cursor');
 const params=device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});owned.push(params);
 const common=`struct P { n:u32,b:u32,bins:u32,pad:u32,d:f32,pad2:f32,pad3:f32,pad4:f32 }; @group(0) @binding(0) var<uniform> p:P;
 @group(0) @binding(1) var<storage,read> x:array<vec4<f32>>;
 @group(0) @binding(2) var<storage,read> wall:array<vec4<f32>>;
 @group(0) @binding(3) var<storage,read_write> r:array<atomic<u32>>;
 @group(0) @binding(4) var<storage,read_write> out:array<u32>;
 @group(0) @binding(5) var<storage,read_write> cursor:array<atomic<u32>>;
 ${cascadeParticleHashWGSL}`;
 const pipeline=(code:string,entryPoint:string)=>device.createComputePipeline({layout:'auto',compute:{module:device.createShaderModule({code}),entryPoint}});
 const clear=pipeline(common+`@compute @workgroup_size(128) fn clear(@builtin(global_invocation_id) gid:vec3<u32>){let i=gid.x;if(i<p.bins){atomicStore(&r[i],0u);atomicStore(&r[p.bins+i],0u);atomicStore(&cursor[i],0u);}}`,'clear');
 const count=pipeline(common+`@compute @workgroup_size(128) fn count(@builtin(global_invocation_id) gid:vec3<u32>){let i=gid.x;var q:vec3<f32>;if(i<p.n){if(x[i].w!=1.0){return;}q=x[i].xyz;}else if(i<p.n+p.b){q=wall[i-p.n].xyz;}else{return;}atomicAdd(&r[bucket(cell(q,p.d),p.bins)],1u);}`,'count');
 const scatter=pipeline(common+`@compute @workgroup_size(128) fn scatter(@builtin(global_invocation_id) gid:vec3<u32>){let i=gid.x;var q:vec3<f32>;var id:u32;if(i<p.n){if(x[i].w!=1.0){return;}q=x[i].xyz;id=i;}else if(i<p.n+p.b){q=wall[i-p.n].xyz;id=(i-p.n)|0x80000000u;}else{return;}let k=bucket(cell(q,p.d),p.bins);let at=atomicLoad(&r[p.bins+k])+atomicAdd(&cursor[k],1u);out[at]=id;}`,'scatter');
 const bind=(pipe:GPUComputePipeline)=>device.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:params}},...([[1,positions],[2,boundaries],[3,ranges],[4,indices],[5,cursor]] as const).filter(([binding])=>pipe===clear?binding===3||binding===5:pipe===count?binding<=3:true).map(([binding,buffer])=>({binding,resource:{buffer}}))]});
 const groups=[bind(clear),bind(count),bind(scatter)];
 // Scan uses a different packed uniform so its dimensions cannot change while queued.
 const scanCode=`struct S{n:u32,inputOffset:u32,outputOffset:u32,pad:u32};@group(0) @binding(0)var<uniform>s:S;
 @group(0) @binding(1)var<storage,read_write>a:array<u32>;@group(0) @binding(2)var<storage,read_write>b:array<u32>;@group(0) @binding(3)var<storage,read_write>totals:array<u32>;
 var<workgroup> scratch:array<u32,128>;
 @compute @workgroup_size(128) fn scan(@builtin(global_invocation_id)g:vec3<u32>,@builtin(local_invocation_index)l:u32,@builtin(workgroup_id)w:vec3<u32>){let value=select(0u,a[s.inputOffset+min(g.x,s.n-1u)],g.x<s.n);scratch[l]=value;workgroupBarrier();var step=1u;loop{if(step>=128u){break;}var add=0u;if(l>=step){add=scratch[l-step];}workgroupBarrier();scratch[l]+=add;workgroupBarrier();step*=2u;}if(g.x<s.n){b[s.outputOffset+g.x]=scratch[l]-value;}if(l==127u){totals[w.x]=scratch[l];}}
 @compute @workgroup_size(128) fn add(@builtin(global_invocation_id)g:vec3<u32>){if(g.x<s.n){b[s.outputOffset+g.x]+=totals[g.x/128u];}}`;
 const scanPipe=pipeline(scanCode,'scan'),addPipe=pipeline(scanCode,'add');
 type Level={n:number,input:GPUBuffer,output:GPUBuffer,total:GPUBuffer,uniform:GPUBuffer,scan:GPUBindGroup,add?:GPUBindGroup,byteOffset:number};const levels:Level[]=[];
 let n=bins,input=ranges,output=ranges,inputOffset=0,outputOffset=0;
 while(true){const total=make(Math.ceil(n/128)*4,'scan block totals'),uniform=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM,mappedAtCreation:true});new Uint32Array(uniform.getMappedRange()).set([n,inputOffset,outputOffset,0]);uniform.unmap();owned.push(uniform);
 const byteOffset=levels.length===0?bins*4:0;
 const scan=device.createBindGroup({layout:scanPipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:uniform}},{binding:1,resource:{buffer:input,size:n*4}},{binding:2,resource:{buffer:output,offset:byteOffset,size:n*4}},{binding:3,resource:{buffer:total}}]});levels.push({n,input,output,total,uniform,scan,byteOffset});if(n<=128)break;n=Math.ceil(n/128);input=total;output=make(n*4,'scan block offsets');inputOffset=0;outputOffset=0;}
 for(let i=0;i<levels.length-1;i++){const a=levels[i];a.add=device.createBindGroup({layout:addPipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a.uniform}},{binding:2,resource:{buffer:a.output,offset:a.byteOffset,size:a.n*4}},{binding:3,resource:{buffer:levels[i+1].output}}]});}
 const dispatch=(encoder:GPUCommandEncoder,pipe:GPUComputePipeline,group:GPUBindGroup,size:number)=>{const pass=encoder.beginComputePass();pass.setPipeline(pipe);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(size/128));pass.end();};
 return {ranges,indices,bytes:owned.reduce((sum,b)=>sum+b.size,0),encode(encoder,n,b){device.queue.writeBuffer(params,0,new Uint32Array([n,b,bins,0]));device.queue.writeBuffer(params,16,new Float32Array([d,0,0,0]));dispatch(encoder,clear,groups[0],bins);dispatch(encoder,count,groups[1],n+b);for(const l of levels)dispatch(encoder,scanPipe,l.scan,l.n);for(let i=levels.length-2;i>=0;i--)dispatch(encoder,addPipe,levels[i].add!,levels[i].n);dispatch(encoder,scatter,groups[2],n+b);},dispose(){owned.forEach(b=>b.destroy());}};
}
