/** CPU tests use actual Film HLL releases. They establish port arithmetic and
 * fixture-plane geometry, not native ledge clearance or GPU sheet admission. */
import { describe, expect, it } from 'vitest';
import type { ContactSurface } from '../waterfallContactFlow';
import { WaterfallContactFilm } from '../waterfallContactFilm';
import { reconstructFilmMaterialReachPort, type MaterialPortInput } from '../waterfallMaterialReachPort';

function actualInput(): MaterialPortInput {
  const support: ContactSurface={id:'fixture-ledge',vertices:[[0,2,0],[1,2,0],[1,2,1],[0,2,1]],normal:[0,1,0]};
  const film=new WaterfallContactFilm(support,1,1);
  film.capture([.5,2,.5],.1,[5,0,0]);
  const outflow=film.advance(3,.001).find(o=>o.origin?.edge==='downstream');
  if(!outflow)throw Error('Actual Film emitted no selected face release');
  return {releaseId:'film-tick-3-face-1',externalBoundaryOwner:'isolated-forced-reach',outflow,support,outwardConormal:[-1,0,0],cut:{kind:'stationary',velocity:[0,0,0]}};
}

describe('actual Film release material port',()=>{
  it('reconstructs pressure-bearing HLL moments without using donor depth as inlet thickness',()=>{
    const input=actualInput(), o=input.outflow, before=structuredClone(input), p=reconstructFilmMaterialReachPort(input);
    // The wet-to-dry outward branch transports hydrostatic pressure as well
    // as advected donor momentum. This is a real call to Film.advance.
    expect(o.velocity[0]).toBeCloseTo(5+9.81*.1/(2*5),12);
    const donorSwept=o.height*p.length*(o.intervalEnd-o.intervalStart)*p.inwardSpeed;
    expect(donorSwept/o.volume).toBeCloseTo(1+9.81*.1/(2*25),12);
    expect(p.thickness).toBeLessThan(o.height);
    expect(p.checks.sweptVolume).toBeCloseTo(o.volume,14);
    expect(p.checks.geometricSweptVolume).toBeCloseTo(o.volume,14);
    expect(p.momentum).toEqual(o.momentum);
    expect(p.checks.momentumResidual).toEqual([0,0,0]);
    expect(input).toEqual(before);
  });
  it('keeps the already offset centroid, source identity, interval and legacy mechanical energy',()=>{
    const input=actualInput(),o=input.outflow,p=reconstructFilmMaterialReachPort(input);
    expect(p.centroidStart).toEqual(o.start);expect(p.centroidEnd).toEqual(o.end);
    expect(p.centroidStart[1]).toBeCloseTo(2+o.height/2,14);
    expect((p.corners[0][1]+p.corners[3][1])/2).toBeCloseTo(o.start[1],14);
    expect(p.corners[0][1]).toBeGreaterThan(2);
    const E=1000*o.volume*(.5*o.velocity.reduce((sum,v)=>sum+v*v,0)+9.81*(o.start[1]+o.end[1])/2);
    expect(p.mechanicalEnergy).toBeCloseTo(E,12);expect(p.checks.energyResidual).toBe(0);
    expect(p.origin).toEqual(o.origin);expect(p.face).toBe(o.face);expect(p.edge).toBe(o.edge);
    expect([p.intervalStart,p.intervalEnd,p.time]).toEqual([o.intervalStart,o.intervalEnd,o.time]);
    expect(p.clearance.status).toBe('unresolved');expect(p.filmDetachment).toBe('unqualified');
    expect(p.initialSheetAdapter).toBe('pending-actual-material-geometry');
  });
  it('accepts explicit consistent release energy and rejects missing variance or impossible energy',()=>{
    const input=actualInput(), E=reconstructFilmMaterialReachPort(input).mechanicalEnergy;
    expect(reconstructFilmMaterialReachPort({...input,declaredMechanicalEnergy:E}).energySource).toBe('explicit-declared-release');
    expect(()=>reconstructFilmMaterialReachPort({...input,declaredMechanicalEnergy:E-1})).toThrow('Unrealizable');
    expect(()=>reconstructFilmMaterialReachPort({...input,declaredMechanicalEnergy:E+1})).toThrow('variance');
    expect(()=>reconstructFilmMaterialReachPort({...input,declaredMechanicalEnergy:Infinity})).toThrow('Nonfinite');
  });
  it('uses measured relative crossing speed and distinguishes the moving cut from material speed',()=>{
    const input=actualInput(), stationary=reconstructFilmMaterialReachPort(input);
    const p=reconstructFilmMaterialReachPort({...input,cut:{kind:'measured-moving',velocity:[.5,0,0],evidence:'fixture moving plane velocity'}});
    expect(p.inwardSpeed).toBeCloseTo(stationary.inwardSpeed-.5,12);
    expect(p.thickness).toBeGreaterThan(stationary.thickness);expect(p.centroidStart).toEqual(stationary.centroidStart);
    expect(p.mechanicalEnergy).toBe(stationary.mechanicalEnergy);
    expect(()=>reconstructFilmMaterialReachPort({...input,cut:{kind:'stationary',velocity:[.5,0,0]}})).toThrow('Cut motion');
    expect(()=>reconstructFilmMaterialReachPort({...input,cut:{kind:'measured-moving',velocity:[100,0,0],evidence:'measured'}})).toThrow('crossing');
  });
  it('checks the whole finite fixture-plane aperture and rejects blocked or insufficient clearance evidence',()=>{
    const input=actualInput();
    const p=reconstructFilmMaterialReachPort({...input,checkClearance:a=>({status:'clear',coverage:'whole-finite-aperture',minimumSeparation:Math.min(...a.corners.map(c=>c[1]))-2,uncertainty:0,evidence:'Exact minimum of affine aperture above actual fixture solid half-space y<=2'})});
    expect(p.clearance.status).toBe('clear');expect(p.filmDetachment).toBe('unqualified');
    for(const result of [
      {status:'blocked' as const,coverage:'whole-finite-aperture' as const,minimumSeparation:-.01,uncertainty:0,evidence:'overlap'},
      {status:'clear' as const,coverage:'whole-finite-aperture' as const,minimumSeparation:.01,uncertainty:.02,evidence:'uncertain'},
      {status:'clear' as const,coverage:'whole-finite-aperture' as const,minimumSeparation:.01,uncertainty:0,evidence:''},
    ])expect(()=>reconstructFilmMaterialReachPort({...input,checkClearance:()=>result})).toThrow('clearance');
  });
  it('rejects inconsistent original support, source timing, orientation and nonfinite moments',()=>{
    const mutations: ((i:MaterialPortInput)=>void)[]=[
      i=>{i.outflow.origin=undefined;},i=>{i.outflow.intervalEnd=i.outflow.intervalStart;},
      i=>{i.outflow.time+=1;},i=>{i.outflow.volume=0;},i=>{i.outflow.momentum[0]=NaN;},
      i=>{i.outwardConormal=[1,0,0];},i=>{i.outwardConormal=[-2,0,0];},
      i=>{i.outwardConormal=[0,1,0];},i=>{i.outflow.origin!.geometryIdentity='stale';},
      i=>{i.outflow.origin!.anchor=[0,.5];},i=>{i.outflow.start[1]+=.1;},
      i=>{i.outflow.end[0]+=.1;},i=>{i.outflow.velocity[0]+=1;},
    ];
    for(const mutate of mutations){const input=actualInput();mutate(input);expect(()=>reconstructFilmMaterialReachPort(input)).toThrow();}
  });
});
