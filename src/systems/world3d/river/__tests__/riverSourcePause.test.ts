import { afterEach, describe, expect, it } from 'vitest';
import { LiveRiver } from '../riverLive';
import { RiverFloodSurge } from '../riverFloodSurge';
import { RiverSourceHistory, riverSourceAt } from '../riverSourceHistory';
import { setRiverHeadwaters } from '../riverHeadwaters';
import { setRiverShape } from '../riverReach';

afterEach(() => { setRiverHeadwaters(false); setRiverShape(null); });

describe('water source pause', () => {
  it('distinguishes a dry opening from an already-running source before time zero',()=>{
    const old=new RiverSourceHistory();old.record(0,12);
    expect(riverSourceAt(old.status(4),null,-1)).toBe(12);
    const fresh=new RiverSourceHistory();fresh.record(0,12);fresh.beginDry(12);
    expect(fresh.hasChanges).toBe(true);
    expect(riverSourceAt(fresh.status(4),null,-1)).toBe(0);
    expect(riverSourceAt(fresh.status(4),null,0)).toBe(12);
  });
  it('keeps a fresh pool empty until the first source water finishes its flight',()=>{
    const live=new LiveRiver(20260928,true);live.startDry();
    const delay=live.flood.source!.flightDelayS;
    expect(delay).toBeGreaterThan(.5);
    while(live.simTime<delay-.15)live.advance(250,Math.min(.05,delay-.15-live.simTime));
    expect(live.solver.volume()).toBe(0);expect(live.solver.inVolume).toBe(0);
    expect(live.flood.sourceM3S).toBe(1.5);expect(live.solver.discharge).toBe(0);
    while(live.simTime<delay+.15)live.advance(250,.05);
    expect(live.solver.volume()).toBeGreaterThan(0);expect(live.solver.inVolume).toBeGreaterThan(0);
    const wet=live.solver.volume();live.setSourcePaused(true);
    expect(live.solver.volume()).toBe(wet);expect(live.topUpM3).toBe(0);
  },60000);
  it('preserves admitted flood history and resumes only configured normal flow', () => {
    const history = new RiverSourceHistory(), surge = new RiverFloodSurge();
    history.record(0, 12);
    surge.start(0, 12, 4, { peakM3S: 60, durationS: 90 });
    const emitted = surge.emittedVolume(30), released = surge.status(29, 12).sourceM3S;
    surge.stop(30); history.paused = true; history.record(30, 12);
    const paused = history.status(4), pulse = surge.status(30, 12).pulse;
    expect(riverSourceAt(paused, pulse, 29)).toBe(released);
    expect(riverSourceAt(paused, pulse, 30)).toBe(0);
    expect(surge.emittedVolume(200)).toBe(emitted);
    expect(surge.status(30, 12).phase).toBe('draining');
    // The landing reads an earlier release until its four-second flight ends.
    expect(riverSourceAt(paused, pulse, 33 - paused.flightDelayS)).toBe(released);
    expect(riverSourceAt(paused, pulse, 34 - paused.flightDelayS)).toBe(0);
    history.record(31, 18);
    expect(riverSourceAt(history.status(4), pulse, 32)).toBe(0);
    history.paused = false; history.record(35, 18);
    expect(riverSourceAt(history.status(4), pulse, 35)).toBe(18);
    expect(riverSourceAt(history.status(4), pulse, 32)).toBe(0);
  });

  it('retains several quick gate changes and edits for water still airborne', () => {
    const history = new RiverSourceHistory(); history.record(0, 12);
    history.paused = true; history.record(1, 12);
    history.paused = false; history.record(2, 18);
    history.paused = true; history.record(3, 18);
    const source = history.status(4);
    expect([.5, 1.5, 2.5, 3.5].map(time => riverSourceAt(source, null, time))).toEqual([12, 0, 18, 0]);
    history.record(40, 18);
    expect(riverSourceAt(history.status(4), null, 39)).toBe(0);
  });

  it('closes the actual source without clearing its field and continues solver time', () => {
    const live = new LiveRiver(20260928, true);
    const before = live.solver.saveState(), bed = live.solver.bed.slice(), configured = live.shape.dischargeM3S;
    expect(live.startFlood({ peakM3S: 60, durationS: 90 })).toBe(true);
    live.setSourcePaused(true);
    expect(live.solver.saveState()).toEqual(before);
    expect(live.solver.bed).toEqual(bed);
    expect(live.flood.sourceM3S).toBe(0);
    expect(live.flood.source?.paused).toBe(true);
    expect(live.startFlood()).toBe(false);
    expect(live.shape.dischargeM3S).toBe(configured);
    const time = live.simTime;
    live.advance(1000, .05);
    expect(live.simTime).toBeGreaterThan(time);
    // Set the clock past the admitted flight tail without resetting the solver.
    live.simTime = (live.flood.source?.flightDelayS ?? 0) + 1;
    live.advance(1000, .01);
    expect(live.solver.discharge).toBe(0);
    expect(live.solver.volume()).toBeGreaterThan(0);
    expect(live.topUpM3).toBe(0); expect(live.restores).toBe(0);
    live.setSourcePaused(false);
    expect(live.flood.sourceM3S).toBe(configured);
    expect(live.flood.phase).toBe('idle');
    expect(live.solver.discharge).toBe(0);
  }, 60000);
});
