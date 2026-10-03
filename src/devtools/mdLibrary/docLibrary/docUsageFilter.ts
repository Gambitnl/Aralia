import type { DocUsage } from './docUsageClient';

export interface UsageFilterState {
  consumed: 'all'|'used'|'unused';
  role: 'all'|string;
  duplicate: 'all'|'dupes';
  confidence: 'all'|'candidate';
}

export function matchesUsageFilters(u: DocUsage | undefined, f: UsageFilterState): boolean {
  const allDefault = f.consumed === 'all' && f.role === 'all' && f.duplicate === 'all' && f.confidence === 'all';
  if (!u) return allDefault;
  if (f.consumed === 'used' && u.consumedBy.length === 0) return false;
  if (f.consumed === 'unused' && u.consumedBy.length > 0) return false;
  if (f.role !== 'all' && u.role !== f.role) return false;
  if (f.duplicate === 'dupes' && u.duplicateGroupId == null) return false;
  if (f.confidence === 'candidate' && !u.candidate.isCandidate) return false;
  return true;
}
