/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 19:30:16
 * Dependents: components/Worldforge/TownPlanView.tsx, systems/worldforge/town/architectureStyle.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file resolves the visible patina carried by one generated building.
 *
 * Climate and architectural family choose a district-wide exposure recipe,
 * construction age controls how strongly it appears, and the building key
 * chooses bounded coverage and placement variation. The result is data only:
 * architectureStyle stores it on the blueprint and render bridges decide how
 * to draw it without changing rooms, walls, roofs, or permanent history.
 *
 * Called by: architectureStyle.ts and TownPlanView.tsx
 * Depends on: the shared blueprint weathering contract and stable seed hashes
 */
import type { ArchitectureIdentity, BuildingAgeBand, BuildingConstruction, BuildingWeathering } from '../interior/blueprintTypes';
import type { ClimateClass } from './architectureStyle';
import type { ArchitectureFamilyId } from './buildingMaterials';
export interface ResolveBuildingWeatheringInput {
    familyId: ArchitectureFamilyId;
    climate: ClimateClass;
    ageBand?: BuildingAgeBand;
    construction: BuildingConstruction;
    architecture?: ArchitectureIdentity;
    standaloneKey: string;
}
/** Resolve district-coherent weathering with bounded lot-level variation. */
export declare function resolveBuildingWeathering(input: ResolveBuildingWeatheringInput): BuildingWeathering;
