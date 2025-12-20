export interface EconomyState {
  marketEvents: MarketEvent[];
  tradeRoutes: TradeRoute[];
  globalInflation: number;
  regionalWealth: Record<string, number>; // locationId -> wealthLevel (0-100)

  // Legacy fields restored to prevent breaking changes
  marketFactors: {
    scarcity: string[];
    surplus: string[];
  };
  buyMultiplier: number;
  sellMultiplier: number;
  activeEvents: any[]; // Deprecated, use marketEvents
}

export interface MarketEvent {
  id: string;
  type: MarketEventType;
  locationId?: string; // If undefined, global
  startTime: number;
  duration: number;
  intensity: number; // 0-1
  // Optional descriptive fields
  name?: string;
  description?: string;
}

export enum MarketEventType {
  BOOM = 'BOOM',
  BUST = 'BUST',
  SHORTAGE = 'SHORTAGE',
  SURPLUS = 'SURPLUS',
  WAR_TAX = 'WAR_TAX',
  FESTIVAL = 'FESTIVAL'
}

export interface TradeGood {
  id: string;
  name: string;
  basePrice: number;
  category: string;
  legality: 'legal' | 'contraband' | 'restricted';
}

export interface ShopInventory {
  items: string[]; // Item IDs
  gold: number;
  lastRestock: number;
  specialization?: string;
}

export interface TradeRoute {
  id: string;
  name: string;
  description?: string;
  originId: string;
  destinationId: string;
  goods: string[]; // List of good categories or IDs
  resources?: string[]; // Legacy support
  status: 'active' | 'disrupted' | 'blockaded';
  riskLevel: number; // 0-1.0
  profitability: number; // 0-100
  controllingFactionId?: string;
  daysInStatus?: number;
  lastCaravanDispatch?: number; // timestamp
}

export interface RegionalEconomy {
  id: string;
  name: string;
  exports: string[]; // Categories or Item IDs they produce (Cheap here)
  imports: string[]; // Categories or Item IDs they need (Expensive here)
  wealthLevel: number; // 0-100 modifier on prices
}
