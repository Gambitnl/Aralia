/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 11/07/2026, 14:00:33
 * Dependents: systems/worldforge/town/townEngine.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file architectureDistricts.ts
 *
 * Assigns stable, spatially coherent architecture districts to generated town
 * wards. Culture still owns the settlement-wide building vocabulary and wealth
 * still controls finish quality; this module only answers which neighboring
 * wards should repeat one stronger roof/facade dialect.
 *
 * Districts are angular sectors around the built core. That keeps membership
 * contiguous and affine-frame invariant, while one seed-derived rotation stops
 * every town from placing its district boundaries on the same compass axes.
 * The output is pure identity data: it never changes ward or plot geometry.
 */
import { type SeedPath } from '../seedPath';
import type { Pt } from '../submap/submapEngine';
import type { CivicKind } from './townEngine';
/** Durable architecture identity shared by every ward in one spatial sector. */
export interface TownArchitectureDistrict {
    /** Stable sector index inside this town; useful for debugging and ordering. */
    index: number;
    /** Persistence-facing key consumed by the architecture style resolver. */
    key: string;
    /** Human-readable map-inspector label; never used as identity. */
    label: string;
}
/**
 * Scale district count with settlement complexity, not population directly.
 *
 * Tiny settlements remain one architectural neighborhood. Cities gain enough
 * districts to read as distinct quarters, capped at eight so the town-wide
 * culture remains the dominant visual signal instead of fragmenting endlessly.
 */
export declare function architectureDistrictCount(wardCount: number): number;
/**
 * Assign one architecture district to every ward centroid.
 *
 * The same seed and relative centroid arrangement always return the same keys.
 * Uniform scale and translation leave every assignment unchanged, which lets
 * the normalized 2D town and feet-space 3D town share district identity.
 */
export declare function assignArchitectureDistricts(wardCentroids: readonly Pt[], townCenter: Pt, wardCivics: readonly (CivicKind | undefined)[], seedPath: SeedPath): TownArchitectureDistrict[];
