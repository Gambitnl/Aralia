/** Analytic controls for causal trial construction; no physical solver runs.
 * Source shape assumptions and affine chord error remain separate receipts. */
import {describe,it,expect} from 'vitest';
import type {ContactSurface} from '../waterfallContactFlow';
import type {MaterialPortInput} from '../waterfallMaterialReachPort';
import {waterfallContactGeometryIdentity} from '../waterfallContactGeometry';
import {constructMaterialInletBirth,evaluateMaterialInletBirth,type MaterialInletBirthOptions} from '../waterfallMaterialInletBirth';
const support:ContactSurface={id:'birth-source',vertices:[[0,2,0],[1,2,0],[1,2,1],[0,2,1]],normal:[0,1,0]};
function input(id='a',z0=0,z1=1,speed=2,start=0,end=1,volume=.02):MaterialPortInput{return {releaseId:id,externalBoundaryOwner:'analytic-birth-control',support,outwardConormal:[-1,0,0],cut:{kind:'stationary',velocity:[0,0,0]},outflow:{edge:'birth-source:downstream',face:1,start:[1,2.05,z0],end:[1,2.05,z1],height:.1,velocity:[speed,0,0],momentum:[1000*volume*speed,0,0],volume,time:end,intervalStart:start,intervalEnd:end,origin:{surfaceId:support.id,geometryIdentity:waterfallContactGeometryIdentity(support),edge:'downstream',face:1,normal:[0,1,0],anchor:[1,(z0+z1)/2]}}};}
function options(end=1):MaterialInletBirthOptions{return {endpointTime:end,gravity:[0,0,0],reconstruction:'constant-time-linear-edge',limits:{records:20,nodes:80,faces:40,quadrature:240}};}
const mean=(moment:number,volume:number)=>moment/volume;
describe('causal material inlet birth',()=>{
  it('constructs a downstream translation strip with distinct source and transported moments',()=>{
    const i=input(),before=structuredClone(i),b=constructMaterialInletBirth([i],options());
    expect(b.classification).toBe('source-time-trial-only');expect(b.nodes).toHaveLength(4);expect(b.faces).toHaveLength(2);
    expect(b.nodes.every(n=>n.position[0]>=1)).toBe(true);expect(b.nodes.filter(n=>n.normalizedBirth===0).map(n=>n.position[0])).toEqual([3,3]);
    expect(mean(b.originalSource.positionMoment[0],b.originalSource.volume)).toBe(1);expect(mean(b.endpoint.characteristic.positionMoment[0],b.endpoint.source.volume)).toBeCloseTo(2,12);
    expect(b.endpoint.source.momentum[0]).toBeCloseTo(40,12);expect(b.endpoint.characteristic.momentum[0]).toBeCloseTo(40,12);
    expect(b.endpoint.affineMinusCharacteristicPositionMoment[0]).toBeCloseTo(0,14);expect(i).toEqual(before);
    expect(b.faces.reduce((s,f)=>s+f.volume,0)).toBeCloseTo(.02,14);expect(b.nodes.reduce((s,n)=>s+n.mass,0)).toBeCloseTo(20,12);
  });
  it('integrates continuous births with gravity 1/6 centroid and 1/2 velocity; reports chord defect',()=>{
    const o=options();o.gravity=[0,-9.81,0];const b=constructMaterialInletBirth([input()],o),e=b.endpoint,V=e.source.volume;
    expect(mean(e.characteristic.positionMoment[1],V)).toBeCloseTo(2.05-9.81/6,12);
    expect(mean(e.characteristic.velocityVolumeMoment[1],V)).toBeCloseTo(-9.81/2,12);
    expect(mean(e.affineMinusCharacteristicPositionMoment[1],V)).toBeCloseTo(-9.81/12,12);
    expect(e.source.ageVolumeMoment/V).toBeCloseTo(.5,12);expect(e.source.ageSquaredVolumeMoment/V).toBeCloseTo(1/3,12);expect(e.source.birthTimeMoment/V).toBeCloseTo(.5,12);
    const incoming=e.source.kineticEnergy+1000*9.81*e.source.positionMoment[1],transported=e.characteristic.kineticEnergy+1000*9.81*e.characteristic.positionMoment[1];
    expect(transported).toBeCloseTo(incoming,10);expect(e.signedMomentumProjectionLoss).toBeGreaterThan(0);expect(e.lumpedMinusFieldKineticEnergy).toBeGreaterThan(0);
  });
  it('evaluates born-only positive temporal triangles and separates mesh from material velocity',()=>{
    const b=constructMaterialInletBirth([input()],options()),e=evaluateMaterialInletBirth(b,.25);
    expect(e.source.volume).toBeCloseTo(.005,14);expect(e.source.birthTimeMoment/e.source.volume).toBeCloseTo(.125,12);
    expect(e.faces.every(f=>f.quadrature.every(q=>q.volume>0&&q.birthTime>=0&&q.birthTime<=.25))).toBe(true);
    const newest=b.nodes.filter(n=>n.normalizedBirth===1).map(n=>n.id);
    for(const f of e.faces)f.nodeIds.forEach((id,k)=>{if(newest.includes(id)){expect(f.meshVelocities[k]).toEqual([0,0,0]);expect(f.materialVelocities[k]).toEqual([2,0,0]);}});
    expect(e.boundaries[0].massRate).toEqual([20,20]);expect(b.temporalQuadrature.reduce((s,q)=>s+q.weight,0)).toBe(1);
    const empty=evaluateMaterialInletBirth(b,0);expect(empty.faces).toEqual([]);expect(empty.nodeMass).toEqual([0,0,0,0]);expect(empty.nodalProjectedVelocities).toEqual([null,null,null,null]);
  });
  it('preserves varying shared edge velocities and affine flux against independent polynomial integrals',()=>{
    const sources=[input('a',0,.5,2),input('b',.5,1,4)],o=options();o.gravity=[0,-9.81,0];o.edgeFluxEndpoints={a:[.01,.03],b:[.03,.01]};const b=constructMaterialInletBirth(sources,o),e=b.endpoint;
    const integrate=(b0:number,b1:number,u0:number,u1:number,z0:number,dz:number)=>{
      const db=b1-b0,du=u1-u0,V=b0+db/2,U=b0*u0+(b0*du+db*u0)/2+db*du/3,K=b0*u0*u0+(2*b0*u0*du+db*u0*u0)/2+(b0*du*du+2*db*u0*du)/3+db*du*du/4;
      return {V,U,K,Z:z0*V+dz*(b0/2+db/3)};
    };
    const a=integrate(.01,.03,2,3,0,.5),c=integrate(.03,.01,3,4,.5,.5),V=a.V+c.V,U=a.U+c.U,K=500*(a.K+c.K);
    expect(e.source.volume).toBeCloseTo(V,14);expect(e.source.momentum[0]).toBeCloseTo(1000*U,11);expect(e.source.kineticEnergy).toBeCloseTo(K,11);
    expect(e.source.positionMoment[2]).toBeCloseTo(a.Z+c.Z,14);expect(e.characteristic.positionMoment[0]).toBeCloseTo(V+.5*U,13);expect(e.characteristic.positionMoment[1]).toBeCloseTo(2.05*V-9.81*V/6,13);
    const f=e.faces[0];expect(f.cornerMass[0]).toBeCloseTo(1000*.5*(2*.01+.03+.03)/12,12);expect(f.cornerMass[0]).not.toBeCloseTo(1000*f.volume/3,6);
    expect(f.thickness[0]).toBeLessThan(f.thickness[1]);expect(b.sourceEdgeProjection.nodes.some(n=>n.velocity[0]===3)).toBe(true);
    expect(e.nodeTrialMomentum.reduce((s,p)=>s+p[0],0)).toBeCloseTo(e.characteristic.momentum[0],11);
  });
  it('keeps actual dry spans and restart epochs disconnected',()=>{
    const b=constructMaterialInletBirth([input('left',0,.25),input('right',.75,1)],options());expect(b.wetComponents).toHaveLength(2);expect(b.nodes).toHaveLength(8);
    const restarted=constructMaterialInletBirth([input('restart',0,.25,2,3,4)],options(4));expect(restarted.intervalStart).toBe(3);expect(restarted.nodes.every(n=>n.birthTime>=3)).toBe(true);
    expect(()=>constructMaterialInletBirth([input(),input('restart',0,1,2,3,4)],options(4))).toThrow('one exact original');
  });
  it('uses actual resident IDs/state as explicit constraints and never overwrites resident solve',()=>{
    const o=options(2);o.firstNewNodeId=100;o.residentOldestRow=[{sourceEdgeNode:0,residentId:42,position:[2.7,2.05,0],velocity:[1.7,0,0],meshVelocity:[1.7,0,0]},{sourceEdgeNode:1,residentId:43,position:[2.7,2.05,1],velocity:[1.7,0,0],meshVelocity:[1.7,0,0]}];const before=structuredClone(o),b=constructMaterialInletBirth([input('next',0,1,2,1,2)],o);
    expect(b.nodes.filter(n=>n.resident).map(n=>n.id)).toEqual([42,43]);expect(b.nodes.filter(n=>n.resident).map(n=>n.position[0])).toEqual([2.7,2.7]);expect(b.endpoint.residentConstraintPositionMoment[0]).toBeLessThan(0);expect(o).toEqual(before);
    expect(()=>evaluateMaterialInletBirth(b,1.5)).toThrow('actual same-time');
    const active=o.residentOldestRow.map(r=>({...r,position:[1.8,2.05,r.position[2]] as [number,number,number]}));expect(evaluateMaterialInletBirth(b,1.5,active).faces).toHaveLength(2);
  });
  it('rejects invalid capacity, flux, area and nonfinite data atomically',()=>{
    const i=input(),before=structuredClone(i);
    for(const key of ['records','nodes','faces','quadrature'] as const){const o=options();o.limits[key]=1;expect(()=>constructMaterialInletBirth([input('left',0,.5),input('right',.5,1)],o)).toThrow('capacity');}
    const invalid=options();invalid.edgeFluxEndpoints={a:[.01,.04]};expect(()=>constructMaterialInletBirth([i],invalid)).toThrow('integrate original');
    // Use the actual projected cut coordinates, including their binary64
    // rounding, so this is truly zero area rather than a sub-ULP sliver.
    const cutNodes=constructMaterialInletBirth([i],options()).sourceEdgeProjection.nodes;
    const collapsed=options();collapsed.residentOldestRow=cutNodes.map((n,k)=>({sourceEdgeNode:k,residentId:8+k,position:[...n.position],velocity:[2,0,0],meshVelocity:[2,0,0]}));expect(()=>constructMaterialInletBirth([i],collapsed)).toThrow('positive-area');
    const overflow=options();overflow.gravity=[Number.MAX_VALUE,Number.MAX_VALUE,0];expect(()=>constructMaterialInletBirth([i],overflow)).toThrow();expect(i).toEqual(before);
  });
});
