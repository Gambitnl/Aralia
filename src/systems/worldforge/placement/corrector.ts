/**
 * @file corrector.ts — the correction half of the placement refinement loop.
 *
 * Method source: arXiv 2608.05248 ("WorldClaw"). Phase A corrects the OBJECT
 * (pose, then scale). Phase B corrects the GROUND under it. Phase A runs
 * first, always, because a transform edit costs one number and touches nothing
 * else, while a ground edit rewrites terrain a neighbor may also stand on.
 *
 * The corrector proposes. It never decides that an instance is finished — the
 * scorer does. It never hides a failure it cannot fix: `changed: false` tells
 * the driver to stop and report.
 *
 * Units: FEET.
 */
import { footprintRadiusFt, type PlacedObject } from './placedObject';
import type { GroundPatch } from './groundPatch';
import type { PlacementScore } from './scorer';
import {
  DEFAULT_HEIGHT_RANGES,
  DEFAULT_THRESHOLDS,
  type PlacementThresholds,
  type SpeciesHeightRange,
} from './thresholds';

/** One recorded edit. The report replays these, so they name what moved. */
export interface Correction {
  phase: 'A-transform' | 'A-scale' | 'B-ground';
  note: string;
}

export interface CorrectionResult {
  /** The object after Phase A. Same reference when nothing moved. */
  object: PlacedObject;
  /** The Phase B pad to add to the shared surface, or null. */
  patch: GroundPatch | null;
  corrections: Correction[];
  /**
   * false = the corrector had no legal edit left. The driver must stop and
   * report the instance as unfixed. It must NOT keep burning iterations on a
   * no-op, and it must NOT pass the instance.
   */
  changed: boolean;
}

export interface CorrectOptions {
  thresholds?: PlacementThresholds;
  heightRanges?: Readonly<Record<string, SpeciesHeightRange>>;
}

/**
 * Feather width as a multiple of the footprint radius.
 *
 * 1.5 — a feather narrower than the core leaves a raised disc with a visible
 * rim; wider than 2x moves ground the object never touches and eats into a
 * neighbor's pad.
 */
const FEATHER_RATIO = 1.5;

/**
 * Best vertical shift for the object origin, feet.
 *
 * Candidates come from the footprint gaps themselves: the shift that puts
 * sample i exactly on the ground, and the two shifts that put it on either
 * edge of the contact tolerance. The optimum contact count always sits at one
 * of these, because contact is a union of intervals whose endpoints are those
 * three values.
 *
 * Ranking, in order: a legal penetration beats an illegal one; then the higher
 * contact ratio; then the SMALLEST mean absolute gap; then the smallest move.
 * Mean absolute gap sits above move size on purpose — without it the search
 * parks the object at the far edge of the tolerance band, which passes the
 * check and still shows a hairline of light under one edge.
 */
export function bestVerticalShiftFt(
  gapsFt: readonly number[],
  t: PlacementThresholds,
): { dyFt: number; contactRatio: number; penetrationFt: number; meanAbsGapFt: number } {
  const candidates: number[] = [];
  for (const g of gapsFt) {
    candidates.push(-g, -g + t.contactToleranceFt, -g - t.contactToleranceFt);
  }
  let best = { dyFt: 0, contactRatio: -1, penetrationFt: Infinity, meanAbsGapFt: Infinity };
  for (const dy of candidates) {
    let touching = 0;
    let deepest = 0;
    let absSum = 0;
    for (const g of gapsFt) {
      const gap = g + dy;
      if (Math.abs(gap) <= t.contactToleranceFt) touching += 1;
      if (-gap > deepest) deepest = -gap;
      absSum += Math.abs(gap);
    }
    const n = gapsFt.length || 1;
    const ratio = gapsFt.length === 0 ? 0 : touching / n;
    const meanAbs = absSum / n;
    // A shift that sinks the object past the penetration bar is not a fix,
    // whatever it does for contact. Rank it below every legal shift.
    const legal = deepest <= t.maxPenetrationFt;
    const bestLegal = best.penetrationFt <= t.maxPenetrationFt;
    const better =
      legal !== bestLegal
        ? legal
        : ratio !== best.contactRatio
          ? ratio > best.contactRatio
          : meanAbs !== best.meanAbsGapFt
            ? meanAbs < best.meanAbsGapFt
            : Math.abs(dy) < Math.abs(best.dyFt);
    if (better) {
      best = { dyFt: dy, contactRatio: ratio, penetrationFt: deepest, meanAbsGapFt: meanAbs };
    }
  }
  return best;
}

