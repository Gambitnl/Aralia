import{describe,it,expect}from'vitest';
import{WaterfallCrestJetReceiver}from'../waterfallCrestJetReceiver';
import{WaterfallCrestLiquid,type CrestExit,type CrestVec3}from'../waterfallCrestLiquid';
const packet=(overrides:Partial<CrestExit>={}):CrestExit=>({id:1,sourceId:'source',birth:0,volume:.001,position:[1,10,0],velocity:[.3,-1.024525,0],time:.001,phase:'post-kick-drift',kickStartTime:0,kickEndTime:.0025,remainingDriftTime:.0015,boundary:'bottom',...overrides});
describe('transactional measured thick jet receiver',()=>{
  it('finishes residual drift with supplied momentum and kicks only later epochs',()=>{const r=new WaterfallCrestJetReceiver();const p=packet();r.step(.0025,[p]);let s=r.snapshot();expect(s.particles[0].velocity).toEqual(p.velocity);expect(s.particles[0].position[1]).toBeCloseTo(10+p.velocity[1]*.0015,14);expect(s.receipt.gravityImpulse).toEqual([0,0,0]);r.step(.005);s=r.snapshot();expect(s.particles[0].velocity[1]).toBeCloseTo(-1-9.81*.005,14);expect(s.receipt.momentumError.every(v=>Math.abs(v)<1e-12)).toBe(true);expect(s.particles[0].phase).toBe('thick-pressure-free');});
  it('rejects duplicate, invalid and past epochs without changing any material or books',()=>{const r=new WaterfallCrestJetReceiver();const before=r.snapshot();for(const batch of[[packet(),packet()],[packet({volume:0})],[packet({kickStartTime:-.1})],[packet({remainingDriftTime:.002})],[packet({volume:1,velocity:[1e308,1e308,0]})]]){expect(()=>r.step(.0025,batch)).toThrow();expect(r.snapshot()).toEqual(before);}r.step(.0025,[packet()]);const accepted=r.snapshot();expect(()=>r.step(.005,[packet({kickStartTime:.0025,kickEndTime:.005,time:.003,remainingDriftTime:.002})])).toThrow(/Duplicate/);expect(r.snapshot()).toEqual(accepted);expect(()=>r.step(.001)).toThrow(/out-of-order/);expect(r.snapshot()).toEqual(accepted);});
  it('matches uninterrupted uniform freefall across actual crest exits and later kicks',()=>{
    const exported=new WaterfallCrestLiquid({crest:0,outletY:-1.101,transport:'flux-cell',tolerance:1e-10}),reference=new WaterfallCrestLiquid({crest:0,outletY:-2.5,transport:'flux-cell',tolerance:1e-10}),receiver=new WaterfallCrestJetReceiver();
    for(const s of[exported,reference])s.seedBox([.5,-1.1243,-.2],[.9,-.7243,.2],[.3,-1,0],'initial');
    for(const end of[.0025,.005,.0075]){exported.advanceTo(end);reference.advanceTo(end);receiver.step(end,exported.takeExitedPackets());const states=new Map(reference.snapshot().particles.map(p=>[p.id,p]));for(const p of receiver.snapshot().particles){const expected=states.get(p.id)!;expect(p.volume).toBe(expected.volume);expect(p.sourceId).toBe(expected.sourceId);expect(p.birth).toBe(expected.birth);p.position.forEach((x,c)=>expect(x).toBeCloseTo(expected.position[c],9));p.velocity.forEach((v,c)=>expect(v).toBeCloseTo(expected.velocity[c],9));}const receipt=receiver.receipt();expect(Math.hypot(...receipt.momentumError)).toBeLessThan(1e-10);}
  });
});

