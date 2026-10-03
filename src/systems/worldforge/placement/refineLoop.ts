/**
 * @file refineLoop.ts — the bounded driver of the placement refinement loop.
 *
 * Method source: arXiv 2608.05248 ("WorldClaw"). One task queue drives both
 * phases per instance: score, correct, re-score, repeat, stop at a budget.
 *
 * Three rules this driver never breaks:
 *  1. It NEVER loops forever. Every path exits on the budget or on a corrector
 *     that has no legal edit left.
 *  2. It NEVER silently passes an instance it could not fix. Every unfixed
 *     instance appears in `report.failures` with its final score and the
 *     reason the loop stopped.
 *  3. It re-scores EVERY instance against the FINAL surface. Ground patches are
 *     shared, so one object's pad can un-seat its neighbor. A per-instance pass
 *     alone would hide that.
 *
 * Units: FEET.
 */
import type { SurfaceProbe } from '../terrain/surfaceProbe';
import { correctPlacement, type Correction } from './corrector';
import { makeDeformableSurface, type DeformableSurface, type GroundPatch } from './groundPatch';
import type { PlacedObject } from './placedObject';
import { isPass, scorePlacement, type PlacementScore } from './scorer';
import { DEFAULT_THRESHOLDS, type PlacementThresholds, type SpeciesHeightRange } from './thresholds';

/** Why the per-instance loop stopped. Reported verbatim. */
export type StopReason =
  /** Every check passed. */
  | 'passed'
  /** The iteration budget ran out while corrections were still landing. */
  | 'budget-exhausted'
  /** The corrector had no legal edit left (pinned transform, locked ground). */
  | 'no-correction-available'
  /** The instance passed its own loop, then a neighbor's ground pad broke it. */
  | 'broken-by-neighbor';

export interface InstanceOutcome {
  id: string;
  /** The object as the loop left it. Never mutated in place. */
  object: PlacedObject;
  /** Score before the first correction. */
  initialScore: PlacementScore;
  /** Score against the FINAL surface, after every instance was processed. */
  finalScore: PlacementScore;
  iterationsUsed: number;
  stopReason: StopReason;
  corrections: Correction[];
  patches: GroundPatch[];
}

export interface RefineReport {
  budget: number;
  /** One outcome per input object, in input order. */
  outcomes: InstanceOutcome[];
  /** Every outcome whose final score still fails. The honest failure list. */
  failures: InstanceOutcome[];
  passedCount: number;
  totalIterations: number;
  /** Every ground pad the loop laid down. The terrain owner bakes these. */
  patches: readonly GroundPatch[];
  /** The patched surface. Render this to prove the fix. */
  surface: DeformableSurface;
}

export interface RefineOptions {
  thresholds?: PlacementThresholds;
  heightRanges?: Readonly<Record<string, SpeciesHeightRange>>;
  /**
   * Finite-difference step for the patched surface, feet. Defaults to 5 ft,
   * one combat cell, matching `makeFieldSurfaceProbe`.
   */
  finiteDifferenceFt?: number;
  /**
   * Passes over the scene. Default 2.
   *
   * Ground pads are shared, so an instance can pass its own loop and then be
   * lifted off the ground by a neighbor's pad. One extra sweep re-seats those.
   * A third sweep almost never changes anything, because the second sweep's
   * pads are small corrections inside ground that is already flat. The
   * per-instance iteration budget is spent ACROSS sweeps, not per sweep, so
   * more sweeps can never make the loop run longer than the budget allows.
   */
  sweeps?: number;
}

/**
 * Run the refinement loop over a placed scene.
 *
 * Instances are processed in input order, against ONE shared deformable
 * surface, so a later instance sees the pads an earlier one laid. That is the
 * real condition the game renders in, so it is the condition the loop scores.
 */