/**
 * Propose one correction for one failing instance.
 *
 * Call only when `isPass(score)` is false. Returns the object to score next
 * and, when Phase A could not do the job, the ground pad to lay down.
 */
export function correctPlacement(
  obj: PlacedObject,
  score: PlacementScore,
  opts: CorrectOptions = {},
): CorrectionResult {
  const t = opts.thresholds ?? DEFAULT_THRESHOLDS;
  const ranges = opts.heightRanges ?? DEFAULT_HEIGHT_RANGES;
  const corrections: Correction[] = [];
  let next = obj;
  let changed = false;

  // ── Phase A, step 1: scale ────────────────────────────────────────────────
  // Scale first, because it moves the footprint and the base plane, which
  // would invalidate a vertical shift computed before it.
  const scaleWrong =
    score.failures.includes('scale-too-small') || score.failures.includes('scale-too-large');
  if (scaleWrong && obj.scaleMutable !== false) {
    const range = ranges[obj.speciesKey];
    const unitHeight = obj.localBounds.maxY - obj.localBounds.minY;
    if (range && unitHeight > 0) {
      // Pull to the nearest edge of the accepted band, not to its midpoint:
      // the authored scale carries intent and the smallest legal edit keeps it.
      const target =
        score.heightFt < range.minFt ? range.minFt : range.maxFt;
      const newScale = target / unitHeight;
      if (Math.abs(newScale - obj.scale) > 1e-6) {
        next = { ...next, scale: newScale };
        corrections.push({
          phase: 'A-scale',
          note: `scale ${obj.scale.toFixed(3)} -> ${newScale.toFixed(3)} (height ${score.heightFt.toFixed(2)} ft -> ${target.toFixed(2)} ft)`,
        });
        changed = true;
      }
    }
  }

  // ── Phase A, step 2: pose ─────────────────────────────────────────────────
  const poseWrong = score.failures.includes('floater') || score.failures.includes('sunken');
  if (poseWrong && obj.transformMutable !== false) {
    // A scale edit invalidated the gaps, so re-scoring happens next iteration
    // and the shift waits. One edit per iteration keeps cause and effect clear.
    if (!changed) {
      const shift = bestVerticalShiftFt(score.gapsFt, t);
      if (Math.abs(shift.dyFt) > 1e-4) {
        next = {
          ...next,
          positionFt: { ...next.positionFt, y: next.positionFt.y + shift.dyFt },
        };
        corrections.push({
          phase: 'A-transform',
          note: `y ${shift.dyFt >= 0 ? '+' : ''}${shift.dyFt.toFixed(3)} ft (contact ${score.contactRatio.toFixed(2)} -> ${shift.contactRatio.toFixed(2)})`,
        });
        changed = true;
      }
    }
  }

  if (changed) return { object: next, patch: null, corrections, changed: true };

  // ── Phase B: co-deform the ground ─────────────────────────────────────────
  // Reached only when Phase A had nothing legal left: the transform is pinned,
  // or the best shift is the one already in place and the ground itself is the
  // problem (a corner lift, a step, a slope the base cannot span).
  const groundWrong =
    score.failures.includes('floater') ||
    score.failures.includes('sunken') ||
    score.failures.includes('unsupported');
  if (groundWrong && obj.groundMutable !== false) {
    const radius = footprintRadiusFt(obj);
    // The pad drives the ground to the object's own base plane. The mean hull
    // Y is the plane a flat base sits on; for a domed base it is the plane
    // that splits the contact evenly.
    const meanHullY = score.hullMeanYFt;
    const patch: GroundPatch = {
      ownerId: obj.id,
      centerXFt: obj.positionFt.x,
      centerZFt: obj.positionFt.z,
      coreRadiusFt: radius,
      featherFt: radius * FEATHER_RATIO,
      deltaFt: 0,
      flatten: 1,
      planeYFt: meanHullY,
      maxChangeFt: t.maxGroundLiftPerIterationFt,
    };
    corrections.push({
      phase: 'B-ground',
      note: `pad r=${radius.toFixed(2)} ft to y=${meanHullY.toFixed(2)} ft, capped at ${t.maxGroundLiftPerIterationFt} ft this pass`,
    });
    return { object: next, patch, corrections, changed: true };
  }

  // Nothing legal left. FAIL HONESTLY.
  return { object: next, patch: null, corrections, changed: false };
}
