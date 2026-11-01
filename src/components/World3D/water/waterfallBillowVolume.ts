/** A bounded meshed-fog alternative for the waterfall proof. Local emitted
 * liquid is spread into overlapping compact three-dimensional lobes, so the
 * support, internal density and optical shadow share one representation.
 * It is prescribed secondary-water kinematics, not a turbulence solver. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/10/2026, 23:11:09
 * Dependents: components/World3D/water/riverWaterfallView.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {materialSheetSection,materialSheetTrajectory} from './waterfallMaterialSheet';
import {aeratedDebit} from './waterfallAeratedSheet';
export const BILLOW_VOLUME={dimensions:[24,128,32] as const,coreRows:129,coreColumns:25,cameraSamples:24,lightSamples:16,emissionStepS:.04};
export interface BillowLobe {center:readonly[number,number,number];tangent:readonly[number,number];radii:readonly[number,number,number];volume:number;transfer:number;curve?:{bend:number;twist:number;feather:number};emission?:number;materialU?:number;eventId?:number;patchId?:string;frame?:{tangent:readonly[number,number,number];normal:readonly[number,number,number];across:readonly[number,number,number]}}
export interface BillowBounds {min:readonly[number,number,number];max:readonly[number,number,number]}
const hash=(n:number)=>{const x=Math.sin(n*127.1+53.7)*43758.5453;return x-Math.floor(x);};
export function billowSignal(emission:number,u:number,scale:number,seed:number){const x=(emission+u*.11)/scale,n=Math.floor(x),f=x-n,s=f*f*(3-2*f);return (2*hash(n+seed)-1)*(1-s)+(2*hash(n+1+seed)-1)*s;}
/** Values depend on emitted labels and develop smoothly after launch. The
 * outward normal-plane offset is real geometry, not texture-only motion. */
export function billowShape(age:number,emission:number,u:number){const develop=1-Math.exp(-age*age);return {offset:develop*.65*billowSignal(emission,u,.16,73),radii:[1.25+.35*billowSignal(emission,u,.13,11),develop*(.7+.35*(1+billowSignal(emission,u,.21,29))),.7+.25*(1+billowSignal(emission,u,.09,57))]as const};}

/** Two material coordinates vary independently. Unlike a single phase shifted
 * across a whole row, nearby emitted patches keep connected C1 motion while
 * different across-stream locations acquire different outward relief. */
export function billowMaterialSignal(emission:number,u:number,timeScale:number,acrossScale:number,seed:number){
 const x=emission/timeScale,y=u*acrossScale,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const a=fx*fx*(3-2*fx),b=fy*fy*(3-2*fy),h=(i:number,j:number)=>2*hash(i*37+j*193+seed)-1;
 return (h(ix,iy)*(1-a)+h(ix+1,iy)*a)*(1-b)+(h(ix,iy+1)*(1-a)+h(ix+1,iy+1)*a)*b;
}
const compact=(x:number)=>Math.abs(x)<1?Math.pow(1-x*x,2):0;
// Source controls do not change seeded material labels. Keep a bounded set of
// immutable event parameters, rather than recomputing their hashes for each
// clear-core vertex and deposition node. Speed still enters every live sample.
const eventCache=new Map<number,ReturnType<typeof makeEvent>>();
function makeEvent(cell:number,lane:number){const seed=cell*31+lane*173,key=(k:number)=>hash(seed+k);return {
 birth:.12+key(13)*1.5,rise:.3+key(41)*.65,lifetime:1.8+key(79)*2.4,
 label:(cell+.15+.7*key(101))*.24,center:(lane+.15+.7*key(151))/6,
 acrossWidth:.11+.12*key(211),emissionWidth:.18+.19*key(251),amplitude:.35+.65*key(293),
 strength:.45+.65*key(331),offset:(key(367)-.5)*1.4,rt:1.1+.55*key(401),rn:.45+.55*key(443),ra:.4+.3*key(487)};}
function eventFor(cell:number,lane:number){const id=cell*8+lane;let event=eventCache.get(id);if(!event){event=makeEvent(cell,lane);if(eventCache.size>=512)eventCache.delete(eventCache.keys().next().value!);eventCache.set(id,event);}return event;}
/** Independent finite material patches form throughout descent. Their labels
 * travel with the emitted liquid; age controls growth, not a fixed world-height
 * stamp. This prescribed deformation is a secondary-water approximation.
 * After formation ends, released liquid stays in the secondary budget and
 * its support disperses; it never fades away or returns as a clear shelf.
 * No positive floor or common full-width formation time is introduced. */
