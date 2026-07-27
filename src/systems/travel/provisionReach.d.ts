/**
 * @file provisionReach.ts — burn-weighted travel reachability (E2).
 *
 * The R1 ring used raw trip-days off the route field, treating every travel-day
 * as one resource-day. E2 makes the horizon honest about terrain: crossing
 * difficult ground burns more food/water per day, so a cell reached *through*
 * harsh terrain costs more resource-days than its travel time alone implies.
 *
 * Given a single-source route field (minutes-from-origin + the shortest-path
 * `prev` tree) and a per-cell terrain lookup, this walks the tree in increasing
 * distance order and accumulates each cell's burn-weighted resource-day cost,
 * then returns the cells within a supply budget. Pure: no React/atlas/DOM.
 */
import type { TravelTerrain } from '../../types/travel';
import { type ProvisionResource } from './provisioning';
export interface ReachFieldInput {
    /** Origin cell (cost 0). */
    origin: number;
    /** Minutes-from-origin to every reached cell (RouteField.dist). */
    dist: Map<number, number>;
    /** Shortest-path predecessor of each reached cell (RouteField.prev). */
    prev: Map<number, number>;
    /** Travel-terrain class of entering a cell. */
    terrainOf: (cell: number) => TravelTerrain;
    /** Which resource's burn factors to apply (food / water). */
    resource: ProvisionResource;
}
/**
 * Per-cell burn-weighted resource-days consumed reaching each cell along its
 * fastest-time path. Processed in ascending distance so a cell's predecessor is
 * always resolved first (Dijkstra edges are positive ⇒ prev has strictly less
 * distance).
 */
export declare function burnWeightedDayField(input: ReachFieldInput): Map<number, number>;
/**
 * Cells reachable before the resource runs out, accounting for terrain burn.
 * `maxBurnDays` is the per-consumer budget (resource-days ÷ consumers); a cell is
 * in range when its burn-weighted cost is within it.
 */
export declare function reachableCellsByBurn(input: ReachFieldInput & {
    maxBurnDays: number;
}): number[];