export function refinePlacements(
  objects: readonly PlacedObject[],
  baseProbe: SurfaceProbe,
  opts: RefineOptions = {},
): RefineReport {
  const t = opts.thresholds ?? DEFAULT_THRESHOLDS;
  const scoreOpts = { thresholds: t, heightRanges: opts.heightRanges };
  const surface = makeDeformableSurface(baseProbe, opts.finiteDifferenceFt);

  interface Working {
    object: PlacedObject;
    initialScore: PlacementScore;
    iterationsUsed: number;
    stopReason: StopReason;
    corrections: Correction[];
    patches: GroundPatch[];
  }

  /** Run the bounded loop on one instance, from wherever it currently stands. */
  const drive = (w: Working): void => {
    let score = scorePlacement(w.object, surface, scoreOpts);
    while (!isPass(score)) {
      if (w.iterationsUsed >= t.iterationBudget) {
        w.stopReason = 'budget-exhausted';
        return;
      }
      const result = correctPlacement(w.object, score, {
        thresholds: t,
        heightRanges: opts.heightRanges,
      });
      w.iterationsUsed += 1;
      w.corrections.push(...result.corrections);
      if (!result.changed) {
        // The corrector is out of legal edits. Stopping here is the honest
        // move: more iterations would repeat the same no-op.
        w.stopReason = 'no-correction-available';
        return;
      }
      w.object = result.object;
      if (result.patch) {
        surface.addPatch(result.patch);
        w.patches.push(result.patch);
      }
      score = scorePlacement(w.object, surface, scoreOpts);
    }
    w.stopReason = 'passed';
  };

  const working: Working[] = objects.map((input) => ({
    object: input,
    initialScore: scorePlacement(input, surface, scoreOpts),
    iterationsUsed: 0,
    stopReason: 'passed' as StopReason,
    corrections: [],
    patches: [],
  }));

  for (const w of working) drive(w);

  // Extra sweeps: only instances a NEIGHBOR broke, and only while they still
  // hold budget. An instance that already exhausted its budget or ran out of
  // legal edits is never retried — that would hide the failure behind a loop.
  const sweeps = Math.max(1, opts.sweeps ?? 2);
  for (let sweep = 1; sweep < sweeps; sweep++) {
    let retried = 0;
    for (const w of working) {
      if (w.stopReason !== 'passed') continue;
      if (isPass(scorePlacement(w.object, surface, scoreOpts))) continue;
      w.stopReason = 'broken-by-neighbor';
      drive(w);
      retried += 1;
    }
    if (retried === 0) break;
  }

  const totalIterations = working.reduce((a, w) => a + w.iterationsUsed, 0);

  // Final pass against the finished surface — the only score that counts.
  const outcomes: InstanceOutcome[] = working.map((w) => {
    const finalScore = scorePlacement(w.object, surface, scoreOpts);
    let stopReason = w.stopReason;
    if (stopReason === 'passed' && !isPass(finalScore)) stopReason = 'broken-by-neighbor';
    return {
      id: w.object.id,
      object: w.object,
      initialScore: w.initialScore,
      finalScore,
      iterationsUsed: w.iterationsUsed,
      stopReason,
      corrections: w.corrections,
      patches: w.patches,
    };
  });

  const failures = outcomes.filter((o) => !isPass(o.finalScore));
  return {
    budget: t.iterationBudget,
    outcomes,
    failures,
    passedCount: outcomes.length - failures.length,
    totalIterations,
    patches: surface.patches(),
    surface,
  };
}

/** One human-readable line per unfixed instance. Nothing is summarized away. */
export function formatFailures(report: RefineReport): string[] {
  return report.failures.map((f) => {
    const s = f.finalScore;
    return (
      `${f.id}: ${s.failures.join(',')} after ${f.iterationsUsed}/${report.budget} iterations ` +
      `[${f.stopReason}] contact=${s.contactRatio.toFixed(2)} pen=${s.penetrationFt.toFixed(2)}ft ` +
      `h=${s.heightFt.toFixed(2)}ft slopeVar=${s.supportSlopeVarianceRad2.toFixed(4)}rad2`
    );
  });
}
