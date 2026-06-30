/**
 * @file chronicleForLocation.ts — bridge the player's CURRENT location to the
 * tracked town's recent chronicle, so dialogue can let NPCs reference real town
 * history ("the old innkeeper passed this winter").
 *
 * Pure. Returns [] when the player isn't standing in a tracked town (a
 * legitimate "no chronicle applies" case, not a swallowed error) — no try/catch
 * fallback (no-fallback directive): if the underlying town bridge throws, that
 * surfaces honestly.
 */
import { getGameDay } from '../../../utils/core';
import { getBridgeAtlas } from '../bridge/legacySubmapBridge';
import { DAYS_PER_YEAR } from './constants';
import { summarizeChronicle } from './chronicle';
import type { TownSimRegistry } from './townSimRegistry';
import type { TownSimState } from './types';

export interface ChronicleForLocationInput {
  currentLocationId: string;
  worldSeed: number;
  /**
   * Canonical player atlas cell (`playerCell.cellId`) — the authoritative source
   * for which burg the player stands in. Grid retirement: the legacy 30×20
   * gridSize/coord path is gone; this is the sole town resolver.
   */
  cellId?: number | null;
  townSim: TownSimRegistry;
  gameTime: Date;
}

/**
 * The burgId whose seat is the given atlas cell, or undefined if no burg sits
 * there. Cell-native and exact: FMG records the burg per cell (`cells.burg`), so
 * "which town am I in?" needs no grid round-trip. This is the cell-native
 * successor to the coord_X_Y town lookup (grid-retirement Phase A1).
 */
export function burgIdForCell(worldSeed: number, cellId: number): number | undefined {
  const atlas = getBridgeAtlas(worldSeed);
  const burgId = (atlas.pack.cells as unknown as { burg?: ArrayLike<number> }).burg?.[cellId];
  // FMG: cells.burg is 0 for every cell that is not a burg's seat.
  return burgId ? burgId : undefined;
}

/**
 * The tracked TownSimState for the town the player is currently standing in, or
 * undefined if not in a tracked town. Shared by every diegetic news surface.
 */
export function resolveTownForLocation(input: ChronicleForLocationInput): TownSimState | undefined {
  const burgId = burgIdForLocation(input);
  return burgId === undefined ? undefined : input.townSim[burgId];
}

/**
 * The burgId of the town at the player's canonical cell, or undefined if that
 * cell holds no burg (or no cell is recorded). Independent of whether the town is
 * TRACKED yet — used by registration to decide which burg to start simulating.
 * (Stage 6: cell-native; the legacy coord_X_Y grid lookup is removed.)
 */
export function burgIdForLocation(input: {
  worldSeed: number;
  cellId?: number | null;
}): number | undefined {
  return input.cellId != null ? burgIdForCell(input.worldSeed, input.cellId) : undefined;
}

/**
 * Recent chronicle lines (year-grouped, most-recent last) for the town the
 * player is currently in, or [] if not in a tracked town.
 */
export function townChronicleForLocation(
  input: ChronicleForLocationInput,
  opts: { years?: number; maxLines?: number } = {},
): string[] {
  const town = resolveTownForLocation(input);
  if (!town) return []; // not standing in a tracked town

  const currentDay = getGameDay(input.gameTime);
  const years = opts.years ?? 3;
  const lines = summarizeChronicle(town, {
    fromDay: currentDay - years * DAYS_PER_YEAR,
    toDay: currentDay,
  });
  const maxLines = opts.maxLines ?? 4;
  return lines.slice(-maxLines);
}
