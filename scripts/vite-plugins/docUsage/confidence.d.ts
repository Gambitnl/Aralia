import type { Candidate } from './types';
export interface ConfidenceInput {
    consumed: boolean;
    inboundLinks: number;
    gitAgeDays: number | null;
    wordCount: number;
    isDuplicate: boolean;
    supersededBy: string | null;
    lifecycle: string | null;
    inLedger: boolean;
}
export declare function combineConfidence(i: ConfidenceInput): Candidate;
