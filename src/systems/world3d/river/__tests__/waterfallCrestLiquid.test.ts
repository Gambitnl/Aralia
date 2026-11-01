import {describe,expect,it} from 'vitest';
import {WaterfallCrestLiquid,type CrestSource,type CrestVec3} from '../waterfallCrestLiquid';
const source:CrestSource={q:1.2,width:1,depth:.7,id:'native-sector'};
const small=()=>new WaterfallCrestLiquid({dt:.0025,maximumParticles:10000,tolerance:1e-9});
const center=(s:WaterfallCrestLiquid)=>{const p=s.snapshot().particles,total=p.reduce((v,p)=>v+p.volume,0);return[0,1,2].map(c=>p.reduce((v,p)=>v+p.volume*p.position[c],0)/total) as CrestVec3;};
describe('dense crest pressure/APIC control',()=>{
  it('partitions a fixed physical inventory consistently at each particle sampling resolution',()=>{
    for(const n of [1,2,4]){const s=new WaterfallCrestLiquid({particlesPerCellAxis:n,maximumParticles:40000});s.fillApproach(source);
      expect(s.receipt().particles).toBe(560*n**3);expect(s.receipt().initialVolume).toBeCloseTo(.56,12);
      const fractions=s.snapshot().volumeFraction; // Initial occupancy is exposed before the first dynamic step.
      expect(fractions.every(Number.isFinite)).toBe(true);
    }
    expect(()=>new WaterfallCrestLiquid({particlesPerCellAxis:0})).toThrow(/particlesPerCellAxis/);
  });
  it('places newborn source volume in its material-age slab and reports current occupancy',()=>{
    const s=small();s.recordSource(0,source);s.advanceTo(.0025);const snapshot=s.snapshot(),speed=source.q/(source.width*source.depth);
    for(const p of snapshot.particles){expect(p.birth).toBeGreaterThan(0);expect(p.birth).toBeLessThan(.0025);expect(p.position[0]).toBeCloseTo(s.inletX+speed*(.0025-p.birth),13);}
    expect(snapshot.receipt.emittedVolume).toBeCloseTo(source.q*.0025,14);
    expect(snapshot.receipt.occupancyTime).toBe(snapshot.receipt.time);
    expect(snapshot.volumeFraction.reduce((a,b)=>a+b,0)*snapshot.cellSize**3).toBeCloseTo(snapshot.receipt.residentVolume,14);
  });
  it('continues inlet and free-slip tangential velocity through intact APIC support',()=>{
    const s=small();s.fillApproach(source);s.recordSource(0,source);s.advanceTo(.0025);
    const speed=source.q/(source.width*source.depth),snap=s.snapshot();
    const upstream=snap.particles.filter(p=>p.sourceId==='native-sector'&&p.position[0]<-.5);
    expect(upstream.length).toBeGreaterThan(100);
    // Gravity and the open lip change pressure; the upper inlet stencil must
    // still avoid the large artificial zero-air-face slowdown.
    const rim=upstream.filter(p=>p.position[0]<-.7&&p.position[1]>69.9&&Math.abs(p.position[2])<.3);
    expect(Math.max(...rim.map(p=>Math.abs(p.velocity[0]-speed)))).toBeLessThan(.02);
    expect(Math.hypot(...snap.receipt.momentumBudgetError)).toBeLessThan(1e-8);
  });
  it('rejects unsupported voxel inlet/solid/opening phases instead of changing prescribed flux',()=>{
    expect(()=>new WaterfallCrestLiquid({inletX:-.77})).toThrow(/grid-aligned/);
    const s=small();expect(()=>s.recordSource(0,{q:1.2,width:.95,depth:.65})).toThrow(/grid-aligned/);
  });
  it('rolls back pressure, fields, particles and momentum books on failed steps',()=>{
    const s=new WaterfallCrestLiquid({maxIterations:1,tolerance:1e-13});s.seedBox([.5,68,-.2],[.9,68.4,.2],[1,.2,.1]);
    const before=s.snapshot();expect(()=>s.advanceTo(.0025)).toThrow(/capacity/);const after=s.snapshot();
    expect(after.particles).toEqual(before.particles);expect(after.u).toEqual(before.u);expect(after.v).toEqual(before.v);expect(after.w).toEqual(before.w);expect(after.pressure).toEqual(before.pressure);
    expect(after.receipt.gravityImpulse).toEqual(before.receipt.gravityImpulse);expect(after.receipt.momentumBudgetError).toEqual(before.receipt.momentumBudgetError);expect(after.receipt.time).toBe(0);
  });
  it('distributes low-flow marker flux across the opening rather than sweeping bottom rows',()=>{
    const s=small();s.recordSource(0,{...source,q:.001});s.advanceTo(.1);const p=s.snapshot().particles;
    const mean=p.reduce((sum,p)=>sum+p.volume*p.position[1],0)/p.reduce((v,p)=>v+p.volume,0);
    expect(mean).toBeGreaterThan(69.55);expect(mean).toBeLessThan(69.72);
    expect(Math.max(...p.map(p=>p.position[1]))-Math.min(...p.map(p=>p.position[1]))).toBeGreaterThan(.5);
  });
  it('requires compatible physical flux/profile and explicit initial inventory',()=>{
    const s=small();expect(()=>s.recordSource(0,{...source,speed:4})).toThrow(/Q=/);
    expect(s.receipt().residentVolume).toBe(0);s.fillApproach(source);
    expect(s.receipt().initialVolume).toBeCloseTo(.56,12);expect(s.receipt().emittedVolume).toBe(0);
    expect(s.snapshot().particles.some(p=>p.position[1]<69.5)).toBe(true);
    expect(s.snapshot().particles.some(p=>p.position[1]>69.8)).toBe(true);
  });
  it('matches SI gravity for a detached volume in freefall',()=>{
    const s=small();s.seedBox([.5,68,-.2],[.9,68.4,.2],[.3,0,0]);const before=center(s);
    s.advanceTo(.025);const after=center(s),n=10,dt=.0025;
    expect(after[0]-before[0]).toBeCloseTo(.3*n*dt,10);
    expect(after[1]-before[1]).toBeCloseTo(-9.81*dt**2*n*(n+1)/2,10);
    const r=s.receipt();expect(r.momentumBudgetError.every(v=>Math.abs(v)<1e-8)).toBe(true);expect(r.maximumDivergence).toBeLessThan(1e-7);
  });
  it('preserves a divergence-free affine shear transfer in detached liquid',()=>{
    const s=small();const shear=.4;
    s.seedBox([.5,68,-.2],[.9,68.4,.2],p=>[shear*(p[1]-68.2),0,0],'affine',[0,shear,0,0,0,0,0,0,0]);
    const before=s.snapshot().particles;s.advanceTo(.0025);const after=s.snapshot().particles;
    after.forEach((p,i)=>expect(p.velocity[0]).toBeCloseTo(before[i].velocity[0],10));
    expect(Math.hypot(...s.receipt().transferMomentumError)).toBeLessThan(1e-8);
  });
  it('keeps hydrostatic wall-adjacent quadrature unchanged when sampling is refined',()=>{
    for(const n of [2,4]){const s=new WaterfallCrestLiquid({cells:[20,40,16],solidEndX:0,particlesPerCellAxis:n,maximumParticles:40000,tolerance:1e-10});s.fillApproach({...source,q:0});
      const before=s.snapshot().particles;s.advanceTo(.0025);const after=s.snapshot().particles;
      expect(Math.max(...after.map((p,i)=>Math.hypot(...p.position.map((v,c)=>v-before[i].position[c]))))).toBeLessThan(1e-10);
      expect(Math.max(...after.map(p=>Math.hypot(...p.velocity)))).toBeLessThan(1e-7);
    }
  });
  it('balances hydrostatic head in a physically closed approach channel',()=>{
    const s=new WaterfallCrestLiquid({cellSize:.1,cells:[20,40,16],solidEndX:0,dt:.0025,tolerance:1e-10});
    s.fillApproach({...source,q:0});s.advanceTo(.0025);
    const snap=s.snapshot();expect(Math.max(...snap.particles.map(p=>Math.hypot(...p.velocity)))).toBeLessThan(1e-7);
    let count=0;
    for(let k=0;k<snap.cells[2];k++)for(let j=0;j<snap.cells[1];j++)for(let i=0;i<snap.cells[0];i++) {
      const cell=i+snap.cells[0]*(j+snap.cells[1]*k);if(snap.volumeFraction[cell]===0)continue;
      const y=snap.origin[1]+(j+.5)*snap.cellSize;
      expect(snap.pressure[cell]).toBeCloseTo(1000*9.81*(70-y),5);count++;
    }
    expect(count).toBeGreaterThan(100);
  });
  it('retains source histories, exactly integrates a short pulse and stops births',()=>{
    const s=small();s.recordSource(0,source);s.recordSource(.013,{...source,q:.3,id:'low'});s.recordSource(.017,{...source,q:0,id:'off'});s.advanceTo(.025);
    const snapshot=s.snapshot();expect(snapshot.receipt.emittedVolume).toBeCloseTo(.013*1.2+.004*.3,12);
    expect(snapshot.receipt.budgetError).toBeCloseTo(0,12);expect(snapshot.particles.every(p=>p.birth<=.017+1e-12)).toBe(true);
    const ids=snapshot.particles.map(p=>p.id);s.advanceTo(.03);expect(s.snapshot().particles.map(p=>p.id)).toEqual(ids);
    expect(()=>s.recordSource(.01,source)).toThrow(/history/);
  });
  it('produces identical accepted physical state at different rendered cadences',()=>{
    const a=small(),b=small();for(const s of [a,b]){s.fillApproach(source);s.recordSource(0,source);s.recordSource(.02,{...source,q:0});}
    a.advanceTo(.03);for(const t of [.01,.02,.03])b.advanceTo(t);
    expect(a.snapshot().particles).toEqual(b.snapshot().particles);expect(a.snapshot().pressure).toEqual(b.snapshot().pressure);
  });
  it('exports swept exits with volume and vector momentum rather than deleting water',()=>{
    const s=small();s.seedBox([2.35,68,-.1],[2.39,68.2,.1],[1,0,0],'exit');s.advanceTo(.05);
    const snap=s.snapshot();expect(snap.exits.length).toBeGreaterThan(0);expect(snap.exits.every(p=>Math.abs(p.position[0]-2.4)<1e-10)).toBe(true);
    expect(snap.receipt.budgetError).toBeCloseTo(0,12);expect(snap.receipt.exitedMomentum[0]).toBeGreaterThan(0);
    const packets=s.takeExitedPackets();expect(packets.length).toBe(snap.exits.length);expect(s.takeExitedPackets()).toEqual([]);
    expect(s.receipt().exitedVolume).toBe(snap.receipt.exitedVolume);expect(s.receipt().exitPacketsPending).toBe(0);
  });
});

