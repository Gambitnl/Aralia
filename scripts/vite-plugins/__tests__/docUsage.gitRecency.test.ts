import { describe, it, expect } from 'vitest';
import { computeAgeDays } from '../docUsage/gitRecency';

describe('computeAgeDays', () => {
  it('converts a commit timestamp to whole days old', () => {
    const now = 1_000 * 86400 * 1000; // day 1000 in ms
    expect(computeAgeDays(998 * 86400, now)).toBe(2);
    expect(computeAgeDays(null, now)).toBe(null);
  });
});
