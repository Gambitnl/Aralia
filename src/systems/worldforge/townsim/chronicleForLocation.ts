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
import { getTownTilesForGrid } from '../bridge/legacySubmapBridge';
import { DAYS_PER_YEAR } from './constants';
import { summarizeChronicle } from './chronicle';
import type { TownSimRegistry } from './townSimRegistry';
import type { TownSimState } from './types';

export interface ChronicleForLocationInput {
  currentLocationId: string;
  worldSeed: number;
  gridSize?: { cols: number; rows: number };
  townSim: TownSimRegistry;
  gameTime: Date;
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
}): number | undefined {
  const { currentLocationId, worldSeed, gridSize } = input;
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
