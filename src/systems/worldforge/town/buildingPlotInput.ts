// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 20:03:34
 * Dependents: systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/townSimRegistration.ts
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Assemble the one canonical blueprint input shared by rendering, simulation
 * registration, and history compaction. Keeping household and architecture
 * identity here prevents a save replay from rebuilding a subtly different
 * base house than the one the player originally saw.
 */
import type { TownPlan } from '../artifacts';
import type { BuildingEventHistory } from '../interior/blueprintTypes';
import type { InteriorPlotInput } from '../interior/generateInterior';
import type { SeedPath } from '../seedPath';
import { briefForPlot } from './householdBrief';
import type { StyleContext } from '../interior/blueprintTypes';
import type { TownPlotPopulation } from './townEngine';

export interface BuildingPlotInputContext {
  cultureType: string;
  climate: StyleContext['climate'];
  eventLog?: BuildingEventHistory;
}

/** Build the exact production input for one canonical artifact plot. */
export function buildingPlotInput(
  plan: TownPlan,
  plot: TownPlan['plots'][number],
  townSeed: SeedPath,
  context: BuildingPlotInputContext,
): InteriorPlotInput {
  const pops = plan.plots
    .map((candidate) => candidate.pop)
    .filter((pop): pop is TownPlotPopulation => pop !== undefined);
  const household = plot.pop ? briefForPlot(plot.pop, pops, townSeed) : undefined;
  return {
    id: plot.id,
    footprint: plot.footprint,
    role: plot.role ?? 'house',
    storeys: plot.storeys ?? 1,
    ...(plot.ensemble ? { ensemble: { ...plot.ensemble } } : {}),
    ...(plot.pop?.buildingType ? { buildingType: plot.pop.buildingType } : {}),
    ...(household ? { household } : {}),
    style: {
      cultureType: context.cultureType,
      climate: context.climate,
      wealth: plot.architecture?.wealth ?? plot.pop?.district ?? 'common',
      ageBand: plot.architecture?.ageBand ?? 'new',
      architecture: {
        settlementKey: `burg:${plan.burgId}`,
        districtKey: plot.architecture?.districtKey
          ?? `wealth:${plot.pop?.district ?? 'common'}`,
        buildingKey: plot.architecture?.buildingKey ?? `plot:${plot.id}`,
      },
    },
    ...(context.eventLog ? { eventLog: context.eventLog } : {}),
  };
}