describe('opt-in divergence-conforming crest transport',()=>{
  it('interpolates a discrete-curl MAC field with pointwise zero divergence',()=>{
    const s=new WaterfallCrestLiquid({transport:'divergence-conforming'}),internal=s as unknown as {field:Float64Array;offsets:number[]};
    const [nx,ny,nz]=s.cells,psi=(i:number,j:number)=>Math.sin(.6*i)*Math.cos(.4*j);
    for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<=nx;i++)internal.field[i+(nx+1)*(j+ny*k)]=psi(i,j+1)-psi(i,j);
    for(let k=0;k<nz;k++)for(let j=0;j<=ny;j++)for(let i=0;i<nx;i++)internal.field[internal.offsets[1]+i+nx*(j+(ny+1)*k)]=-psi(i+1,j)+psi(i,j);
    for(let i=0;i<20;i++)expect(Math.abs(s.sampleTransport([.4+i*.023,68.4+i*.017,-.2+i*.011]).divergence)).toBeLessThan(1e-12);
  });
  it('retains exact detached SI freefall and transfer momentum',()=>{
    const s=new WaterfallCrestLiquid({transport:'divergence-conforming'});s.seedBox([.5,68,-.2],[.9,68.4,.2],[.3,0,0]);const before=center(s);s.advanceTo(.025);const after=center(s);
    expect(after[0]-before[0]).toBeCloseTo(.3*.025,10);expect(after[1]-before[1]).toBeCloseTo(-9.81*.0025**2*10*11/2,10);
    expect(Math.hypot(...s.receipt().momentumBudgetError)).toBeLessThan(1e-8);expect(s.receipt().maximumInterpolatedDivergence).toBeLessThan(1e-6);
  });
  it('retains divergence-free affine shear with the mixed APIC moments',()=>{
    const s=new WaterfallCrestLiquid({transport:'divergence-conforming'}),shear=.4;
    s.seedBox([.5,68,-.2],[.9,68.4,.2],p=>[shear*(p[1]-68.2),0,0],'affine',[0,shear,0,0,0,0,0,0,0]);const before=s.snapshot().particles;s.advanceTo(.0025);
    s.snapshot().particles.forEach((p,i)=>expect(p.velocity[0]).toBeCloseTo(before[i].velocity[0],10));expect(Math.hypot(...s.receipt().transferMomentumError)).toBeLessThan(1e-8);
  });
  it('rejects the incompatible cubic cliff corner atomically instead of violating parity',()=>{
    const s=new WaterfallCrestLiquid({crest:0,transport:'divergence-conforming'});s.fillApproach(source);s.recordSource(0,source);const before=s.snapshot();
    expect(()=>s.advanceTo(.0025)).toThrow(/incompatible fixed flux/);const after=s.snapshot();
    expect(after.particles).toEqual(before.particles);expect(after.u).toEqual(before.u);expect(after.v).toEqual(before.v);expect(after.w).toEqual(before.w);expect(after.pressure).toEqual(before.pressure);expect(after.receipt.solenoidalExtensionImpulse).toEqual(before.receipt.solenoidalExtensionImpulse);expect(after.receipt.time).toBe(0);
  });
});

