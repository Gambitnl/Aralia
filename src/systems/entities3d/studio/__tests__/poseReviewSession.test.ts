/**
 * @file poseReviewSession.test.ts — coverage for the Studio pose-review state
 * machine (agora-d32a).
 *
 * The three things this file exists to defend, because each one is the kind of
 * bug that a reviewer would only notice as "the tool lied to me":
 *   1. ATOMICITY — one reviewer gesture is one undo step, even when it edits
 *      several fields; and a no-op gesture costs no undo step at all.
 *   2. ROUND-TRIP DETERMINISM — undo then redo returns the exact same receipt
 *      hash, and key order in the input never changes the hash.
 *   3. LINEAGE FIDELITY — the receipt carries the strip definition it was
 *      actually shot with, not the module defaults.
 */
import { describe, it, expect } from 'vitest';

import {
  POSE_REVIEW_SESSION_VERSION,
  POSE_SAMPLES,
  REVIEW_CAMERAS,
  applyAll,
  buildPoseReviewReceipt,
  canRedo,
  canUndo,
  canonicalizeReceiptValue,
  createPoseReviewSession,
  poseReviewReducer,
  shotId,
  type PoseReviewLineage,
  type PoseReviewSessionV1,
} from '../poseReviewSession';

const LINEAGE: PoseReviewLineage = {
  subjectId: 'canid-v2',
  standInFor: "Aralia's deterministic wolf/beast quadruped plan (no literal canid-v2 asset exists)",
  recipe: {
    kind: 'creature',
    creatureType: 'Beast',
    size: 'Medium',
    seed: 'agora-d32a:canid-v2-pose-review',
    cues: ['wolf', 'beast', 'hound'],
  },
  pipeline: [
    'src/systems/entities3d/creatureProfiles.ts profileForCreature()',
    'src/systems/entities3d/creaturePlans.ts planForCreature() -> beastPlan()',
    'src/systems/entities3d/textPlan/compilePlan.ts compilePlan()',
  ],
  compiled: { gait: 'plan', label: 'Beast', segmentCount: 42 },
};

/** A deterministic, dependency-free stand-in for sha256. Order-sensitive and
 * avalanche-y enough that a one-character receipt change moves it. */
function stubHash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + text.charCodeAt(i) + i, 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'));
}

const newSession = (): PoseReviewSessionV1 =>
  createPoseReviewSession({ sessionId: 'agora-d32a', lineage: LINEAGE });

describe('createPoseReviewSession', () => {
  it('builds a samples x cameras shot grid in reading order', () => {
    const s = newSession();
    expect(s.version).toBe(POSE_REVIEW_SESSION_VERSION);
    expect(POSE_SAMPLES).toHaveLength(3);
    expect(REVIEW_CAMERAS).toHaveLength(3);
    expect(s.present.shots).toHaveLength(9);
    expect(s.present.shots.map((x) => x.id)).toEqual([
      'stance@threequarter', 'stance@front', 'stance@side',
      'contact@threequarter', 'contact@front', 'contact@side',
      'suspension@threequarter', 'suspension@front', 'suspension@side',
    ]);
    expect(s.present.shots.every((x) => x.verdict === 'unreviewed' && x.note === '' && x.evidence === null)).toBe(true);
    expect(canUndo(s)).toBe(false);
    expect(canRedo(s)).toBe(false);
  });

  it('ships three semantic samples that are all frozen and phase-pinned', () => {
    // Freeze + an explicit phase is the whole reproducibility contract; a
    // sample that is not frozen cannot be evidence.
    expect(POSE_SAMPLES.every((p) => p.frozen)).toBe(true);
    expect(POSE_SAMPLES.map((p) => p.gaitPhase)).toEqual([0, 0.25, 0.75]);
    // Overlay-driven actions are excluded on purpose: the debugger's freeze
    // control does not stop the combat-overlay clock, so they drift.
    expect(POSE_SAMPLES.map((p) => p.action)).toEqual(['idle', 'walk', 'walk']);
    expect(POSE_SAMPLES.every((p) => p.semantics.length > 20)).toBe(true);
  });

  it('uses neutral review cameras only (no top-down, no face close-up)', () => {
    expect(REVIEW_CAMERAS.map((c) => c.id)).toEqual(['threequarter', 'front', 'side']);
    // All three aim at the same mid-body height: that is what makes them
    // comparable to each other rather than three unrelated shots.
    expect(new Set(REVIEW_CAMERAS.map((c) => c.target.join(',')))).toEqual(new Set(['0,0.9,0']));
    expect(REVIEW_CAMERAS.every((c) => c.source.includes('PreviewEntityDebug.tsx'))).toBe(true);
  });

  it('gives three genuinely different viewpoints', () => {
    // The bug this pins: the debugger's own `threequarter` preset sits at
    // azimuth 45 degrees and the scene yaws the entity by another 45, so it
    // renders a dead-on FRONT view — a duplicate of the `front` preset, and a
    // third of the strip wasted. REVIEW_CAMERAS corrects the azimuth; this
    // test fails if anyone copies the raw preset back in.
    const azimuth = (c: (typeof REVIEW_CAMERAS)[number]): number =>
      (Math.atan2(c.position[0], c.position[2]) * 180) / Math.PI;
    const angles = REVIEW_CAMERAS.map(azimuth);
    for (let i = 0; i < angles.length; i++) {
      for (let j = i + 1; j < angles.length; j++) {
        // Shortest angular separation, wrapped into [0, 180].
        const separation = Math.abs((((angles[i] - angles[j] + 180) % 360) + 360) % 360 - 180);
        expect(separation).toBeGreaterThan(20);
      }
    }
    // Radius and height are the debugger's, untouched; only azimuth moved.
    const radius = Math.hypot(REVIEW_CAMERAS[0].position[0], REVIEW_CAMERAS[0].position[2]);
    expect(radius).toBeCloseTo(Math.hypot(3.4, 3.4), 2);
    expect(REVIEW_CAMERAS[0].position[1]).toBe(1.9);
  });
});

