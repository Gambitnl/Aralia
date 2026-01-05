/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/economy/TradeRouteManager.ts
 * Manages the simulation of trade routes and their impact on the global economy.
 */

import { GameState, GameMessage, TradeRoute, EconomyState, MarketEvent, MarketEventType } from '../../types';
import { SeededRandom } from '../../utils/seededRandom';
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
  const timestampNumber = typeof state.gameTime === 'number' ? state.gameTime : Number((state.gameTime as unknown as Date)?.getTime?.() ?? Date.now());
  const timestampDate = new Date(timestampNumber);

  // Iterate through routes and simulate changes
  for (const route of currentRoutes) {
    const routeStatus = route.status as unknown as string;
    let newStatus: TradeRoute['status'] | 'booming' = routeStatus as TradeRoute['status'];
    let daysInStatus = (route.daysInStatus ?? 0) + daysPassed;
    let statusChanged = false;

    // Simulate risk/recovery over the passed days
    // Instead of rolling once, we check probability for the whole period.
    // P(event) = 1 - (1 - daily_probability)^days

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
      // TODO(2026-01-03 pass 4 Codex-CLI): 'booming' status cast until TradeRoute supports richer states.
      status: newStatus as TradeRoute['status'],
      daysInStatus
    });
  }

  // Generate Market Events from Routes
  const routeEventPrefix = 'route_event_';

  // Filter out old route events to regenerate them based on current status
  const existingEvents = (economy.marketEvents || []).filter(e => !e.id.startsWith(routeEventPrefix));
  const newEvents: MarketEvent[] = [...existingEvents];

  newRoutes.forEach(route => {
    const routeStatus = route.status as unknown as string;
    if (routeStatus === 'blockaded') {
      // Create separate shortage events for each good category
      route.goods.forEach(good => {
        const eventId = `${routeEventPrefix}${route.id}_${good}_scarcity`;
        // Check if event already exists to preserve start time, or create new
        const existing = economy.marketEvents?.find(e => e.id === eventId);

        newEvents.push({
          id: eventId,
          type: MarketEventType.SHORTAGE,
          name: `${route.name} Blockade: ${good}`,
          description: `Trade route blocked: ${route.name} causing shortage of ${good}`,
          startTime: Number(existing?.startTime ?? timestampNumber),
          duration: 1, // Managed by the route system, refreshed daily
          intensity: 0.5 + (route.riskLevel * 0.5) // Higher risk routes cause worse shortages
        });
      });
    } else if (routeStatus === 'booming') {
      route.goods.forEach(good => {
        const eventId = `${routeEventPrefix}${route.id}_${good}_surplus`;
        const existing = economy.marketEvents?.find(e => e.id === eventId);

        newEvents.push({
          id: eventId,
          type: MarketEventType.SURPLUS,
          name: `${route.name} Boom: ${good}`,
          description: `High trade volume on ${route.name} bringing surplus of ${good}`,
          startTime: Number(existing?.startTime ?? timestampNumber),
          duration: 1,
          intensity: 0.3 + (route.profitability * 0.3) // Higher profit routes cause bigger surpluses
        });
      });
    }
  });

  // Rebuild Market Factors (Legacy Support)
  const newScarcity = new Set<string>();
  const newSurplus = new Set<string>();

  newEvents.forEach(e => {
    // Extract goods/tags from name or description as we don't have affectedTags in MarketEvent
    // This is a bit heuristic, but matches how we constructed the events above
    const parts = e.name?.split(': ');
    const tag = parts && parts.length > 1 ? parts[1] : null;

    if (tag) {
      if (e.type === MarketEventType.SHORTAGE) {
        newScarcity.add(tag);
      } else if (e.type === MarketEventType.SURPLUS) {
        newSurplus.add(tag);
      }
    }
  });

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
