/**
 * @file scorer.ts — the four numeric checks of the placement refinement loop.
 *
 * Method source: arXiv 2608.05248 ("WorldClaw"). Phase A judges the object
 * (pose, scale). Phase B judges the ground under it (support, collision).
 * The paper drives both from diagnostic RENDERS read by a vision model. This
 * port replaces the vision model with NUMBERS, because Aralia already holds
 * the geometry and a number does not hallucinate.
 *
 * NO check here reads a pixel. The renders in `gate.ts` are evidence for a
 * human, never the judgement.
 *
 * Units: FEET.
 */
import type { SurfaceProbe } from '../terrain/surfaceProbe';
import {
  footprintSamples,
  hullYAt,
  objectHeightFt,
  type FootprintSample,
  type PlacedObject,
} from './placedObject';
import {
  DEFAULT_HEIGHT_RANGES,
  DEFAULT_THRESHOLDS,
  type PlacementThresholds,
  type SpeciesHeightRange,
} from './thresholds';

/** Which of the four checks failed. Reported verbatim — never collapsed. */
export type PlacementFailure =
  | 'floater'
  | 'sunken'
  | 'scale-too-small'
  | 'scale-too-large'
  | 'scale-unknown-species'
  | 'unsupported';

/** The four metrics, plus the derived verdict. */
export interface PlacementScore {
  id: string;
  /** Check 1. Fraction of footprint samples within the contact tolerance. 0..1. */
  contactRatio: number;
  /** Check 2. Deepest ground intrusion of the lower hull, feet. 0 = no intrusion. */
  penetrationFt: number;
  /** Check 3. Scaled bounding-box height, feet. */
  heightFt: number;
  /** Check 3. Expected range for the species, or null when the key is unknown. */
  expectedHeight: SpeciesHeightRange | null;
  /** Check 4. Variance of ground slope under the footprint, rad^2. */
  supportSlopeVarianceRad2: number;
  /** Mean ground elevation under the footprint, feet. The Phase B pad target. */
  groundMeanYFt: number;
  /** Mean lower-hull elevation over the footprint, feet. */
  hullMeanYFt: number;
  /** Every failed check. Empty = the instance passes. */
  failures: PlacementFailure[];
  /**
   * Signed gap per footprint sample: hull Y minus ground Y, feet. Positive =
   * air under that sample. Negative = that sample is inside the ground. The
   * corrector reads this instead of re-probing.
   */
  gapsFt: number[];
  /** The footprint samples, in the same order as `gapsFt`. */
  samples: FootprintSample[];
}

export interface ScoreOptions {
  thresholds?: PlacementThresholds;
  /** Species key -> expected upright height range. Defaults to DEFAULT_HEIGHT_RANGES. */
  heightRanges?: Readonly<Record<string, SpeciesHeightRange>>;
}

/** True when the score clears every check. */
export function isPass(score: PlacementScore): boolean {
  return score.failures.length === 0;
}

/**
 * Score ONE placed object against the ground the probe reads.
 *
 * Every metric is computed from the same 25 footprint samples, so the checks
 * cannot disagree about where the object is.
 */
export function scorePlacement(
  obj: PlacedObject,
  probe: SurfaceProbe,
  opts: ScoreOptions = {},
): PlacementScore {
  const t = opts.thresholds ?? DEFAULT_THRESHOLDS;
  const ranges = opts.heightRanges ?? DEFAULT_HEIGHT_RANGES;

  const samples = footprintSamples(obj);
  const gapsFt: number[] = [];
  const slopes: number[] = [];
  let touching = 0;
  let deepest = 0;
  let groundSum = 0;
  let hullSum = 0;

  for (const s of samples) {
    const ground = probe.sampleAt(s.xFt, s.zFt);
    const hullY = hullYAt(obj, s);
    const gap = hullY - ground.elevationFt;
    gapsFt.push(gap);
    slopes.push(ground.slopeRad);
    groundSum += ground.elevationFt;
    hullSum += hullY;
    if (Math.abs(gap) <= t.contactToleranceFt) touching += 1;
    if (-gap > deepest) deepest = -gap;
  }
  const n = samples.length || 1;

  const contactRatio = samples.length === 0 ? 0 : touching / samples.length;

  // Population variance. The footprint IS the population, not a draw from one.
  const mean = slopes.reduce((a, b) => a + b, 0) / (slopes.length || 1);
  const supportSlopeVarianceRad2 =
    slopes.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (slopes.length || 1);

  const heightFt = objectHeightFt(obj);
  const expectedHeight = ranges[obj.speciesKey] ?? null;

  const failures: PlacementFailure[] = [];
  if (contactRatio < t.minContactRatio) failures.push('floater');
  if (deepest > t.maxPenetrationFt) failures.push('sunken');
  if (expectedHeight === null) {
    // FAIL HONESTLY: an unknown species is not a passing species. The report
    // names it so the catalog gap gets closed instead of hidden.
    failures.push('scale-unknown-species');
  } else {
    if (heightFt < expectedHeight.minFt * (1 - t.scaleSlack)) failures.push('scale-too-small');
    if (heightFt > expectedHeight.maxFt * (1 + t.scaleSlack)) failures.push('scale-too-large');
  }
  if (supportSlopeVarianceRad2 > t.maxSupportSlopeVarianceRad2) failures.push('unsupported');

  return {
    id: obj.id,
    contactRatio,
    penetrationFt: deepest,
    heightFt,
    expectedHeight,
    supportSlopeVarianceRad2,
    groundMeanYFt: groundSum / n,
    hullMeanYFt: hullSum / n,
    failures,
    gapsFt,
    samples,
  };
}

/** Score a whole placed scene. Order in, order out. */
export function scoreScene(
  objects: readonly PlacedObject[],
  probe: SurfaceProbe,
  opts: ScoreOptions = {},
): PlacementScore[] {
  return objects.map((o) => scorePlacement(o, probe, opts));
}
