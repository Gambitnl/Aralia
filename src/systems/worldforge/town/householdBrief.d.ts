/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 19:53:47
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx, systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/interior/occupancy.ts, systems/worldforge/roster/generateTownRoster.ts, systems/worldforge/town/buildingPlotInput.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file householdBrief.ts — town → blueprint household brief bridge.
 *
 * The building generator designs a house for a COARSE family description
 * ({@link HouseholdBrief}: slots + counts, never names). This module coarsens
 * the SAME lazy named household the tooltip shows ({@link generateHousehold})
 * into that brief, so the family the town names and the family the house is
 * designed for are one and the same.
 *
 * Determinism flows entirely from `generateHousehold` (deterministic per
 * `(townSeed, homeId)`); both functions here are pure.
 */
import type { BriefWealth, HouseholdBrief } from "../interior/blueprintTypes";
import type { TownPlan } from "../artifacts";
import { type Household } from "./household";
import type { TownPlotPopulation } from "./townEngine";
import type { SeedPath } from "../seedPath";
/** Population data enriched with the final wealth stamp for its artifact plot. */
export interface HouseholdPopulationContext extends TownPlotPopulation {
    /** Architecture wins over the population district when both are present. */
    resolvedWealth?: BriefWealth;
}
/** Resolve the final wealth of one artifact building through one precedence rule. */
export declare function resolvePlotWealth(plot: Pick<TownPlan["plots"][number], "architecture" | "pop">): BriefWealth;
/** Carry one artifact plot's canonical wealth beside its population record. */
export declare function householdPopulationForPlot(plot: TownPlan["plots"][number]): HouseholdPopulationContext | undefined;
/** Build the cross-reference set used for home/workplace household resolution. */
export declare function householdPopulationsForPlan(plan: Pick<TownPlan, "plots">): HouseholdPopulationContext[];
/**
 * Resolve staffing wealth from the household's HOME, even when the caller is
 * inspecting a proprietor workplace in another district. This prevents the
 * same named family from gaining or losing servants by call path.
 */
export declare function resolveHouseholdWealth(plot: HouseholdPopulationContext, allPlots: readonly HouseholdPopulationContext[]): BriefWealth;
/**
 * The single member-slot tag scheme: 'head'/'spouse' stay bare (unique
 * singletons), every other role is `<role>:<n>` with `n` the 0-based index
 * among members of that role. SINGLE SOURCE OF TRUTH — {@link briefFromHousehold}
 * stamps tags with this, and occupancy.ts's `tagToMember` inverts the same
 * scheme, so brief slots and station lookups can never drift apart.
 */
export declare const memberTag: (role: string, n: number) => string;
/**
 * Stable cross-system identity for one named household member. The home id
 * anchors the family and the role-local slot keeps identities deterministic
 * even when unrelated roster residents are inserted before or after them.
 */
export declare function householdMemberIdentity(household: Household, memberIndex: number): string;
/**
 * Coarsen a named household into the slots-and-counts brief the generator
 * designs for. Slot tags are stable and unique ('head', 'spouse', 'child:0'…).
 * Servants are ordinary named household members by this boundary, so this
 * adapter maps them exactly once instead of inventing anonymous extra slots.
 */
export declare function briefFromHousehold(hh: Household, opts: {
    wealth: BriefWealth;
    worksAtHome: boolean;
}): HouseholdBrief;
/**
 * The named household + brief context for a plot, or `undefined` when the plot
 * has no household (storehouse, civic, temple, keep, unpopulated towns) — a
 * legitimate absence, not a fallback.
 *
 * SINGLE SOURCE OF TRUTH for "who lives here": both {@link briefForPlot} (the
 * blueprint's household brief) and the living-overlay bridge
 * ({@link import('../bridge/buildingOccupancy').occupancyForPlot}) derive from
 * this, so the family the house is DESIGNED for and the family whose members
 * STAND at stations can never drift. Residential plot → its family. Workplace
 * plot (smithy/shop/inn/tavern) run by a family → the PROPRIETOR family with
 * `worksAtHome: true` (they live over the shop).
 */
export declare function householdForPlot(plot: HouseholdPopulationContext, allPlots: readonly HouseholdPopulationContext[], townSeed: SeedPath): {
    household: Household;
    wealth: BriefWealth;
    worksAtHome: boolean;
} | undefined;
/**
 * Brief for a plot. Residential plot → its household's brief. Workplace plot
 * (smithy/shop/inn/tavern) run by a family → the PROPRIETOR family's brief with
 * `worksAtHome: true` (they live over the shop). Returns `undefined` for plots
 * with no household (storehouse, civic, temple, keep, unpopulated towns) — a
 * legitimate absence, not a fallback. Thin wrapper over
 * {@link householdForPlot}, coarsening its named family into the brief.
 */
export declare function briefForPlot(plot: HouseholdPopulationContext, allPlots: readonly HouseholdPopulationContext[], townSeed: SeedPath): HouseholdBrief | undefined;
