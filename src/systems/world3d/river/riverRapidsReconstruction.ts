/**
 * The complete reference-fall course in physical meters, built with the
 * existing RiverCourse rather than a second curve engine.
 *
 * The explicit riverCourse=references candidate installs this entire domain
 * through the native worker and shared terrain. It supplies no water itself;
 * all downstream water must traverse from the original source. Heights come from
 * the reference research; runs, widths and placement are provisional authored
 * dimensions. In particular Stigfossen's180/320m descriptions remain unresolved.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 17/10/2026, 05:21:18
 * Dependents: components/World3D/water/riverReachScene.ts, components/World3D/water/riverSistersCliffSurface.ts, components/World3D/water/waterfallTerrainComparisonView.ts, systems/world3d/river/riverHeadwaters.ts, systems/world3d/river/riverLive.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { RiverCourse, type CourseSample, type RiverGridSpec } from './riverReach';
import { HEADWATERS_GRID, MAIN_CHANNEL_S } from './riverHeadwaters';
import type { NorwayTerrainComparisonId } from './waterfallTerrainProfiles';
import {reconstructionRockRelief,reconstructionSistersFace} from './riverReconstructionRock';

interface ReferencePlacement {
  readonly id: NorwayTerrainComparisonId;
  readonly dropM: number;
  readonly runM: number;
  readonly halfWidthM: number;
  readonly rapidsAfterM: number;
  readonly dimensions: 'published working height; authored footprint' | 'unresolved height; reserved footprint';
}

// These are real-scale reservations, not the old common60m diagnostic rig.
// Separate collection/rapids reaches give each fall its own landform while
// keeping one serial course. Seven Sisters divides/rejoins inside one stage.
const references: readonly ReferencePlacement[] = [
  {id:'storfossen',dropM:36,runM:55,halfWidthM:18,rapidsAfterM:45,dimensions:'unresolved height; reserved footprint'},
  {id:'seven-sisters',dropM:250,runM:45,halfWidthM:90,rapidsAfterM:70,dimensions:'published working height; authored footprint'},
  {id:'steinsdalsfossen',dropM:50,runM:18,halfWidthM:22,rapidsAfterM:50,dimensions:'published working height; authored footprint'},
  {id:'latefossen',dropM:165,runM:150,halfWidthM:70,rapidsAfterM:75,dimensions:'published working height; authored footprint'},
  {id:'tvindefossen',dropM:110,runM:100,halfWidthM:40,rapidsAfterM:60,dimensions:'published working height; authored footprint'},
  {id:'stigfossen',dropM:320,runM:220,halfWidthM:30,rapidsAfterM:85,dimensions:'unresolved height; reserved footprint'},
  {id:'langfossen',dropM:612,runM:700,halfWidthM:60,rapidsAfterM:100,dimensions:'published working height; authored footprint'},
];

// Leave room for the rapids to diverge before the first tall reference.
// The old220m Sisters crest sat beside the protected quiet river and its
// broad shoulders formed a narrow250m side wall. Extra connecting rapids
// and the northward course below give both valleys their own actual land.
let station=240,lowering=0;
export const RECONSTRUCTION_FALLS=Object.freeze(references.map(reference=>{
  const result=Object.freeze({...reference,startM:station,endM:station+reference.runM,
    crestLoweringM:lowering,toeLoweringM:lowering+reference.dropM});
  station=result.endM+reference.rapidsAfterM;lowering=result.toeLoweringM;
  return result;
}));
export const RECONSTRUCTION_END_M=station;

const unit=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=unit(v);return t*t*(3-2*t);};

/** The inspected twin fall wraps around a substantial piece of mountain.
 * Interpolated rock edges and broad inclined tops replace a Gaussian ridge,
 * which produced a smooth pinched fin. These authored dimensions describe
 * shared bedrock, not an extra object or a surveyed reconstruction. */
