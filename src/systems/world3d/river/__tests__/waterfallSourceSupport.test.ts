/** Source-measure checks use the actual integration routine. They qualify
 * midsurface bookkeeping, not native waterfall realism or the nonlinear ports. */
import { describe, it, expect, vi } from 'vitest';
import { FINITE_SOURCE_SUPPORT_MODE, FiniteSourceSupply, FiniteSourceQuadratureFailure, WaterfallSourceSupport, emptySourceSupportMoments, addSourceSupportMoments } from '../waterfallSourceSupport';
import { FOUR_LAYER_FILM_MODE } from '../waterfallLayeredFilm';
import type { WaterfallContactFilm } from '../waterfallContactFilm';
import { getWaterfallContactSurfaces, WaterfallContactFlow, type ContactSurface, type SheetRelease, type ContactOriginalReleaseRouting } from '../waterfallContactFlow';
const release: SheetRelease = { edge: 'source:5', start: [0,77.65,10/3], end: [0,77.65,5], intervalStart: 0, intervalEnd: 1/60, birthTime: 1/120, velocity: [1.5/7,0,0] };
const V=1.5/60/6, rho=1000, g=9.81;
describe('finite birth and transverse source support', () => {
  it('constant flight shifts the full uniform birth interval without midpoint concentration', () => {
    const surface: ContactSurface={id:'constant-flight',vertices:[[-.5,64,-12],[8,64,-12],[8,64,12],[-.5,64,12]],normal:[0,1,0]};
    const support=new WaterfallSourceSupport(release,V,surface), age=Math.sqrt(2*(77.65-64)/g);
    expect(support.firstArrival).toBeCloseTo(age,14); expect(support.lastArrival).toBeCloseTo(age+1/60,14);
    const half=support.arrivals(age,age+1/120);
    expect(half.moments.volume).toBeCloseTo(V/2,14); expect(half.moments.arrivalTimeMoment/half.moments.volume).toBeCloseTo(age+1/240,14);
    expect(support.arrivals(0,support.firstArrival).moments.volume).toBe(0);
    expect(support.remaining(age+1/120).volume).toBeCloseTo(V/2,14);
  });
  it('the native sloped support integrates primitive moments and is partition invariant', () => {
    const support=new WaterfallSourceSupport(release,V,getWaterfallContactSurfaces()[0]);
    const full=support.arrivals(0,2).moments, lo=support.ageAt(5), hi=support.ageAt(10/3), beta=support.beta;
    const I=(n:number)=>beta*(1/60)/.22*(g*(hi**(n+2)-lo**(n+2))/(n+2)-.65*(1.5/7)*(hi**(n+1)-lo**(n+1))/(n+1));
    expect(full.volume).toBeCloseTo(V,13);
    expect(full.momentum[0]).toBeCloseTo(rho*(1.5/7)*V,11); expect(full.momentum[1]).toBeCloseTo(-rho*g*I(1),10);
    expect(full.positionMoment[0]).toBeCloseTo((1.5/7)*I(1),13);
    expect(full.positionMoment[1]).toBeCloseTo(77.65*V-.5*g*I(2),12); expect(full.positionMoment[2]).toBeCloseTo(V*(10/3+5)/2,13);
    expect(full.kinetic).toBeCloseTo(.5*rho*((1.5/7)**2*V+g*g*I(2)),9);
    expect(full.potential).toBeCloseTo(rho*g*(77.65*V-.5*g*I(2)),9);
    expect(full.arrivalTimeMoment).toBeCloseTo(V/120+I(1),13);
    const sum=emptySourceSupportMoments();
    for(const [a,b] of [[0,1.64],[1.64,1.65],[1.65,1.657],[1.657,1.67],[1.67,2]]) addSourceSupportMoments(sum,support.arrivals(a,b).moments);
    for(const key of ['volume','kinetic','potential','arrivalTimeMoment'] as const) expect(sum[key]).toBeCloseTo(full[key],9);
    for(let k=0;k<3;k++){expect(sum.momentum[k]).toBeCloseTo(full.momentum[k],10);expect(sum.positionMoment[k]).toBeCloseTo(full.positionMoment[k],12);}
    const spatial=emptySourceSupportMoments(); addSourceSupportMoments(spatial,support.arrivals(0,2,10/3,4.5).moments);addSourceSupportMoments(spatial,support.arrivals(0,2,4.5,5).moments);
    expect(spatial.volume).toBeCloseTo(full.volume,13);expect(spatial.arrivalTimeMoment).toBeCloseTo(full.arrivalTimeMoment,13);
    expect(support.arrivals(0,1.65).moments.volume/V).toBeCloseTo(.3172,3);
  });
  it('remaining ownership retains birth-age kinetic variance and closes energy and gravity impulse', () => {
    const support=new WaterfallSourceSupport(release,V,getWaterfallContactSurfaces()[0]), time=1.65;
    const air=support.remaining(time), hit=support.arrivals(0,time).moments;
    expect(air.volume+hit.volume).toBeCloseTo(V,13);
    const meanK=air.momentum.reduce((s,p)=>s+p*p,0)/(2*rho*air.volume);
    expect(air.kinetic).toBeGreaterThan(meanK);
    expect(air.kinetic+air.potential+hit.kinetic+hit.potential).toBeCloseTo(rho*V*(.5*(1.5/7)**2+g*77.65),9);
    const traveledAgeMoment=(air.positionMoment[0]+hit.positionMoment[0])/(1.5/7);
    expect(air.momentum[1]+hit.momentum[1]).toBeCloseTo(-rho*g*traveledAgeMoment,10);
    expect(air.momentum[0]+hit.momentum[0]).toBeCloseTo(rho*V*(1.5/7),12);
  });
  it('rejects unsupported source or finite ledge rather than falling back to a point', () => {
    expect(()=>new WaterfallSourceSupport({...release,velocity:[1,1,0]},V,getWaterfallContactSurfaces()[0])).toThrow('unreconstructible');
    expect(()=>new WaterfallSourceSupport({...release,start:[0,77.65,20],end:[0,77.65,21]},V,getWaterfallContactSurfaces()[0])).toThrow('unsupported-first-ledge');
  });
  it('integrated curve ports retain primitive ownership and a grouped bounded discrepancy witness', () => {
    const model=new WaterfallSourceSupport(release,V,getWaterfallContactSurfaces()[0]);
    const start=model.positionAt(model.ageAt(model.z0),model.z0),end=model.positionAt(model.ageAt(model.z1),model.z1);
    const chord=end.map((v,k)=>v-start[k]) as [number,number,number],length=Math.hypot(...chord);
    const n=model.surface.normal,e=chord.map(v=>v/length),normal:[number,number,number]=[e[1]*n[2]-e[2]*n[1],e[2]*n[0]-e[0]*n[2],e[0]*n[1]-e[1]*n[0]];
    const segments=[{face:7,start,end,length,normal,minusCell:0,plusCell:1}];
    const supply=new FiniteSourceSupply([{id:42,model}],segments,1e-6),interval=supply.interval(0,2);
    expect(interval.samples.reduce((s,row)=>s+row.minus.volume+row.plus.volume,0)).toBeCloseTo(V,13);
    expect(interval.closure.worstGroup).toMatchObject({originalId:42,face:7});
    expect(interval.closure.differences).toHaveLength(12);expect(interval.closure.relativeMaximum).toBeLessThan(1e-6);
    expect(interval.ordinaryChordMeasure.get(7)).toBeCloseTo(length*(2-1/60),12);
    supply.accept(interval);expect(supply.steps[0].deliveredByOriginal[0].moments.volume).toBeCloseTo(V,13);
    try {new FiniteSourceSupply([{id:42,model}],segments,1e-20).interval(0,2);throw Error('missing rejection');}
    catch(error){expect(error).toBeInstanceOf(FiniteSourceQuadratureFailure);expect((error as FiniteSourceQuadratureFailure).diagnostic.closure.worstGroup).toMatchObject({originalId:42,face:7});}
  });
});

