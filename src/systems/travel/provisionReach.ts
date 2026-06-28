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
import { terrainBurnFactor, type ProvisionResource } from './provisioning';

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

const MINUTES_PER_DAY = 24 * 60;

/**
 * Per-cell burn-weighted resource-days consumed reaching each cell along its
 * fastest-time path. Processed in ascending distance so a cell's predecessor is
 * always resolved first (Dijkstra edges are positive ⇒ prev has strictly less
 * distance).
 */
export function burnWeightedDayField(input: ReachFieldInput): Map<number, number> {
  const order = [...input.dist.keys()].sort(
    (a, b) => (input.dist.get(a) ?? 0) - (input.dist.get(b) ?? 0),
  );
  const burnDays = new Map<number, number>([[input.origin, 0]]);
  for (const cell of order) {
    if (cell === input.origin) continue;
    const p = input.prev.get(cell);
    if (p == null) continue; // unreachable / detached from the tree
    const segMinutes = (input.dist.get(cell) ?? 0) - (input.dist.get(p) ?? 0);
    const segDays = Math.max(0, segMinutes) / MINUTES_PER_DAY;
    const factor = terrainBurnFactor(input.terrainOf(cell), input.resource);
    burnDays.set(cell, (burnDays.get(p) ?? 0) + segDays * factor);
  }
  return burnDays;
}

/**
 * Cells reachable before the resource runs out, accounting for terrain burn.
 * `maxBurnDays` is the per-consumer budget (resource-days ÷ consumers); a cell is
 * in range when its burn-weighted cost is within it.
 */
export function reachableCellsByBurn(input: ReachFieldInput & { maxBurnDays: number }): number[] {
  const field = burnWeightedDayField(input);
  const budget = input.maxBurnDays;
  const out: number[] = [];
  // Small epsilon so a cell costing exactly the budget (e.g. 2.0 ≤ 2) is in.
  const EPS = 1e-9;
  for (const [cell, cost] of field) {
    if (cost <= budget + EPS) out.push(cell);
  }
  return out;
}
