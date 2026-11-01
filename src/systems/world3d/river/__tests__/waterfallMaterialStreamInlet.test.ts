/** These tests exercise positive source mapping and transactional admission.
 * The declared rectangle is a manufactured geometry control, not native water. */
import { describe,it,expect } from 'vitest';
import { waterfallContactGeometryIdentity } from '../waterfallContactGeometry';
import type { MaterialPortInput } from '../waterfallMaterialReachPort';
import type { ContactSurface } from '../waterfallContactFlow';
import { FilmMaterialStreamInlet,projectFilmStreamInlet,projectFilmStreamSupplyingEdge,type StreamInletGeometry,type StreamInletSource } from '../waterfallMaterialStreamInlet';

function input(id:string,z0=0,z1=.5,speed=2,start=0,height=.1):MaterialPortInput {
  const support:ContactSurface={id:'fixture',vertices:[[0,2,0],[1,2,0],[1,2,1],[0,2,1]],normal:[0,1,0]};
  return {releaseId:id,externalBoundaryOwner:'manufactured-control',support,outwardConormal:[-1,0,0],cut:{kind:'stationary',velocity:[0,0,0]},outflow:{edge:'fixture:downstream',face:1,time:start+1,intervalStart:start,intervalEnd:start+1,volume:.01,height,start:[1,2+height/2,z0],end:[1,2+height/2,z1],velocity:[speed,0,0],momentum:[20*speed/2,0,0],origin:{surfaceId:'fixture',geometryIdentity:waterfallContactGeometryIdentity(support),face:1,edge:'downstream',anchor:[1,(z0+z1)/2],normal:[0,1,0]}}};
}
const limits={records:20,nodes:20,faces:20};
function geometry():StreamInletGeometry{return {positions:[[.9,2.05,0],[1.1,2.05,0],[1.1,2.05,.5],[.9,2.05,.5],[1.1,2.05,1],[.9,2.05,1]],nodeTimes:[.5,.5,.5,.5,.5,.5],faces:[[0,1,2],[0,2,3],[3,2,4],[3,4,5]],evidence:'Manufactured same-plane rectangle control; not a native birth strip'};}
function sources():StreamInletSource[]{return [{input:input('a'),faceFractions:[{face:0,fraction:.5},{face:1,fraction:.5}]},{input:input('b',.5,1,4),faceFractions:[{face:2,fraction:.5},{face:3,fraction:.5}]}];}
describe('material stream inlet',()=>{
  it('produces connected lumped mesh with variable velocities and exact source receipts',()=>{
    const result=projectFilmStreamInlet(sources(),geometry(),limits),r=result.receipt;
    expect(result.mesh.nodes).toHaveLength(6);expect(result.mesh.faces).toHaveLength(4);
    expect(result.mesh.nodes[2].velocity[0]).toBeGreaterThan(2);expect(result.mesh.nodes[2].velocity[0]).toBeLessThan(4);
    expect(r.admittedVolume).toBeCloseTo(r.sourceVolume,14);expect(r.admittedMomentum[0]).toBeCloseTo(60,12);
    // Triangle thirds are rounded in binary64; check the reported moment
    // against arithmetic tolerance rather than require identical bit patterns.
    r.admittedSpatialMoment.forEach((v,i)=>expect(v).toBeCloseTo(r.sourceSpatialMoment[i],12));expect(r.admittedTimeMoment).toBeCloseTo(10,12);
    expect(r.signedKineticMixingLoss).toBeGreaterThan(0);expect(r.absoluteKineticMixingLoss).toBe(r.signedKineticMixingLoss);
    expect(result.sources).toEqual(sources());
  });
  it('maps edge heights explicitly and preserves moments before occupied geometry exists',()=>{
    const originals=[input('a'),input('b',.5,1,4,0,.2)],before=structuredClone(originals),p=projectFilmStreamSupplyingEdge(originals,10,10);
    expect(p.nodes).toHaveLength(3);expect(p.receipt.maximumCentroidProjectionDisplacement).toBeCloseTo(.025,12);
    expect(p.receipt.admittedMomentum[0]).toBeCloseTo(60,12);expect(p.receipt.admittedSpatialMoment[1]).toBeCloseTo(41.5,12);
    expect(p.receipt.admittedTimeMoment).toBe(10);expect(p.admission).toBe('pending-occupied-downstream-row');expect(originals).toEqual(before);
  });
  it('keeps dry gaps, supplying edges and source-off/restart intervals separate',()=>{
    const p=projectFilmStreamSupplyingEdge([input('a',0,.25),input('b',.75,1),input('restart',0,.25,2,3)],10,10);
    expect(p.nodes).toHaveLength(6);expect(p.segments.map(s=>[s.intervalStart,s.intervalEnd])).toEqual([[0,1],[0,1],[3,4]]);
    expect(projectFilmStreamSupplyingEdge([],10,10).nodes).toEqual([]);
  });
  it('rejects moment-incompatible geometry, dry bridges and unacknowledged height welds',()=>{
    const wrong=geometry();wrong.positions[0][1]+=.1;expect(()=>projectFilmStreamInlet(sources(),wrong,limits)).toThrow('alignment');
    const height=sources();height[1].input=input('b',.5,1,4,0,.2);expect(()=>projectFilmStreamInlet(height,geometry(),limits)).toThrow('alignment');
    const absent=geometry();absent.evidence='';expect(()=>projectFilmStreamInlet(sources(),absent,limits)).toThrow('Missing justified');
    const restart=sources();restart[1].input=input('b',.5,1,4,3);expect(()=>projectFilmStreamInlet(restart,geometry(),limits)).toThrow('alignment');
    const matchingRestart=geometry();matchingRestart.nodeTimes[4]=6.5;matchingRestart.nodeTimes[5]=6.5;
    expect(()=>projectFilmStreamInlet(restart,matchingRestart,limits)).toThrow('bridges');
    const dry=sources();dry[1].input=input('b',.6,1,4);const dryGeometry=geometry();dryGeometry.positions[4][2]=1.1;dryGeometry.positions[5][2]=1.1;
    expect(()=>projectFilmStreamInlet(dry,dryGeometry,limits)).toThrow('bridges');
  });
  it('bounds records, nodes and faces without mutating inputs',()=>{
    const s=sources(),g=geometry(),before=structuredClone({s,g});
    for(const key of ['records','nodes','faces'] as const)expect(()=>projectFilmStreamInlet(s,g,{...limits,[key]:1})).toThrow('capacity');
    expect(()=>projectFilmStreamSupplyingEdge(s.map(s=>s.input),10,2)).toThrow('capacity');expect({s,g}).toEqual(before);
  });
  it('rolls back owner mutation and retries the intact originals exactly once',()=>{
    const inlet=new FilmMaterialStreamInlet(limits),s=sources(),g=geometry();let inventory=20;
    expect(()=>inlet.admit(s,g,{checkpoint:()=>inventory,transfer:p=>{inventory=0;p.sources[0].input.outflow.volume=999;throw Error('owner failure');},restore:c=>{inventory=c as number;}})).toThrow('owner failure');
    expect(inventory).toBe(20);expect(s[0].input.outflow.volume).toBe(.01);
    inlet.admit(s,g,{checkpoint:()=>inventory,transfer:()=>{inventory=0;},restore:c=>{inventory=c as number;}});
    expect(()=>inlet.prepare(s,g)).toThrow('already admitted');
  });
  it('rejects duplicate source IDs and nonpositive face quadrature',()=>{
    const duplicate=sources();duplicate[1].input.releaseId='a';expect(()=>projectFilmStreamInlet(duplicate,geometry(),limits)).toThrow('Duplicate');
    const negative=sources();negative[0].faceFractions[0].fraction=-.5;expect(()=>projectFilmStreamInlet(negative,geometry(),limits)).toThrow('positive');
  });
  it('retains original inventory through source-off, restart and failed append',()=>{
    const inlet=new FilmMaterialStreamInlet({...limits,records:2});
    inlet.retain([input('a')]);inlet.retain([]);inlet.retain([input('restart',0,.5,2,3)]);
    const snapshot=inlet.pending();expect(()=>inlet.retain([input('overflow',0,.5,2,5)])).toThrow('capacity');
    expect(inlet.pending()).toEqual(snapshot);snapshot[0].outflow.volume=999;expect(inlet.pending()[0].outflow.volume).toBe(.01);
    const changed=sources();changed[0].input.outflow.volume=.02;
    expect(()=>inlet.prepare(changed,geometry())).toThrow('mutated');
  });
  it('bounds admitted-ID history instead of forgetting old release ownership',()=>{
    const inlet=new FilmMaterialStreamInlet({...limits,records:2});
    inlet.admit(sources(),geometry(),{checkpoint:()=>null,transfer:()=>{},restore:()=>{}});
    const fresh=sources();fresh[0].input.releaseId='new-a';fresh[1].input.releaseId='new-b';
    expect(()=>inlet.prepare(fresh,geometry())).toThrow('history capacity');
  });
});
