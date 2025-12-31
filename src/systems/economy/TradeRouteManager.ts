/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/economy/TradeRouteManager.ts
 * Manages the simulation of trade routes and their impact on the global economy.
 */

import { GameState, GameMessage, TradeRoute, EconomyState, MarketEvent } from '../../types';
import { SeededRandom } from '../../utils/seededRandom';
// TODO(lint-intent): 'getGameDay' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { getGameDay as _getGameDay } from '../../utils/timeUtils';
import { INITIAL_TRADE_ROUTES } from '../../data/tradeRoutes';

export interface TradeRouteUpdateResult {
  state: GameState;
  logs: GameMessage[];
}

/**
 * Initializes trade routes if they don't exist in the state.
 */
export const initializeTradeRoutes = (state: GameState): EconomyState => {
  if (state.economy.tradeRoutes && state.economy.tradeRoutes.length > 0) {
    return state.economy;
  }

  return {
    ...state.economy,
    tradeRoutes: [...INITIAL_TRADE_ROUTES]
  };
};

/**
 * Simulates daily changes in trade routes.
 * - Routes can be disrupted by risks (bandits, weather).
 * - Routes can recover from disruption.
 * - Routes can enter a "booming" state.
 */
export const processDailyRoutes = (state: GameState, daysPassed: number, rng: SeededRandom): TradeRouteUpdateResult => {
  if (daysPassed <= 0) return { state, logs: [] };

  // Ensure routes are initialized
  let economy = state.economy;
  if (!economy.tradeRoutes || economy.tradeRoutes.length === 0) {
    economy = initializeTradeRoutes(state);
  }

  const logs: GameMessage[] = [];
  const currentRoutes = economy.tradeRoutes || [];
  const newRoutes: TradeRoute[] = [];
  const timestamp = state.gameTime || new Date();

  // Iterate through routes and simulate changes
  for (const route of currentRoutes) {
    let newStatus = route.status;
    let daysInStatus = route.daysInStatus + daysPassed;
    let statusChanged = false;

    // Simulate risk/recovery over the passed days
    // Instead of rolling once, we check probability for the whole period.
    // P(event) = 1 - (1 - daily_probability)^days

    // Recovery Chance Calculation
    // Base 20% + 5% per day waiting
    const dailyRecoveryBase = 0.2 + (route.daysInStatus * 0.05);
    // Capped at 90%
    const dailyRecovery = Math.min(0.9, dailyRecoveryBase);
    const recoveryChance = 1 - Math.pow(1 - dailyRecovery, daysPassed);

    // Block Chance Calculation
    // 10% of risk level per day
    const dailyRisk = route.riskLevel * 0.1;
    const blockChance = 1 - Math.pow(1 - dailyRisk, daysPassed);

    // Boom Chance Calculation
    // (Profitability * 0.05) per day
    const dailyBoom = route.profitability * 0.05;
    const boomChance = 1 - Math.pow(1 - dailyBoom, daysPassed);

    // Normalize Chance (Boom -> Active)
    const dailyNormalize = 0.3;
    const normalizeChance = 1 - Math.pow(1 - dailyNormalize, daysPassed);

    const roll = rng.next();

    if (route.status === 'active') {
      if (roll < blockChance) {
        newStatus = 'blocked';
        statusChanged = true;
        logs.push({
          id: Date.now() + Math.floor(rng.next() * 10000), // Ensure unique numeric ID
          text: `Trade News: ${route.name} has been blocked by hazards! ${route.goods.join(', ')} prices may rise.`,
          sender: 'system',
          timestamp
        });
      } else if (roll > 1.0 - boomChance) {
        newStatus = 'booming';
        statusChanged = true;
        logs.push({
            id: Date.now() + Math.floor(rng.next() * 10000),
            text: `Trade News: Trade is flourishing on ${route.name}. Expect cheap ${route.goods.join(', ')}.`,
            sender: 'system',
            timestamp
          });
      }
    } else if (route.status === 'blocked') {
      if (roll < recoveryChance) {
        newStatus = 'active';
        statusChanged = true;
        logs.push({
            id: Date.now() + Math.floor(rng.next() * 10000),
            text: `Trade News: ${route.name} is clear again. Trade resumes.`,
            sender: 'system',
            timestamp
          });
      }
    } else if (route.status === 'booming') {
      if (roll < normalizeChance) {
        newStatus = 'active';
        statusChanged = true;
      }
    }

    if (statusChanged) {
      daysInStatus = 0;
    }

    newRoutes.push({
      ...route,
      status: newStatus,
      daysInStatus
    });
  }

  // Generate Market Events from Routes
  const routeEventPrefix = 'route_event_';

  const activeEvents = (economy.activeEvents || []).filter(e => !e.id.startsWith(routeEventPrefix));
  const newEvents: MarketEvent[] = [...activeEvents];

  newRoutes.forEach(route => {
    if (route.status === 'blocked') {
      newEvents.push({
        id: `${routeEventPrefix}${route.id}_scarcity`,
        name: `${route.name} Blockade`,
        description: `Trade route blocked: ${route.name}`,
        affectedTags: route.goods,
        effect: 'scarcity',
        duration: 1 // Managed by the route system, refreshed daily
      });
    } else if (route.status === 'booming') {
      newEvents.push({
        id: `${routeEventPrefix}${route.id}_surplus`,
        name: `${route.name} Boom`,
        description: `High trade volume: ${route.name}`,
        affectedTags: route.goods,
        effect: 'surplus',
        duration: 1
      });
    }
  });

  // Rebuild Market Factors
  const newScarcity = new Set<string>();
  const newSurplus = new Set<string>();

  newEvents.forEach(e => {
      if (e.effect === 'scarcity') {
          e.affectedTags.forEach(tag => newScarcity.add(tag));
      } else {
          e.affectedTags.forEach(tag => newSurplus.add(tag));
      }
  });

  const newEconomy: EconomyState = {
    ...economy,
    tradeRoutes: newRoutes,
    activeEvents: newEvents,
    marketFactors: {
      scarcity: Array.from(newScarcity),
      surplus: Array.from(newSurplus)
    }
  };

  return {
    state: {
      ...state,
      economy: newEconomy
    },
    logs
  };
};
