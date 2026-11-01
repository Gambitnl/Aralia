/** Small synthetic observer identities and nonperturbation checks. These do
 * not advance the native waterfall or qualify its physical acceptance gates. */
import { describe, it, expect } from 'vitest';
import { FilmEnergyObserver, filmEnergyWeights } from '../waterfallLayeredFilmEnergyObserver';
import { FOUR_LAYER_FILM_MODE, layerKinetic, observeLayerKineticFactored, observeFilmEnergyIncrement, type FilmLayerColumn } from '../waterfallLayeredFilm';
import { WaterfallContactFilm } from '../waterfallContactFilm';
import type { ContactSurface } from '../waterfallContactFlow';
const column = (v: number, speed: number): FilmLayerColumn => ({ volumes: [v,v,v,v], momenta: Array.from({ length: 4 }, () => [1000*v*speed,0,0]) });
const E = (c: FilmLayerColumn) => observeLayerKineticFactored(c) + 1000 * 3 * c.volumes.reduce((s,v)=>s+v,0) + 1000 * 9 * c.volumes.reduce((s,v)=>s+v,0)**2 / 4;
describe('one-shot film energy observer', () => {
  it('common complete-stage weights close simultaneous additive changes including dry-to-wet', () => {
    for (const before of [column(.01,2), column(0,0)]) {
      const after = column(.03,5), weights = filmEnergyWeights(before,after,2,3,9);
      let chain=0;
      for(let k=0;k<4;k++) {
        const dV=after.volumes[k]-before.volumes[k], dP=after.momenta[k].map((v,a)=>v-before.momenta[k][a]) as [number,number,number];
        const direct=weights[k].a*dV+weights[k].ubar.reduce((s,u,a)=>s+u*dP[a],0);
        const factored=observeFilmEnergyIncrement(before,after,k,dV,dP,2,3,9);
        expect(factored).toBeCloseTo(direct,12); chain+=factored;
      }
      expect(chain).toBeCloseTo(E(after)-E(before),10);
    }
    const invalid=column(0,0); invalid.momenta[0][0]=1;
    expect(()=>filmEnergyWeights(invalid,column(.03,5),2,3,9)).toThrow('unsupported-momentum');
  });
  it('retains extreme representable energy alongside old underflow and overflow', () => {
    const tiny: FilmLayerColumn={volumes:Array(4).fill(3e-322),momenta:Array.from({length:4},()=>[1.497e-321,-1.087e-321,-5.1e-322])};
    // Exact stored binary64 values are (V,P)=(61,[303,-220,-103])
    // MIN_VALUE units. Summed four-layer K rounds from4.944852... to5units.
    expect(layerKinetic(tiny)).toBe(0); expect(observeLayerKineticFactored(tiny)).toBe(5*Number.MIN_VALUE);
    const large: FilmLayerColumn={volumes:Array(4).fill(1e100),momenta:Array.from({length:4},()=>[1e200,0,0])};
    expect(layerKinetic(large)).toBe(Infinity); expect(observeLayerKineticFactored(large)/1e297).toBeCloseTo(2,12);
    const dry=column(0,0);
    const chain=tiny.volumes.reduce((s,v,k)=>s+observeFilmEnergyIncrement(dry,tiny,k,v,tiny.momenta[k],1,0,0),0);
    // Four individually returned contributions round before the report sum;
    // the explicit closure remainder retains this one-unit discrepancy.
    expect(chain).toBe(4*Number.MIN_VALUE);
    expect(observeLayerKineticFactored(tiny)-chain).toBe(Number.MIN_VALUE);
  });
  it('does not change physical Film snapshots or outflows; retains only its first tick', () => {
    const surface: ContactSurface={id:'observer-flat',vertices:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],normal:[0,1,0]};
    const baseline=new WaterfallContactFilm(surface,1,1,64,.35,FOUR_LAYER_FILM_MODE), observed=new WaterfallContactFilm(surface,1,1,64,.35,FOUR_LAYER_FILM_MODE);
    const initial=baseline.saveState(), c=column(.00025,0);
    initial.layered!.columns=[c]; initial.volumes=[.001]; initial.momenta=[[0,0,0]]; initial.capturedVolume=.001;
    baseline.restoreState(initial); observed.restoreState(initial);
    const observer=new FilmEnergyObserver(); observed.energyObserver=observer;
    expect(observed.advance(0,.0001)).toEqual(baseline.advance(0,.0001));
    expect(observed.saveState()).toEqual(baseline.saveState());
    const report=observer.report(); expect(report.complete).toBe(true); expect(report.raw).toHaveLength(1);
    const detached=observer.rawEvidence(); detached.raw[0].before[0].volumes[0]=99;
    expect(observer.rawEvidence().raw[0].before[0].volumes[0]).toBe(.00025);
    expect(report.closureRemainder).toBeCloseTo(0,12); expect(report.gravityClosureRemainder).toBeCloseTo(0,12);
    observed.advance(.0001,.0001); expect(observer.report()).toEqual(report);
  });
  it('discloses substep overflow without throwing or replacing physical guards', () => {
    const observer=new FilmEnergyObserver(), c=column(.001,1);
    observer.beginTick(0,1,{areas:[1],bedPotential:[0],gn:9});
    for(let k=0;k<65;k++) observer.beginSubstep(k,k/100,.01,[c]);
    observer.finish('physical-rejection');
    const report=observer.report(); expect(report.complete).toBe(false); expect(report.raw).toHaveLength(64);
    expect(report.failures).toContain('observer-substep-capacity'); expect(report.rejection).toBe('physical-rejection');
  });
  it('ranks paired shared-face energy rather than canceling endpoint traffic', () => {
    const observer=new FilmEnergyObserver(), before=[column(.001,1),column(.001,1)], after=[column(.0009,1),column(.0011,1)];
    observer.beginTick(0,.01,{areas:[1,1],bedPotential:[100,100],gn:0});
    observer.beginSubstep(0,0,.01,before);
    for (let cell=0;cell<2;cell++) for(let k=0;k<4;k++) {
      const sign=cell===0?-1:1;
      for(const kind of ['central','actual-face'] as const) observer.increment({kind,cell,layer:k,volume:sign*.0001,momentum:[sign*.1,0,0],face:0});
    }
    observer.horizontal(after,0,0); observer.gravity(after);
    for(let cell=0;cell<2;cell++) observer.vertical(cell,after[cell],after[cell],after[cell],0,0,0);
    observer.finish(); const report=observer.report();
    expect(report.complete).toBe(true); expect(report.components[0].absolute).toBeLessThan(1e-10);
    expect(report.components[0].grossEndpointAbsolute).toBeGreaterThan(80);
    expect(report.rankedFaces[0].absolute).toBeLessThan(1e-10);
    const empty=new FilmEnergyObserver(); empty.beginTick(0,1,{areas:[1],bedPotential:[0],gn:9}); empty.finish('preflight-rejected'); expect(empty.report().complete).toBe(false);
  });
});
