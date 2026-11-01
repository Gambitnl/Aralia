import { describe, expect, it } from 'vitest';
import { riverFloodSourceAt, type RiverFloodPulseDescriptor } from '../riverFloodSurge';
import { riverFloodSourceDerivative, waterfallFloodActive, waterfallFloodSection } from '../waterfallFloodVisual';
import { WaterfallDensityAtlas, waterfallAtlasEdgeMean, waterfallAtlasOccupancy } from '../waterfallDensityAtlas';
import { waterfallLiquidSection } from '@/components/World3D/water/riverWaterfallView';
const pulse: RiverFloodPulseDescriptor = { startS: 10, durationS: 90, baseM3S: 1.5, extraPeakM3S: 58.5, flightDelayS: 4, cancelS: null, cancelExtraM3S: 0, cancelDurationS: 18 };
describe('airborne flood history', () => {
  it('changes the crest first while older water keeps its original speed', () => {
    expect(waterfallFloodSection(pulse, 12, 0, 4, 10, .7).q).toBeGreaterThan(1.5);
    expect(waterfallFloodSection(pulse, 12, 4, 4, 10, .7).q).toBe(1.5);
  });
  it('matches delayed arrival at a rising pool without a floating endpoint', () => {
    for (const flight of [3.2, 3.8, 4.2]) for (const time of [12, 35, 85, 101]) {
      expect(waterfallFloodSection(pulse, time, flight, flight, 10, .7).q).toBe(riverFloodSourceAt(pulse, time - 4));
      expect(waterfallFloodSection(pulse, time, 0, flight, 10, .7).q).toBe(riverFloodSourceAt(pulse, time));
    }
  });
  it('uses the same cancellation and bounded airborne tail', () => {
    const p = { ...pulse, cancelS: 30, cancelExtraM3S: 58.5 };
    expect(waterfallFloodActive(p, 49)).toBe(true);
    expect(waterfallFloodActive(p, 52)).toBe(false);
    expect(waterfallFloodSection(p, 49, 4, 4, 6, 1.4).q).toBeGreaterThan(1.5);
  });
  it('analytic trajectory derivative agrees with emission history', () => {
    for (const p of [pulse, { ...pulse, cancelS: 30, cancelExtraM3S: 58.5 }]) for (const t of [11, 20, 29, 32, 46, 67, 90, 99]) {
      const h = 1e-4, numerical = (riverFloodSourceAt(p, t + h) - riverFloodSourceAt(p, t - h)) / (2 * h);
      expect(riverFloodSourceDerivative(p, t)).toBeCloseTo(numerical, 6);
    }
  });
  it('paused simulation leaves the entire front unchanged', () => {
    const sample = () => Array.from({ length: 33 }, (_, i) => waterfallFloodSection(pulse, 22, 4 * i / 32, 4, 10, .7));
    expect(sample()).toEqual(sample());
  });
  it('keeps a resident legacy atlas conservative through moving flood fronts', () => {
    const receipts = [];
    for (const [base,width,depth,peak] of [[.5,6,1.4,60],[12,10,.7,60],[.5,6,1.4,120],[12,10,.7,120]]) {
      const p = { ...pulse, baseM3S: base, extraPeakM3S: peak-base };
      const sectionAt = (age: number,time: number) => {
        const s = waterfallFloodSection(p,time,age,3.8,width,depth);
        return waterfallLiquidSection(s.q,width,s.speed,age,time,s.area);
      };
      const atlas = new WaterfallDensityAtlas(age => waterfallLiquidSection(peak,width,peak/(width*depth),age,0),'legacy',{ sectionAtTime: sectionAt });
      const first = atlas.first, second = atlas.second, costs = [];
      let maximumError = 0, maximumPhi = 0;
      for (const time of [12,12.047,20,35,85,99,101]) {
        atlas.update(time); costs.push(atlas.lastUpdateMs);
        expect(atlas.first).toBe(first); expect(atlas.second).toBe(second);
        for (const age of [.015,.053,.17,.71,1.739,3.647]) {
          const s=sectionAt(age,time), mean=waterfallAtlasEdgeMean(s);
          const nx=384,ny=192; let integral=0;
          for(let j=0;j<ny;j++) for(let i=0;i<nx;i++) {
            const x=(i+.5)*2/nx-1,y=(j+.5)*2/ny-1;
            const phi=s.fraction*waterfallAtlasOccupancy(s,x,y)*atlas.sample(x,y,age)/mean;
            integral+=phi*s.width*s.thickness/(nx*ny); maximumPhi=Math.max(maximumPhi,phi);
          }
          maximumError=Math.max(maximumError,Math.abs(integral/s.area-1));
        }
      }
      expect(maximumPhi).toBeLessThanOrEqual(1.001);
      expect(maximumError).toBeLessThan(.01);
      const steady=[];for(let i=0;i<5;i++){atlas.update(22+i*.125);steady.push(atlas.lastUpdateMs);}
      receipts.push({base,width,depth,peak,initializationMs:atlas.initializationMs,costs,steady,maximumError,maximumPhi,bytes:atlas.textureBytes});
    }
    console.log('flood resident density receipt',JSON.stringify(receipts));
  },60000);
  it('keeps supported slow pulses positive and reports a bounded short-pulse fallback', () => {
    let minimum=Infinity,invalid=0;
    for(const durationS of [30,180]) for(const depth of [.35,1.4]) {
      const p={...pulse,durationS,baseM3S:.5,extraPeakM3S:119.5};
      for(let t=10;t<10+durationS+4;t+=.25) for(let a=0;a<=4;a+=.1) {
        const s=waterfallFloodSection(p,t,a,4,6,depth);minimum=Math.min(minimum,s.planeJacobian);
        expect(s.valid).toBe(true);expect(Number.isFinite(s.area)).toBe(true);
      }
    }
    const p={...pulse,durationS:5,baseM3S:.5,extraPeakM3S:119.5};
    for(let t=10;t<19;t+=.1) for(let a=0;a<=4;a+=.1) {
      const s=waterfallFloodSection(p,t,a,4,6,.35);if(!s.valid)invalid++;
      expect(Number.isFinite(s.area)).toBe(true);expect(s.area).toBeGreaterThan(0);
    }
    expect(invalid).toBeGreaterThan(0);
    console.log('flood center-plane validity',JSON.stringify({minimum,shortPulseInvalidSections:invalid}));
  });
});
