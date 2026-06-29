// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 09/06/2026, 02:48:37
 * Dependents: None (Orphan)
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/state/reducers/navalReducer.ts
 * Reducer for managing naval state: ships, crew, and voyages.
 */
import { AppAction } from '../actionTypes';
import { GameState } from '../../types';
import type { WeatherState } from '../../types';
import type { VoyageState } from '../../types/naval';
import { VoyageManager } from '../../systems/naval/VoyageManager';
import { CrewManager } from '../../systems/naval/CrewManager';
import { createShip } from '../../utils/navalUtils';
import { SeededRandom } from '@/utils/random';

/**
 * Default price of the starter sloop offered from the naval dashboard's
 * "No Active Ship" state. A modest figure: out of reach for a fresh level-1
 * character (who starts with ~10 gp) but affordable after some adventuring,
 * so acquiring a ship is an earned milestone rather than a free handout.
 */
export const STARTER_SHIP_COST = 500;

const hashStringToSeed = (value: string): number => {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const navalReducer = (state: GameState, action: AppAction): GameState => {
  switch (action.type) {
    case 'NAVAL_INITIALIZE_FLEET': {
      // Create a starter ship if none exist
      if (state.naval.playerShips.length > 0) return state;

      const starterShip = createShip('The Drunken Seagull', 'Sloop');

      return {
        ...state,
        naval: {
          ...state.naval,
          playerShips: [starterShip],
          activeShipId: starterShip.id,
        },
      };
    }

    case 'NAVAL_PURCHASE_STARTER_SHIP': {
      // The player's in-game entry point for acquiring their first ship.
      // No-op if they already own one (a fleet has been started) or can't
      // afford the cost — the dashboard disables the button in those cases,
      // but the reducer stays authoritative.
      if (state.naval.playerShips.length > 0) return state;

      const cost = action.payload?.cost ?? STARTER_SHIP_COST;
      if (state.gold < cost) return state;

      const ship = createShip(
        action.payload?.name ?? 'The Drunken Seagull',
        action.payload?.type ?? 'Sloop',
      );

      return {
        ...state,
        gold: state.gold - cost,
        naval: {
          ...state.naval,
          playerShips: [ship],
          activeShipId: ship.id,
        },
      };
    }

    case 'NAVAL_START_VOYAGE': {
      const shipId = state.naval.activeShipId;
      if (!shipId) return state;

      const { destinationId, distance } = action.payload;
      const ship = state.naval.playerShips.find(s => s.id === shipId);
      if (!ship) return state;

      // Bridge: persist the destination port burg id on the voyage so arrival
      // can dock the ship at the correct FMG burg (decision #10).
      const newVoyage: VoyageState = { ...VoyageManager.startVoyage(ship, distance), destinationId };

      return {
        ...state,
        naval: {
          ...state.naval,
          currentVoyage: newVoyage,
        },
      };
    }

    case 'NAVAL_ADVANCE_VOYAGE': {
      if (!state.naval.currentVoyage) return state;

      const ship = state.naval.playerShips.find(s => s.id === state.naval.currentVoyage!.shipId);
      if (!ship) return state;

      // Calculate logic for a day at sea
      const currentWeather: WeatherState = state.environment ?? {
        precipitation: 'none',
        temperature: 'temperate',
        wind: { direction: 'variable', speed: 'calm' },
        visibility: 'clear',
      };
      const voyageShipIndex = state.naval.playerShips.findIndex(s => s.id === ship.id);
      const voyageSeed = hashStringToSeed([
        state.worldSeed,
        voyageShipIndex,
        ship.name,
        ship.type,
        state.naval.currentVoyage.daysAtSea + 1,
        state.naval.currentVoyage.distanceTraveled,
        state.naval.currentVoyage.distanceToDestination,
        currentWeather.precipitation,
        currentWeather.wind.direction,
        currentWeather.wind.speed,
        currentWeather.visibility
      ].join('|'));
      const { newState: updatedVoyage, updatedShip } = VoyageManager.advanceDay(
        state.naval.currentVoyage,
        ship,
        currentWeather,
        state.gold,
        new SeededRandom(voyageSeed)
      );

      // Check for arrival
      let arrivedShip = updatedShip;
      if (updatedVoyage.distanceTraveled >= updatedVoyage.distanceToDestination) {
         updatedVoyage.status = 'Docked';
         updatedVoyage.log.push({
             day: updatedVoyage.daysAtSea,
             event: 'Arrived at destination!',
             type: 'Info'
         });

         // Bridge (decision #10): dock the active ship at the arrival port burg.
         // FMG burg ids are positive integers (from 1). Reject undefined/null/''
         // (Number('') === 0) and any non-positive or non-integer value.
         const burgId = Number(updatedVoyage.destinationId);
         if (Number.isInteger(burgId) && burgId > 0) {
           arrivedShip = { ...arrivedShip, dockedPortBurgId: burgId };
         }
      }

      return {
        ...state,
        naval: {
          ...state.naval,
          currentVoyage: updatedVoyage,
          playerShips: state.naval.playerShips.map(s => s.id === arrivedShip.id ? arrivedShip : s)
        },
      };
    }

    case 'NAVAL_RECRUIT_CREW': {
        const { role } = action.payload;
        const shipId = state.naval.activeShipId;
        if (!shipId) return state;

        const shipIndex = state.naval.playerShips.findIndex(s => s.id === shipId);
        if (shipIndex === -1) return state;

        const updatedShips = [...state.naval.playerShips];
        const recruitSeed = hashStringToSeed([
          state.worldSeed,
          shipIndex,
          updatedShips[shipIndex].name,
          updatedShips[shipIndex].type,
          role,
          updatedShips[shipIndex].crew.members.length
        ].join('|'));
        const newCrewMember = CrewManager.generateCrewMember(role, 1, new SeededRandom(recruitSeed));

        // Deduct gold (simplified - should be in payload or checked)
        // For now, assuming payment happens elsewhere or is free for starter

        updatedShips[shipIndex] = {
            ...updatedShips[shipIndex],
            crew: {
                ...updatedShips[shipIndex].crew,
                members: [...updatedShips[shipIndex].crew.members, newCrewMember]
            }
        };

        return {
            ...state,
            naval: {
                ...state.naval,
                playerShips: updatedShips
            }
        };
    }

    case 'NAVAL_SET_ACTIVE_SHIP': {
        return {
            ...state,
            naval: {
                ...state.naval,
                activeShipId: action.payload.shipId
            }
        };
    }

    case 'NAVAL_SET_KNOWN_PORTS': {
      return {
        ...state,
        naval: {
          ...state.naval,
          knownPorts: action.payload.ports,
        },
      };
    }

    case 'NAVAL_CLEAR_VOYAGE': {
      return {
        ...state,
        naval: {
          ...state.naval,
          currentVoyage: null,
        },
      };
    }

    default:
      return state;
  }
};
