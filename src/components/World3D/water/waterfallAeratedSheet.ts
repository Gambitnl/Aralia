/** Connected secondary-water sections for the optional material-sheet proof.
 * Emission labels carry irregular outward billows through the fall. The air
 * envelope is prescribed, while its liquid is deducted from the clear core.
 * This is a meshed fog approximation, not solved bubble formation or CFD. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 22:09:13
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { materialSheetSection } from './waterfallMaterialSheet';
export const AERATED_SHEET={rows:257,ring:64} as const;
const hash=(n:number)=>{const x=Math.sin(n*127.1+53.7)*43758.5453;return x-Math.floor(x);};
function signal(e:number,scale:number,seed:number){const x=e/scale,n=Math.floor(x),f=x-n,s=f*f*(3-2*f);return (2*hash(n+seed)-1)*(1-s)+(2*hash(n+1+seed)-1)*s;}
/** Approaching neighboring deformation velocities provide a formation proxy.
 * Uniform gravity and rigid motion are absent from this relative measure.
 * The coefficient is prescribed and uncalibrated; no transfer solver is claimed. */
export function aeratedFraction(age:number,emission:number,width:number):number{
 let exposure=0;const de=.018,dt=.018;
 for(const birth of [.35,.75,1.25]){
  if(age<=birth)continue;
  const velocity=(e:number)=>{const a=materialSheetSection(1,width,birth-dt,e,9),b=materialSheetSection(1,width,birth+dt,e,9);return (b.center[4]-a.center[4])/(2*dt);};
  const approach=Math.max(0,-(velocity(emission+de)-velocity(emission-de))/(2*de));
  exposure+=approach*(1-Math.exp(-Math.pow((age-birth)/.3,2)))*.22;
 }
 return .85*(1-Math.exp(-exposure));
}
export function aeratedSection(liquidArea:number,width:number,age:number,emission:number,ring:number=AERATED_SHEET.ring){
 if(![liquidArea,width,age,emission].every(Number.isFinite)||liquidArea<0||width<=0||age<0||ring<8||!Number.isInteger(ring))throw Error('Invalid aerated section');
 const develop=1-Math.exp(-age*age),across=new Float64Array(ring),normal=new Float64Array(ring);
 const radiusA=width*.5*(1+.10*develop*signal(emission,.19,29));
 let radiusB=develop*(.38+Math.min(1.35,width*.13));
 const fill=(scale:number)=>{for(let k=0;k<ring;k++){const theta=2*Math.PI*k/ring,u=Math.cos(theta),v=Math.sin(theta);
   // Across-dependent emission phase makes oblique lobes, not synchronized
   // circular beads. Both coarse and fine features travel with source labels.
   const label=emission+u*.10;
   const bulge=1+develop*(.25*signal(label,.085,11)+.18*signal(label,.23,57)+.10*signal(label+v*.05,.038,103));
   across[k]=radiusA*u*(1+.08*develop*signal(label,.12,7));normal[k]=radiusB*v*bulge*scale+develop*.24*signal(label,.14,83);
 }};
 fill(1);const area=()=>{let a=0;for(let k=0;k<ring;k++){const next=(k+1)%ring;a+=across[k]*normal[next]-across[next]*normal[k];}return Math.abs(a)*.5;};
 let measuredArea=area();if(liquidArea>measuredArea&&measuredArea>0){radiusB*=liquidArea/measuredArea;fill(1);measuredArea=area();}
 return {across,normal,area:measuredArea,fraction:measuredArea>0?liquidArea/measuredArea:0,liquidArea,radiusB};
}
/** Front entry through a local rounded fog lobe, with bounded unit-albedo
 * Lambert reflection. This budget is local; it does not solve self-shadowing. */
export function aeratedOpticalBudget(tau:number,albedo:number){const transmission=Math.exp(-Math.max(0,tau));const reflection=(1-transmission)*Math.max(0,Math.min(1,albedo));return {transmission,reflection,absorption:1-transmission-reflection};}

/** Sample the full deformation profile once per emission label. Neighboring
 * columns may form at different times; no center-column value controls the
 * entire fog ring. Nine source columns bound cost and interpolate smoothly. */
