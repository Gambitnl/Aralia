/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 19:02:56
 * Dependents: components/DesignPreview/steps/PreviewBlueprint.tsx, components/Worldforge/TownPlanView.tsx, systems/worldforge/bridge/buildingOccupancy.ts, systems/worldforge/interior/occupancy.ts, systems/worldforge/town/householdBrief.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file household.ts — lazy named household for one town building.
 *
 * "Who are they?" answered on demand. The population pass ({@link assignTownPopulation})
 * gives every home an occupant COUNT but no names — naming all 120k souls of a capital
 * eagerly is wasteful. Instead each building's household is generated lazily and
 * deterministically from the town seed + the building's stable `homeId`, so inspecting
 * a house always yields the same family, but unvisited houses cost nothing.
 * Wealth is an explicit staffing input: the family stays byte-stable while a
 * wealthy home adds two deterministic, separately named live-in servants.
 *
 * Bridges to the whole-town roster/agent-sim: ancestry is drawn from the SAME
 * `TOWNSFOLK_RACES` distribution the roster uses, and occupations come from the
 * economy graph (proprietor/staff/labourer + workplace type) the population pass wires.
 */
import { type SeedPath } from '../seedPath';
import type { BuildingType } from './population';
import type { AgeBand } from '../roster/types';
import type { BriefWealth } from '../interior/blueprintTypes';
export interface HouseholdMember {
    name: string;
    ageBand: AgeBand;
    age: number;
    /** Ancestry (a `raceGroups` name) — blood relatives share it; a married-in spouse may differ. */
    race: string;
    /** Role within the household for UI flavour. */
    role: 'head' | 'spouse' | 'child' | 'elder' | 'kin' | 'lodger' | 'servant';
    /** What they do — derived from the building's economy role (empty for children). */
    occupation: string;
}
/** Work context for the home, from the economy graph (population.assignWorkplaces). */
export interface HouseholdWork {
    role?: 'proprietor' | 'staff' | 'labourer';
    /** The workplace's building type (inn/smithy/…), when role is proprietor/staff. */
    workplaceType?: BuildingType;
}
export interface Household {
    homeId: string;
    /** Family surname (the household is "the <surname>s"). */
    surname: string;
    /** Building type the family lives in (cottage/townhouse/tenement/farmstead). */
    dwelling: BuildingType;
    /** Bloodline ancestry of the household head. */
    ancestry: string;
    /** The head's trade — the household's public identity ("blacksmith", "farmer"). */
    occupation: string;
    members: HouseholdMember[];
    /** One-line description for tooltips ("The Ashbournes — a smith's household of 5"). */
    summary: string;
}
/** Wealthy homes employ two live-in servants; other wealth tiers employ none. */
export declare const WEALTHY_HOME_SERVANT_COUNT = 2;
/**
 * Generate (lazily) the named household living in one building. `occupants` is the
 * resident count from {@link assignTownPopulation}; `dwelling` its building type;
 * `work` the economy role (so the head gets a real trade); `wealth` decides
 * whether two live-in servants join the named household. Deterministic per
 * (town seed, homeId, wealth).
 */
export declare function generateHousehold(townSeed: SeedPath, homeId: string, occupants: number, dwelling?: BuildingType, work?: HouseholdWork, wealth?: BriefWealth): Household;
