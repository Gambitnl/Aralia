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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 29/10/2026, 00:28:48
 * Dependents: components/ActionPane/index.tsx, components/ActionPane/useActionGeneration.ts, components/Town/Broadsheet.tsx, components/Town/Intrigue/RumorMill.tsx, components/Town/NoticeBoard.tsx, components/debug/TownHistoryDevOverlay.tsx, hooks/actions/actionHandlers.ts, hooks/actions/handleMerchantInteraction.ts, hooks/actions/handleNpcInteraction.ts, hooks/actions/handleWorldEvents.ts, hooks/app/useAppAtlasEntry.ts, hooks/useChronicleRumorsSync.ts, hooks/useConversation.ts, hooks/useDungeonRumorsSync.ts, hooks/useGameActions.ts, hooks/useOverheardGossip.ts, hooks/useTownCrierAnnouncements.ts, hooks/useTownMerchantRegistration.ts, hooks/useTownSimRegistration.ts, state/reducers/townReducer.ts, systems/worldforge/townsim/npcsForCell.ts
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { getGameDay } from '../../../utils/core';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../bridge/legacySubmapBridge';
import { entry3DAnchorForCell } from '../local/gridAtlasBridge';
import { FEET_PER_FMG_PIXEL } from '../adapter/atlasArtifact';
import { feetFromMeters } from '../units';
import { POPULATION_RATE, townEnvelopeHalfFtForPeople } from '../town/townScale';
import type { GameState } from '../../../types/state';

/** Accepted ground coordinates refine player presence; simulation may still address a whole cell. */
export type TownGroundContext = Pick<GameState, 'playerGroundPos' | 'atlasGroundAddress' | 'entry3DAnchor'>;
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
  ground?: TownGroundContext;
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
  ground?: TownGroundContext;
}): number | undefined {
  if (input.cellId == null) return undefined;
  const burgId = burgIdForCell(input.worldSeed, input.cellId);
  if (burgId === undefined || !input.ground) return burgId;
  const { playerGroundPos: body, atlasGroundAddress: address, entry3DAnchor } = input.ground;
  // Old map-only journeys have no ground coordinates. Their cell-level town
  // interaction stays available until an actual ground position is established.
  if (!body && !address) return burgId;
  if (!body || body.tileX !== input.cellId || body.tileY !== 0 ||
      !Number.isFinite(body.xM) || !Number.isFinite(body.zM) ||
      (address && (address.worldSeed !== input.worldSeed || address.atlasCellId !== input.cellId))) return undefined;
  const atlas = getBridgeAtlas(input.worldSeed);
  const bounds = address?.localBounds ?? getWorldforgeLocalForCell(input.worldSeed, input.cellId, {
    centerPx: entry3DAnchor?.centerPx ?? entry3DAnchorForCell(atlas, input.cellId).centerPx,
  }).local.bounds;
  const x = feetFromMeters(body.xM), y = feetFromMeters(body.zM);
  if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return undefined;
  const burg = atlas.pack.burgs?.[burgId];
  if (!burg || burg.removed || !burg.i) return undefined;
  // Reuse Region's authored town envelope, including its working apron. A
  // town label or an overlapping Local window alone grants no town presence.
  const half = townEnvelopeHalfFtForPeople((burg.population ?? 10) * POPULATION_RATE);
  return Math.abs(bounds.x + x - burg.x * FEET_PER_FMG_PIXEL) <= half &&
    Math.abs(bounds.y + y - burg.y * FEET_PER_FMG_PIXEL) <= half ? burgId : undefined;
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
