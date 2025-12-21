/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/economy.ts
 * Type definitions for the economy system, including markets, trade routes, and pricing.
 */

export interface MarketEvent {
  id: string;
  name: string;
  description: string;
  affectedTags: string[]; // Tags like 'weapon', 'food', 'magic'
  effect: 'scarcity' | 'surplus';
  duration: number; // In game ticks or arbitrary units (days)
}

export type TradeRouteStatus = 'active' | 'blocked' | 'booming' | 'disrupted';

export interface TradeRoute {
  id: string;
  name: string;
  description: string;
  originId: string; // Location ID or Region Name
  destinationId: string; // Location ID or Region Name
  goods: string[]; // Tags of goods transported (e.g. ['iron', 'weapon'])

  status: TradeRouteStatus;
  riskLevel: number; // 0.0 to 1.0 (Chance of disruption)
  profitability: number; // 0.0 to 1.0 (Chance of boom)

  // Dynamic state
  daysInStatus: number; // How long it has been in current status
}

export interface EconomyState {
  marketFactors: {
    scarcity: string[]; // Item types or tags that are scarce (high demand)
    surplus: string[]; // Item types or tags that are abundant (low value)
  };
  buyMultiplier: number; // Base multiplier for buying
  sellMultiplier: number; // Base multiplier for selling
  activeEvents?: MarketEvent[];
  tradeRoutes?: TradeRoute[]; // Active trade routes tracking
}
