// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/06/2026, 03:59:51
 * Dependents: state/appState.ts
 * Imports: 17 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/state/reducers/worldReducer.ts
 * A slice reducer that handles world-related state changes.
 */
import { GameState } from '../../types';
import { withLegacyWeatherBridge } from '../../types/environment';
import { AppAction } from '../actionTypes';
import { LOCATIONS } from '../../data/world/locations';
import { getTimeOfDay, getGameDay } from '../../utils/core';
import { groundPosToLocaleFeet } from '../../systems/worldforge/local/localePosition';
import { biomeIdForCell } from '../../systems/worldforge/local/biomeForCell';
import { nearBurgIdsForCell } from '../../systems/worldforge/local/burgProximity';
import { advanceRegistry } from '../../systems/worldforge/townsim/townSimRegistry';
import { buildTownSimStateForBurg } from '../../systems/worldforge/townsim/townSimRegistration';
import { getTownTilesForGrid } from '../../systems/worldforge/bridge/legacySubmapBridge';
import { parseCoordinateLocationId } from '../../utils/locationUtils';
import { processWorldEvents } from '../../systems/world/WorldEventManager';
import { UnderdarkMechanics } from '../../systems/underdark/UnderdarkMechanics';
import { DEFAULT_WEATHER } from '../../systems/environment/EnvironmentSystem';
import { updateWeather } from '../../systems/environment/WeatherSystem';
import { ritualReducer } from './ritualReducer';
import { addHistoryEvent, createEmptyHistory } from '../../utils/historyUtils';
import { processAllStrongholds, strongholdSummariesToMessages } from '../../services/strongholdService';
import { processAllBusinesses } from '../../systems/economy/BusinessSimulation';
import { processAllInvestments } from '../../systems/economy/InvestmentManager';
import { processAllNpcBusinesses } from '../../systems/economy/NpcBusinessManager';
import { processPlayerBusinessManagement } from '../../systems/economy/BusinessManagement';
import { SeededRandom } from '@/utils/random';

/** Distance-LOD: tracked towns within this many tiles of the player tick daily;
 * farther towns catch up on approach (identical result, deferred work). */
const NEAR_SIM_RADIUS = 24;
/** Cell-native LOD radius in atlas GRAPH units (≈ NEAR_SIM_RADIUS grid tiles on the
 *  960-wide atlas). Perf-only; covers the player's town neighbourhood. */
const NEAR_SIM_GRAPH_RADIUS = 720;

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const MILLIS_PER_HOUR = 60 * 60 * 1000;
const MILLIS_PER_MINUTE = 60 * 1000;

type SetMapDataPayload = Extract<AppAction, { type: 'SET_MAP_DATA' }>['payload'];
type UpdateInspectedTileDescriptionPayload = Extract<AppAction, { type: 'UPDATE_INSPECTED_TILE_DESCRIPTION' }>['payload'];

const resolveMinimapFocus = (
  mapData: SetMapDataPayload,
  currentFocus: GameState['minimapFocus']
): GameState['minimapFocus'] => {
  // The typed map contract exposes gridSize, not the old width/height placeholder.
  // Keeping this helper local avoids turning G5 into a broader reducer refactor.
  if (!mapData) {
    return currentFocus;
  }

  return {
    x: Math.floor(mapData.gridSize.cols / 2),
    y: Math.floor(mapData.gridSize.rows / 2),
  };
};

