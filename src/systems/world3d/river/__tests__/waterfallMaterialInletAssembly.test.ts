/** Independent growing-domain controls for the actual inlet residual assembly.
 * These evaluate equations, not the unimplemented native coupled GPU solve. */
import { describe,it,expect } from 'vitest';
import { assembleMaterialInletSample,integrateMaterialInletAssembly,assembleMaterialInletBirthTrial,type MaterialInletAssemblyFace,type MaterialInletAssemblyBoundary } from '../waterfallMaterialInletAssembly';
import type { ReachLaw,ReachVec3 } from '../waterfallMaterialReach';
import { constructMaterialInletBirth } from '../waterfallMaterialInletBirth';
import type { MaterialPortInput } from '../waterfallMaterialReachPort';
import type { ContactSurface } from '../waterfallContactFlow';
import { waterfallContactGeometryIdentity } from '../waterfallContactGeometry';
const limits={nodes:8,faces:8,boundaries:4,samples:4};
const law:ReachLaw={density:2,gravity:[0,0,0],surfaceTension:0,dynamicViscosity:0};
function growing(t:number){
  const p:ReachVec3[]=[[2*t,0,0],[2*t,1,0],[0,0,0],[0,1,0]];
  const w:ReachVec3[]=[[2,0,0],[2,0,0],[0,0,0],[0,0,0]];
  const faces=([[0,1,2],[2,1,3]] as [number,number,number][]).map(nodeIds=>({nodeIds,positions:nodeIds.map(i=>p[i]),materialVelocities:nodeIds.map(()=>[2,0,0]),meshVelocities:nodeIds.map(i=>w[i]),thickness:[.5,.5,.5]} as MaterialInletAssemblyFace));
  const boundaries:MaterialInletAssemblyBoundary[]=[{nodeIds:[2,3],massRate:[2,2],velocities:[[2,0,0],[2,0,0]]}];
  return {faces,boundaries};
}
describe('source-time inlet equation assembly',()=>{
  it('includes interior relative transport so each growing node receives its correct mass',()=>{
    const g=growing(.4),s=assembleMaterialInletSample(g.faces,g.boundaries,limits,law);
    const expected=[1/3,2/3,2/3,1/3];
    for(const n of s.nodes){
      expect(n.mass).toBeCloseTo(.4*expected[n.id],13);
      expect(n.sourceMassRate+n.transportMassRate).toBeCloseTo(expected[n.id],13);
      expect(n.sourceMomentumRate[0]+n.transportMomentumRate[0]).toBeCloseTo(2*expected[n.id],13);
    }
    expect(s.nodes.reduce((a,n)=>a+n.transportMassRate,0)).toBeCloseTo(0,14);
    expect(s.momentum[0]).toBeCloseTo(1.6,13);expect(s.spatialMoment[0]).toBeCloseTo(.32,13);
    expect(s.kineticEnergy).toBeCloseTo(1.6,13);
  });
  it('balances uniform continuous births without a full-age position or gravity kick',()=>{
    const gauss=[.5-.5/Math.sqrt(3),.5+.5/Math.sqrt(3)];
    const samples=gauss.map(time=>{const g=growing(time);return {time,weight:.5,state:assembleMaterialInletSample(g.faces,g.boundaries,limits,law)};});
    const g=growing(1),end=assembleMaterialInletSample(g.faces,g.boundaries,limits,law);
    const result=integrateMaterialInletAssembly([],end.nodes,samples,0,1,limits);
    result.rows.forEach(r=>{expect(r.massResidual).toBeCloseTo(0,13);r.momentumResidual.forEach(v=>expect(v).toBeCloseTo(0,13));});
    expect(result.sourceMechanicalEnergy).toBeCloseTo(4,13);
    expect(result.physicalStepAccepted).toBe(false);
    const residentMomentumIntegral=samples.reduce((a,q)=>a+q.weight*q.state.momentum[0],0);
    expect(end.spatialMoment[0]).toBeCloseTo(residentMomentumIntegral,13);
  });
  it('keeps an omitted relative-transport term visible as a residual',()=>{
    const g=growing(1),end=assembleMaterialInletSample(g.faces,g.boundaries,limits,law);
    const q=growing(.5),state=assembleMaterialInletSample(q.faces,q.boundaries,limits,law);
    state.nodes.forEach(n=>{n.transportMassRate=0;n.transportMomentumRate=[0,0,0];});
    const result=integrateMaterialInletAssembly([],end.nodes,[{time:.5,weight:1,state}],0,1,limits);
    expect(Math.max(...result.rows.map(r=>Math.abs(r.massResidual)))).toBeGreaterThan(.3);
    expect(Math.max(...result.rows.map(r=>Math.abs(r.momentumResidual[0])))).toBeGreaterThan(.6);
  });
  it('integrates variable thickness and velocity products, retaining their kinetic variance',()=>{
    const face:MaterialInletAssemblyFace={nodeIds:[0,1,2],positions:[[0,0,0],[1,0,0],[0,1,0]],materialVelocities:[[0,0,0],[1,0,0],[0,0,0]],meshVelocities:[[0,0,0],[0,0,0],[0,0,0]],thickness:[1,2,1]};
    const s=assembleMaterialInletSample([face],[],limits,law);
    // h=1+x, u=x on the unit right triangle. Integrate x^n over
    // 0<=x<=1, 0<=y<=1-x: integral x^n=1/((n+1)(n+2)).
    expect(s.volume).toBeCloseTo(2/3,13);
    expect(s.momentum[0]).toBeCloseTo(2*(1/6+1/12),13);
    expect(s.kineticEnergy).toBeCloseTo(1/12+1/20,13);
    expect(s.lumpedKineticEnergy).toBeGreaterThan(s.kineticEnergy);
    expect(s.nodes.find(n=>n.id===1)!.transportMomentumRate[0]).toBeCloseTo(2*(1/12+1/20),13);
  });
  it('counts fixed-cut work with fluid velocity while retaining capillary boundary force',()=>{
    const g=growing(.5),s=assembleMaterialInletSample(g.faces,g.boundaries,limits,{...law,surfaceTension:.072});
    expect(s.cutPower).toBeCloseTo(-.288,13);
    expect(s.surfaceEnergyAdvectionRate).toBeCloseTo(.288,13);
    expect(s.nodes.reduce((a,n)=>a+n.membraneForce[0],0)).toBeCloseTo(0,13);
    expect(s.nodes.reduce((a,n)=>a+n.cutForce[0],0)).toBeCloseTo(-.144,13);
  });
  it('rejects duplicate source ownership, absent edges, invalid time support and capacity overflow',()=>{
    const g=growing(.5);
    expect(()=>assembleMaterialInletSample(g.faces,[...g.boundaries,...g.boundaries],limits,law)).toThrow(/unique exterior/);
    expect(()=>assembleMaterialInletSample(g.faces,[{...g.boundaries[0],nodeIds:[1,2]}],limits,law)).toThrow(/unique exterior/);
    expect(()=>assembleMaterialInletSample(g.faces,g.boundaries,{...limits,nodes:3},law)).toThrow(/ownership/);
    const state=assembleMaterialInletSample(g.faces,g.boundaries,limits,law);
    expect(()=>integrateMaterialInletAssembly([],state.nodes,[{time:0,weight:1,state}],0,1,limits)).toThrow(/temporal/);
    expect(()=>integrateMaterialInletAssembly([],state.nodes,[{time:.5,weight:.5,state}],0,1,limits)).toThrow(/temporal/);
    expect(()=>integrateMaterialInletAssembly([{id:99,mass:1,velocity:[0,0,0]}],state.nodes,[{time:.5,weight:1,state}],0,1,limits)).toThrow(/retire/);
  });
  it('rejects conflicting mesh motion and inaccurate tiny-interval quadrature',()=>{
    const g=growing(.5),state=assembleMaterialInletSample(g.faces,g.boundaries,limits,law);
    g.faces[1].meshVelocities[0]=[3,0,0];
    expect(()=>assembleMaterialInletSample(g.faces,g.boundaries,limits,law)).toThrow(/conflicting trial/);
    expect(()=>integrateMaterialInletAssembly([],state.nodes,[{time:5e-13,weight:1e-14,state}],0,1e-12,limits)).toThrow(/temporal/);
    expect(()=>integrateMaterialInletAssembly([],state.nodes,[{time:0,weight:1,state}],-Number.MAX_VALUE,Number.MAX_VALUE,limits)).toThrow(/temporal/);
  });
});

