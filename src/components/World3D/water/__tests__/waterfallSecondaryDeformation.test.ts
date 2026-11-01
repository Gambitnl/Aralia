/** These checks establish the optional map's geometry contract, not realistic
 * turbulence or the volume of a self-overlapping airborne fall. */
import {describe,it,expect} from 'vitest';
import {secondarySectionMap,secondarySectionForward,secondarySectionInverse,secondarySectionRing,secondaryPolygonMoments} from '../waterfallSecondaryDeformation';
import {waterfallLiquidSection,waterfallSecondaryMap} from '../riverWaterfallView';
const near=(a:readonly number[],b:readonly number[])=>a.forEach((v,i)=>expect(v).toBeCloseTo(b[i],9));
describe('connected secondary deformation',()=>{
  it('preserves the launch exactly with a zero first age derivative',()=>{
    const m=secondarySectionMap(10,1,0,0,[.8,.1,.9,.3]);near(secondarySectionForward([2,.3],m),[2,.3]);
    const h=1e-4,n=secondarySectionMap(10,1,h,h*h,[.8,.1,.9,.3]);
    expect(Math.hypot(...secondarySectionForward([2,.3],n).map((v,i)=>v-[2,.3][i]))/h).toBeLessThan(1e-6);
  });
  it('has an exact inverse including every knot and outside the depth support',()=>{
    const m=secondarySectionMap(10,2,2,1,[.8,.1,.9,.3]);
    for(const x of [-5,-1,0,3,5])for(const y of [-5,-3,-1.5,0,1.5,3,5])near(secondarySectionInverse(secondarySectionForward([x,y],m),m),[x,y]);
  });
  it('preserves an independently finite-differenced area Jacobian',()=>{
    const m=secondarySectionMap(10,2,2,1,[.8,.1,.9,.3]),h=1e-6;
    for(const y of [-2.7,-1,.4,2]){
      const x0=secondarySectionForward([1-h,y],m),x1=secondarySectionForward([1+h,y],m);
      const y0=secondarySectionForward([1,y-h],m),y1=secondarySectionForward([1,y+h],m);
      expect(((x1[0]-x0[0])*(y1[1]-y0[1])-(y1[0]-y0[0])*(x1[1]-x0[1]))/(4*h*h)).toBeCloseTo(1,7);
    }
  });
  it('keeps fixed material edge slots and exactly maps all straight subedges',()=>{
    const ring=[[-2,-2],[2,-2],[2,2],[-2,2]] as [number,number][],m=secondarySectionMap(4,2,2,1,[.8,.1,.9,.3]);
    const out=secondarySectionRing(ring,m);expect(out.length).toBe(16);
    out.forEach((a,i)=>{
      const b=out[(i+1)%out.length],p=secondarySectionInverse(a,m),q=secondarySectionInverse(b,m);
      near(secondarySectionForward([(p[0]+q[0])/2,(p[1]+q[1])/2],m),[(a[0]+b[0])/2,(a[1]+b[1])/2]);
    });
    expect(secondaryPolygonMoments(out).area).toBeCloseTo(16,10);
  });
  it('preserves actual low/high/flood section polygon area, liquid budget and finite normals input',()=>{
    for(const [q,w,d] of [[.5,6,1.4],[12,10,.7],[120,6,.35]])for(const age of [0,.1,.4,1,2.3,3.8])for(const time of [20,20.1875]){
      const speed=q/(w*d),s=waterfallLiquidSection(q,w,speed,age,time);
      const m=waterfallSecondaryMap(s.width,s.thickness,1-s.coherence,age,time,speed),r=secondarySectionRing(s.ring,m);
      expect(Math.max(...s.ring.map(p=>Math.abs(p[1])))).toBeLessThanOrEqual(m.radius);
      const before=secondaryPolygonMoments(s.ring),after=secondaryPolygonMoments(r);
      expect(after.area/before.area).toBeCloseTo(1,9);
      expect(after.area*s.fraction/s.area).toBeCloseTo(1,9);
      expect(s.fraction).toBeLessThanOrEqual(1+1e-12);
      expect(r.flat().every(Number.isFinite)).toBe(true);
      expect(m.scale).toBeGreaterThanOrEqual(1);
      // Depth contracts toward the accepted center plane, so the existing
      // recessed-plane clearance is not consumed by this extra map.
      expect(Math.max(...r.map(p=>Math.abs(p[1])))).toBeLessThanOrEqual(Math.max(...s.ring.map(p=>Math.abs(p[1])))+1e-10);
    }
  });
  it('changes within one emission trajectory as age grows, not only at the crest',()=>{
    const a=waterfallSecondaryMap(10,3,1,1,21,12/7),b=waterfallSecondaryMap(10,3,1,2,22,12/7);
    expect(a.values).not.toEqual(b.values);expect(a.scale).not.toEqual(b.scale);
    const c=waterfallSecondaryMap(10,3,1,2,22.1875,12/7);expect(c.values).not.toEqual(b.values);
  });
  it('bounds extra transverse motion independently of the prescribed noise',()=>{
    for(const age of [0,.1,1,4.5]){
      const m=secondarySectionMap(10,2,age,1,[1,0,1,0]);
      expect(m.scale).toBeLessThanOrEqual(1.12);expect(Math.max(...m.values.map(Math.abs))).toBeLessThanOrEqual(.5);
    }
  });
});
