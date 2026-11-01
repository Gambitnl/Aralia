/** Checks the experimental subdivision before spending a first-impact run.
 * These are geometry, finite-source partition and rollback checks; they cannot
 * establish realistic impact, wet footprint or real-time performance. */
import {describe,it,expect} from 'vitest';
import {WaterfallContactFilm, type FilmCell} from '../waterfallContactFilm';
import {WaterfallContactFlow, type ContactOptions} from '../waterfallContactFlow';
import {WaterfallSourceSupport,FiniteSourceSupply} from '../waterfallSourceSupport';
const source={q:1.5,width:10,depth:.7,speed:1.5/7,top:78,pool:18};
const options:ContactOptions={startTime:0,dt:1/60,parcelsPerStep:6,maxStepsPerAdvance:1,maxParcels:20000,impactMode:'junction',filmMode:'four-layer-hydrostatic-v1',sourceSupportMode:'finite-birth-span-v1',firstImpactModel:'kinetic-exact-v1',originalReleaseRouting:{ownerId:'subdivision-test',capacity:20000,select:r=>r.map(x=>x.id)}};
const create=(refined=false)=>new WaterfallContactFlow({...options,...(refined?{filmSubdivision:'4x3-v1' as const}:{})});
function prepared(refined=false){const f=create(refined);f.advanceTo(1/60,()=>source);expect(f.snapshot().receipt.failure).toBeNull();return f;}
const area=(c:FilmCell)=>{
 const triangle=(a:number[],b:number[],d:number[])=>{const u=b.map((v,k)=>v-a[k]),v=d.map((x,k)=>x-a[k]);return .5*Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);};
 return triangle(c.corners[0],c.corners[1],c.corners[2])+triangle(c.corners[0],c.corners[2],c.corners[3]);
};
describe('fixed impact spatial subdivision',()=>{
 it('retains every parent corner and area with twelve dry children, below existing capacity',()=>{
  const base=prepared().snapshot().film!, fine=prepared(true).snapshot().film!;
  expect([base.nx,base.nz]).toEqual([13,22]);expect([fine.nx,fine.nz]).toEqual([52,66]);
  expect(fine.cells.length).toBe(3432);expect(fine.cells.every(c=>c.volume===0)).toBe(true);
  for(let j=0;j<base.nz;j++)for(let i=0;i<base.nx;i++){
   const parent=base.cells[j*base.nx+i],children=Array.from({length:12},(_,k)=>fine.cells[(j*3+Math.floor(k/4))*fine.nx+i*4+k%4]);
   expect(children.reduce((s,c)=>s+area(c),0)).toBeCloseTo(area(parent),11);
   expect(children[0].corners[0]).toEqual(parent.corners[0]);expect(children[3].corners[1]).toEqual(parent.corners[1]);
   expect(children[11].corners[2]).toEqual(parent.corners[2]);expect(children[8].corners[3]).toEqual(parent.corners[3]);
  }
 });
 it('reintegrates actual finite source across new receiver boundaries without duplicating incoming water',()=>{
  const f=prepared(true),s=f.saveState(),film=new WaterfallContactFilm(s.filmSurface!,12,16,64,.35,'four-layer-hydrostatic-v1','kinetic-exact-v1');
  film.restoreState(s.filmState!);
  const release={edge:'source:5',start:[0,77.65,10/3] as [number,number,number],end:[0,77.65,5] as [number,number,number],intervalStart:0,intervalEnd:1/60,birthTime:1/120,velocity:[1.5/7,0,0] as [number,number,number]};
  const model=new WaterfallSourceSupport(release,1.5/60/6,s.filmSurface!);
  const supply=new FiniteSourceSupply([{id:5,model}],film.junctionSegments(),1e-6,0,0,false,'kinetic-exact-v1');
  const interval=supply.interval(0,2),actual=model.arrivals(0,2).moments;
  expect(interval.samples.reduce((v,row)=>v+row.minus.volume+row.plus.volume,0)).toBeCloseTo(actual.volume,13);
  expect(interval.closure.relativeMaximum).toBeLessThan(1e-6);
  expect(new Set(interval.samples.map(row=>row.face)).size).toBeGreaterThan(3);
 });
 it('round trips the fixed mesh and rejects restoring it into the default solver',()=>{
  const f=prepared(true),state=f.saveState(),restored=create(true);restored.restoreState(state);
  expect(restored.saveState()).toEqual(state);
  expect(()=>create().restoreState(state)).toThrow('subdivision mismatch');
  const wrong=structuredClone(state);delete wrong.filmState!.junctionGeometry!.subdivision;
  expect(()=>create(true).restoreState(wrong)).toThrow('subdivision mismatch');
 });
 it('retains the refined checkpoint through a rejected outer tick',()=>{
  const f=prepared(true),before=f.saveState();
  f.advanceTo(2/60,()=>({...source,width:11}));
  expect(f.snapshot().receipt.failure).toBeTruthy();expect(f.snapshot().receipt.time).toBe(1/60);
  expect(f.saveState().filmState).toEqual(before.filmState);
 });
 it('rejects unsupported refinement and exceeds no original mesh cap',()=>{
  expect(()=>new WaterfallContactFlow({...options,firstImpactModel:'hydraulic-be-v1',filmSubdivision:'4x3-v1'})).toThrow('subdivision');
  const s=prepared().saveState(),film=new WaterfallContactFilm(s.filmSurface!,12,40,64,.35,'four-layer-hydrostatic-v1','kinetic-exact-v1');
  expect(()=>film.configureJunction({...s.filmState!.junctionGeometry!,subdivision:'4x3-v1'})).toThrow('capacity');
  expect(film.nx).toBe(12);expect(film.nz).toBe(40);
 });
});