describe('opt-in flux-cell characteristic transport',()=>{
  it('retains pulse volume/birth identity after shutoff at different render cadences',()=>{
    const a=new WaterfallCrestLiquid({crest:0,transport:'flux-cell'}),b=new WaterfallCrestLiquid({crest:0,transport:'flux-cell'});
    for(const s of [a,b]){s.fillApproach(source);s.recordSource(0,source);s.recordSource(.013,{...source,q:.3,id:'low'});s.recordSource(.017,{...source,q:0,id:'off'});}
    a.advanceTo(.025);for(const t of [.01,.015,.025])b.advanceTo(t);
    expect(a.snapshot().particles).toEqual(b.snapshot().particles);expect(a.snapshot().pressure).toEqual(b.snapshot().pressure);
    const before=a.snapshot();expect(before.receipt.emittedVolume).toBeCloseTo(.013*1.2+.004*.3,12);expect(before.particles.every(p=>p.birth<=.017)).toBe(true);a.advanceTo(.03);
    expect(a.receipt().emittedVolume).toBe(before.receipt.emittedVolume);expect(a.snapshot().particles.map(p=>p.id)).toEqual(before.particles.map(p=>p.id));expect(Math.hypot(...a.receipt().momentumBudgetError)).toBeLessThan(1e-8);
  });
  it('rolls back all material, field and extension books if characteristic CFL fails',()=>{
    const s=new WaterfallCrestLiquid({crest:0,transport:'flux-cell'});s.seedBox([.4,-1,-.2],[.6,-.8,.2],[30,0,0]);const before=s.snapshot();expect(()=>s.advanceTo(.0025)).toThrow(/CFL/);const after=s.snapshot();
    expect(after.particles).toEqual(before.particles);expect(after.u).toEqual(before.u);expect(after.v).toEqual(before.v);expect(after.w).toEqual(before.w);expect(after.pressure).toEqual(before.pressure);expect(after.receipt.solenoidalExtensionImpulse).toEqual(before.receipt.solenoidalExtensionImpulse);expect(after.receipt.transportAngularDefect).toEqual(before.receipt.transportAngularDefect);expect(after.receipt.momentumBudgetError).toEqual(before.receipt.momentumBudgetError);expect(after.receipt.time).toBe(0);
  });

  it('preserves a manufactured divergence-free cell volume analytically',()=>{
    const s=new WaterfallCrestLiquid({transport:'flux-cell'}),internal=s as unknown as {field:Float64Array;offsets:number[];traceFluxCells:(p:CrestVec3,dt:number)=>{position:CrestVec3}};
    const [nx,ny,nz]=s.cells,h=s.cellSize,slopes=[.8,-.3,-.5];
    for(let c=0;c<3;c++){const dims=s.cells.map((v,a)=>v+(a===c?1:0));for(let k=0;k<dims[2];k++)for(let j=0;j<dims[1];j++)for(let i=0;i<dims[0];i++){const x=s.origin[c]+[i,j,k][c]*h;internal.field[internal.offsets[c]+i+dims[0]*(j+dims[1]*k)]=slopes[c]*(x-[.8,68.2,0][c]);}}
    const p:CrestVec3=[.75,68.15,-.025],dt=.01,base=internal.traceFluxCells(p,dt).position,diagonal=[];
    for(let c=0;c<3;c++){const q=[...p] as CrestVec3;q[c]+=1e-5;const out=internal.traceFluxCells(q,dt).position;diagonal.push((out[c]-base[c])/1e-5);expect(diagonal[c]).toBeCloseTo(Math.exp(slopes[c]*dt),8);}
    expect(diagonal.reduce((a,b)=>a*b,1)).toBeCloseTo(1,8);
  });
  it('keeps uniform freefall SI motion and exact APIC momentum bookkeeping',()=>{
    const s=new WaterfallCrestLiquid({transport:'flux-cell'});s.seedBox([.5,68,-.2],[.9,68.4,.2],[.3,0,0]);const before=center(s);s.advanceTo(.025);const after=center(s);
    expect(after[0]-before[0]).toBeCloseTo(.3*.025,10);expect(after[1]-before[1]).toBeCloseTo(-9.81*.0025**2*10*11/2,10);expect(Math.hypot(...s.receipt().momentumBudgetError)).toBeLessThan(1e-8);expect(Math.hypot(...s.receipt().transportAngularDefect)).toBeLessThan(1e-8);
  });
  it('preserves the APIC shear velocity while reporting the first-order trajectory mismatch',()=>{
    const s=new WaterfallCrestLiquid({transport:'flux-cell'}),shear=.4;s.seedBox([.5,68,-.2],[.9,68.4,.2],p=>[shear*(p[1]-68.2),0,0],'affine',[0,shear,0,0,0,0,0,0,0]);const before=s.snapshot().particles;s.advanceTo(.0025);const after=s.snapshot();
    after.particles.forEach((p,i)=>expect(p.velocity[0]).toBeCloseTo(before[i].velocity[0],10));expect(after.receipt.transportAngularDefect.every(Number.isFinite)).toBe(true);expect(Math.hypot(...after.receipt.transferMomentumError)).toBeLessThan(1e-8);
  });
  it('keeps actual crest fluid flux and continuous wall-normal traces solenoidal',()=>{
    const s=new WaterfallCrestLiquid({crest:0,transport:'flux-cell'});s.fillApproach(source);s.recordSource(0,source);s.advanceTo(.01);const r=s.receipt();
    expect(r.maximumDivergence).toBeLessThan(1e-7);expect(r.extensionResidual).toBeLessThan(1e-7);expect(r.maximumInterpolatedDivergence).toBeLessThan(1e-7);expect(Math.hypot(...r.momentumBudgetError)).toBeLessThan(1e-8);
    for(const x of [-.6,-.2,-.01])expect(Math.abs(s.sampleTransport([x,-.7,0]).velocity[1])).toBeLessThan(1e-10);
    for(const y of [-.8,-.9])expect(Math.abs(s.sampleTransport([0,y,0]).velocity[0])).toBeLessThan(1e-10);
  });
});

