// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 17:22:06
 * Dependents: systems/world/WorldEventManager.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/economy/TradeRouteManager.ts
 * Manages the simulation of trade routes and their impact on the global economy.
 */

import { GameState, GameMessage, TradeRoute, EconomyState, MarketEvent, MarketEventType } from '../../types';
import { SeededRandom } from '@/utils/random';
import { INITIAL_TRADE_ROUTES } from '../../data/tradeRoutes';
import { calculateMarketFactors } from '../../utils/economy/marketEvents';

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
  // RALPH: Simulation Engine.
  // Iterates "daysPassed" instantly using probability math rather than looping day-by-day.
  if (daysPassed <= 0) return { state, logs: [] };

  // Ensure routes are initialized
  let economy = state.economy;
  if (!economy.tradeRoutes || economy.tradeRoutes.length === 0) {
    economy = initializeTradeRoutes(state);
  }

  const logs: GameMessage[] = [];
  const currentRoutes = economy.tradeRoutes || [];
  const newRoutes: TradeRoute[] = [];
  const timestampNumber = typeof state.gameTime === 'number' ? state.gameTime : Number((state.gameTime as unknown as Date)?.getTime?.() ?? Date.now());
  const timestampDate = new Date(timestampNumber);

  // Iterate through routes and simulate changes
  for (const route of currentRoutes) {
    const routeStatus = route.status;
    let newStatus: TradeRoute['status'] = routeStatus;
    let daysInStatus = (route.daysInStatus ?? 0) + daysPassed;
    let statusChanged = false;

    // Simulate risk/recovery over the passed days
    // Instead of rolling once, we check probability for the whole period.
    // P(event) = 1 - (1 - daily_probability)^days
    // RALPH: "At least one event happened" probability calculation.
    // If daily risk is 10%, and 7 days pass, chance of NO block is 0.9^7 = ~48%.
    // So chance of block is ~52%.

    // Recovery Chance Calculation
    // Base 20% + 5% per day waiting
    const dailyRecoveryBase = 0.2 + ((route.daysInStatus ?? 0) * 0.05);
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

    if (routeStatus === 'active') {
      if (roll < blockChance) {
        newStatus = 'blockaded';
        statusChanged = true;
        logs.push({
          id: Date.now() + Math.floor(rng.next() * 10000), // Ensure unique numeric ID
          text: `Trade News: ${route.name} has been blocked by hazards! ${route.goods.join(', ')} prices may rise.`,
          sender: 'system',
          timestamp: timestampDate
        });
      } else if (roll > 1.0 - boomChance) {
        newStatus = 'booming';
        statusChanged = true;
        logs.push({
            id: Date.now() + Math.floor(rng.next() * 10000),
            text: `Trade News: Trade is flourishing on ${route.name}. Expect cheap ${route.goods.join(', ')}.`,
            sender: 'system',
            timestamp: timestampDate
          });
      }
    } else if (routeStatus === 'blockaded') {
      if (roll < recoveryChance) {
        newStatus = 'active';
        statusChanged = true;
        logs.push({
            id: Date.now() + Math.floor(rng.next() * 10000),
            text: `Trade News: ${route.name} is clear again. Trade resumes.`,
            sender: 'system',
            timestamp: timestampDate
          });
      }
    } else if (routeStatus === 'booming') {
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

  // Filter out old route events to regenerate them based on current status
  const existingEvents = (economy.marketEvents || []).filter(e => !e.id.startsWith(routeEventPrefix));
  const newEvents: MarketEvent[] = [...existingEvents];

  const toRouteEvent = (route: TradeRoute, good: string, status: TradeRoute['status']) => {
    const eventType = status === 'blockaded'
      ? MarketEventType.SHORTAGE
      : MarketEventType.SURPLUS;

    const eventSuffix = status === 'blockaded' ? 'scarcity' : 'surplus';
    const routeLabel = status === 'blockaded' ? 'Blockade' : 'Boom';
    const direction = status === 'blockaded' ? 'scarcity of' : 'surplus of';
    const eventId = `${routeEventPrefix}${route.id}_${good}_${eventSuffix}`;
    const existing = economy.marketEvents?.find(e => e.id === eventId);

    return {
      id: eventId,
      type: eventType,
      name: `${route.name} ${routeLabel}: ${good}`,
      description: `Trade route ${routeLabel.toLowerCase()} on ${route.name}, ${direction} ${good}`,
      startTime: Number(existing?.startTime ?? timestampNumber),
      duration: 1,
      intensity: status === 'blockaded'
        ? 0.5 + (route.riskLevel * 0.5)
        : 0.3 + (route.profitability * 0.3),
      affectedTags: [good.toLowerCase()]
    } as MarketEvent;
  };

  newRoutes.forEach(route => {
    const routeStatus = route.status;
    if (routeStatus === 'blockaded') {
      route.goods.forEach(good => {
        newEvents.push(toRouteEvent(route, good, 'blockaded'));
      });
    } else if (routeStatus === 'booming') {
      route.goods.forEach(good => {
        newEvents.push(toRouteEvent(route, good, 'booming'));
      });
    }
  });

  const { scarcity: newScarcity, surplus: newSurplus } = calculateMarketFactors(newEvents);

  const newEconomy: EconomyState = {
    ...economy,
    tradeRoutes: newRoutes,
    marketEvents: newEvents,
    // Keep activeEvents synced for now (legacy)
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
