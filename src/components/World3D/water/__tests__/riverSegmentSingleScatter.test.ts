/** These analytic checks isolate the camera-source estimator. They do not
 * validate the GPU sun raymarch, multiple scattering or waterfall realism. */
import{describe,it,expect}from'vitest';
import{integrateSegmentSingleScatter,segmentConditionalEventMean,measureSegmentEventDensity,segmentLightPathTransmission,type SingleScatterSegment}from'../riverSegmentSingleScatter';
const rgb=(v:number)=>[v,v,v] as const;
function homogeneous(n:number,sigmaS:number,sigmaA:number,length=1):SingleScatterSegment[]{return Array.from({length:n},()=>({length:length/n,sigmaS,sigmaA:rgb(sigmaA)}));}
function denseIntegral(s:number,a:number,length:number,J:(x:number)=>number){
 const n=100000,dx=length/n,t=s+a;let sum=0;
 for(let i=0;i<n;i++){const x=(i+.5)*dx;sum+=s*Math.exp(-t*x)*J(x)*dx;}return sum;
}
describe('segment conditional solar source',()=>{
 it('adds spatially distinct sky and sun sources without duplicating collision weights',()=>{
  const segments=[{length:.7,sigmaS:2,sigmaA:rgb(.3)},{length:1.1,sigmaS:.4,sigmaA:rgb(.8)}];
  const sky=(x:number,c:number)=>x<.7?[.8,.5,.2][c]:[.1,.3,.9][c];
  const sun=(x:number,c:number)=>x<.7?[.04,.03,.02][c]:[.7,.5,.3][c];
  const combined=integrateSegmentSingleScatter(segments,(x,c)=>sky(x,c)+sun(x,c));
  const skyOnly=integrateSegmentSingleScatter(segments,sky),sunOnly=integrateSegmentSingleScatter(segments,sun);
  const T1=Math.exp(-2.3*.7),T2=Math.exp(-1.2*1.1),w1=2/2.3*(1-T1),w2=T1*.4/1.2*(1-T2);
  for(const c of [0,1,2] as const){
   const exact=w1*(sky(.35,c)+sun(.35,c))+w2*(sky(1,c)+sun(1,c));
   expect(combined.scattered[c]).toBeCloseTo(exact,12);
   expect(combined.scattered[c]).toBeCloseTo(skyOnly.scattered[c]+sunOnly.scattered[c],12);
   expect(combined.transmission[c]).toBe(sunOnly.transmission[c]);
  }
 });

 it('matches constant illumination and existing total scattering weight',()=>{
  const s=2,abs=[0,.3,1.7] as const,length=3,J=[.1,1,3] as const;
  for(const n of [1,12,24,48]){
   const r=integrateSegmentSingleScatter(Array.from({length:n},()=>({length:length/n,sigmaS:s,sigmaA:abs})),(_,c)=>J[c]);
   for(const c of [0,1,2] as const){const t=s+abs[c],T=Math.exp(-t*length),weight=s/t*(1-T);
    expect(r.transmission[c]).toBeCloseTo(T,12);expect(r.weight[c]).toBeCloseTo(weight,12);expect(r.scattered[c]).toBeCloseTo(J[c]*weight,12);
   }
  }
 });
 it('matches an independently derived two-layer piecewise-lit column',()=>{
  const r=integrateSegmentSingleScatter([{length:.7,sigmaS:2,sigmaA:rgb(.3)},{length:1.1,sigmaS:.4,sigmaA:rgb(.8)}],x=>x<.7?.2:1.5);
  const T1=Math.exp(-2.3*.7),T2=Math.exp(-1.2*1.1),exact=.2*2/2.3*(1-T1)+1.5*T1*.4/1.2*(1-T2);
  r.scattered.forEach(v=>expect(v).toBeCloseTo(exact,12));r.transmission.forEach(v=>expect(v).toBeCloseTo(T1*T2,12));
 });
 it('has finite midpoint/thick limits and color-dependent conditional events',()=>{
  expect(segmentConditionalEventMean(0,2)).toBe(1);
  expect(segmentConditionalEventMean(1e-12,2)).toBeCloseTo(1,10);
  expect(segmentConditionalEventMean(1e8,2)).toBeCloseTo(1e-8,14);
  for(const s of [0,1e-12,.01,1,1000,1e8]){const m=segmentConditionalEventMean(s,2);expect(Number.isFinite(m)).toBe(true);expect(m).toBeGreaterThanOrEqual(0);expect(m).toBeLessThanOrEqual(2);}
  const r=integrateSegmentSingleScatter([{length:1,sigmaS:2,sigmaA:[0,1,8]}],()=>1);
  expect(r.events[0][0]).toBeGreaterThan(r.events[0][1]);expect(r.events[0][1]).toBeGreaterThan(r.events[0][2]);
 });
 it('retains vacuum/absorption-only limits and a nonnegative source budget',()=>{
  const vacuum=integrateSegmentSingleScatter(homogeneous(12,0,0),()=>{throw Error('Vacuum source must not be evaluated');});
  expect(vacuum.scattered).toEqual([0,0,0]);expect(vacuum.transmission).toEqual([1,1,1]);
  const absorption=integrateSegmentSingleScatter(homogeneous(12,0,2),()=>{throw Error('Absorption has no source');});
  expect(absorption.scattered).toEqual([0,0,0]);absorption.transmission.forEach(v=>expect(v).toBeCloseTo(Math.exp(-2),12));
  const r=integrateSegmentSingleScatter(homogeneous(48,4,.2),x=>.2+.8*Math.sin(x*4)**2);
  r.scattered.forEach((v,c)=>{expect(v).toBeGreaterThanOrEqual(0);expect(v).toBeLessThanOrEqual(r.weight[c]);expect(r.weight[c]).toBeLessThanOrEqual(1-r.transmission[c]+1e-14);});
 });
 it('is continuous when the old dominant-segment winner switches',()=>{
  const tau2=.8,tau1=Math.log(2-Math.exp(-tau2));
  const evaluate=(delta:number)=>integrateSegmentSingleScatter([{length:1,sigmaS:tau1+delta,sigmaA:rgb(0)},{length:1,sigmaS:tau2,sigmaA:rgb(0)}],x=>x<1?.1:1);
  const a=evaluate(-1e-6),b=evaluate(1e-6);expect(Math.abs(a.scattered[0]-b.scattered[0])).toBeLessThan(2e-6);
  const winner=(delta:number)=>{const t=Math.exp(-tau1-delta),w1=1-t,w2=t*(1-Math.exp(-tau2));return(w1+w2)*(w1>w2?.1:1);};
  expect(Math.abs(winner(-1e-6)-winner(1e-6))).toBeGreaterThan(.5);
 });
 it('refines a spatially varying source at12/24/48 camera segments',()=>{
  const J=(x:number)=>.3+.7*Math.sin(2.1*x+.3)**2,exact=denseIntegral(3,.2,2,J);
  const error=[12,24,48].map(n=>Math.abs(integrateSegmentSingleScatter(homogeneous(n,3,.2,2),J).scattered[0]-exact));
  expect(error[1]).toBeLessThan(error[0]);expect(error[2]).toBeLessThan(error[1]);expect(error[2]).toBeLessThan(.001);
  console.log('segment source refinement',JSON.stringify({exact,error}));
 });
 it('reports the nonlinear-source bias of a maximally thick mean-event segment',()=>{
  // The conditional MEAN is not the conditional expectation of nonlinear J.
  // This example deliberately remains optically thick at48 steps; recording
  // its bias prevents calling12→48 an adequate general convergence proof.
  const J=(x:number)=>Math.exp(-500*x),exact=1000/1500*(1-Math.exp(-1500));
  const values=[12,24,48].map(n=>integrateSegmentSingleScatter(homogeneous(n,1000,0),J).scattered[0]);
  values.forEach(v=>{expect(Number.isFinite(v)).toBe(true);expect(v).toBeGreaterThan(0);expect(v).toBeLessThan(1);expect(Math.abs(v-exact)).toBeGreaterThan(.05);});
  console.log('thick nonlinear source limitation',JSON.stringify({tau:1000,exact,values,error:values.map(v=>v-exact)}));
 });
 it('rejects invalid coefficients and incoming radiance',()=>{
  expect(()=>segmentConditionalEventMean(-1,1)).toThrow('nonnegative');expect(()=>segmentConditionalEventMean(1,NaN)).toThrow('finite');
  expect(()=>integrateSegmentSingleScatter([{length:1,sigmaS:1,sigmaA:[0,NaN,0]}],()=>1)).toThrow('finite');
  expect(()=>integrateSegmentSingleScatter(homogeneous(1,1,0),()=>NaN)).toThrow('radiance');
 });
});