export function billowEventSample(age:number,emission:number,u:number,width:number,speed:number){
 let exposure=0,offset=0,rt=0,rn=0,ra=0;const flow=1-Math.exp(-Math.max(0,speed)/.45);
 const emissionCell=.24,base=Math.floor(emission/emissionCell);
 for(let lane=0;lane<6;lane++)for(let cell=base-3;cell<=base+3;cell++){
  const event=eventFor(cell,lane),support=compact((u-event.center)/(event.acrossWidth*(.32+.68*flow)))*compact((emission-event.label)/event.emissionWidth);
  if(support===0)continue;const elapsed=age-event.birth;if(elapsed<=0)continue;
  const growth=Math.min(1,elapsed/event.rise),spread=1-Math.exp(-Math.max(0,elapsed-event.lifetime)*.6);
  const develop=growth*growth*(3-2*growth);
  // Strength follows the relative speed of the prescribed local displacement,
  // scaled by launch flow. Uniform gravity alone contributes no aeration.
  const relative=event.amplitude/event.rise,motion=1-Math.exp(-relative*Math.sqrt(Math.max(0,speed)/.35));
  const w=support*develop*motion*event.strength;if(w===0)continue;
  exposure+=w;offset+=w*event.offset*develop*(1-spread*.4);
  rt+=w*event.rt;rn+=w*event.rn*develop*(1+spread*.7);
  ra+=w*Math.max(.35,width*event.acrossWidth*event.ra)*(1+spread*.35);
 }
 const develop=1-Math.exp(-age*age),fine=billowMaterialSignal(emission,u,.075,7,913),broad=billowMaterialSignal(emission,u,.26,3,977);
 // These are prescribed, flow-carried support scales. The fixed voxel grid
 // filters any thinner detail; no extra optical normal noise is applied.
 // Fast center translation pulled adjacent deposits apart in the native
 // proof. Keep broad carried relief; fine variation still shapes thickness
 // and twist, so this A/B changes only how far neighboring centers separate.
 const relief=develop*flow*(.55*broad);
 return {transfer:.85*(1-Math.exp(-exposure)),offset:exposure>0?offset/exposure+relief:0,
  curve:{bend:develop*.7*broad,twist:develop*.5*fine,feather:develop*billowMaterialSignal(emission,u,.13,5,1031)},
  radii:[exposure>0?rt/exposure*(.85+.25*Math.abs(broad)):1.1,exposure>0?rn/exposure*(.5+.5*flow)*(.8+.2*fine):.1,exposure>0?ra/exposure*(.32+.68*flow):.35]as const};
}
/** One authoritative local partition drives BOTH visible clear columns and
 * secondary deposits. Finite source events never borrow from a whole row. */
export function billowMaterialSection(area:number,width:number,age:number,emission:number,speed:number,columns=25){
 const section=materialSheetSection(area,width,age,emission,columns),transfer=new Float64Array(columns);
 for(let k=0;k<columns;k++)transfer[k]=billowEventSample(age,emission,k/(columns-1),width,speed).transfer;
 const debit=aeratedDebit(section,transfer);return {section,transfer,debit};
}

export interface BillowMaterialInput {time:number;flight:number;historyScale:number;width:number;depth:number;top:number;sectionAt:(age:number)=>{q:number;speed:number;speedAgeDerivative?:number}}
export interface BillowEventShare {id:number;event:ReturnType<typeof makeEvent>;weight:number;develop:number;spread:number}
/** Preserve formation identities after transfer has been calculated. The
 * positive weights are the same ones in the unchanged source function. */
