/** Focused prerequisite controls. These do not imply cascade/render acceptance. */
import {describe,it,expect} from 'vitest';
import {cascadeBox,cascadeClip,cascadeCellSplit,cascadeMoments} from '../cascadeRuntimeV1Geometry';
import {cascadeProject,cascadePhysical,type CascadePiece} from '../cascadeRuntimeV1Projection';
import {CascadeRuntimeV1,cascadePulse} from '../cascadeRuntimeV1';
import {cascadeAllocateSharedDonors,cascadeCanonicalSweptEdge} from '../cascadeRuntimeV1SharedRemap';
import {cascadeAuditEndpoint} from '../cascadeRuntimeV1Endpoint';
import {cascadeReconstructShared} from '../cascadeRuntimeV1Reconstruction';
import {cascadeAffineFinitePatch,cascadeFinitePatchCells} from '../cascadeRuntimeV1FinitePatch';
const piece=(lo:[number,number,number],hi:[number,number,number],u:number[]=[0,0,0,0,0,0]):CascadePiece=>({cell:[0,0,0],poly:cascadeBox(lo,hi),velocity:u,sourceId:'control'});
describe('cascade runtime v1 prerequisites',()=>{
  it('keeps both faces and exact volume of an oblique subcell sheet',()=>{
    let p=cascadeBox([0,0,0],[1,1,1]);p=cascadeClip(p,{normal:[1,1,0],offset:.41});p=cascadeClip(p,{normal:[-1,-1,0],offset:-.4});
    const m=cascadeMoments(p),split=cascadeCellSplit(p,.125);expect(m.volume).toBeCloseTo((.41**2-.4**2)/2,14);
    expect(split.reduce((s,q)=>s+cascadeMoments(q.poly).volume,0)).toBeCloseTo(m.volume,14);
    for(const q of split)for(const vertex of q.poly.faces.flat())for(const plane of q.poly.planes)expect(plane.normal.reduce((s,v,d)=>s+v*vertex[d],0)).toBeLessThanOrEqual(plane.offset+1e-12);
  });
  it('preserves direct three-axis momentum under isolated pressure and weak-support restriction',()=>{
    const p=piece([.2,.2,.2],[.21,.8,.8],[1,2,-.4,.8,.6,-.7]),before=cascadePhysical([p],1),projection=cascadeProject([p],[],1),after=cascadePhysical(projection.pieces,1);
    for(let d=0;d<3;d++)expect(after.momentum[d]).toBeCloseTo(before.momentum[d],10);
    expect(projection.divergence).toBeLessThan(1e-7);expect(projection.restrictionLoss).toBeGreaterThan(0);
  });
  it('keeps disconnected opposing sheets free of pressure coupling across air',()=>{
    const a=piece([.1,.2,.2],[.2,.8,.8],[1,1,0,0,0,0]),b=piece([.7,.2,.2],[.8,.8,.8],[-1,-1,0,0,0,0]);
    const result=cascadeProject([a,b],[],1);expect(result.pieces[0].velocity[0]).toBeCloseTo(1,12);expect(result.pieces[1].velocity[0]).toBeCloseTo(-1,12);
  });
  it('balances hydrostatic gravity with actual wall reaction and pressure',()=>{
    const p=piece([0,0,0],[1,1,1],[0,0,-.0981,-.0981,0,0]);
    const walls=[{lo:[0,-1,0] as [number,number,number],hi:[1,0,1] as [number,number,number]},
      {lo:[-1,0,0] as [number,number,number],hi:[0,1,1] as [number,number,number]},
      {lo:[1,0,0] as [number,number,number],hi:[2,1,1] as [number,number,number]},
      {lo:[0,0,-1] as [number,number,number],hi:[1,1,0] as [number,number,number]},
      {lo:[0,0,1] as [number,number,number],hi:[1,1,2] as [number,number,number]}];
    const result=cascadeProject([p],walls,1,1e-9,.01);expect(Math.max(...result.pieces[0].velocity.map(Math.abs))).toBeLessThan(1e-7);expect(result.wallImpulse[1]).toBeCloseTo(98.1,8);
    // The multiplier is the actual divergence constraint's impulse pressure,
    // averaged over this cell. Its independent reference is rho*g*half-height.
    expect(result.pressureCells[0].pressure).toBeCloseTo(1000*9.81*.5,7);
    const unilateral=cascadeProject([p],walls,1,1e-9,.01,null,'unilateral');expect(unilateral.wallImpulse[1]).toBeCloseTo(98.1,8);expect(unilateral.pressureCells[0].pressure).toBeCloseTo(4905,7);
    const departing=cascadeProject([piece([0,0,0],[1,1,1],[0,0,.1,.1,0,0])],walls,1,1e-9,.01,null,'unilateral');expect(departing.pieces[0].velocity[2]).toBeCloseTo(.1,12);expect(departing.wallImpulse[1]).toBeCloseTo(0,12);
  });
  it('transports co-moving current and actual thin geometry without a shadow volume book',()=>{
    const r=new CascadeRuntimeV1({solids:[],gravity:0,source:false,dt:.005});r.seed(cascadeBox([.5,.5,.5],[.51,.75,.75]),[.1,.2,.3]);r.advanceTo(.01);
    const s=r.snapshot(),actual=cascadePhysical(s.pieces,.125);expect(Math.abs(s.receipt.volumeError)).toBeLessThan(1e-9);expect(Math.max(...s.receipt.momentumError.map(Math.abs))).toBeLessThan(1e-6);expect(s.time).toBeCloseTo(.01,12);
    expect(actual.volume).toBeCloseTo(.000625,12);
    const centroid=actual.first.map(v=>v/actual.volume);for(let d=0;d<3;d++){expect(centroid[d]).toBeCloseTo([.506,.627,.628][d],11);expect(actual.momentum[d]).toBeCloseTo([.0625,.125,.1875][d],10);}
  });
  it('defines the exact pulse and source-off event',()=>{expect(cascadePulse(0)).toBe(.03);expect(cascadePulse(1)).toBe(.12);expect(cascadePulse(4)).toBe(.30);expect(cascadePulse(6)).toBe(0);expect(.03+3*.12+2*.30).toBeCloseTo(.99,14);});
  it('reuses one noncoplanar edge surface with reverse orientation',()=>{
    const p:[number,number,number]=[0,0,0],q:[number,number,number]=[1,0,0],a:[number,number,number]=[0,0,-.1],b:[number,number,number]=[1,-.1,-.1];
    const forward=cascadeCanonicalSweptEdge(0,1,p,q,a,b),reverse=cascadeCanonicalSweptEdge(1,0,q,p,b,a);
    // These are the actual shear-displaced vertices from the independent review.
    // The old traversal-dependent split encloses a false difference of 1/600.
    const key=(triangle:number[][])=>triangle.map(v=>v.join(',')).sort().join('/');
    expect(forward.map(key).sort()).toEqual(reverse.map(key).sort());
    const cone=(t:number[][])=>t[0][0]*(t[1][1]*t[2][2]-t[1][2]*t[2][1])+t[0][1]*(t[1][2]*t[2][0]-t[1][0]*t[2][2])+t[0][2]*(t[1][0]*t[2][1]-t[1][1]*t[2][0]);
    expect([...forward,...reverse].reduce((s,t)=>s+cone(t)/6,0)).toBeCloseTo(0,15);
  });
  for(const dt of [.005,1/240])it(`qualifies two uniform birth steps and source-off at dt=${dt}`,()=>{
    let input:CascadePiece[]=[];const h=.125,u:[number,number,number]=[.48,0,0];
    for(let step=1;step<=3;step++){
      const speed=step<=2?.48:null,a=cascadeAllocateSharedDonors(input,[],h,dt,speed,u),audit=cascadeAuditEndpoint(a,input,dt,speed,u),r=cascadeReconstructShared(a,input,h,dt,speed,audit);
      input=r.pieces;const m=cascadePhysical(input,h),duration=Math.min(step,2)*dt;
      expect(m.volume).toBeCloseTo(.03*duration,12);expect(audit.maximumChainError).toBeLessThan(1e-11);
      const centroid=m.first.map(v=>v/m.volume),reference=[1.25+.48*(step*dt-duration/2),2.5625,3];
      for(let d=0;d<3;d++)expect(centroid[d]).toBeCloseTo(reference[d],10);
      expect(Math.max(...input.flatMap(p=>p.poly.faces.flat().map(v=>v[0])))).toBeCloseTo(1.25+.48*step*dt,10);
      if(step===1){const old=a.donors.reduce((s,d)=>s+d.first[0],0)/a.incomingVolume;expect(old).toBeCloseTo(1.25-.48*dt/2,10);expect(Math.abs(old-reference[0])).toBeGreaterThan(.9*.48*dt);}
    }
  });
  it('qualifies the same labels on a contained thin slab crossing a cell face',()=>{
    const h=.125,dt=.005,u:[number,number,number]=[.48,0,0];
    // x+y lies between .679 and .680; independent integration gives volume
    // .001*.01*.1 and centroid (.1245,.555,.56). Both oblique faces move.
    let slab=cascadeBox([.1,.55,.51],[.15,.56,.61]);slab=cascadeClip(slab,{normal:[1,1,0],offset:.680});slab=cascadeClip(slab,{normal:[-1,-1,0],offset:-.679});
    const input=cascadeCellSplit(slab,h).map(p=>({...p,velocity:[.48,.48,0,0,0,0],sourceId:'oblique-slab'}));
    const a=cascadeAllocateSharedDonors(input,[],h,dt,null,u),audit=cascadeAuditEndpoint(a,input,dt,null,u),r=cascadeReconstructShared(a,input,h,dt,null,audit),m=cascadePhysical(r.pieces,h);
    expect(m.volume).toBeCloseTo(.000001,13);expect(m.first[0]/m.volume).toBeCloseTo(.1269,11);expect(m.first[1]/m.volume).toBeCloseTo(.555,11);expect(m.first[2]/m.volume).toBeCloseTo(.56,11);expect(r.pieces.some(p=>p.cell[0]===1)).toBe(true);
    for(const p of r.pieces)for(const vertex of p.poly.faces.flat()){expect(vertex[0]+vertex[1]).toBeGreaterThanOrEqual(.6814-1e-12);expect(vertex[0]+vertex[1]).toBeLessThanOrEqual(.6824+1e-12);}
  });
  it('maps both broad sides and four rims through one common affine shear geometry oracle',()=>{
    let slab=cascadeBox([.1,.55,.51],[.15,.56,.61]);slab=cascadeClip(slab,{normal:[1,1,0],offset:.680});slab=cascadeClip(slab,{normal:[-1,-1,0],offset:-.679});
    // This is a full-affine GEOMETRY oracle. It does not claim that the pressure
    // runtime's six diagonal-linear velocity DOFs can carry physical shear.
    const patch=cascadeAffineFinitePatch(slab,{matrix:[[1,.4,0],[0,1,0],[0,0,1]],shift:[.01,0,0]},1,'shear-oracle'),m=cascadeMoments(patch.poly);
    expect(m.volume).toBeCloseTo(.000001,13);expect(m.first[0]/m.volume).toBeCloseTo(.3565,11);expect(m.first[1]/m.volume).toBeCloseTo(.555,11);expect(m.first[2]/m.volume).toBeCloseTo(.56,11);expect(patch.facets).toHaveLength(6);
    const coordinates=patch.poly.faces.flat().map(v=>v[0]+.6*v[1]);expect(Math.min(...coordinates)).toBeCloseTo(.689,13);expect(Math.max(...coordinates)).toBeCloseTo(.690,13);
    for(const f of patch.facets){expect(f.pair).not.toBeNull();for(const id of f.vertices)expect(patch.vertices[id].facets).toContain(f.id);}
    expect(cascadeFinitePatchCells(patch,.125).reduce((s,p)=>s+cascadeMoments(p.poly).volume,0)).toBeCloseTo(m.volume,13);
  });
});
