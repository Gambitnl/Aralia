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
    regionalWealth: Record<string, number>;
    marketFactors: {
        scarcity: string[];
        surplus: string[];
    };
    buyMultiplier: number;
    sellMultiplier: number;
    activeEvents: MarketEvent[];
}
export type MarketEventImpactDirection = 'scarcity' | 'surplus';
export interface MarketEvent {
    id: string;
    type: MarketEventType;
    locationId?: string;
    startTime: number;
    duration: number;
    intensity: number;
    name?: string;
    description?: string;
    affectedTags?: string[];
    affectedCategories?: string[];
    effect?: MarketEventImpactDirection;
}
export declare enum MarketEventType {
    BOOM = "BOOM",
    BUST = "BUST",
    SHORTAGE = "SHORTAGE",
    SURPLUS = "SURPLUS",
    WAR_TAX = "WAR_TAX",
    FESTIVAL = "FESTIVAL"
}
export interface TradeGood {
    id: string;
    name: string;
    basePrice: number;
    category: string;
    legality: 'legal' | 'contraband' | 'restricted';
}
export interface ShopInventory {
    items: string[];
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
    goods: string[];
    resources?: string[];
    status: 'active' | 'disrupted' | 'blockaded' | 'booming';
    riskLevel: number;
    profitability: number;
    controllingFactionId?: string;
    daysInStatus?: number;
    lastCaravanDispatch?: number;
}
export interface RegionalEconomy {
    id: string;
    name: string;
    exports: string[];
    imports: string[];
    wealthLevel: number;
}
export type InvestmentType = 'caravan' | 'business' | 'loan_given' | 'loan_taken' | 'speculation';
export interface PlayerInvestment {
    id: string;
    type: InvestmentType;
    principalGold: number;
    currentValue: number;
    startDay: number;
    durationDays: number;
    riskLevel: number;
    regionId?: string;
    tradeRouteId?: string;
    factionId?: string;
    goodCategory?: string;
    status: 'active' | 'completed' | 'failed' | 'defaulted';
    interestRate?: number;
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
export type CourierMessageType = 'business_report' | 'investment_result' | 'market_intel' | 'loan_notice' | 'faction_edict';
export interface PendingCourier {
    id: string;
    sourceRegionId: string;
    deliveryDay: number;
    messageText: string;
    accuracy: number;
    type: CourierMessageType;
    payload?: Record<string, unknown>;
}
export interface PlayerInvestmentReport {
    investmentId: string;
    lastKnownStatus: string;
    reportAge: number;
    isEstimate: boolean;
}
