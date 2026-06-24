/**
 * @file hiddenPlaces.ts — SP4 discovery layer, iteration #1 (headless).
 *
 * The base world is fully known and travelable (the atlas). DISCOVERY is the
 * separate layer of places that are NOT on any map — ruins, caves, shrines,
 * camps — scattered through a region and revealed only by physical PROXIMITY in
 * the streamed 3D/leaf world (SPEC §11: "base world known/travelable;
 * discovery = hidden off-map places, 3D proximity reveal").
 *
 * Pure: no React/DOM. Deterministic from the hierarchical seed-path, so the same
 * region always hides the same places at the same spots — discovery is a property
 * of the player's exploration, not of regeneration.
 *
 * Spec: docs/projects/worldforge/SPEC.md §11 (2026-06-22).
 * North star: docs/projects/worldforge/subprojects/sp4-hidden-places/NORTH_STAR.md
 */
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import { pointInPolygon, polygonBounds, type Pt } from '../submap/submapEngine';

export type HiddenPlaceKind = 'ruin' | 'cave' | 'shrine' | 'camp' | 'grove' | 'wreck';

export const HIDDEN_PLACE_KINDS: HiddenPlaceKind[] = ['ruin', 'cave', 'shrine', 'camp', 'grove', 'wreck'];

export interface HiddenPlace {
  /** Stable id (deterministic per region + index). */
  id: string;
  kind: HiddenPlaceKind;
  /** Position in the region's coord space (graph/world frame). */
  position: Pt;
  /** Radius within which the player's proximity reveals it. */
  discoveryRadius: number;
  name: string;
  /** Whether the player has come close enough to reveal it. */
  discovered: boolean;
}

export interface HiddenPlacesOptions {
  /** Target number of hidden places to scatter in the region. */
  count?: number;
  /** Proximity reveal radius (world units). */
  discoveryRadius?: number;
}

const KIND_NAME: Record<HiddenPlaceKind, string> = {
  ruin: 'Ruins', cave: 'Cave', shrine: 'Shrine', camp: 'Camp', grove: 'Hidden Grove', wreck: 'Wreck',
};

function dist2(a: Pt, b: Pt): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/**
 * Deterministically scatter hidden places inside a region polygon. They are NOT
 * placed on the atlas — they exist only in this layer and start undiscovered.
 */
export function generateHiddenPlaces(
  region: Pt[],
  seedPath: SeedPath,
  opts: HiddenPlacesOptions = {},
): HiddenPlace[] {
  const count = opts.count ?? 8;
  const b = polygonBounds(region);
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY) || 1;
  const discoveryRadius = opts.discoveryRadius ?? span * 0.06;
  const rng = rngFromPath(streamPath(seedPath, 'hidden-places'));
  const out: HiddenPlace[] = [];
  let attempts = 0;
  while (out.length < count && attempts < count * 40 + 40) {
    attempts++;
    const x = b.minX + rng.next() * (b.maxX - b.minX);
    const y = b.minY + rng.next() * (b.maxY - b.minY);
    if (!pointInPolygon([x, y], region)) continue;
    const kind = HIDDEN_PLACE_KINDS[Math.floor(rng.next() * HIDDEN_PLACE_KINDS.length)];
    const idx = out.length;
    out.push({
      id: `hp:${idx}`,
      kind,
      position: [+x.toFixed(3), +y.toFixed(3)],
      discoveryRadius,
      name: KIND_NAME[kind],
      discovered: false,
    });
  }
  return out;
}

export interface RevealResult {
  /** The full place list with newly-revealed entries flipped to discovered. */
  places: HiddenPlace[];
  /** Only the places revealed by THIS proximity check (empty if none new). */
  revealed: HiddenPlace[];
}

/**
 * Reveal any hidden places within their discovery radius of the player position.
 * Pure: returns a new list (previously-discovered places stay discovered) plus
 * the set newly revealed this call (so callers can fire a "discovered X" event).
 */
export function revealNearby(places: HiddenPlace[], playerPos: Pt): RevealResult {
  const revealed: HiddenPlace[] = [];
  const next = places.map((p) => {
    if (p.discovered) return p;
    if (dist2(p.position, playerPos) <= p.discoveryRadius * p.discoveryRadius) {
      const flipped = { ...p, discovered: true };
      revealed.push(flipped);
      return flipped;
    }
    return p;
  });
  return { places: next, revealed };
}

/** Count how many hidden places have been discovered. */
export function discoveredCount(places: HiddenPlace[]): number {
  return places.reduce((n, p) => n + (p.discovered ? 1 : 0), 0);
}
