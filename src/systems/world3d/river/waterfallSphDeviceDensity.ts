/** Experimental device-resident density solve, using the qualified integer
 * arithmetic. It owns no water and is invoked only by the explicit equation
 * check. The existing CPU audit remains the independent acceptance reference.
 * Complete timing includes the cached distances, root solve and final force
 * pass; primitive arithmetic success alone cannot qualify this implementation. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 13/10/2026, 00:40:13
 * Dependents: systems/world3d/river/waterfallSphReceiverCompute.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {sphSoftFloatWGSL} from './waterfallSphSoftFloat';

const literal=(v:number)=>{
  const b=new DataView(new ArrayBuffer(8));b.setFloat64(0,v,false);
  const hi=b.getUint32(0,false),lo=b.getUint32(4,false);
  return `Fp64(${(hi&0xfffff)|0x100000}u,${lo}u,${((hi>>>20)&2047)-1023},${hi>>>31}u)`;
};

export const sphDeviceDensityWGSL=sphSoftFloatWGSL+/* wgsl */`
struct Params { count:u32, method:u32, traceIndex:u32, axis:u32, gn:f32, gt:f32, rho0:f32, maxSupport:f32 }
struct Particle { state:vec4<f32>, properties:vec4<f32> }
@group(0) @binding(0) var<uniform> p:Params;
@group(0) @binding(1) var<storage,read> particles:array<Particle>;
@group(0) @binding(2) var<storage,read_write> density:array<vec4<f32>>;
@group(0) @binding(3) var<storage,read_write> health:array<vec4<f32>>;
@group(0) @binding(7) var<storage,read_write> distances:array<vec4<u32>>;
@group(0) @binding(8) var<storage,read_write> spatialOrder:array<vec2<u32>>;
fn one()->Fp64{return fp64_from_i32(1);}
fn two()->Fp64{return fp64_from_i32(2);}
fn half()->Fp64{return fp64_from_f32(0.5);}
fn sigma64()->Fp64{return ${literal(10/(7*Math.PI))};}
fn tolerance()->Fp64{return ${literal(1e-7)};}

// Normal-range Float32 storage is rounded with integer bits. Subnormal,
// overflow and nonfinite values reject downstream rather than silently flush.
fn stored(v:Fp64)->f32{
 if(fp64_is_zero(v)){return 0.0;}
 // Zero is a finite invalid-field sentinel; WGSL rejects constant NaN values.
 // Every stored physical density, support and alpha must pass valid() below.
 if(v.exponent < -126 || v.exponent > 127){return 0.0;}
 var mantissa=(v.mantissa_hi<<3u)|(v.mantissa_lo>>29u);
 let tail=v.mantissa_lo&0x1fffffffu;
 if(tail>0x10000000u || (tail==0x10000000u && (mantissa&1u)==1u)){mantissa++;}
 var exponent=v.exponent;
 if(mantissa==0x1000000u){mantissa>>=1u;exponent++;}
 if(exponent>127){return 0.0;}
 return bitcast<f32>((v.sign<<31u)|(u32(exponent+127)<<23u)|(mantissa&0x7fffffu));
}
fn valid(v:f32)->bool{return v>0.0 && v<3.402823e38;}
fn relative(a:Fp64,b:Fp64)->Fp64{return fp64_abs(fp64_div(fp64_sub(a,b),b));}
fn bigger(a:Fp64,b:Fp64)->Fp64{if(fp64_gt(a,b)){return a;}return b;}
fn radiusAt(i:u32,j:u32)->Fp64{
 let w=distances[i*p.count+j];return Fp64(w.x,w.y,bitcast<i32>(w.z),w.w);
}
@compute @workgroup_size(64)
fn cacheDistances(@builtin(global_invocation_id) gid:vec3<u32>){
 let k=gid.x;if(k>=p.count*p.count){return;}
 let i=k/p.count;let j=k%p.count;
 let a=particles[i].state;let b=particles[j].state;
 let dx=fp64_sub(fp64_from_f32(a.x),fp64_from_f32(b.x));
 let dy=fp64_sub(fp64_from_f32(a.y),fp64_from_f32(b.y));
 let r=fp64_sqrt(fp64_add(fp64_mul(dx,dx),fp64_mul(dy,dy)));
 distances[k]=vec4<u32>(r.mantissa_hi,r.mantissa_lo,bitcast<u32>(r.exponent),r.sign);
}
fn lowerCoordinate(x:f32)->u32{
 var lo=0u;var hi=p.count;
 while(lo<hi){let mid=lo+(hi-lo)/2u;if(bitcast<f32>(spatialOrder[mid].x)<x){lo=mid+1u;}else{hi=mid;}}
 return lo;
}
// Float32 is only a padded broad phase. Exact uploaded coordinates and
// software distances determine the actual compact support in each sum.
fn support(i:u32,h:Fp64)->vec2<u32>{
 let radius=2.0*stored(h);let x=particles[i].state[p.axis];
 let pad=0.000001*(abs(x)+radius+1.0);
 return vec2<u32>(lowerCoordinate(x-radius-pad),lowerCoordinate(x+radius+pad));
}
fn shape(q:Fp64)->Fp64{
 if(fp64_ge(q,two())){return fp64_zero();}
 if(fp64_lt(q,one())){
  let sq=fp64_mul(q,q);
  return fp64_add(fp64_sub(one(),fp64_mul(fp64_from_f32(1.5),sq)),fp64_mul(fp64_from_f32(0.75),fp64_mul(sq,q)));
 }
 let t=fp64_sub(two(),q);return fp64_mul(fp64_from_f32(0.25),fp64_mul(fp64_mul(t,t),t));
}
fn sumAt(i:u32,h:Fp64)->Fp64{
 var sum=fp64_zero();let range=support(i,h);
 for(var k=range.x;k<range.y;k++){
  let j=spatialOrder[k].y;let q=fp64_div(radiusAt(i,j),h);
  let m=fp64_from_f32(particles[j].properties.x);
  sum=fp64_add(sum,fp64_mul(fp64_mul(m,sigma64()),shape(q)));
 }
 return sum;
}
fn alphaAt(i:u32,h:Fp64)->Fp64{
 var sum=fp64_zero();let range=support(i,h);
 for(var k=range.x;k<range.y;k++){
  let j=spatialOrder[k].y;let q=fp64_div(radiusAt(i,j),h);if(fp64_ge(q,two())){continue;}
  var derivative=fp64_zero();
  if(fp64_lt(q,one())){derivative=fp64_sub(fp64_mul(fp64_from_i32(3),q),fp64_mul(fp64_from_f32(2.25),fp64_mul(q,q)));}
  else{let t=fp64_sub(two(),q);derivative=fp64_mul(fp64_from_f32(0.75),fp64_mul(t,t));}
  let m=fp64_from_f32(particles[j].properties.x);
  sum=fp64_add(sum,fp64_mul(fp64_mul(m,sigma64()),fp64_mul(q,derivative)));
 }
 return fp64_div(sum,fp64_mul(h,h));
}
@compute @workgroup_size(32)
fn solveDeviceDensity(@builtin(global_invocation_id) gid:vec3<u32>){
 let i=gid.x;if(i>=p.count){return;}
 let a=particles[i];let hint=density[i].y;
 density[i]=vec4<f32>(0.0);health[i]=vec4<f32>(0.0);
 if(2.0*a.properties.z>p.maxSupport){health[i].y=1.0;return;}
 if(a.properties.w==0.0){density[i]=vec4<f32>(p.rho0,a.properties.z,2.0*p.rho0,0.0);return;}
 let h0=fp64_from_f32(a.properties.z);let rho0=fp64_from_f32(p.rho0);
 let requiredMass=fp64_mul(fp64_mul(rho0,h0),h0);
 var coincident=fp64_zero();var total=fp64_zero();
 for(var j=0u;j<p.count;j++){
  let term=fp64_mul(fp64_from_f32(particles[j].properties.x),sigma64());total=fp64_add(total,term);
  if(all(a.state.xy==particles[j].state.xy)){coincident=fp64_add(coincident,term);}
 }
 if(!fp64_gt(requiredMass,coincident)||!fp64_lt(requiredMass,total)){health[i].y=6.0;return;}
 let cap=fp64_mul(half(),fp64_from_f32(p.maxSupport));
 var lo=fp64_zero();var hi=cap;
 // The fast shader offers a hint, never an acceptance certificate. A local
 // bracket is used only after independently evaluating both of its signs.
 if(valid(hint)&&hint<p.maxSupport*0.5){
  let h=fp64_from_f32(hint);let l=fp64_mul(h,${literal(.999)});let u=fp64_mul(h,${literal(1.001)});
  if(fp64_le(u,cap)&&fp64_lt(sumAt(i,l),requiredMass)&&fp64_gt(sumAt(i,u),requiredMass)){lo=l;hi=u;}
 }
 if(fp64_lt(sumAt(i,hi),requiredMass)){health[i].y=1.0;return;}
 var iterations=0u;
 for(var step=0u;step<64u;step++){
  iterations=step+1u;let mid=fp64_mul(fp64_add(lo,hi),half());
  if(fp64_eq(mid,lo)||fp64_eq(mid,hi)){break;}
  if(fp64_lt(sumAt(i,mid),requiredMass)){lo=mid;}else{hi=mid;}
  if(fp64_lt(relative(hi,lo),${literal(1e-10)})){break;}
 }
 let root=fp64_mul(fp64_add(lo,hi),half());let centerH=stored(root);
 let centerRho=stored(fp64_div(requiredMass,fp64_mul(root,root)));
 if(!valid(centerH)||!valid(centerRho)){health[i].y=2.0;return;}
 var best=${literal(1e30)};var bestH=0.0;var bestRho=0.0;
 for(var dh=-1;dh<=1;dh++){
  let h=bitcast<f32>(u32(i32(bitcast<u32>(centerH))+dh));let h64=fp64_from_f32(h);
  if(!valid(h)||fp64_gt(h64,cap)){continue;}
  let gathered=fp64_div(sumAt(i,h64),fp64_mul(h64,h64));
  for(var dr=-1;dr<=1;dr++){
   let rho=bitcast<f32>(u32(i32(bitcast<u32>(centerRho))+dr));if(!valid(rho)){continue;}
   let r64=fp64_from_f32(rho);let implied=fp64_mul(h0,fp64_sqrt(fp64_div(rho0,r64)));
   let score=bigger(relative(gathered,r64),relative(h64,implied));
   if(fp64_lt(score,best)){best=score;bestH=h;bestRho=rho;}
  }
 }
 if(fp64_gt(best,tolerance())){health[i]=vec4<f32>(f32(iterations),5.0,2.0*bestH,stored(best));return;}
 let h=fp64_from_f32(bestH);let low=fp64_mul(h,${literal(1-1e-5)});
 var high=fp64_mul(h,${literal(1+1e-5)});if(fp64_gt(high,cap)){high=cap;}
 let lowerMass=sumAt(i,low);let upperMass=sumAt(i,high);
 // Same empirical forward-support guard as the independent CPU audit.
 // Near-flat roots must have resolvable signs, not merely a small residual.
 let margin=fp64_mul(fp64_mul(${literal(32*Number.EPSILON)},fp64_from_i32(i32(p.count))),bigger(requiredMass,bigger(lowerMass,upperMass)));
 if(!fp64_lt(fp64_add(lowerMass,margin),requiredMass)||!fp64_gt(fp64_sub(upperMass,margin),requiredMass)){health[i].y=7.0;return;}
 let alpha=alphaAt(i,h);let packedAlpha=stored(alpha);
 if(!valid(packedAlpha)||fp64_gt(relative(fp64_from_f32(packedAlpha),alpha),tolerance())){health[i].y=4.0;return;}
 density[i]=vec4<f32>(bestRho,bestH,packedAlpha,stored(best));health[i]=vec4<f32>(f32(iterations),0.0,2.0*bestH,stored(best));
}
`;
