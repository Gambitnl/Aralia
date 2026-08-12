/**
 * @file index.ts — public surface of the placement refinement loop.
 *
 * Method source: arXiv 2608.05248 ("WorldClaw", Tencent Hunyuan). The METHOD
 * only — the paper ships no code and carries no license, and nothing here is
 * derived from any of its artifacts.
 *
 * What it does: score a placed scene numerically, correct the failures, re-
 * score, and stop at a budget. Four checks, all numeric, none visual:
 *   1. contact ratio  2. penetration depth  3. scale sanity  4. support quality
 *
 * Units: FEET everywhere. Worldforge is feet-canon.
 */
export {
  FOOTPRINT_GRID,
  footprintRadiusFt,
  footprintSamples,
  hullYAt,
  objectHeightFt,
  type FootprintSample,
  type LocalBoundsFt,
  type PlacedObject,
} from './placedObject';

export {
  BATTLEMAP_THRESHOLDS,
  DEFAULT_HEIGHT_RANGES,
  DEFAULT_THRESHOLDS,
  REGION_THRESHOLDS,
  TOWN_THRESHOLDS,
  type PlacementThresholds,
  type SpeciesHeightRange,
} from './thresholds';

export {
  isPass,
  scorePlacement,
  scoreScene,
  type PlacementFailure,
  type PlacementScore,
  type ScoreOptions,
} from './scorer';

export {
  makeDeformableSurface,
  patchWeight,
  type DeformableSurface,
  type GroundPatch,
} from './groundPatch';

export {
  bestVerticalShiftFt,
  correctPlacement,
  type Correction,
  type CorrectionResult,
} from './corrector';

export {
  formatFailures,
  refinePlacements,
  type InstanceOutcome,
  type RefineOptions,
  type RefineReport,
  type StopReason,
} from './refineLoop';

export {
  SURFACE_THRESHOLDS,
  fromMeterInstances,
  propSpeciesKey,
  runPlacementGate,
  type GateOptions,
  type GateResult,
  type MeterInstance,
  type PlacementSurface,
} from './gate';
