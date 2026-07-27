/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 13:05:12
 * Dependents: components/DesignPreview/steps/PreviewTowns.tsx, components/Worldforge/TownPlanView.tsx, systems/worldforge/town/townPlanAdapter.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file assigns a permanent construction age to a town building.
 *
 * Town plans call it with a plot, the built core, and durable settlement and
 * building keys. Distance from the center creates readable growth rings, while
 * a small named-hash variation prevents every ring boundary from looking
 * mechanically perfect. The calculation is scale and translation invariant,
 * so normalized 2D towns and transformed 3D towns receive the same age.
 *
 * Called by: townPlanAdapter.ts and TownPlanView.tsx
 * Depends on: the frozen Worldforge hash and the shared blueprint age type
 */
import type { BuildingAgeBand } from '../interior/blueprintTypes';
import type { Pt } from '../submap/submapEngine';
export interface ResolveBuildingAgeInput {
    polygon: readonly Pt[];
    townCore: readonly Pt[];
    settlementKey: string;
    buildingKey: string;
}
/** Older bands have larger ranks, which is useful for audits and summaries. */
export declare const BUILDING_AGE_RANK: Readonly<Record<BuildingAgeBand, number>>;
export declare function resolveBuildingAgeBand(input: ResolveBuildingAgeInput): BuildingAgeBand;
