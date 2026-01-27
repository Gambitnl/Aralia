import { describe, it, expect } from 'vitest';
import {
  getCalendarDescription,
  getHoliday,
  getNextHoliday,
  getMoonPhase,
  MoonPhase,
  // TODO(lint-intent): 'HOLIDAYS' is unused in this test; use it in the assertion path or remove it.
  HOLIDAYS as _HOLIDAYS
} from '../CalendarSystem';
import { getGameEpoch } from '../../../utils/core';

describe('CalendarSystem', () => {
  it('correctly identifies Midwinter Festival', () => {
    // Month 0 (Jan), Day 15
    const date = new Date(Date.UTC(351, 0, 15, 12, 0, 0));
    const holiday = getHoliday(date);
    expect(holiday).toBeDefined();
    expect(holiday?.id).toBe('midwinter');
  });

  it('correctly returns next holiday', () => {
    // Month 0 (Jan), Day 16
    const date = new Date(Date.UTC(351, 0, 16, 12, 0, 0));
    const next = getNextHoliday(date);
    expect(next.id).toBe('greengrass'); // April 1st
  });

  it('correctly cycles moon phases', () => {
    const epoch = getGameEpoch(); // Day 1
    // Day 1 % 28 = 1 -> Waxing Crescent
    expect(getMoonPhase(epoch)).toBe(MoonPhase.WaxingCrescent);
  });

  it('generates descriptive calendar text', () => {
    const date = new Date(Date.UTC(351, 0, 15, 12, 0, 0));
    const desc = getCalendarDescription(date);
    expect(desc).toContain('Deepwinter');
    expect(desc).toContain('Midwinter Festival');
  });
});
