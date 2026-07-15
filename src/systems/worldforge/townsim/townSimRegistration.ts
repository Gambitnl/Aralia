// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 18:51:44
 * Dependents: state/reducers/worldReducer.ts
 * Imports: 18 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file townSimRegistration.ts — Plan D: build a living-world sim state for a
 * REAL burg (not a demo town), so visiting a town registers it into the sim.
 *
 * Uses the SAME canonical town pipeline the 3D world renders from
 * (getCanonicalTownPlan → toArtifactPlan → generateTownRoster with the burg's
 * culture namer), so the chronicle is about this burg's real people. Then tags
 * key NPCs (Plan B), records lot-safe future growth options from each exact
 * production blueprint, and seeds the life-event sim at the current game day.
 * Registration is where town geometry and persisted simulation state coexist,
 * so future additions are fixed here rather than rerolled years later.
 *
 * Per the no-fallback directive, this does not swallow errors: it is only called
 * for real town tiles, where the canonical town generation already succeeds
 * (it's what renders the 3D town the player is entering).
 */
import { SeededRandom } from '../../../utils/random/seededRandom';
import { getBridgeAtlas, getBurgNamer, getBurgCultureType } from '../bridge/legacySubmapBridge';
import { getCanonicalTownPlan, canonicalTownSeedPath } from '../town/canonicalTown';
import { toArtifactPlan } from '../town/townPlanAdapter';
import { generateTownRoster } from '../roster/generateTownRoster';
import { assignFamilies } from '../roster/family';
import { makeSeedPath, seedFromPath } from '../seedPath';
import { DAYS_PER_YEAR } from './constants';
import { assignKeyNpcs } from './keyNpcs';
import { initTownSimState } from './townSim';
import { advanceTown } from './townSimRegistry';
import type { TownSimState } from './types';
import type { TownPlan } from '../artifacts';
import { blueprintForPlot } from '../interior/generateInterior';
import { planBuildingExtensionCandidates } from '../interior/buildingExtensions';
import type { SeedPath } from '../seedPath';
import { climateForBiomeId } from '../town/architectureStyle';
import type { StyleContext } from '../interior/blueprintTypes';
import { buildingPlotInput } from '../town/buildingPlotInput';

/**
 * Years of history simulated BEFORE the player's first visit, so a town arrives
 * with a populated recent chronicle (deaths, marriages, successions, festivals)
 * instead of an empty one. The generated roster therefore seeds the town as it
 * stood ~BACKSTORY_YEARS ago; the sim then evolves it forward to the present.
 */
const BACKSTORY_YEARS = 3;

/** Snap the real lot edges to the five-foot blueprint grid. */
function lotEnvelope(plot: TownPlan['plots'][number]): {
  maxWidthFt: number;
  maxDepthFt: number;
} {
  const [c0, c1, , c3] = plot.footprint;
  return {
    maxWidthFt: Math.max(10, Math.floor(Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) / 5) * 5),
    maxDepthFt: Math.max(10, Math.floor(Math.hypot(c3[0] - c0[0], c3[1] - c0[1]) / 5) * 5),
  };
}

/**
 * Precompute a bounded future-growth vocabulary while canonical lot geometry
 * is available. The live sim stores these outcomes and never regenerates them.
 */
export function buildingEvolutionForTown(
  plan: TownPlan,
  seedPath: SeedPath,
  styleBase: Pick<StyleContext, 'cultureType' | 'climate'>,
): NonNullable<TownSimState['buildingEvolution']> {
  const result: NonNullable<TownSimState['buildingEvolution']> = {};
  for (const plot of plan.plots) {
    const basePlan = blueprintForPlot(
      buildingPlotInput(plan, plot, seedPath, styleBase),
      seedPath,
    );
    const limits = lotEnvelope(plot);
    const extensionCandidates = planBuildingExtensionCandidates(basePlan, {
      ...limits,
      roofForm: basePlan.styleResolved?.roofForm ?? plot.roofForm,
      districtKey: plot.architecture?.districtKey ?? `plot:${plot.id}`,
    });
    if (extensionCandidates.length === 0) continue;
    result[plot.id] = {
      districtKey: plot.architecture?.districtKey ?? `plot:${plot.id}`,
      roofForm: plot.roofForm ?? extensionCandidates[0].roofForm,
      extensionCandidates,
    };
  }
  return result;
}