const hashStringToSeed = (value: string): number => {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const parseShelfLifeMillis = (shelfLife?: string): number | null => {
  if (!shelfLife) return null;

  const match = /^(\d+(?:\.\d+)?)\s*(minute|minutes|hour|hours|day|days)$/i.exec(shelfLife.trim());
  if (!match) return null;

  const quantity = Number(match[1]);
  const unit = match[2].toLowerCase();

  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (unit.startsWith('minute')) return quantity * MILLIS_PER_MINUTE;
  if (unit.startsWith('hour')) return quantity * MILLIS_PER_HOUR;
  if (unit.startsWith('day')) return quantity * MILLIS_PER_DAY;

  return null;
};

const removeExpiredPerishableInventory = (
  inventory: GameState['inventory'],
  currentTime: Date
): GameState['inventory'] => {
  const currentTimeMs = currentTime.getTime();

  return inventory.filter((item) => {
    if (!item.perishable) return true;

    const shelfLifeMillis = parseShelfLifeMillis(item.shelfLife);
    if (item.acquiredAt === undefined || shelfLifeMillis === null) return true;

    return item.acquiredAt + shelfLifeMillis > currentTimeMs;
  });
};

export const resolveBiomeId = (state: GameState): string => {
    const staticLocation = LOCATIONS[state.currentLocationId];
    if (staticLocation?.biomeId) return staticLocation.biomeId;

    // Cell-native: the biome is the player's canonical atlas cell's biome.
    // (Stage 6: the legacy coord_X_Y → mapData.tiles grid lookup is removed.)
    if (state.playerCell?.cellId != null) {
      const cellBiome = biomeIdForCell(state.worldSeed, state.playerCell.cellId);
      if (cellBiome) return cellBiome;
    }
    return 'plains';
};

export function worldReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'SET_PLAYER_GROUND_POS': {
      // Ground mode reports camera anchors in tile-local meters. Store them in
      // their own field so atlas/world travel never consumes them as continent
      // meters from playerWorldPos.
      const nextPosition = action.payload.position;

      // Null is the explicit clear signal for stale ground anchors after leaving
      // or invalidating a tile-scoped ground view. The cell presence outlives a
      // transient ground-anchor clear, so playerCell is left untouched here.
      if (nextPosition === null) {
        return { playerGroundPos: null };
      }

      // GRID-RETIRE: BA-3 — Stage 3 makes `playerGroundPos` the single live
      // Locale movement state shared by the 3D ground view (which dispatches
      // this action as the camera walks) and the 2D Locale view (which dispatches
      // it on click-to-move). Mirror it into the canonical presence as continuous
      // Locale FEET so both views stay in sync through one reducer. The feet mirror
      // is a derived shadow of `playerGroundPos` (removed at Stage 6 when the cell
      // becomes the sole truth). No-op when no cell is recorded yet (honest
      // "unknown" — the mirror never invents a cell).
      const slice: Partial<GameState> = { playerGroundPos: { ...nextPosition } };
      if (state.playerCell) {
        slice.playerCell = {
          ...state.playerCell,
          localeCoords: groundPosToLocaleFeet(nextPosition),
        };
      }
      return slice;
    }

    case 'LOCALE_CROSS_TO_CELL': {
      // Stage 5 (seamless edges): walking off a Locale edge re-anchors the
      // canonical cell to the neighbour. Seat the player at the new Locale's entry
      // feet and DROP the old cell's ground anchor (null = honest "unknown until
      // the new cell's ground session reports a position", mirroring how the travel
      // arrival resets feet on a cell change). The cell is the live continuous mover
      // here; compass/grid stay untouched until Stage 6. No clock cost / encounter —
      // this is movement, not a travel commit.
      const { cellId, enterFeet } = action.payload;
      return {
        playerCell: { cellId, localeCoords: { x: enterFeet.x, y: enterFeet.y } },
        playerGroundPos: null,
      };
    }

    case 'REVEAL_HIDDEN_SITE': {
      // SP4 discovery: record a hidden place the player revealed by 3D proximity.
      // Deduped by id so re-entering its radius is idempotent and saves don't grow.
      const discovered = state.discoveredHiddenSites ?? [];
      if (discovered.some((s) => s.id === action.payload.id)) return {};
      return { discoveredHiddenSites: [...discovered, action.payload] };
    }

    case 'APPLY_WORLDFORGE_DELTA': {
      const currentDeltas = state.worldforgeDeltas ?? [];

      // Deltas can be replayed by load/generation bridges, so the id is treated
      // as the stable event key. Returning the same array for duplicates keeps
      // replay idempotent and avoids accidental save growth.
      if (currentDeltas.some(delta => delta.id === action.payload.delta.id)) {
        return { worldforgeDeltas: currentDeltas };
      }

      // Append instead of sorting so the saved log preserves the exact causal
      // order in which gameplay systems accepted the edits.
      return {
        worldforgeDeltas: [...currentDeltas, action.payload.delta],
      };
    }

    case 'SET_MAP_DATA': {
      const mapDataPayload: SetMapDataPayload = action.payload;
      const minimapFocus = resolveMinimapFocus(mapDataPayload, state.minimapFocus);
      return { mapData: mapDataPayload, minimapFocus };
    }

    case 'UPDATE_INSPECTED_TILE_DESCRIPTION': {
      const tilePayload: UpdateInspectedTileDescriptionPayload = action.payload;
      return {
        inspectedTileDescriptions: {
          ...state.inspectedTileDescriptions,
          [tilePayload.tileKey]: tilePayload.description,
        },
      };
    }

    case 'SET_LAST_NPC_INTERACTION':
      return {
        lastInteractedNpcId: (action.payload as { npcId: string | null }).npcId,
        lastNpcResponse: (action.payload as { response: string | null }).response,
      };

    case 'RESET_NPC_INTERACTION_CONTEXT':
      return {
        lastInteractedNpcId: null,
        lastNpcResponse: null,
      };

    case 'SET_GEMINI_ACTIONS':
      return { geminiGeneratedActions: action.payload as GameState['geminiGeneratedActions'] };

    case 'TOWNSIM_REGISTER_BURG': {
      // Plan D: the player has entered a town — start (or keep) tracking its
      // living-world history. Idempotent: a town is built once, then advanced by
      // the ADVANCE_TIME daily loop. Its history begins at the current game day.
      const { burgId } = action.payload;
      const registry = state.townSim ?? {}; // legacy saves may lack townSim
      if (registry[burgId]) return {};
      const currentDay = getGameDay(state.gameTime);
      const townState = buildTownSimStateForBurg(state.worldSeed, burgId, currentDay);
      return { townSim: { ...registry, [burgId]: townState } };
    }

    case 'ADVANCE_TIME': {
      // RALPH: The Chronos Loop.
      // Advancing time isn't just updating a clock; it triggers a chain reaction:
      // 1. Ritual Progression: Some spells tick down per second.
      // 2. Underdark Survival: Sanity/Light levels decay.
      // 3. World Events: If a day passes, Factions gain power and Trade Routes fluctuate.
      const oldTime = state.gameTime;
      const newTime = new Date(oldTime.getTime());
      newTime.setSeconds(newTime.getSeconds() + action.payload.seconds);

      // Normalize rest tracking in case older states omitted the tracker.
      const currentRestTracker = state.shortRestTracker ?? {
        restsTakenToday: 0,
        lastRestDay: getGameDay(oldTime),
        lastRestEndedAtMs: null,
      };

      // Check if a day has passed
      const oldDay = getGameDay(oldTime);
      const newDay = getGameDay(newTime);
      const daysPassed = newDay - oldDay;

      // RALPH: Pipeline Logic.
      // We start with a base update (the time itself) and then pass it through sub-handlers.
      let nextState: GameState = { ...state, gameTime: newTime };

      // 1. Ritual Advancement
      // We apply the ritualReducer directly to our accumulating nextState.
      nextState = { ...nextState, ...ritualReducer(nextState, action) };

      // 2. Underdark Mechanics
      // Processes light decay and sanity.
      const { underdark: newUnderdark, messages: underdarkMessages } = UnderdarkMechanics.processTime(nextState, action.payload.seconds);
      nextState = { 
        ...nextState, 
        underdark: newUnderdark,
        messages: [...nextState.messages, ...underdarkMessages]
      };

      if (daysPassed > 0) {
        // 3. Daily Environment Simulation
        const biomeId = resolveBiomeId(nextState);
        let nextWeather = nextState.environment || DEFAULT_WEATHER;

        for (let dayOffset = 0; dayOffset < daysPassed; dayOffset++) {
          const dayProgressTime = new Date(newTime.getTime() - ((daysPassed - dayOffset - 1) * MILLIS_PER_DAY));
          const weatherSeed = hashStringToSeed([
            nextState.worldSeed,
            biomeId,
            dayProgressTime.toISOString(),
            nextWeather.precipitation,
            nextWeather.temperature,
            nextWeather.wind.direction,
            nextWeather.wind.speed
          ].join('|'));
          nextWeather = updateWeather(nextWeather, biomeId, getTimeOfDay(dayProgressTime), new SeededRandom(weatherSeed));
        }

        nextState = {
          ...nextState,
          // Reattach the legacy label bridge so older narrative consumers keep
          // seeing a string while the reducer still owns the canonical weather state.
          environment: withLegacyWeatherBridge(nextWeather)
        };

        // 4. Daily World Simulation
        // Reset daily short rest counts when the in-game day ticks over.
        if (newDay !== currentRestTracker.lastRestDay) {
          nextState = {
            ...nextState,
            shortRestTracker: {
                ...currentRestTracker,
                restsTakenToday: 0,
                lastRestDay: newDay,
            }
          };
        }
        
        const { state: simulatedWorldState, logs: worldLogs } = processWorldEvents(nextState, daysPassed);

        // Preserve the full daily simulation result so economy, rumors, history,
        // couriers, and other world-owned fields survive the reducer boundary.
        // Messages are appended separately because this reducer already owns the
        // time-step log stream.
        nextState = {
          ...nextState,
          ...simulatedWorldState,
          messages: [...nextState.messages, ...worldLogs]
        };

        // 4b. Living-world town sim: advance tracked towns' multi-day history up
        // to the new day. Distance-LOD: only towns within NEAR_SIM_RADIUS tiles
        // of the player tick each day; far towns catch up identically when the
        // player next comes near (per-day re-seeding makes batch == daily). When
        // the player isn't on a world tile, advance all (conservative, correct).
        // No-op until a town is first tracked.
        if (nextState.townSim && Object.keys(nextState.townSim).length > 0) {
          let nearBurgIds: number[] | undefined;
          // GRID-RETIRE: BA-2 — distance-LOD by the canonical cell (graph units),
          // not the coarse coord_X_Y grid tile. The grid path below is the legacy
          // fallback for cell-less old saves, until Stage 6. (Perf-only: which
          // towns tick early never changes game state.)
          if (nextState.playerCell?.cellId != null) {
            nearBurgIds = nearBurgIdsForCell(nextState.worldSeed, nextState.playerCell.cellId, NEAR_SIM_GRAPH_RADIUS);
          } else {
            const here = parseCoordinateLocationId(nextState.currentLocationId);
            if (here && nextState.mapData) {
              const { cols, rows } = nextState.mapData.gridSize;
              nearBurgIds = getTownTilesForGrid(nextState.worldSeed, cols, rows)
                .filter((t) => Math.abs(t.x - here.x) + Math.abs(t.y - here.y) <= NEAR_SIM_RADIUS)
                .map((t) => t.burgId);
            }
          }
          nextState = {
            ...nextState,
            townSim: advanceRegistry(nextState.townSim, nextState.worldSeed, newDay, nearBurgIds),
          };
        }

        // 5. Stronghold Daily Processing
        if (nextState.strongholds && Object.keys(nextState.strongholds).length > 0) {
          const { updatedStrongholds, summaries } = processAllStrongholds(nextState.strongholds);
          const strongholdMessages = strongholdSummariesToMessages(summaries, newTime);
          nextState = {
            ...nextState,
            strongholds: updatedStrongholds,
            messages: [...nextState.messages, ...strongholdMessages]
          };
        }

        // 6. Business Daily Processing
        const currentBusinesses = nextState.businesses;
        const currentStrongholds = nextState.strongholds;
        if (currentBusinesses && Object.keys(currentBusinesses).length > 0 && currentStrongholds) {
          const businessRng = new SeededRandom(state.worldSeed + newDay + 7777);
          let bizState = { businesses: currentBusinesses, strongholds: currentStrongholds };
          for (let d = 0; d < daysPassed; d++) {
            const bizResult = processAllBusinesses(
              bizState.businesses,
              bizState.strongholds,
              nextState.economy,
              nextState.factions,
              newDay - daysPassed + d + 1,
              businessRng
            );
            bizState = { businesses: bizResult.businesses, strongholds: bizResult.strongholds };
          }
          nextState = {
            ...nextState,
            businesses: bizState.businesses,
            strongholds: bizState.strongholds
          };
        }

        // 6b. NPC World Business Daily Processing
        // Simulates NPC-owned businesses: revenue, costs, price adjustments, financial pressure.
        // Bankrupt businesses (pressure > 90 for 30+ unprofitable days) are removed and their
        // NPC owner's businessId is cleared so they can be re-generated as merchants without shops.
        //
        // ECON-WIRE-1 (SPEC §8): Town-claimed businesses (burgId/plotId set by World3DWrapper)
        // flow through this same loop because they are registered as ownerType === 'npc' with a
        // valid npcOwnerProfile. No parallel abstraction is needed — the existing daily sim is
        // the single consumer. See src/systems/worldforge/bridge/townEconomy.ts for helpers and
        // src/systems/worldforge/bridge/__tests__/townEconomy.test.ts for regression coverage.
        const currentWorldBusinesses = nextState.worldBusinesses;
        if (currentWorldBusinesses && Object.keys(currentWorldBusinesses).length > 0) {
          const npcBizRng = new SeededRandom(state.worldSeed + newDay + 8888);
          let wbState = currentWorldBusinesses;
          for (let d = 0; d < daysPassed; d++) {
            const wbResult = processAllNpcBusinesses(
              wbState,
              nextState.economy,
              nextState.factions,
              newDay - daysPassed + d + 1,
              npcBizRng
            );
            wbState = wbResult.worldBusinesses;
            // Clear businessId on NPCs whose businesses closed
            if (wbResult.closedBusinessIds.length > 0) {
              const updatedNpcs = { ...nextState.generatedNpcs };
              for (const closedId of wbResult.closedBusinessIds) {
                for (const [npcKey, npc] of Object.entries(updatedNpcs)) {
                  if (npc.businessId === closedId) {
                    updatedNpcs[npcKey] = { ...npc, businessId: undefined };
                  }
                }
              }
              nextState = { ...nextState, generatedNpcs: updatedNpcs };
            }
          }
          nextState = { ...nextState, worldBusinesses: wbState };
        }

        // 6c. Player-owned World Business Management (decay, events, ramp-up)
        // Processes management decay (reputation/satisfaction loss without visits or a manager),
        // random business events (theft, festivals, competitor changes), and customer ramp-up
        // caps for newly founded businesses. Events generate courier messages for the player.
        const wbAfterNpc = nextState.worldBusinesses;
        if (wbAfterNpc && Object.values(wbAfterNpc).some(b => b.ownerType === 'player')) {
          const mgmtRng = new SeededRandom(state.worldSeed + newDay + 6666);
          let mgmtWb = wbAfterNpc;
          for (let d = 0; d < daysPassed; d++) {
            const mgmtResult = processPlayerBusinessManagement(
              mgmtWb,
              nextState.economy,
              newDay - daysPassed + d + 1,
              mgmtRng
            );
            mgmtWb = mgmtResult.worldBusinesses;
            // Convert events to courier messages
            for (const evt of mgmtResult.events) {
              const urgency = evt.type === 'negative' ? 0 : 1; // Negative events = immediate
              const courier = {
                id: `courier_evt_${evt.id}`,
                sourceRegionId: nextState.currentLocationId || 'unknown',
                deliveryDay: newDay + urgency,
                messageText: `[${evt.name}] ${evt.description}`,
                accuracy: 1,
                type: 'business_report' as const,
              };
              nextState = {
                ...nextState,
                pendingCouriers: [...(nextState.pendingCouriers || []), courier]
              };
            }
          }
          nextState = { ...nextState, worldBusinesses: mgmtWb };
        }

        // 7. Investment Daily Processing (Caravans, Loans, Speculation)
        const currentInvestments = nextState.playerInvestments;
        if (currentInvestments && currentInvestments.length > 0) {
          const investRng = new SeededRandom(state.worldSeed + newDay + 9999);
          let investState = currentInvestments;
          for (let d = 0; d < daysPassed; d++) {
            const investResult = processAllInvestments(
              investState,
              nextState.economy,
              newDay - daysPassed + d + 1,
              investRng
            );
            investState = investResult.investments;
            for (const logText of investResult.logs) {
              nextState = {
                ...nextState,
                messages: [...nextState.messages, {
                  id: Date.now() + investRng.next(),
                  text: logText,
                  sender: 'system',
                  timestamp: newTime
                }]
              };
            }
          }
          nextState = { ...nextState, playerInvestments: investState };
        }
      }

      // Spell-created food uses the same world clock as travel, rests, and
      // exploration. Keep the cleanup here so Goodberry-style perishables expire
      // from durable inventory without adding a parallel spell-specific timer.
      nextState = {
        ...nextState,
        inventory: removeExpiredPerishableInventory(nextState.inventory, newTime),
      };

      // Return ONLY the fields that changed to satisfy the slice reducer contract
      // Actually, since we produced a full state, we could return it all, 
      // but Partial<GameState> is expected.
      return nextState;
    }

    case 'SHORT_REST': {
      const restPayload = action.payload as { shortRestTracker?: GameState['shortRestTracker'] } | undefined;
      // Update party-level rest pacing if the handler supplied it.
      return restPayload?.shortRestTracker
        ? { shortRestTracker: restPayload.shortRestTracker }
        : {};
    }

    case 'ADD_MET_NPC': {
      const { npcId } = action.payload;
      if (state.metNpcIds.includes(npcId)) {
        return {}; // Already met, no state change
      }
      return {
        metNpcIds: [...state.metNpcIds, npcId],
      };
    }

    case 'ADD_LOCATION_RESIDUE': {
      const { locationId, residue } = action.payload;
      return {
        locationResidues: {
          ...state.locationResidues,
          [locationId]: residue,
        },
      };
    }

    case 'REMOVE_LOCATION_RESIDUE': {
      const { locationId } = action.payload;
      const newResidues = { ...state.locationResidues };
      delete newResidues[locationId];
      return {
        locationResidues: newResidues,
      };
    }

    case 'REGISTER_DYNAMIC_ENTITY': {
      // Discriminated union handling without ts-ignore
      if (action.payload.entityType === 'location') {
        return {
          dynamicLocations: {
            ...state.dynamicLocations,
            [action.payload.entity.id]: action.payload.entity
          }
        };
      } else if (action.payload.entityType === 'faction') {
        return {
          factions: {
            ...state.factions,
            [action.payload.entity.id]: action.payload.entity
          }
        };
      } else if (action.payload.entityType === 'npc') {
        return {
          dynamicNPCs: {
            ...(state.dynamicNPCs || {}),
            [action.payload.entity.id]: action.payload.entity
          }
        };
      }
      return {};
    }

    case 'ADD_RUMORS': {
      // Append chronicle-sourced (or any) rumors, deduped BY ID so re-running the
      // living-world sync on the same town news never grows activeRumors. Stable
      // rumor ids make this idempotent across repeated dispatches.
      const existing = state.activeRumors ?? [];
      const existingIds = new Set(existing.map((r) => r.id));
      const newOnes = action.payload.rumors.filter((r) => !existingIds.has(r.id));
      if (newOnes.length === 0) return {};
      return { activeRumors: [...existing, ...newOnes] };
    }

    case 'ADD_WORLD_HISTORY_EVENT': {
      const currentHistory = state.worldHistory || createEmptyHistory();
      const updatedHistory = addHistoryEvent(currentHistory, action.payload.event);
      return {
        worldHistory: updatedHistory
      };
    }

    default:
      return {};
  }
}
