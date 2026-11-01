/** Runs one small source-on/off basin with the existing native river solver.
 * This wrapper supplies a separate bed and controls, never alters the main
 * river. Actual adaptive steps own physical time; late timers do not catch up
 * by skipping physics. The renderer uses the same native flow-map material.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/10/2026, 11:20:35
 * Dependents: components/World3D/water/riverExperimentStations.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {RiverFlowSolver,type InflowCell,type RiverSteadyField} from '@/systems/world3d/river/riverSolver';
import {flowMapCore} from '@/systems/world3d/river/riverFlowField';
export class RiverExperimentPool {
  readonly solver: RiverFlowSolver;
  readonly inflow: readonly InflowCell[];
  sourceOn=true;
  running=true;
  failure:string|null=null;
  cumulativeCpuMs=0;
  lastCpuMs=0;
  private startWall=performance.now();
  private pausedMs=0;
  private pausedAt:number|null=null;
  private mappedTime=0;
  private readonly foam={W:new Float32Array(384),T:new Float32Array(384),L:new Float32Array(384)};
  constructor(x0=0,z0=0,baseY=0){
    const grid={x0,z0,dx:.25,nx:24,nz:16},n=grid.nx*grid.nz,bed=new Float64Array(n);
    // The east sill is part of the solver bed, so overflow begins from actual
    // storage/head. A timer never releases an authored spill volume.
    for(let j=0;j<grid.nz;j++)for(let i=0;i<grid.nx;i++)bed[j*grid.nx+i]=baseY+(i>=grid.nx-2?.08:.015*(1-i/(grid.nx-3)));
    this.inflow=[6,7,8,9].map(j=>({c:j*grid.nx+2,share:.25}));
    this.solver=new RiverFlowSolver({grid,bed,manning:new Float32Array(n).fill(.03),dischargeM3S:.24,inflow:this.inflow,inflowDir:[1,0],inflowSpeedMS:.3,outflowEdge:'east',maxDtS:.05});
  }
  setSource(on:boolean){this.sourceOn=on;this.solver.setInflow(on?.24:0,this.inflow,[1,0],.3);}
  setRunning(on:boolean){
    if(this.failure&&on)return;
    if(on&&!this.running&&this.pausedAt!==null){this.pausedMs+=performance.now()-this.pausedAt;this.pausedAt=null;}
    if(!on&&this.running)this.pausedAt=performance.now();this.running=on;
  }
  /** At most two native steps per presentation interval. The receipt exposes
   * slow physical advancement instead of hiding missed work with fake time. */
  tick(){
    if(!this.running||this.failure)return;
    const started=performance.now();
    for(let step=0;step<2;step++){
      const saved=this.solver.saveState(),inVolume=this.solver.inVolume,outVolume=this.solver.outVolume,steps=this.solver.steps;
      try{this.solver.step();if(!this.solver.health().ok)throw Error('Native pool health check failed');}
      catch(error){this.solver.restoreState(saved);this.solver.inVolume=inVolume;this.solver.outVolume=outVolume;this.solver.steps=steps;this.failure=String(error);this.setRunning(false);break;}
    }
    this.lastCpuMs=performance.now()-started;this.cumulativeCpuMs+=this.lastCpuMs;
  }
  receipt(){
    const s=this.solver,wallSeconds=((this.pausedAt??performance.now())-this.startWall-this.pausedMs)/1000;
    return {running:this.running,sourceOn:this.sourceOn,physicalSeconds:s.time,wallSeconds,lagSeconds:Math.max(0,wallSeconds-s.time),inVolume:s.inVolume,outVolume:s.outVolume,storedVolume:s.volume(),volumeClosure:s.volume()+s.outVolume-s.inVolume,steps:s.steps,cells:s.grid.nx*s.grid.nz,cumulativeCpuMs:this.cumulativeCpuMs,lastCpuMs:this.lastCpuMs,realtimeStatus:this.failure?'stopped failure':wallSeconds>1&&wallSeconds-s.time>.25?'physical time lagging':'within observed pace',failure:this.failure};
  }
  field():RiverSteadyField{
    const s=this.solver,n=s.h.length,h=new Float32Array(s.h),u=new Float32Array(n),v=new Float32Array(n);
    for(let c=0;c<n;c++)if(s.h[c]>1e-8){u[c]=s.hu[c]/s.h[c];v[c]=s.hv[c]/s.h[c];}
    return {grid:s.grid,h,u,v,uRms:new Float32Array(n),bed:new Float32Array(s.bed),stats:{simSeconds:s.time,steps:s.steps,qIn:s.discharge,qOut:0,dVdt:0,volume:s.volume(),maxSpeed:s.maxSpeedNow,activeCells:n,breachCells:0,wallMs:this.cumulativeCpuMs}};
  }
  map(){
    // Reuse the native live mapper's carried fields with the actual elapsed
    // physical time, rather than solving a new steady foam field each tick.
    const dtS=this.solver.time-this.mappedTime;
    const map=flowMapCore(this.field(),undefined,undefined,undefined,{kind:'step',dtS,...this.foam}).map;
    this.mappedTime=this.solver.time;return map;
  }
  dispose(){this.setRunning(false);}
}
