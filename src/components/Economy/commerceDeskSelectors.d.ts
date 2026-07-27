/**
 * @file src/components/Economy/commerceDeskSelectors.ts
 * Pure selectors for the Commerce Desk — the player's dedicated in-world home
 * for business management, trade-map affordances, ventures, and courier intel.
 *
 * All functions are pure so the panel logic is unit-testable without React.
 */
import { BusinessState, WorldBusiness } from '../../types/business';
import { EconomyState, MarketEvent, PendingCourier, PlayerInvestment, TradeRoute } from '../../types/economy';
export interface CommerceHolding {
    id: string;
    name: string;
    businessType: string;
    /** 'world' = standalone WorldBusiness; 'stronghold' = legacy stronghold-linked business. */
    kind: 'world' | 'stronghold';
    profitPerDay: number;
    metrics: BusinessState['metrics'];
    supplyIssues: string[];
    /** World businesses only — days since the player (or a manager) tended the counter. */
    daysSinceManaged?: number;
    managerId?: string;
    managerEfficiency?: number;
    /** True when neglect decay is active (past the 3-day grace) and no manager covers it. */
    needsAttention: boolean;
}
/**
 * Normalizes player-owned businesses from both ownership models into one list.
 * World businesses come first (they carry management affordances).
 */
export declare function selectPlayerHoldings(worldBusinesses: Record<string, WorldBusiness> | undefined, strongholdBusinesses: Record<string, BusinessState> | undefined): CommerceHolding[];
export interface TradeOutlook {
    routes: TradeRoute[];
    activeCount: number;
    boomingCount: number;
    troubledCount: number;
    shortages: MarketEvent[];
    surpluses: MarketEvent[];
    otherEvents: MarketEvent[];
}
export declare function selectTradeOutlook(economy: EconomyState | undefined): TradeOutlook;
export interface VenturesSummary {
    active: PlayerInvestment[];
    /** Completed investments whose payout is waiting for COLLECT_INVESTMENT. */
    collectible: PlayerInvestment[];
    loans: PlayerInvestment[];
    totalInvested: number;
    totalDebt: number;
    collectibleValue: number;
}
export declare function selectVenturesSummary(investments: PlayerInvestment[] | undefined): VenturesSummary;
export interface CourierIntel {
    delivered: PendingCourier[];
    enRoute: PendingCourier[];
}
/** Splits couriers into delivered mail vs. intel still on the road. */
export declare function selectCourierIntel(couriers: PendingCourier[] | undefined, currentDay: number): CourierIntel;
