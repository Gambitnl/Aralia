/**
 * Judgment records (ADR 0001): the verdict helpers, and the integrity of the
 * two data lists that feed the Judge portal (C14, agora-9ed9.14).
 *
 * The data checks guard the drift promise: a verdict is only detectable as
 * stale if every subject names real source files, and a filed verdict only
 * counts if it names a known subject.
 *
 * Exercises: src/systems/judgment/verdicts.ts, recordedVerdicts.ts,
 * pendingJudgments.ts
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { isDrifted, needsEye, subjectVersion, type VerdictRecord, type Verdict } from '../verdicts';
import { RECORDED_VERDICTS, latestVerdict } from '../recordedVerdicts';
import { PENDING_JUDGMENTS } from '../pendingJudgments';

const subject = PENDING_JUDGMENTS[0];
const verdict = (overrides: Partial<Verdict> = {}): Verdict => ({
  subjectId: subject.id, call: 'approved', by: 'Remy', on: '2026-08-18', subjectVersion: 'aaaa0001', ...overrides,
});

describe('subjectVersion', () => {
  it('is a stable 8-character hex hash of the source contents', () => {
    const v = subjectVersion(['export const a = 1;\n', 'export const b = 2;\n']);
    expect(v).toMatch(/^[0-9a-f]{8}$/);
    expect(subjectVersion(['export const a = 1;\n', 'export const b = 2;\n'])).toBe(v);
  });

  it('changes when any byte of any source changes, and with the source order', () => {
    const base = subjectVersion(['alpha', 'beta']);
    expect(subjectVersion(['alpha', 'betA'])).not.toBe(base);
    expect(subjectVersion(['beta', 'alpha'])).not.toBe(base);
  });

  it('gives the FNV offset basis for no content, padded to 8 characters', () => {
    expect(subjectVersion([])).toBe('811c9dc5');
    expect(subjectVersion([''])).toBe('811c9dc5');
  });
});

describe('isDrifted and needsEye', () => {
  it('never calls an unjudged subject drifted, but it always needs an eye', () => {
    const record: VerdictRecord = { subject };
    expect(isDrifted(record, 'anything')).toBe(false);
    expect(needsEye(record, 'anything')).toBe(true);
  });

  it('keeps a current approval out of the queue', () => {
    const record: VerdictRecord = { subject, verdict: verdict() };
    expect(isDrifted(record, 'aaaa0001')).toBe(false);
    expect(needsEye(record, 'aaaa0001')).toBe(false);
  });

  it('puts a judged subject back in the queue when its sources moved', () => {
    const record: VerdictRecord = { subject, verdict: verdict() };
    expect(isDrifted(record, 'bbbb0002')).toBe(true);
    expect(needsEye(record, 'bbbb0002')).toBe(true);
  });

  it('keeps a pending call in the queue even at the current version', () => {
    const record: VerdictRecord = { subject, verdict: verdict({ call: 'pending' }) };
    expect(needsEye(record, 'aaaa0001')).toBe(true);
  });

  it('treats rejected and needs-work at the current version as answered', () => {
    for (const call of ['rejected', 'needs-work'] as const) {
      expect(needsEye({ subject, verdict: verdict({ call }) }, 'aaaa0001')).toBe(false);
    }
  });
});

describe('latestVerdict', () => {
  it('returns undefined for a subject nobody has judged', () => {
    expect(latestVerdict('no-such-subject')).toBeUndefined();
  });

  it('returns the LAST filed record for a subject, so a re-judgment wins', () => {
    const filed = RECORDED_VERDICTS.filter((entry) => entry.subjectId === 'understory-fern-shape');
    expect(filed.length).toBeGreaterThan(0);
    expect(latestVerdict('understory-fern-shape')).toBe(filed[filed.length - 1]);
  });
});

describe('judgment data integrity', () => {
  it('gives every pending subject a unique id and every required field', () => {
    const ids = PENDING_JUDGMENTS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of PENDING_JUDGMENTS) {
      for (const field of ['id', 'title', 'question', 'surface', 'whyHuman'] as const) {
        expect(entry[field].trim(), `${entry.id}.${field}`).not.toBe('');
      }
      expect(entry.sources.length, `${entry.id} needs sources for drift detection`).toBeGreaterThan(0);
    }
  });

  it('names only source files that exist, so drift detection can hash them', () => {
    const root = process.cwd();
    const missing = PENDING_JUDGMENTS.flatMap((entry) =>
      entry.sources.filter((source) => !existsSync(path.join(root, source))).map((source) => `${entry.id}: ${source}`));
    expect(missing).toEqual([]);
  });

  it('files verdicts only against known subjects, with a signer, a day and a version', () => {
    const known = new Set(PENDING_JUDGMENTS.map((entry) => entry.id));
    for (const entry of RECORDED_VERDICTS) {
      expect(known.has(entry.subjectId), entry.subjectId).toBe(true);
      expect(entry.by.trim()).not.toBe('');
      expect(entry.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.subjectVersion).toMatch(/^[0-9a-f]{8}$/);
    }
  });
});