// A source release carries the original cut flux, not already transported
// material. These controls exercise the constructor and assembly together.
function sourceBirth(gravity:ReachVec3){
  const support:ContactSurface={id:'assembly-source',vertices:[[0,2,0],[1,2,0],[1,2,1],[0,2,1]],normal:[0,1,0]};
  const original:MaterialPortInput={releaseId:'original',externalBoundaryOwner:'analytic-assembly-control',support,outwardConormal:[-1,0,0],cut:{kind:'stationary',velocity:[0,0,0]},outflow:{edge:'assembly-source:downstream',face:1,start:[1,2.05,0],end:[1,2.05,1],height:.1,velocity:[2,0,0],momentum:[40,0,0],volume:.02,time:1,intervalStart:0,intervalEnd:1,origin:{surfaceId:support.id,geometryIdentity:waterfallContactGeometryIdentity(support),edge:'downstream',face:1,normal:[0,1,0],anchor:[1,.5]}}};
  return constructMaterialInletBirth([original],{endpointTime:1,gravity,reconstruction:'constant-time-linear-edge',limits:{records:4,nodes:8,faces:8,quadrature:48}});
}
describe('original release to born-material equations',()=>{
  it('balances continuous uniform translation without moving the source centroid',()=>{
    const birth=sourceBirth([0,0,0]),result=assembleMaterialInletBirthTrial(birth,limits,{...law,density:1000});
    expect(result.endpoint.volume).toBeCloseTo(.02,14);
    expect(result.endpoint.spatialMoment[0]/20).toBeCloseTo(2,12);
    expect(birth.originalSource.positionMoment[0]/.02).toBeCloseTo(1,12);
    for(const r of result.residual.rows){expect(r.massResidual).toBeCloseTo(0,11);r.momentumResidual.forEach(v=>expect(v).toBeCloseTo(0,11));}
    expect(result.mechanicalEnergyResidual).toBeCloseTo(0,10);
    expect(result.sourceReconstructionError.volume).toBeCloseTo(0,14);
    expect(result.physicalStepAccepted).toBe(false);
  });
  it('preserves gravity birth moments but exposes the affine chord energy error',()=>{
    const gravity:ReachVec3=[0,-9.81,0],birth=sourceBirth(gravity),result=assembleMaterialInletBirthTrial(birth,limits,{...law,density:1000,gravity});
    expect(result.endpoint.momentum[1]/20).toBeCloseTo(-9.81/2,11);
    expect(result.affineMinusCharacteristicVolumeMoment[1]/.02).toBeCloseTo(-9.81/12,11);
    expect(result.representedMinusCharacteristicMomentum[1]).toBeCloseTo(0,10);
    expect(result.fieldMinusCharacteristicKineticEnergy).toBeCloseTo(0,10);
    expect(result.diagonalMinusFieldKineticEnergy).toBeCloseTo(20*9.81**2/12,10);
    expect(result.mechanicalEnergyResidual).toBeCloseTo(-20*9.81**2/12,10);
    // The integrated whole-strip momentum can balance while local equations
    // still need a solve; neither condition authorizes a physical commit.
    expect(result.residual.rows.reduce((s,r)=>s+r.momentumResidual[1],0)).toBeCloseTo(0,10);
    expect(Math.max(...result.residual.rows.map(r=>Math.abs(r.massResidual)))).toBeGreaterThan(.01);
    expect(result.physicalStepAccepted).toBe(false);
    expect(()=>assembleMaterialInletBirthTrial(birth,limits,law)).toThrow(/law differs/);
  });
});
