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
  // TODO(lint-intent): The any on 'activeEvents' hides the intended shape of this data.
  // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
  // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
  activeEvents: unknown[]; // Deprecated, use marketEvents
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

// --- Investment & Finance Types ---

export type InvestmentType = 'caravan' | 'business' | 'loan_given' | 'loan_taken' | 'speculation';

export interface PlayerInvestment {
  id: string;
  type: InvestmentType;
  principalGold: number;
  currentValue: number;
  startDay: number;
  durationDays: number;
  riskLevel: number;          // 0-1
  regionId?: string;
  tradeRouteId?: string;
  factionId?: string;         // Lending/borrowing faction
  goodCategory?: string;      // For speculation: the trade good category
  status: 'active' | 'completed' | 'failed' | 'defaulted';
  interestRate?: number;      // Per period (e.g., 0.05 = 5% per duration)
  lastUpdateDay: number;
}

export interface LoanOffer {
  lenderId: string;
  lenderName: string;
  factionId?: string;
  maxAmount: number;
  interestRate: number;
  minDuration: number;
  maxDuration: number;
  collateralRequired?: 'stronghold' | 'none';
}

// --- Information Delivery Types ---

export type CourierMessageType = 'business_report' | 'investment_result' | 'market_intel' | 'loan_notice' | 'faction_edict';

export interface PendingCourier {
  id: string;
  sourceRegionId: string;
  deliveryDay: number;
  messageText: string;
  accuracy: number;           // 0-1, how truthful (rumors can be wrong)
  type: CourierMessageType;
  payload?: Record<string, unknown>;
}

export interface PlayerInvestmentReport {
  investmentId: string;
  lastKnownStatus: string;
  reportAge: number;          // Days since last actual report
  isEstimate: boolean;        // True if extrapolated, not actual data
}
