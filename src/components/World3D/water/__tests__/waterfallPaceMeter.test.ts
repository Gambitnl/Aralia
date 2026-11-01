import { describe, expect, it } from 'vitest';
import { createWaterfallPaceMeter } from '../waterfallPaceMeter';

const state = (time: number, running = true, selected: string | null = 'seven-sisters', failure: string | null = null) => ({ selected,
  reading: { physicalTime: time, running, failure, lastStepMilliseconds: 40 } });

describe('delivered waterfall pace', () => {
  it('uses native accepted time instead of missing or stale contact-worker replies',()=>{
    const read=createWaterfallPaceMeter();
    const native=(time:number,running=true,failure:string|null=null)=>({...state(999,false),display:'native' as const,native:{time,running,failure}});
    expect(read({...native(10),reading:null},0)).toContain('Collecting');
    const pace=read(native(11),2000);expect(pace).toContain('0.500× real time');expect(pace).not.toContain('worker tick');
    expect(read(native(11,false),3000)).toContain('Paused');
    expect(read(native(11,true,'escaped'),4000)).toBe('Stopped: escaped');
    read(native(12),5000);
    expect(read({...state(12),display:'liquid'},6000)).toContain('Collecting');
    expect(read({...native(13),native:undefined},7000)).toBe('Waiting for physical water state');
  });
  it('reports slow physics independently of render FPS and retains stalled intervals', () => {
    const read = createWaterfallPaceMeter();
    expect(read(state(3), 0)).toContain('Collecting');
    expect(read(state(3.1), 2000)).toContain('0.050× real time · 0.100 s water / 2.0 s wall');
    read(state(3.1), 3000);
    expect(read(state(3.1), 4000)).toContain('0.000× real time');
  });
  it('excludes paused time and restarts after switching or resetting a course', () => {
    const read = createWaterfallPaceMeter();
    read(state(1), 0); read(state(2), 1000);
    expect(read(state(2, false), 2000)).toContain('Paused');
    expect(read(state(2), 9000)).toContain('Collecting');
    expect(read(state(3), 10000)).toContain('1.000×');
    expect(read(state(.2, true, 'langfossen'), 11000)).toContain('Collecting');
    read(state(1, true, 'langfossen'), 12000);
    expect(read(state(0, true, 'langfossen'), 13000)).toContain('Collecting');
  });
  it('excludes explicit preview suspension without forgiving a long visible stall', () => {
    const read = createWaterfallPaceMeter();
    read(state(1), 0); read(state(2), 1000);
    read.suspend();
    expect(read(state(2), 218000)).toContain('Collecting');
    expect(read(state(2.5), 219000)).toContain('0.500× real time');
    // An equally long gap with no hidden event is a real delivered-time stall.
    expect(read(state(2.5), 437000)).toContain('0.000× real time');
    read.suspend(); read.suspend();
    expect(read(state(2.5), 438000)).toContain('Collecting');
  });
  it('does not mislabel failed, missing or invalid observations as slow physics', () => {
    const read = createWaterfallPaceMeter();
    expect(read(state(0, true, null), 0)).toContain('No comparison');
    expect(read(state(0, true, 'seven-sisters', 'capacity'), 1000)).toBe('Stopped: capacity');
    expect(read(state(NaN), 2000)).toBe('Physical speed unavailable');
    expect(read(state(1), 3000)).toContain('Collecting');
    expect(read(state(2), 2500)).toContain('Collecting');
  });
});