describe('source-position attribution',()=>{
 it('changes only the sampled source and preserves RGB camera coefficients and weights',()=>{
  const segments=[{length:1,sigmaS:10,sigmaA:[0,1,3] as const}];
  const a=integrateSegmentSingleScatter(segments,x=>x),b=integrateSegmentSingleScatter(segments,x=>x,'midpoint');
  expect(a.weight).toEqual(b.weight);expect(a.transmission).toEqual(b.transmission);expect(a.events).toEqual(b.events);
  for(const c of [0,1,2] as const){expect(b.scattered[c]).toBeCloseTo(.5*b.weight[c],12);expect(a.scattered[c]).toBeCloseTo(a.events[0][c]*a.weight[c],12);}
 });
 it('detects interior empty raw events even under the midpoint source control',()=>{
  const segments=[{length:1,sigmaS:100,sigmaA:[0,1,3] as const}];
  const density=(x:number)=>({rho:x<.1?0:.2,sigmaS:x<.1?0:100,inside:true});
  const raw=measureSegmentEventDensity(segments,density),mid=measureSegmentEventDensity(segments,density,'midpoint');
  expect(raw.nearEmpty).toEqual(raw.weight);expect(raw.zero).toEqual(raw.weight);expect(raw.fallback).toEqual([0,0,0]);
  expect(mid.nearEmpty).toEqual(raw.nearEmpty);expect(mid.weight).toEqual(raw.weight);expect(mid.effectiveNearEmpty).toEqual([0,0,0]);
 });
 it('preserves separate chromatic threshold bins and distinguishes envelope fallback',()=>{
  const segments=[{length:1,sigmaS:2,sigmaA:[0,10,100] as const}];
  const density=(x:number)=>({rho:x<.02?.0005:x<.1?.01:.2,sigmaS:x<.02?.5:x<.1?10:200,inside:x>=.02});
  const r=measureSegmentEventDensity(segments,density);
  expect(r.nearEmpty[0]).toBe(0);expect(r.nearEmpty[1]).toBe(0);expect(r.nearEmpty[2]).toBeCloseTo(r.weight[2],12);
  expect(r.lowDensity[1]).toBeCloseTo(r.weight[1],12);expect(r.fallback[2]).toBeCloseTo(r.weight[2],12);expect(r.effectiveNearEmpty[2]).toBe(0);
  expect(()=>measureSegmentEventDensity(segments,()=>({rho:NaN,sigmaS:0,inside:true}))).toThrow();
 });
});

