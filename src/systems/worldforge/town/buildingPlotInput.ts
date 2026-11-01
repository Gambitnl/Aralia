/**
 * Assemble the one canonical blueprint input shared by rendering, simulation
 * registration, and history compaction. Keeping household and architecture
 * identity here prevents a save replay from rebuilding a subtly different
 * base house than the one the player originally saw.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/11/2026, 07:06:39
 * Dependents: components/Worldforge/townBuildingVisit.ts, devtools/buildingIdentityLab/buildingIdentityLabModel.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { BuildingSourceContext } from '../interior/buildingSource';
import type { TownPlan } from "../artifacts";
import type { BuildingEventHistory } from "../interior/blueprintTypes";
import type { InteriorPlotInput } from "../interior/generateInterior";
import type { SeedPath } from "../seedPath";
import {
  briefForPlot,
  householdPopulationForPlot,
  householdPopulationsForPlan,
  resolvePlotWealth,
} from "./householdBrief";
import type { StyleContext } from "../interior/blueprintTypes";

export interface BuildingPlotInputContext {
  cultureType: string;
  climate: StyleContext["climate"];
  eventLog?: BuildingEventHistory;
  retainedSource?: BuildingSourceContext;
}

/** Build the exact production input for one canonical artifact plot. */
export function buildingPlotInput(
  plan: TownPlan,
  plot: TownPlan["plots"][number],
  townSeed: SeedPath,
  context: BuildingPlotInputContext,
): InteriorPlotInput {
  // Enrich every population record with the same architecture-first wealth
  // decision used by roster staffing. Proprietor lookups can then carry the
  // owner's HOME wealth even when the workplace sits in another district.
  const pops = householdPopulationsForPlan(plan);
  const plotPopulation = householdPopulationForPlot(plot);
  const household = context.retainedSource ? context.retainedSource.source.plan.household : plotPopulation
    ? briefForPlot(plotPopulation, pops, townSeed)
    : undefined;
  const wealth = resolvePlotWealth(plot);
  return {
    id: plot.id,
    footprint: plot.footprint,
    role: plot.role ?? "house",
    storeys: plot.storeys ?? 1,
    ...(plot.ensemble ? { ensemble: { ...plot.ensemble } } : {}),
    ...(plot.pop?.buildingType ? { buildingType: plot.pop.buildingType } : {}),
    ...(household ? { household } : {}),
    // Only the explicit unaccepted farm source selects this recipe. A retained
    // observed foundation remains the complete authority for an established home.
    ...(!context.retainedSource&&plan.ruralSources?.homesteads.sites.some(site=>site.plotId===plot.id)
      ? {householdLayoutRecipe:plan.ruralSources.layoutRecipe} : {}),
    style: {
      cultureType: context.cultureType,
      climate: context.climate,
      wealth,
      ageBand: plot.architecture?.ageBand ?? "new",
      architecture: {
        settlementKey: `burg:${plan.burgId}`,
        districtKey: plot.architecture?.districtKey ?? `wealth:${wealth}`,
        buildingKey: plot.architecture?.buildingKey ?? `plot:${plot.id}`,
      },
    },
    ...(context.eventLog ? { eventLog: context.eventLog } : {}),
    ...(context.retainedSource ? {retainedSource: context.retainedSource} : {}),
  };
}
