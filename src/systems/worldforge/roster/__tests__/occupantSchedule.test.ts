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
