/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 13:05:25
 * Dependents: systems/worldforge/interior/generateBuilding.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file resolves a generated building's permanent, visible backstory.
 *
 * The town decides the broad construction age. After the footprint, walls, and
 * roof exist, the building generator calls this resolver to assign later-built
 * masses and a bounded set of repairs or damage to real blueprint targets.
 * Every choice uses a named hash, so adding a future history feature cannot
 * shift existing choices. The result is stored on BlueprintPlan and shared by
 * every renderer.
 *
 * Called by: generateBuilding.ts
 * Depends on: blueprint geometry, approved style palettes, and frozen seed hashes
 */
import type { FootprintMass } from './footprint';
import type { BlueprintFloor, BuildingAgeBand, BuildingBackstory, BuildingType, RoofPlan, StyleResolved } from './blueprintTypes';
import { type SeedPath } from '../seedPath';
export interface ResolveBuildingBackstoryInput {
    ageBand: BuildingAgeBand;
    buildingType: BuildingType;
    masses: readonly FootprintMass[];
    floors: readonly BlueprintFloor[];
    roof?: RoofPlan;
    style: Pick<StyleResolved, 'wallColor' | 'roofColor' | 'trimColor' | 'districtSignature' | 'buildingVariant'>;
    allowedWallColors: readonly string[];
    allowedRoofColors: readonly string[];
}
export declare function resolveBuildingBackstory(input: ResolveBuildingBackstoryInput, path: SeedPath): BuildingBackstory;
