// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 08/06/2026, 17:21:33
 * Dependents: components/Economy/CourierPouch.tsx, components/Economy/InvestmentBoard.tsx, components/Economy/LedgerBook.tsx, components/Trade/MarketEventCard.tsx, components/Trade/RouteCard.tsx, components/Trade/TradeRouteDashboard.tsx, data/economy/regions.ts, data/tradeRoutes.ts, state/reducers/economyReducer.ts, systems/economy/BusinessAcquisition.ts, systems/economy/BusinessManagement.ts, systems/economy/BusinessSimulation.ts, systems/economy/EconomicIntelSystem.ts, systems/economy/InvestmentManager.ts, systems/economy/LoanSystem.ts, systems/economy/NpcBusinessManager.ts, systems/economy/RegionalEconomySystem.ts, systems/economy/TradeRouteSystem.ts, systems/world/FactionEconomyManager.ts, systems/world/WorldEventManager.ts, types/index.ts, utils/economy/marketEvents.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file defines the economy data shapes shared by trade systems, market
 * simulation, save state, and trade UI panels.
 *
 * The types here are the contract between daily simulation code, reducers, and
 * player-facing economy screens. When a runtime state is promoted here, callers
 * no longer need local casts or string guesses to preserve that behavior.
 */

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
  activeEvents: MarketEvent[]; // Deprecated, use marketEvents
}

export type MarketEventImpactDirection = 'scarcity' | 'surplus';

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
  // Explicit impact channel used by route events and market factor derivation.
  // G1 cleanup uses this before falling back to name heuristics for legacy records.
  affectedTags?: string[];
  // Legacy/alternate event payload source (e.g. generated templates) from source behavior.
  affectedCategories?: string[];
  // Legacy directional hint from world-event-driven sources.
  effect?: MarketEventImpactDirection;
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
  status: 'active' | 'disrupted' | 'blockaded' | 'booming';
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
