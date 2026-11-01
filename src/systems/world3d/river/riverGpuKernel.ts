/** The existing river's HLL shallow-water calculation, executed on WebGPU.
 * Faces are written once and gathered by their two cells, so no floating-point
 * atomics race over shared water. The host retains terrain editing, source
 * history and airborne ownership. This shader does not change water shading.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/10/2026, 13:13:41
 * Dependents: systems/world3d/river/riverGpuResident.ts, systems/world3d/river/riverGpuStep.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const RIVER_GPU_SHADER = /* wgsl */ `
// A second dispatch row covers large courses without exceeding WebGPU's
// guaranteed per-dimension limit. Linear cell order and arithmetic stay intact.
fn linearInvocation(id:vec3<u32>)->u32{return id.x+id.y*4194240u;}
fn linearWorkgroup(group:vec3<u32>)->u32{return group.x+group.y*65535u;}
struct Params { nx:u32,nz:u32,count:u32,outEdge:u32,dx:f32,dt:f32,dry:f32,activeCount:u32 }
struct Result { water:vec4<f32>, stats:vec4<f32> }
@group(0) @binding(0) var<uniform> cfg:Params;
@group(0) @binding(1) var<storage,read> state:array<vec4<f32>>;
// bit0: active; bit1/bit2: left/right end of an active row run.
@group(0) @binding(2) var<storage,read> topology:array<u32>;
@group(0) @binding(3) var<storage,read> source:array<vec4<f32>>;
@group(0) @binding(4) var<storage,read_write> faceX:array<vec4<f32>>;
@group(0) @binding(5) var<storage,read_write> faceZ:array<vec4<f32>>;
@group(0) @binding(6) var<storage,read_write> delta:array<vec4<f32>>;
@group(0) @binding(7) var<storage,read_write> result:array<Result>;
@group(0) @binding(8) var<storage,read> awakeCells:array<u32>;
const G=9.81;
fn velocity(c:u32)->vec2<f32>{if(state[c].x>cfg.dry){return state[c].yz/state[c].x;}return vec2<f32>(0.0);}
fn hll(hl:f32,ul:f32,vl:f32,hr:f32,ur:f32,vr:f32)->vec4<f32>{
 let cl=sqrt(G*hl);let cr=sqrt(G*hr);var sl=0.0;var sr=0.0;
 if(hl<=0.0){sl=ur-2.0*cr;sr=ur+cr;}else if(hr<=0.0){sl=ul-cl;sr=ul+2.0*cl;}else{sl=min(ul-cl,ur-cr);sr=max(ul+cl,ur+cr);}
 let ql=hl*ul;let qr=hr*ur;let pl=ql*ul+0.5*G*hl*hl;let pr=qr*ur+0.5*G*hr*hr;var fh=0.0;var fnormal=0.0;
 if(sl>=0.0){fh=ql;fnormal=pl;}else if(sr<=0.0){fh=qr;fnormal=pr;}else{let inv=1.0/(sr-sl);fh=(sr*ql-sl*qr+sl*sr*(hr-hl))*inv;fnormal=(sr*pl-sl*pr+sl*sr*(qr-ql))*inv;}
 return vec4<f32>(fh,fnormal,fh*select(vr,vl,fh>0.0),max(abs(sl),abs(sr)));
}
fn face(l:u32,r:u32,axis:u32)->vec4<f32>{
 let a=state[l];let b=state[r];if(a.x<=cfg.dry&&b.x<=cfg.dry){return vec4<f32>(0.0);}
 // Subtract bed differences before depth: absolute world elevation must not
 // erase a shallow film when the CPU's Float64 state enters a Float32 device.
 let hl=max(0.0,a.x-max(0.0,b.w-a.w));let hr=max(0.0,b.x-max(0.0,a.w-b.w));let ul=velocity(l);let ur=velocity(r);
 if(axis==0u){return hll(hl,ul.x,ul.y,hr,ur.x,ur.y);}return hll(hl,ul.y,ul.x,hr,ur.y,ur.x);
}
@compute @workgroup_size(64) fn faces(@builtin(global_invocation_id) id:vec3<u32>){
 if(linearInvocation(id)>=cfg.activeCount){return;}let c=awakeCells[linearInvocation(id)];faceX[c]=vec4<f32>(0.0);faceZ[c]=vec4<f32>(0.0);
 if((topology[c]&1u)==0u){return;}
 if((topology[c]&2u)==0u){faceX[c]=face(c-1u,c,0u);}if(c>=cfg.nx){faceZ[c]=face(c-cfg.nx,c,1u);}
}
// The CPU skips the whole face when both films are below its dry threshold,
// including bed pressure. A sleeping film must not gain momentum here.
fn bedCorrection(c:u32,other:u32)->f32{let h=state[c].x;if(h<=cfg.dry&&state[other].x<=cfg.dry){return 0.0;}let hs=max(0.0,h-max(0.0,state[other].w-state[c].w));return 0.5*G*(h*h-hs*hs);}
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) id:vec3<u32>){
 if(linearInvocation(id)>=cfg.activeCount){return;}let c=awakeCells[linearInvocation(id)];delta[c]=vec4<f32>(0.0);if((topology[c]&1u)==0u){return;}
 var d=vec3<f32>(0.0);var qout=0.0;let h=state[c].x;let v=velocity(c);let i=c%cfg.nx;let j=c/cfg.nx;
 if((topology[c]&2u)==0u){let f=faceX[c];d+=vec3<f32>(f.x,f.y+bedCorrection(c,c-1u),f.z);}
 if((topology[c]&4u)==0u){let f=faceX[c+1u];d-=vec3<f32>(f.x,f.y+bedCorrection(c,c+1u),f.z);}
 if(j>0u){let f=faceZ[c];d+=vec3<f32>(f.x,f.z,f.y+bedCorrection(c,c-cfg.nx));}
 if(j+1u<cfg.nz&&(topology[c+cfg.nx]&1u)!=0u){let f=faceZ[c+cfg.nx];d-=vec3<f32>(f.x,f.z,f.y+bedCorrection(c,c+cfg.nx));}
 // Row-run ends and outer north/south edges retain the CPU wall and
 // outward-only transmissive boundary laws. 0=east,1=west,2=north,3=south.
 if(h>cfg.dry){for(var end=0u;end<2u;end++){
  let bit=select(2u,4u,end==1u);if((topology[c]&bit)==0u){continue;}let sign=select(-1.0,1.0,end==1u);
  let outlet=(end==1u&&i==cfg.nx-1u&&cfg.outEdge==0u)||(end==0u&&i==0u&&cfg.outEdge==1u);
  if(outlet){let un=max(0.0,sign*v.x);let q=h*un;d-=vec3<f32>(q,sign*(q*un+0.5*G*h*h),q*v.y);qout+=q*cfg.dx;}else{d.y-=sign*0.5*G*h*h;}
 }
 for(var side=0u;side<2u;side++){if((side==0u&&j!=0u)||(side==1u&&j!=cfg.nz-1u)){continue;}let sign=select(-1.0,1.0,side==1u);
  let outlet=(side==0u&&cfg.outEdge==2u)||(side==1u&&cfg.outEdge==3u);
  if(outlet){let un=max(0.0,sign*v.y);let q=h*un;d-=vec3<f32>(q,q*v.x,sign*(q*un+0.5*G*h*h));qout+=q*cfg.dx;}else{d.z-=sign*0.5*G*h*h;}
 }}
 delta[c]=vec4<f32>(d/cfg.dx+source[c].xyz,qout);
}
@compute @workgroup_size(64) fn advance(@builtin(global_invocation_id) id:vec3<u32>){
 if(linearInvocation(id)>=cfg.activeCount){return;}let c=awakeCells[linearInvocation(id)];let old=state[c];result[linearInvocation(id)].water=vec4<f32>(old.xyz,0.0);result[linearInvocation(id)].stats=vec4<f32>(0.0);
 if((topology[c]&1u)==0u){return;}
 let h=old.x+cfg.dt*delta[c].x;var q=old.yz+cfg.dt*delta[c].yz;var speed=0.0;var wave=0.0;
 if(h<=cfg.dry){q=vec2<f32>(0.0);}else{let before=length(q)/h;let k=G*source[c].w*before/(h*pow(h,1.0/3.0));let damp=1.0/(1.0+cfg.dt*k);q*=damp;speed=before*damp;wave=speed+sqrt(G*h);}
 wave=max(wave,max(faceX[c].w,faceZ[c].w));
 if((topology[c]&4u)==0u){wave=max(wave,faceX[c+1u].w);}if(c+cfg.nx<cfg.count&&(topology[c+cfg.nx]&1u)!=0u){wave=max(wave,faceZ[c+cfg.nx].w);}
 result[linearInvocation(id)].water=vec4<f32>(max(0.0,h),q,wave);result[linearInvocation(id)].stats=vec4<f32>(speed,delta[c].w,0.0,0.0);
}
`;