function latefossenDivide(t:number,n:number,baseFraction:number,chuteRelief:number):{relief:number;soilTop:boolean} {
  const edges=[ [.15,-2,3], [.28,-27,21], [.50,-31,28], [.72,-23,25], [.89,-7,12], [.97,-1,2] ];
  if(t<=edges[0][0]||t>=edges[edges.length-1][0])return {relief:chuteRelief,soilTop:false};
  let k=1;while(t>edges[k][0])k++;
  const a=edges[k-1],b=edges[k],u=(t-a[0])/(b[0]-a[0]);
  const left=a[1]+(b[1]-a[1])*u,right=a[2]+(b[2]-a[2])*u;
  const edge=Math.min(n-left,right-n,(t-.15)*150,(.97-t)*150);
  if(edge<=0)return {relief:chuteRelief,soilTop:false};
  // The mountain top descends more gently than the chutes on either side.
  // Two oblique bedding breaks interrupt its broad top; the lower nose ends
  // in the common receiving reach instead of leaving a needle above the toe.
  const top=.04+.32*unit((t-.16)/.8)+.018*smooth((t-.47+n*.0008)/.025)+.025*smooth((t-.73-n*.0005)/.035);
  const plane=165*(baseFraction-top)+n*.06;
  const nose=1-smooth((t-.80)/.16);
  return {relief:chuteRelief+Math.max(0,plane-chuteRelief)*smooth(edge/3)*nose,
    soilTop:edge>4&&nose>.65&&plane>chuteRelief+3};
}

/** Unequal rock channels read from the reference silhouette. Their widths,
 * lip offsets and bends are authored, not surveyed. All seven fan out from
 * the same arriving river and collect below; these records create no water.
 * The height field still cannot represent detached water or overhangs. */
const sistersChannels = [
  {n:-74,width:1.2,bend:4,lip:.10,contact:.91},
  {n:-53,width:2.7,bend:-2.5,lip:.18,contact:.86},
  {n:-31,width:1.4,bend:3,lip:.12,contact:.94},
  {n:-5,width:2.2,bend:-1,lip:.07,contact:.90},
  {n:17,width:1.6,bend:-4,lip:.16,contact:.84},
  {n:40,width:2.5,bend:2.5,lip:.11,contact:.92},
  {n:69,width:1.1,bend:-3,lip:.22,contact:.89},
] as const;

function sistersChannelCenter(t:number,index:number):number {
  const c=sistersChannels[index];return c.n+c.bend*Math.sin(Math.PI*unit(t));
}

/** Earlier smooth-wall study retained for comparison and unfinished intent.
 * The active finite Sisters surface uses its own stored native triangles.
 * A continuous fractured face replaces the identical straight cliff lips.
 * Broad interpolation across neighboring rock masses prevents thin fins at
 * channel boundaries. Endpoint lowering remains the common crest and toe. */
function sistersFaceFraction(t:number,n:number):number {
  let k=1;while(k<sistersChannels.length-1&&n>sistersChannels[k].n)k++;
  const a=sistersChannels[k-1],b=sistersChannels[k],across=smooth((n-a.n)/(b.n-a.n));
  const lip=a.lip+(b.lip-a.lip)*across,contact=a.contact+(b.contact-a.contact)*across;
  const face=unit((t-lip)/(contact-lip));
  // Two unequal bedding breaks interrupt the face. Their planes dip across
  // the cliff rather than repeating the same horizontal stair at each ribbon.
  const upper=.28+.045*Math.sin(n*.031),lower=.66+.035*Math.sin(n*.043+.8);
  // The primary rock planes are straight in section, not rounded spillway
  // shoulders. Narrow worn bedding breaks connect their different planes.
  return .82*face+.11*smooth((face-upper)/.055)+.07*smooth((face-lower)/.075);
}

/** Surrounding mountains descend over longer shoulders than the wet cliff.
 * Beyond the channel this avoids repeating every sharp water step across an
 * entire rectangular landscape. The actual reference-height bed stays intact. */
