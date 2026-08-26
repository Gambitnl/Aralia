import { describe, it, expect } from 'vitest';
import { matchesUsageFilters, type UsageFilterState } from '../docUsageFilter';
import type { DocUsage } from '../docUsageClient';

const ALL: UsageFilterState = { consumed: 'all', role: 'all', duplicate: 'all', confidence: 'all' };
const u = (o: Partial<DocUsage>): DocUsage => ({
  path: 'x.md', consumedBy: [], consumedVia: null, duplicateGroupId: null, role: null,
  ageDays: 0, gitAgeDays: null, wordCount: 100, openTaskCount: 0, inboundLinks: 0,
  lifecycle: null, supersededBy: null, candidate: { isCandidate: false, reasons: [], confidence: 'none' }, ...o,
});

describe('matchesUsageFilters', () => {
  it('all-all passes everything, including missing usage', () => {
    expect(matchesUsageFilters(undefined, ALL)).toBe(true);
    expect(matchesUsageFilters(u({}), ALL)).toBe(true);
  });
  it('unused hides consumed docs', () => {
    expect(matchesUsageFilters(u({ consumedBy: ['grill'] }), { ...ALL, consumed: 'unused' })).toBe(false);
    expect(matchesUsageFilters(u({ consumedBy: [] }), { ...ALL, consumed: 'unused' })).toBe(true);
  });
  it('role filter matches role', () => {
    expect(matchesUsageFilters(u({ role: 'plan' }), { ...ALL, role: 'plan' })).toBe(true);
    expect(matchesUsageFilters(u({ role: 'reference' }), { ...ALL, role: 'plan' })).toBe(false);
  });
  it('dupes + candidate filters', () => {
    expect(matchesUsageFilters(u({ duplicateGroupId: 3 }), { ...ALL, duplicate: 'dupes' })).toBe(true);
    expect(matchesUsageFilters(u({ candidate: { isCandidate: true, reasons: [], confidence: 'high' } }), { ...ALL, confidence: 'candidate' })).toBe(true);
    expect(matchesUsageFilters(u({}), { ...ALL, confidence: 'candidate' })).toBe(false);
  });
  it('missing usage fails any active filter', () => {
    expect(matchesUsageFilters(undefined, { ...ALL, consumed: 'unused' })).toBe(false);
  });
});
