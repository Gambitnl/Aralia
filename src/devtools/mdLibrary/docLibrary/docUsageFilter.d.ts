import type { DocUsage } from './docUsageClient';
export interface UsageFilterState {
    consumed: 'all' | 'used' | 'unused';
    role: 'all' | string;
    duplicate: 'all' | 'dupes';
    confidence: 'all' | 'candidate';
}
export declare function matchesUsageFilters(u: DocUsage | undefined, f: UsageFilterState): boolean;
