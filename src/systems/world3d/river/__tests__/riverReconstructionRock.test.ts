/** Physical limits for the shared cliff patch; likeness needs rendered review. */
import {describe,expect,it} from 'vitest';
import {reconstructionRockRelief,reconstructionSistersFace,reconstructionSistersForward} from '../riverReconstructionRock';

describe('finite reconstructed rock',()=>{
  it('retains broad unequal projections without turning their sides into narrow fins',()=>{
    // The rejected180m-wide face varied by less than1.3m between its broad
    // sections. This catches that flat-panel regression, not photo likeness.
    for(const drop of [.56,.73]){
      const positions=Array.from({length:181},(_,i)=>reconstructionSistersForward(drop,i-90)*45);
      expect(Math.max(...positions)-Math.min(...positions)).toBeGreaterThan(5);
      for(let i=1;i<positions.length;i++)expect(Math.abs(positions[i]-positions[i-1])).toBeLessThan(1);
    }
  });
  it('has finite bounded relief across the actual cliff, with unequal local faces',()=>{
    let lo=Infinity,hi=-Infinity,changes=0;
    for(let h=0;h<=250;h+=2.5)for(let n=-90;n<=90;n+=2.5){
      const a=reconstructionRockRelief(n,h),b=reconstructionRockRelief(n+.25,h);
      expect(Number.isFinite(a)).toBe(true);
      expect(Math.abs(a-b)).toBeLessThan(3);
      lo=Math.min(lo,a);hi=Math.max(hi,a);if(Math.abs(a-b)>.15)changes++;
    }
    expect(lo).toBeGreaterThan(-4);expect(hi).toBeLessThan(18);
    expect(hi-lo).toBeGreaterThan(10);expect(changes).toBeGreaterThan(100);
  });
  it('rejects invalid physical coordinates instead of propagating corrupt ground',()=>{
    expect(()=>reconstructionRockRelief(NaN,10)).toThrow();
    expect(()=>reconstructionRockRelief(10,Infinity)).toThrow();
  });
  it('keeps the fractured wall downhill and joined to the same crest and foot',()=>{
    for(let n=-102;n<=102;n+=3){
      expect(reconstructionSistersFace(0,n)).toBe(0);expect(reconstructionSistersFace(1,n)).toBe(1);
      let previous=0;
      for(let step=1;step<=450;step++){
        const next=reconstructionSistersFace(step/450,n);
        expect(next).toBeGreaterThanOrEqual(previous);expect(next).toBeLessThanOrEqual(1);previous=next;
      }
    }
    expect(()=>reconstructionSistersFace(NaN,0)).toThrow();
  });
  it('uses the same section for finite rock and adjoining land in both coordinate directions',()=>{
    for(const n of [-102,-83,-31,0,43,91,102])for(let step=0;step<=100;step++){
      const forward=step/100,drop=reconstructionSistersFace(forward,n);
      expect(reconstructionSistersForward(drop,n)).toBeCloseTo(forward,12);
    }
    expect(()=>reconstructionSistersForward(NaN,0)).toThrow();
  });
});
