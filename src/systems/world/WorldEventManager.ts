/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/world/WorldEventManager.ts
 * Manages daily world simulation events.
 */

import { GameState, GameMessage, GamePhase } from '../../types';
import { Faction } from '../../types/factions';
import { applyReputationChange } from '../../utils/factionUtils';
import { getGameDay, addGameTime } from '../../utils/timeUtils';
import { SeededRandom } from '../../utils/seededRandom';

export type WorldEventType = 'FACTION_SKIRMISH' | 'MARKET_SHIFT' | 'RUMOR_SPREAD';

export interface WorldEventResult {
  state: GameState;
  logs: GameMessage[];
}

// Probability of an event occurring per day (0.0 to 1.0)
const DAILY_EVENT_CHANCE = 0.1; // 10% chance per day

/**
 * Handles Faction Skirmish events.
 * Two factions fight. If the player is allied with one, they might lose standing with the other.
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

  // Decide winner (simple 50/50 for now)
  const winner = rng.next() > 0.5 ? factionA : factionB;
  const loser = winner === factionA ? factionB : factionA;

  // Generate logs
  const logs: GameMessage[] = [];
  const timestamp = state.gameTime || new Date();

  logs.push({
    id: Date.now() + rng.next(),
    text: `Rumors arrive: Skirmish between ${factionA.name} and ${factionB.name}. ${winner.name} claimed victory.`,
    sender: 'system',
    timestamp: timestamp
  });

  // Apply reputation ripple?
  // If player is allied with Winner, Loser dislikes player slightly more.
  // If player is allied with Loser, Winner dislikes player slightly more.

  let newState = { ...state };

  const winnerStanding = state.playerFactionStandings[winner.id]?.publicStanding || 0;

  if (winnerStanding > 20) { // If player is friendly with winner
     const penalty = -5;
     const reason = `your association with their rival, ${winner.name}`;
     const result = applyReputationChange(newState, loser.id, penalty, reason);
     newState = { ...newState, playerFactionStandings: result.standings };
     logs.push(...result.logs);
  }

  return { state: newState, logs };
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
  let hasChanged = false;

  // Iterate for each day passed
  for (let i = 0; i < daysPassed; i++) {
    if (rng.next() < DAILY_EVENT_CHANCE) {
      // Pick event type
      // For now, only FACTION_SKIRMISH is implemented
      const result = handleFactionSkirmish(currentState, rng);

      // If the event actually did something (changed state or produced logs)
      if (result.logs.length > 0 || result.state !== currentState) {
          currentState = result.state;
          allLogs = [...allLogs, ...result.logs];
          hasChanged = true;
      }
    }
  }

  return { state: currentState, logs: allLogs };
};
