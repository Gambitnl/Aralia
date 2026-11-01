/** Numerical reference for the optional waterfall solar-source diagnostic.
 * Each camera segment retains its full extinction and scattering albedo.
 * Its removed scattering energy samples incoming light at that segment's
 * conditional first event. This replaces the one-winner source approximation;
 * it does not solve multiple scattering or change the liquid distribution. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 20:03:40
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

export type SegmentLightRGB=readonly[number,number,number];
export interface SingleScatterSegment { length:number; sigmaS:number; sigmaA:SegmentLightRGB }
export const SEGMENT_EVENT_THIN_TAU=.01;
/** Stable mean of a truncated exponential in meters. The thin limit is the
 * midpoint; the opaque limit approaches one extinction mean free path. */
export function segmentConditionalEventMean(extinction:number,length:number):number {
 if(!Number.isFinite(extinction)||extinction<0||!Number.isFinite(length)||length<0)throw new Error('Segment coefficients and length must be finite and nonnegative');
 const tau=extinction*length;
 const mean=tau<SEGMENT_EVENT_THIN_TAU?length*(.5-tau/12+tau*tau*tau/720):1/extinction-length*Math.exp(-tau)/(-Math.expm1(-tau));
 return Math.max(0,Math.min(length,mean));
}
/** Incoming source is radiance per channel, already including sunlight's
 * phase and light-path transmission. The RGB contribution contains sigma_s
 * exactly once; adding it again would invent energy. Constant source is exact
 * for each homogeneous segment; varying source is a conditional-mean rule. */
export function integrateSegmentSingleScatter(segments:readonly SingleScatterSegment[],source:(position:number,channel:0|1|2)=>number,sourcePosition:'conditional'|'midpoint'='conditional') {
 if(sourcePosition!=='conditional'&&sourcePosition!=='midpoint')throw new Error('Unknown source position');
 const transmission:[number,number,number]=[1,1,1],weight:[number,number,number]=[0,0,0],scattered:[number,number,number]=[0,0,0];
 const events:[number,number,number][]=[];let start=0;
 for(const s of segments){
  if(!Number.isFinite(s.sigmaS)||s.sigmaS<0)throw new Error('Scattering coefficient must be finite and nonnegative');
  const points:[number,number,number]=[0,0,0];
  for(const c of [0,1,2] as const){
   if(!Number.isFinite(s.sigmaA[c])||s.sigmaA[c]<0)throw new Error('Absorption coefficient must be finite and nonnegative');
   const sigma=s.sigmaS+s.sigmaA[c],mean=segmentConditionalEventMean(sigma,s.length),tau=sigma*s.length;
   const contribution=sigma>0?transmission[c]*(-Math.expm1(-tau))*s.sigmaS/sigma:0;
   points[c]=start+mean;
   if(contribution>0){const J=source(sourcePosition==='midpoint'?start+s.length*.5:points[c],c);if(!Number.isFinite(J)||J<0)throw new Error('Incoming radiance must be finite and nonnegative');scattered[c]+=contribution*J;}
   weight[c]+=contribution;transmission[c]*=Math.exp(-tau);
  }
  events.push(points);start+=s.length;
 }
 return {transmission,weight,scattered,events};
}

/** Reference for raw per-channel GPU attribution, not a physical validity
 * test. The camera midpoint still determines extinction and weight. Always
 * measure raw conditional events; the midpoint control affects only effective
 * source points. Global statistics divide summed numerators by summed weight. */
export function measureSegmentEventDensity(segments:readonly SingleScatterSegment[],density:(position:number)=>{rho:number;sigmaS:number;inside:boolean},sourcePosition:'conditional'|'midpoint'='conditional'){
 if(sourcePosition!=='conditional'&&sourcePosition!=='midpoint')throw new Error('Unknown source position');
 const ends:number[]=[];let total=0;for(const s of segments){total+=s.length;ends.push(total);}
 const sample=(x:number)=>{const r=density(x);if(!Number.isFinite(r.rho)||r.rho<0||!Number.isFinite(r.sigmaS)||r.sigmaS<0)throw new Error('Density samples must be finite and nonnegative');return r;};
 const values=(x:number)=>{const index=ends.findIndex(end=>x<=end);const start=index===0?0:ends[index-1];const mid=start+segments[index].length*.5;
  const midpoint=sample(mid),raw=sample(x),effective=sample(sourcePosition==='midpoint'||!raw.inside?mid:x);
  const ratio=raw.rho/Math.max(midpoint.rho,1e-12),sigmaRatio=raw.sigmaS/Math.max(segments[index].sigmaS,1e-12);
  return [ratio<=.01?1:0,Math.min(1,ratio),raw.inside?0:1,raw.rho===0?1:0,ratio<=.1?1:0,effective.rho/Math.max(midpoint.rho,1e-12)<=.01?1:0,Math.min(1,sigmaRatio)];};
 const numerators=Array.from({length:7},(_,i)=>integrateSegmentSingleScatter(segments,x=>values(x)[i]).scattered);
 const weight=integrateSegmentSingleScatter(segments,()=>0).weight;
 return {nearEmpty:numerators[0],densityRatio:numerators[1],fallback:numerators[2],zero:numerators[3],lowDensity:numerators[4],effectiveNearEmpty:numerators[5],scatteringRatio:numerators[6],weight};
}

/** Reference for the sky-path phase diagnostic. The offset only moves the
 * sampling point within each equal-length cell; it changes neither cell weight
 * nor the full-extinction beam law. This fixed quadrature can miss thin layers. */
export function segmentLightPathTransmission(length:number,samples:number,offset:.25|.5|.75,extinction:(position:number)=>SegmentLightRGB):SegmentLightRGB {
 if(!Number.isFinite(length)||length<0||!Number.isSafeInteger(samples)||samples<1||![.25,.5,.75].includes(offset))throw new Error('Invalid light quadrature controls');
 const ds=length/samples,depth:[number,number,number]=[0,0,0];
 for(let i=0;i<samples;i++){const sigma=extinction((i+offset)*ds);for(const c of [0,1,2]as const){if(!Number.isFinite(sigma[c])||sigma[c]<0)throw new Error('Extinction must be finite and nonnegative');depth[c]+=sigma[c]*ds;}}
 return [Math.exp(-depth[0]),Math.exp(-depth[1]),Math.exp(-depth[2])];
}
