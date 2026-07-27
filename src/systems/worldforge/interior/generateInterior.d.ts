/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 19:07:35
 * Dependents: components/Worldforge/TownPlanView.tsx, devtools/buildingIdentityLab/buildingIdentityLabModel.ts, systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/interiorParts.ts, systems/worldforge/roster/generateTownRoster.ts, systems/worldforge/town/buildingPlotInput.ts, systems/worldforge/town/townPlanAdapter.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file adapts a town plot into its canonical building blueprint.
 *
 * The procedural building generator owns all room shapes, walls, windows,
 * floors, stairs, and basements. This module supplies the town-facing input
 * contract, converts coarse plot roles into building types, chooses the
 * deterministic basement flag, and calls that one generator. Renderers,
 * occupancy, and roster sizing consume the resulting BlueprintPlan directly,
 * so no second lossy floor-plan contract can drift from it.
 *
 * The filename remains the established import boundary for town-plot callers;
 * only the retired generateInterior-to-InteriorPlan compatibility adapter is
 * gone. Keeping this stable module path avoids a repo-wide import rename while
 * making blueprintForPlot the single data contract.
 */
import { type SeedPath } from '../seedPath';
import type { Feet } from '../units';
import type { BuildingBackstory, BuildingEvent, BuildingEventHistory, BuildingEnsemble, BlueprintPlan, BuildingType, HouseholdBrief, StyleContext } from './blueprintTypes';
export interface InteriorPlotInput {
    id: number;
    /** Closed quad, [x, y] feet, corners 0-1 = street frontage (TownPlan contract). */
    footprint: Array<[Feet, Feet]>;
    role: string;
    storeys: number;
    /** Town-authored block instruction; absent for legacy and isolated plots. */
    ensemble?: BuildingEnsemble;
    /** Town population classification; when present it wins over the role mapping. */
    buildingType?: BuildingType;
    /** Founding household brief, present only after the population pass ran. */
    household?: HouseholdBrief;
    /** Regional architectural context; absent plots keep their style-less output. */
    style?: StyleContext;
    /** Optional replay/save override for the building's permanent history. */
    backstory?: BuildingBackstory;
    /** Optional legacy event array or compacted journal for this canonical plot. */
    eventLog?: BuildingEventHistory | readonly BuildingEvent[];
}
/** Resolve a plot role to a BuildingType; throws on an unmapped role. */
export declare function buildingTypeForRole(role: string): BuildingType;
/**
 * Basement odds by building type. Manors and taverns nearly always dig
 * cellars, shops and workshops usually need stock space, and cottages only
 * sometimes have a root cellar.
 */
export declare const BASEMENT_CHANCE: Record<BuildingType, number>;
/**
 * Make one isolated basement draw for this building. A named random stream
 * ensures later generation changes cannot silently flip the basement choice.
 */
export declare function rollBasement(type: BuildingType, interiorPath: SeedPath): boolean;
/** Generate the full, memoized BlueprintPlan for one town plot. */
export declare function blueprintForPlot(plot: InteriorPlotInput, seedPath: SeedPath): BlueprintPlan;
