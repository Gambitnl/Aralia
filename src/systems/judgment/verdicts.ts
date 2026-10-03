/**
 * @file verdicts.ts — the record of what a person judged, and what they said.
 *
 * Aralia's visual work needs a human eye. A generator can measure that a fern
 * is 1.05 m tall. It cannot decide whether the fern reads as a fern.
 *
 * Before this existed, that judgment happened in chat. A session on 2026-08-05
 * asked Remy to judge the forest understory twice, and neither answer survives
 * anywhere but the transcript. The next agent to touch that code rediscovers
 * both.
 *
 * See docs/adr/0001-judgment-surfaces-and-recorded-verdicts.md for the four
 * failures that produced this file, and CONTEXT.md for the terms.
 */

/** What a person can say about a subject. */
export type VerdictCall = 'approved' | 'rejected' | 'needs-work' | 'pending';

/**
 * One thing that needs an eye.
 *
 * `subjectVersion` is the load-bearing field. A verdict that does not name the
 * version it judged cannot be detected as stale, so it keeps reading as
 * approval for something that no longer exists. See `isDrifted`.
 */
export interface JudgmentSubject {
  /** Stable id. Never reuse one for a different subject. */
  id: string;
  /** What the reviewer is looking at, in plain words. */
  title: string;
  /** The decision being asked for. One question, not a list. */
  question: string;
  /**
   * Where to look. A design-preview step id, or a URL for a live surface.
   * A judgment surface must be reachable and returnable — a chat screenshot
   * is not one.
   */
  surface: string;
  /**
   * What the subject must be judged AGAINST. A shape alone is not judgeable;
   * a shape beside the thing it replaced is.
   */
  against?: string;
  /** Source files the subject is built from. Used to detect drift. */
  sources: readonly string[];
  /** Why this needs a human rather than a test. */
  whyHuman: string;
}

/** A person's answer, recorded beside the subject. */
export interface Verdict {
  subjectId: string;
  call: VerdictCall;
  /** Who judged. Verdicts are personal; an unsigned verdict is an opinion. */
  by: string;
  /** ISO day the verdict was given. */
  on: string;
  /**
   * The version of the subject that was judged. A short content hash of the
   * subject's sources. When the sources move, this stops matching and the
   * verdict is known to be stale rather than assumed current.
   */
  subjectVersion: string;
  /** What the person actually said. Kept verbatim; it is the useful part. */
  note?: string;
}

export interface VerdictRecord {
  subject: JudgmentSubject;
  verdict?: Verdict;
}

/**
 * Has the subject moved since it was judged?
 *
 * This is the whole reason `subjectVersion` exists. A stale verdict is worse
 * than a missing one, because a reader trusts it.
 */
export function isDrifted(record: VerdictRecord, currentVersion: string): boolean {
  if (!record.verdict) return false;
  return record.verdict.subjectVersion !== currentVersion;
}

/** Pending means nobody has looked, or the subject moved since they did. */
export function needsEye(record: VerdictRecord, currentVersion: string): boolean {
  if (!record.verdict) return true;
  if (record.verdict.call === 'pending') return true;
  return isDrifted(record, currentVersion);
}

/**
 * A short, stable version string for a set of source contents.
 *
 * Deliberately content-based rather than a git hash. A verdict should survive
 * a commit that did not touch the subject, and it should break on an
 * uncommitted edit that did. Git cannot express either.
 */
export function subjectVersion(sourceContents: readonly string[]): string {
  let h = 0x811c9dc5;
  for (const s of sourceContents) {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h.toString(16).padStart(8, '0');
}