describe('opt-in geometric parcel-volume pressure surface',()=>{
  it('keeps the exact closed-end normal plane zero behind floor/side corners',()=>{
    const s=new WaterfallCrestLiquid({crest:0,origin:[-1,-.9,-.7],cells:[12,11,14],solidEndX:0,transport:'flux-cell',pressureSurface:'volume-kernel',surfaceSupport:.1,tolerance:1e-10});
    s.seedBox([-.8,-.7,-.5],[0,0,.5],[0,0,0]);s.advanceTo(.0025);const a=s.snapshot();
    expect(Math.max(...a.particles.map(p=>Math.hypot(...p.velocity)))).toBeLessThan(1e-7);expect(a.receipt.surfaceOccupiedVolume).toBeCloseTo(.56,12);
    for(let k=0;k<a.cells[2];k++)for(let j=0;j<a.cells[1];j++)for(let i=0;i<a.cells[0];i++){const cell=i+a.cells[0]*(j+a.cells[1]*k);if(a.volumeFraction[cell]===0)continue;const y=a.origin[1]+(j+.5)*a.cellSize;expect(a.pressure[cell]).toBeCloseTo(1000*9.81*-y,5);}
  });
  it('separates conserved raw deposition, solid leakage and corrected occupied volume',()=>{
    for(const n of [1,2,4]){const s=new WaterfallCrestLiquid({crest:0,pressureSurface:'volume-kernel',surfaceSupport:.1,particlesPerCellAxis:n,maximumParticles:40000});s.fillApproach(source);const r=s.receipt();
      expect(r.depositedVolume).toBeCloseTo(.56,11);expect(r.depositedNonSolidVolume).toBeLessThan(r.depositedVolume);expect(r.surfaceOccupiedVolume).toBeCloseTo(.56,12);expect(Math.abs(r.correctedDensityVolume-.56)).toBeLessThan(.015);
    }
  });
  it('preserves the refined physical wall opening and hydrostatic pressure head at fixed support',()=>{
    const dx=.05,s=new WaterfallCrestLiquid({crest:0,origin:[-1.2,-1,-.8],cells:[48,28,32],cellSize:dx,solidEndX:0,pressureSurface:'volume-kernel',surfaceSupport:.1,particlesPerCellAxis:1,maximumParticles:10000,tolerance:1e-10});s.fillApproach({...source,q:0});s.advanceTo(.0025);const a=s.snapshot();
    expect(a.receipt.surfaceOccupiedVolume).toBeCloseTo(.56,11);expect(a.receipt.inletPressureArea).toBeCloseTo(.7,11);expect(Math.max(...a.particles.map(p=>Math.hypot(...p.velocity)))).toBeLessThan(1e-7);
    for(let k=0;k<a.cells[2];k++)for(let j=0;j<a.cells[1];j++)for(let i=0;i<a.cells[0];i++){const cell=i+a.cells[0]*(j+a.cells[1]*k);if(a.volumeFraction[cell]===0)continue;const y=a.origin[1]+(j+.5)*dx;expect(a.pressure[cell]).toBeCloseTo(1000*9.81*-y,5);}
  });
  it('keeps the nominal source flux consistent with the reconstructed pressure opening',()=>{
    const s=new WaterfallCrestLiquid({crest:0,transport:'flux-cell',pressureSurface:'volume-kernel',surfaceSupport:.1});s.fillApproach(source);s.recordSource(0,source);s.advanceTo(.01);const r=s.receipt();
    expect(r.inletPressureArea).toBeCloseTo(.7,12);expect(r.inletPressureFlux).toBeCloseTo(1.2,12);expect(r.maximumInterpolatedDivergence).toBeLessThan(1e-7);expect(r.depositedVolume).toBeCloseTo(r.residentVolume,11);
  });
  it('rejects unresolved open-source volume without debiting emission or changing state',()=>{
    const s=new WaterfallCrestLiquid({crest:0,transport:'flux-cell',pressureSurface:'volume-kernel'});s.recordSource(0,{...source,q:.001});const before=s.snapshot();expect(()=>s.advanceTo(.0025)).toThrow('Unresolved thin/open');const after=s.snapshot();
    expect(after.particles).toEqual(before.particles);expect(after.surfaceDensity).toEqual(before.surfaceDensity);expect(after.depositedDensity).toEqual(before.depositedDensity);expect(after.receipt.emittedVolume).toBe(0);expect(after.receipt.time).toBe(0);
  });
});

