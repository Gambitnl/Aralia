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
import { parseCoordinateLocationId } from '../../../utils/locationUtils';
import { getTownTilesForGrid, getBridgeAtlas } from '../bridge/legacySubmapBridge';
import { DAYS_PER_YEAR } from './constants';
import { summarizeChronicle } from './chronicle';
import type { TownSimRegistry } from './townSimRegistry';
import type { TownSimState } from './types';

export interface ChronicleForLocationInput {
  currentLocationId: string;
  worldSeed: number;
  gridSize?: { cols: number; rows: number };
  /**
   * Canonical player atlas cell (`playerCell.cellId`). When present it is the
   * authoritative source for which burg the player stands in — the legacy
   * `currentLocationId`/`gridSize` coord path below is only used when it's absent.
   * GRID-RETIRE: BA-2 — flips this reader off the lossy 30×20 grid (Phase A1).
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
 * The burgId of the town at the player's current location, or undefined if the
 * location isn't a town tile. Independent of whether the town is TRACKED yet —
 * used by registration to decide which burg to start simulating.
 */
export function burgIdForLocation(input: {
  currentLocationId: string;
  worldSeed: number;
  gridSize?: { cols: number; rows: number };
  /** Canonical player cell — preferred over the coord path when present. */
  cellId?: number | null;
}): number | undefined {
  const { currentLocationId, worldSeed, gridSize, cellId } = input;
  // GRID-RETIRE: BA-2 — the canonical cell is authoritative. The lossy coord_X_Y
  // path below is legacy bookkeeping, used only until every caller threads a cell.
  if (cellId != null) return burgIdForCell(worldSeed, cellId);
  if (!gridSize) return undefined;
  const coord = parseCoordinateLocationId(currentLocationId);
  if (!coord) return undefined;
  const tile = getTownTilesForGrid(worldSeed, gridSize.cols, gridSize.rows).find(
    (t) => t.x === coord.x && t.y === coord.y,
  );
  return tile ? tile.burgId : undefined;
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
