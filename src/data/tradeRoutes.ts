/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/data/tradeRoutes.ts
 * Static definition of major trade routes in the world.
 */

import { TradeRoute } from '../types/economy';

export const INITIAL_TRADE_ROUTES: TradeRoute[] = [
  {
    id: 'route_golden_road',
    name: 'The Golden Road',
    description: 'A major highway connecting the capital to the spice ports.',
    originId: 'region_capital',
    destinationId: 'region_coast',
    goods: ['spice', 'silk', 'luxury', 'gold'],
    status: 'active',
    riskLevel: 0.2,
    profitability: 0.8,
    daysInStatus: 0
  },
  {
    id: 'route_iron_way',
    name: 'The Iron Way',
    description: 'Mountain passes used to transport ore and weapons.',
    originId: 'region_mountains',
    destinationId: 'region_plains',
    goods: ['iron', 'weapon', 'armor', 'tool'],
    status: 'active',
    riskLevel: 0.4,
    profitability: 0.5,
    daysInStatus: 0
  },
  {
    id: 'route_salt_run',
    name: 'The Salt Run',
    description: 'A treacherous desert route essential for preserving food.',
    originId: 'region_desert',
    destinationId: 'region_farmlands',
    goods: ['salt', 'consumable', 'food'],
    status: 'active',
    riskLevel: 0.6,
    profitability: 0.9, // High risk, high reward
    daysInStatus: 0
  },
  {
    id: 'route_river_trade',
    name: 'River Trade Network',
    description: 'Safe barges moving grain and timber.',
    originId: 'region_riverlands',
    destinationId: 'region_capital',
    goods: ['food', 'material', 'wood'],
    status: 'active',
    riskLevel: 0.1,
    profitability: 0.3,
    daysInStatus: 0
  }
];
