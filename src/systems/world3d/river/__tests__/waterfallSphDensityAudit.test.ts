/** Tests the experimental precision boundary, not live-water acceptance. */
import {describe,it,expect} from 'vitest';
import {auditSphDensity} from '../waterfallSphDensityAudit';
import {evaluateSphReceiver,sphReceiverKernel,type SphReceiverParticle} from '../waterfallSphReceiver';
const rho0=Math.fround(16.173037246029705);
const plane={normalGravity:6.598920109103825,tangentGravity:7.2585,referenceDepth:rho0/1000,maximumSupportRadius:8};
function patch(cols=9,rows=5,spacing=.2):SphReceiverParticle[]{
  return Array.from({length:cols*rows},(_,i)=>({x:Math.fround((Math.floor(i/cols)-1)*spacing),y:Math.fround((i%cols+.5-cols/2)*spacing),
    vx:2,vy:0,mass:Math.fround(rho0*spacing**2),rho:rho0,h0:Math.fround(1.2*spacing),resident:i>=cols}));
}
const failures=(p:SphReceiverParticle[])=>p.map(a=>({rho:a.rho,h:a.h0,alpha:0,code:5}));
describe('stored GPU density audit',()=>{
  it('rejects a reported success whose small residual conceals a wrong pressure force',()=>{
    const referenceRho=Math.fround(20/(7*Math.PI)),r=1/256,h=39.0625;
    const p=[0,r].map(x=>({x,y:0,vx:0,vy:0,mass:1,rho:referenceRho,h0:1,resident:true}));
    const rho=Math.fround(.0005960215930826962),alpha=Math.fround(-r*sphReceiverKernel(r,h)[1]);
    const proposal=p.map(()=>({rho,h,alpha,code:0}));
    const gather=sphReceiverKernel(0,h)[0]+sphReceiverKernel(r,h)[0];
    expect(Math.abs(gather/rho-1)).toBeLessThan(1e-7);
    expect(Math.abs(h/Math.sqrt(referenceRho/rho)-1)).toBeLessThan(1e-7);
    // Independent high-precision root: h=19.219062737339, rho=.002462167875019394.
    // For this symmetric pair pressure acceleration is proportional to rho.
    expect(rho/.002462167875019394).toBeLessThan(.25);
    const before=structuredClone({p,proposal});
    expect(()=>auditSphDensity(p,{...plane,referenceDepth:referenceRho/1000,maximumSupportRadius:100},proposal))
      .toThrow('unresolved forward support accuracy');
    expect({p,proposal}).toEqual(before);
  });

  it('repairs precision exhaustion at both bounded sizes without modifying particles',()=>{
    for(const p of [patch(),patch(80,8,.125)]){
      const original=structuredClone(p),result=auditSphDensity(p,plane,failures(p)),reference=evaluateSphReceiver(p,plane,1e-12);
      expect(result.repaired).toBe(p.filter(a=>a.resident).length);
      expect(result.maxResidual).toBeLessThanOrEqual(1e-7);
      expect(result.maxCondition).toBeLessThan(1.5);
      for(let i=0;i<p.length;i++)expect(Math.abs(result.fields[i*4]/reference.rho[i]-1)).toBeLessThan(2e-7);
      expect(p).toEqual(original);
    }
  });
  it('audits false shader successes and recomputes alpha at the stored support',()=>{
    const p=patch(),first=auditSphDensity(p,plane,failures(p));
    const proposals=p.map((_,i)=>({rho:first.fields[4*i],h:first.fields[4*i+1],alpha:first.fields[4*i+2]*2,code:0}));
    proposals[19].rho=Math.fround(proposals[19].rho*1.01);
    const checked=auditSphDensity(p,plane,proposals);
    expect(checked.falseSuccesses).toBe(1);expect(checked.repaired).toBe(1);
    expect(checked.rootSolves).toBe(0);
    expect(checked.alphaRepairs).toBe(p.filter(a=>a.resident).length);
    expect(checked.maxResidual).toBeLessThanOrEqual(1e-7);
  });
  it('recovers nearby exhausted supports without repeating the global root search',()=>{
    const p=patch(80,8,.125),first=auditSphDensity(p,plane,failures(p));
    const proposals=p.map((_,i)=>({rho:Math.fround(first.fields[4*i]*1.000001),h:first.fields[4*i+1],alpha:first.fields[4*i+2],code:5}));
    const checked=auditSphDensity(p,plane,proposals);
    expect(checked.repaired).toBe(560);expect(checked.rootSolves).toBe(0);
    expect(checked.maxResidual).toBeLessThanOrEqual(1e-7);
    const reference=evaluateSphReceiver(p,plane,1e-12);
    for(let i=0;i<p.length;i++)expect(Math.abs(checked.fields[4*i]/reference.rho[i]-1)).toBeLessThan(2e-7);
  });
  it('preserves hard capacity and unsupported isolated-particle failures',()=>{
    const p=patch(),proposals=failures(p);proposals[19].code=1;
    expect(()=>auditSphDensity(p,plane,proposals)).toThrow('preserves GPU failure 1');
    proposals[19]={rho:NaN,h:p[19].h0,alpha:1,code:0};
    expect(()=>auditSphDensity(p,plane,proposals)).toThrow('preserves invalid GPU state');
    expect(()=>auditSphDensity(p,{...plane,maximumSupportRadius:.1},failures(p))).toThrow('support capacity');
    const one=[{...p[19],resident:true}];
    expect(()=>auditSphDensity(one,plane,failures(one))).toThrow('no unique finite');
  });
  it('rejects pre-quantized input ambiguity',()=>{
    const p=patch();p[19].x=.123456789;
    expect(()=>auditSphDensity(p,plane,failures(p))).toThrow('exact uploaded');
  });
  it('retains all support when roots expand across a shuffled, translated, unequal-mass patch',()=>{
    for(const swap of [false,true]){
      const p=patch(13,7,.125).reverse().map((a,i)=>({...a,
        x:Math.fround((swap?a.y:a.x)+2048),y:Math.fround((swap?a.x:a.y)-4096),
        mass:Math.fround(a.mass*(.95+.01*(i%11)))}));
      const result=auditSphDensity(p,plane,p.map(a=>({rho:a.rho,h:Math.fround(.01),alpha:0,code:5})));
      expect(result.rootSolves).toBeGreaterThan(0);
      const reference=evaluateSphReceiver(p,plane,1e-12);
      p.forEach((a,i)=>{
        if(!a.resident)return;
        const rho=result.fields[4*i],h=result.fields[4*i+1];let gather=0,alpha=0;
        // Deliberately dense: no spatial index or cached candidate list.
        p.forEach(b=>{const r=Math.hypot(a.x-b.x,a.y-b.y),[w,dw]=sphReceiverKernel(r,h);gather+=b.mass*w;alpha-=b.mass*r*dw;});
        expect(Math.abs(gather/rho-1)).toBeLessThanOrEqual(1e-7);
        expect(result.fields[4*i+2]).toBe(Math.fround(alpha));
        expect(Math.abs(rho/reference.rho[i]-1)).toBeLessThan(3e-7);
      });
    }
  });
});
