/**
 * Shapes finite rock ledges in the connected Sisters cliff, in meters.
 * Both the native worker bed and visible terrain call this through the
 * reconstruction profile. These are authored ledges from the reference's
 * broken sheets, with measured scan relief between them, not survey data.
 * This height field still cannot describe a recessed underside or free fall.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 17/10/2026, 05:21:18
 * Dependents: components/World3D/water/riverSistersCliffSurface.ts, systems/world3d/river/riverRapidsReconstruction.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import scan from '../../../components/World3D/water/riverCliffScanRelief.json';

const unit=(v:number)=>Math.max(0,Math.min(1,v));
const mirror=(v:number)=>{const t=((v%2)+2)%2;return t>1?2-t:t;};

// Reuse the same retained outcrop data and bilinear reading as the original
// native cliff. Local subtraction removes its large leaning silhouette, so
// tiling the small fracture detail does not repeat an entire mountain.
function sample(u:number,v:number):number {
  const x=unit(u)*(scan.size-1),y=unit(v)*(scan.size-1);
  const i=Math.min(scan.size-2,Math.floor(x)),j=Math.min(scan.size-2,Math.floor(y));
  const a=x-i,b=y-j,k=j*scan.size+i,d=scan.millimeters;
  return ((d[k]*(1-a)+d[k+1]*a)*(1-b)+(d[k+scan.size]*(1-a)+d[k+scan.size+1]*a)*b)/1000;
}

// Each entry is one finite oblique sheet: lateral/height center, half spans,
// cross-slope and exposed height. Unequal ends and tilts avoid repeated
// horizontal stairs or full-height fluting between the water channels.
const ledges=[
  [-72,211,18,27,.22,9],[-34,225,23,18,-.28,6],
  [16,216,27,23,.15,12],[65,205,21,34,-.19,8],
  [-57,160,25,24,-.25,13],[-8,170,22,31,.31,8],
  [43,155,26,20,-.16,11],[-78,108,17,32,.18,7],
  [-30,99,26,27,-.22,10],[18,111,21,23,.27,13],
  [68,91,19,29,-.31,8],[-58,48,27,19,.20,8],
  [-3,43,25,23,-.15,9],[49,39,28,18,.24,6],
] as const;

/** Returns shared terrain height relief, never rendered-only displacement.
 * Callers taper this at the cliff rim, toe and wet channels. Finite bevels
 * connect inclined flat tops to the parent rock without an open seam. */
export function reconstructionRockRelief(lateral:number,height:number):number {
  if(!Number.isFinite(lateral)||!Number.isFinite(height))throw RangeError('Nonfinite cliff coordinate');
  const measured=reconstructionRockGrainRelief(lateral,height);
  let ledge=0;
  for(const [n,h,w,t,slant,rise] of ledges){
    const dn=lateral-n,dh=height-h-dn*slant;
    const edge=Math.min(w-Math.abs(dn+dh*.12),t-Math.abs(dh));
    ledge=Math.max(ledge,rise*unit(edge/2.4)*(1+.08*dn/w-.10*dh/t));
  }
  return ledge+measured;
}

/** Measured small fractures without the older broad rectangular ledges. */
export function reconstructionRockGrainRelief(lateral:number,height:number):number {
  if(!Number.isFinite(lateral)||!Number.isFinite(height))throw RangeError('Nonfinite cliff coordinate');
  const u=.16+.68*mirror((lateral+height*.055+84)/7.6);
  const v=.16+.68*mirror((height-lateral*.12+23)/18.5),r=.105;
  const broad=(sample(u-r,v)+sample(u+r,v)+sample(u,v-r)+sample(u,v+r))*.25;
  return (sample(u,v)-broad)*1.7;
}

