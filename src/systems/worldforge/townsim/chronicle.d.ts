import type { TownSimState } from './types';
export interface ChronicleRange {
    fromDay?: number;
    toDay?: number;
}
/**
 * One line per year that had events, e.g.:
 *   "Year 3: Bedwyr died at age 81. Mara succeeded Bedwyr as innkeeper. 2 births, 1 came of age."
 */
export declare function summarizeChronicle(state: TownSimState, range?: ChronicleRange): string[];
