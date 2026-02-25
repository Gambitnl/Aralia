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
    activeEvents: unknown[];
}
export interface MarketEvent {
    id: string;
    type: MarketEventType;
    locationId?: string;
    startTime: number;
    duration: number;
    intensity: number;
    name?: string;
    description?: string;
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
    status: 'active' | 'disrupted' | 'blockaded';
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
