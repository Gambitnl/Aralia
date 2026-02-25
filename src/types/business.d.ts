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
    npcOwnerProfile?: NpcBusinessProfile;
    daysSinceManaged: number;
    managerId?: string;
    managerEfficiency: number;
    acquisitionType?: AcquisitionType;
    partnershipTerms?: PartnershipTerms;
    foundedDay?: number;
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
