/**
 * Builds the player-facing contents of a real town building from the same
 * blueprint, named household, and saved history used by the 3D world.
 * No preview presets or replacement families are generated here.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 01/11/2026, 01:32:13
 * Dependents: components/MapPane.tsx, components/World3D/GuestBedRestAction.tsx, components/World3D/World3DWrapper.tsx, components/World3D/groundResidentInteraction.ts, components/World3D/hooks/useWorld3DDiscovery.ts, components/World3D/libraryReadingAccess.ts, components/World3D/publicBuildingDiscovery.ts, components/World3D/publicSeatRest.tsx, components/World3D/templeDedication.tsx, components/World3D/workbenchAccess.ts, components/Worldforge/TownBuildingInspector.tsx, hooks/actions/handleLodging.ts, hooks/actions/handleResourceActions.ts, systems/economy/businessAttendance.ts, systems/gameplay/lodging.ts, systems/worldforge/interior/libraryCollection.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { getBridgeAtlas, getBurgCultureType } from '../../systems/worldforge/bridge/legacySubmapBridge';
import { canonicalTownSeedPath, canonicalArtifactTownForSiteFromAtlas } from '../../systems/worldforge/town/canonicalTown';
import { climateForBiomeId } from '../../systems/worldforge/town/architectureStyle';
import { buildingPlotInput } from '../../systems/worldforge/town/buildingPlotInput';
import { readObservedBuildingSource, type ObservedBuildingSource } from '../../systems/worldforge/interior/buildingSource';
import { blueprintForPlot } from '../../systems/worldforge/interior/generateInterior';
import { householdForPlot, householdPopulationForPlot, householdPopulationsForPlan } from '../../systems/worldforge/town/householdBrief';
import { containerManifests } from '../../systems/worldforge/interior/manifests';
import { computeOccupancy } from '../../systems/worldforge/interior/occupancy';
import { publicHouseWorkRoleForOwner } from '../../systems/worldforge/roster/workHours';
import type { BuildingEventHistory } from '../../systems/worldforge/interior/blueprintTypes';
import { childSeedPath } from '../../systems/worldforge/seedPath';
import type { TownLayoutRevision } from '../../systems/worldforge/town/townLayoutRevision';

function townBuildingContext(worldSeed: number, burgId: number, layoutRevision?: TownLayoutRevision) {
  const atlas = getBridgeAtlas(worldSeed);
  const burg = atlas.pack.burgs?.[burgId];
  if (!burg || burg.removed || burg.cell == null) throw new Error('This settlement is unavailable.');
  const cultureType = getBurgCultureType(worldSeed, burgId);
  const biomeId = atlas.pack.cells.biome?.[burg.cell];
  if (biomeId === undefined) throw new Error('The settlement climate is unavailable.');
  // The production bridge owns scale, climate and plot identity. Center its
  // placement at zero: translation does not change room dimensions or identity.
  const artifact = canonicalArtifactTownForSiteFromAtlas(atlas, worldSeed, {
    burgId, envelope: { x: 0, y: 0, width: 0, height: 0 }, gates: [],
  }, layoutRevision).plan;
  return { atlas, burg, cultureType, artifact, biomeId };
}

/** Known saved revisions keep visits and map choices on the generated town.
 * Missing historical revisions retain the prior default until source admission;
 * passing a revision does not authorize migration or replace observed interiors. */

/** Stable building choices for the local map's keyboard-accessible selector. */
export function townBuildingChoices(worldSeed: number, burgId: number, layoutRevision?: TownLayoutRevision) {
  // Fitted use helps travelers find rooms even when a trade name describes
  // another service. Keep the canonical plot, household and blueprint intact.
  return townBuildingContext(worldSeed, burgId, layoutRevision).artifact.plots.map((plot) => ({
    id: plot.id, role: plot.role,
    ...(plot.pop?.buildingType ? {buildingType: plot.pop.buildingType} : {}),
  }));
}

export function townBuildingVisit(worldSeed: number, burgId: number, plotId: number, eventLog?: BuildingEventHistory, source?: ObservedBuildingSource, layoutRevision?: TownLayoutRevision) {
  const { burg, cultureType, artifact, biomeId } = townBuildingContext(worldSeed, burgId, layoutRevision);
  const plot = artifact.plots.find((candidate) => candidate.id === plotId);
  if (!plot) throw new Error('This building is unavailable.');
  const seed = canonicalTownSeedPath(worldSeed, burgId);
  const input = buildingPlotInput(artifact, plot, seed, {
    cultureType,
    climate: climateForBiomeId(biomeId),
    eventLog,
  });
  const retained = source ? readObservedBuildingSource({worldSeed, burgId, source}, plotId, eventLog, seed) : undefined;
  const plan = retained?.plan ?? blueprintForPlot(input, seed);
  const population = householdPopulationForPlot(plot);
  const home = retained ? (retained.household ? {household: retained.household,
    worksAtHome: retained.plan.household?.worksAtHome ?? false} : undefined)
    : population ? householdForPlot(population, householdPopulationsForPlan(artifact), seed) : undefined;
  // Keep the proprietor family for identity and owned goods, while matching the
  // live bridge's distinction between a separate business and the real home.
  const workplaceOnly = retained?.workplaceOnly ?? Boolean(population && !population.residential);
  // Player-facing services must use the same recorded owner and evening shift
  // as the rendered counter. A public room alone cannot invent a night keeper.
  const workplace = population?.residential
    ? artifact.plots.find(candidate => candidate.pop?.homeId === population.workplaceId)?.pop : population;
  const occupancy = home ? computeOccupancy(plan, home.household, {
    worksAtHome: home.worksAtHome, workplaceOnly,
    publicHouseWorkRole: publicHouseWorkRoleForOwner(workplace, home.household.homeId),
  }) : undefined;
  return {
    townName: burg.name,
    plot,
    plan,
    household: home?.household,
    workplaceOnly,
    occupancy,
    // Each building owns its goods stream; two chests in different houses must
    // not share contents merely because their furnishing indexes match.
    manifests: retained ? retained.manifests : input.household ? containerManifests(plan, input.household, childSeedPath(seed, `interior:${plot.id}`)) : [],
    isBusiness: plot.role === 'market' || plot.role === 'workshop',
  };
}

export type TownBuildingVisit = ReturnType<typeof townBuildingVisit>;