export function billowEventContributions(age:number,emission:number,u:number,width:number,speed:number):BillowEventShare[]{
 const shares:BillowEventShare[]=[],flow=1-Math.exp(-Math.max(0,speed)/.45),base=Math.floor(emission/.24);
 for(let lane=0;lane<6;lane++)for(let cell=base-3;cell<=base+3;cell++){
  const event=eventFor(cell,lane),support=compact((u-event.center)/(event.acrossWidth*(.32+.68*flow)))*compact((emission-event.label)/event.emissionWidth);
  if(support===0)continue;const elapsed=age-event.birth;if(elapsed<=0)continue;
  const growth=Math.min(1,elapsed/event.rise),spread=1-Math.exp(-Math.max(0,elapsed-event.lifetime)*.6),develop=growth*growth*(3-2*growth);
  const relative=event.amplitude/event.rise,motion=1-Math.exp(-relative*Math.sqrt(Math.max(0,speed)/.35));
  const weight=support*develop*motion*event.strength;if(weight>0)shares.push({id:cell*8+lane,event,weight,develop,spread});
 }return shares;
}
export const BILLOW_EVENT_LIMITS={maximumEvents:256,maximumPatches:1024}as const;
/** Partition the existing nodal clear debit, not a new source. The original
 * trapezoid's dual-node measures make every removed node sum exactly to its
 * event shares. No global water redistribution or source renormalization is
 * introduced. Different source events survive as different occupied folds. */
export function billowEventPartition(area:number,width:number,age:number,emission:number,speed:number,columns=25){
 const partition=billowMaterialSection(area,width,age,emission,speed,columns),byEvent=new Map<number,{id:number;event:ReturnType<typeof makeEvent>;area:number;across:number;centerY:number;u:number;develop:number;spread:number}>();
 let maximumNodePartitionError=0,residualArea=0;const nodeAssigned=new Float64Array(columns);
 for(let k=0;k<columns;k++){
  const u=k/(columns-1),shares=billowEventContributions(age,emission,u,width,speed),total=shares.reduce((sum,s)=>sum+s.weight,0);
  const measure=((k?partition.section.across[k]-partition.section.across[k-1]:0)+(k<columns-1?partition.section.across[k+1]-partition.section.across[k]:0))*.5;
  const removed=partition.debit.removed[k];let assigned=0;
  for(const share of shares){const debit=removed*share.weight/total,mass=debit*measure;assigned+=debit;if(mass<=0)continue;
   let event=byEvent.get(share.id);if(!event){event={id:share.id,event:share.event,area:0,across:0,centerY:0,u:0,develop:0,spread:0};byEvent.set(share.id,event);}
   event.area+=mass;event.across+=mass*partition.section.across[k];event.centerY+=mass*partition.section.center[k];event.u+=mass*u;event.develop+=mass*share.develop;event.spread+=mass*share.spread;
  }
  nodeAssigned[k]=assigned;maximumNodePartitionError=Math.max(maximumNodePartitionError,Math.abs(assigned-removed));residualArea+=(removed-assigned)*measure;
 }
 for(const event of byEvent.values())for(const key of ['across','centerY','u','develop','spread']as const)event[key]/=event.area;
 return {...partition,events:[...byEvent.values()],nodeAssigned,maximumNodePartitionError,residualArea};
}
/** Aggregate event-owned emission segments. Their boundaries depend on the
 * event's own label/width, so they do not recreate a common falling row grid.
 * Oblique frames turn the compact leaf in real 3D; they do not perturb only
 * shading normals. Clear debit/source strength and the optical field remain
 * authoritative. This is prescribed secondary kinematics, not solved CFD. */
