/**
 * Makes the rejected GPU waterfall experiment inspectable in the river scene.
 * RiverReachView supplies its existing renderer and displays only completed
 * steps. This preserves the measured failure instead of replaying it as live
 * water. The opt-in route stops at its original guards and retains rejected
 * partial-step ownership locally. It is not a replacement waterfall solver.
 */
// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/10/2026, 15:32:25
 * Dependents: components/World3D/water/riverReachScene.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {createFlipConvexContact} from '@/systems/worldforge/terrain/flipConvexContact';
import {WebGPURenderer,StorageBufferAttribute} from 'three/webgpu';
import {createFlipBuffers,MPM_DT} from '@/systems/worldforge/terrain/flipCompute';
import {planFiniteSource,buildFiniteSource,captureFiniteExports,finiteSourceInventory} from '@/systems/worldforge/terrain/flipFiniteSource';
import {ballisticInletMoments} from '@/systems/worldforge/terrain/flipSourceMoments';
import {physicalFlipUnits,createFlipContactObservations,readFlipContactObservations} from '@/systems/worldforge/terrain/flipContactAccounting';

/** The progress record this diagnostic reports. The named fields are the ones
 * the river scene reads. The other measured fields (admission, invalidState and
 * so on) stay open, because the receipt only displays them. GG-588 (2026-11-02)
 * replaced the earlier `any` with this type. */
export interface WaterfallMpmStatus {
  state: string;
  time?: number;
  wallSeconds?: number;
  reason?: string;
  [field: string]: unknown;
}
/** One completed step in the diagnostic record. */
type WaterfallMpmStepRecord = { firstParticleContact?: number | null } & Record<string, unknown>;

/** Bounded development run with unchanged admission/contact/energy guards.
 * This receiver failed qualification. It exists here only so the user can
 * inspect actual progress and its rejection, instead of a cached animation. */
