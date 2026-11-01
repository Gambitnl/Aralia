/** Reference for the diagnostic billow ray integration. Interpolation changes
 * at texture cell centers, so each ray piece has a cubic liquid-density curve.
 * Positive optical-event quadrature avoids assigning a whole opaque segment
 * to lighting many mean free paths inside it. This is single-source transport,
 * not an all-order multiple-scattering solution. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 23:54:51
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export const BILLOW_TRANSPORT={maximumIntervals:384,inverseIterations:24,opticalTolerance:.0005,negligibleTransmission:1e-5} as const;
export type Cubic=readonly[number,number,number,number];
export function billowCubic(samples:Cubic,length:number):Cubic{
 const [a,b,c,d]=samples,d1=b-a,d2=c-2*b+a,d3=d-3*c+3*b-a;
 return [a*length,(3*d1-1.5*d2+d3)*length,(4.5*d2-4.5*d3)*length,4.5*d3*length];
}
export function billowCumulative(c:Cubic,t:number){return t*(c[0]+t*(c[1]/2+t*(c[2]/3+t*c[3]/4)));}
/** Brackets cumulative liquid depth. The stopping criterion is optical depth,
 * not a fixed spatial tolerance that becomes inaccurate in a dense medium. */
export function billowInverse(c:Cubic,target:number,extinction:number){
 let low=0,high=1,t=.5,residual=Infinity,iterations=0;
 for(;iterations<BILLOW_TRANSPORT.inverseIterations;iterations++){
  const value=billowCumulative(c,t);residual=Math.abs(value-target)*extinction;
  const localDensity=c[0]+t*(c[1]+t*(c[2]+t*c[3]));
  if(residual<=BILLOW_TRANSPORT.opticalTolerance&&localDensity>0)break;
  if(value<target)low=t;else high=t;t=(low+high)*.5;
 }
 // Report the final bracket position, including when the iteration cap was
 // reached immediately after its last update. This matches the GPU receipt.
 residual=Math.abs(billowCumulative(c,t)-target)*extinction;
 const localDensity=c[0]+t*(c[1]+t*(c[2]+t*c[3]));
 return {t,residual,iterations,ready:residual<=BILLOW_TRANSPORT.opticalTolerance&&localDensity>0};
}
export function billowEventRule(count:2|4){return count===2?[[.21132486540518713,.5],[.7886751345948129,.5]] as const:[[.06943184420297371,.1739274225687269],[.33000947820757187,.3260725774312731],[.6699905217924281,.3260725774312731],[.9305681557970262,.1739274225687269]]as const;}
export function billowEventTarget(total:number,referenceExtinction:number,u:number){
 const tau=referenceExtinction*total,A=-Math.expm1(-tau);
 return {depth:referenceExtinction>0?-Math.log1p(-u*A)/referenceExtinction:u*total,A};
}
/** Center knots include the clamp half-cells at each boundary. This CPU
 * schedule also supports a pool plane and arbitrary ray reversal. */
export function billowRayKnots(origin:readonly number[],direction:readonly number[],min:readonly number[],spacing:readonly number[],dimensions:readonly number[],near:number,far:number,subdivisions=1,pool?:number){
 const knots=[near,far];
 for(let k=0;k<3;k++)if(direction[k]!==0)for(let i=0;i<dimensions[k];i++){const t=(min[k]+(i+.5)*spacing[k]-origin[k])/direction[k];if(t>near&&t<far)knots.push(t);}
 if(pool!==undefined&&direction[1]!==0){const t=(pool-origin[1])/direction[1];if(t>near&&t<far)knots.push(t);}
 for(let i=1;i<subdivisions;i++)knots.push(near+(far-near)*i/subdivisions);
 return knots.sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>1e-10);
}
export function billowIntegrateReference(knots:readonly number[],density:(s:number)=>number,source:(s:number,channel:number)=>number,scattering:number,extinction:readonly[number,number,number],events:2|4=2,active:(midpoint:number)=>boolean=()=>true){
 const T=[1,1,1],radiance=[0,0,0],reference=Math.max(...extinction);let maxResidual=0,ready=true,sources=0,liquid=0;
 for(let i=0;i<knots.length-1;i++){
  const start=knots[i],length=knots[i+1]-start,c=active(start+length*.5)?billowCubic([density(start),density(start+length/3),density(start+2*length/3),density(start+length)],length):[0,0,0,0] as const,total=Math.max(0,billowCumulative(c,1));liquid+=total;
  if(total>0&&scattering>0&&reference>0)for(const [u,w]of billowEventRule(events)){
   const target=billowEventTarget(total,reference,u),inverse=billowInverse(c,target.depth,reference);maxResidual=Math.max(maxResidual,inverse.residual);ready&&=inverse.ready;sources++;
   const s=start+length*inverse.t;
   for(let channel=0;channel<3;channel++)radiance[channel]+=T[channel]*target.A*scattering/reference*Math.exp((reference-extinction[channel])*target.depth)*w*source(s,channel);
  }
  for(let channel=0;channel<3;channel++)T[channel]*=Math.exp(-extinction[channel]*total);
 }
 return {T,radiance,liquid,maxResidual,ready,sources};
}
