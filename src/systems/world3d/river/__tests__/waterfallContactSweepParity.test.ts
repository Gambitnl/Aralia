/** Contact allocation savings must preserve the old arithmetic at every tested
 * crossing, including exact edges and unusual numeric values. */
import { describe, expect, it } from 'vitest';
import { sweepWaterfallContact, type ContactSurface, type ContactVec3 } from '../waterfallContactFlow';
import { TERRAIN_COMPARISON_CASES } from '../waterfallTerrainProfiles';

// Independent copy of the previous vector-based sweep, retained as the oracle.
const sub = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add = (a: ContactVec3, b: ContactVec3): ContactVec3 => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale = (a: ContactVec3, n: number): ContactVec3 => [a[0]*n,a[1]*n,a[2]*n];
const dot = (a: ContactVec3, b: ContactVec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function previous(start: ContactVec3, end: ContactVec3, surface: ContactSurface) {
  const d0=dot(sub(start,surface.vertices[0]),surface.normal),d1=dot(sub(end,surface.vertices[0]),surface.normal);
  if(d0 < -1e-8 || d1>=0 || d0<=d1)return null;
  const fraction=Math.max(0,d0/(d0-d1));
  const position=add(start,scale(sub(end,start),fraction));
  const [a,b,c]=surface.vertices;
  if(position[0]<a[0]||position[0]>b[0]||position[2]<a[2]||position[2]>c[2])return null;
  return {fraction,position};
}
function compare(start:ContactVec3,end:ContactVec3,surface:ContactSurface){
  const expected=previous(start,end,surface),actual=sweepWaterfallContact(start,end,surface);
  if(expected===null){expect(actual).toBeNull();return;}
  expect(actual).not.toBeNull();expect(Object.is(actual!.fraction,expected.fraction)).toBe(true);
  expected.position.forEach((n,i)=>expect(Object.is(actual!.position[i],n)).toBe(true));
}
describe('allocation-free contact sweep',()=>{
  it('matches deterministic crossings on every reference terrain face',()=>{
    let seed=81013;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(const terrain of TERRAIN_COMPARISON_CASES)for(const face of [...terrain.buildSurfaces(),...(terrain.buildBanks?.()??[])])for(let i=0;i<100;i++){
      const a=face.vertices[0],b=face.vertices[2];
      const start:ContactVec3=[a[0]+(b[0]-a[0])*(random()*2-.5),a[1]+random()*20-10,a[2]+(b[2]-a[2])*(random()*2-.5)];
      const end:ContactVec3=[start[0]+random()*4-2,start[1]+random()*20-10,start[2]+random()*4-2];
      compare(start,end,face);
    }
  });
  it('keeps exact boundary, signed zero, subnormal and nonfinite behavior',()=>{
    const face:ContactSurface={id:'flat',normal:[0,1,0],vertices:[[-1,0,-1],[1,0,-1],[1,0,1],[-1,0,1]]};
    for(const x of [-1-Number.EPSILON,-1,-0,0,1,1+Number.EPSILON,NaN,Infinity,-Infinity])
      for(const y of [-1e-7,-1e-8,-Number.MIN_VALUE,-0,0,Number.MIN_VALUE,1e-8,1,NaN,Infinity])
        compare([x,y,0],[x,-y,0],face);
  });
});
