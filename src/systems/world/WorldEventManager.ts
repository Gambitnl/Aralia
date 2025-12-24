/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/world/WorldEventManager.ts
 * Manages daily world simulation events.
 */

import { GameState, GameMessage, WorldRumor, MarketEvent, EconomyState } from '../../types';
import { modifyFactionRelationship } from '../../utils/factionUtils';
import { getGameDay, addGameTime } from '../../utils/timeUtils';
import { SeededRandom } from '../../utils/seededRandom';
import { processDailyRoutes } from '../economy/TradeRouteManager';
import { FactionManager } from './FactionManager';
import { generateNobleIntrigue } from './NobleIntrigueManager';
import { checkQuestDeadlines } from '../quests/QuestManager';

export type WorldEventType = 'FACTION_SKIRMISH' | 'MARKET_SHIFT' | 'RUMOR_SPREAD' | 'NOBLE_INTRIGUE';

export interface WorldEventResult {
  state: GameState;
  logs: GameMessage[];
}

// Probability of an event occurring per day (0.0 to 1.0)
const DAILY_EVENT_CHANCE = 0.2; // Increased from 0.1 for more liveliness

/**
 * Handles Faction Skirmish events.
 * Two factions fight. Winner gains power, Loser loses power.
 * Relationships ripple outward.
 */
