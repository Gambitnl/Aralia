/**
 * @file shipEmbark.ts — pure helpers for owned-ship embarkation from the world map.
 *
 * These helpers are intentionally pure (no side effects, no store access) so they
 * can be unit-tested in isolation and kept out of MapPane's render closure.
 *
 * Subtask 3C-3: embark gate + destination port validation.
 */
import type { Ship } from '@/types/naval';
import type { MultiModalRoute } from '@/systems/travel/multiModalRoute';

// ---------------------------------------------------------------------------
// Narrow pack shape (mirrors the Packish type in multiModalAtlasGraph.ts and the
// PackishBurg shape in knownPorts.ts).
// ---------------------------------------------------------------------------

// FMG uses a numeric sentinel (0) for the removed-burg hole; the element type is
// `number | PackishBurg | undefined` so a `0` sentinel is correctly treated as
// "no port" (the `typeof burg === 'number'` guard rejects it before .port).
type PackishBurg = { cell?: number; port?: number };

type Packish = {
  cells: {
    burg?: ArrayLike<number>;
    p?: Array<[number, number]>;
  };
  burgs?: Array<number | PackishBurg | undefined>;
};

// ---------------------------------------------------------------------------
// 1. Ship travel availability (the embark gate)
// ---------------------------------------------------------------------------

export interface ShipTravelAvailability {
  available: boolean;
  /** Human-readable reason why travel is unavailable, or null when available. */
  reason: string | null;
}

/**
 * Decides whether owned-ship travel is currently available.
 *
 * Rules (all must hold):
 *   1. An active ship exists.
 *   2. The ship has a known docked port (`dockedPortBurgId` is set).
 *   3. The player is standing at a port (`playerPortBurgId` is set).
 *   4. The player's port matches the ship's dock (`dockedPortBurgId === playerPortBurgId`).
 *
 * Each failing branch returns a reason that precisely describes its cause, so
 * the disabled-option hint is honest. One real path — no silent fall-through.
 */
export function shipTravelAvailability(
  activeShip: Ship | null | undefined,
  playerPortBurgId: number | null,
): ShipTravelAvailability {
  if (!activeShip) {
    return { available: false, reason: 'No ship' };
  }
  if (activeShip.dockedPortBurgId == null) {
    return { available: false, reason: 'Ship is not docked' };
  }
  if (playerPortBurgId == null) {
    return { available: false, reason: 'Not at a port' };
  }
  if (activeShip.dockedPortBurgId !== playerPortBurgId) {
    return { available: false, reason: 'Ship is docked elsewhere' };
  }
  return { available: true, reason: null };
}

// ---------------------------------------------------------------------------
// 2. Voyage parameters from a destination atlas cell
// ---------------------------------------------------------------------------

export interface VoyageDestination {
  destinationBurgId: number;
  seaMiles: number;
  /** Aggregate sea-danger of the route in [0,1] (Plan 3A tiers), for the encounter roll. */
  danger: number;
}

/**
 * Derives the voyage destination from the clicked atlas cell and a pre-computed
 * multi-modal segmented route.
 *
 * Returns null when the destination cell is NOT a port burg (player must pick a
 * port — do NOT fall back to a land teleport).
 *
 * @param destCell   The atlas cell index the player clicked.
 * @param pack       The FMG pack (narrow Packish shape — same idiom as multiModalAtlasGraph.ts).
 * @param segmentedRoute  Already-computed multi-modal route to destCell.
 */
export function shipVoyageFromDestination(
  destCell: number,
  pack: unknown,
  segmentedRoute: MultiModalRoute,
): VoyageDestination | null {
  const p = pack as Packish;

  // Resolve the burg at the destination cell. This relies on FMG burg arrays
  // being 1-indexed (index 0 is the removed-burg sentinel), so the cell→burg
  // index read here equals the canonical burg id (burgId === burg.i by
  // construction) — the same id knownPorts.ts/the naval seam use.
  const burgId = p.cells.burg?.[destCell];
  if (!burgId) return null;

  // The burg must be a live port. A numeric `0`/sentinel entry is not a port.
  const burg = p.burgs?.[burgId];
  if (!burg || typeof burg === 'number' || !burg.port) return null;

  return {
    destinationBurgId: burgId,
    seaMiles: segmentedRoute.seaMiles,
    danger: segmentedRoute.danger,
  };
}
