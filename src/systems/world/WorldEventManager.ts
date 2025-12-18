/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/world/WorldEventManager.ts
 * Manages daily world simulation events.
 */

import { GameState, GameMessage, WorldRumor } from '../../types';
import { applyReputationChange } from '../../utils/factionUtils';
import { getGameDay, addGameTime } from '../../utils/timeUtils';
import { SeededRandom } from '../../utils/seededRandom';

export type WorldEventType = 'FACTION_SKIRMISH' | 'MARKET_SHIFT' | 'RUMOR_SPREAD';

export interface WorldEventResult {
  state: GameState;
  logs: GameMessage[];
}

// Probability of an event occurring per day (0.0 to 1.0)
const DAILY_EVENT_CHANCE = 0.2; // Increased from 0.1 for more liveliness

/**
 * Handles Faction Skirmish events.
 * Two factions fight. Winner gains power, Loser loses power.
 */
const handleFactionSkirmish = (state: GameState, rng: SeededRandom): WorldEventResult => {
  const factionIds = Object.keys(state.factions);
  if (factionIds.length < 2) return { state, logs: [] };

  // Pick two random factions
  const factionAId = factionIds[Math.floor(rng.next() * factionIds.length)];
  let factionBId = factionIds[Math.floor(rng.next() * factionIds.length)];

  // Ensure they are different
  while (factionBId === factionAId) {
    factionBId = factionIds[Math.floor(rng.next() * factionIds.length)];
  }

  const factionA = state.factions[factionAId];
  const factionB = state.factions[factionBId];

  // Decide winner based on power (plus randomness)
  const powerA = (factionA.power || 50) + (rng.next() * 40 - 20);
  const powerB = (factionB.power || 50) + (rng.next() * 40 - 20);

  const winnerId = powerA > powerB ? factionAId : factionBId;
  const loserId = winnerId === factionAId ? factionBId : factionAId;

  const winner = state.factions[winnerId];
  const loser = state.factions[loserId];

  // Generate logs
  const logs: GameMessage[] = [];
  const timestamp = state.gameTime || new Date();
  const gameDay = getGameDay(timestamp);

  const text = `Rumors arrive: Skirmish between ${factionA.name} and ${factionB.name}. ${winner.name} claimed victory.`;

  logs.push({
    id: Date.now() + rng.next(),
    text,
    sender: 'system',
    timestamp: timestamp
  });

  // Create persistent rumor
  const rumor: WorldRumor = {
      id: `skirmish-${gameDay}-${rng.next().toString(36).substr(2, 5)}`,
      text,
      sourceFactionId: winnerId,
      targetFactionId: loserId,
      type: 'skirmish',
      timestamp: gameDay,
      expiration: gameDay + 7, // Lasts a week
  };

  // Update State
  let newState = { ...state };

  // Update Faction Power
  const powerChange = 2 + Math.floor(rng.next() * 3); // 2-4 power swing

  newState.factions = {
      ...newState.factions,
      [winnerId]: { ...winner, power: Math.min(100, (winner.power || 50) + powerChange) },
      [loserId]: { ...loser, power: Math.max(0, (loser.power || 50) - powerChange) }
  };

  // Add rumor
  newState.activeRumors = [...(newState.activeRumors || []), rumor];

  // Apply reputation ripple
  const winnerStanding = state.playerFactionStandings[winnerId]?.publicStanding || 0;

  if (winnerStanding > 20) { // If player is friendly with winner
     const penalty = -5;
     const reason = `your association with their rival, ${winner.name}`;
     const result = applyReputationChange(newState, loserId, penalty, reason);
     newState = { ...newState, playerFactionStandings: result.standings };

     // Also update identity state if alias standings changed
     if (result.identityState) {
         newState = { ...newState, identity: result.identityState };
     }

     logs.push(...result.logs);
  }

  return { state: newState, logs };
};

/**
 * Handles Market Shift events.
 * Adds flavor text about economic changes.
 */
const handleMarketShift = (state: GameState, rng: SeededRandom): WorldEventResult => {
    const events = [
        "A surplus of iron from the mines has lowered weapon prices.",
        "Drought in the farmlands has driven up food costs.",
        "A sunken merchant ship has made silk a rare luxury.",
        "A new trade route has opened, flooding the market with exotic spices."
    ];

    const text = events[Math.floor(rng.next() * events.length)];
    const timestamp = state.gameTime || new Date();
    const gameDay = getGameDay(timestamp);

    const logs: GameMessage[] = [{
        id: Date.now() + rng.next(),
        text: `Market News: ${text}`,
        sender: 'system',
        timestamp: timestamp
    }];

    const rumor: WorldRumor = {
        id: `market-${gameDay}-${rng.next().toString(36).substr(2, 5)}`,
        text,
        type: 'market',
        timestamp: gameDay,
        expiration: gameDay + 5
    };

    return {
        state: {
            ...state,
            activeRumors: [...(state.activeRumors || []), rumor]
        },
        logs
    };
};

/**
 * Handles general Rumor Spreading (flavor).
 */
const handleRumorSpread = (state: GameState, rng: SeededRandom): WorldEventResult => {
     const rumors = [
        "Travelers speak of strange lights in the northern sky.",
        "A wandering bard claims to have seen a dragon near the peaks.",
        "Whispers say the King is ill.",
        "A dark cult has been gathering in the sewers."
    ];

    const text = rumors[Math.floor(rng.next() * rumors.length)];
    const timestamp = state.gameTime || new Date();
    const gameDay = getGameDay(timestamp);

    const logs: GameMessage[] = [{
        id: Date.now() + rng.next(),
        text: `Gossip: ${text}`,
        sender: 'system',
        timestamp: timestamp
    }];

    const rumor: WorldRumor = {
        id: `gossip-${gameDay}-${rng.next().toString(36).substr(2, 5)}`,
        text,
        type: 'misc',
        timestamp: gameDay,
        expiration: gameDay + 10
    };

    return {
        state: {
            ...state,
            activeRumors: [...(state.activeRumors || []), rumor]
        },
        logs
    };
};

/**
 * Main entry point for processing daily world events.
 */
export const processWorldEvents = (state: GameState, daysPassed: number): WorldEventResult => {
  if (daysPassed <= 0) {
      return { state, logs: [] };
  }

  const rng = new SeededRandom(state.worldSeed + getGameDay(state.gameTime));
  let currentState = state; // Start with reference, only clone on change
  let allLogs: GameMessage[] = [];

  // Clean up expired rumors
  const currentDay = getGameDay(state.gameTime);
  if (currentState.activeRumors) {
      const activeRumors = currentState.activeRumors.filter(r => r.expiration >= currentDay);
      if (activeRumors.length !== currentState.activeRumors.length) {
          currentState = { ...currentState, activeRumors };
      }
  } else {
      currentState = { ...currentState, activeRumors: [] };
  }

  // Iterate for each day passed
  for (let i = 0; i < daysPassed; i++) {
    if (rng.next() < DAILY_EVENT_CHANCE) {
      const roll = rng.next();
      let result: WorldEventResult;

      if (roll < 0.5) {
          result = handleFactionSkirmish(currentState, rng);
      } else if (roll < 0.8) {
          result = handleMarketShift(currentState, rng);
      } else {
          result = handleRumorSpread(currentState, rng);
      }

      // If the event actually did something (changed state or produced logs)
      if (result.logs.length > 0 || result.state !== currentState) {
          currentState = result.state;
          allLogs = [...allLogs, ...result.logs];
      }
    }
  }

  return { state: currentState, logs: allLogs };
};
