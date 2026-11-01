import { afterEach, describe, expect, it } from 'vitest';
import { RAPIDS_WATERFALL_SEQUENCE, rapidsWaterfallCut, TERRAIN_COMPARISON_CASES } from '../waterfallTerrainProfiles';
import { carveMainRapids, mainRapidsAt, MAIN_CHANNEL_S, setRiverHeadwaters, HEADWATERS_GRID } from '../riverHeadwaters';
import { LiveRiver } from '../riverLive';

afterEach(()=>setRiverHeadwaters(false));
describe('reference terrain in the native main rapids',()=>{
  it('preserves every reference identity in a separated serial footprint',()=>{
    expect(RAPIDS_WATERFALL_SEQUENCE.map(f=>f.id)).toEqual(TERRAIN_COMPARISON_CASES.map(f=>f.id));
    expect(new Set(RAPIDS_WATERFALL_SEQUENCE.map(f=>f.form)).size).toBe(7);
    for(let i=1;i<7;i++)expect(RAPIDS_WATERFALL_SEQUENCE[i].start).toBeGreaterThan(RAPIDS_WATERFALL_SEQUENCE[i-1].start+RAPIDS_WATERFALL_SEQUENCE[i-1].length);
  });
  it('retains the deep first descent and keeps shifted footprints inside the water domain',()=>{
    const first=RAPIDS_WATERFALL_SEQUENCE[0],second=RAPIDS_WATERFALL_SEQUENCE[1];
    expect(rapidsWaterfallCut(first.start+first.length,0)).toBeCloseTo(36,8);
    for(const n of [-6,-2,0,2,6])expect(Math.abs(rapidsWaterfallCut(first.start+first.length-1e-6,n)-rapidsWaterfallCut(first.start+first.length+1e-6,n))).toBeLessThan(1e-4);
    expect(second.start-first.start-first.length).toBeGreaterThanOrEqual(30);
    const g=HEADWATERS_GRID;
    for(const f of RAPIDS_WATERFALL_SEQUENCE)for(const u of [f.start-10,f.start+f.length+10])for(const n of [-26,26]){
      const p=mainRapidsAt(MAIN_CHANNEL_S+u),x=p.x+p.tz*n,z=p.z-p.tx*n;
      expect(x).toBeGreaterThan(g.x0);expect(x).toBeLessThan(g.x0+g.dx*g.nx);
      expect(z).toBeGreaterThan(g.z0);expect(z).toBeLessThan(g.z0+g.dx*g.nz);
    }
    // Cross-channel lip offsets and the rock nose must affect actual shared
    // terrain, rather than only adding an irregular visual overlay.
    expect(Math.abs(rapidsWaterfallCut(first.start+first.length*.48,-2)-rapidsWaterfallCut(first.start+first.length*.48,2))).toBeGreaterThan(1);
  });
  it('retains each downstream lowering with no tray outlet or longitudinal seam',()=>{
    for(const f of RAPIDS_WATERFALL_SEQUENCE){
      expect(rapidsWaterfallCut(f.start+f.length+.01,0)).toBeCloseTo(rapidsWaterfallCut(f.start+f.length+3.99,0),8);
      for(const u of [f.start,f.start+f.length])expect(Math.abs(rapidsWaterfallCut(u+1e-6,0)-rapidsWaterfallCut(u-1e-6,0))).toBeLessThan(1e-4);
    }
  });
  it('keeps a broad flat outcrop on one shelf instead of a fin across several falls',()=>{
    const f=RAPIDS_WATERFALL_SEQUENCE[0],u=f.start+f.length*.37;
    expect(rapidsWaterfallCut(u,-3)).toBeCloseTo(rapidsWaterfallCut(u,-1),8);
    expect(rapidsWaterfallCut(u,1)-rapidsWaterfallCut(u,-1)).toBeGreaterThan(2);
    // The rock ends before the next drop; retained lowering still agrees on
    // both sides downstream, rather than dragging a long center ridge along.
    const below=f.start+f.length*.55;
    expect(rapidsWaterfallCut(below,-1)).toBeCloseTo(rapidsWaterfallCut(below,1),8);
  });
  it('makes seven channels, twin chutes and a continuous slope in the actual bed',()=>{
    const sisters=RAPIDS_WATERFALL_SEQUENCE[1],twins=RAPIDS_WATERFALL_SEQUENCE[3];
    for(const f of [sisters,twins]){
      const u=f.start+10;
      // A .35 m water surface above the channel must leave actual dividing
      // rock exposed; the previous .22 m ridges submerged into a broad sheet.
      if(f===sisters)expect(rapidsWaterfallCut(u,0)).toBeGreaterThan(rapidsWaterfallCut(u,.8)+.35);
      else expect(rapidsWaterfallCut(u,1.6)).toBeGreaterThan(rapidsWaterfallCut(u,0)+.35);
    }
    const slope=RAPIDS_WATERFALL_SEQUENCE[6];
    expect(rapidsWaterfallCut(slope.start+12,0)).toBeGreaterThan(rapidsWaterfallCut(slope.start+8,0));
  });
  it('excavates only the enabled main course and preserves original-course ownership',()=>{
    const p=mainRapidsAt(MAIN_CHANNEL_S+160);
    expect(carveMainRapids(p.x,p.z,10,0,0,false)).toBe(10);
    setRiverHeadwaters(true);
    // The old original bed can be lower than the carved main; ownership still
    // prevents these new reference cuts from lowering that protected offshoot.
    expect(carveMainRapids(p.x,p.z,-20,0,0,false)).toBe(-20);
    expect(carveMainRapids(p.x,p.z,-20,0,100,false)).toBeLessThan(-20);
    expect(rapidsWaterfallCut(360,24)).toBe(0);
    expect(rapidsWaterfallCut(114,0)).toBe(0);
  });
  it('starts the real river empty and retains admitted inventory when its source stops',()=>{
    const river=new LiveRiver(20260928,true,true);
    river.startDry();
    expect(river.solver.volume()).toBe(0);
    expect(river.solver.inVolume).toBe(0);
    const deadline=performance.now()+15000;
    while(river.solver.time<8&&performance.now()<deadline)river.advance(50,8-river.solver.time);
    expect(river.solver.time).toBeGreaterThanOrEqual(8);
    expect(river.solver.inVolume).toBeGreaterThan(0);
    const before=river.solver.h.slice(),volume=river.solver.volume();
    river.setSourcePaused(true);
    expect(river.solver.h).toEqual(before);
    expect(river.solver.volume()).toBe(volume);
    expect(()=>river.startDry()).toThrow('fresh river');
    expect(river.topUpM3).toBe(0);
  },60000);
});
