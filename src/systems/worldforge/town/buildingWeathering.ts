// @dependencies-start
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
// @dependencies-end

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

import type {
  ArchitectureIdentity,
  BuildingAgeBand,
  BuildingConstruction,
  BuildingWeathering,
  RoofPatina,
  WallPatina,
} from '../interior/blueprintTypes';
import { fnv1a } from '../seedPath';
import type { ClimateClass } from './architectureStyle';
import type { ArchitectureFamilyId } from './buildingMaterials';

// ============================================================================
// Resolver Input And Exposure Recipes
// ============================================================================
// A district repeats one recognizable exposure recipe. Family-specific rules
// refine broad climate so coastal timber can carry salt while inland timber in
// the same temperate climate carries rain and soot.
// ============================================================================

export interface ResolveBuildingWeatheringInput {
  familyId: ArchitectureFamilyId;
  climate: ClimateClass;
  ageBand?: BuildingAgeBand;
  construction: BuildingConstruction;
  architecture?: ArchitectureIdentity;
  standaloneKey: string;
}

interface WeatheringRecipe {
  wallPatina: Exclude<WallPatina, 'none'>;
  roofPatina: Exclude<RoofPatina, 'none'>;
}

/** Choose residue that could plausibly form in this district's environment. */
function exposureRecipe(
  familyId: ArchitectureFamilyId,
  climate: ClimateClass,
  construction: BuildingConstruction,
): WeatheringRecipe {
  // Arid exposure overrides family because dust and bleaching dominate every
  // local construction method in a dry district.
  if (climate === 'arid') {
    return { wallPatina: 'dust-veil', roofPatina: 'sun-bleach' };
  }

  // Marsh districts remain damp at wall and roof level, producing the strongest
  // organic growth regardless of whether the local shell is timber or masonry.
  if (climate === 'marsh') {
    return { wallPatina: 'lichen', roofPatina: 'moss' };
  }

  // Coastal construction carries a salt signature even when the atlas climate
  // class is broadly temperate.
  if (familyId === 'coastalTimber') {
    return { wallPatina: 'salt-bloom', roofPatina: 'salt-fade' };
  }

  // Cold stone and slab roofs weather through lichen more than streaking. Sod
  // roofs remain moss-led because their living surface retains moisture.
  if (familyId === 'highlandStone' || climate === 'cold') {
    return {
      wallPatina: 'lichen',
      roofPatina: construction.roofCovering === 'sod' ? 'moss' : 'lichen-speckle',
    };
  }

  // Dense framed towns show rain on their walls and chimney soot at the roof.
  // This is the neutral temperate recipe for the remaining architecture families.
  return { wallPatina: 'rain-streaks', roofPatina: 'soot-darkening' };
}

// ============================================================================
// Public Resolution
// ============================================================================
// Age is the only intensity driver. Building identity may alter coverage, but
// can never make a newer building look older than its district neighbor.
// ============================================================================

const AGE_INTENSITY: Readonly<Record<BuildingAgeBand, 0 | 1 | 2 | 3>> = {
  new: 0,
  aged: 1,
  old: 2,
  ancient: 3,
};

/** Convert a stable 32-bit hash into a fraction without consuming shared RNG. */
function hashFraction(value: string): number {
  return fnv1a(value) / 0x1_0000_0000;
}

/** Resolve district-coherent weathering with bounded lot-level variation. */
export function resolveBuildingWeathering(
  input: ResolveBuildingWeatheringInput,
): BuildingWeathering {
  const ageBand = input.ageBand ?? 'new';
  const intensity = AGE_INTENSITY[ageBand];
  const districtKey = input.architecture
    ? `${input.architecture.settlementKey}|${input.architecture.districtKey}`
    : `${input.standaloneKey}|standalone`;
  const buildingKey = input.architecture?.buildingKey ?? input.standaloneKey;
  const recipe = exposureRecipe(input.familyId, input.climate, input.construction);

  // Coverage stays within a narrow age-scaled band. Adjacent buildings differ,
  // but the shared patina kind remains the strongest district-level signal.
  const coverage = intensity === 0
    ? 0
    : Number((0.12 + intensity * 0.14
      + hashFraction(`${buildingKey}|weathering:coverage`) * 0.12).toFixed(3));

  return {
    ageBand,
    wallPatina: intensity === 0 ? 'none' : recipe.wallPatina,
    roofPatina: intensity === 0 ? 'none' : recipe.roofPatina,
    intensity,
    coverage,
    weatheringSignature: `${input.familyId}:${fnv1a(
      `${districtKey}|${recipe.wallPatina}|${recipe.roofPatina}`,
    ).toString(36)}`,
    weatheringVariant: fnv1a(`${buildingKey}|weathering:placement`).toString(36),
  };
}
