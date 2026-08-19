/**
 * @file recordedVerdicts.ts — the verdicts a person gave, filed in the repo.
 *
 * ADR 0001: a verdict lives beside its subject, moves with the code, and
 * names the subject version it judged. The Judge portal echoes a verdict
 * record after each call; an agent files it here with the version hash.
 *
 * To file one: compute `subjectVersion` over the subject's source contents
 * (verdicts.ts has the hash) and append the record. Never edit a filed
 * verdict — a re-judgment is a new record, and the latest one wins.
 */
import type { Verdict } from './verdicts';

export const RECORDED_VERDICTS: readonly Verdict[] = [
  {
    subjectId: 'understory-fern-shape',
    call: 'approved',
    by: 'Remy',
    on: '2026-08-18',
    subjectVersion: '71f9e91f',
  },
];

/** The latest filed verdict per subject, or undefined. */
export function latestVerdict(subjectId: string): Verdict | undefined {
  for (let i = RECORDED_VERDICTS.length - 1; i >= 0; i--) {
    if (RECORDED_VERDICTS[i].subjectId === subjectId) return RECORDED_VERDICTS[i];
  }
  return undefined;
}