describe('post-kick crest exit clock',()=>{
  const options={crest:0,dt:.0025,transport:'flux-cell' as const,origin:[-1.2,-3,-.8] as CrestVec3,cells:[40,40,16] as CrestVec3,maximumParticles:20000,tolerance:1e-10};
  it('transfers a crossing with remaining drift but no second gravity kick',()=>{
    for(const outletY of[-1.1002,-1.101,-1.1017]){
    const exported=new WaterfallCrestLiquid({...options,outletY});
    const reference=new WaterfallCrestLiquid({...options,outletY:-2.5});
    for(const s of[exported,reference])s.seedBox([.5,-1.1243,-.2],[.9,-.7243,.2],[.3,-1,0],'material');
    exported.advanceTo(.0025);reference.advanceTo(.0025);
    const packets=exported.takeExitedPackets(),states=new Map(reference.snapshot().particles.map(p=>[p.id,p]));
    expect(packets.length).toBeGreaterThan(0);
    for(const p of packets){
      expect(p.phase).toBe('post-kick-drift');expect(p.kickStartTime).toBe(0);expect(p.kickEndTime).toBe(.0025);
      expect(p.remainingDriftTime).toBeCloseTo(p.kickEndTime-p.time,14);
      expect(p.velocity[1]).toBeCloseTo(-1-9.81*.0025,10);
      const endPosition=p.position.map((x,c)=>x+p.velocity[c]*p.remainingDriftTime);
      const expected=states.get(p.id)!;endPosition.forEach((x,c)=>expect(x).toBeCloseTo(expected.position[c],10));
      p.velocity.forEach((v,c)=>expect(v).toBeCloseTo(expected.velocity[c],10));
      expect(p.sourceId).toBe('material');expect(p.birth).toBe(0);
      // The next synchronized kick starts at .0025, not at the crossing.
      expect(p.velocity[1]-9.81*.0025).toBeCloseTo(-1-9.81*.005,10);
    }
    const r=exported.receipt();expect(Math.hypot(...r.momentumBudgetError)).toBeLessThan(1e-8);
    expect(exported.takeExitedPackets()).toEqual([]);expect(exported.receipt().exitedVolume).toBe(r.exitedVolume);
    }
  });
  it('uses the actual source-event substep for kick ownership',()=>{
    const s=new WaterfallCrestLiquid({...options,outletY:-1.101});
    s.seedBox([.5,-1.1253,-.2],[.9,-.7253,.2],[.3,-1,0],'initial');
    s.recordSource(0,{q:0,width:1,depth:.7,id:'off'});s.recordSource(.001,{q:0,width:1,depth:.7,id:'event'});
    s.advanceTo(.0025);const packets=s.takeExitedPackets();expect(packets.length).toBeGreaterThan(0);
    const first=packets.filter(p=>p.kickStartTime===0);expect(first.length).toBeGreaterThan(0);
    for(const p of first){expect(p.kickEndTime).toBe(.001);expect(p.velocity[1]).toBeCloseTo(-1-9.81*.001,10);expect(p.time).toBeLessThanOrEqual(.001);expect(p.remainingDriftTime).toBeCloseTo(.001-p.time,14);}
  });
});