export function reconstructionLandscapeLowering(distanceM:number):number {
  let lowering=0;
  for(const f of RECONSTRUCTION_FALLS)lowering+=f.dropM*smooth((distanceM-f.startM+70)/(f.runM+140));
  return lowering;
}

/** Seven connected grooves fan out from the one arriving river, then collect
 * below the face. This only excavates rock; actual distribution is left to
 * the native solver, and no stream receives its own water supply. */
export function reconstructionCrossHeight(distanceM:number,n:number,halfWidth:number):number {
  const a=Math.abs(n),base=1.5*Math.min(1,a/halfWidth)**3+Math.max(0,a-halfWidth)*.7;
  const twin=RECONSTRUCTION_FALLS[3];
  if(distanceM>twin.startM-30&&distanceM<twin.endM+25){
    // One shallow distributary opens into the two unequal cascades, then
    // collects them below their long divide. These grooves excavate land;
    // the original upstream water must actually choose and traverse them.
    const t=unit((distanceM-twin.startM)/twin.runM);
    const spread=smooth((distanceM-twin.startM+25)/45)*(1-smooth((distanceM-twin.endM+15)/35));
    const center=(35+10*smooth(t))*spread,nearest=Math.min(Math.abs(n-center),Math.abs(n+center));
    const groove=-.35+2*smooth((nearest-2)/3);
    const joined=smooth((distanceM-twin.startM+30)/10)*(1-smooth((distanceM-twin.endM-20)/5));
    return base+(Math.min(base,groove)-base)*joined;
  }
  const f=RECONSTRUCTION_FALLS[1],begin=f.startM-35,end=f.endM+30;
  if(distanceM<=begin-5||distanceM>=end)return base;
  const spread=smooth((distanceM-begin)/35)*(1-smooth((distanceM-f.endM)/25));
  let nearest=Infinity;
  for(let i=0;i<sistersChannels.length;i++)nearest=Math.min(nearest,Math.abs(n-sistersChannelCenter((distanceM-f.startM)/f.runM,i)*spread)-sistersChannels[i].width);
  const groove=-.35+2*smooth(nearest/2);
  const connected=smooth((distanceM-begin+5)/10)*(1-smooth((distanceM-end+5)/5));
  return base+(Math.min(base,groove)-base)*connected;
}

/** Candidate rock geometry at reference scale. Unequal shelves, a broad
 * seven-gully face, twin chutes and a long widening apron replace the common
 * miniature steps. This is shared terrain, never a prescription of wet lanes.
 * DEBT: runs/widths and lip locations are authored from reference views;
 * likeness is unaccepted, and the Steinsdalsfossen underside needs3Dsolids. */
