/**
 * Economy and Trade types.
 */
import { ItemType } from './items';

export interface TradeGood {
  id: string;
  name: string;
  type: ItemType; // Align with existing ItemType
  baseValue: number;
  volatility: number; // 0-1, how much price fluctuates
}

export type TradeRouteStatus = 'active' | 'disrupted' | 'completed' | 'pending';

export interface TradeRoute {
  id: string;
  originLocationId: string;
  destinationLocationId: string;

  // What is being transported?
  goods: {
    itemType: string; // e.g. "weapon", "food_drink" - matching Item tags
    volume: number;   // Abstract unit of quantity
  }[];

  // Progression
  startTime: number; // Game timestamp
  durationHours: number;
  progress: number; // 0-1

  status: TradeRouteStatus;

  // Risk factor (could be affected by bandits, weather)
  risk: number; // 0-1
}

export interface MarketNode {
  locationId: string;
  // Local production/consumption
  production: string[]; // Item tags produced here (Surplus source)
  consumption: string[]; // Item tags consumed here (Scarcity source)

  inventoryLevel: Record<string, number>; // Tag -> Quantity (0-100 scale)
}

export interface EconomySystemState {
  routes: TradeRoute[];
  nodes: Record<string, MarketNode>;
  globalVolatility: number;
  lastUpdateTimestamp: number;
}
