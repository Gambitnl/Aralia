/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 22:16:04
 * Dependents: components/Worldforge/TownPlanView.tsx, systems/worldforge/town/townEngine.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file courtyardSpaces.ts - resolves the open space shared by interior-block
 * buildings after all collision filtering has finished.
 *
 * The town engine owns building geometry; this module owns the durable receipt
 * for the space that geometry encloses. Keeping the receipt separate lets the
 * 2D map, artifact adapter, 3D prop layer, and tactical extraction consume the
 * same court and amenity instead of independently guessing from plot centers.
 */
import { type SeedPath } from '../seedPath';
import { type Pt } from '../submap/submapEngine';
import type { TownArchitectureDistrict } from './architectureDistricts';
import type { WardWealth } from './population';
/** A district-appropriate use for the open center of a residential block. */
export type CourtyardAmenity = 'well' | 'wash-yard' | 'work-yard' | 'garden';
/** Shared open space enclosed by a ward's court-facing interior buildings. */
export interface TownCourtyardSpace {
    /** Stable identity inside one generated town. */
    id: string;
    /** Owning ward and ensemble block identities. */
    wardIndex: number;
    blockKey: string;
    /** Center and usable radius in the town plan's current coordinate frame. */
    center: Pt;
    radius: number;
    /** District identity survives even when no style family has been resolved. */
    districtKey: string;
    wealth: WardWealth;
    amenity: CourtyardAmenity;
    /** Compact deterministic evidence used by inspectors and regression tests. */
    courtyardSignature: string;
}
/** Minimal structural input keeps this resolver independent of townEngine.ts. */
export interface CourtyardWardInput {
    block: Pt[];
    plots: Array<{
        kind?: 'frontage' | 'interior';
        courtyardIndex?: number;
        polygon: Pt[];
        ensemble?: {
            blockKey: string;
        };
    }>;
    wealth?: WardWealth;
    architectureDistrict?: TownArchitectureDistrict;
}
/**
 * Derive the same bounded court centers for packing and receipt resolution.
 * Multiple centers follow the block's long axis; offsets collapse toward the
 * center when an irregular convex-ish block would otherwise place one outside.
 */
export declare function courtyardCentersForBlock(block: Pt[], count: number): Pt[];
/**
 * Resolve one real shared court per surviving interior cluster. A single shed
 * is not called a courtyard, and a center swallowed by collision/filtering is
 * deliberately omitted.
 */
export declare function resolveCourtyardSpaces(wards: CourtyardWardInput[], seedPath: SeedPath): TownCourtyardSpace[];