export function reconstructionSection(distanceM:number,n=0):{lowering:number;halfWidth:number;relief:number;soilTop:boolean} {
  let lowering=0,halfWidth=8.5,relief=0,soilTop=false;
  for(const f of RECONSTRUCTION_FALLS){
    const t=(distanceM-f.startM)/f.runM;
    if(t<0){
      // Open the upstream distributary gradually from the shared river.
      halfWidth=Math.max(halfWidth,8.5+(f.halfWidthM-8.5)*smooth((distanceM-f.startM+35)/35));break;
    }
    if(t>=1){lowering=f.toeLoweringM;halfWidth=8.5+(f.halfWidthM-8.5)*(1-smooth((distanceM-f.endM)/Math.min(35,f.rapidsAfterM)));continue;}
    halfWidth=f.halfWidthM;
    let fraction=t;
    if(f.id==='storfossen'){
      fraction=0;
      const lips=[.08,.24,.45,.66,.86],runs=[.045,.07,.055,.085,.09],drops=[4,7,10,9,6];
      for(let k=0;k<5;k++)fraction+=drops[k]/36*smooth((t-lips[k]-(k%2?-.008:.008)*Math.tanh(n/2))/runs[k]);
      relief=2.8*unit(Math.min((t-.30)/.035,(.425-t)/.035))*unit(Math.min((n+4.2)/.8,(.5-n)/.8));
    }else if(f.id==='seven-sisters'){
      fraction=reconstructionSistersFace(t,0);
      let nearest=Infinity;
      for(let i=0;i<sistersChannels.length;i++)nearest=Math.min(nearest,Math.abs(n-sistersChannelCenter(t,i))-sistersChannels[i].width);
      // Local lip offsets are actual bed heights relative to the shared
      // centerline descent. The native headwater key supplies that centerline.
      const local=reconstructionSistersFace(t,n),window=Math.sin(Math.PI*t)**2;
      // Continue the same large rock plane beyond the finite component.
      // Fading its entire descent over12meters formerly restored more than
      //130meters beside the cliff, producing the rendered vertical side walls.
      // Only small fracture relief ends at the component edge. The broad
      // landscape blend and quiet-channel ownership remain in carveMainRapids.
      const faceGuard=1-smooth((Math.abs(n)-90)/12);
      const planeGuard=1-smooth((Math.abs(n)-110)/100);
      const rock=faceGuard>0&&nearest>0&&window>0?reconstructionRockRelief(n,f.dropM*(1-local)):0;
      const plane=f.dropM*(fraction-local)*planeGuard;
      relief=plane+(1.1+rock*.2)*smooth(nearest/5)*window*faceGuard;
    }else if(f.id==='steinsdalsfossen')fraction=smooth((t-.24)/.075);
    else if(f.id==='latefossen'){
      // The inspected upper-pair view has a higher plunge on one side and
      // a later broken chute on the other, around a long vegetated rock nose.
      // Both start at the same upstream head and rejoin at the same toe.
      // Runs, lateral widths and this divide height remain authored, not surveyed.
      const common=.12*smooth(t/.18),start=smooth((t-.18)/.10);
      const left=common+.48*smooth((t-.18)/.23)+.40*smooth((t-.41)/.59);
      const right=common+.24*smooth((t-.18)/.35)+.64*smooth((t-.53)/.47);
      fraction=(left+right)/2;
      const side=smooth((n+7)/14),local=left+(right-left)*side;
      const divide=latefossenDivide(t,n,fraction,f.dropM*(fraction-local)*start);
      relief=divide.relief;soilTop=divide.soilTop;
    }else if(f.id==='tvindefossen'){
      fraction=0;const lips=[.03,.17,.36,.54,.73,.90],drops=[.09,.20,.12,.25,.18,.16];
      for(let k=0;k<6;k++)fraction+=drops[k]*smooth((t-lips[k]+.012*Math.sin(n*.12+k))/.045);
      halfWidth=10+30*smooth(t);
      relief=1.3*Math.sin(n*.29+t*12)**2*Math.sin(Math.PI*t)**2;
    }else if(f.id==='stigfossen'){
      fraction=.20*smooth(t/.21)+.32*smooth((t-.25)/.21)+.30*smooth((t-.54)/.17)+.18*smooth((t-.79)/.21);
      const center=8*Math.sin(t*7);relief=5*smooth((Math.abs(n-center)-4)/8)*Math.sin(Math.PI*t)**2;
    }else{
      fraction=.82*t+.18*smooth(t);
      halfWidth=12+48*smooth(t);
      relief=(1.2*Math.sin(t*83+n*.14)**2+2.2*Math.sin(t*29-n*.075)**2)*Math.sin(Math.PI*t)**2;
    }
    lowering=f.crestLoweringM+f.dropM*unit(fraction);break;
  }
  return {lowering,halfWidth,relief,soilTop};
}