// The reference wall has long steep planes separated by short projecting
// shelves, followed by a broader broken foot. These are authored section
// proportions from the inspected full-face photograph, not a survey. Each
// pair is forward distance / fraction of the total drop in its local frame.
// Positive interval widths keep the face a single-valued native land surface.
const wallSections=[
  [0,0],[.025,.14],[.08,.34],[.18,.56],
  [.34,.73],[.59,.88],[1,1],
] as const;
// The reference has unequal projecting rock masses, rather than one flat
// panel with small cracks. These positive interval-width factors give its
// left broken foot and right middle buttress different finite sections.
// Their scale is authored from the reference photograph, not surveyed depth.
// Each mass ends inside the face, so the existing perimeter section remains.
const referenceMasses = [
  {center:-42,span:36,widths:[.8,.5,1.6,2.7,.6,.8]},
  {center:26,span:38,widths:[1.8,.35,.5,2.6,.55,1.1]},
  {center:65,span:17,widths:[.7,1.3,2.4,.4,1.6,.8]},
] as const;
const tent=(n:number,center:number,span:number)=>Math.max(0,1-Math.abs(n-center)/span);
const faceColumns=Array.from({length:205},(_,i)=>{
  const n=i-102;
  // Broad unequal rock masses displace the shelf edges. Averaging over a
  // finite lateral span avoids turning scan cracks into full-height fins.
  const widths=wallSections.slice(1).map((b,k)=>{
    const a=wallSections[k],height=250*(1-(a[1]+b[1])*.5);
    let rock=0;for(const offset of [-6,-3,0,3,6])rock+=reconstructionRockGrainRelief(n+offset,height)/5;
    let factor=1;
    for(const mass of referenceMasses)factor*=1+(mass.widths[k]-1)*tent(n,mass.center,mass.span);
    // Every factor stays positive. Normalizing these interval widths keeps
    // forward/drop inverse queries monotone without clipping a rock face.
    return (b[0]-a[0])*(1+.035*rock)*factor;
  });
  const total=widths.reduce((a,b)=>a+b,0),forward=[0];
  for(const width of widths)forward.push(forward.at(-1)!+width/total);
  forward[forward.length-1]=1;
  const rake=.012*tent(n,-56,44)-.016*tent(n,8,46)+.009*tent(n,68,31);
  const drop=wallSections.map((p,k)=>p[1]+rake*Math.sin(Math.PI*p[1])*(k<2?.2:1));
  return {forward,drop};
});

/** Shared section for the actual finite face and its adjoining terrain.
 * The inspected photograph has a steep upper wall and broader broken foot.
 * Forward and downward queries use the SAME authored section, so changing
 * the native face cannot leave a different terraced wall behind its edges.
 * Proportions are visual reconstruction choices, not survey measurements.
 */
function sistersSection(t:number,lateral:number,inverse:boolean):number {
  if(!Number.isFinite(t)||!Number.isFinite(lateral))throw RangeError('Nonfinite Sisters frame coordinate');
  if(t<=0)return 0;if(t>=1)return 1;
  const x=Math.max(0,Math.min(204,lateral+102)),i=Math.min(203,Math.floor(x)),a=x-i;
  const left=faceColumns[i],right=faceColumns[i+1];
  const at=(values:'forward'|'drop',k:number)=>left[values][k]+(right[values][k]-left[values][k])*a;
  const input=inverse?'drop':'forward',output=inverse?'forward':'drop';
  let k=1;while(k<wallSections.length-1&&at(input,k)<t)k++;
  const start=at(input,k-1),u=(t-start)/(at(input,k)-start);
  return at(output,k-1)+(at(output,k)-at(output,k-1))*u;
}

export function reconstructionSistersFace(forward:number,lateral:number):number {
  return sistersSection(forward,lateral,false);
}
export function reconstructionSistersForward(drop:number,lateral:number):number {
  return sistersSection(drop,lateral,true);
}

/** Finite oblique joints read from the reference's unequal rock sheets.
 * These shallow recesses end inside the face; they are not attached boxes
 * or full-height slots. Their depth is authored, with scan grain between.
 */
export function reconstructionSistersRelief(lateral:number,drop:number):number {
  let recess=0;
  for(const [an,ah,bn,bh,width,depth] of [
    [-78,.20,-41,.63,1.1,.38],[-20,.12,-10,.48,.8,.28],
    [20,.28,50,.73,1.0,.34],[68,.60,77,.89,.9,.30],
  ]){
    const dn=bn-an,dh=(bh-ah)*250,along=((lateral-an)*dn+(drop-ah)*250*dh)/(dn*dn+dh*dh);
    if(along<=0||along>=1)continue;
    const across=Math.abs((lateral-an)*dh-(drop-ah)*250*dn)/Math.hypot(dn,dh);
    recess=Math.max(recess,depth*unit(1-across/width)*Math.sin(Math.PI*along));
  }
  return .22*reconstructionRockGrainRelief(lateral,250*(1-drop))-recess;
}
