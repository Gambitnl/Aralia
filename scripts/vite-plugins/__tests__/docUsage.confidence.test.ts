import { describe, it, expect } from 'vitest';
import { combineConfidence } from '../docUsage/confidence';

const base = { consumed: true, inboundLinks: 3, gitAgeDays: 10, wordCount: 500,
  isDuplicate: false, supersededBy: null, lifecycle: null, inLedger: false };

describe('combineConfidence', () => {
  it('lifecycle marker is authoritative', () => {
    const c = combineConfidence({ ...base, lifecycle: 'retired' });
    expect(c.isCandidate).toBe(true); expect(c.confidence).toBe('authoritative');
  });
  it('unused + orphan is a high candidate', () => {
    const c = combineConfidence({ ...base, consumed: false, inboundLinks: 0 });
    expect(c.isCandidate).toBe(true); expect(c.confidence).toBe('high');
    expect(c.reasons.join(' ')).toMatch(/no app|orphan/i);
  });
  it('unused but linked and fresh is low-confidence, not a candidate', () => {
    const c = combineConfidence({ ...base, consumed: false });
    expect(c.isCandidate).toBe(false); expect(c.confidence).toBe('low');
  });
  it('empty doc is a high candidate', () => {
    const c = combineConfidence({ ...base, wordCount: 5 });
    expect(c.isCandidate).toBe(true); expect(c.confidence).toBe('high');
  });
  it('consumed, linked, fresh, non-empty is none', () => {
    expect(combineConfidence(base).confidence).toBe('none');
  });
});