export async function runWaterfallMpmDiagnostic(renderer: WebGPURenderer, hooks: {
  cancelled: () => boolean;
  status: (result: WaterfallMpmStatus) => void;
  attach: (buffers: ReturnType<typeof createFlipBuffers>, source: ReturnType<typeof buildFiniteSource>) => void;
  publish: (count: number) => Promise<void>;
}) {
 const started=performance.now(),limit=180000;
 hooks.status({state:'PREPARING',time:0,wallSeconds:0});
 const sourceSpec={flowM3s:1.5,widthM:10,bottomM:77.3,depthM:.7,entranceY:76,sourceOn:0,sourceOff:4,depthCells:7,spanCells:40};
 const params={n:112,dx:.25,count:131072,origin:[-2,50,-14] as [number,number,number]};
 const units=physicalFlipUnits(params.dx),dt=MPM_DT*units.time;
 const records:WaterfallMpmStepRecord[]=[];const result:WaterfallMpmStatus={state:'PREPARING',dt,params,sourceSpec,records};
 const display=()=>hooks.status({...result,wallSeconds:(performance.now()-started)/1000});
 const checkTime=()=>{if(hooks.cancelled())throw Error('Stopped by user');if(performance.now()-started>limit)throw Error('Inclusive 180s ceiling');};
 const read=async(b:StorageBufferAttribute)=>new Float32Array(await renderer.getArrayBufferAsync(b));
 let kernelPasses=0;
 let capturePartial: (()=>Promise<void>) | null = null;
 const errors:string[]=[];
 const dev=(renderer.backend as unknown as {device:GPUDevice}).device;
 const gpuError=(e:Event)=>{const error=(e as GPUUncapturedErrorEvent).error;errors.push(error?.message ?? String(error));};
 dev.addEventListener('uncapturederror',gpuError);
 try{
  checkTime();
  const span=new Float32Array(params.n**2*4);
  for(let z=0;z<params.n;z++)for(let x=0;x<params.n;x++){
   const wx=params.origin[0]+x*params.dx,wz=params.origin[2]+z*params.dx,i=(z*params.n+x)*4;
   const top=63.675-.65*wx+.22*wz,solid=wx>=-.5&&wx<=8&&wz>=-12&&wz<=12;
   // Native spanField stores the highest free span FIRST. Reversing these
   // entries would incorrectly treat incoming water as inside the lower void.
   span.set(solid?[(top-params.origin[1])/params.dx,1e6,-1e6,(top-2.5-params.origin[1])/params.dx]:[-1e6,1e6,-1e6,1e6],i);
  }
  const ground={buffer:new StorageBufferAttribute(span,4),n:params.n,cellM:params.dx,originXZ:[params.origin[0],params.origin[2]] as [number,number],slots:2};
  const gridRead=async(b:ReturnType<typeof createFlipBuffers>,bounds?:{counts:Uint32Array,mass:number,speed:number})=>{
   const arrays=await Promise.all([b.gridMass,b.gridMomX,b.gridMomY,b.gridMomZ].map(async x=>new Int32Array(await renderer.getArrayBufferAsync(x))));
   let mass=0,kineticJ=0,arithmeticEnergyJ=0;const momentum=[0,0,0],angular=[0,0,0];let negative=0;
   for(let i=0;i<arrays[0].length;i++){
    if(arrays[0][i]<0)negative++;if(arrays[0][i]<=0)continue;
    const m=arrays[0][i]/1e7,p=arrays.slice(1).map(a=>a[i]/1e7);mass+=m;
    kineticJ+=.5*p.reduce((s,v)=>s+v*v,0)/m*units.energy;
    if(bounds){
     // Count actual scatter terms. Each integer conversion rounds by less than
     // 1e-7, with a separately declared 128-ulp float-operation envelope.
     // This engineering envelope is reported; it is not physical dissipation
     // or a formal WGSL floating-point certificate.
     const terms=bounds.counts[i],round=128*2**-24;
     const dm=terms*(1e-7+round*bounds.mass),dp=Math.sqrt(3)*terms*(1e-7+round*bounds.mass*bounds.speed);
     const norm=Math.hypot(...p),low=.5*Math.max(0,norm-dp)**2/(m+dm),measured=.5*norm**2/m;
     arithmeticEnergyJ+=Math.max(0,measured-low)*units.energy;
    }
    // The actual transfer stencil is cell-centered, not vertex-centered.
    const x=[params.origin[0]+((i%params.n)+.5)*params.dx,params.origin[1]+(Math.floor(i/(params.n**2))+.5)*params.dx,params.origin[2]+((Math.floor(i/params.n)%params.n)+.5)*params.dx];
    for(let a=0;a<3;a++)momentum[a]+=p[a]*units.impulse;
    angular[0]+=(x[1]*p[2]-x[2]*p[1])*units.impulse;angular[1]+=(x[2]*p[0]-x[0]*p[2])*units.impulse;angular[2]+=(x[0]*p[1]-x[1]*p[0])*units.impulse;
   }return{volumeM3:mass*params.dx**3/4,kineticJ,momentum,angular,negative,arithmeticEnergyJ};
  };
  const pass=async(p:Parameters<WebGPURenderer['computeAsync']>[0])=>{checkTime();await renderer.computeAsync(p);kernelPasses++;};
  // This audit uses a common-time steady crossing cohort, including its finite
  // birth extent, before paying for the advancing full-pulse buffers.
  const audit=ballisticInletMoments(sourceSpec,1,dt,params.dx,0);
  const ab=createFlipBuffers({...params,count:audit.length});
  const ap=planFiniteSource({...params,count:audit.length},audit.map(c=>c.packet));
  const owner=buildFiniteSource(ab,ap),ak=owner.buildKernels(ground,{openDomain:true,viscosity:units.viscosity});
  for(const p of [owner.admit,ak.clearGrid,ak.p2g1])await pass(p);
  const actual=await gridRead(ab),sourceK=audit.reduce((s,c)=>s+c.sourceKineticJ,0),apicK=audit.reduce((s,c)=>s+c.apicKineticJ,0);
  const momentum=[0,1,2].map(a=>audit.reduce((s,c)=>s+c.momentumNs[a],0));
  const angular=[0,1,2].map(a=>audit.reduce((s,c)=>s+c.angularMomentum[a],0));
  // Each of 27 i32 scatter additions can round by less than one fixed-point
  // unit. Bound its total vector error before execution, instead of demanding
  // decimal equality from these atomics. Source f32 rounding is also exposed.
  const momentumArithmeticBound=Math.sqrt(3)*audit.length*27/1e7*units.impulse + Math.hypot(...momentum)*2e-6;
  const radiusBound=Math.hypot(...params.origin.map(o=>Math.max(Math.abs(o),Math.abs(o+params.n*params.dx))));
  const angularArithmeticBound=radiusBound*momentumArithmeticBound+Math.hypot(...angular)*2e-6;
  result.admission={sourceK,apicK,actual,admissionLossJ:sourceK-apicK,gridMixLossJ:apicK-actual.kineticJ,relativeLoss:(sourceK-actual.kineticJ)/sourceK,momentum,angular,momentumArithmeticBound,angularArithmeticBound};display();
  if(actual.negative||Math.abs(actual.volumeM3-ap.requestedVolumeM3)>ap.requestedVolumeM3*.01||actual.kineticJ>sourceK*1.00001||sourceK-actual.kineticJ>sourceK*.05
    ||Math.hypot(...actual.momentum.map((p,a)=>p-momentum[a]))>momentumArithmeticBound
    ||Math.hypot(...actual.angular.map((p,a)=>p-angular[a]))>angularArithmeticBound)throw Error('Material moment admission rejected');
  const cohorts=[];for(let k=0;k*dt<10;k++){checkTime();cohorts.push(ballisticInletMoments(sourceSpec,k*dt,dt,params.dx,k));}
  const carriers=cohorts.flat();result.scheduledPackets=carriers.length;
  const plan=planFiniteSource(params,carriers.map(c=>c.packet));
  result.plannedVolumeM3=plan.requestedVolumeM3;
  if(Math.abs(plan.requestedVolumeM3-6)>1e-6)throw Error('Full pulse ownership mismatch');
  const b=createFlipBuffers(params),s=buildFiniteSource(b,plan),obs=createFlipContactObservations(params);
  const geometry=DIAGNOSTIC_LEDGE;
  const boundary=createFlipConvexContact(params,geometry.id,geometry.sourceVertices.map(v=>[...v] as [number,number,number]),geometry.triangles.map(t=>[...t] as [number,number,number]));
  hooks.attach(b,s);
  // A rejected post-admission step still owns real water. Preserve the actual
  // partial state separately from the completed epoch shown to the camera.
  capturePartial=async()=>{
    const [masses,states,positions,velocities,c0,c1,c2,clock]=await Promise.all([
      read(s.massBuffer),renderer.getArrayBufferAsync(s.stateBuffer),read(b.pos),read(b.vel),read(b.c0),read(b.c1),read(b.c2),renderer.getArrayBufferAsync(s.clockBuffer)]);
    result.stoppedOwnership={inventory:finiteSourceInventory(plan,masses,new Uint32Array(states)),completedSteps:new Uint32Array(clock)[0],
      masses:Array.from(masses),states:Array.from(new Uint32Array(states)),positions:Array.from(positions),velocities:Array.from(velocities),affine:[Array.from(c0),Array.from(c1),Array.from(c2)]};
  };
  const k=s.buildKernels(ground,{openDomain:true,viscosity:units.viscosity,contact:obs,convexContact:boundary});
  const exported=new Set<number>(),exterior:Record<string,unknown>[]=[];result.exterior=exterior;
  const readU=async(buffer:Parameters<WebGPURenderer['getArrayBufferAsync']>[0])=>new Uint32Array(await renderer.getArrayBufferAsync(buffer));
  let admittedK=0,numericalLoss=0,arithmeticUncertainty=0,unexplainedGain=0,firstContact:number|null=null;
  let beforeK=0,admittedCount=0;let previousPos:Float32Array|null=null,previousMotion:Float32Array[]|null=null;
  for(let step=0;step<cohorts.length;step++){
   const incoming=cohorts[step];checkTime();
   if(admittedCount===0&&incoming.length===0){await pass(s.finishStep);continue;}
   // A returning resident in the prescribed entrance would invalidate the
   // one-way staging approximation; never overwrite it with the ballistic field.
   if(previousPos&&incoming.length)for(let p=0;p<admittedCount;p++)if(!exported.has(p)&&previousPos[p*4+1]*params.dx+params.origin[1]>=76)throw Error('Resident water in source staging region');
   const inputK=incoming.reduce((sum,c)=>sum+c.sourceKineticJ,0),inputA=incoming.reduce((sum,c)=>sum+c.apicKineticJ,0);
   numericalLoss+=inputK-inputA;admittedK+=inputK;const oldCount=admittedCount;admittedCount+=incoming.length;
   const counts=new Uint32Array(params.n**3);let largestMass=0,speedBound=0;
   for(let p=0;p<admittedCount;p++){
    if(exported.has(p))continue;
    const xp=[0,1,2].map(a=>p<oldCount?previousPos![p*4+a]:plan.positions[p*3+a]);
    const v=[0,1,2].map(a=>p<oldCount?previousMotion![0][p*4+a]:plan.velocities[p*3+a]);
    let speed=Math.hypot(...v);
    for(let col=0;col<3;col++)speed+=1.5*Math.hypot(...[0,1,2].map(a=>p<oldCount?previousMotion![col+1][p*4+a]:plan.affine[p*12+col*4+a]));
    speedBound=Math.max(speedBound,speed);largestMass=Math.max(largestMass,plan.masses[p]);
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
     const ix=Math.floor(xp[0])+x,iy=Math.floor(xp[1])+y,iz=Math.floor(xp[2])+z;
     if(Math.min(ix,iy,iz)<0||Math.max(ix,iy,iz)>=params.n)throw Error('Incomplete source or resident stencil');
     counts[(iy*params.n+iz)*params.n+ix]++;
    }
   }
   for(const p of [s.admit,k.clearGrid,k.p2g1])await pass(p);
   const g=await gridRead(b,{counts,mass:largestMass,speed:speedBound}),mix=beforeK+inputA-g.kineticJ;
   arithmeticUncertainty+=g.arithmeticEnergyJ;unexplainedGain+=Math.max(0,-mix-g.arithmeticEnergyJ);
   numericalLoss+=Math.max(0,mix);
   // A conservative observer envelope exceeding 5% blocks energy qualification,
   // not developmental observation. Actual excessive measured loss, unexplained
   // creation, corrupt state and missing ownership still stop this run. No
   // physical or live acceptance can be inferred from completing this preview.
   if(arithmeticUncertainty>admittedK*.05&&result.energyUnknownAt===undefined)result.energyUnknownAt=step*dt;
   if(g.negative||unexplainedGain>Math.max(1e-4,admittedK*1e-5)){
    result.firstOffender={step,time:step*dt,beforeK,inputK,inputA,mix,grid:g,incomingPackets:incoming.length,
     sourceVolume:incoming.reduce((sum,c)=>sum+c.packet.volumeM3,0),nativeOwned:Array.from(await read(s.massBuffer)).filter(m=>m!==0)};
    throw Error('Grid energy creation or fixed-point overflow');
   }
   if(admittedK>0&&numericalLoss>admittedK*.05){records.push({step,time:step*dt,numericalLoss,admittedK,mix});throw Error('Known numerical loss exceeds 5%');}
   for(const p of [k.p2g2,k.gridUpdate,k.g2p,s.finishStep])await pass(p);
   const [pos,vel,c0,c1,c2,og,op,oc,owned]=await Promise.all([b.pos,b.vel,b.c0,b.c1,b.c2,obs.grid,obs.particle,obs.position,s.massBuffer].map(read));
   const contact=readFlipContactObservations(params,{grid:og,particle:op,position:oc});
   if(firstContact===null&&(contact.grid.absoluteImpulseNs||contact.particle.absoluteImpulseNs))firstContact=(step+1)*dt;
   const states=await readU(s.stateBuffer),contactState=await read(boundary.displacements);
   let afterK=0,volume=0,minY=Infinity,maxSpeed=0,firstParticleContact=records.at(-1)?.firstParticleContact??null;
   const exiting:number[]=[];
   for(let p=0;p<admittedCount;p++)if(!exported.has(p)&&contactState[p*4+3]!==0)throw Error('Unexplained starting penetration in closed collider');
   if(firstParticleContact===null&&contact.particle.absoluteImpulseNs>0)firstParticleContact=(step+1)*dt;
   for(let p=0;p<admittedCount;p++){
    if(exported.has(p))continue;
    const m=owned[p];if(m!==plan.masses[p])throw Error('Source not acknowledged by actual GPU ownership');volume+=m*plan.particleVolumeUnitM3;let vv=0,cc=0;
    for(let a=0;a<3;a++){
     const x=pos[p*4+a];if(!Number.isFinite(x)||x<1||x>params.n-2){
      result.invalidState={step,time:(step+1)*dt,p,axis:a,value:x,positionReadLength:pos.length,position:Array.from(pos.slice(p*4,p*4+4)),velocity:Array.from(vel.slice(p*4,p*4+4)),expectedPosition:Array.from(plan.positions.slice(p*3,p*3+3)),mass:m,contact,grid:g,arithmeticUncertainty,unexplainedGain};
      throw Error('Unacknowledged interior exit or invalid state');
     }
     const v=vel[p*4+a];if(!Number.isFinite(v))throw Error('Nonfinite velocity');vv+=v*v;
     for(const col of [c0,c1,c2])cc+=col[p*4+a]**2;
    }
    if([0,1,2].some(a=>pos[p*4+a]<4||pos[p*4+a]>params.n-5))exiting.push(p);
    afterK+=.5*m*(vv+.25*cc)*units.energy;minY=Math.min(minY,pos[p*4+1]*params.dx+params.origin[1]);maxSpeed=Math.max(maxSpeed,Math.sqrt(vv)*units.speed);
   }
   if(exiting.length){
    const batch=captureFiniteExports(plan,{step:(await readU(s.clockBuffer))[0],masses:owned,states,positions:pos,velocities:vel,affineColumns:[c0,c1,c2]},exiting);
    const receiptId='exterior-'+step;
    // Accept into a stopped exterior owner BEFORE requesting local retirement.
    // Persist all m/x/v/C and energies in this experiment's receipt.
    exterior.push({receiptId,time:(step+1)*dt,owner:'diagnostic-exterior',records:batch.records});display();
    const transfer=s.acknowledgeExports(batch,{owner:'diagnostic-exterior',receiptId,packetIds:batch.records.map(r=>r.id)});
    await pass(transfer.commit);
    const committed=await readU(s.stateBuffer),remaining=await read(s.massBuffer);
    for(const r of batch.records){if(committed[r.slot]!==2||remaining[r.slot]!==0)throw Error('Exterior handoff not committed');exported.add(r.slot);afterK-=r.centerKineticJ+r.affineKineticJ;volume-=r.volumeM3;}
   }
   const inventory=finiteSourceInventory(plan,await read(s.massBuffer),await readU(s.stateBuffer));
   if(Math.abs(inventory.ownedRestVolumeM3+inventory.exportedVolumeM3+inventory.pendingVolumeM3-plan.representedVolumeM3)>1e-8)throw Error('Whole pulse inventory mismatch');
   beforeK=afterK;previousPos=pos;previousMotion=[vel,c0,c1,c2];
   if(errors.length)throw Error(errors.join(';'));
   records.push({step,time:(step+1)*dt,volume,minY,maxSpeed,afterK,numericalLoss,admittedK,arithmeticUncertainty,unexplainedGain,firstContact,firstParticleContact,contact,inventory});
   await hooks.publish(admittedCount);
   result.state='ADVANCING';result.time=(step+1)*dt;display();
   // Yield after a completed epoch so the existing scene can draw it. No
   // wall-clock extrapolation, catch-up dispatches or automatic looping.
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  }
  result.state='COMPLETED_UNQUALIFIED';
 }catch(e){result.state='STOPPED';result.reason=String(e);
  if(capturePartial)try{await capturePartial();
    // Durable local ownership receipt survives navigation/disposal. This is
    // separate from the displayed completed epoch, never a pool arrival.
    const id='finite-mpm-'+new Date().toISOString();
    await new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open('aralia-water-diagnostics',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('receipts');
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result,tx=db.transaction('receipts','readwrite');
        tx.objectStore('receipts').put({id,reason:result.reason,shownTime:result.time,params,sourceSpec,dt,ownership:result.stoppedOwnership},id);
        tx.oncomplete=()=>{db.close();resolve();};
        tx.onerror=()=>{db.close();reject(tx.error);};
      };
    });
    result.savedOwnership=id;
  }catch(error){result.ownershipCaptureError=String(error);}
 }
 finally{dev.removeEventListener('uncapturederror',gpuError);result.kernelPasses=kernelPasses;result.limits='Developmental source/receiver diagnostic only. Pressure EOS, finite contact and reconstructed surface volume unqualified. Native diagnostic surface only; no visual or runtime acceptance. P2G loss tracked; full G2P/stress energy qualification remains open.';display();}
  return result;
}

/** Same source vertices as the tested closed first ledge; vertical thickness 2.5m. */
export const DIAGNOSTIC_LEDGE = {"id":"contact-ledge-1","sourceVertices":[[-0.5,61.36,-12],[8,55.835,-12],[8,61.115,12],[-0.5,66.64,12],[-0.5,58.86,-12],[8,53.335,-12],[8,58.615,12],[-0.5,64.14,12]],"triangles":[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]]} as const;
