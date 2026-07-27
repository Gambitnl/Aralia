import type { TravelDirection } from '../../types/travel';
import { SeededRandom } from '@/utils/random';
/**
 * 8-way compass heading of a route's overall direction, in atlas graph space
 * (x grows east, y grows DOWN — SVG convention, so north is −y). Feeds the DMG
 * get-lost roll its "intended direction" so a drift reads as a wrong heading.
 */
export declare function bearingToDirection(dx: number, dy: number): TravelDirection;
/** Result of a committed trip's navigation roll, present ONLY when the party is lost. */
export interface NavDrift {
    lost: boolean;
    driftDirection: string;
    extraSeconds: number;
    /** What lost the party: trackless wilds, or a path that faded under the trees. */
    cause: 'wilds' | 'faint-path';
}
/**
 * Derive the navigation-drift outcome (travel G2) for a committed leg. Rolls the
 * DMG (p.111) "get lost" check ONCE for the trip: a Survival check vs the trip's
 * governing navigation DC. The governing DC is the WORST (highest-DC) cell the
 * route crosses, graded by the road system's DC ladder — any all-maintained
 * route (highway/road, or visible trail) yields DC 0 and is exempt (no roll),
 * while faint forest paths and off-road stretches can fail. Returns undefined
 * when the party stays found (maintained the whole way, or a passed check), so
 * a clean trip carries no penalty. Present ONLY when LOST: the party still
 * arrives at the intended cell, but drifts a wrong compass heading and loses
 * `extraSeconds` (DMG 1d6 hours) of travel time; `cause` names what lost them.
 *
 * Deterministic: the caller seeds `rng` from (worldSeed, destination cell) so a
 * given world + trip always reproduces the same lost/not-lost + drift.
 *
 * @param navInfoOf Per-cell getting-lost info: DC + player-facing cause.
 * @param routeCells Atlas cell ids the route crosses, origin→destination.
 * @param routePoints Graph-space polyline for the route (for the intended heading).
 * @param survivalModifier The party's best navigator's Survival modifier.
 * @param rng Seeded RNG — determinism source for the d20 roll + drift pick.
 */
export declare function deriveNavDrift(navInfoOf: (cell: number) => {
    dc: number;
    cause: 'road' | 'wilds' | 'faint-path';
}, routeCells: number[], routePoints: Array<[number, number]>, survivalModifier: number, rng: SeededRandom): NavDrift | undefined;
/** True when any cell of the route is a faint/overgrown path — the readout
 * warns the player BEFORE they commit to a trip that can lose the trail. */
export declare function routeHasFaintPath(navInfoOf: (cell: number) => {
    dc: number;
    cause: 'road' | 'wilds' | 'faint-path';
}, routeCells: number[]): boolean;