it('exports the actual RT0 transport derivative rather than APIC shear affine',()=>{
  const s=new WaterfallCrestLiquid({crest:70,outletY:68.899,transport:'flux-cell',tolerance:1e-10});
  s.seedBox([.5,68.8757,-.2],[.9,68.9257,.2],p=>[.4*(p[1]-68.9),-1,0],'shear',[0,.4,0,0,0,0,0,0,0]);
  s.advanceTo(.0025);const packets=s.takeExitedPackets();expect(packets.length).toBeGreaterThan(0);
  for(const p of packets){expect(p.gradientDefinition).toBe('frozen-exit-transport');expect(p.transportGradient).toHaveLength(9);expect(p.transportGradient!.every(Number.isFinite)).toBe(true);expect(p.transportGradient![1]).toBe(0);expect(Math.hypot(...p.transportGradient!)).toBeLessThan(1e-8);}
});

describe('explicit downstream support-depleted phase',()=>{
  it('does not release unresolved attached inlet water even with the opt-in enabled',()=>{const s=new WaterfallCrestLiquid({releaseSupportDepleted:true,transport:'flux-cell',pressureSurface:'volume-kernel'});s.recordSource(0,{q:.001,width:1,depth:.7,id:'small'});expect(()=>s.advanceTo(.0025)).toThrow(/Unresolved/);expect(s.receipt().emittedVolume).toBe(0);expect(s.receipt().time).toBe(0);});
});

