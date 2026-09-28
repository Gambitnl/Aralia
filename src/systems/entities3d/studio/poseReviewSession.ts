/**
 * @file poseReviewSession.ts — `PoseReviewSessionV1`, the Studio-local review
 * state machine for a single generated entity's pose strip.
 *
 * WHAT THIS IS. A reviewer opens one subject (here: the canid-v2 stand-in),
 * looks at a small strip of poses shot from neutral cameras, and records a
 * verdict plus a note per shot. That is the whole workflow. This module owns
 * the *state* of that workflow — nothing else. It is pure TypeScript with
 * ZERO imports: no three, no React, no node builtins, no fs. That is
 * deliberate and load-bearing:
 *
 *   - `src/systems/entities3d/__tests__/dependencyBoundary.test.ts` forbids
 *     anything under `systems/entities3d/` from importing `src/components/**`
 *     or `src/devtools/**`. The review cameras below therefore RESTATE the
 *     entity-debugger's presets as data instead of importing them (see
 *     `REVIEW_CAMERAS`), with the source file named on each entry so a drift
 *     is findable by grep rather than by surprise.
 *   - A zero-import reducer runs identically in vitest, in a browser Studio
 *     panel, and inside a headless capture rig under plain Node. The capture
 *     rig for this module (the export-canid-pose-review-strip script in
 *     the idea board experiment scripts folder) uses all three properties.
 *
 * WHY A REDUCER AND NOT A STORE. The task's bar is "atomic undo and redo".
 * Atomic means one reviewer gesture is one undo step even when that gesture
 * changes several fields (e.g. "reject with a note" writes a verdict AND a
 * note AND a timestamp). A reducer over an immutable snapshot with an
 * explicit `batch` action gives that for free and stays trivially testable;
 * a mutable store would have to grow a transaction API to say the same thing.
 *
 * WHAT IS PRESERVED / DEFERRED.
 *   - Preserved: the shot grid is (samples x cameras) and both axes are data,
 *     so a later pass can add a fourth pose or a sixth camera without touching
 *     the reducer.
 *   - Preserved: `evidence` is a free-form-but-typed slot per shot, so a rig
 *     that captures something other than a PNG (a GIF, a metric bundle) can
 *     attach it without a schema change to the verdict path.
 *   - Deferred: no persistence, no network, no multi-reviewer merge. A
 *     receipt is the handoff format; how it is stored is the caller's problem.
 *
 * IMPORTANT: this module changes no transfer behavior and no Aralia gameplay
 * behavior. Nothing in `src/` imports it yet; it is consumed by the Studio-side
 * capture rig and by its own tests.
 */

/** Contract tag stamped into every receipt so a reader can version-check it. */
export const POSE_REVIEW_SESSION_VERSION = 'PoseReviewSessionV1' as const;

/** Number of decimal places every numeric field is rounded to in a receipt.
 * Six is enough to distinguish two camera positions in meters and few enough
 * that float noise from a different CPU cannot change the hash. */
export const RECEIPT_PRECISION = 6;

export type Vec3 = readonly [number, number, number];

// ---------------------------------------------------------------------------
// Lineage — "exact lineage" from the task bar.
// ---------------------------------------------------------------------------

/**
 * Exactly which subject was reviewed and exactly how it was produced.
 *
 * `pipeline` is the ordered list of repo-relative modules that turn the recipe
 * into a drawable body. It is recorded verbatim rather than derived so that a
 * receipt read a year from now still says which code path produced the pixels,
 * even if that path has since been renamed. `standInFor` exists because no
 * literal `canid-v2` asset exists in this repo (see the protocol doc); the
 * receipt must never imply that it does.
 */
export interface PoseReviewLineage {
  /** Stable id of the subject under review, e.g. `'canid-v2'`. */
  readonly subjectId: string;
  /** Human sentence naming what `subjectId` actually resolves to today. */
  readonly standInFor: string;
  /** The generator input, verbatim. */
  readonly recipe: {
    readonly kind: string;
    readonly creatureType: string;
    readonly size: string;
    readonly seed: string;
    readonly cues: readonly string[];
  };
  /** Ordered repo-relative module paths, generator input -> drawable body. */
  readonly pipeline: readonly string[];
  /** Facts read back off the compiled body. Free-form on purpose: what is
   * worth pinning differs per subject, and a rigid schema here would force a
   * fake value when a field does not apply. */
  readonly compiled: Readonly<Record<string, string | number | boolean>>;
}

