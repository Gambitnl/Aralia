// @dependencies-start
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
// @dependencies-end

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

import {
  childSeedPath,
  rngFromPath,
  streamPath,
  type SeedPath,
} from '../seedPath';
import type { Feet } from '../units';
import { generateBuilding } from './generateBuilding';
import type {
  BuildingBackstory,
  BuildingEvent,
  BuildingEventHistory,
  BuildingEnsemble,
  BlueprintPlan,
  BuildingType,
  HouseholdBrief,
  StyleContext,
} from './blueprintTypes';

// ============================================================================
// Town Plot Input
// ============================================================================
// This contract carries everything the town knows about one building into the
// blueprint generator. Optional population, style, and history fields stay
// absent for older or isolated plots, preserving their deterministic output.
// ============================================================================

/** Atomic grid used by the building generator. */
const CELL_FT = 5;

/** Smallest lot the plot adapter will size a building into. */
const MIN_LOT_FT = 10;

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

/** Ignore affine/rotation dust without rounding a genuinely short lot up. */
const snapDown = (value: number): number =>
  Math.floor((value + 1e-6) / CELL_FT) * CELL_FT;

// ============================================================================
// Plot Role and Basement Resolution
// ============================================================================
// Town plans use broad roles such as house or market. The blueprint generator
// needs a concrete building type and a stable basement decision, so both are
// resolved here before generation begins.
// ============================================================================

/** Town plot role to BuildingType. Unknown roles fail instead of inventing a fallback. */
const ROLE_TO_TYPE: Record<string, BuildingType> = {
  house: 'cottage',
  market: 'shop',
  shop: 'shop',
  tavern: 'tavern',
  inn: 'tavern',
  workshop: 'workshop',
  craft: 'workshop',
  manor: 'manor',
  keep: 'keep',
  citadel: 'keep',
  civic: 'civic',
  temple: 'temple',
};

/** Resolve a plot role to a BuildingType; throws on an unmapped role. */
export function buildingTypeForRole(role: string): BuildingType {
  const type = ROLE_TO_TYPE[role];
  if (!type) {
    throw new Error(
      `generateInterior: no BuildingType mapping for plot role "${role}" ` +
        `(known: ${Object.keys(ROLE_TO_TYPE).join(', ')})`,
    );
  }
  return type;
}

/**
 * Basement odds by building type. Manors and taverns nearly always dig
 * cellars, shops and workshops usually need stock space, and cottages only
 * sometimes have a root cellar.
 */
export const BASEMENT_CHANCE: Record<BuildingType, number> = {
  manor: 0.9,
  tavern: 0.8,
  shop: 0.6,
  workshop: 0.5,
  cottage: 0.25,
  townhouse: 0.4,
  tenement: 0.2,
  farmstead: 0.3,
  smithy: 0.4,
  inn: 0.85,
  storehouse: 0.7,
  temple: 0.6,
  keep: 0.9,
  civic: 0.5,
};

/**
 * Make one isolated basement draw for this building. A named random stream
 * ensures later generation changes cannot silently flip the basement choice.
 */
export function rollBasement(
  type: BuildingType,
  interiorPath: SeedPath,
): boolean {
  return (
    rngFromPath(streamPath(interiorPath, 'basement')).next() <
    BASEMENT_CHANCE[type]
  );
}

// ============================================================================
// Canonical Blueprint Adapter
// ============================================================================
// This is the one public generation path for town plots. It translates the lot
// envelope and town metadata, then returns the complete BlueprintPlan without
// collapsing room shapes or dropping windows and basements.
// ============================================================================

/** Generate the full, memoized BlueprintPlan for one town plot. */
export function blueprintForPlot(
  plot: InteriorPlotInput,
  seedPath: SeedPath,
): BlueprintPlan {
  const interiorPath = childSeedPath(seedPath, `interior:${plot.id}`);

  // Measure the rotation-free frontage and depth, then snap down to the same
  // five-foot grid the building generator uses. This prevents overhangs.
  const [corner0, corner1, , corner3] = plot.footprint;
  const lotWidthFt = Math.max(
    MIN_LOT_FT,
    snapDown(Math.hypot(corner1[0] - corner0[0], corner1[1] - corner0[1])),
  );
  const lotDepthFt = Math.max(
    MIN_LOT_FT,
    snapDown(Math.hypot(corner3[0] - corner0[0], corner3[1] - corner0[1])),
  );
  const storeys = Math.max(1, Math.floor(plot.storeys || 1));

  // Population-authored building types are more specific than town roles.
  // Briefless towns continue to resolve through the closed role table.
  const type = plot.buildingType ?? buildingTypeForRole(plot.role);

  // generateBuilding owns memoization and every geometry decision. Passing the
  // complete context here keeps all consumers on the exact same plan instance.
  return generateBuilding({
    buildingId: plot.id,
    type,
    seedPath: interiorPath,
    storeys,
    ensemble: plot.ensemble,
    basement: rollBasement(type, interiorPath),
    maxWidthFt: lotWidthFt,
    maxDepthFt: lotDepthFt,
    household: plot.household,
    style: plot.style,
    backstory: plot.backstory,
    eventLog: plot.eventLog,
  });
}
