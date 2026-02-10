/**
 * @file src/systems/economy/BusinessAcquisition.ts
 * Central acquisition logic for all business acquisition paths:
 * purchase, coercion, partnership, faction grant, and fresh start.
 */

import {
    WorldBusiness,
    BusinessType,
    BusinessValuation,
    PartnershipTerms,
} from '../../types/business';
import { EconomyState } from '../../types/economy';
import { Faction, PlayerFactionStanding } from '../../types/factions';
import { BUSINESS_TEMPLATES } from '../../data/economy/businessTemplates';
import { calculateBusinessValuation } from './NpcBusinessManager';
import { SeededRandom } from '@/utils/random';

// --- Purchase Path ---

export interface PurchaseEligibility {
    canAfford: boolean;
    askingPrice: number;
    npcWilling: boolean;
    valuation: BusinessValuation;
}

/**
 * Checks whether a business can be purchased: is the NPC willing, and can the player afford it?
 */
export const canPurchaseBusiness = (
    business: WorldBusiness,
    playerGold: number,
    economy: EconomyState
): PurchaseEligibility => {
    const valuation = calculateBusinessValuation(business, economy, business.locationId);
    const profile = business.npcOwnerProfile;
    if (!profile) {
        return { canAfford: false, askingPrice: 0, npcWilling: false, valuation };
    }

    const askingPrice = Math.round(valuation.totalValue * profile.askingPriceMultiplier);
    const npcWilling = profile.willingnessToSell > 40 || profile.financialPressure > 70;

    return {
        canAfford: playerGold >= askingPrice,
        askingPrice,
        npcWilling,
        valuation,
    };
};

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
export const negotiatePurchasePrice = (
    business: WorldBusiness,
    economy: EconomyState,
    charismaModifier: number,
    persuasionBonus: number,
    rng: SeededRandom
): NegotiationResult => {
    const profile = business.npcOwnerProfile;
    if (!profile) {
        return { finalPrice: 0, accepted: false, contractsIncluded: false, message: 'No NPC owner to negotiate with.' };
    }

    const valuation = calculateBusinessValuation(business, economy, business.locationId);
    const basePrice = Math.round(valuation.totalValue * profile.askingPriceMultiplier);

    // DC: attachment and how well the business is doing
    const dc = 10 + Math.floor(profile.attachmentToShop / 10) + Math.floor(business.metrics.reputation / 20);
    const roll = rng.nextInt(1, 21) + charismaModifier + persuasionBonus;
    const margin = roll - dc;

    if (margin < 0) {
        // Failed — NPC raises price
        const raisedPrice = Math.round(basePrice * 1.1);
        return {
            finalPrice: raisedPrice,
            accepted: false,
            contractsIncluded: false,
            message: `${business.name}'s owner scoffs at your offer and raises the asking price.`
        };
    }

    // Success: discount based on margin
    const discountPercent = Math.min(30, 10 + margin * 2); // 10-30%
    const finalPrice = Math.round(basePrice * (1 - discountPercent / 100));
    const contractsIncluded = margin >= 10; // Critical success: contracts included

    return {
        finalPrice,
        accepted: true,
        contractsIncluded,
        message: contractsIncluded
            ? `A masterful negotiation! The owner agrees to sell ${business.name} for ${finalPrice}g, including all supply contracts.`
            : `After careful haggling, the owner agrees to sell ${business.name} for ${finalPrice}g (${discountPercent}% below asking).`
    };
};

/**
 * Executes a purchase — transfers ownership from NPC to player.
 * Preserves existing metrics, contracts, and customers.
 */
export const executePurchase = (
    business: WorldBusiness,
    negotiatedPrice: number
): { business: WorldBusiness; goldSpent: number } => {
    return {
        business: {
            ...business,
            ownerId: 'player',
            ownerType: 'player',
            npcOwnerProfile: undefined,
            acquisitionType: 'purchased',
            daysSinceManaged: 0,
            managerEfficiency: 0,
        },
        goldSpent: negotiatedPrice,
    };
};

// --- Coercion Path ---

/**
 * Executes a coerced sale using leverage/blackmail results.
 * Business gets a reputation penalty — word gets around.
 */
export const executeCoercedSale = (
    business: WorldBusiness,
    economy: EconomyState,
    discountPercent: number
): { business: WorldBusiness; goldSpent: number; reputationPenalty: number } => {
    const valuation = calculateBusinessValuation(business, economy, business.locationId);
    const salePrice = Math.round(valuation.totalValue * (1 - discountPercent / 100));
    const reputationPenalty = -20;

    return {
        business: {
            ...business,
            ownerId: 'player',
            ownerType: 'player',
            npcOwnerProfile: undefined,
            acquisitionType: 'coerced',
            daysSinceManaged: 0,
            managerEfficiency: 0,
            metrics: {
                ...business.metrics,
                reputation: Math.max(0, business.metrics.reputation + reputationPenalty),
            },
        },
        goldSpent: salePrice,
        reputationPenalty,
    };
};

// --- Partnership Path ---

export interface PartnershipOffer {
    canPartner: boolean;
    minInvestment: number;
    suggestedPlayerShare: number;
    message: string;
}

/**
 * Checks if a partnership is viable. NPC must have positive disposition.
 */