export function buildBillowLobes(input:BillowMaterialInput){
 if(![input.time,input.flight,input.historyScale,input.width,input.depth,input.top].every(Number.isFinite)||input.flight<=0||input.historyScale<=0||input.width<=0||input.depth<=0)throw Error('Invalid billow material input');
 const {time,flight,historyScale,width,depth,top,sectionAt}=input,birthStep=BILLOW_VOLUME.emissionStepS;
 const patches=new Map<string,{key:string;id:number;event:ReturnType<typeof makeEvent>;volume:number;center:number[];tangent:number[];develop:number;spread:number;emission:number;u:number}>(),eventIds=new Set<number>();
 let invalidBirths=0,expectedVolume=0,maximumNodePartitionError=0,eventPartitionResidual=0;
 const first=Math.floor((time-flight*historyScale)/birthStep),last=Math.floor(time/birthStep);
 // Excess history has no represented budget; reject it instead of spending
 // unbounded synthesis time and then dropping the oldest liquid silently.
 if((last-first+1)*birthStep/.24*6>BILLOW_EVENT_LIMITS.maximumEvents)return {lobes:[]as BillowLobe[],invalidBirths:1,expectedVolume:0,eventCount:0,maximumNodePartitionError:0,eventPartitionResidual:0,eventCapacityExceeded:true};
 for(let n=first;n<=last;n++){
  const low=Math.max(time-flight*historyScale,n*birthStep),high=Math.min(time,(n+1)*birthStep);if(high<=low)continue;
  const emission=(low+high)*.5,age=(time-emission)/historyScale,source=sectionAt(age);if(source.q<=0)continue;
  const trajectory=materialSheetTrajectory(age,flight,depth,top,source.speed,source.speedAgeDerivative??0);if(!trajectory.valid){invalidBirths++;continue;}
  const area=source.q*historyScale/trajectory.forwardDerivative,partition=billowEventPartition(area,width,age,emission,source.speed);
  maximumNodePartitionError=Math.max(maximumNodePartitionError,partition.maximumNodePartitionError);eventPartitionResidual+=partition.residualArea*source.q/area*(high-low);
  expectedVolume+=partition.debit.removedArea*source.q/area*(high-low);
  const normalF=-trajectory.yDerivative/trajectory.arcSpeed,normalY=trajectory.forwardDerivative/trajectory.arcSpeed,flow=1-Math.exp(-source.speed/.45);
  for(const share of partition.events){
   const volume=source.q*share.area/area*(high-low);if(volume<=0)continue;eventIds.add(share.id);
   const segmentWidth=.06+.03*((share.event.rt-1.1)/.55),segment=Math.floor((emission-share.event.label)/segmentWidth),key=share.id+':'+segment;
   const offset=share.event.offset*share.develop*(1-share.spread*.4)+(1-Math.exp(-age*age))*flow*.55*billowMaterialSignal(emission,share.u,.26,3,977);
   const center=[trajectory.forward+normalF*offset,trajectory.y+share.centerY+normalY*offset,share.across];
   let patch=patches.get(key);if(!patch){patch={key,id:share.id,event:share.event,volume:0,center:[0,0,0],tangent:[0,0],develop:0,spread:0,emission:0,u:0};patches.set(key,patch);}
   patch.volume+=volume;for(let k=0;k<3;k++)patch.center[k]+=volume*center[k];patch.tangent[0]+=volume*trajectory.forwardDerivative/trajectory.arcSpeed;patch.tangent[1]+=volume*trajectory.yDerivative/trajectory.arcSpeed;
   patch.develop+=volume*share.develop;patch.spread+=volume*share.spread;patch.emission+=volume*emission;patch.u+=volume*share.u;
  }
 }
 const eventCapacityExceeded=eventIds.size>BILLOW_EVENT_LIMITS.maximumEvents||patches.size>BILLOW_EVENT_LIMITS.maximumPatches;
 if(eventCapacityExceeded)return {lobes:[]as BillowLobe[],invalidBirths:invalidBirths+1,expectedVolume,eventCount:eventIds.size,maximumNodePartitionError,eventPartitionResidual,eventCapacityExceeded};
 const lobes:BillowLobe[]=[];
 for(const patch of patches.values()){
  const volume=patch.volume,center=patch.center.map(v=>v/volume)as [number,number,number],develop=patch.develop/volume,spread=patch.spread/volume,emission=patch.emission/volume,u=patch.u/volume;
  const norm=Math.hypot(...patch.tangent),tf=patch.tangent[0]/norm,ty=patch.tangent[1]/norm;
  const angle=(patch.event.offset/.7)*.65*develop,cos=Math.cos(angle),sin=Math.sin(angle);
  const frame={tangent:[tf*cos,ty*cos,sin]as const,normal:[-ty,tf,0]as const,across:[-tf*sin,-ty*sin,cos]as const};
  const flow=1-Math.exp(-sectionAt((time-emission)/historyScale).speed/.45);
  lobes.push({center,tangent:[tf,ty],frame,eventId:patch.id,patchId:patch.key,radii:[patch.event.rt,Math.max(.65,patch.event.rn*develop*(1+spread*.7)),Math.max(.35,width*patch.event.acrossWidth*patch.event.ra*(.32+.68*flow))*(1+spread*.35)],volume,transfer:billowEventSample((time-emission)/historyScale,emission,u,width,sectionAt((time-emission)/historyScale).speed).transfer,curve:{bend:.7*develop*patch.event.offset/.7,twist:.5*develop*Math.sin(patch.id),feather:develop*billowMaterialSignal(emission,u,.13,5,1031)},emission,materialU:u});
 }
 return {lobes,invalidBirths,expectedVolume,eventCount:eventIds.size,maximumNodePartitionError,eventPartitionResidual,eventCapacityExceeded};
}