/**
 * Rebuild only immutable growth briefs for a previously saved burg. This is
 * intentionally separate from full registration so migration never replaces
 * its villagers, prosperity, chronicle, or existing building history.
 */
export function buildingEvolutionForBurg(
  worldSeed: number,
  burgId: number,
): NonNullable<TownSimState['buildingEvolution']> {
  const atlas = getBridgeAtlas(worldSeed);
  const enginePlan = getCanonicalTownPlan(atlas, worldSeed, burgId);
  const { plan } = toArtifactPlan(enginePlan, burgId);
  const burg = atlas.pack.burgs?.[burgId] as { cell?: number } | undefined;
  const biomeId = burg?.cell !== undefined ? atlas.pack.cells.biome?.[burg.cell] : undefined;
  if (biomeId === undefined) {
    throw new Error(
      `townSimRegistration: cannot resolve biome for burg ${burgId} in world ${worldSeed}`,
    );
  }
  return buildingEvolutionForTown(plan, canonicalTownSeedPath(worldSeed, burgId), {
    cultureType: getBurgCultureType(worldSeed, burgId),
    climate: climateForBiomeId(biomeId),
  });
}

/**
 * Build the TownSimState for a burg, current as of `currentDay`. The town is
 * seeded BACKSTORY_YEARS in the past and simulated forward to `currentDay` so it
 * arrives with real recent history. Deterministic from (worldSeed, burgId): the
 * per-(burg,day) re-seeding in advanceTown makes the backfill reproducible.
 */
export function buildTownSimStateForBurg(
  worldSeed: number,
  burgId: number,
  currentDay: number,
): TownSimState {
  const atlas = getBridgeAtlas(worldSeed);
  const enginePlan = getCanonicalTownPlan(atlas, worldSeed, burgId);
  const { plan } = toArtifactPlan(enginePlan, burgId);

  const seedPath = canonicalTownSeedPath(worldSeed, burgId);
  const nameFor = getBurgNamer(worldSeed, burgId);
  const roster = generateTownRoster(plan, seedPath, { nameFor });

  const families = assignFamilies(
    roster.occupants,
    makeSeedPath(worldSeed, `burg:${burgId}`, 's:family'),
  );
  const keyRng = new SeededRandom(
    seedFromPath(makeSeedPath(worldSeed, `burg:${burgId}`, 's:keynpc')),
  );
  const keyRoles = assignKeyNpcs(plan, roster, { rng: keyRng });
  const burg = atlas.pack.burgs?.[burgId] as { cell?: number } | undefined;
  const biomeId = burg?.cell !== undefined ? atlas.pack.cells.biome?.[burg.cell] : undefined;
  if (biomeId === undefined) {
    throw new Error(
      `townSimRegistration: cannot resolve biome for burg ${burgId} in world ${worldSeed}`,
    );
  }
  const buildingEvolution = buildingEvolutionForTown(plan, seedPath, {
    cultureType: getBurgCultureType(worldSeed, burgId),
    climate: climateForBiomeId(biomeId),
  });

  // Seed in the past (roster ages reflect the town then), then simulate forward
  // to the present so the chronicle is already populated on arrival.
  const seeded = initTownSimState(
    burgId,
    roster,
    families,
    keyRoles,
    currentDay - BACKSTORY_YEARS * DAYS_PER_YEAR,
    buildingEvolution,
  );
  return advanceTown(seeded, worldSeed, currentDay);
}