const handleFactionSkirmish = (state: GameState, rng: SeededRandom): WorldEventResult => {
  // Check Weather Conditions
  // Armies do not march in blizzards or severe storms.
  const weather = state.weather;
  if (weather) {
      if (weather.precipitation === 'blizzard' || weather.precipitation === 'storm') {
          // 90% chance to cancel skirmish due to weather
          if (rng.next() < 0.9) {
              return { state, logs: [] };
          }
      }
      if (weather.wind.speed === 'gale') {
          // 50% chance to cancel
          if (rng.next() < 0.5) {
              return { state, logs: [] };
          }
      }
  }

  const factionIds = Object.keys(state.factions);
  if (factionIds.length < 2) return { state, logs: [] };

  // 1. SELECT AGGRESSOR
  const factionAId = factionIds[Math.floor(rng.next() * factionIds.length)];
  const factionA = state.factions[factionAId];

  // 2. SELECT VICTIM (Prefer enemies)
  let factionBId: string | null = null;

  // Create candidate list: [id, weight]
  const candidates: { id: string; weight: number }[] = [];

  factionIds.forEach(id => {
      if (id === factionAId) return;

      const relation = factionA.relationships[id] || 0;
      // Lower relation = Higher chance of attack
      // -100 relation -> weight 200
      // 0 relation -> weight 100
      // +100 relation -> weight 0
      let weight = 100 - relation;

      // Bonus weight if they are officially listed as enemies in static data
      if (factionA.enemies.includes(id)) weight += 50;

      // Bonus weight for opportunism (if target is weak)
      const target = state.factions[id];
      if (target.power < factionA.power) weight += 20;

      if (weight > 0) {
          candidates.push({ id, weight });
      }
  });

  // Weighted selection
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = rng.next() * totalWeight;

  for (const candidate of candidates) {
      if (roll < candidate.weight) {
          factionBId = candidate.id;
          break;
      }
      roll -= candidate.weight;
  }

  // Fallback if something went wrong
  if (!factionBId) {
      // Pick random
       do {
        factionBId = factionIds[Math.floor(rng.next() * factionIds.length)];
       } while (factionBId === factionAId);
  }

  const factionB = state.factions[factionBId];

  // 3. RESOLVE COMBAT
  // Decide winner based on power (plus randomness)
  const powerA = (factionA.power || 50) + (rng.next() * 40 - 20);
  const powerB = (factionB.power || 50) + (rng.next() * 40 - 20);

  const winnerId = powerA > powerB ? factionAId : factionBId!;
  const loserId = winnerId === factionAId ? factionBId! : factionAId;

  const winner = state.factions[winnerId];
  const loser = state.factions[loserId];

  // 4. GENERATE LOGS
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
      spreadDistance: 0,
      virality: 1.0 // High virality for war
  };

  // 5. UPDATE STATE
  let newState = { ...state };
  const newFactions = { ...newState.factions };

  // Update Faction Power
  const powerChange = 2 + Math.floor(rng.next() * 3); // 2-4 power swing

  newFactions[winnerId] = { ...winner, power: Math.min(100, (winner.power || 50) + powerChange) };
  newFactions[loserId] = { ...loser, power: Math.max(0, (loser.power || 50) - powerChange) };

  // Update Inter-Faction Relationships (Combatants)
  // Winner and Loser dislike each other more (-15)
  const updateRelation = (aId: string, bId: string, amount: number) => {
      const res1 = modifyFactionRelationship(newFactions, aId, bId, amount);
      if (res1) newFactions[aId] = res1.actor;

      const res2 = modifyFactionRelationship(newFactions, bId, aId, amount);
      if (res2) newFactions[bId] = res2.actor;
  };

  updateRelation(winnerId, loserId, -15);

  // Update Ripple Effects (Allies/Enemies)
  factionIds.forEach(otherId => {
      if (otherId === winnerId || otherId === loserId) return;

      const other = newFactions[otherId];
      // Check existing relationship with Winner
      const relWinner = other.relationships[winnerId] || 0;
      // Check existing relationship with Loser
      const relLoser = other.relationships[loserId] || 0;

      // If Friend of Winner: Likes Winner (+5), Dislikes Loser (-10)
      if (relWinner > 20) {
          updateRelation(otherId, winnerId, 5);
          updateRelation(otherId, loserId, -10);
      }

      // If Friend of Loser: Dislikes Winner (-15), Likes Loser (+5 sympathy)
      if (relLoser > 20) {
          updateRelation(otherId, winnerId, -15);
          updateRelation(otherId, loserId, 5);
      }

      // If Enemy of Winner: Likes Loser (+10 enemy of my enemy)
      if (relWinner < -20) {
           updateRelation(otherId, loserId, 10);
      }
  });

  newState.factions = newFactions;

  // Add rumor
  newState.activeRumors = [...(newState.activeRumors || []), rumor];

  // Apply Player Reputation ripple
  const winnerStanding = state.playerFactionStandings[winnerId]?.publicStanding || 0;

  if (winnerStanding > 20) { // If player is friendly with winner
     const penalty = -5;
     const reason = `your association with their rival, ${winner.name}`;
     // Use new FactionManager
     const result = FactionManager.applyReputationChange(newState, loserId, penalty, reason);
     newState = { ...newState, playerFactionStandings: result.standings };

     // Add new logs
     logs.push(...result.logs);

     // Add new rumors generated from this reputation change
     if (result.rumors.length > 0) {
         newState.activeRumors = [...(newState.activeRumors || []), ...result.rumors];
     }
  }

  return { state: newState, logs };
};

/**
 * Handles Market Shift events.
 * Adds flavor text and updates economy state.
 */