export class BillowDensityField{
 readonly dimensions:readonly[number,number,number];readonly data:Float32Array;readonly spacing:readonly[number,number,number];readonly voxelVolume:number;
 private indices:Uint32Array;private weights:Float64Array;
 receipt={expectedVolume:0,depositedVolume:0,residualVolume:0,maximumFraction:0,expandedLobes:0,updateMs:0,lobes:0};
 constructor(readonly bounds:BillowBounds,dimensions:readonly[number,number,number]=BILLOW_VOLUME.dimensions){
  if(dimensions.some(n=>!Number.isInteger(n)||n<2)||bounds.min.some((v,k)=>!Number.isFinite(v)||!Number.isFinite(bounds.max[k])||bounds.max[k]<=v))throw Error('Invalid billow grid');
  this.dimensions=dimensions;this.spacing=dimensions.map((n,k)=>(bounds.max[k]-bounds.min[k])/n)as unknown as readonly[number,number,number];this.voxelVolume=this.spacing[0]*this.spacing[1]*this.spacing[2];const cells=dimensions[0]*dimensions[1]*dimensions[2];this.data=new Float32Array(cells*4);this.indices=new Uint32Array(cells);this.weights=new Float64Array(cells);
 }
 /** Cell-volume budgets are deposited locally. If a lobe exceeds available
  * capacity its OWN support expands; no whole-row normalization or floor is
  * applied. A remaining capacity failure is reported rather than discarded. */
 fill(lobes:readonly BillowLobe[]){
  const start=performance.now();this.data.fill(0);let expected=0,residual=0,expanded=0;const [nx,ny,nz]=this.dimensions,[dx,dy,dz]=this.spacing;
  for(const lobe of lobes){
   if(![...lobe.center,...lobe.tangent,...lobe.radii,lobe.volume,lobe.transfer].every(Number.isFinite)||lobe.volume<0||lobe.radii.some(v=>v<=0)||lobe.transfer<0||lobe.transfer>1||(lobe.curve&&(!Object.values(lobe.curve).every(Number.isFinite)||Math.abs(lobe.curve.bend)>.7||Math.abs(lobe.curve.twist)>.5||Math.abs(lobe.curve.feather)>1))||Math.abs(Math.hypot(...lobe.tangent)-1)>1e-6)throw Error('Invalid billow lobe');
   if(lobe.frame){const axes=[lobe.frame.tangent,lobe.frame.normal,lobe.frame.across];if(axes.some(axis=>!axis.every(Number.isFinite)||Math.abs(Math.hypot(...axis)-1)>1e-6)||axes.some((axis,k)=>axes.slice(k+1).some(other=>Math.abs(axis.reduce((sum,v,j)=>sum+v*other[j],0))>1e-6)))throw Error('Invalid billow frame');}
   expected+=lobe.volume;if(lobe.volume===0)continue;let remaining=lobe.volume;
   for(let expansion=0;expansion<4&&remaining>Math.max(1e-12,lobe.volume*1e-8);expansion++){
    // Reconstruction cannot resolve a thinner lobe than one voxel. This
    // spatial filter changes air support, not liquid volume; it ensures an
    // early positive source does not disappear between all voxel centers.
    const scale=Math.pow(1.35,expansion),rt=Math.max(lobe.radii[0],dx,dy)*scale,rn=Math.max(lobe.radii[1],dx,dy)*scale,ra=Math.max(lobe.radii[2],dz)*scale,[tf,ty]=lobe.tangent;
    const curved=Boolean(lobe.curve),bend=lobe.curve?.bend??0,twist=lobe.curve?.twist??0,feather=lobe.curve?.feather??0;
    // The leaf is a continuous curved occupied volume. This conservative
    // bound includes its normal displacement and varying local thickness;
    // mass is still fitted inside this one material patch, never a whole row.
    const normalBound=rn*(curved?1.3+Math.abs(bend)+Math.abs(twist):1);
    const frame=lobe.frame??{tangent:[tf,ty,0],normal:[-ty,tf,0],across:[0,0,1]};
    const extent=[0,1,2].map(k=>Math.abs(frame.tangent[k])*rt+Math.abs(frame.normal[k])*normalBound+Math.abs(frame.across[k])*ra);
    const low=lobe.center.map((v,k)=>v-extent[k]),high=lobe.center.map((v,k)=>v+extent[k]);
    const first=low.map((v,k)=>Math.max(0,Math.ceil((v-this.bounds.min[k])/this.spacing[k]-.5))),last=high.map((v,k)=>Math.min(this.dimensions[k]-1,Math.floor((v-this.bounds.min[k])/this.spacing[k]-.5)));let count=0;
    for(let z=first[2];z<=last[2];z++)for(let y=first[1];y<=last[1];y++)for(let x=first[0];x<=last[0];x++){
     const f=this.bounds.min[0]+(x+.5)*dx-lobe.center[0],v=this.bounds.min[1]+(y+.5)*dy-lobe.center[1],a=this.bounds.min[2]+(z+.5)*dz-lobe.center[2];
     const t=(f*frame.tangent[0]+v*frame.tangent[1]+a*frame.tangent[2])/rt,across=(f*frame.across[0]+v*frame.across[1]+a*frame.across[2])/ra;if(Math.abs(t)>=1||Math.abs(across)>=1)continue;
     const leafWidth=curved?.65+.35*(1-t*t):1,aw=across/leafWidth;
     const localThickness=curved?Math.max(.35,Math.min(1.3,.8+feather*(.45*t+.3*across-.35*t*across))):1;
     const n=((f*frame.normal[0]+v*frame.normal[1]+a*frame.normal[2])/rn-bend*(t*t-.3)-twist*across*t)/localThickness;
     const r2=t*t+n*n+aw*aw;if(r2>=1)continue;
     this.indices[count]=(x+nx*(y+ny*z))*4;this.weights[count]=(1-r2)*(1-r2);count++;
    }
    for(let iteration=0;iteration<6&&remaining>Math.max(1e-12,lobe.volume*1e-8);iteration++){
     let totalWeight=0;for(let i=0;i<count;i++)if(this.data[this.indices[i]]<1)totalWeight+=this.weights[i];if(totalWeight===0)break;let deposited=0;
     for(let i=0;i<count;i++){const index=this.indices[i],available=(1-this.data[index])*this.voxelVolume,mass=Math.min(available,remaining*this.weights[i]/totalWeight);if(mass<=0)continue;
      const density=mass/this.voxelVolume;this.data[index]=Math.min(1,this.data[index]+density);this.data[index+1]=Math.min(this.data[index],this.data[index+1]+density*lobe.transfer);deposited+=mass;}
     remaining=Math.max(0,remaining-deposited);
    }
    if(expansion>0)expanded++;
   }
   residual+=remaining;
  }
  let depositedVolume=0,maxPhi=0;for(let i=0;i<this.data.length;i+=4){depositedVolume+=this.data[i]*this.voxelVolume;maxPhi=Math.max(maxPhi,this.data[i]);}
  this.receipt={expectedVolume:expected,depositedVolume,residualVolume:residual,maximumFraction:maxPhi,expandedLobes:expanded,updateMs:performance.now()-start,lobes:lobes.length};return this.receipt;
 }
 sample(point:readonly[number,number,number]):number{
  if(point.some((v,k)=>v<this.bounds.min[k]||v>this.bounds.max[k]))return 0;
  const q=point.map((v,k)=>Math.max(0,Math.min(this.dimensions[k]-1,(v-this.bounds.min[k])/this.spacing[k]-.5))),lo=q.map(Math.floor);let result=0;const [nx,ny]=this.dimensions;
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){const p=[Math.min(this.dimensions[0]-1,lo[0]+x),Math.min(this.dimensions[1]-1,lo[1]+y),Math.min(this.dimensions[2]-1,lo[2]+z)];const w=(x?q[0]-lo[0]:1-q[0]+lo[0])*(y?q[1]-lo[1]:1-q[1]+lo[1])*(z?q[2]-lo[2]:1-q[2]+lo[2]);result+=this.data[(p[0]+nx*(p[1]+ny*p[2]))*4]*w;}return result;
 }
}
/** Exact upper-half-space cosine integral for uniform radiance. Directional
 * samples distribute this energy; blockers attenuate it without renormalizing. */
export function billowUpperSkyFactor(normalY:number){return (1+Math.max(-1,Math.min(1,normalY)))*.5;}