describe('explicit kinetic bed residue',()=>{
  // Inject an already-admitted phase as a manufactured ownership control. The
  // actual pulse separately exercises the density-triggered admission path.
  const inject=(s:WaterfallCrestLiquid,position:CrestVec3,velocity:CrestVec3)=>{
    const state=s as unknown as {residue:any[];initialVolume:number;initialMomentum:CrestVec3};
    state.residue=[{id:100001,sourceId:'residue-control',birth:0,volume:.000125,position,velocity,affine:new Float64Array(9)}];state.initialVolume+=.000125;for(let c=0;c<3;c++)state.initialMomentum[c]+=.125*velocity[c];
  };
  it('advances unsupported residue during source off with contact reaction and no second debit',()=>{
    const s=new WaterfallCrestLiquid({crest:0,bedResidue:true,pressureSurface:'volume-kernel',transport:'flux-cell'});inject(s,[-.4,-.699,.1],[.5,-1,0]);s.recordSource(0,{q:0,width:1,depth:.7,id:'off'});s.advanceTo(.005);
    const a=s.snapshot();expect(a.bedResidue).toHaveLength(1);expect(a.bedResidue[0].position[0]).toBeCloseTo(-.3975,12);expect(a.bedResidue[0].position[1]).toBeCloseTo(-.7,8);expect(a.bedResidue[0].velocity).toEqual([.5,0,0]);expect(a.receipt.collisionImpulse[1]).toBeGreaterThan(.125);expect(a.receipt.budgetError).toBeCloseTo(0,14);expect(Math.hypot(...a.receipt.momentumBudgetError)).toBeLessThan(1e-10);
  });
  it('rejoins independently supported dense liquid across off/restart without lost or doubled ownership',()=>{
    const s=new WaterfallCrestLiquid({crest:0,bedResidue:true,pressureSurface:'volume-kernel',transport:'flux-cell'});s.fillApproach({...source,q:0});inject(s,[-.4,-.675,.1],[0,0,0]);s.recordSource(0,{...source,q:0,id:'off'});s.recordSource(.0025,{...source,q:.1,id:'restart'});s.advanceTo(.005);const a=s.snapshot();
    expect(a.receipt.bedResidueRejoins).toBe(1);expect(a.bedResidue).toHaveLength(0);expect(a.particles.filter(p=>p.id===100001)).toHaveLength(1);expect(a.receipt.emittedVolume).toBeCloseTo(.00025,13);expect(Math.abs(a.receipt.budgetError)).toBeLessThan(1e-12);expect(Math.hypot(...a.receipt.momentumBudgetError)).toBeLessThan(1e-8);
  });
  it('retains residue transactionally when a later dense source step rejects',()=>{
    const s=new WaterfallCrestLiquid({crest:0,bedResidue:true,pressureSurface:'volume-kernel',transport:'flux-cell'});inject(s,[-.4,-.675,.1],[.5,0,0]);s.recordSource(0,{...source,q:.001});const before=s.snapshot();expect(()=>s.advanceTo(.0025)).toThrow(/Unresolved/);const after=s.snapshot();expect(after.bedResidue).toEqual(before.bedResidue);expect(after.receipt.gravityImpulse).toEqual(before.receipt.gravityImpulse);expect(after.receipt.collisionImpulse).toEqual(before.receipt.collisionImpulse);expect(after.receipt.time).toBe(0);
  });
});