const handleMarketShift = (state: GameState, rng: SeededRandom): WorldEventResult => {
    // Define potential market events with actual gameplay effects
    // Structure: { weight: number, data: ... }
    const eventDefinitions = [
        {
            id: 'surplus_iron',
            baseWeight: 10,
            text: "A surplus of iron from the mines has lowered weapon prices.",
            event: {
                id: 'surplus_iron',
                name: 'Iron Surplus',
                description: 'Weapons and heavy armor are cheaper.',
                affectedTags: ['weapon', 'armor'],
                effect: 'surplus' as const,
                duration: 5
            }
        },
        {
            id: 'scarcity_food',
            baseWeight: 10,
            text: "Drought in the farmlands has driven up food costs.",
            event: {
                id: 'scarcity_food',
                name: 'Food Shortage',
                description: 'Food items are expensive.',
                affectedTags: ['consumable', 'food'],
                effect: 'scarcity' as const,
                duration: 7
            }
        },
        {
            id: 'scarcity_luxury',
            baseWeight: 5, // Rarer
            text: "A sunken merchant ship has made silk a rare luxury.",
            event: {
                id: 'scarcity_luxury',
                name: 'Silk Shortage',
                description: 'Luxury goods prices have spiked.',
                affectedTags: ['valuable', 'cloth'],
                effect: 'scarcity' as const,
                duration: 10
            }
        },
        {
            id: 'surplus_spices',
            baseWeight: 5,
            text: "A new trade route has opened, flooding the market with exotic spices.",
            event: {
                id: 'surplus_spices',
                name: 'Spice Influx',
                description: 'Exotic goods are cheaper.',
                affectedTags: ['valuable', 'spice'],
                effect: 'surplus' as const,
                duration: 5
            }
        },
        {
            id: 'surplus_food',
            baseWeight: 10,
            text: "A bountiful harvest has lowered food prices.",
            event: {
                id: 'surplus_food',
                name: 'Bountiful Harvest',
                description: 'Food is plentiful and cheap.',
                affectedTags: ['consumable', 'food'],
                effect: 'surplus' as const,
                duration: 7
            }
        }
    ];

    // Apply Weather Modifiers to Weights
    const weather = state.weather;
    const candidates = eventDefinitions.map(def => {
        let weight = def.baseWeight;

        if (weather) {
            // Drought / Extreme Heat -> High chance of Food Scarcity
            if (weather.temperature === 'extreme_heat' || weather.temperature === 'hot') {
                if (def.id === 'scarcity_food') weight += 50;
                if (def.id === 'surplus_food') weight = 0;
            }

            // Storms -> High chance of Sinkings (Luxury Scarcity)
            if (weather.precipitation === 'storm' || weather.precipitation === 'blizzard') {
                if (def.id === 'scarcity_luxury') weight += 40;
            }

            // Good Weather -> Better harvests
            if (weather.temperature === 'temperate' && weather.precipitation !== 'none' && weather.precipitation !== 'storm') {
                 if (def.id === 'surplus_food') weight += 20;
            }
        }

        return { ...def, weight };
    }).filter(c => c.weight > 0);

    // Weighted Random Selection
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let roll = rng.next() * totalWeight;
    let selection = candidates[0];

    for (const candidate of candidates) {
        if (roll < candidate.weight) {
            selection = candidate;
            break;
        }
        roll -= candidate.weight;
    }

    const timestamp = state.gameTime || new Date();
    const gameDay = getGameDay(timestamp);

    const logs: GameMessage[] = [{
        id: Date.now() + rng.next(),
        text: `Market News: ${selection.text}`,
        sender: 'system',
        timestamp: timestamp
    }];

    const rumor: WorldRumor = {
        id: `market-${gameDay}-${rng.next().toString(36).substr(2, 5)}`,
        text: selection.text,
        type: 'market',
        timestamp: gameDay,
        expiration: gameDay + selection.event.duration,
        spreadDistance: 0,
        virality: 0.8
    };

    // Update Economy State
    // 1. Add new event to activeEvents
    // 2. Re-calculate scarcity/surplus lists based on ALL active events
    const currentActiveEvents = state.economy.activeEvents || [];
    const newActiveEvents = [...currentActiveEvents, selection.event];

    const newScarcity = new Set<string>();
    const newSurplus = new Set<string>();

    newActiveEvents.forEach(e => {
        if (e.effect === 'scarcity') {
            e.affectedTags.forEach(tag => newScarcity.add(tag));
        } else {
            e.affectedTags.forEach(tag => newSurplus.add(tag));
        }
    });

    const newEconomy: EconomyState = {
        ...state.economy,
        activeEvents: newActiveEvents,
        marketFactors: {
            scarcity: Array.from(newScarcity),
            surplus: Array.from(newSurplus)
        }
    };

    return {
        state: {
            ...state,
            activeRumors: [...(state.activeRumors || []), rumor],
            economy: newEconomy
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
        expiration: gameDay + 10,
        spreadDistance: 0,
        virality: 0.5
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
 * Propagates rumors to new locations based on virality.
 * Simplified model: Rumors clone themselves with increased spreadDistance.
 * In a real graph, we'd check adjacent locations. Here, we simulate "word of mouth" traveling.
 */
const propagateRumors = (state: GameState, rng: SeededRandom): GameState => {
    if (!state.activeRumors || state.activeRumors.length === 0) return state;

    const newRumors = [...state.activeRumors];
    let changed = false;

    // Use a fixed iteration to avoid infinite spread in one tick if we append immediately
    const currentRumors = [...state.activeRumors];

    for (const rumor of currentRumors) {
        // Chance to spread decreases with distance
        // Distance 0: 100% of virality
        // Distance 1: 50% of virality
        const virality = rumor.virality ?? 0.5;
        const currentDistance = rumor.spreadDistance ?? 0;
        const spreadChance = virality * (1 / (currentDistance + 1));

        if (rng.next() < spreadChance) {
            // Create a "child" rumor representing spread
            // We assign a random mock location ID to simulate geographical spread
            // In a future graph system, this would be a real neighbor ID
            const newDistance = currentDistance + 1;

            if (newDistance < 3) {
                const spreadRumor: WorldRumor = {
                    ...rumor,
                    id: rumor.id + '_spread_' + Math.floor(rng.next() * 1000),
                    spreadDistance: newDistance,
                    virality: virality * 0.8, // Decay virality as it spreads
                    locationId: `region_dist_${newDistance}_${Math.floor(rng.next() * 10)}`
                };
                newRumors.push(spreadRumor);
                changed = true;
            }
        }
    }

    if (changed) {
        return { ...state, activeRumors: newRumors };
    }

    return state;
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

  // 0. Propagate Rumors (Daily Step)
  for (let i = 0; i < daysPassed; i++) {
     currentState = propagateRumors(currentState, rng);
  }

  // 1. Event Cleanup (Rumors & Economy)
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

  // Clean up expired market events
  if (currentState.economy && currentState.economy.activeEvents) {
     let eventsChanged = false;
     const newActiveEvents = currentState.economy.activeEvents
        .map(e => ({...e, duration: e.duration - 1}))
        .filter(e => e.duration > 0);

     if (newActiveEvents.length !== currentState.economy.activeEvents.length) {
         eventsChanged = true;
     }

     if (eventsChanged) {
        const newScarcity = new Set<string>();
        const newSurplus = new Set<string>();

        newActiveEvents.forEach(e => {
            if (e.effect === 'scarcity') {
                e.affectedTags.forEach(tag => newScarcity.add(tag));
            } else {
                e.affectedTags.forEach(tag => newSurplus.add(tag));
            }
        });

        currentState = {
            ...currentState,
            economy: {
                ...currentState.economy,
                activeEvents: newActiveEvents,
                marketFactors: {
                    scarcity: Array.from(newScarcity),
                    surplus: Array.from(newSurplus)
                }
            }
        };
     }
  }

  // 2. Process Trade Routes (Regenerate Route Events)
  // This comes AFTER cleanup so previous day's events are gone, and new ones are added.
  const routeResult = processDailyRoutes(currentState, daysPassed, rng);
  if (routeResult.logs.length > 0 || routeResult.state !== currentState) {
      currentState = routeResult.state;
      allLogs = [...allLogs, ...routeResult.logs];
  }

  // 3. Random Daily Events
  // Iterate for each day passed
  for (let i = 0; i < daysPassed; i++) {
    if (rng.next() < DAILY_EVENT_CHANCE) {
      const roll = rng.next();
      let result: WorldEventResult;

      if (roll < 0.4) {
          result = handleFactionSkirmish(currentState, rng);
      } else if (roll < 0.6) {
          result = generateNobleIntrigue(currentState, rng);
      } else if (roll < 0.85) {
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

  // 4. Check Quest Deadlines
  // Only check once per batch (at the end), or check after time advance.
  // Since time advanced before this function call usually, checking now is correct.
  const questResult = checkQuestDeadlines(currentState);
  if (questResult.state !== currentState || questResult.logs.length > 0) {
      currentState = questResult.state;
      allLogs = [...allLogs, ...questResult.logs];
  }

  return { state: currentState, logs: allLogs };
};
