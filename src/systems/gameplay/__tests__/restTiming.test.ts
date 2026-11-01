import { describe, expect, it } from 'vitest';
import { getShortRestTiming } from '../restTiming';
import { getGameDay } from '../../../utils/core/timeUtils';

describe('short-rest timing shared by preview and commitment', () => {
  const now = new Date('0351-01-04T16:20:52.000Z');
  it('preserves a negative-epoch completion and the current cooldown without changing the tracker', () => {
    const tracker = { restsTakenToday: 1, lastRestDay: 4, lastRestEndedAtMs: new Date('0351-01-04T16:19:29.000Z').getTime() };
    const before = structuredClone(tracker);
    expect(getShortRestTiming(now, tracker).blockReason).toBe('The party needs 1 hour, 58 minutes before taking another short rest.');
    expect(tracker).toEqual(before);
  });
  it('allows the exact two-hour boundary but blocks the preceding second', () => {
    const tracker = { restsTakenToday: 1, lastRestDay: 4, lastRestEndedAtMs: now.getTime() - 7200000 };
    expect(getShortRestTiming(now, tracker).blockReason).toBeNull();
    expect(getShortRestTiming(new Date(now.getTime() - 1000), tracker).blockReason).not.toBeNull();
  });
  it('also treats a zero-epoch completion as a real cooldown', () => {
    expect(getShortRestTiming(new Date(1000), { restsTakenToday: 1, lastRestDay: getGameDay(new Date(1000)), lastRestEndedAtMs: 0 }).blockReason).not.toBeNull();
  });
  it('discloses the daily cap before spending or rolling', () => {
    expect(getShortRestTiming(now, {restsTakenToday:3,lastRestDay:4,lastRestEndedAtMs:null}).blockReason).toContain('already taken 3');
  });
  it('keeps the existing finish-day rule across midnight', () => {
    const start = new Date('0351-01-04T23:30:00.000Z');
    const result = getShortRestTiming(start, {restsTakenToday:3,lastRestDay:4,lastRestEndedAtMs:start.getTime()-10800000});
    expect(result).toMatchObject({restEndDay:5,restsTakenToday:0,blockReason:null});
    expect(result.restEndMs-start.getTime()).toBe(3600000);
  });
  it('retains compatibility for saves without a short-rest tracker', () => {
    expect(getShortRestTiming(now)).toMatchObject({restsTakenToday:0,blockReason:null});
  });
});