// ---------------------------------------------------------------------------
// Pose samples and review cameras.
// ---------------------------------------------------------------------------

/**
 * Action ids the entity debugger exposes
 * (`src/components/DesignPreview/steps/PreviewEntityDebug.tsx` `ACTIONS`).
 * Restated, not imported — see the file header on the dependency boundary.
 */
export type ReviewActionId =
  | 'idle'
  | 'walk'
  | 'wave'
  | 'attack_melee'
  | 'attack_ranged'
  | 'cast_spell'
  | 'hit_react'
  | 'death';

/**
 * One semantic pose to review.
 *
 * `frozen` + `gaitPhase` is what makes a sample REPRODUCIBLE: the debugger's
 * freeze control stops the gait clock and the phase slider then fully
 * determines the pose, so two runs a week apart shoot the same body.
 *
 * KNOWN LIMIT (verified in EntityDebugScene.tsx's `useFrame`, 2026-09-09):
 * freeze stops the gait clock but NOT the combat-overlay clock, so the
 * overlay actions (`attack_melee` and below) still drift frame to frame.
 * Samples used for a deterministic strip must therefore stay on the
 * driver-level actions — `idle`, `walk`, `wave`. The type keeps the full
 * action list because a later pass that fixes the overlay clock should not
 * have to widen it again.
 */
export interface PoseSampleV1 {
  readonly id: string;
  readonly label: string;
  /** Why a reviewer looks at this pose — the "semantic" in semantic sample. */
  readonly semantics: string;
  readonly action: ReviewActionId;
  /** 0..1 gait phase applied while frozen. */
  readonly gaitPhase: number;
  /** Always true for a review sample; a live/unfrozen sample is not evidence. */
  readonly frozen: boolean;
}

/**
 * A neutral review camera. "Neutral" means: no dramatic angle, no lens tricks,
 * fixed distance, aimed at the body's mid-height — the reviewer is judging the
 * body, not a shot composition.
 */
export interface ReviewCameraV1 {
  readonly id: string;
  readonly label: string;
  readonly position: Vec3;
  readonly target: Vec3;
  /** Where these numbers came from, so a drift is traceable. */
  readonly source: string;
}

/** The entity debugger's preset button id these mirror. */
const DEBUGGER_PRESETS = 'src/components/DesignPreview/steps/PreviewEntityDebug.tsx CAMERA_PRESETS';

/**
 * The three neutral review cameras, taken from the entity debugger's own
 * `threequarter` / `front` / `side` presets. The debugger's `top` and `close`
 * presets are deliberately NOT here: a top-down and a face close-up are
 * diagnostic framings, not neutral review framings, and including them would
 * make the strip about the head instead of about the body.
 *
 * ONE CORRECTION, MEASURED NOT ASSUMED (2026-09-09). The debugger's
 * `threequarter` preset sits at [3.4, 1.9, 3.4] — azimuth 45 degrees — but
 * `EntityDebugScene.tsx` also rotates every entity by `ENTITY_YAW = PI * 0.25`,
 * which is the same 45 degrees. The two cancel, so that preset renders a
 * DEAD-ON FRONT view, near-identical to the `front` preset; captured strips
 * proved it (see the protocol doc). Shipping both would have spent a third of
 * the strip on a duplicate viewpoint. The radius (4.81 m) and height (1.9 m)
 * are kept exactly, and only the azimuth is rotated by another 45 degrees so
 * the camera lands 45 degrees off the subject's actual facing. The debugger's
 * own preset is left alone — mislabeled for this scene, but not this module's
 * to change; it is filed as a gap instead.
 */
export const REVIEW_CAMERAS: readonly ReviewCameraV1[] = Object.freeze([
  Object.freeze({
    id: 'threequarter',
    label: '3/4',
    position: [4.81, 1.9, 0] as Vec3,
    target: [0, 0.9, 0] as Vec3,
    source: `${DEBUGGER_PRESETS} 'threequarter' (same radius/height, azimuth corrected for ENTITY_YAW)`,
  }),
  Object.freeze({
    id: 'front',
    label: 'front',
    position: [3.2, 1.1, 3.4] as Vec3,
    target: [0, 0.9, 0] as Vec3,
    source: `${DEBUGGER_PRESETS} 'front'`,
  }),
  Object.freeze({
    id: 'side',
    label: 'side',
    position: [-4.6, 1.2, 0.4] as Vec3,
    target: [0, 0.9, 0] as Vec3,
    source: `${DEBUGGER_PRESETS} 'side'`,
  }),
]) as readonly ReviewCameraV1[];

