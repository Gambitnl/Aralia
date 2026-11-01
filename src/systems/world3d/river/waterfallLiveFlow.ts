/**
 * Runs live water from a finite-depth cliff opening through the full falling path.
 * Actual crest exits feed thick parcels; source changes are simulated, never
 * replayed from saved motion. An optional plane retains measured arrival packets.
 * This isolated coordinator leaves the native renderer and river arrival logic
 * untouched. Downstream pressure, air, breakup and impact remain reduced/open.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 06/10/2026, 07:40:00
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import{WaterfallCrestLiquid,type CrestLiquidOptions,type CrestSource,type CrestExit,type CrestVec3}from'./waterfallCrestLiquid';
import{WaterfallCrestJetReceiver,type CrestJetOptions}from'./waterfallCrestJetReceiver';
export interface LiveFlowOptions {crest?:CrestLiquidOptions;jet?:CrestJetOptions}
interface PendingEpoch {end:number;packets:CrestExit[]}
const momentum=(packets:readonly CrestExit[]):CrestVec3=>[0,1,2].map(c=>packets.reduce((s,p)=>s+1000*p.volume*p.velocity[c],0)) as CrestVec3;
export class WaterfallLiveFlow {
  private readonly crest:WaterfallCrestLiquid;private readonly jet:WaterfallCrestJetReceiver;private readonly dt:number;
  private cuts=new Set<number>();private tick=0;private pending:{end:number;epochs:PendingEpoch[]}|null=null;private failure:string|null=null;
  constructor(options:LiveFlowOptions={}){this.crest=new WaterfallCrestLiquid({crest:70,transport:'flux-cell',pressureSurface:'volume-kernel',releaseSupportDepleted:true,bedResidue:true,...options.crest});this.dt=this.crest.dt;
    if(options.jet?.startTime!==undefined&&options.jet.startTime!==0)throw Error('Live flow starts both phases at zero');
    if(options.jet?.dt!==undefined&&Math.abs(options.jet.dt-this.dt)>1e-12)throw Error('Live flow requires a shared timestep');
    this.jet=new WaterfallCrestJetReceiver({receivingPlane:0,cliff:{x:this.crest.lipX,top:this.crest.crest-this.crest.channelDepth},...options.jet,startTime:0,dt:this.dt});}
  fillApproach(source:CrestSource){if(this.tick||this.pending)throw Error('Initial inventory must precede live simulation');this.crest.fillApproach(source);}
  /** Manufactured controls may seed initial material, not inject an animation. */
  seedBox(min:CrestVec3,max:CrestVec3,velocity:CrestVec3,sourceId='initial'){if(this.tick||this.pending)throw Error('Initial inventory must precede live simulation');this.crest.seedBox(min,max,velocity,sourceId);}
  recordSource(time:number,source:CrestSource){this.crest.recordSource(time,source);this.cuts.add(time);}
  /** The crest can be one tick ahead during a failed handoff. Drained batches
   * stay owned here until the receiver accepts them; retry never debits source
   * volume twice or repeats an already accepted receiver subepoch.
   */
  retryPending(){if(!this.pending)return;try{while(this.pending.epochs.length){const epoch=this.pending.epochs[0];this.jet.step(epoch.end,epoch.packets);this.pending.epochs.shift();}this.tick++;this.pending=null;this.failure=null;}catch(error){this.failure=String(error);throw error;}}
  advanceTo(time:number){if(!Number.isFinite(time)||time<this.jet.receipt().time-1e-10||(this.pending&&time<this.pending.end-1e-10))throw Error('Live flow cannot rewind accepted or pending history');
    this.retryPending();const target=Math.floor((time+1e-10)/this.dt);
    try{while(this.tick<target){const start=this.tick*this.dt,end=(this.tick+1)*this.dt;
      this.crest.advanceTo(end);const packets=this.crest.takeExitedPackets();
      // Even an empty source-event epoch has its own force kick. Receiver cuts
      // mirror the crest's actual source boundaries, not the rendered cadence.
      const ends=[...this.cuts].filter(t=>t>start+1e-12&&t<end-1e-12).sort((a,b)=>a-b).concat(end);
      const epochs:PendingEpoch[]=ends.map(end=>({end,packets:[]}));
      this.pending={end,epochs};
      for(const p of packets){const epoch=epochs.find(e=>Math.abs(e.end-p.kickEndTime)<1e-10);if(!epoch)throw Error('Unmatched live crest kick epoch');epoch.packets.push(p);}
      this.retryPending();
    }}catch(error){this.failure=String(error);throw error;}}
  takeArrivals(){return this.jet.takeArrivals();}
  receipt(){const crest=this.crest.receipt(),jet=this.jet.receipt(),packets=this.pending?.epochs.flatMap(e=>e.packets)??[],pendingVolume=packets.reduce((s,p)=>s+p.volume,0),pendingMomentum=momentum(packets);
    const globalVolumeError=crest.residentVolume+jet.residentVolume+jet.arrivedVolume+pendingVolume-crest.initialVolume-crest.emittedVolume;
    const forces=[crest.gravityImpulse,crest.gridBoundaryImpulse,crest.pressureImpulse,crest.pressureExtensionImpulse,crest.solenoidalExtensionImpulse,crest.collisionImpulse,crest.transferMomentumError,jet.gravityImpulse,jet.cliffImpulse];
    const globalMomentumError=crest.residentMomentum.map((v,c)=>v+jet.residentMomentum[c]+jet.arrivedMomentum[c]+pendingMomentum[c]-crest.initialMomentum[c]-crest.sourceMomentum[c]-forces.reduce((s,p)=>s+p[c],0)) as CrestVec3;
    return{time:jet.time,crestTime:crest.time,ticks:this.tick,crest,jet,pendingEpochs:this.pending?.epochs.length??0,pendingPackets:packets.length,pendingVolume,pendingMomentum,globalVolumeError,globalMomentumError,failure:this.failure,phase:'live-crest-and-thick-pressure-free' as const};}
  snapshot(){const crest=this.crest.snapshot(),jet=this.jet.snapshot();return{crest,falling:jet.particles,arrivals:jet.arrivals,pending:this.pending?.epochs.map(e=>({end:e.end,packets:e.packets.map(p=>({...p,transportGradient:p.transportGradient?.slice(),position:[...p.position] as CrestVec3,velocity:[...p.velocity] as CrestVec3}))}))??[],receipt:this.receipt()};}
}
