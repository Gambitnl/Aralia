// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 22:28:50
 * Dependents: systems/worldforge/town/buildingEnsembles.ts, systems/worldforge/town/townPlanAdapter.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file detachedParcels.ts - shared vocabulary for detached building parcels.
 *
 * Ensemble resolution chooses the profile; the artifact adapter applies these
 * exact fractions. Keeping both decisions here prevents a receipt from
 * claiming one setback while production geometry silently uses another.
 */
import type {
  BuildingLotProfile,
  DetachedParcelProfile,
} from '../interior/blueprintTypes';
import { fnv1a } from '../seedPath';

export interface DetachedParcelInsets {
  left: number;
  right: number;
  front: number;
  rear: number;
}

/** Bounded parcel grammars leave visible private ground without erasing cottages. */
const PROFILE_INSETS: Record<DetachedParcelProfile, DetachedParcelInsets> = {
  'lane-setback': { left: 0.08, right: 0.08, front: 0.08, rear: 0.12 },
  'garden-setback': { left: 0.06, right: 0.06, front: 0.20, rear: 0.05 },
  'left-side-yard': { left: 0.18, right: 0.03, front: 0.10, rear: 0.08 },
  'right-side-yard': { left: 0.03, right: 0.18, front: 0.10, rear: 0.08 },
};

export function detachedParcelInsets(
  profile: DetachedParcelProfile,
): DetachedParcelInsets {
  return PROFILE_INSETS[profile];
}

/**
 * Give a district one dominant frontage convention with occasional handed
 * side yards. Lots remain distinct without turning one neighborhood into a
 * random sample of every available placement rule.
 */
export function detachedParcelProfile(
  districtKey: string,
  lotKey: string,
): DetachedParcelProfile {
  const dominant = fnv1a(`${districtKey}|detached-parcel-family`) % 2 === 0
    ? 'lane-setback' as const
    : 'garden-setback' as const;
  const choice = fnv1a(`${lotKey}|detached-parcel-placement`) % 4;
  if (choice < 3) return dominant;
  return fnv1a(`${lotKey}|detached-side-yard`) % 2 === 0
    ? 'left-side-yard'
    : 'right-side-yard';
}

/** Retained building-envelope dimensions after applying a parcel profile. */
export function detachedEnvelopeSize(
  width: number,
  depth: number,
  profile: DetachedParcelProfile,
): { width: number; depth: number } {
  const inset = detachedParcelInsets(profile);
  return {
    width: width * (1 - inset.left - inset.right),
    depth: depth * (1 - inset.front - inset.rear),
  };
}

/**
 * Larger detached envelopes can author a connected compound directly on the
 * 5 ft blueprint grid. Smaller homes retain the legacy generator rather than
 * losing their character to a forced two-cell approximation.
 */
export function detachedCompoundProfile(
  width: number,
  depth: number,
  parcelProfile: DetachedParcelProfile,
  lotKey: string,
): BuildingLotProfile | undefined {
  const retained = detachedEnvelopeSize(width, depth, parcelProfile);
  if (retained.width < 15 - 1e-6 || retained.depth < 15 - 1e-6) return undefined;
  const profiles: BuildingLotProfile[] = [
    'full-envelope',
    'left-return',
    'right-return',
    'rear-court',
  ];
  return profiles[fnv1a(`${lotKey}|detached-compound`) % profiles.length];
}