/**
 * The three semantic pose samples for a quadruped review strip.
 *
 * Each answers a different review question, which is why three is the right
 * number rather than "a few frames of the walk cycle":
 *   1. stance   — is the body correct when nothing is moving?
 *   2. contact  — do the diagonal pairs plant plausibly at mid-stride?
 *   3. suspension — does the opposite diagonal read, i.e. is the cycle
 *      symmetric, or does one side of the rig do all the work?
 *
 * Phases 0.25 and 0.75 are the two opposed points of a normalized cycle, so
 * (2) and (3) are the same instant of the gait mirrored — a rig that is
 * asymmetric fails visibly between them and nowhere else in the strip.
 */
export const POSE_SAMPLES: readonly PoseSampleV1[] = Object.freeze([
  Object.freeze({
    id: 'stance',
    label: 'settled stance',
    semantics: 'Standing rest. Proportions, ground contact, and silhouette with no motion to hide behind.',
    action: 'idle' as ReviewActionId,
    gaitPhase: 0,
    frozen: true,
  }),
  Object.freeze({
    id: 'contact',
    label: 'stride contact',
    semantics: 'Mid-stride on one diagonal pair. Leg reach, hock/elbow bend, and spine carriage under load.',
    action: 'walk' as ReviewActionId,
    gaitPhase: 0.25,
    frozen: true,
  }),
  Object.freeze({
    id: 'suspension',
    label: 'opposite diagonal',
    semantics: 'The mirrored half of the same cycle. Reveals left/right asymmetry the contact pose hides.',
    action: 'walk' as ReviewActionId,
    gaitPhase: 0.75,
    frozen: true,
  }),
]) as readonly PoseSampleV1[];

// ---------------------------------------------------------------------------
// Shots and session state.
// ---------------------------------------------------------------------------

export type ShotVerdict = 'unreviewed' | 'accept' | 'reject' | 'redo';

/** Whatever the capture rig produced for one shot. Optional throughout: a
 * session is valid before anything has been captured, which is what lets a
 * reviewer plan a strip and then shoot it. */
export interface ShotEvidence {
  /** Repo-relative path of the captured image. */
  readonly file?: string;
  /** Content hash of the captured bytes. */
  readonly sha256?: string;
  /** Fraction of sampled pixels differing from the background — the
   * black-frame guard from `tools/entities3d/capture/captureLib.mjs`. */
  readonly inkFraction?: number;
  readonly widthPx?: number;
  readonly heightPx?: number;
}

export interface ReviewShot {
  readonly id: string;
  readonly sampleId: string;
  readonly cameraId: string;
  readonly verdict: ShotVerdict;
  /** Reviewer's note. Empty string means "no note", never null, so the
   * receipt shape is identical whether or not a note was written. */
  readonly note: string;
  readonly evidence: ShotEvidence | null;
}

/** The reviewable state — the thing undo/redo moves through. */
export interface PoseReviewDoc {
  readonly shots: readonly ReviewShot[];
  /** Monotonic counter of applied gestures. Part of the doc so undo restores
   * it too; a receipt that says "gesture 7" must mean the same thing after an
   * undo/redo round trip as it did before. */
  readonly revision: number;
}

/** The full session: immutable lineage + strip definition + undo history. */
export interface PoseReviewSessionV1 {
  readonly version: typeof POSE_REVIEW_SESSION_VERSION;
  readonly sessionId: string;
  readonly lineage: PoseReviewLineage;
  readonly samples: readonly PoseSampleV1[];
  readonly cameras: readonly ReviewCameraV1[];
  readonly present: PoseReviewDoc;
  readonly past: readonly PoseReviewDoc[];
  readonly future: readonly PoseReviewDoc[];
}

export const shotId = (sampleId: string, cameraId: string): string => `${sampleId}@${cameraId}`;

/**
 * Build the initial session. The shot grid is samples x cameras in declaration
 * order, so the strip reads row-major: every pose across every camera.
 */
