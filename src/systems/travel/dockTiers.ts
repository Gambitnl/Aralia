/**
 * @file dockTiers.ts — dock size per port + dock class per water vehicle (travel G14).
 *
 * Ports are not all the same size: a fishing hamlet has a shallow jetty, a great
 * seaport has deep stone quays. A large ship that cannot berth at a small dock
 * anchors offshore and the party rows the last stretch ashore in a tender. This
 * file answers the two questions the route segmenter needs to decide that:
 *
 *   1. dockSizeForPort(...) — how big is the destination dock?  DERIVED at
 *      route-plan time from data the burg/port already carries (population,
 *      capital flag). It bakes NO new field into world generation — the atlas
 *      stays frozen and byte-identical.
 *   2. dockClassForVehicle / dockClassForShipSize — how big is the ship trying to
 *      berth?  Static config, safe to define here.
 *
 * When a vehicle's dock class exceeds the destination dock size, the ship is too
 * large to berth directly and a tender leg is required. Pure: no React/DOM, no
 * world-state mutation.
 */
import type { TravelVehicle } from '../../types/travel';

/** How big a port's dock is. Ordered small < medium < large. */
export type DockSize = 'small' | 'medium' | 'large';

/** How big a berth a water vehicle needs. Same ordered scale as DockSize. */
export type DockClass = 'small' | 'medium' | 'large';

/** Numeric tier for the ordered small/medium/large scale (1 < 2 < 3). */
export const DOCK_TIER: Record<DockSize | DockClass, number> = {
  small: 1,
  medium: 2,
  large: 3,
};

// ── Dock-size thresholds ─────────────────────────────────────────────────────
// A port's dock size is derived from its population. FMG `burg.population` is in
// thousands (0.05 ≈ a 50-soul fishing village; a capital gets a ×1.5 bonus), so
// these thresholds read as "thousands of townsfolk". A market town gets a proper
// wharf (medium); a real city gets deep-water quays (large).
//
// TUNABLE — flagged for design review.
export const DOCK_MEDIUM_MIN_POP = 2; // TUNABLE — ≥ this (×1000) population → medium dock
export const DOCK_LARGE_MIN_POP = 6; // TUNABLE — ≥ this (×1000) population → large dock

/** The port fields dock size is derived from. A subset of the FMG `Burg` shape. */
export interface DockPort {
  /** FMG population in thousands. */
  population?: number;
  /** Truthy when the burg is a state capital (deeper investment in its port). */
  capital?: number;
}

/**
 * Derive a port's dock size from data it already carries — never a baked field.
 *
 * Uses population (thousands) against the tunable thresholds. A capital is always
 * at least a medium dock: seats of power invest in their harbor even when their
 * headcount is modest. Ports with no/undefined population read as small (a wild
 * anchorage or a spawned fishing village).
 */
export function dockSizeForPort(port: DockPort | null | undefined): DockSize {
  const pop = port?.population ?? 0;
  if (pop >= DOCK_LARGE_MIN_POP) return 'large';
  if (pop >= DOCK_MEDIUM_MIN_POP || port?.capital) return 'medium';
  return 'small';
}

/**
 * The dock class a water vehicle needs, from its static config `dockClass`.
 * Defaults to 'small' for vehicles that declare none (e.g. a rowboat) — a small
 * craft fits anywhere.
 */
export function dockClassForVehicle(vehicle: TravelVehicle | null | undefined): DockClass {
  return vehicle?.dockClass ?? 'small';
}

// ── Owned-ship size → dock class ─────────────────────────────────────────────
// Owned ships use D&D creature-size labels; map them onto the dock scale so an
// owned voyage and a hired vehicle answer the berth question the same way.
const SHIP_SIZE_DOCK_CLASS: Record<string, DockClass> = {
  Tiny: 'small',
  Small: 'small',
  Medium: 'medium',
  Large: 'large',
  Huge: 'large',
  Gargantuan: 'large',
};

/** The dock class an owned ship needs, from its `size` label. */
export function dockClassForShipSize(size: string | null | undefined): DockClass {
  return SHIP_SIZE_DOCK_CLASS[size ?? ''] ?? 'medium';
}

/**
 * Whether a vehicle of `dockClass` can berth directly at a `dockSize` port.
 * True when the dock is at least as large as the vehicle needs. When false the
 * ship is too large to dock and a tender leg is required.
 */
export function dockClassFitsPort(dockClass: DockClass, dockSize: DockSize): boolean {
  return DOCK_TIER[dockSize] >= DOCK_TIER[dockClass];
}