describe('sky path abscissa attribution',()=>{
 it('preserves the old midpoint loop exactly and constant extinction for every offset',()=>{
  const length=2.3,n=8,ds=length/n,fn=(x:number)=>[1+x*x,.2+x,.5]as const;
  const depth=[0,0,0];for(let i=0;i<n;i++){const s=fn((i+.5)*ds);for(let c=0;c<3;c++)depth[c]+=s[c]*ds;}
  expect(segmentLightPathTransmission(length,n,.5,fn)).toEqual(depth.map(x=>Math.exp(-x)));
  for(const phase of [.25,.5,.75]as const){const T=segmentLightPathTransmission(length,n,phase,()=>[0,.4,2]);
   expect(T[0]).toBe(1);expect(T[1]).toBeCloseTo(Math.exp(-.4*length),14);expect(T[2]).toBeCloseTo(Math.exp(-2*length),14);}
 });
 it('shifts only the abscissa, with independently known linear extinction bias',()=>{
  for(const phase of [.25,.5,.75]as const){const positions:number[]=[];const T=segmentLightPathTransmission(2,8,phase,x=>{positions.push(x);return [x,x,x];});
   expect(positions).toHaveLength(8);expect(positions[0]).toBe(phase*.25);expect(positions[7]).toBe((7+phase)*.25);
   const integral=2+(.5*(phase-.5));T.forEach(v=>expect(v).toBeCloseTo(Math.exp(-integral),14));}
 });
 it('reveals thin-layer aliasing without changing sample count or pretending phase is convergence',()=>{
  // This layer contains the half/three-quarter abscissae but excludes .40625,
  // the quarter-cell abscissa. The analytic layer width is independent of N.
  const fn=(x:number)=>rgb(x>=.425&&x<=.47?20:0);
  const exact=Math.exp(-20*(.47-.425));
  const quarter=segmentLightPathTransmission(1,8,.25,fn)[0],mid=segmentLightPathTransmission(1,8,.5,fn)[0],threeQuarter=segmentLightPathTransmission(1,8,.75,fn)[0];
  expect(quarter).toBe(1);expect(mid).toBeCloseTo(Math.exp(-2.5),14);expect(threeQuarter).toBeCloseTo(mid,14);
  expect(Math.abs(quarter-exact)).toBeGreaterThan(.5);expect(Math.abs(mid-exact)).toBeGreaterThan(.1);
  expect(()=>segmentLightPathTransmission(1,0,.5,fn)).toThrow();expect(()=>segmentLightPathTransmission(1,8,.5,()=>rgb(NaN))).toThrow();
 });
});
