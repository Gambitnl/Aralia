/**
 * @file src/systems/economy/BusinessAcquisition.ts
 * Central acquisition logic for all business acquisition paths:
 * purchase, coercion, partnership, faction grant, and fresh start.
 */
import { WorldBusiness, BusinessType, BusinessValuation } from '../../types/business';
import { EconomyState } from '../../types/economy';
import { Faction, PlayerFactionStanding } from '../../types/factions';
import { SeededRandom } from '@/utils/random';
export interface PurchaseEligibility {
    canAfford: boolean;
    askingPrice: number;
    npcWilling: boolean;
    valuation: BusinessValuation;
}
/**
 * Checks whether a business can be purchased: is the NPC willing, and can the player afford it?
 */
export declare const canPurchaseBusiness: (business: WorldBusiness, playerGold: number, economy: EconomyState) => PurchaseEligibility;
export interface NegotiationResult {
    finalPrice: number;
    accepted: boolean;
    contractsIncluded: boolean;
    message: string;
}
/**
 * Negotiates a purchase price. DC based on NPC's attachment and business health.
 * @param charismaModifier Player's CHA modifier
 * @param persuasionBonus Player's persuasion proficiency bonus
 */
export declare const negotiatePurchasePrice: (business: WorldBusiness, economy: EconomyState, charismaModifier: number, persuasionBonus: number, rng: SeededRandom) => NegotiationResult;
/**
 * Executes a purchase — transfers ownership from NPC to player.
 * Preserves existing metrics, contracts, and customers.
 */
export declare const executePurchase: (business: WorldBusiness, negotiatedPrice: number) => {
    business: WorldBusiness;
    goldSpent: number;
};
/**
 * Executes a coerced sale using leverage/blackmail results.
 * Business gets a reputation penalty — word gets around.
 */
export declare const executeCoercedSale: (business: WorldBusiness, economy: EconomyState, discountPercent: number) => {
    business: WorldBusiness;
    goldSpent: number;
    reputationPenalty: number;
};
export interface PartnershipOffer {
    canPartner: boolean;
    minInvestment: number;
    suggestedPlayerShare: number;
    message: string;
}
/**
 * Checks if a partnership is viable. NPC must have positive disposition.
 */
export declare const canCreatePartnership: (business: WorldBusiness, playerGold: number, npcDisposition: number) => PartnershipOffer;
/**
 * Creates a partnership with an NPC business owner.
 */
export declare const createPartnership: (business: WorldBusiness, playerInvestment: number, playerShare: number, gameDay: number) => {
    business: WorldBusiness;
};
/**
 * Checks eligibility for a faction business grant.
 */
export declare const canAcceptFactionGrant: (factionId: string, factions: Record<string, Faction>, standings: Record<string, PlayerFactionStanding>, locationId: string) => {
    eligible: boolean;
    reason: string;
};
/**
 * Creates a new business via faction grant.
 * Better starting metrics than fresh start, but comes with faction obligations.
 */
export declare const executeFactionGrant: (locationId: string, businessType: BusinessType, factionId: string, gameDay: number, rng: SeededRandom) => WorldBusiness;
/**
 * Creates a brand-new business from scratch. Highest cost, lowest starting metrics.
 */
export declare const executeFreshStart: (locationId: string, businessType: BusinessType, gameDay: number, rng: SeededRandom) => {
    business: WorldBusiness | null;
    goldSpent: number;
};
