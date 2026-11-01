/** Independent frozen proof worker. It never changes the production fall.
 * Readiness comes from transport equations and power balance, not elapsed
 * time. A sweep cap publishes an unconverged receipt without a render field. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 05/10/2026, 08:07:47
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { FrozenWaterfallRte, createRtePhase, validateRteRun, validateRteVector, type RteGrid, type RteVector } from '@/systems/world3d/river/waterfallRadiativeTransport';
export interface FrozenWaterfallRteRequest { grid:RteGrid;g:number;directions:12|24;maximumSweeps:number;tolerance:number;revision:string;frozenTime:number;min:RteVector;camera:RteVector; }
const scope=self as unknown as {onmessage:(event:MessageEvent<FrozenWaterfallRteRequest>)=>void;postMessage:(message:unknown,transfer?:Transferable[])=>void};
scope.onmessage=event=>{
  try{
    const request=event.data;validateRteRun(request.maximumSweeps,request.tolerance);validateRteVector(request.min,'Grid minimum');validateRteVector(request.camera,'Frozen camera');if(!Number.isFinite(request.frozenTime))throw new Error('Frozen time must be finite');
    const solver=new FrozenWaterfallRte(request.grid,createRtePhase(request.g,request.directions));let lastReport=0,sweeps=0;
    const advance=()=>{
      try{
        // This is off the camera thread. A 32ms worker slice avoids the timer
        // clamp cost seen in the earlier 2ms bake; obsolete workers are killed
        // by the owner. It does not grant 32ms work on a normal render frame.
        const start=performance.now();while(performance.now()-start<32&&sweeps<request.maximumSweeps){solver.sweep();sweeps++;}
        const receipt=solver.diagnose(request.tolerance),metadata={revision:request.revision,frozenTime:request.frozenTime,solar:receipt.solar};
        if(receipt.ready){const [nx,ny]=request.grid.size,source=solver.cameraSource(cell=>{
          const x=cell%nx,y=Math.floor(cell/nx)%ny,z=Math.floor(cell/(nx*ny));return[request.camera[0]-request.min[0]-(x+.5)*request.grid.spacing[0],request.camera[1]-request.min[1]-(y+.5)*request.grid.spacing[1],request.camera[2]-request.min[2]-(z+.5)*request.grid.spacing[2]];
        });scope.postMessage({...metadata,receipt,source},[source.buffer]);return;}
        if(sweeps===request.maximumSweeps){scope.postMessage({...metadata,receipt:{...receipt,capped:true}});return;}
        if(performance.now()-lastReport>500){scope.postMessage({...metadata,receipt});lastReport=performance.now();}setTimeout(advance,0);
      }catch(error){scope.postMessage({error:String(error),revision:request.revision});}
    };setTimeout(advance,0);
  }catch(error){scope.postMessage({error:String(error)});}
};
