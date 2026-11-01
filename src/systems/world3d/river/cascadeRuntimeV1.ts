/** Isolated fixed-cell low-order cascade candidate; native water does not call it.
 * Actual convex occupied geometry owns volume and physical momentum. Pressure,
 * gravity, wall traces and donor velocity all use one normal-linear carrier.
 * A rejected step leaves the accepted state intact and exposes its attempted
 * geometry/operator inputs. This experiment is not an accepted game solver.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 08/10/2026, 11:56:10
 * Dependents: None (Orphan)
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {cascadeBox,cascadeBounds,cascadeMap,cascadeCellSplit,cascadeMoments,cascadeIntersect,type CascadeVec3,type CascadePoly} from './cascadeRuntimeV1Geometry';
import {cascadeProject,cascadePhysical,type CascadePiece,type CascadeSolid} from './cascadeRuntimeV1Projection';
import {cascadeAllocateSharedDonors} from './cascadeRuntimeV1SharedRemap';
import {cascadeAuditEndpoint} from './cascadeRuntimeV1Endpoint';
import {cascadeReconstructShared} from './cascadeRuntimeV1Reconstruction';
import {cascadeFirstFiniteArrival} from './cascadeRuntimeV1FinitePatch';
export type {CascadePiece,CascadeSolid} from './cascadeRuntimeV1Projection';
export interface CascadeRuntimeOptions {cellSize?: number;dt?: number;pulse?: boolean;gravity?: number;solids?: CascadeSolid[];source?: boolean;transport?:'independent-reference'|'shared';captureStages?:boolean}
export interface CascadeReceipt {
  releasedVolume: number;outletVolume: number;branchVolume: number[];volumeError: number;
  momentumError: CascadeVec3;gravityImpulse: CascadeVec3;wallImpulse: CascadeVec3;sourceMomentum: CascadeVec3;outletMomentum: CascadeVec3;
  divergence: number;restrictionLoss: number;pressureLoss: number;remapLoss: number;centroidDefect: number;
  steps: number;iterations: number;milliseconds: {pressure:number;transport:number;remap:number;total:number};
  firstImpact: number|null;firstOverflow: number|null;failure: string|null;
  motionStatus?:'constant-control-qualified'|'INCONCLUSIVE';endpointMeanDefect?:number|null;endpointReason?:string;endpointAuditMilliseconds?:number;maximumChainError?:number;carrierFailure?:string|null;
  sourcePressureImpulse?:CascadeVec3;sourceBoundaryWork?:number;
}
export interface CascadeSnapshot {time:number;pieces:CascadePiece[];solids:CascadeSolid[];receipt:CascadeReceipt;failureState: unknown;stageState?:unknown}
const add=(a:CascadeVec3,b:readonly number[])=>a.map((v,d)=>v+b[d]) as CascadeVec3;
export function cascadePulse(time:number):number{return time<1?.03:time<4?.12:time<6?.30:0;}
export function cascadeFixture():CascadeSolid[]{
  return [
    {lo:[0,0,0],hi:[1.5,2.5,6]},
    {lo:[1.5,0,0],hi:[5.5,.5,6]},
    {lo:[1.5,.5,0],hi:[5.5,2.5,2.625]},
    {lo:[1.5,.5,3.375],hi:[5.5,2.5,6]},
    {lo:[5.5,0,2.625],hi:[5.625,.625,3.375]},
    // Grid-aligned descending treads provide stationary contact in this pilot.
    // Terrain polish and a true film/wetting model remain later obligations.
    {lo:[5.625,0,0],hi:[6,.375,6]},
    {lo:[6,0,0],hi:[6.5,.25,6]},
    {lo:[6.5,0,0],hi:[7,.125,6]},
    {lo:[6,.25,2.9375],hi:[8,.75,3.0625]},
    {lo:[0,0,0],hi:[8,.001,6]},
  ];
}
export class CascadeRuntimeV1 {
  readonly cellSize:number;readonly dt:number;readonly solids:CascadeSolid[];
  private pieces:CascadePiece[]=[];private time=0;private liveDischarge:number|null=null;
  private readonly pulse:boolean;private readonly gravity:number;private readonly source:boolean;
  private readonly transport:'independent-reference'|'shared';
  private readonly captureStages:boolean;private stageState:unknown=null;
  private initialVolume=0;private initialMomentum:CascadeVec3=[0,0,0];private failureState:unknown=null;
  private receipt:CascadeReceipt={releasedVolume:0,outletVolume:0,branchVolume:[0,0],volumeError:0,momentumError:[0,0,0],gravityImpulse:[0,0,0],wallImpulse:[0,0,0],sourceMomentum:[0,0,0],outletMomentum:[0,0,0],divergence:0,restrictionLoss:0,pressureLoss:0,remapLoss:0,centroidDefect:0,steps:0,iterations:0,milliseconds:{pressure:0,transport:0,remap:0,total:0},firstImpact:null,firstOverflow:null,failure:null};
  constructor(options:CascadeRuntimeOptions={}){this.cellSize=options.cellSize??.125;this.dt=options.dt??.005;this.pulse=options.pulse??true;this.gravity=options.gravity??9.81;this.source=options.source??true;this.solids=options.solids??cascadeFixture();this.transport=options.transport??'independent-reference';this.captureStages=options.captureStages??false;}
  setDischarge(q:number):void{if(!(q>=0&&Number.isFinite(q)))throw new Error('Finite nonnegative source required');this.liveDischarge=q;}
  seed(poly:CascadePoly,velocity:CascadeVec3,sourceId='control'):void{
    if(this.time!==0)throw new Error('Seed only before advancing');
    for(const p of cascadeCellSplit(poly,this.cellSize))this.pieces.push({...p,velocity:velocity.flatMap(v=>[v,v]),sourceId});
    const physical=cascadePhysical(this.pieces,this.cellSize);this.initialVolume=physical.volume;this.initialMomentum=physical.momentum;
  }
  snapshot():CascadeSnapshot{return structuredClone({time:this.time,pieces:this.pieces,solids:this.solids,receipt:this.receipt,failureState:this.failureState,...(this.captureStages?{stageState:this.stageState}:{})});}
  advanceTo(target:number):void{
    if(target<this.time||!Number.isFinite(target))throw new Error('Monotone finite physical time required');
    if(this.receipt.failure)throw new Error(this.receipt.failure);
    while(this.time<target-1e-12){
      let dt=Math.min(this.dt,target-this.time);for(const event of [1,4,6])if(event>this.time+1e-12)dt=Math.min(dt,event-this.time);
      const speed=Math.max(0,...this.pieces.flatMap(p=>p.velocity.map(Math.abs)));if(speed)dt=Math.min(dt,.4*this.cellSize/speed);
      this.step(dt);
    }
  }
  private step(dt:number):void{
    if(this.transport==='shared'){this.stepShared(dt);return;}
    const began=performance.now(),h=this.cellSize,before=cascadePhysical(this.pieces,h),next=structuredClone(this.receipt);
    let attempted:CascadePiece[]=structuredClone(this.pieces),stage='source';
    try{
      const q=this.source?(this.liveDischarge??(this.pulse?cascadePulse(this.time):0)):0;
      if(q>0){
        // A quarter-meter approach keeps the low-flow arrival within W05's
        // declared impact window; this coordinate is part of the fixture.
        const speed=q/(.5*.125),poly=cascadeBox([1.25-speed*dt,2.5,2.75],[1.25,2.625,3.25]);
        const incoming=cascadeCellSplit(poly,h).map(p=>({...p,velocity:[speed,speed,0,0,0,0],sourceId:`source:${this.time}`}));
        const input=cascadePhysical(incoming,h);next.releasedVolume+=input.volume;next.sourceMomentum=add(next.sourceMomentum,input.momentum);attempted.push(...incoming);
      }
      stage='pressure';const pressureBegan=performance.now();
      const gravityVolume=cascadePhysical(attempted,h).volume;
      attempted=attempted.map(p=>({...p,velocity:p.velocity.map((v,k)=>v-(Math.floor(k/2)===1?this.gravity*dt:0))}));
      next.gravityImpulse[1]-=1000*gravityVolume*this.gravity*dt;
      const projection=cascadeProject(attempted,this.solids,h);attempted=projection.pieces;
      next.wallImpulse=add(next.wallImpulse,projection.wallImpulse);next.divergence=Math.max(next.divergence,projection.divergence);next.restrictionLoss+=projection.restrictionLoss;next.pressureLoss+=projection.pressureLoss;next.iterations+=projection.iterations;
      next.milliseconds.pressure+=performance.now()-pressureBegan;
      stage='transport';const transportBegan=performance.now(),donors:CascadePiece[]=[];
      for(const p of attempted){
        const gradient=[0,1,2].map(d=>(p.velocity[2*d+1]-p.velocity[2*d])/h) as CascadeVec3;
        const scale=gradient.map(g=>Math.exp(g*dt)) as CascadeVec3;
        const shift=gradient.map((g,d)=>{const a=p.velocity[2*d]-g*p.cell[d]*h;return g===0?a*dt:a*Math.expm1(g*dt)/g;}) as CascadeVec3;
        const moved=cascadeMap(p.poly,scale,shift),old=cascadeMoments(p.poly),now=cascadeMoments(moved);
        if(Math.abs(now.volume-old.volume)>1e-11)throw new Error('Divergence-compatible donor volume failed');
        const split=cascadeCellSplit(moved,h);let donated=0;
        for(const donor of split){
          const m=cascadeMoments(donor.poly);donated+=m.volume;
          // The donated current is the very same material region as its volume.
          // Pulling back the accepted field preserves physical momentum instead
          // of evaluating an unrelated extrapolated receiver velocity.
          const velocity=[0,1,2].flatMap(d=>[0,1].map(side=>{
            const x=(donor.cell[d]+side)*h,origin=(x-shift[d])/scale[d];return p.velocity[2*d]+gradient[d]*(origin-p.cell[d]*h);
          }));
          const arrival={...donor,velocity,sourceId:p.sourceId};
          if(donor.cell[0]*h>=8){const out=cascadePhysical([arrival],h);next.outletVolume+=out.volume;next.outletMomentum=add(next.outletMomentum,out.momentum);next.branchVolume[m.first[2]/m.volume<3?0:1]+=out.volume;}
          else donors.push(arrival);
        }
        if(Math.abs(donated-old.volume)>1e-11)throw new Error('Positive donor partition lost material');
      }
      attempted=donors;next.milliseconds.transport+=performance.now()-transportBegan;
      stage='occupancy';
      const buckets=new Map<string,CascadePiece[]>();for(const p of attempted){const key=p.cell.join(',');buckets.set(key,[...(buckets.get(key)??[]),p]);}
      for(const cell of buckets.values()){
        if(cell.length>32)throw new Error('Oriented cut capacity exceeded: 32 actual pieces in one cell');
        for(let i=0;i<cell.length;i++){
          for(let j=0;j<i;j++){const intersection=cascadeIntersect(cell[i].poly,cell[j].poly);if(intersection.faces.length&&cascadeMoments(intersection).volume>0)throw new Error('Shared donor transport produced positive occupied overlap');}
          for(const solid of this.solids){const intersection=cascadeIntersect(cell[i].poly,cascadeBox(solid.lo,solid.hi));if(intersection.faces.length&&cascadeMoments(intersection).volume>0)throw new Error('Actual transported liquid penetrated stationary solid');}
        }
      }
      // Exact convex cuts are retained instead of a density contour or moment
      // shadow. A general PLIC simplification is deferred until these donors pass.
      const after=cascadePhysical(attempted,h);next.volumeError=after.volume+next.outletVolume-this.initialVolume-next.releasedVolume;
      next.momentumError=after.momentum.map((v,d)=>v-this.initialMomentum[d]-next.sourceMomentum[d]-next.gravityImpulse[d]-next.wallImpulse[d]+next.outletMomentum[d]) as CascadeVec3;
      if(Math.abs(next.volumeError)>1e-9)throw new Error(`Actual volume closure failed ${next.volumeError}`);
      if(Math.max(...next.momentumError.map(Math.abs))>1e-6)throw new Error(`Actual physical momentum failed ${next.momentumError}`);
      if(next.divergence>1e-7)throw new Error('Actual represented divergence failed');
      if(next.firstImpact===null&&attempted.some(p=>{const b=cascadeBounds(p.poly);return b.lo[0]>=1.5&&b.lo[1]<=.5+1e-8;}))next.firstImpact=this.time+dt;
      if(next.firstOverflow===null&&attempted.some(p=>cascadeBounds(p.poly).hi[0]>5.625))next.firstOverflow=this.time+dt;
      next.steps++;next.milliseconds.total+=performance.now()-began;
      this.pieces=attempted;this.receipt=next;this.time+=dt;
      void before;
    }catch(error){
      this.failureState={stage,dt,time:this.time,before:this.snapshot(),attempted,attemptedReceipt:next,error:String(error)};
      this.receipt.failure=`${stage} at t=${this.time}: ${String(error)}`;throw new Error(this.receipt.failure);
    }
  }

  /** Shared transport is explicit while its physical carrier remains under
   * review. The earlier independent-map controls stay reproducible. A stopped
   * candidate never commits attempted water or hides an unknown motion gate. */
  private stepShared(dt:number,contactSubsteps=0):void {
    const began=performance.now(),h=this.cellSize,before=cascadePhysical(this.pieces,h),next=structuredClone(this.receipt);
    let stage='resident pressure',attempted=structuredClone(this.pieces);const details:Record<string,unknown>={};
    try {
      const q=this.source?(this.liveDischarge??(this.pulse?cascadePulse(this.time):0)):0,speed=q>0?q/.0625:null;
      next.motionStatus='INCONCLUSIVE';next.endpointMeanDefect=null;next.endpointReason='General full-affine crossing/carrier reference is unqualified.';
      next.sourcePressureImpulse??=[0,0,0];next.sourceBoundaryWork??=0;
      const pressureBegan=performance.now();
      // Source birth enters through its boundary transaction after this resident
      // gravity kick. It cannot receive a full old-resident gravity impulse.
      attempted=attempted.map(p=>({...p,velocity:p.velocity.map((v,k)=>v-(Math.floor(k/2)===1?this.gravity*dt:0))}));
      next.gravityImpulse[1]-=1000*before.volume*this.gravity*dt;
      if(contactSubsteps>256)throw new Error('Finite contact exceeds 256 substeps per nominal step');
      const pre=cascadeProject(attempted,this.solids,h,1e-9,dt,speed,'unilateral');attempted=pre.pieces;details.pre=pre;
      next.wallImpulse=add(next.wallImpulse,pre.wallImpulse);next.sourcePressureImpulse=add(next.sourcePressureImpulse,pre.sourcePressureImpulse);next.sourceBoundaryWork+=pre.sourceBoundaryWork;
      next.restrictionLoss+=pre.restrictionLoss;next.pressureLoss+=pre.pressureLoss;next.iterations+=pre.iterations;next.divergence=Math.max(next.divergence,pre.divergence);next.milliseconds.pressure+=performance.now()-pressureBegan;
      stage='shared positive transport';const transportBegan=performance.now(),allocation=cascadeAllocateSharedDonors(attempted,this.solids,h,dt,speed);details.allocation=allocation;
      next.milliseconds.transport+=performance.now()-transportBegan;
      stage='finite first arrival';const arrival=cascadeFirstFiniteArrival(allocation.partition.construction!,attempted,this.solids,dt);details.arrival=arrival;
      if(arrival&&arrival.time<dt-1e-12){
        if(!(arrival.time>1e-12))throw new Error('Finite arrival has no representable positive substep');
        // Retry the shorter physical stage from the same accepted geometry,
        // with its own resident gravity/source birth interval and exact source
        // transaction. No tentative allocation or impulse is committed twice.
        this.stepShared(arrival.time,contactSubsteps+1);this.stepShared(dt-arrival.time,contactSubsteps+1);return;
      }
      next.releasedVolume+=allocation.incomingVolume;next.sourceMomentum=add(next.sourceMomentum,allocation.incomingMomentum);
      stage='captured endpoint reference';const endpoint=cascadeAuditEndpoint(allocation,attempted,dt,speed);details.endpoint=endpoint;
      next.maximumChainError=Math.max(next.maximumChainError??0,endpoint.maximumChainError);next.endpointAuditMilliseconds=(next.endpointAuditMilliseconds??0)+endpoint.milliseconds;next.endpointReason=endpoint.reason;
      stage='shared reconstruction';const reconstruction=cascadeReconstructShared(allocation,attempted,h,dt,speed,endpoint);details.reconstruction=reconstruction;attempted=reconstruction.pieces;
      next.milliseconds.remap+=reconstruction.milliseconds;next.remapLoss+=reconstruction.energyLoss;next.endpointMeanDefect=reconstruction.centroidDefect===null?null:reconstruction.centroidDefect/(allocation.incomingVolume+allocation.residentVolume);
      stage='actual transport construction';
      // The retained empty affine predictor guides finite interfaces without
      // support mass or an all-empty incompressibility test. Forward crossing
      // checks use its current sectors and shared normal compatibility; actual
      // occupied divergence is checked after pressure as before.
      details.construction=allocation.partition.construction;
      stage='finite contact';
      // First arrival was bracketed above. Actual geometric overlap still stops
      // before pressure; finite wet footprint constraints release separating
      // normal motion through the unilateral projection below.
      for(const p of attempted)for(const solid of this.solids){
        const intersection=cascadeIntersect(p.poly,cascadeBox(solid.lo,solid.hi));if(intersection.faces.length&&cascadeMoments(intersection).volume>0)throw new Error('Actual transported liquid penetrated stationary solid');
      }
      stage='arrival pressure';const postBegan=performance.now(),post=cascadeProject(attempted,this.solids,h,1e-9,dt,speed,'unilateral');attempted=post.pieces;details.post=post;
      next.wallImpulse=add(next.wallImpulse,post.wallImpulse);next.sourcePressureImpulse=add(next.sourcePressureImpulse,post.sourcePressureImpulse);next.sourceBoundaryWork+=post.sourceBoundaryWork;
      next.divergence=Math.max(next.divergence,post.divergence);next.iterations+=post.iterations;next.restrictionLoss+=post.restrictionLoss;next.pressureLoss+=post.pressureLoss;next.milliseconds.pressure+=performance.now()-postBegan;
      stage='actual occupancy and budgets';
      for(let i=0;i<attempted.length;i++)for(let j=0;j<i;j++)if(attempted[i].cell.every((v,d)=>v===attempted[j].cell[d])){const overlap=cascadeIntersect(attempted[i].poly,attempted[j].poly);if(overlap.faces.length&&cascadeMoments(overlap).volume>0)throw new Error('Shared reconstruction produced positive occupied overlap');}
      const after=cascadePhysical(attempted,h);next.volumeError=after.volume+next.outletVolume-this.initialVolume-next.releasedVolume;
      next.momentumError=after.momentum.map((v,d)=>v-this.initialMomentum[d]-next.sourceMomentum[d]-next.gravityImpulse[d]-next.wallImpulse[d]-next.sourcePressureImpulse![d]+next.outletMomentum[d]) as CascadeVec3;
      if(Math.abs(next.volumeError)>1e-9||Math.max(...next.momentumError.map(Math.abs))>1e-6)throw new Error(`Actual shared closure failed ${next.volumeError} ${next.momentumError}`);
      if(next.divergence>1e-7)throw new Error('Actual represented divergence failed');
      if(next.firstImpact===null&&arrival&&arrival.solid===1)next.firstImpact=this.time+dt;
      if(next.firstOverflow===null&&attempted.some(p=>cascadeBounds(p.poly).hi[0]>5.625))next.firstOverflow=this.time+dt;
      // Total is the physical update cost. The separately reported captured
      // endpoint audit is optional diagnostic cost, never hidden as GPU work.
      next.steps++;next.milliseconds.total+=performance.now()-began-endpoint.milliseconds;
      if(this.captureStages&&(this.time===0||arrival))this.stageState={time:this.time+dt,stage:this.time===0?'first source/empty transition':'finite arrival/contact',details};
      this.pieces=attempted;this.receipt=next;this.time+=dt;
    } catch(error) {
      const evidence=error as {carrier?:unknown;endpoint?:unknown;trajectory?:unknown;reconstruction?:unknown;sourceTrajectory?:unknown;constructionFailure?:unknown};details.carrierFailure=evidence.carrier;details.endpointFailure=evidence.endpoint;details.trajectoryFailure=evidence.trajectory;details.reconstructionFailure=evidence.reconstruction;details.sourceTrajectoryFailure=evidence.sourceTrajectory;details.constructionFailure=evidence.constructionFailure;
      next.carrierFailure=stage==='actual transport construction'||evidence.trajectory?String(error):null;
      this.failureState={stage,dt,time:this.time,before:this.snapshot(),attempted,attemptedReceipt:next,details,error:String(error),wallMilliseconds:performance.now()-began};
      this.receipt.motionStatus=next.motionStatus;this.receipt.endpointMeanDefect=next.endpointMeanDefect;this.receipt.endpointReason=next.endpointReason;this.receipt.carrierFailure=next.carrierFailure;
      this.receipt.failure=`${stage} at t=${this.time}: ${String(error)}`;throw new Error(this.receipt.failure);
    }
  }
}