describe('poseReviewReducer — edits', () => {
  it('records a verdict and bumps the revision once', () => {
    const s = poseReviewReducer(newSession(), { type: 'setVerdict', shotId: 'stance@front', verdict: 'accept' });
    expect(s.present.shots.find((x) => x.id === 'stance@front')?.verdict).toBe('accept');
    expect(s.present.revision).toBe(1);
    expect(s.past).toHaveLength(1);
  });

  it('ignores an unknown shot id without disturbing history', () => {
    const before = newSession();
    const after = poseReviewReducer(before, { type: 'setVerdict', shotId: 'nope@nope', verdict: 'reject' });
    expect(after).toBe(before);
  });

  it('treats a no-op edit as no gesture at all', () => {
    // Re-clicking the verdict already selected must not cost an undo step,
    // or "undo" stops meaning "undo my last real change".
    const s1 = poseReviewReducer(newSession(), { type: 'setVerdict', shotId: 'contact@side', verdict: 'redo' });
    const s2 = poseReviewReducer(s1, { type: 'setVerdict', shotId: 'contact@side', verdict: 'redo' });
    expect(s2).toBe(s1);
    expect(s2.past).toHaveLength(1);
    expect(s2.present.revision).toBe(1);
  });

  it('merges attached evidence instead of replacing it', () => {
    const s = applyAll(newSession(), [
      { type: 'attachEvidence', shotId: 'stance@side', evidence: { file: '.agent/scratch/a.png', widthPx: 1100 } },
      { type: 'attachEvidence', shotId: 'stance@side', evidence: { sha256: 'abc', inkFraction: 0.31 } },
    ]);
    expect(s.present.shots.find((x) => x.id === 'stance@side')?.evidence).toEqual({
      file: '.agent/scratch/a.png', widthPx: 1100, sha256: 'abc', inkFraction: 0.31,
    });
    expect(s.present.revision).toBe(2);
  });

  it('clearShot resets a reviewed shot and is a no-op on a pristine one', () => {
    const reviewed = applyAll(newSession(), [
      { type: 'setVerdict', shotId: 'suspension@front', verdict: 'reject' },
      { type: 'setNote', shotId: 'suspension@front', note: 'hind pastern collapses' },
    ]);
    const cleared = poseReviewReducer(reviewed, { type: 'clearShot', shotId: 'suspension@front' });
    expect(cleared.present.shots.find((x) => x.id === 'suspension@front')).toMatchObject({
      verdict: 'unreviewed', note: '', evidence: null,
    });
    expect(poseReviewReducer(cleared, { type: 'clearShot', shotId: 'suspension@front' })).toBe(cleared);
  });
});