// Keep the original fork, then give the descending branch enough northward
// separation for its full-size cliffs and surrounding mountain shoulders.
// The original source, pool and quiet river retain their existing course.
// Monotone eastward progress also keeps distant elevations from sharing a
// horizontal solver cell. These placements are authored, not Norwegian GPS.
const points: ReadonlyArray<readonly [number,number]> = [
  // Four collinear controls hold the finite Sisters frame and its adjoining
  // river bed in the same direction over the whole45-meter fall. Curving
  // that bed under a straight finite component left28-meter edge mismatches.
  [-25,29],[40,16],[140,-30],[200,-70],[210,-140],[220,-210],[230,-280],[330,-350],
  [500,-370],[750,-390],[1000,-365],[1250,-400],[1500,-370],[1900,-390],
];
let curve: RiverCourse | undefined;
function reconstructionCurve():RiverCourse {return curve??=new RiverCourse(points);}

export function reconstructionCourseLength():number {
  const c=reconstructionCurve();return c.samples[c.samples.length-1].s-c.samples[0].s;
}

/** Distances start at the existing rapids fork, not at a control point's X.
 * CourseSample.s retains the branch namespace required by existing bed keys. */
export function reconstructedRapidsAt(distanceM:number):CourseSample {
  if(!Number.isFinite(distanceM)||distanceM<0||distanceM>reconstructionCourseLength())throw RangeError('Reconstruction distance outside course');
  const c=reconstructionCurve(),p=c.atCurve(c.samples[0].s+distanceM);
  return {...p,s:MAIN_CHANNEL_S+distanceM};
}

export function projectReconstructedRapids(x:number,z:number):{s:number;n:number;d:number;k:number} {
  if(!Number.isFinite(x)||!Number.isFinite(z))throw RangeError('Nonfinite reconstruction point');
  const c=reconstructionCurve(),p=c.project(x,z);
  return {...p,s:MAIN_CHANNEL_S+Math.max(0,Math.min(reconstructionCourseLength(),p.s-c.samples[0].s))};
}

/** Preserve the actual original source/pool/quiet-river rectangle and add
 * every reference footprint plus its land shoulders. The receipt is explicit
 * about allocation: a .5m full grid is larger than the installed staged grid.
 * It does not silently reduce resolution or assert adaptive support. */
export function reconstructionDomain():{grid:RiverGridSpec;cells:number;oneFloat64FieldBytes:number;sourceGridRetained:boolean} {
  const c=reconstructionCurve(),margin=120,dx=HEADWATERS_GRID.dx;
  let x0=HEADWATERS_GRID.x0,z0=HEADWATERS_GRID.z0;
  let x1=x0+HEADWATERS_GRID.nx*dx,z1=z0+HEADWATERS_GRID.nz*dx;
  for(const p of c.samples){
    x0=Math.min(x0,p.x-margin);x1=Math.max(x1,p.x+margin);
    z0=Math.min(z0,p.z-margin);z1=Math.max(z1,p.z+margin);
  }
  x0=Math.floor(x0/dx)*dx;z0=Math.floor(z0/dx)*dx;
  const grid={x0,z0,dx,nx:Math.ceil((x1-x0)/dx),nz:Math.ceil((z1-z0)/dx)};
  const cells=grid.nx*grid.nz;
  return {grid,cells,oneFloat64FieldBytes:cells*8,sourceGridRetained:true};
}

/** The existing outer-land lattice surrounds the fine water rectangle.
 * Its8m samples are land only; the complete0.5m solver grid is unchanged.
 * Two kilometers of lateral mountains keep the deep course inside a real
 * landscape instead of exposing the edge of a narrow strip in midair. */
export function reconstructionLandscapeDomain():{x0:number;z0:number;x1:number;z1:number;step:number} {
  const {grid:g}=reconstructionDomain(),step=8;
  return {x0:Math.floor((g.x0-600)/step)*step,z0:Math.floor((g.z0-2000)/step)*step,
    x1:Math.ceil((g.x0+g.nx*g.dx+600)/step)*step,z1:Math.ceil((g.z0+g.nz*g.dx+2000)/step)*step,step};
}