describe('finite support ownership transactions', () => {
  const source = { q: .006, width: 10, depth: .7, speed: .1, top: 78, pool: 18 };
  const dt = 1/120;
  const routing: ContactOriginalReleaseRouting={ownerId:'source-unit-terminal',capacity:1000,select:rows=>rows.map(row=>row.id)};
  const make = () => new WaterfallContactFlow({startTime:0,dt,parcelsPerStep:2,impactMode:'junction',filmMode:FOUR_LAYER_FILM_MODE,sourceSupportMode:FINITE_SOURCE_SUPPORT_MODE,originalReleaseRouting:routing});
  it('public snapshots and checkpoints detach carrier and receipt ownership', () => {
    const flow=make(); flow.advanceTo(dt,()=>source);
    expect(flow.snapshot().receipt.failure).toBeNull();
    const before=flow.saveState(), detached=flow.saveState(), view=flow.snapshot();
    detached.snapshot.parcels[0].sourceSupport!.moments.momentum[1]=999;
    detached.sourceSupportReceipt!.remaining.positionMoment[1]=999;
    view.parcels[0].sourceSupport!.cursorTime=999;
    expect(flow.saveState()).toEqual(before);
  });
  it('compact rollback restores tentative cursors and remaining moments after later Flow rejection', () => {
    const flow=make();flow.advanceTo(dt,()=>source);const before=flow.saveState();let tentative=false;
    const owner=flow as unknown as {routeOriginalFilmReleases(rows:unknown[]):unknown[]};
    const routing=vi.spyOn(owner,'routeOriginalFilmReleases').mockImplementation(()=>{
      tentative=flow.saveState().snapshot.parcels[0].sourceSupport!.cursorTime===2*dt;
      throw Error('synthetic-after-source-commit');
    });
    flow.advanceTo(2*dt,()=>({...source,q:0}));routing.mockRestore();
    const after=flow.saveState();expect(tentative).toBe(true);expect(after.snapshot.receipt.failure).toBe('synthetic-after-source-commit');
    expect(after.snapshot.parcels).toEqual(before.snapshot.parcels);expect(after.sourceSupportReceipt).toEqual(before.sourceSupportReceipt);
    expect(after.filmState).toEqual(before.filmState);expect(after.snapshot.receipt.ticks).toBe(before.snapshot.receipt.ticks);
  });
  it('rejects malformed moment vectors, nonfinite receipts and mode mismatch before mutation', () => {
    const flow=make();flow.advanceTo(dt,()=>source);const before=flow.saveState();
    const short=structuredClone(before);short.snapshot.parcels[0].sourceSupport!.moments.momentum=[0,0] as unknown as [number,number,number];
    expect(()=>flow.restoreState(short)).toThrow('malformed finite source support');expect(flow.saveState()).toEqual(before);
    const nan=structuredClone(before);nan.sourceSupportReceipt!.remaining.kinetic=NaN;
    expect(()=>flow.restoreState(nan)).toThrow('malformed finite source receipt');expect(flow.saveState()).toEqual(before);
    const mode=structuredClone(before);delete mode.sourceSupportMode;
    expect(()=>flow.restoreState(mode)).toThrow('source support mode mismatch');expect(flow.saveState()).toEqual(before);
  });
  it('a rejected source interval preserves its typed witness and restores accepted ownership', () => {
    const flow=make();flow.advanceTo(dt,()=>source);const before=flow.saveState();
    const diagnostic={stage:'source-support-quadrature' as const,start:dt,end:2*dt,closure:{worstGroup:{originalId:1,face:7,side:'plus' as const},differences:Array(12).fill(1),unsignedReference:Array(12).fill(1),relativeMaximum:1,energyDifference:3,cumulativeEnergyDifference:3,energyBudget:1e-6}};
    const film=(flow as unknown as {film:WaterfallContactFilm}).film;
    const rejected=vi.spyOn(film,'advance').mockImplementation(()=>{throw new FiniteSourceQuadratureFailure(diagnostic);});
    flow.advanceTo(2*dt,()=>source);rejected.mockRestore();
    const after=flow.saveState();expect(after.snapshot.receipt.failureDiagnostic).toEqual(diagnostic);
    expect(after.snapshot.parcels).toEqual(before.snapshot.parcels);expect(after.sourceSupportReceipt).toEqual(before.sourceSupportReceipt);expect(after.filmState).toEqual(before.filmState);
  });
  it('the default and explicit midpoint path retain the same physical checkpoint', () => {
    const options={startTime:0,dt,parcelsPerStep:2,impactMode:'junction' as const,filmMode:FOUR_LAYER_FILM_MODE,originalReleaseRouting:routing};
    const a=new WaterfallContactFlow(options),b=new WaterfallContactFlow({...options,sourceSupportMode:'midpoint'});
    a.advanceTo(dt,()=>source);b.advanceTo(dt,()=>source);
    const sa=a.saveState(),sb=b.saveState();sa.snapshot.receipt.lastAdvanceMilliseconds=0;sb.snapshot.receipt.lastAdvanceMilliseconds=0;
    expect(sa).toEqual(sb);expect(sa.sourceSupportReceipt).toBeUndefined();
  });
});
