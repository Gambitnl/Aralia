import { describe, it, expect } from 'vitest';
import { xpForChallengeRating } from '../xpForChallengeRating';

describe('xpForChallengeRating', () => {
  it('matches the 5e table for fractional CRs', () => {
    expect(xpForChallengeRating('1/8')).toBe(25);
    expect(xpForChallengeRating('1/4')).toBe(50);
    expect(xpForChallengeRating('1/2')).toBe(100);
  });

  it('matches the 5e table for whole CRs (early game)', () => {
    expect(xpForChallengeRating(0)).toBe(10);
    expect(xpForChallengeRating(1)).toBe(200);
    expect(xpForChallengeRating('2')).toBe(450);
    expect(xpForChallengeRating(3)).toBe(700);
    expect(xpForChallengeRating(5)).toBe(1800);
  });

  it('accepts decimal string forms', () => {
    expect(xpForChallengeRating('0.25')).toBe(50);
    expect(xpForChallengeRating('0.5')).toBe(100);
  });

  it('never awards literally nothing for a defeated foe', () => {
    expect(xpForChallengeRating('garbage')).toBeGreaterThan(0);
    expect(xpForChallengeRating(null)).toBeGreaterThan(0);
    expect(xpForChallengeRating(undefined)).toBeGreaterThan(0);
  });

  it('a pack of four CR 1/4 goblins is worth more than a single flat-50 placeholder', () => {
    const packXp = [0.25, 0.25, 0.25, 0.25].reduce((t, cr) => t + xpForChallengeRating(cr), 0);
    expect(packXp).toBe(200); // 4 × 50, and enough that three such fights approach level 2
  });
});
