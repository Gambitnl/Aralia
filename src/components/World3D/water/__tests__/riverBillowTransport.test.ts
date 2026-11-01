import {describe,it,expect}from 'vitest';
import {billowCubic,billowCumulative,billowInverse,billowRayKnots,billowIntegrateReference}from '../riverBillowTransport';
describe('heterogeneous billow optical events',()=>{
 it('integrates cubic density including positive interiors with empty endpoints',()=>{
  const rho=(t:number)=>6*t*(1-t),c=billowCubic([rho(0),rho(1/3),rho(2/3),rho(1)],2);
  expect(billowCumulative(c,1)).toBeCloseTo(2,12);
  for(const d of [.001,.3,1,1.999]){const inverse=billowInverse(c,d,500);expect(inverse.ready).toBe(true);expect(rho(inverse.t)).toBeGreaterThan(0);expect(inverse.residual).toBeLessThanOrEqual(.002);}
 });
 it('avoids the opaque dark-midpoint error for co-located boundary illumination',()=>{
  const sigma=500,length=.5,result=billowIntegrateReference([0,length],()=>1,s=>Math.exp(-sigma*s),sigma,[sigma,sigma,sigma]);
  const analytic=.5*(1-Math.exp(-2*sigma*length));expect(result.ready).toBe(true);expect(result.radiance[0]).toBeCloseTo(analytic,3);
  const old=(1-Math.exp(-sigma*length))*Math.exp(-sigma*length*.5);expect(old).toBeLessThan(1e-40);
 });
 it('retains separated support, Beer attenuation, and reversed rays',()=>{
  const rho=(s:number)=>s<=1?s: s<2?2-s:s<3?0:s<4?s-3:5-s;
  const knots=[0,1,2,3,4,5],k=[20,25,30]as const;
  const forward=billowIntegrateReference(knots,rho,()=>1,10,k,4),back=billowIntegrateReference(knots,s=>rho(5-s),()=>1,10,k,4);
  expect(forward.liquid).toBeCloseTo(2,12);for(let c=0;c<3;c++){expect(forward.T[c]).toBeCloseTo(Math.exp(-k[c]*2),12);expect(back.T[c]).toBeCloseTo(forward.T[c],12);expect(forward.radiance[c]).toBeGreaterThan(0);}
 });
 it('uses center knots and clamp border half-cells, not ordinary voxel faces',()=>{
  const knots=billowRayKnots([0,0,0],[1,0,0],[0,0,0],[1,1,1],[3,2,2],0,3);
  expect(knots).toEqual([0,.5,1.5,2.5,3]);
  const rho=(s:number)=>s<.5?.2:s<1.5?.2+(s-.5)*.6:s<2.5?.8-(s-1.5)*.4:.4;
  const result=billowIntegrateReference(knots,rho,()=>1,0,[1,2,3]);expect(result.liquid).toBeCloseTo(1.4,12);
  const reversed=billowRayKnots([3,0,0],[-1,0,0],[0,0,0],[1,1,1],[3,2,2],0,3);expect(reversed).toEqual(knots);
 });
 it('has vacuum, absorption-only, and constant-source conservative limits',()=>{
  const vacuum=billowIntegrateReference([0,1],()=>0,()=>99,500,[501,502,503]);expect(vacuum.T).toEqual([1,1,1]);expect(vacuum.radiance).toEqual([0,0,0]);
  const absorb=billowIntegrateReference([0,1],()=>.3,()=>1,0,[1,2,3]);expect(absorb.radiance).toEqual([0,0,0]);expect(absorb.T[1]).toBeCloseTo(Math.exp(-.6),12);
  const same=billowIntegrateReference([0,1],()=>.3,()=>2,7,[7,7,7]);expect(same.radiance[0]).toBeCloseTo(2*(1-Math.exp(-2.1)),12);
 });
 it('takes one-sided pool intervals without inventing density at a positive dry endpoint',()=>{
  const knots=billowRayKnots([0,3,0],[0,-1,0],[0,0,0],[1,1,1],[2,4,2],0,3,1,1);
  expect(knots).toContain(2);
  const result=billowIntegrateReference(knots,()=>.2,()=>1,0,[2,3,4],2,mid=>mid<2);
  expect(result.liquid).toBeCloseTo(.4,12);expect(result.T[0]).toBeCloseTo(Math.exp(-.8),12);
 });
 it('converges positive event quadrature and subdivision for varying lighting',()=>{
  const evaluate=(n:number,events:2|4)=>billowIntegrateReference(Array.from({length:n+1},(_,i)=>i/n),s=>.1+.3*s,s=>Math.exp(-3*s)*(1+.2*s*s),12,[12,12,12],events).radiance[0];
  const reference=evaluate(256,4),coarse=evaluate(1,2),better=evaluate(4,4);
  expect(Math.abs(better-reference)).toBeLessThan(Math.abs(coarse-reference));expect(Math.abs(better-reference)).toBeLessThan(.001);
 });
 it('reports residual at its final returned position when the inverse cap is reached',()=>{
  const c=[1,0,0,0]as const,target=.123456789,extinction=1e12,result=billowInverse(c,target,extinction);
  expect(result.iterations).toBe(24);expect(result.ready).toBe(false);
  expect(result.residual).toBe(Math.abs(billowCumulative(c,result.t)-target)*extinction);
 });
});
