/**
 * Proves the occupant daily-schedule pass is a stable, deterministic data
 * contract: same (occupant, hour) → same block, workers work by day and sleep
 * at home overnight, children never work, and every hour is covered.
 */
import { describe, it, expect } from 'vitest';
import { occupantLocationAt, occupantDayRoutine } from '../occupantSchedule';
import type { Occupant } from '../types';

const worker = (over: Partial<Occupant> = {}): Occupant => ({
  id: 1, name: 'Aldric', ageBand: 'adult', homePlotId: 10, workPlotId: 20, occupation: 'shopkeeper', ...over,
});
const resident = (over: Partial<Occupant> = {}): Occupant => ({
  id: 2, name: 'Bess', ageBand: 'adult', homePlotId: 11, occupation: 'resident', ...over,
});

describe('occupantLocationAt', () => {
  it('keeps a named household breakfast and evening return aligned with its interior', () => {
    const person = worker({householdMemberId:'b91:head'});
    expect(occupantLocationAt(person,7)).toMatchObject({activity:'home',plotId:10});
    expect(occupantLocationAt(person,8)).toMatchObject({activity:'working',plotId:20});
    expect(occupantLocationAt(person,17)).toMatchObject({activity:'working',plotId:20});
    expect(occupantLocationAt(person,18)).toMatchObject({activity:'home',plotId:10});
  });
  it('keeps retired proprietors off shift while retaining their business link', () => {
    const owner = worker({ retired: true, ageBand: 'elder' });
    expect(occupantDayRoutine(owner).every(block => block.activity !== 'working' && block.plotId === owner.homePlotId)).toBe(true);
    expect(owner.workPlotId).toBe(20);
  });
  it('is deterministic for the same occupant + hour', () => {
    const o = worker();
    for (let h = 0; h < 24; h++) {
      expect(occupantLocationAt(o, h)).toEqual(occupantLocationAt(o, h));
    }
  });

  it('wraps out-of-range hours into the 0–23 day', () => {
    const o = worker();
    expect(occupantLocationAt(o, 24)).toEqual(occupantLocationAt(o, 0));
    expect(occupantLocationAt(o, -1)).toEqual(occupantLocationAt(o, 23));
    expect(occupantLocationAt(o, 49).hour).toBe(1);
  });

  it('puts everyone asleep at home in the dead of night (hour 3)', () => {
    for (const o of [worker(), resident(), resident({ ageBand: 'child', id: 3 }), worker({ ageBand: 'elder', id: 4 })]) {
      const b = occupantLocationAt(o, 3);
      expect(b.activity).toBe('sleeping');
      expect(b.plotId).toBe(o.homePlotId);
    }
  });

  it('sends a worker to their WORK plot during midday and home at night', () => {
    const o = worker();
    const noon = occupantLocationAt(o, 12);
    expect(noon.activity).toBe('working');
    expect(noon.plotId).toBe(20); // workPlotId
    expect(occupantLocationAt(o, 23).plotId).toBe(10); // home in the evening/night
  });

  it('never sends a child to work — they are home or out, never "working"', () => {
    const child = resident({ ageBand: 'child', id: 3, workPlotId: 99 }); // even if mis-assigned a work plot
    for (let h = 0; h < 24; h++) {
      const b = occupantLocationAt(child, h);
      expect(b.activity).not.toBe('working');
      expect(b.plotId).toBe(child.homePlotId);
    }
  });

  it('gives a non-worker a midday OUT block and home otherwise', () => {
    const o = resident();
    const day = occupantDayRoutine(o);
    expect(day.some((b) => b.activity === 'out')).toBe(true);
    expect(day.every((b) => b.activity !== 'working')).toBe(true);
  });

  it('gives an elder worker a shorter shift than an equivalent adult', () => {
    const adultHours = occupantDayRoutine(worker({ id: 7, ageBand: 'adult' })).filter((b) => b.activity === 'working').length;
    const elderHours = occupantDayRoutine(worker({ id: 7, ageBand: 'elder' })).filter((b) => b.activity === 'working').length;
    expect(elderHours).toBeLessThan(adultHours);
  });
});

describe('occupantDayRoutine', () => {
  it('returns exactly one block per hour, 0→23, in order', () => {
    const day = occupantDayRoutine(worker());
    expect(day).toHaveLength(24);
    day.forEach((b, h) => expect(b.hour).toBe(h));
  });

  it('a worker both sleeps and works across a full day (a real routine, not constant)', () => {
    const kinds = new Set(occupantDayRoutine(worker()).map((b) => b.activity));
    expect(kinds.has('sleeping')).toBe(true);
    expect(kinds.has('working')).toBe(true);
    expect(kinds.has('home')).toBe(true);
  });
});

// GG-514: dayShape shifted an unsigned hash with a signed >>, so for about half
// of all ids the shift went negative and the hours fell outside the documented
// windows (work 7-8 to 17-18, sleep from 20-22). Every adult worker must sit
// inside those windows.
describe('documented schedule windows hold for every id', () => {
  it('keeps 2000 adult workers inside work 7-8 to 17-18 and sleep from 20-22', () => {
    const outside: number[] = [];
    for (let id = 0; id < 2000; id++) {
      const day = occupantDayRoutine(worker({ id }));
      const working = day.filter((b) => b.activity === 'working').map((b) => b.hour);
      const start = Math.min(...working);
      const end = Math.max(...working) + 1;
      const sleep = day.find((b) => b.hour >= 12 && b.activity === 'sleeping')?.hour ?? -1;
      const ok = (start === 7 || start === 8) && (end === 17 || end === 18) && sleep >= 20 && sleep <= 22;
      if (!ok) outside.push(id);
    }
    expect(outside).toEqual([]);
  });
});


describe('current civic workplace schedule', () => {
  const priest = (): Occupant => ({id:145,name:'Faelan Ironsmith',householdMemberId:'b54:spouse',homePlotId:54,occupation:'resident',ageBand:'elder',civicWorkplace:{role:'priest',plotId:168}});
  it('retains household meals and sleep around the existing daytime duty band', () => {
    const p=priest();
    expect(occupantLocationAt(p,7)).toMatchObject({activity:'home',plotId:54});
    expect(occupantLocationAt(p,8)).toMatchObject({activity:'working',plotId:168});
    expect(occupantLocationAt(p,17)).toMatchObject({activity:'working',plotId:168});
    expect(occupantLocationAt(p,18)).toMatchObject({activity:'home',plotId:54});
    expect(occupantLocationAt(p,23)).toMatchObject({activity:'sleeping',plotId:54});
    expect(p.workPlotId).toBeUndefined();
  });
  it('never turns a child or retired holder into a working body', () => {
    for(const p of [{...priest(),ageBand:'child' as const},{...priest(),retired:true}])
      expect(occupantDayRoutine(p).some(b=>b.activity==='working')).toBe(false);
  });
  it('preserves an explicit existing trade over a conflicting derived duty', () => {
    expect(occupantLocationAt({...priest(),workPlotId:7},14)).toMatchObject({activity:'working',plotId:7});
  });
});
