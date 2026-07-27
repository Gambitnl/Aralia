/**
 * @file startTowns.ts — selectable starting towns for the Start Point Selection step.
 *
 * After character creation the player chooses where to begin, and the design
 * constraint is that they may only start *inside a town* (never open wilderness
 * or ocean). This enumerates the WF/FMG world's real burgs as pickable start
 * points, grouped by their country/region (state), with the display + spawn data
 * the selection UI needs: graph coords for the atlas pin, the atlas cell to spawn
 * at, and a population estimate for sizing/sorting.
 *
 * Pure: no React/DOM. Deterministic from the world.
 */
import type { FmgWorldResult } from '../fmg/generateWorld';
export interface SelectableTown {
    /** Index into `pack.burgs`. */
    burgIndex: number;
    /** WF atlas cell the burg sits on (`burg.cell`) — the spawn cell. */
    atlasCellId: number;
    /** Town name. */
    name: string;
    /** Graph-space coords (for placing a pin on the atlas). */
    x: number;
    y: number;
    /** Capital of its state. */
    isCapital: boolean;
    /** Coastal/harbour town. */
    isPort: boolean;
    /** Estimated inhabitants (population points × rate × urbanization). */
    population: number;
    /** Owning state index (`0` = neutral / no state). */
    stateIndex: number;
    /** Owning state's name (`'Neutral'` for state 0 / unnamed). */
    stateName: string;
}
export interface TownRegion {
    stateIndex: number;
    stateName: string;
    /** Towns in this region, capitals first then by descending population. */
    towns: SelectableTown[];
}
/**
 * All real, pickable starting towns in the world: every non-placeholder,
 * non-removed burg anchored to a land cell. Sorted capitals-first, then by
 * descending population, so the most prominent settlements lead the list.
 */
export declare function listSelectableTowns(world: FmgWorldResult): SelectableTown[];
/**
 * The selectable towns grouped by their country/region (state), so the player
 * can first narrow to a continent/country and then pick a town within it.
 * Regions are sorted by total population (most-settled first); neutral last.
 */
export declare function groupTownsByState(towns: SelectableTown[]): TownRegion[];
