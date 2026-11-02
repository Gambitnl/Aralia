/** Analytic fields exercise the local interface classifier. These tests do
 * not establish rendered billows or a global water-light transport solution. */
import { describe,expect,it } from 'vitest';
import { DataUtils } from 'three';
// The optical functions moved out of riverWaterfallView.ts (agora-e9e1 split).
import { waterfallInterfaceNormal,waterfallTwoStream } from '../riverWaterfallOptics';
type V=readonly[number,number,number];
const axes:readonly[V,V,V]=[[1,0,0],[0,1,0],[0,0,1]];
const old:V=[0,0,1],view:V=[0,0,1],steps:V=[.2,.2,.2];
const near=(a:V,b:V)=>a.forEach((v,i)=>expect(v).toBeCloseTo(b[i],10));
const normal=(v:V):V=>{const l=Math.hypot(...v);return v.map(x=>x/l) as unknown as V;};
function plane(n:V):[number,number,number,number,number,number] {
  return axes.flatMap((a,i)=>{const d=a.reduce((sum,x,j)=>sum+x*n[j],0)*steps[i]*.9;return [.5-d,.5+d];}) as [number,number,number,number,number,number];
}
describe('resolved waterfall interface normal',()=>{
  it('recovers a tilted analytic interface rather than the envelope normal',()=>{
    const n=normal([.4,-.3,.8]);const r=waterfallInterfaceNormal(plane(n),steps,axes,old,view);
    expect(r.confidence).toBe(1);expect(r.fallback).toBe(false);near(r.normal,n);
  });
  it('disabled mode preserves its given baseline exactly',()=>{
    const r=waterfallInterfaceNormal([NaN,0,0,0,0,0],[0,0,0],axes,old,view,false);
    expect(r.normal).toEqual(old);expect(r.confidence).toBe(0);expect(r.fallback).toBe(true);
  });
  it('rejects plateau, empty, invalid and unresolved samples without unstable normals',()=>{
    for(const values of [[.5,.5,.5,.5,.5,.5],[0,0,0,0,0,0],[NaN,0,.5,.5,.5,.5],[Infinity,0,.5,.5,.5,.5],[.501,.5,.5,.5,.5,.5]]){
      const r=waterfallInterfaceNormal(values as [number,number,number,number,number,number],steps,axes,old,view);
      expect(r.normal).toEqual(old);expect(r.fallback).toBe(true);
    }
    expect(waterfallInterfaceNormal(plane([0,0,1]),[0,.2,.2],axes,old,view).fallback).toBe(true);
  });
  it('does not amplify half-float quantization in a nearly constant field',()=>{
    const quantize=(v:number)=>DataUtils.fromHalfFloat(DataUtils.toHalfFloat(Math.fround(v)));
    const values=[.5002,.4998,.5001,.4999,.5,.5].map(quantize) as [number,number,number,number,number,number];
    const r=waterfallInterfaceNormal(values,steps,axes,old,view);
    expect(r.confidence).toBe(0);expect(r.normal.every(Number.isFinite)).toBe(true);
  });
  it('blends a partially resolved interface and faces both normals toward the camera',()=>{
    const r=waterfallInterfaceNormal([.43,.5,.5,.5,.5,.5],steps,axes,[0,0,-1],[1,0,1]);
    expect(r.confidence).toBeGreaterThan(0);expect(r.confidence).toBeLessThan(1);
    expect(Math.hypot(...r.normal)).toBeCloseTo(1,12);
    expect(r.normal[0]+r.normal[2]).toBeGreaterThan(0);
  });
  it('falls back when opposed grazing normals cancel during blending',()=>{
    const r=waterfallInterfaceNormal([.5,.40625,.5,.5,.5,.5],steps,axes,[1,0,0],[0,1,0]);
    expect(r.confidence).toBe(0);expect(r.fallback).toBe(true);expect(r.normal).toEqual([1,0,0]);
  });
  it('rotates with the field, atlas frame, camera and incident light',()=>{
    const rotate=(v:V):V=>[v[2],v[0],v[1]];
    const n=normal([.4,-.3,.8]),samples=plane(n);
    const a=waterfallInterfaceNormal(samples,steps,axes,old,view);
    const b=waterfallInterfaceNormal(samples,steps,axes.map(rotate) as unknown as readonly[V,V,V],rotate(old),rotate(view));
    near(b.normal,rotate(a.normal));expect(b.confidence).toBe(a.confidence);
    const light=normal([.5,.7,.2]);const cosine=(n:V,l:V)=>n.reduce((sum,v,i)=>sum+v*l[i],0);
    expect(cosine(a.normal,light)).toBeCloseTo(cosine(b.normal,rotate(light)),12);
  });
  it('retains a conservative nonnegative slab partition at flipped/grazing orientations',()=>{
    for(const n of [[1,0,0],[0,0,-1],[.4,.3,.8]] as V[]) {
      const unit=normal(n),facing=Math.max(.02,Math.abs(unit[2]));
      for(const s of [0,.0001,1,10000]) for(const absorption of [0,.01,10]) {
        const p=waterfallTwoStream(s*facing,absorption*facing);
        expect(p.reflection).toBeGreaterThanOrEqual(0);expect(p.transmission).toBeGreaterThanOrEqual(0);expect(p.absorption).toBeGreaterThanOrEqual(0);
        expect(p.reflection+p.transmission+p.absorption).toBeCloseTo(1,10);
      }
    }
  });
});
