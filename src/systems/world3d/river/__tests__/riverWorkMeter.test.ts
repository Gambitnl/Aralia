/** Verifies that worker utilization includes idle time without charging it to solver work. */
import { describe, expect, it } from 'vitest';
import { RiverWorkMeter } from '../riverWorkMeter';

describe('river worker elapsed utilization', () => {
  it('separates stepping, field construction, edits, submission and waiting', () => {
    const meter = new RiverWorkMeter(0);
    meter.add('advance', 24);
    meter.add('field', 12);
    meter.add('edit', 3);
    meter.add('transfer', 1);
    meter.finishSlice(0, 45);
    expect(meter.reading).toBeNull();
    meter.finishSlice(990, 1000);
    expect(meter.reading).toEqual({ windowMs: 1000, busyMs: 55, advanceMs: 24,
      fieldMs: 12, editMs: 3, transferMs: 1, waitMs: 0, slices: 2, fields: 1, busyShare: 0.055, endedAt: 1000 });
  });

  it('keeps device wait inside a slice out of busy time', () => {
    const meter = new RiverWorkMeter(0);
    meter.add('wait', 30);
    meter.add('advance', 10);
    meter.finishSlice(0, 45);
    meter.finishSlice(995, 1000);
    expect(meter.reading).toMatchObject({ windowMs: 1000, busyMs: 20, waitMs: 30, advanceMs: 10, busyShare: 0.02 });
  });

  it('resets each completed window so paused slices report zero stepping', () => {
    const meter = new RiverWorkMeter(10);
    meter.add('advance', 900);
    meter.finishSlice(10, 1010);
    meter.finishSlice(2005, 2010);
    expect(meter.reading).toMatchObject({ windowMs: 1000, busyMs: 5, advanceMs: 0,
      fieldMs: 0, fields: 0, busyShare: 0.005 });
  });

  it('uses the actual window length when a long slice crosses the boundary', () => {
    const meter = new RiverWorkMeter(100);
    meter.add('advance', 1100);
    meter.add('field', Number.NaN);
    meter.add('edit', -1);
    meter.finishSlice(100, 1200);
    expect(meter.reading).toMatchObject({ windowMs: 1100, busyShare: 1, advanceMs: 1100, fields: 0, editMs: 0 });
  });
});