export function aeratedTransfer(age:number,emission:number,width:number):Float64Array{
 const count=9,exposure=new Float64Array(count),de=.018,dt=.018;
 for(const birth of [.35,.75,1.25]){
  if(age<=birth)continue;
  const mm=materialSheetSection(1,width,birth-dt,emission-de,count),mp=materialSheetSection(1,width,birth+dt,emission-de,count);
  const pm=materialSheetSection(1,width,birth-dt,emission+de,count),pp=materialSheetSection(1,width,birth+dt,emission+de,count);
  const development=(1-Math.exp(-Math.pow((age-birth)/.3,2)))*.22;
  for(let k=0;k<count;k++){
   const before=(mp.center[k]-mm.center[k])/(2*dt),after=(pp.center[k]-pm.center[k])/(2*dt);
   exposure[k]+=Math.max(0,-(after-before)/(2*de))*development;
  }
 }
 for(let k=0;k<count;k++)exposure[k]=.85*(1-Math.exp(-exposure[k]));return exposure;
}
export function aeratedTransferAt(values:Float64Array,u:number):number{
 const x=Math.max(0,Math.min(1,u))*(values.length-1),lo=Math.min(values.length-2,Math.floor(x)),f=x-lo;return values[lo]*(1-f)+values[lo+1]*f;
}
/** Deduct the actual local liquid columns from the coherent core. The sum
 * of clear and transferred section area equals the original section. */
export function aeratedDebit(section:ReturnType<typeof materialSheetSection>,transfer:Float64Array){
 const removed=new Float64Array(section.thickness.length);let coreArea=0,removedArea=0;
 for(let k=0;k<removed.length;k++){removed[k]=section.thickness[k]*aeratedTransferAt(transfer,k/(removed.length-1));section.thickness[k]-=removed[k];
  if(k){const dx=section.across[k]-section.across[k-1];coreArea+=(section.thickness[k]+section.thickness[k-1])*.5*dx;removedArea+=(removed[k]+removed[k-1])*.5*dx;}}
 section.measuredArea=coreArea;return {removed,coreArea,removedArea};
}
/** Compact deposition assigns each fog node a neighboring material interval.
 * Polygon basis areas integrate the interpolated nonuniform phi exactly in
 * this section. It is a section budget, not an intersecting-ring union volume.
 * There is no density floor: a zero local transfer stays exactly zero. */
export function aeratedLocalSection(section:ReturnType<typeof materialSheetSection>,removed:Float64Array,transfer:Float64Array,normalScale:number,width:number,age:number,emission:number){
 const fog=aeratedSection(0,width,age,emission),ring=fog.across.length,half=ring/2,count=half+1;
 const budgets=new Float64Array(count),weights=new Float64Array(count),phi=new Float64Array(ring),localTransfer=new Float64Array(ring),u=new Float64Array(count);
 const upper=(i:number)=>half-i,lower=(i:number)=>(ring-upper(i))%ring;
 for(let i=0;i<count;i++)u[i]=(1+Math.cos(2*Math.PI*upper(i)/ring))*.5;
 // Source columns retain their actual across derivative and local debit.
 for(let i=0;i<count;i++){
  const low=i? .5*(u[i-1]+u[i]):0,high=i<half?.5*(u[i]+u[i+1]):1;
  for(let k=0;k<removed.length-1;k++){
   const a=k/(removed.length-1),b=(k+1)/(removed.length-1),lo=Math.max(a,low),hi=Math.min(b,high);if(hi<=lo)continue;
   const fa=(lo-a)/(b-a),fb=(hi-a)/(b-a),ta=removed[k]*(1-fa)+removed[k+1]*fa,tb=removed[k]*(1-fb)+removed[k+1]*fb;
   budgets[i]+=(ta+tb)*.5*(hi-lo)/(b-a)*(section.across[k+1]-section.across[k])*normalScale;
  }
 }
 for(let i=0;i<half;i++){
  const dx=fog.across[upper(i+1)]-fog.across[upper(i)],h0=fog.normal[upper(i)]-fog.normal[lower(i)],h1=fog.normal[upper(i+1)]-fog.normal[lower(i+1)];
  weights[i]+=dx*(h0/3+h1/6);weights[i+1]+=dx*(h1/3+h0/6);
 }
 let maxPhi=0,liquidArea=0;for(let i=0;i<count;i++){const density=weights[i]>0?budgets[i]/weights[i]:0;phi[upper(i)]=phi[lower(i)]=density;maxPhi=Math.max(maxPhi,density);liquidArea+=budgets[i];localTransfer[upper(i)]=localTransfer[lower(i)]=aeratedTransferAt(transfer,u[i]);}
 // Capacity redistribution changes only represented air depth, continuously;
 // it does not multiply emitted liquid or invent occupied density.
 if(maxPhi>1){for(let k=0;k<ring;k++){fog.normal[k]*=maxPhi;phi[k]/=maxPhi;}fog.radiusB*=maxPhi;fog.area*=maxPhi;for(let i=0;i<count;i++)weights[i]*=maxPhi;}
 let accountedArea=0;for(let i=0;i<count;i++)accountedArea+=weights[i]*phi[upper(i)];
 return {...fog,phi,transfer:localTransfer,liquidArea,accountedArea,maximumFraction:Math.min(1,maxPhi)};
}