describe('retained receiving-plane arrivals',()=>{
  it('records the actual drift crossing time and post-kick momentum once',()=>{const r=new WaterfallCrestJetReceiver({receivingPlane:9.999});const p=packet();r.step(.0025,[p]);const snap=r.snapshot();expect(snap.particles).toEqual([]);expect(snap.arrivals).toHaveLength(1);const a=snap.arrivals[0];expect(a.time).toBeCloseTo(p.time+(9.999-p.position[1])/p.velocity[1],13);expect(a.position[1]).toBe(9.999);expect(a.velocity).toEqual(p.velocity);expect(a.sourceId).toBe(p.sourceId);expect(a.birth).toBe(p.birth);expect(snap.receipt.arrivedVolume).toBe(p.volume);expect(snap.receipt.volumeError).toBeCloseTo(0,14);expect(Math.hypot(...snap.receipt.momentumError)).toBeLessThan(1e-12);expect(r.takeArrivals()).toEqual(snap.arrivals);expect(r.takeArrivals()).toEqual([]);expect(r.receipt().arrivedVolume).toBe(p.volume);});
  it('rolls back a full arrival queue and succeeds after retained arrivals are acknowledged',()=>{const r=new WaterfallCrestJetReceiver({receivingPlane:9.999,maximumArrivalPackets:1});r.step(.0025,[packet()]);const before=r.snapshot();const next=packet({id:2,time:.0035,kickStartTime:.0025,kickEndTime:.005});expect(()=>r.step(.005,[next])).toThrow(/arrival queue/);expect(r.snapshot()).toEqual(before);r.takeArrivals();r.step(.005,[next]);expect(r.receipt().arrivals).toBe(2);expect(r.receipt().arrivedVolume).toBeCloseTo(.002,14);});
});

it('keeps render snapshots from mutating the measured transport derivative',()=>{const r=new WaterfallCrestJetReceiver({receivingPlane:0});const p=packet({transportGradient:[1,0,0,0,-1,0,0,0,0],gradientDefinition:'frozen-exit-transport'});r.step(.0025,[p]);p.transportGradient![0]=7;const a=r.snapshot();expect(a.particles[0].transportGradient![0]).toBe(1);a.particles[0].transportGradient![0]=8;expect(r.snapshot().particles[0].transportGradient![0]).toBe(1);});

describe('optional swept vertical cliff contact',()=>{
  const packet=()=>({id:1001,sourceId:'wall-control',birth:0,volume:.001,position:[.005,.5,0] as CrestVec3,velocity:[-1,-1,.5] as CrestVec3,time:0,boundary:'support-depleted' as const,phase:'post-kick-drift' as const,kickStartTime:0,kickEndTime:.02,remainingDriftTime:.02});
  it('orders wall contact before arrival and accounts its normal impulse without a new kick',()=>{
    const r=new WaterfallCrestJetReceiver({dt:.02,gravity:0,cliff:{x:0,top:1},receivingPlane:.49});r.step(.02,[packet()]);const a=r.snapshot().arrivals[0];expect(a.time).toBeCloseTo(.01,14);expect(a.cliffContactTime).toBeCloseTo(.005,14);expect(a.position).toEqual([0,.49,.0050000000000000044]);expect(a.velocity).toEqual([0,-1,.5]);expect(r.receipt().cliffImpulse).toEqual([1,0,0]);expect(r.receipt().gravityImpulse).toEqual([0,0,0]);expect(Math.hypot(...r.receipt().momentumError)).toBeLessThan(1e-14);
  });
  it('does not apply a wall impulse after the parcel already reaches the receiving plane',()=>{
    const r=new WaterfallCrestJetReceiver({dt:.02,gravity:0,cliff:{x:0,top:1},receivingPlane:.498});r.step(.02,[packet()]);expect(r.receipt().cliffContacts).toBe(0);expect(r.snapshot().arrivals[0].velocity[0]).toBe(-1);expect(r.snapshot().arrivals[0].position[0]).toBeCloseTo(.003,14);
  });
  it('rolls back contact reaction together with rejected arrival queue admission',()=>{
    const r=new WaterfallCrestJetReceiver({dt:.02,gravity:0,cliff:{x:0,top:1},receivingPlane:.49,maximumArrivalPackets:1});const before=r.snapshot();expect(()=>r.step(.02,[packet(),{...packet(),id:1002}])).toThrow(/arrival queue/);expect(r.snapshot()).toEqual(before);
  });
  it('keeps tangential gravity motion on later wall steps and rejects inside-cliff admission',()=>{
    const r=new WaterfallCrestJetReceiver({dt:.02,cliff:{x:0,top:1}});r.step(.02,[packet()]);r.step(.04);const a=r.snapshot().particles[0];expect(a.position[0]).toBe(0);expect(a.velocity[0]).toBe(0);expect(a.velocity[1]).toBeCloseTo(-1-9.81*.02,14);expect(r.receipt().cliffContacts).toBe(1);expect(Math.hypot(...r.receipt().momentumError)).toBeLessThan(1e-14);
    const bad=new WaterfallCrestJetReceiver({dt:.02,cliff:{x:0,top:1}});expect(()=>bad.step(.02,[{...packet(),position:[-.01,.5,0]}])).toThrow(/inside cliff/);expect(bad.receipt().admittedVolume).toBe(0);
  });
});
