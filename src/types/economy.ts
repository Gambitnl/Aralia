/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/economy.ts
 * Defines types for the Economy system, enabling dynamic pricing and world events.
 */

import { Location, Item } from './index';

export type EventType = 'WAR' | 'PLAGUE' | 'FAMINE' | 'BOOM' | 'FESTIVAL' | 'DROUGHT' | 'BANDITRY';

export interface WorldEvent {
  id: string;
  type: EventType;
  name: string;
  description: string;
  affectedLocations: string[]; // Location IDs or Biome IDs
  affectedItemCategories: string[]; // e.g., 'weapon', 'food_drink'
  priceModifier: number; // Multiplier, e.g., 1.5 for 50% increase
  duration: number; // In game days
  startTime: number; // Timestamp
}

export interface EconomyContext {
  location: Location;
  events: WorldEvent[];
  merchantType?: string; // e.g., 'blacksmith', 'general'
}

export interface TradeRoute {
  id: string;
  originId: string;
  destinationId: string;
  riskLevel: number; // 1-10
  primaryGoods: string[]; // Item categories
}

// Re-export EconomyState from index to keep things centralized if needed,
// but for now we rely on index.ts import.
// We will likely need to expand EconomyState in index.ts later.