describe('poseReviewReducer — atomic undo/redo', () => {
  it('collapses a multi-field gesture into ONE undo step', () => {
    const base = newSession();
    const gesture = poseReviewReducer(base, {
      type: 'batch',
      label: 'reject with note and evidence',
      actions: [
        { type: 'setVerdict', shotId: 'contact@front', verdict: 'reject' },
        { type: 'setNote', shotId: 'contact@front', note: 'foreleg passes through chest' },
        { type: 'attachEvidence', shotId: 'contact@front', evidence: { file: '.agent/scratch/c-front.png' } },
      ],
    });
    expect(gesture.past).toHaveLength(1);
    expect(gesture.present.revision).toBe(1);

    const undone = poseReviewReducer(gesture, { type: 'undo' });
    // ONE undo removes all three field changes, not just the last of them.
    expect(undone.present.shots.find((x) => x.id === 'contact@front')).toMatchObject({
      verdict: 'unreviewed', note: '', evidence: null,
    });
    expect(undone.present).toEqual(base.present);
  });

  it('flattens nested batches into the same single step', () => {
    const s = poseReviewReducer(newSession(), {
      type: 'batch',
      actions: [
        { type: 'setVerdict', shotId: 'stance@front', verdict: 'accept' },
        { type: 'batch', actions: [{ type: 'setNote', shotId: 'stance@side', note: 'ok' }] },
      ],
    });
    expect(s.past).toHaveLength(1);
    expect(poseReviewReducer(s, { type: 'undo' }).present.shots.every((x) => x.note === '' && x.verdict === 'unreviewed')).toBe(true);
  });

  it('undoes and redoes a run of gestures in order', () => {
    let s = applyAll(newSession(), [
      { type: 'setVerdict', shotId: 'stance@threequarter', verdict: 'accept' },
      { type: 'setVerdict', shotId: 'contact@threequarter', verdict: 'reject' },
      { type: 'setNote', shotId: 'contact@threequarter', note: 'stride too short' },
    ]);
    expect(s.past).toHaveLength(3);

    s = poseReviewReducer(s, { type: 'undo' });
    expect(s.present.shots.find((x) => x.id === 'contact@threequarter')?.note).toBe('');
    expect(s.present.shots.find((x) => x.id === 'contact@threequarter')?.verdict).toBe('reject');
    expect(canRedo(s)).toBe(true);

    s = poseReviewReducer(s, { type: 'undo' });
    expect(s.present.shots.find((x) => x.id === 'contact@threequarter')?.verdict).toBe('unreviewed');

    s = poseReviewReducer(poseReviewReducer(s, { type: 'redo' }), { type: 'redo' });
    expect(s.present.shots.find((x) => x.id === 'contact@threequarter')).toMatchObject({
      verdict: 'reject', note: 'stride too short',
    });
    expect(canRedo(s)).toBe(false);
  });

  it('undo and redo at the ends of history are no-ops, not errors', () => {
    const base = newSession();
    expect(poseReviewReducer(base, { type: 'undo' })).toBe(base);
    expect(poseReviewReducer(base, { type: 'redo' })).toBe(base);
  });

  it('a new edit clears the redo future', () => {
    let s = poseReviewReducer(newSession(), { type: 'setVerdict', shotId: 'stance@front', verdict: 'accept' });
    s = poseReviewReducer(s, { type: 'undo' });
    expect(canRedo(s)).toBe(true);
    s = poseReviewReducer(s, { type: 'setVerdict', shotId: 'stance@side', verdict: 'redo' });
    expect(canRedo(s)).toBe(false);
    expect(s.future).toHaveLength(0);
  });

  it('never mutates the state it was handed', () => {
    const base = newSession();
    const snapshot = JSON.stringify(base);
    poseReviewReducer(base, { type: 'setNote', shotId: 'stance@front', note: 'mutating?' });
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});

describe('buildPoseReviewReceipt', () => {
  const reviewed = (): PoseReviewSessionV1 =>
    applyAll(newSession(), [
      {
        type: 'batch',
        actions: [
          { type: 'setVerdict', shotId: 'stance@front', verdict: 'accept' },
          { type: 'attachEvidence', shotId: 'stance@front', evidence: { file: 'a.png', sha256: 'aa', inkFraction: 0.2413 } },
        ],
      },
      { type: 'setVerdict', shotId: 'contact@side', verdict: 'reject' },
    ]);

  it('summarizes verdicts and refuses to claim completeness early', () => {
    const { receipt } = buildPoseReviewReceipt(reviewed(), { hash: stubHash });
    expect(receipt.summary).toEqual({
      total: 9, accept: 1, reject: 1, redo: 0, unreviewed: 7, captured: 1, complete: false,
    });
    expect(receipt.version).toBe(POSE_REVIEW_SESSION_VERSION);
    expect(receipt.lineage.recipe.seed).toBe('agora-d32a:canid-v2-pose-review');
  });

  it('marks complete only when every shot has a verdict AND evidence', () => {
    let s = newSession();
    for (const sample of POSE_SAMPLES) {
      for (const cam of REVIEW_CAMERAS) {
        s = poseReviewReducer(s, {
          type: 'batch',
          actions: [
            { type: 'setVerdict', shotId: shotId(sample.id, cam.id), verdict: 'accept' },
            { type: 'attachEvidence', shotId: shotId(sample.id, cam.id), evidence: { file: `${sample.id}-${cam.id}.png` } },
          ],
        });
      }
    }
    expect(buildPoseReviewReceipt(s).receipt.summary.complete).toBe(true);
    // Drop one verdict: completeness must fall back off.
    const dented = poseReviewReducer(s, { type: 'clearShot', shotId: 'stance@side' });
    expect(buildPoseReviewReceipt(dented).receipt.summary.complete).toBe(false);
  });

  it('is byte-identical across repeated builds', () => {
    const a = buildPoseReviewReceipt(reviewed(), { hash: stubHash });
    const b = buildPoseReviewReceipt(reviewed(), { hash: stubHash });
    expect(a.canonicalJson).toBe(b.canonicalJson);
    expect(a.receipt.contentHash).toBe(b.receipt.contentHash);
  });

  it('survives an undo/redo round trip with the same hash', () => {
    // The receipt describes the state reached, not the route taken. Undoing
    // and redoing must land on the identical hash or "deterministic receipt"
    // is a claim the tool cannot keep.
    const before = buildPoseReviewReceipt(reviewed(), { hash: stubHash });
    const roundTripped = poseReviewReducer(poseReviewReducer(reviewed(), { type: 'undo' }), { type: 'redo' });
    const after = buildPoseReviewReceipt(roundTripped, { hash: stubHash });
    expect(after.canonicalJson).toBe(before.canonicalJson);
    expect(after.receipt.contentHash).toBe(before.receipt.contentHash);
  });

  it('changes hash when any reviewed field changes', () => {
    const base = buildPoseReviewReceipt(reviewed(), { hash: stubHash }).receipt.contentHash;
    const noted = buildPoseReviewReceipt(
      poseReviewReducer(reviewed(), { type: 'setNote', shotId: 'contact@side', note: 'hock' }),
      { hash: stubHash },
    ).receipt.contentHash;
    expect(noted).not.toBe(base);
  });

  it('omits the undo history from the receipt entirely', () => {
    const { canonicalJson } = buildPoseReviewReceipt(reviewed(), { hash: stubHash });
    expect(canonicalJson).not.toContain('"past"');
    expect(canonicalJson).not.toContain('"future"');
  });

  it('leaves contentHash null when no hasher is supplied', () => {
    expect(buildPoseReviewReceipt(reviewed()).receipt.contentHash).toBeNull();
  });

  it('carries a custom strip definition rather than the module defaults', () => {
    const custom = createPoseReviewSession({
      sessionId: 'custom',
      lineage: LINEAGE,
      samples: [{ id: 'only', label: 'only', semantics: 'single-pose strip', action: 'idle', gaitPhase: 0.5, frozen: true }],
      cameras: [REVIEW_CAMERAS[1]],
    });
    const { receipt } = buildPoseReviewReceipt(custom, { hash: stubHash });
    expect(receipt.shots.map((x) => x.id)).toEqual(['only@front']);
    expect(receipt.samples[0].gaitPhase).toBe(0.5);
    expect(receipt.cameras).toHaveLength(1);
  });
});

describe('canonicalizeReceiptValue', () => {
  it('sorts keys so input key order cannot move the hash', () => {
    const a = JSON.stringify(canonicalizeReceiptValue({ b: 1, a: { d: 2, c: 3 } }));
    const b = JSON.stringify(canonicalizeReceiptValue({ a: { c: 3, d: 2 }, b: 1 }));
    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('preserves array order (the strip reads in order)', () => {
    expect(canonicalizeReceiptValue([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it('rounds floats and normalizes -0 so float noise cannot move the hash', () => {
    expect(canonicalizeReceiptValue(0.1 + 0.2)).toBe(0.3);
    expect(Object.is(canonicalizeReceiptValue(-0), 0)).toBe(true);
    expect(canonicalizeReceiptValue(1.23456789)).toBe(1.234568);
  });

  it('drops undefined so absent and undefined hash alike', () => {
    expect(JSON.stringify(canonicalizeReceiptValue({ a: 1, b: undefined }))).toBe('{"a":1}');
  });

  it('leaves non-finite numbers alone rather than inventing a value', () => {
    expect(canonicalizeReceiptValue(Number.NaN)).toBeNaN();
    expect(canonicalizeReceiptValue(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });
});
