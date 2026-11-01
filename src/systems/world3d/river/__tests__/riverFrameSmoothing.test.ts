/** Paired old/new display smoothing: exact bits, including drying cells. */
import {describe,expect,it} from 'vitest';
import {meanOfAverage} from '../riverSolver';
import {smoothRiverFrame} from '../riverFrameSmoothing';

function state(n:number){
  return {acc:{sh:new Float64Array(n),shu:new Float64Array(n),shv:new Float64Array(n),su2:new Float64Array(n)},
    display:{h:new Float32Array(n),qu:new Float32Array(n),qv:new Float32Array(n),q2:new Float32Array(n)}};
}
function previous(s:ReturnType<typeof state>,span:number,a:number,ar:number){
  if(!(span>0))return;
  const mean=meanOfAverage(s.acc.sh,s.acc.shu,s.acc.shv,s.acc.su2,span),d=s.display;
  for(let c=0;c<d.h.length;c++){
    const h=mean.h[c],qu=h*mean.u[c],qv=h*mean.v[c];
    d.h[c]+=a*(h-d.h[c]);d.qu[c]+=a*(qu-d.qu[c]);d.qv[c]+=a*(qv-d.qv[c]);
    const q2=h*(mean.u[c]*mean.u[c]+mean.v[c]*mean.v[c]+mean.uRms[c]*mean.uRms[c]);
    d.q2[c]+=ar*(q2-d.q2[c]);
  }
  for(const field of Object.values(s.acc))field.fill(0);
}
function compare(a:ReturnType<typeof state>,b:ReturnType<typeof state>){
  for(const key of ['h','qu','qv','q2'] as const){
    expect(new Uint32Array(a.display[key].buffer)).toEqual(new Uint32Array(b.display[key].buffer));
  }
  for(const key of ['sh','shu','shv','su2'] as const)expect(a.acc[key]).toEqual(b.acc[key]);
}

describe('river display smoothing without temporary mean maps',()=>{
  it('matches the prior Float32 output bit for bit across consecutive changing wet and dry frames',()=>{
    const a=state(8192),b=state(8192);let seed=9163;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let frame=0;frame<12;frame++){
      const span=.01+random()*3,weight=1-Math.exp(-span/.35),rmsWeight=1-Math.exp(-span/2);
      for(let c=0;c<a.acc.sh.length;c++){
        const mass=c%5===frame%5?0:random()*4,u=(random()-.5)*30,v=(random()-.5)*20,rms=random()*2;
        a.acc.sh[c]=b.acc.sh[c]=mass;
        a.acc.shu[c]=b.acc.shu[c]=mass*u;a.acc.shv[c]=b.acc.shv[c]=mass*v;
        a.acc.su2[c]=b.acc.su2[c]=mass*(u*u+v*v+rms*rms);
      }
      previous(a,span,weight,rmsWeight);smoothRiverFrame(b.acc,b.display,span,weight,rmsWeight);compare(a,b);
    }
  });
  it('retains the small-mass velocity cutoff and cancellation behavior in the variance',()=>{
    const masses=[0,1e-12,1e-6,1e-6+Number.EPSILON,.1,1000];const a=state(masses.length),b=state(masses.length);
    for(let c=0;c<masses.length;c++){
      const mass=masses[c];a.acc.sh[c]=b.acc.sh[c]=mass;
      a.acc.shu[c]=b.acc.shu[c]=mass/3;a.acc.shv[c]=b.acc.shv[c]=-mass/7;
      a.acc.su2[c]=b.acc.su2[c]=mass*(1/9+1/49)-Number.EPSILON;
    }
    previous(a,.137,.29,.13);smoothRiverFrame(b.acc,b.display,.137,.29,.13);compare(a,b);
    expect(b.display.qu[2]).toBe(0);expect(b.display.qu[3]).toBeGreaterThan(0);
  });
  it('decays a formerly wet display cell while preserving a frame with no accumulated time',()=>{
    const a=state(1),b=state(1);
    for(const key of ['h','qu','qv','q2'] as const)a.display[key][0]=b.display[key][0]=2;
    previous(a,0,.2,.1);smoothRiverFrame(b.acc,b.display,0,.2,.1);compare(a,b);
    expect(b.display.h[0]).toBe(2);
    previous(a,1,.2,.1);smoothRiverFrame(b.acc,b.display,1,.2,.1);compare(a,b);
    expect(b.display.h[0]).toBe(Math.fround(1.6));expect(b.display.q2[0]).toBe(Math.fround(1.8));
  });
});