export function createPoseReviewSession(init: {
  sessionId: string;
  lineage: PoseReviewLineage;
  samples?: readonly PoseSampleV1[];
  cameras?: readonly ReviewCameraV1[];
}): PoseReviewSessionV1 {
  const samples = init.samples ?? POSE_SAMPLES;
  const cameras = init.cameras ?? REVIEW_CAMERAS;
  const shots: ReviewShot[] = [];
  for (const sample of samples) {
    for (const camera of cameras) {
      shots.push({
        id: shotId(sample.id, camera.id),
        sampleId: sample.id,
        cameraId: camera.id,
        verdict: 'unreviewed',
        note: '',
        evidence: null,
      });
    }
  }
  return {
    version: POSE_REVIEW_SESSION_VERSION,
    sessionId: init.sessionId,
    lineage: init.lineage,
    samples,
    cameras,
    present: { shots, revision: 0 },
    past: [],
    future: [],
  };
}

// ---------------------------------------------------------------------------
// Actions.
// ---------------------------------------------------------------------------

export type PoseReviewAction =
  | { type: 'setVerdict'; shotId: string; verdict: ShotVerdict }
  | { type: 'setNote'; shotId: string; note: string }
  | { type: 'attachEvidence'; shotId: string; evidence: ShotEvidence }
  | { type: 'clearShot'; shotId: string }
  /** One reviewer gesture made of several edits. Applied as ONE undo step —
   * this is the "atomic" in atomic undo. Nested batches flatten. */
  | { type: 'batch'; actions: readonly PoseReviewAction[]; label?: string }
  | { type: 'undo' }
  | { type: 'redo' };

/** Actions that mutate the doc (as opposed to moving through history). */
function isEditAction(action: PoseReviewAction): boolean {
  return action.type !== 'undo' && action.type !== 'redo';
}

/** Apply one edit to a doc's shot list. Returns the SAME array reference when
 * nothing changed, which is how `poseReviewReducer` decides whether a gesture
 * is worth a history entry — a no-op click must not cost an undo step. */
function applyEdit(shots: readonly ReviewShot[], action: PoseReviewAction): readonly ReviewShot[] {
  if (action.type === 'batch') {
    let next = shots;
    for (const inner of action.actions) next = applyEdit(next, inner);
    return next;
  }
  if (action.type === 'undo' || action.type === 'redo') return shots;

  const index = shots.findIndex((s) => s.id === action.shotId);
  // An unknown shot id is a caller bug, but throwing here would take down a
  // review panel over a stale button. Ignoring it keeps the doc consistent and
  // shows up as "nothing happened", which is debuggable.
  if (index < 0) return shots;
  const shot = shots[index];

  let updated: ReviewShot;
  switch (action.type) {
    case 'setVerdict':
      if (shot.verdict === action.verdict) return shots;
      updated = { ...shot, verdict: action.verdict };
      break;
    case 'setNote':
      if (shot.note === action.note) return shots;
      updated = { ...shot, note: action.note };
      break;
    case 'attachEvidence': {
      const merged: ShotEvidence = { ...(shot.evidence ?? {}), ...action.evidence };
      if (shot.evidence && sameEvidence(shot.evidence, merged)) return shots;
      updated = { ...shot, evidence: merged };
      break;
    }
    case 'clearShot':
      if (shot.verdict === 'unreviewed' && shot.note === '' && shot.evidence === null) return shots;
      updated = { ...shot, verdict: 'unreviewed', note: '', evidence: null };
      break;
    default: {
      // Exhaustiveness guard: adding an action without handling it fails here
      // at compile time rather than silently no-opping at runtime.
      const never: never = action;
      return never;
    }
  }

  const next = shots.slice();
  next[index] = updated;
  return next;
}

function sameEvidence(a: ShotEvidence, b: ShotEvidence): boolean {
  return (
    a.file === b.file &&
    a.sha256 === b.sha256 &&
    a.inkFraction === b.inkFraction &&
    a.widthPx === b.widthPx &&
    a.heightPx === b.heightPx
  );
}

/**
 * The reducer. Pure, total, and never mutates its input.
 *
 * History rules, stated once so they are not re-derived from the code:
 *   - An edit that changes nothing produces no history entry (and no revision
 *     bump). Undo must never "eat" a click the reviewer did not make.
 *   - An edit that changes something pushes exactly ONE past entry, including
 *     a `batch` of ten edits. That is the atomicity guarantee.
 *   - Any new edit clears the redo future. Branching history is a whole
 *     feature; silently keeping a stale future is a bug.
 *   - `undo`/`redo` at the ends of history are no-ops, not errors.
 */
