/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 13/06/2026, 14:05:14
 * Dependents: components/Economy/LedgerBook.tsx, components/World3D/World3DWrapper.tsx, data/economy/businessTemplates.ts, systems/economy/BusinessAcquisition.ts, systems/economy/BusinessManagement.ts, systems/economy/BusinessSimulation.ts, systems/economy/NpcBusinessManager.ts, systems/worldforge/bridge/groundChunkLoader.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/types/business.ts
 * Types for the business ownership and simulation system.
 * BusinessState: legacy stronghold-linked businesses.
 * WorldBusiness: standalone businesses with NPC or player ownership.
 */
export type BusinessType = 'tavern' | 'smithy' | 'apothecary' | 'general_store' | 'trading_company' | 'mine' | 'farm' | 'enchanter_shop';
export interface BusinessMetrics {
    customerSatisfaction: number;
    reputation: number;
    competitorPressure: number;
    supplyChainHealth: number;
    staffEfficiency: number;
}
export interface SupplyContract {
    id: string;
    goodCategory: string;
    supplierId: string;
    regionId: string;
    costPerUnit: number;
    unitsPerDay: number;
    reliabilityScore: number;
    tradeRouteId?: string;
}
export interface BusinessDailyReport {
    day: number;
    revenue: number;
    costs: number;
    profit: number;
    customersSatisfied: number;
    customersLost: number;
    supplyIssues: string[];
    competitorActions: string[];
    staffIssues: string[];
}
export interface BusinessState {
    strongholdId: string;
    businessType: BusinessType;
    metrics: BusinessMetrics;
    supplyContracts: SupplyContract[];
    dailyCustomers: number;
    priceMultiplier: number;
    specialization?: string;
    competitorIds: string[];
    lastDailyReport: BusinessDailyReport;
}
export type AcquisitionType = 'purchased' | 'coerced' | 'partnership' | 'faction_grant' | 'founded';
/** Standalone business with NPC or player ownership. Extends BusinessState. */
export interface WorldBusiness extends Omit<BusinessState, 'strongholdId'> {
    id: string;
    name: string;
    locationId: string;
    ownerId: string;
    ownerType: 'npc' | 'player';
    strongholdId?: string;
    burgId?: number;
    plotId?: number;
    /**
     * Persisted, owned shop inventory. Generated deterministically at registration
     * from `businessType` (see generateBusinessStock). When present, the merchant
     * browse flow builds its item list from this stock instead of an LLM call, and
     * purchases decrement quantities. Absent on simulation-only businesses (mines,
     * farms) that don't run a storefront.
     */
    stock?: BusinessStockEntry[];
    npcOwnerProfile?: NpcBusinessProfile;
    daysSinceManaged: number;
    managerId?: string;
    managerEfficiency: number;
    acquisitionType?: AcquisitionType;
    partnershipTerms?: PartnershipTerms;
    foundedDay?: number;
}
/**
 * A single line of persisted, owned shop stock: a catalog item id, how many are
 * on the shelf, and an optional flat GP price override. When `priceOverride` is
 * absent the sale price is derived at browse time from the item's base cost via
 * `calculatePrice` × the business's `priceMultiplier` (see businessStock.ts).
 */
export interface BusinessStockEntry {
    itemId: string;
    quantity: number;
    priceOverride?: number;
}
export interface NpcBusinessProfile {
    businessSkill: number;
    willingnessToSell: number;
    financialPressure: number;
    attachmentToShop: number;
    askingPriceMultiplier: number;
    daysUnprofitable: number;
}
export interface PartnershipTerms {
    partnerId: string;
    playerShare: number;
    partnerShare: number;
    partnerManages: boolean;
    investedByPlayer: number;
    investedByPartner: number;
    startDay: number;
    canBuyOut: boolean;
}
export interface BusinessValuation {
    baseValue: number;
    reputationModifier: number;
    locationModifier: number;
    contractValue: number;
    goodwillValue: number;
    totalValue: number;
}
export interface BusinessEvent {
    id: string;
    businessId: string;
    type: 'positive' | 'negative' | 'neutral';
    name: string;
    description: string;
    effects: {
        reputationChange?: number;
        goldChange?: number;
        customerSatisfactionChange?: number;
        supplyChainHealthChange?: number;
        staffEfficiencyChange?: number;
        durationDays?: number;
    };
    day: number;
}
