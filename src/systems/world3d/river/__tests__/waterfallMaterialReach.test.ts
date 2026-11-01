/** Checks material forces and ownership boundaries before a native GPU run.
 * These tests establish mathematical preparation, not rendered-water acceptance.
 */
import { describe,it,expect,vi } from 'vitest';
import { WaterfallMaterialReachGpu } from '../waterfallMaterialReachCompute';
import { reachFaceLaw,reachAdd,reachScale,reachDot,reachLength,mixReachNode,validateReachMesh,measureClosedReachVolume,reachAdmissionsConnect,reachWetEdgesConnect,requireQualifiedReachInterface,evaluateControlledReachCut,evaluateMovingReachCut,evaluateLinearMovingReachCut,observeReachBoundaryStep,validateReachBoundaryInput,type ReachAdmission,type ReachVec3,type ReachBoundaryInput } from '../waterfallMaterialReach';

const triangle:[ReachVec3,ReachVec3,ReachVec3]=[[0,2,0],[1,2,0],[0,3,0]];
const zero:[ReachVec3,ReachVec3,ReachVec3]=[[0,0,0],[0,0,0],[0,0,0]];
function admission(id:string,start=0,end=1,face=3,height=.01):ReachAdmission {
  return{id,outflow:{origin:{surfaceId:'ledge',geometryIdentity:'actual-edge',face,edge:'outgoing',anchor:[.5,1],normal:[0,1,0]},face,edge:'ledge:outgoing',start:[0,2+height*.5,0],end:[0,2+height*.5,1],intervalStart:start,intervalEnd:end,time:end,volume:.001,momentum:[1,0,0],velocity:[1,0,0],height},exchange:{qualification:'film-detachment-unqualified',sheetImpulse:[0,0,0],sheetWork:0,upstreamReaction:[0,0,0],upstreamWork:0,upstreamSurfaceId:'ledge',surfaceEnergyFlux:0,mechanicalEnergy:20}};
}
function boundary():ReachBoundaryInput {
  return{timeStart:0,timeEnd:.01,cut:{positionStart:[0,2,0],positionEnd:[0,2,0],velocity:[0,0,0]},materialRowPolicy:'advect-material-rows',inletNodeIds:[0,1],nodes:[{id:0,cutForce:[0,-.072,0],prescribedVelocity:[0,1,0]},{id:1,cutForce:[0,-.072,0],prescribedVelocity:[0,1,0]}],cutSegments:[{nodeIds:[0,1],start:triangle[0],end:triangle[1],outwardConormal:[0,-1,0],materialVelocity:[0,1,0]}],surfaceEnergyAdvection:.00144};
}

