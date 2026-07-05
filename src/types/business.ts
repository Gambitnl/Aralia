// @dependencies-start
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
// @dependencies-end

/**
 * @file src/types/business.ts
 * Types for the business ownership and simulation system.
 * BusinessState: legacy stronghold-linked businesses.
 * WorldBusiness: standalone businesses with NPC or player ownership.
 */

export type BusinessType =
  | 'tavern'
  | 'smithy'
  | 'apothecary'
  | 'general_store'
  | 'trading_company'
  | 'mine'
  | 'farm'
  | 'enchanter_shop';

export interface BusinessMetrics {
  customerSatisfaction: number;   // 0-100
  reputation: number;             // 0-100 (local business reputation)
  competitorPressure: number;     // 0-100
  supplyChainHealth: number;      // 0-100
  staffEfficiency: number;        // 0-100 (derived from morale + skills)
}

export interface SupplyContract {
  id: string;
  goodCategory: string;           // 'iron', 'food', 'luxury', etc.
  supplierId: string;             // NPC or faction providing goods
  regionId: string;
  costPerUnit: number;
  unitsPerDay: number;
  reliabilityScore: number;       // 0-100, affected by trade route status
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
  strongholdId: string;           // Links to the parent stronghold
  businessType: BusinessType;
  metrics: BusinessMetrics;
  supplyContracts: SupplyContract[];
  dailyCustomers: number;
  priceMultiplier: number;        // Player-set markup (0.5 to 2.0)
  specialization?: string;
  competitorIds: string[];
  lastDailyReport: BusinessDailyReport;
}

// --- NPC Business Ownership & Acquisition ---

export type AcquisitionType = 'purchased' | 'coerced' | 'partnership' | 'faction_grant' | 'founded';

/** Standalone business with NPC or player ownership. Extends BusinessState. */
export interface WorldBusiness extends Omit<BusinessState, 'strongholdId'> {
  id: string;
  name: string;
  locationId: string;
  ownerId: string;                  // NPC ID or 'player'
  ownerType: 'npc' | 'player';
  strongholdId?: string;            // Optional — only if linked to a stronghold
  burgId?: number;                  // ID of the Azgaar burg/town if generated
  plotId?: number;                  // ID of the TownPlan building plot if generated

  /**
   * Persisted, owned shop inventory. Generated deterministically at registration
   * from `businessType` (see generateBusinessStock). When present, the merchant
   * browse flow builds its item list from this stock instead of an LLM call, and
   * purchases decrement quantities. Absent on simulation-only businesses (mines,
   * farms) that don't run a storefront.
   */
  stock?: BusinessStockEntry[];

  npcOwnerProfile?: NpcBusinessProfile;

  // Management tracking
  daysSinceManaged: number;
  managerId?: string;
  managerEfficiency: number;        // 0-100

  // Acquisition state
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
  itemId: string;        // key into ALL_ITEMS
  quantity: number;      // units currently on the shelf (>= 0)
  priceOverride?: number; // optional flat GP price; bypasses the derived formula
}

export interface NpcBusinessProfile {
  businessSkill: number;            // 0-100
  willingnessToSell: number;        // 0-100, dynamic
  financialPressure: number;        // 0-100, rises when business loses money
  attachmentToShop: number;         // 0-100
  askingPriceMultiplier: number;    // 1.0-3.0x of calculated valuation
  daysUnprofitable: number;
}

export interface PartnershipTerms {
  partnerId: string;
  playerShare: number;              // 0-1
  partnerShare: number;             // 0-1
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
