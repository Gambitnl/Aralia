/**
 * @file probabilityUtils.test.ts — direct unit tests for the shared FMG
 * probability helpers. Fourteen fmg generators draw through these functions
 * on the global Math.random stream; the pipeline goldens depend on their
 * exact draw behavior. These tests pin the per-function contracts:
 * inclusive bounds, extreme-probability short-circuits (no draw), and
 * range-string parsing.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Alea from 'alea';
import {
  rand,
  P,
  each,
  gauss,
  Pint,
  ra,
  rw,
  biased,
  getNumberInRange,
} from '../utils/probabilityUtils';

const realRandom = Math.random;

beforeEach(() => {
  Math.random = Alea('prob-test-seed') as unknown as () => number;
});

afterEach(() => {
  Math.random = realRandom;
});

describe('rand', () => {
  it('with no args returns a float in [0, 1)', () => {
    for (let i = 0; i < 1_000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('with one arg returns an integer in [0, max] INCLUSIVE', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const v = rand(3);
      expect(Number.isInteger(v)).toBe(true);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('with two args returns an integer in [min, max] INCLUSIVE', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const v = rand(2, 5);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });
});

describe('P', () => {
  it('short-circuits at the extremes WITHOUT a draw', () => {
    // Draw-order contract: P(>=1) and P(<=0) must not consume the stream,
    // or every downstream golden shifts.
    let draws = 0;
    Math.random = () => {
      draws++;
      return 0.5;
    };
    expect(P(1)).toBe(true);
    expect(P(1.5)).toBe(true);
    expect(P(0)).toBe(false);
    expect(P(-0.2)).toBe(false);
    expect(draws).toBe(0);
    expect(P(0.5)).toBeTypeOf('boolean');
    expect(draws).toBe(1);
  });
});

describe('each', () => {
  it('returns true every n-th index from 0', () => {
    const every3 = each(3);
    expect([0, 1, 2, 3, 4, 5, 6].map(every3)).toEqual([
      true, false, false, true, false, false, true,
    ]);
  });
});

describe('gauss', () => {
  it('clamps to [min, max] and rounds to the requested precision', () => {
    for (let i = 0; i < 1_000; i++) {
      const v = gauss(100, 30, 60, 140, 0);
      expect(v).toBeGreaterThanOrEqual(60);
      expect(v).toBeLessThanOrEqual(140);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('is deterministic under a seeded stream', () => {
    Math.random = Alea('gauss-seed') as unknown as () => number;
    const first = Array.from({ length: 10 }, () => gauss());
    Math.random = Alea('gauss-seed') as unknown as () => number;
    const second = Array.from({ length: 10 }, () => gauss());
    expect(first).toEqual(second);
  });
});

describe('Pint', () => {
  it('returns the integer part or one more, by the decimal probability', () => {
    for (let i = 0; i < 500; i++) {
      const v = Pint(2.4);
      expect([2, 3]).toContain(v);
    }
    expect(Pint(5)).toBe(5);
  });
});

describe('ra', () => {
  it('picks only elements of the array-like, including strings', () => {
    const items = [1, 2, 3];
    for (let i = 0; i < 300; i++) {
      expect(items).toContain(ra(items));
      expect('abc').toContain(ra('abc'));
    }
  });
});

describe('rw', () => {
  it('returns only keys with weight, never a zero-weight key', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2_000; i++) {
      seen.add(rw({ a: 1, b: 3, none: 0 }));
    }
    expect(seen.has('none')).toBe(false);
    expect([...seen].sort()).toEqual(['a', 'b']);
  });
});

describe('biased', () => {
  it('stays inside [min, max]', () => {
    for (let i = 0; i < 2_000; i++) {
      const v = biased(2, 10, 3);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
});

describe('getNumberInRange', () => {
  it('parses a plain integer string', () => {
    expect(getNumberInRange('2')).toBe(2);
    expect(getNumberInRange('0')).toBe(0);
  });

  it('parses a float string to floor or floor+1', () => {
    for (let i = 0; i < 300; i++) {
      expect([0, 1]).toContain(getNumberInRange('0.5'));
      expect([2, 3]).toContain(getNumberInRange('2.5'));
    }
  });

  it('parses a range string to an integer inside the range', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2_000; i++) {
      const v = getNumberInRange('1-3');
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('returns 0 for a non-string input', () => {
    expect(getNumberInRange(5 as unknown as string)).toBe(0);
  });
});