describe('bounded material reach physical preparation',()=>{
  it('uses the derivative of both free surface areas, without a rest shape',()=>{
    const state=reachFaceLaw(triangle,zero,.0005),eps=1e-6;
    for(let i=0;i<3;i++)for(let axis=0;axis<3;axis++){
      const plus=triangle.map(p=>[...p]) as typeof triangle,minus=triangle.map(p=>[...p]) as typeof triangle;
      plus[i][axis]+=eps;minus[i][axis]-=eps;
      const derivative=(reachFaceLaw(plus,zero,.0005).surfaceEnergy-reachFaceLaw(minus,zero,.0005).surfaceEnergy)/(2*eps);
      expect(state.capillary[i][axis]).toBeCloseTo(-derivative,9);
    }
    expect(reachLength(state.capillary.reduce(reachAdd,[0,0,0]))).toBeLessThan(1e-14);
  });
  it('does not damp translation or rigid rotation as if it were viscosity',()=>{
    for(const velocities of [triangle.map(()=>[2,3,4]),triangle.map(([x,y])=>[-y,x,0])] as [ReachVec3,ReachVec3,ReachVec3][]){
      const state=reachFaceLaw(triangle,velocities,.0005);
      expect(state.dissipationRate).toBeCloseTo(0,14);
      expect(state.viscous.every(v=>reachLength(v)<1e-14)).toBe(true);
    }
  });
  it('membrane force conserves momentum and removes exactly its declared strain power',()=>{
    const velocity:[ReachVec3,ReachVec3,ReachVec3]=[[0,0,0],[2,0,0],[0,-1,0]],state=reachFaceLaw(triangle,velocity,.0005);
    expect(state.dissipationRate).toBeGreaterThan(0);
    expect(reachLength(state.viscous.reduce(reachAdd,[0,0,0]))).toBeLessThan(1e-14);
    const power=state.viscous.reduce((s,f,i)=>s+reachDot(f,velocity[i]),0);
    expect(power).toBeCloseTo(-state.dissipationRate,14);
  });
  it('shares a node by momentum with explicit physical mixing loss',()=>{
    const mixed=mixReachNode(2,[3,1,0],1,[-1,2,0]);
    expect(reachScale(mixed.velocity,mixed.mass)).toEqual([5,4,0]);
    expect(mixed.mixingEnergyLoss).toBeCloseTo(17/3,12);
  });
  it('rejects duplicate face ownership and inconsistent mass',()=>{
    const face={nodes:[0,1,2] as [number,number,number],volume:.0005};
    const nodes=triangle.map(position=>({position,velocity:[0,0,0] as ReachVec3,mass:1/6}));
    expect(validateReachMesh({nodes,faces:[face]}).volume).toBe(.0005);
    expect(()=>validateReachMesh({nodes,faces:[face,face]})).toThrow(/winding/);
    expect(()=>validateReachMesh({nodes:[{...nodes[0],mass:.2},...nodes.slice(1)],faces:[face]})).toThrow(/mass/);
  });
  it('retains nonuniform source corner mass without silently feeding it to fixed-mass GPU evolution',()=>{
    const face={nodes:[0,1,2] as [number,number,number],volume:.0005,cornerMass:[.1,.15,.25] as [number,number,number]};
    const mesh={nodes:triangle.map((position,i)=>({position,velocity:[0,0,0] as ReachVec3,mass:face.cornerMass[i]})),faces:[face]};
    expect(validateReachMesh(mesh).volume).toBe(.0005);
    expect(()=>validateReachMesh({...mesh,faces:[{...face,cornerMass:[.1,.1,.1]}]})).toThrow(/corner mass/);
    expect(()=>validateReachMesh({...mesh,faces:[{...face,cornerMass:[0,.25,.25]}]})).toThrow(/corner mass/);
    const options={maximumIterations:2,relativeMomentumResidual:1e-5,absoluteMomentumResidual:1e-6,maximumThicknessEdgeRatio:.1,minimumTriangleQuality:.01,stopBelowY:0,maximumIndependentVolumeError:.01,maximumNumericalEnergyLossFraction:.05};
    expect(()=>new WaterfallMaterialReachGpu({} as GPUDevice,mesh,options)).toThrow(/coupled open-system/);
  });
  it('measures an independently supplied closed surface and rejects duplicate/opposite triangles',()=>{
    const positions=[0,0,0,1,0,0,0,1,0,0,0,1],indices=[0,2,1,0,1,3,0,3,2,1,2,3];
    expect(measureClosedReachVolume(positions,indices)).toBeCloseTo(1/6,14);
    expect(()=>measureClosedReachVolume(positions,indices.slice(3))).toThrow(/open/);
    expect(()=>measureClosedReachVolume(positions,[...indices,0,1,2])).toThrow(/Duplicate/);
  });
  it('joins temporal supply despite actual varying height, and requires physical incidence across faces',()=>{
    const a=admission('a',0,1,3,.01),b=admission('b',1,2,3,.03);
    expect(reachAdmissionsConnect(a,b)).toBe(true);
    expect(reachAdmissionsConnect(a,admission('dry-gap',2,3))).toBe(false);
    const neighbor=admission('neighbor',0,1,4);
    expect(reachWetEdgesConnect(a,{edgeIdentity:'physical-outgoing',start:0,end:.4},neighbor,{edgeIdentity:'physical-outgoing',start:.4,end:1})).toBe(true);
    expect(()=>reachWetEdgesConnect(a,{edgeIdentity:'physical-outgoing',start:0,end:.5},neighbor,{edgeIdentity:'physical-outgoing',start:.4,end:1})).toThrow(/subdivision/);
  });
  it('never qualifies Film detachment merely because opposite numbers were supplied',()=>{
    expect(()=>requireQualifiedReachInterface(admission('real-film'))).toThrow(/wetting/);
    const claimed=admission('claimed-closure');claimed.exchange.qualification='controlled-two-sided-sheet-cut';
    expect(()=>requireQualifiedReachInterface(claimed)).toThrow(/wetting/);
  });
  it('evaluates controlled free-sheet cut traction and surface flux separately',()=>{
    const cut=evaluateControlledReachCut([0,0,0],[0,1,0],[-1,0,0],[2,0,0],.1);
    expect(cut.sheetImpulse).toEqual([-.0144,0,0]);
    expect(cut.sheetWork).toBe(-.0288);
    expect(cut.surfaceEnergyFlux+cut.sheetWork).toBe(0);
    expect(reachLength(reachAdd(cut.sheetImpulse,cut.upstreamReaction))).toBe(0);
  });
  it('recovers measured constrained drive impulse and backward-Euler force work',()=>{
    const observed=observeReachBoundaryStep(2,[1,0,0],[3,2,0],[4,-2,0],[0,6,0],.5,true);
    expect(observed.cutImpulse).toEqual([0,3,0]);
    expect(observed.driveImpulse).toEqual([2,2,0]);
    expect(observed.cutWork).toBe(6);expect(observed.driveWork).toBe(10);
    expect(observed.freeMomentumResidual).toEqual([0,0,0]);
  });
  it('does not convert an unconstrained momentum defect into external work',()=>{
    const observed=observeReachBoundaryStep(2,[1,0,0],[3,2,0],[4,-2,0],[0,6,0],.5,false);
    expect(observed.driveImpulse).toEqual([0,0,0]);expect(observed.driveWork).toBe(0);
    expect(observed.freeMomentumResidual).toEqual([2,2,0]);
    const balanced=observeReachBoundaryStep(2,[1,0,0],[2,1,0],[4,-2,0],[0,6,0],.5,false);
    expect(balanced.freeMomentumResidual).toEqual([0,0,0]);
  });
  it('distinguishes moving cut advection from physical material traction work',()=>{
    const moving=evaluateMovingReachCut([0,0,0],[0,1,0],[-1,0,0],[2,0,0],[2,0,0],.1);
    // IEEE signed zero has the same physical flux; require exact zero magnitude.
    expect(Math.abs(moving.surfaceEnergyAdvection)).toBe(0);expect(moving.tractionWork).toBe(-.0288);
    const fixed=evaluateMovingReachCut([0,0,0],[0,1,0],[-1,0,0],[2,0,0],[0,0,0],.1);
    expect(fixed.surfaceEnergyAdvection+fixed.tractionWork).toBe(0);
  });
  it('requires actual inlet edge incidence, endpoint velocity and evaluated flux',()=>{
    const b=boundary(),nodes=new Set([0,1,2]),edges=new Set(['0:1','1:2','0:2']);
    expect(()=>validateReachBoundaryInput(b,3,nodes,.072,edges)).not.toThrow();
    expect(()=>validateReachBoundaryInput(b,3,nodes,.072,new Set(['1:2','0:2']))).toThrow(/actual material boundary edge/);
    const changed=structuredClone(b);changed.nodes[0].prescribedVelocity=[0,2,0];expect(()=>validateReachBoundaryInput(changed,3,nodes,.072,edges)).toThrow(/prescribed material endpoints/);
    const flux=structuredClone(b);flux.surfaceEnergyAdvection=100;expect(()=>validateReachBoundaryInput(flux,3,nodes,.072,edges)).toThrow(/relative cut flux/);
  });
  it('preserves the zero-surface-tension control without inventing cut work',()=>{
    const cut=evaluateMovingReachCut([0,0,0],[0,1,0],[-1,0,0],[2,0,0],[0,0,0],.1,0);
    expect(reachLength(cut.cutForce)).toBe(0);expect(Math.abs(cut.surfaceEnergyAdvection)).toBe(0);expect(Math.abs(cut.tractionWork)).toBe(0);
    const face=reachFaceLaw(triangle,zero,.0005,{density:1000,gravity:[0,-9.81,0],surfaceTension:0,dynamicViscosity:.001});
    expect(face.surfaceEnergy).toBe(0);expect(face.capillary.every(f=>reachLength(f)===0)).toBe(true);
  });
  it('integrates uneven cut velocity without replacing endpoint momentum by the mean',()=>{
    const cut=evaluateLinearMovingReachCut([0,0,0],[2,0,0],[0,-1,0],[[3,1,0],[-1,5,0]],[0,2,0],.25);
    expect(cut.cutForce).toEqual([0,-.288,0]);
    // Integral of linear y velocity along the cut is L * (1 + 5) / 2.
    expect(cut.tractionWork).toBeCloseTo(-.216,14);
    expect(cut.surfaceEnergyAdvection).toBeCloseTo(.072,14);
    const uniform=evaluateMovingReachCut([0,0,0],[2,0,0],[0,-1,0],[3,1,0],[0,2,0],.25);
    expect(evaluateLinearMovingReachCut([0,0,0],[2,0,0],[0,-1,0],[[3,1,0],[3,1,0]],[0,2,0],.25)).toEqual(uniform);
  });
  it('connects adjacent unequal inlet velocities through one consistent shared node',()=>{
    const b=boundary();b.inletNodeIds=[0,1,2];
    b.nodes=[{id:0,cutForce:[0,-.072,0],prescribedVelocity:[0,1,0]},{id:1,cutForce:[0,-.144,0],prescribedVelocity:[0,3,0]},{id:2,cutForce:[0,-.072,0],prescribedVelocity:[0,5,0]}];
    b.cutSegments=[{nodeIds:[0,1],start:[0,2,0],end:[1,2,0],outwardConormal:[0,-1,0],endpointVelocities:[[0,1,0],[0,3,0]]},{nodeIds:[1,2],start:[1,2,0],end:[2,2,0],outwardConormal:[0,-1,0],endpointVelocities:[[0,3,0],[0,5,0]]}];
    b.surfaceEnergyAdvection=.00864;
    expect(()=>validateReachBoundaryInput(b,3,new Set([0,1,2]),.072,new Set(['0:1','1:2']))).not.toThrow();
    const swapped=structuredClone(b);swapped.cutSegments[1].endpointVelocities=[[0,5,0],[0,3,0]];
    expect(()=>validateReachBoundaryInput(swapped,3,new Set([0,1,2]))).toThrow(/prescribed material endpoints/);
  });
  it('rejects ambiguous or nonfinite cut velocity data before accepting boundary work',()=>{
    const b=boundary();
    Object.assign(b.cutSegments[0],{endpointVelocities:[[0,1,0],[0,1,0]]});
    expect(()=>validateReachBoundaryInput(b,3,new Set([0,1,2]))).toThrow(/exactly one velocity/);
    expect(()=>evaluateLinearMovingReachCut([0,0,0],[1,0,0],[0,-1,0],[[0,1,0],[0,NaN,0]],[0,0,0],.1)).toThrow(/endpoint velocities/);
    expect(()=>evaluateMovingReachCut([0,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,Infinity,0],.1)).toThrow(/cut velocity/);
  });
  it('rejects malformed nodal and cut vectors instead of accepting NaN comparisons',()=>{
    for(const field of ['prescribedVelocity','cutForce'] as const){
      const b=boundary();b.nodes[0][field]=[0,1] as unknown as ReachVec3;
      expect(()=>validateReachBoundaryInput(b,3,new Set([0,1,2]))).toThrow(/nodal forcing/);
    }
    const b=boundary();b.cut.positionEnd=[0,2] as unknown as ReachVec3;
    expect(()=>validateReachBoundaryInput(b,3,new Set([0,1,2]))).toThrow(/cut vectors/);
    const conormal=boundary();conormal.cutSegments[0].outwardConormal=[0,-1] as unknown as ReachVec3;
    expect(()=>validateReachBoundaryInput(conormal,3,new Set([0,1,2]))).toThrow(/cut vectors/);
  });
  it('withholds staged optical publication until the joint epoch commits',async()=>{
    // This fake queue checks ownership sequencing only. It does not execute
    // WGSL or pretend to certify GPU forces, convergence, volume or runtime.
    vi.stubGlobal('GPUBufferUsage',{STORAGE:1,COPY_SRC:2,COPY_DST:4,VERTEX:8,INDEX:16,MAP_READ:32,UNIFORM:64});
    vi.stubGlobal('GPUShaderStage',{COMPUTE:1});vi.stubGlobal('GPUMapMode',{READ:1});
    const copies:{source:string;target:string}[]=[];
    const fakeReport=new Float32Array(32);
    const pass={setPipeline:()=>{},setBindGroup:()=>{},dispatchWorkgroups:()=>{},end:()=>{}};
    const device={limits:{maxBufferSize:1e8,maxStorageBufferBindingSize:1e8},queue:{writeBuffer:()=>{},submit:()=>{}},
      createBuffer:({label}:{label:string})=>({label,destroy:()=>{},mapAsync:async()=>{},getMappedRange:()=>fakeReport.buffer,unmap:()=>{}}),
      createShaderModule:()=>({}),createBindGroupLayout:()=>({}),createPipelineLayout:()=>({}),createComputePipeline:()=>({}),createBindGroup:()=>({}),
      createCommandEncoder:()=>({copyBufferToBuffer:(source:{label:string},_a:number,target:{label:string})=>copies.push({source:source.label,target:target.label}),beginComputePass:()=>pass,finish:()=>({})})};
    try{
      const gpu=new WaterfallMaterialReachGpu(device as unknown as GPUDevice,{nodes:triangle.map(position=>({position,velocity:[0,0,0] as ReachVec3,mass:1/6})),faces:[{nodes:[0,1,2],volume:.0005}]},{nodeCapacity:4,faceCapacity:2,indexCapacity:36,maximumIterations:2,relativeMomentumResidual:1e-5,absoluteMomentumResidual:1e-6,maximumThicknessEdgeRatio:.1,minimumTriangleQuality:.01,stopBelowY:0,maximumIndependentVolumeError:.01,maximumNumericalEnergyLossFraction:.05});
      gpu.beginEpoch('film-tick-1');expect(()=>gpu.commitEpoch('film-tick-1')).toThrow(/unaccepted/);
      await gpu.advance(.01);
      expect(gpu.indexCount).toBe(0);
      expect(copies.some(c=>c.source==='material-reach:private trial optical surface'&&c.target==='material-reach:closed optical surface')).toBe(false);
      gpu.commitEpoch('film-tick-1');expect(gpu.indexCount).toBe(24);
      expect(copies.some(c=>c.source==='material-reach:private trial optical surface'&&c.target==='material-reach:closed optical surface')).toBe(true);
      gpu.beginEpoch('film-tick-2');await gpu.advance(.01);gpu.rollbackEpoch('film-tick-2');expect(gpu.indexCount).toBe(24);
      const prior=gpu.boundaryState();
      gpu.beginEpoch('forced-row');const forcing=boundary();forcing.timeStart=.01;forcing.timeEnd=.02;gpu.setBoundaryInput('forced-row',forcing);
      await expect(gpu.advance(.02)).rejects.toThrow(/does not match inlet interval/);
      expect(gpu.boundaryState().consumed).toBe(false);
      await gpu.advance(.01);expect(gpu.boundaryState().consumed).toBe(true);
      await expect(gpu.advance(.01)).rejects.toThrow(/already consumed/);
      expect(()=>gpu.setBoundaryInput('forced-row',forcing)).toThrow(/stale/);
      gpu.rollbackEpoch('forced-row');expect(gpu.boundaryState()).toEqual(prior);
      gpu.beginEpoch('source-off');const off=boundary();off.timeStart=.01;off.timeEnd=.02;off.nodes=[];off.inletNodeIds=[];off.cutSegments=[];off.surfaceEnergyAdvection=0;gpu.setBoundaryInput('source-off',off);await gpu.advance(.01);gpu.commitEpoch('source-off');expect(gpu.boundaryState().input!.nodes).toEqual([]);
      const beforeInsertion=gpu.boundaryState();gpu.beginEpoch('insertion');fakeReport[28]=.072;
      const delta={nodes:[{id:1,position:triangle[1],mass:1/6,momentum:[0,0,0] as ReachVec3},{id:2,position:triangle[2],mass:1/6,momentum:[0,0,0] as ReachVec3},{id:3,position:[1,3,0] as ReachVec3,mass:1/6,momentum:[0,0,0] as ReachVec3}],faces:[{nodes:[2,1,3] as [number,number,number],volume:.0005}],closedIndices:new Uint32Array([0,2,4,5,3,1,4,2,6,7,3,5,0,1,2,2,1,3,2,3,6,6,3,7,6,7,4,4,7,5,4,5,0,0,5,1]),surfaceInsertion:{timeStart:0,timeEnd:.01,surfaceEnergyAdvection:.072}};
      await expect(gpu.appendDelta('insertion',delta)).rejects.toThrow(/stale/);
      // Accepted clock roundoff must still enter the exact pending interval.
      delta.surfaceInsertion.timeStart=.02+5e-13;delta.surfaceInsertion.timeEnd=.03;
      await gpu.appendDelta('insertion',delta);
      const mismatched=boundary();mismatched.timeStart=.02;mismatched.timeEnd=.04;mismatched.nodes.forEach(n=>n.prescribedVelocity=[0,50,0]);mismatched.cutSegments[0].materialVelocity=[0,50,0];mismatched.surfaceEnergyAdvection=.144;
      expect(()=>gpu.setBoundaryInput('insertion',mismatched)).toThrow(/Boundary interval differs/);
      await expect(gpu.advance(.01)).rejects.toThrow(/Pending surface insertion/);
      gpu.rollbackEpoch('insertion');expect(gpu.boundaryState()).toEqual(beforeInsertion);
    }finally{vi.unstubAllGlobals();}
  });
  it('rejects duplicate existing material ownership before an append writes to GPU',async()=>{
    vi.stubGlobal('GPUBufferUsage',{STORAGE:1,COPY_SRC:2,COPY_DST:4,VERTEX:8,INDEX:16,MAP_READ:32,UNIFORM:64});
    vi.stubGlobal('GPUShaderStage',{COMPUTE:1});
    const writeBuffer=vi.fn(),submit=vi.fn();
    const device={limits:{maxBufferSize:1e8,maxStorageBufferBindingSize:1e8},queue:{writeBuffer,submit},
      createBuffer:()=>({}),createShaderModule:()=>({}),createBindGroupLayout:()=>({}),createPipelineLayout:()=>({}),createComputePipeline:()=>({}),createBindGroup:()=>({}),
      createCommandEncoder:()=>({copyBufferToBuffer:()=>{},finish:()=>({})})};
    try{
      const gpu=new WaterfallMaterialReachGpu(device as unknown as GPUDevice,{nodes:triangle.map(position=>({position,velocity:[0,0,0] as ReachVec3,mass:1/6})),faces:[{nodes:[0,1,2],volume:.0005}]},{nodeCapacity:3,faceCapacity:2,indexCapacity:24,maximumIterations:2,relativeMomentumResidual:1e-5,absoluteMomentumResidual:1e-6,maximumThicknessEdgeRatio:.1,minimumTriangleQuality:.01,stopBelowY:0,maximumIndependentVolumeError:.01,maximumNumericalEnergyLossFraction:.05});
      gpu.beginEpoch('invalid-append');writeBuffer.mockClear();submit.mockClear();
      // This optical prism is independently closed. It does not legitimize
      // adding a second owner of the same original material triangle.
      const closedIndices=new Uint32Array([0,2,4,5,3,1,0,1,2,2,1,3,2,3,4,4,3,5,4,5,0,0,5,1]);
      await expect(gpu.appendDelta('invalid-append',{nodes:triangle.map((position,id)=>({id,position,mass:1/6,momentum:[0,0,0]})),faces:[{nodes:[0,1,2],volume:.0005}],closedIndices})).rejects.toThrow(/Duplicate material face/);
      // Structurally compatible face records must not silently lose an inlet's
      // corner distribution in the old GPU format, even with valid totals.
      const weightedFaces=[{nodes:[0,1,2] as [number,number,number],volume:.0005,cornerMass:[.1,.15,.25] as [number,number,number]}];
      await expect(gpu.appendDelta('invalid-append',{nodes:triangle.map((position,id)=>({id,position,mass:weightedFaces[0].cornerMass[id],momentum:[0,0,0]})),faces:weightedFaces,closedIndices})).rejects.toThrow(/coupled open-system/);
      expect(writeBuffer).not.toHaveBeenCalled();expect(submit).not.toHaveBeenCalled();
      expect(gpu.nodeCount).toBe(3);expect(gpu.faceCount).toBe(1);expect(gpu.indexCount).toBe(0);
      gpu.rollbackEpoch('invalid-append');
    }finally{vi.unstubAllGlobals();}
  });
});
