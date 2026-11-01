/** Runs the existing river equations on a neighboring landscape's actual bed.
 * This is native shallow water plus native conservative airborne transfers,
 * not the comparison's one-film/particle solver. Hydrostatic impact and the
 * uppermost height-field boundary still cannot qualify 3D splash or overhangs.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/10/2026, 03:48:34
 * Dependents: components/World3D/water/riverTerrainCourseView.ts, components/World3D/water/waterfallTerrainComparisonView.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { RiverFlowSolver, type InflowCell, type RiverSolverGrid, type RiverSteadyField } from './riverSolver';
import { RiverSpillTransfer } from './riverSpillTransfer';
import { rasterizeRiverTerrain } from './riverTerrainRaster';
import { flowMapCore } from './riverFlowField';

export class RiverTerrainCourse {
  readonly solver: RiverFlowSolver;
  readonly spill: RiverSpillTransfer;
  readonly raster: ReturnType<typeof rasterizeRiverTerrain>;
  running = false;
  sourceOn = true;
  failure: string | null = null;
  private readonly inflow: InflowCell[];
  private mappedTime = 0;
  private readonly foam: { W: Float32Array; T: Float32Array; L: Float32Array };
  constructor(positions: ArrayLike<number>, grid: RiverSolverGrid, sourceCells: readonly number[], readonly direction: readonly [number,number], readonly discharge = 1.5, readonly speed = 1.5/(10*.7), readonly actualTerrainGuard=false) {
    if(!Number.isFinite(discharge)||discharge<0||!Number.isFinite(speed)||speed<0||!direction.every(Number.isFinite)||Math.abs(Math.hypot(...direction)-1)>1e-6)throw Error('Invalid native terrain source');
    if (!sourceCells.length || sourceCells.some(c=>!Number.isInteger(c)||c<0||c>=grid.nx*grid.nz) || new Set(sourceCells).size!==sourceCells.length) throw Error('Invalid native terrain inlets');
    this.raster = rasterizeRiverTerrain(positions, grid);
    this.inflow = sourceCells.map(c=>({c,share:1/sourceCells.length}));
    const n=grid.nx*grid.nz;
    // Reuse the main river's real wet-front policy. Dry mountain cells are
    // eligible receivers, but only source/wet cells and their native margin
    // enter the HLL runs. Sleeping cells never lose retained water.
    const ceiling=this.raster.bed.slice();for(const {c} of this.inflow)ceiling[c]+=1;
    this.solver = new RiverFlowSolver({grid,bed:this.raster.bed,manning:new Float32Array(n).fill(.03),dischargeM3S:discharge,inflow:this.inflow,inflowDir:direction,inflowSpeedMS:speed,outflowEdge:Math.abs(direction[0])>=Math.abs(direction[1])?(direction[0]>=0?'east':'west'):(direction[1]>=0?'south':'north'),maxDtS:.05,
      // Only the conforming-cell candidate uses actual point contact. Keeping
      // the old mismatched face while changing contact alone would repeatedly
      // credit water across a lip it had never physically cleared.
      ...(grid.xEdges?{spillBedAt:this.raster.heightAt}:{}),
    },ceiling);
    this.solver.enableWetFrontExpansion(new Uint8Array(n).fill(1));
    this.spill = new RiverSpillTransfer(grid,this.raster.spillFaces); this.solver.setSpillTransfer(this.spill);
    this.foam={W:new Float32Array(n),T:new Float32Array(n),L:new Float32Array(n)};
  }
  setSource(on:boolean):void { this.sourceOn=on; this.solver.setInflow(on?this.discharge:0,this.inflow,this.direction,this.speed); }
  step():number {
    if(this.failure)throw Error(this.failure);
    const saved=this.solver.saveState();
    try {
      const dt=this.solver.step(),health=this.solver.health();
      if(!health.ok)throw Error('Native terrain water health failed');
      if(this.spill.hasAirborneOutsideGrid())throw Error('Native terrain airborne water left the measured domain');
      // Diagnostic candidate only. The grid-center contact bed can miss the
      // actual drawn cliff between centers, especially as source-off slows
      // departure. Refuse that attempted state instead of hiding it in rock.
      // This center test is necessary, not a finite-volume collision proof;
      // the copied receipt adds debug cost and makes no runtime claim.
      if(this.actualTerrainGuard)for(const p of this.spill.snapshot().packets){
        const rock=this.raster.heightAt(p.position[0],p.position[2]);
        if(rock===null||rock===undefined)throw Error(`Actual terrain unavailable for airborne packet ${p.id}`);
        if(rock-p.position[1]>1e-5)throw Error(`Actual drawn-rock clearance failed for packet ${p.id}: ${(rock-p.position[1]).toFixed(6)} m; candidate stopped`);
      }
      const closure=this.solver.totalWetPlusAirVolume()+this.solver.outVolume-this.solver.inVolume;
      if(!Number.isFinite(closure)||Math.abs(closure)>1e-7*Math.max(1,this.solver.inVolume))throw Error(`Native terrain water closure failed: ${closure}`);
      return dt;
    } catch(error) {this.solver.restoreState(saved);this.failure=String(error);this.running=false;throw error;}
  }
  receipt(){const s=this.solver,r=this.spill.receipt();return {time:s.time,steps:s.steps,sourceOn:this.sourceOn,running:this.running,inVolume:s.inVolume,outVolume:s.outVolume,wetVolume:s.volume(),airVolume:r.airborneVolume,returnedVolume:r.returnedVolume,closure:s.totalWetPlusAirVolume()+s.outVolume-s.inVolume,faces:this.raster.spillFaces.length,cells:s.h.length,activeCells:s.activeCells,failure:this.failure};}
  map(){
    const s=this.solver,n=s.h.length,u=new Float32Array(n),v=new Float32Array(n);
    for(let c=0;c<n;c++)if(s.h[c]>1e-8){u[c]=s.hu[c]/s.h[c];v[c]=s.hv[c]/s.h[c];}
    const field:RiverSteadyField={grid:s.grid,h:Float32Array.from(s.h),u,v,uRms:new Float32Array(n),bed:Float32Array.from(s.bed),stats:{simSeconds:s.time,steps:s.steps,qIn:s.discharge,qOut:0,dVdt:0,volume:s.volume(),maxSpeed:s.maxSpeedNow,activeCells:s.activeCells,breachCells:0,wallMs:0}};
    const map=flowMapCore(field,undefined,undefined,undefined,{kind:'step',dtS:s.time-this.mappedTime,...this.foam}).map;this.mappedTime=s.time;return map;
  }
}
