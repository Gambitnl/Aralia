/**
 * Continues measured cliff-exit parcels without turning thick water into a sheet.
 * This isolated pressure-free control is not connected to the native renderer.
 * The crest owns its full force kick; this receiver completes residual drift
 * and takes ownership of later gravity kicks. General dense-jet pressure,
 * occupied-density preservation, air loading and impact remain unproved.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 06/10/2026, 07:40:00
 * Dependents: systems/world3d/river/waterfallLiveFlow.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type {CrestExit,CrestParticle,CrestVec3} from './waterfallCrestLiquid';

export interface CrestJetOptions {cliff?:{x:number;top:number};startTime?:number;dt?:number;gravity?:number;maximumParticles?:number;receivingPlane?:number;maximumArrivalPackets?:number}
export interface CrestJetParcel extends CrestParticle {cliffContactTime?:number;phase:'thick-pressure-free';exitTime:number;boundary:CrestExit['boundary'];releaseReason?:CrestExit['releaseReason'];transportGradient?:number[];gradientDefinition?:'frozen-exit-transport'}
export interface CrestJetArrival extends CrestJetParcel {time:number;kickStartTime:number;kickEndTime:number;remainingDriftTime:number}
export interface CrestJetReceipt {cliffImpulse:CrestVec3;cliffContacts:number;firstCliffContactTime:number|null;time:number;particles:number;admittedVolume:number;residentVolume:number;volumeError:number;admittedMomentum:CrestVec3;residentMomentum:CrestVec3;gravityImpulse:CrestVec3;momentumError:CrestVec3;steps:number;arrivals:number;arrivalPacketsPending:number;arrivedVolume:number;arrivedMomentum:CrestVec3;phase:'thick-pressure-free'}
const sum=(p:readonly CrestParticle[],momentum=false):CrestVec3=>[0,1,2].map(c=>p.reduce((v,p)=>v+(momentum?1000*p.volume*p.velocity[c]:0),0)) as CrestVec3;

export class WaterfallCrestJetReceiver {
  private readonly cliff:{x:number;top:number}|undefined;private cliffImpulse:CrestVec3=[0,0,0];private cliffContacts=0;private firstCliffContactTime:number|null=null;
  private time:number;private readonly dt:number;private readonly gravity:number;private readonly capacity:number;
  private readonly plane:number|undefined;private readonly arrivalCapacity:number;private arrivals:CrestJetArrival[]=[];private arrivalCount=0;private arrivedVolume=0;private arrivedMomentum:CrestVec3=[0,0,0];
  private parcels:CrestJetParcel[]=[];private ids=new Set<number>();private admittedVolume=0;private admittedMomentum:CrestVec3=[0,0,0];private gravityImpulse:CrestVec3=[0,0,0];private steps=0;
  constructor(options:CrestJetOptions={}){this.time=options.startTime??0;this.dt=options.dt??.0025;this.gravity=options.gravity??9.81;this.capacity=options.maximumParticles??100000;
    this.cliff=options.cliff?{...options.cliff}:undefined;if(this.cliff&&![this.cliff.x,this.cliff.top].every(Number.isFinite))throw Error('Invalid cliff plane');
    this.plane=options.receivingPlane;this.arrivalCapacity=options.maximumArrivalPackets??this.capacity;
    if((this.plane!==undefined&&!Number.isFinite(this.plane))||!Number.isInteger(this.arrivalCapacity)||this.arrivalCapacity<1)throw Error('Invalid receiving plane/capacity');
    if(![this.time,this.dt,this.gravity].every(Number.isFinite)||this.time<0||this.dt<=0||this.dt>.02||this.gravity<0||!Number.isInteger(this.capacity)||this.capacity<1)throw Error('Invalid crest jet options');}
  /** All packets in a batch share the current kick epoch. Crossing order inside
   * that batch is immaterial; epochs cannot be replayed or silently skipped.
   * A rejected batch changes neither clock nor material, so it can be retried.
   */
  step(endTime:number,packets:readonly CrestExit[]=[]){
    const dt=endTime-this.time,eps=1e-10;
    if(!Number.isFinite(endTime)||dt<=0||dt>this.dt+eps)throw Error('Invalid or out-of-order crest jet step');
    if(this.parcels.length+packets.length>this.capacity)throw Error('Crest jet capacity exceeded');
    const incomingIds=new Set<number>();
    for(const p of packets){
      if(!Number.isInteger(p.id)||p.id<1||this.ids.has(p.id)||incomingIds.has(p.id))throw Error('Duplicate or invalid crest jet transfer id');incomingIds.add(p.id);
      if((p.transportGradient!==undefined&&(p.transportGradient.length!==9||!p.transportGradient.every(Number.isFinite)||p.gradientDefinition!=='frozen-exit-transport'))||p.phase!=='post-kick-drift'||typeof p.sourceId!=='string'||!p.sourceId||!['downstream','bottom','side','upstream','support-depleted'].includes(p.boundary)
        ||![p.birth,p.volume,p.time,p.kickStartTime,p.kickEndTime,p.remainingDriftTime,...p.position,...p.velocity].every(Number.isFinite)
        ||(this.plane!==undefined&&p.position[1]<this.plane-eps)||p.position.length!==3||p.velocity.length!==3||p.volume<=0||p.birth>p.time+eps||p.birth<0
        ||Math.abs(p.kickStartTime-this.time)>eps||Math.abs(p.kickEndTime-endTime)>eps||p.time<this.time-eps||p.time>endTime+eps
        ||p.remainingDriftTime<0||Math.abs(p.remainingDriftTime-(endTime-p.time))>eps)throw Error('Invalid or out-of-order crest jet packet');
    }
    const next:CrestJetParcel[]=[],arrivals:CrestJetArrival[]=[],cliffImpulse=[...this.cliffImpulse] as CrestVec3;let cliffContacts=this.cliffContacts,firstCliffContactTime=this.firstCliffContactTime;
    const drift=(p:CrestJetParcel,position:CrestVec3,velocity:CrestVec3,at:number,duration:number)=>{
      const arrivalTime=this.plane!==undefined&&position[1]>=this.plane-eps&&velocity[1]<0?(this.plane-position[1])/velocity[1]:Infinity;
      const activeDuration=Math.min(duration,Math.max(0,arrivalTime));let wallTime=Infinity,contactTime=p.cliffContactTime;
      if(this.cliff){const wall=this.cliff;
        if(position[0]<wall.x-eps&&position[1]<wall.top)throw Error('Crest jet starts inside cliff');
        if(velocity[0]<0&&position[0]>=wall.x-eps){const crossing=Math.max(0,(wall.x-position[0])/velocity[0]);if(crossing<=activeDuration&&position[1]+velocity[1]*crossing<=wall.top){wallTime=crossing;cliffImpulse[0]-=1000*p.volume*velocity[0];cliffContacts++;contactTime=at+crossing;firstCliffContactTime=firstCliffContactTime===null?contactTime:Math.min(firstCliffContactTime,contactTime);}}
      }
      // The vertical cliff has free tangential slip and zero normal restitution.
      // Its measured swept reaction is separate from gravity/arrival ownership.
      const location=(elapsed:number)=>position.map((x,c)=>c===0&&elapsed>=wallTime?this.cliff!.x:x+velocity[c]*elapsed) as CrestVec3;
      const endpoint=location(activeDuration);
      if(this.cliff&&endpoint[0]<this.cliff.x-eps&&endpoint[1]<this.cliff.top)throw Error('Unsupported cliff top-entry; no bed return coupling');
      const resultVelocity=[...velocity] as CrestVec3;if(Number.isFinite(wallTime))resultVelocity[0]=0;
      if(arrivalTime>=-eps&&arrivalTime<=duration){endpoint[1]=this.plane!;arrivals.push({...p,cliffContactTime:contactTime,position:endpoint,velocity:resultVelocity,time:at+activeDuration,kickStartTime:this.time,kickEndTime:endTime,remainingDriftTime:Math.max(0,endTime-at-activeDuration)});}
      else next.push({...p,cliffContactTime:contactTime,position:endpoint,velocity:resultVelocity});
    };
    for(const p of this.parcels){const velocity=[...p.velocity] as CrestVec3;velocity[1]-=this.gravity*dt;drift(p,p.position,velocity,this.time,dt);}
    // Incoming momentum already owns this interval's upstream force kick.
    // Receiving-plane crossings retain that post-kick momentum and its epoch;
    // this plane records arrivals, not a collision or an impact/foam solver.
    for(const p of packets)drift({id:p.id,sourceId:p.sourceId,birth:p.birth,volume:p.volume,position:[...p.position],velocity:[...p.velocity],phase:'thick-pressure-free',exitTime:p.time,boundary:p.boundary,releaseReason:p.releaseReason,transportGradient:p.transportGradient?.slice(),gradientDefinition:p.gradientDefinition},p.position,[...p.velocity],p.time,p.remainingDriftTime);
    if(this.arrivals.length+arrivals.length>this.arrivalCapacity)throw Error('Crest arrival queue capacity exceeded');
    const addedVolume=packets.reduce((v,p)=>v+p.volume,0),addedMomentum=sum(packets,true),oldVolume=this.parcels.reduce((v,p)=>v+p.volume,0);
    const admittedVolume=this.admittedVolume+addedVolume,admittedMomentum=this.admittedMomentum.map((v,c)=>v+addedMomentum[c]) as CrestVec3;
    const gravityImpulse=[...this.gravityImpulse] as CrestVec3;gravityImpulse[1]-=1000*oldVolume*this.gravity*dt;
    const arrivedVolume=this.arrivedVolume+arrivals.reduce((v,p)=>v+p.volume,0),arrivalMomentum=sum(arrivals,true),arrivedMomentum=this.arrivedMomentum.map((v,c)=>v+arrivalMomentum[c]) as CrestVec3;
    const totals=sum(next,true);
    if(![admittedVolume,arrivedVolume,...arrivedMomentum,...admittedMomentum,...gravityImpulse,...cliffImpulse,...totals,...next.flatMap(p=>[...p.position,...p.velocity]),...arrivals.flatMap(p=>[p.time,...p.position,...p.velocity])].every(Number.isFinite))throw Error('Nonfinite crest jet state');
    this.cliffImpulse=cliffImpulse;this.cliffContacts=cliffContacts;this.firstCliffContactTime=firstCliffContactTime;this.arrivals=this.arrivals.concat(arrivals);this.arrivalCount+=arrivals.length;this.arrivedVolume=arrivedVolume;this.arrivedMomentum=arrivedMomentum;
    this.parcels=next;for(const id of incomingIds)this.ids.add(id);this.admittedVolume=admittedVolume;this.admittedMomentum=admittedMomentum;this.gravityImpulse=gravityImpulse;this.time=endTime;this.steps++;
  }
  receipt():CrestJetReceipt{const residentVolume=this.parcels.reduce((v,p)=>v+p.volume,0),residentMomentum=sum(this.parcels,true);return{cliffImpulse:[...this.cliffImpulse],cliffContacts:this.cliffContacts,firstCliffContactTime:this.firstCliffContactTime,time:this.time,particles:this.parcels.length,admittedVolume:this.admittedVolume,residentVolume,volumeError:residentVolume+this.arrivedVolume-this.admittedVolume,admittedMomentum:[...this.admittedMomentum],residentMomentum,gravityImpulse:[...this.gravityImpulse],momentumError:residentMomentum.map((v,c)=>v+this.arrivedMomentum[c]-this.admittedMomentum[c]-this.gravityImpulse[c]-this.cliffImpulse[c]) as CrestVec3,steps:this.steps,arrivals:this.arrivalCount,arrivalPacketsPending:this.arrivals.length,arrivedVolume:this.arrivedVolume,arrivedMomentum:[...this.arrivedMomentum],phase:'thick-pressure-free'};}
  /** Draining acknowledges arrival packets only; cumulative V/P books persist. */
  takeArrivals(){const result=this.arrivals.map(p=>({...p,transportGradient:p.transportGradient?.slice(),position:[...p.position] as CrestVec3,velocity:[...p.velocity] as CrestVec3}));this.arrivals=[];return result;}
  snapshot(){return{arrivals:this.arrivals.map(p=>({...p,transportGradient:p.transportGradient?.slice(),position:[...p.position] as CrestVec3,velocity:[...p.velocity] as CrestVec3})),particles:this.parcels.map(p=>({...p,transportGradient:p.transportGradient?.slice(),position:[...p.position] as CrestVec3,velocity:[...p.velocity] as CrestVec3})),receipt:this.receipt()};}
}