describe('bed residue capacity and closed-wall guards',()=>{
  const inject=(s:WaterfallCrestLiquid)=>{const a=s as unknown as {residue:any[];initialVolume:number;initialMomentum:CrestVec3};a.residue=[{id:100001,sourceId:'residue',birth:0,volume:.000125,position:[-.0001,-.699,.1],velocity:[.5,0,0],affine:new Float64Array(9)}];a.initialVolume=.000125;a.initialMomentum=[.0625,0,0];};
  it('counts retained residue against both seed and emitted admission capacities',()=>{
    const s=new WaterfallCrestLiquid({crest:0,bedResidue:true,maximumParticles:1});inject(s);(s as unknown as {residue:{position:CrestVec3}[]}).residue[0].position[0]=-.4;expect(()=>s.seedBox([-.4,-.65,.1],[-.39,-.64,.11],[0,0,0])).toThrow(/capacity/);s.recordSource(0,{...source,q:.001});const old=s.snapshot();expect(()=>s.advanceTo(.0025)).toThrow(/capacity/);expect(s.snapshot().bedResidue).toEqual(old.bedResidue);expect(s.receipt().emittedVolume).toBe(0);
  });
  it('keeps reduced residue behind the optional closed end with a recorded reaction',()=>{
    const s=new WaterfallCrestLiquid({crest:0,bedResidue:true,solidEndX:0,transport:'flux-cell',pressureSurface:'volume-kernel'});inject(s);s.advanceTo(.0025);const a=s.snapshot();expect(a.bedResidue).toHaveLength(1);expect(a.bedResidue[0].position[0]).toBeLessThan(0);expect(a.bedResidue[0].velocity[0]).toBe(0);expect(a.exits).toHaveLength(0);expect(a.receipt.collisionImpulse[0]).toBeCloseTo(-.0625,14);expect(Math.hypot(...a.receipt.momentumBudgetError)).toBeLessThan(1e-12);
  });
});

it('retains an upward above-bed fringe at physical bed departure',()=>{
  const s=new WaterfallCrestLiquid({crest:0,releaseSupportDepleted:true,pressureSurface:'volume-kernel',transport:'flux-cell'});
  // Manufactured end-kick state isolates phase eligibility from pressure solving.
  const a=s as unknown as {particles:any[];initialVolume:number;initialMomentum:CrestVec3;markCells:(epoch:{start:number;end:number})=>number[]};
  a.particles=[{id:100001,sourceId:'outward-arc',birth:0,volume:.000125,position:[.1,-.475,.1],velocity:[1,.8,0],affine:new Float64Array(9)}];a.initialVolume=.000125;a.initialMomentum=[.125,.1,0];a.markCells({start:0,end:.0025});const p=s.takeExitedPackets();expect(p).toHaveLength(1);expect(p[0].velocity).toEqual([1,.8,0]);expect(p[0].position).toEqual([.1,-.475,.1]);expect(p[0].remainingDriftTime).toBe(0);expect(p[0].time).toBe(.0025);expect(Math.hypot(...s.receipt().momentumBudgetError)).toBeLessThan(1e-12);expect(s.receipt().budgetError).toBe(0);
});
