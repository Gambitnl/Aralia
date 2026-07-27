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
/**
 * @file detachedParcels.ts - shared vocabulary for detached building parcels.
 *
 * Ensemble resolution chooses the profile; the artifact adapter applies these
 * exact fractions. Keeping both decisions here prevents a receipt from
 * claiming one setback while production geometry silently uses another.
 */
import type { BuildingLotProfile, DetachedParcelProfile } from '../interior/blueprintTypes';
export interface DetachedParcelInsets {
    left: number;
    right: number;
    front: number;
    rear: number;
}
export declare function detachedParcelInsets(profile: DetachedParcelProfile): DetachedParcelInsets;
/**
 * Give a district one dominant frontage convention with occasional handed
 * side yards. Lots remain distinct without turning one neighborhood into a
 * random sample of every available placement rule.
 */
export declare function detachedParcelProfile(districtKey: string, lotKey: string): DetachedParcelProfile;
/** Retained building-envelope dimensions after applying a parcel profile. */
export declare function detachedEnvelopeSize(width: number, depth: number, profile: DetachedParcelProfile): {
    width: number;
    depth: number;
};
/**
 * Larger detached envelopes can author a connected compound directly on the
 * 5 ft blueprint grid. Smaller homes retain the legacy generator rather than
 * losing their character to a forced two-cell approximation.
 */
export declare function detachedCompoundProfile(width: number, depth: number, parcelProfile: DetachedParcelProfile, lotKey: string): BuildingLotProfile | undefined;
