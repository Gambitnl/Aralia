/**
 * @file navDrift.ts — travel G2 "get lost" wiring (DMG p.111).
 *
 * MapPane owns the committed trip; this pure helper decides whether that trip's
 * party gets LOST and, if so, which wrong way they drift and how much time they
 * burn. It sits between the route (cells + geometry) and `checkNavigation`
 * (the raw d20-vs-DC rule), so the rule stays reusable and this stays unit-testable
 * without dragging in the whole map component. App applies the returned penalty.
 */
import { checkNavigation } from './TravelNavigation';
import type { TravelDirection } from '../../types/travel';
import { SeededRandom } from '@/utils/random';

/** The 8 compass headings, ordered counter-clockwise from East for angle bucketing. */
const NAV_COMPASS: TravelDirection[] = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];

/**
 * 8-way compass heading of a route's overall direction, in atlas graph space
 * (x grows east, y grows DOWN — SVG convention, so north is −y). Feeds the DMG
 * get-lost roll its "intended direction" so a drift reads as a wrong heading.
 */
export function bearingToDirection(dx: number, dy: number): TravelDirection {
  if (dx === 0 && dy === 0) return 'N';
  const deg = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 360;
  return NAV_COMPASS[Math.round(deg / 45) % 8];
}

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
export function deriveNavDrift(
  navInfoOf: (cell: number) => { dc: number; cause: 'road' | 'wilds' | 'faint-path' },
  routeCells: number[],
  routePoints: Array<[number, number]>,
  survivalModifier: number,
  rng: SeededRandom,
): NavDrift | undefined {
  if (routeCells.length < 2 || routePoints.length < 2) return undefined;
  // Governing DC = the WORST cell the route crosses; its cause names the story.
  let dc = 0;
  let cause: 'road' | 'wilds' | 'faint-path' = 'road';
  for (const c of routeCells) {
    const info = navInfoOf(c);
    if (info.dc > dc) { dc = info.dc; cause = info.cause; }
  }
  if (dc <= 0) return undefined; // maintained the whole way — exempt, no roll
  const start = routePoints[0];
  const end = routePoints[routePoints.length - 1];
  const direction = bearingToDirection(end[0] - start[0], end[1] - start[1]);
  // d20 (max-exclusive nextInt ⇒ 1..20) + the party's best Survival modifier.
  const survivalCheckResult = rng.nextInt(1, 21) + survivalModifier;
  const result = checkNavigation(survivalCheckResult, 'open', 'normal', false, direction, rng, dc);
  if (result.success || !result.driftDirection) return undefined;
  return {
    lost: true,
    driftDirection: result.driftDirection,
    extraSeconds: result.timePenaltyHours * 3600,
    // A visible path in open country grades dc 5 with cause 'road', so this CAN
    // fire; NavDrift's cause vocab has no 'road' — word it as open-country 'wilds'.
    cause: cause === 'road' ? 'wilds' : cause,
  };
}

/** True when any cell of the route is a faint/overgrown path — the readout
 * warns the player BEFORE they commit to a trip that can lose the trail. */
export function routeHasFaintPath(
  navInfoOf: (cell: number) => { dc: number; cause: 'road' | 'wilds' | 'faint-path' },
  routeCells: number[],
): boolean {
  return routeCells.some((c) => navInfoOf(c).cause === 'faint-path');
}
