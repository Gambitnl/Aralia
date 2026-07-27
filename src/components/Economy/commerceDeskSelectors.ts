/**
 * @file src/components/Economy/commerceDeskSelectors.ts
 * Pure selectors for the Commerce Desk — the player's dedicated in-world home
 * for business management, trade-map affordances, ventures, and courier intel.
 *
 * All functions are pure so the panel logic is unit-testable without React.
 */
import { BusinessState, WorldBusiness } from '../../types/business';
import {
    EconomyState,
    MarketEvent,
    MarketEventType,
    PendingCourier,
    PlayerInvestment,
    TradeRoute,
} from '../../types/economy';

// --- Holdings (businesses the player owns) ---

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

const titleCase = (raw: string): string =>
    raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/**
 * Normalizes player-owned businesses from both ownership models into one list.
 * World businesses come first (they carry management affordances).
 */
export function selectPlayerHoldings(
    worldBusinesses: Record<string, WorldBusiness> | undefined,
    strongholdBusinesses: Record<string, BusinessState> | undefined,
): CommerceHolding[] {
    const holdings: CommerceHolding[] = [];

    for (const wb of Object.values(worldBusinesses ?? {})) {
        if (wb.ownerType !== 'player') continue;
        const unmanaged = wb.daysSinceManaged > 3 && !wb.managerId;
        holdings.push({
            id: wb.id,
            name: wb.name || titleCase(wb.businessType),
            businessType: wb.businessType,
            kind: 'world',
            profitPerDay: wb.lastDailyReport?.profit ?? 0,
            metrics: wb.metrics,
            supplyIssues: wb.lastDailyReport?.supplyIssues ?? [],
            daysSinceManaged: wb.daysSinceManaged,
            managerId: wb.managerId,
            managerEfficiency: wb.managerEfficiency,
            needsAttention: unmanaged,
        });
    }

    for (const [strongholdId, biz] of Object.entries(strongholdBusinesses ?? {})) {
        holdings.push({
            id: strongholdId,
            name: titleCase(biz.businessType),
            businessType: biz.businessType,
            kind: 'stronghold',
            profitPerDay: biz.lastDailyReport?.profit ?? 0,
            metrics: biz.metrics,
            supplyIssues: biz.lastDailyReport?.supplyIssues ?? [],
            needsAttention: (biz.lastDailyReport?.supplyIssues?.length ?? 0) > 0,
        });
    }

    return holdings;
}

// --- Trade outlook (trade-map affordances) ---

export interface TradeOutlook {
    routes: TradeRoute[];
    activeCount: number;
    boomingCount: number;
    troubledCount: number;
    shortages: MarketEvent[];
    surpluses: MarketEvent[];
    otherEvents: MarketEvent[];
}

export function selectTradeOutlook(economy: EconomyState | undefined): TradeOutlook {
    const routes = economy?.tradeRoutes ?? [];
    const events = economy?.marketEvents ?? [];
    return {
        routes,
        activeCount: routes.filter(r => r.status === 'active').length,
        boomingCount: routes.filter(r => r.status === 'booming').length,
        troubledCount: routes.filter(r => r.status === 'disrupted' || r.status === 'blockaded').length,
        shortages: events.filter(e => e.type === MarketEventType.SHORTAGE),
        surpluses: events.filter(e => e.type === MarketEventType.SURPLUS),
        otherEvents: events.filter(
            e => e.type !== MarketEventType.SHORTAGE && e.type !== MarketEventType.SURPLUS,
        ),
    };
}

// --- Ventures (investments and debts) ---

export interface VenturesSummary {
    active: PlayerInvestment[];
    /** Completed investments whose payout is waiting for COLLECT_INVESTMENT. */
    collectible: PlayerInvestment[];
    loans: PlayerInvestment[];
    totalInvested: number;
    totalDebt: number;
    collectibleValue: number;
}

export function selectVenturesSummary(investments: PlayerInvestment[] | undefined): VenturesSummary {
    const all = investments ?? [];
    const active = all.filter(i => i.status === 'active' && i.type !== 'loan_taken');
    const collectible = all.filter(i => i.status === 'completed' && i.type !== 'loan_taken');
    const loans = all.filter(i => i.type === 'loan_taken' && i.status === 'active');
    return {
        active,
        collectible,
        loans,
        totalInvested: active.reduce((sum, i) => sum + i.currentValue, 0),
        totalDebt: loans.reduce((sum, i) => sum + i.currentValue, 0),
        collectibleValue: collectible.reduce((sum, i) => sum + i.currentValue, 0),
    };
}

// --- Courier intel ---

export interface CourierIntel {
    delivered: PendingCourier[];
    enRoute: PendingCourier[];
}

/** Splits couriers into delivered mail vs. intel still on the road. */
export function selectCourierIntel(
    couriers: PendingCourier[] | undefined,
    currentDay: number,
): CourierIntel {
    const all = couriers ?? [];
    return {
        delivered: all
            .filter(c => c.deliveryDay <= currentDay)
            .sort((a, b) => b.deliveryDay - a.deliveryDay),
        enRoute: all
            .filter(c => c.deliveryDay > currentDay)
            .sort((a, b) => a.deliveryDay - b.deliveryDay),
    };
}
