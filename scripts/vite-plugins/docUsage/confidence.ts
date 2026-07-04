import type { Candidate } from './types';

const STALE_DAYS = 180;
const EMPTY_WORDS = 20;

export interface ConfidenceInput {
  consumed: boolean; inboundLinks: number; gitAgeDays: number | null;
  wordCount: number; isDuplicate: boolean; supersededBy: string | null;
  lifecycle: string | null; inLedger: boolean;
}

export function combineConfidence(i: ConfidenceInput): Candidate {
  const reasons: string[] = [];

  if (i.lifecycle) reasons.push(`marked ${i.lifecycle}`);
  if (i.inLedger) reasons.push('in retirement ledger');
  if (reasons.length) return { isCandidate: true, reasons, confidence: 'authoritative' };

  if (i.wordCount < EMPTY_WORDS) reasons.push('empty/near-empty');
  if (i.isDuplicate) reasons.push('duplicate content');
  if (i.supersededBy) reasons.push(`superseded by ${i.supersededBy}`);
  if (reasons.length) return { isCandidate: true, reasons, confidence: 'high' };

  const stale = (i.gitAgeDays ?? 0) > STALE_DAYS;
  if (!i.consumed && (i.inboundLinks === 0 || stale)) {
    reasons.push('no app consumes it');
    if (i.inboundLinks === 0) reasons.push('orphan (no inbound links)');
    if (stale) reasons.push(`git-stale (${i.gitAgeDays}d)`);
    return { isCandidate: true, reasons, confidence: 'high' };
  }
  if (!i.consumed) return { isCandidate: false, reasons: ['no app consumes it'], confidence: 'low' };
  return { isCandidate: false, reasons: [], confidence: 'none' };
}