export function poseReviewReducer(state: PoseReviewSessionV1, action: PoseReviewAction): PoseReviewSessionV1 {
  if (action.type === 'undo') {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      ...state,
      present: previous,
      past: state.past.slice(0, -1),
      future: [state.present, ...state.future],
    };
  }
  if (action.type === 'redo') {
    if (state.future.length === 0) return state;
    const [next, ...rest] = state.future;
    return {
      ...state,
      present: next,
      past: [...state.past, state.present],
      future: rest,
    };
  }
  if (!isEditAction(action)) return state;

  const nextShots = applyEdit(state.present.shots, action);
  if (nextShots === state.present.shots) return state; // no-op: no history entry
  return {
    ...state,
    present: { shots: nextShots, revision: state.present.revision + 1 },
    past: [...state.past, state.present],
    future: [],
  };
}

/** Convenience: fold a list of actions through the reducer. */
export function applyAll(
  state: PoseReviewSessionV1,
  actions: readonly PoseReviewAction[],
): PoseReviewSessionV1 {
  return actions.reduce(poseReviewReducer, state);
}

export const canUndo = (s: PoseReviewSessionV1): boolean => s.past.length > 0;
export const canRedo = (s: PoseReviewSessionV1): boolean => s.future.length > 0;

// ---------------------------------------------------------------------------
// Deterministic receipt.
// ---------------------------------------------------------------------------

/**
 * Canonicalize for hashing: object keys sorted, numbers rounded to
 * RECEIPT_PRECISION, arrays kept in order (order is meaningful — the strip's
 * reading order is part of the evidence).
 */
export function canonicalizeReceiptValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeReceiptValue);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue; // undefined and absent must hash alike
      out[key] = canonicalizeReceiptValue(source[key]);
    }
    return out;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return value;
    // `+` strips a "-0" and any trailing-zero noise so 0.25 and 0.2500000 hash alike.
    return Number.parseFloat(value.toFixed(RECEIPT_PRECISION));
  }
  return value;
}

export interface PoseReviewReceipt {
  readonly version: typeof POSE_REVIEW_SESSION_VERSION;
  readonly sessionId: string;
  readonly lineage: PoseReviewLineage;
  readonly revision: number;
  readonly samples: readonly PoseSampleV1[];
  readonly cameras: readonly ReviewCameraV1[];
  readonly shots: readonly ReviewShot[];
  readonly summary: {
    readonly total: number;
    readonly accept: number;
    readonly reject: number;
    readonly redo: number;
    readonly unreviewed: number;
    readonly captured: number;
    /** True only when every shot has evidence AND a verdict other than
     * 'unreviewed'. A partially reviewed strip is a legitimate receipt; it
     * just must not claim to be complete. */
    readonly complete: boolean;
  };
  /** Hash of `canonicalJson` when a hasher was supplied, else null. */
  readonly contentHash: string | null;
}

/**
 * Build the receipt.
 *
 * DETERMINISM. The receipt is a pure function of `session.present` plus the
 * immutable lineage/strip definition. It deliberately contains NO timestamp,
 * no host name, and no path outside the repo: two runs of the same review on
 * two machines must produce byte-identical JSON, or the hash proves nothing.
 * Undo/redo history is excluded for the same reason — the receipt describes
 * the state that was reached, not the route taken to it, so undoing an edit
 * and redoing it returns the original hash.
 *
 * `hash` is injected rather than imported so this module keeps its zero-import
 * property; the capture rig passes node's sha256, tests pass a stub.
 */
export function buildPoseReviewReceipt(
  session: PoseReviewSessionV1,
  options: { hash?: (canonicalJson: string) => string } = {},
): { receipt: PoseReviewReceipt; canonicalJson: string } {
  const shots = session.present.shots;
  const count = (v: ShotVerdict): number => shots.filter((s) => s.verdict === v).length;
  const captured = shots.filter((s) => s.evidence?.file).length;

  const body = {
    version: POSE_REVIEW_SESSION_VERSION,
    sessionId: session.sessionId,
    lineage: session.lineage,
    revision: session.present.revision,
    samples: session.samples,
    cameras: session.cameras,
    shots,
    summary: {
      total: shots.length,
      accept: count('accept'),
      reject: count('reject'),
      redo: count('redo'),
      unreviewed: count('unreviewed'),
      captured,
      complete: shots.length > 0 && captured === shots.length && count('unreviewed') === 0,
    },
  };

  const canonicalJson = `${JSON.stringify(canonicalizeReceiptValue(body), null, 2)}\n`;
  const contentHash = options.hash ? options.hash(canonicalJson) : null;
  return { receipt: { ...body, contentHash } as PoseReviewReceipt, canonicalJson };
}