export const canCreatePartnership = (
    business: WorldBusiness,
    playerGold: number,
    npcDisposition: number
): PartnershipOffer => {
    const profile = business.npcOwnerProfile;
    if (!profile) {
        return { canPartner: false, minInvestment: 0, suggestedPlayerShare: 0, message: 'No NPC owner.' };
    }

    if (npcDisposition < 30) {
        return { canPartner: false, minInvestment: 0, suggestedPlayerShare: 0, message: 'The owner does not trust you enough for a partnership.' };
    }

    const template = BUSINESS_TEMPLATES[business.businessType];
    const minInvestment = Math.round((template?.foundingCost || 1000) * 0.3);
    const suggestedPlayerShare = 0.4 + (npcDisposition / 500); // 0.4-0.6 based on disposition

    return {
        canPartner: playerGold >= minInvestment,
        minInvestment,
        suggestedPlayerShare: Math.round(suggestedPlayerShare * 100) / 100,
        message: `${business.name}'s owner considers your proposal.`
    };
};

/**
 * Creates a partnership with an NPC business owner.
 */
export const createPartnership = (
    business: WorldBusiness,
    playerInvestment: number,
    playerShare: number,
    gameDay: number
): { business: WorldBusiness } => {
    const terms: PartnershipTerms = {
        partnerId: business.ownerId,
        playerShare,
        partnerShare: 1 - playerShare,
        partnerManages: true,
        investedByPlayer: playerInvestment,
        investedByPartner: 0,
        startDay: gameDay,
        canBuyOut: true,
    };

    return {
        business: {
            ...business,
            ownerType: 'player', // Player is primary owner
            ownerId: 'player',
            acquisitionType: 'partnership',
            partnershipTerms: terms,
            daysSinceManaged: 0,
            // Partner manages: use their business skill
            managerEfficiency: business.npcOwnerProfile?.businessSkill ?? 50,
            managerId: business.ownerId,
        },
    };
};

// --- Faction Grant Path ---

/**
 * Checks eligibility for a faction business grant.
 */
export const canAcceptFactionGrant = (
    factionId: string,
    factions: Record<string, Faction>,
    standings: Record<string, PlayerFactionStanding>,
    locationId: string
): { eligible: boolean; reason: string } => {
    const faction = factions[factionId];
    if (!faction) return { eligible: false, reason: 'Unknown faction.' };

    const standing = standings[factionId];
    if (!standing || standing.publicStanding < 40) {
        return { eligible: false, reason: `Requires standing of 40+ with ${faction.name}. Current: ${standing?.publicStanding ?? 0}.` };
    }

    // Must be a faction-controlled region
    if (!faction.controlledRegionIds.includes(locationId)) {
        return { eligible: false, reason: `${faction.name} does not control this region.` };
    }

    // Only GUILD and NOBLE_HOUSE types offer grants
    if (faction.type !== 'GUILD' && faction.type !== 'NOBLE_HOUSE') {
        return { eligible: false, reason: `${faction.name} does not offer business grants.` };
    }

    return { eligible: true, reason: `${faction.name} approves your request.` };
};

/**
 * Creates a new business via faction grant.
 * Better starting metrics than fresh start, but comes with faction obligations.
 */
export const executeFactionGrant = (
    locationId: string,
    businessType: BusinessType,
    factionId: string,
    gameDay: number,
    rng: SeededRandom
): WorldBusiness => {
    const template = BUSINESS_TEMPLATES[businessType];

    return {
        id: `biz_faction_${factionId}_${rng.nextInt(1000, 10000)}`,
        name: `${template?.name || businessType} (${factionId} Grant)`,
        locationId,
        ownerId: 'player',
        ownerType: 'player',
        strongholdId: '',
        businessType,
        acquisitionType: 'faction_grant',
        foundedDay: gameDay,
        daysSinceManaged: 0,
        managerEfficiency: 0,
        metrics: {
            customerSatisfaction: 45,   // Better than fresh start
            reputation: 25,              // Faction backing helps
            competitorPressure: 20,
            supplyChainHealth: 60,       // Faction supply network
            staffEfficiency: 40,
        },
        supplyContracts: [],
        dailyCustomers: Math.round((template?.baseCustomersPerDay || 10) * 0.5),
        priceMultiplier: 1.0,
        competitorIds: [],
        lastDailyReport: {
            day: gameDay, revenue: 0, costs: 0, profit: 0,
            customersSatisfied: 0, customersLost: 0,
            supplyIssues: [], competitorActions: [], staffIssues: [],
        },
    };
};

// --- Fresh Start Path ---

/**
 * Creates a brand-new business from scratch. Highest cost, lowest starting metrics.
 */
export const executeFreshStart = (
    locationId: string,
    businessType: BusinessType,
    gameDay: number,
    rng: SeededRandom
): { business: WorldBusiness | null; goldSpent: number } => {
    const template = BUSINESS_TEMPLATES[businessType];
    if (!template) {
        return { business: null, goldSpent: 0 };
    }

    const business: WorldBusiness = {
        id: `biz_player_${rng.nextInt(10000, 100000)}`,
        name: `New ${template.name}`,
        locationId,
        ownerId: 'player',
        ownerType: 'player',
        strongholdId: '',
        businessType,
        acquisitionType: 'founded',
        foundedDay: gameDay,
        daysSinceManaged: 0,
        managerEfficiency: 0,
        metrics: {
            customerSatisfaction: 30,
            reputation: 5,
            competitorPressure: 40,
            supplyChainHealth: 30,
            staffEfficiency: 20,
        },
        supplyContracts: [],
        dailyCustomers: 2,
        priceMultiplier: 1.0,
        competitorIds: [],
        lastDailyReport: {
            day: gameDay, revenue: 0, costs: 0, profit: 0,
            customersSatisfied: 0, customersLost: 0,
            supplyIssues: [], competitorActions: [], staffIssues: [],
        },
    };

    return { business, goldSpent: template.foundingCost };
};
