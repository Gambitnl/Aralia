/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/economy/LoanSystem.ts
 * Static utility class for the loan/lending system.
 * Factions offer loans based on player standing, faction type, and economic policy.
 */

import { Faction, PlayerFactionStanding } from '../../types/factions';
import { LoanOffer } from '../../types/economy';

/**
 * Gets available loan offers from factions the player can borrow from.
 * Loan terms depend on faction type, economic policy, and player standing.
 */
export const getAvailableLenders = (
    factions: Record<string, Faction>,
    standings: Record<string, PlayerFactionStanding>,
    playerGold: number
): LoanOffer[] => {
    const offers: LoanOffer[] = [];

    for (const faction of Object.values(factions)) {
        // Faction must have treasury to lend
        if (!faction.treasury || faction.treasury < 1000) continue;

        // Only certain faction types offer loans
        const lendingTypes = ['GUILD', 'NOBLE_HOUSE', 'CRIMINAL_SYNDICATE'];
        if (!lendingTypes.includes(faction.type)) continue;

        const standing = standings[faction.id];
        if (!standing) continue;

        // Must have at least -20 standing to get a loan (not outright hostile)
        if (standing.publicStanding < -20) continue;

        const interestRate = calculateInterestRate(standing, faction);
        const maxAmount = calculateMaxLoanAmount(faction, standing, playerGold);

        if (maxAmount < 100) continue; // Not worth offering tiny loans

        offers.push({
            lenderId: faction.id,
            lenderName: faction.name,
            factionId: faction.id,
            maxAmount,
            interestRate,
            minDuration: 7,
            maxDuration: calculateMaxDuration(faction, standing),
            collateralRequired: maxAmount > faction.treasury * 0.2 ? 'stronghold' : 'none'
        });
    }

    return offers;
};

/**
 * Calculates interest rate based on player standing and faction type.
 * Better standing = lower rates. Criminal syndicates charge more.
 */
export const calculateInterestRate = (
    standing: PlayerFactionStanding,
    faction: Faction
): number => {
    // Base rates by faction type
    let baseRate: number;
    switch (faction.type) {
        case 'GUILD':
            baseRate = 0.08; // 8% — competitive
            break;
        case 'NOBLE_HOUSE':
            baseRate = 0.10; // 10% — formal
            break;
        case 'CRIMINAL_SYNDICATE':
            baseRate = 0.20; // 20% — loan shark rates
            break;
        default:
            baseRate = 0.12;
    }

    // Economic policy modifier
    switch (faction.economicPolicy) {
        case 'mercantile':
            baseRate *= 0.85; // 15% discount — they want to lend
            break;
        case 'exploitative':
            baseRate *= 1.3; // 30% surcharge — predatory
            break;
        case 'protectionist':
            baseRate *= 1.1; // Slightly higher — bureaucracy
            break;
        case 'free_trade':
            baseRate *= 0.9; // 10% discount
            break;
    }

    // Standing modifier: -100 to +100 maps to +50% to -30% rate adjustment
    const standingMod = 1 + ((-standing.publicStanding) / 100 * 0.4);
    baseRate *= Math.max(0.5, standingMod);

    // Rank bonus
    if (standing.rankId === 'veteran') baseRate *= 0.8;
    else if (standing.rankId === 'member') baseRate *= 0.9;

    return Math.round(baseRate * 1000) / 1000; // Round to 0.1%
};

/**
 * Calculates maximum loan amount a faction will offer.
 */
const calculateMaxLoanAmount = (
    faction: Faction,
    standing: PlayerFactionStanding,
    playerGold: number
): number => {
    // Base: up to 20% of faction treasury
    let maxFromTreasury = faction.treasury * 0.2;

    // Standing bonus: friendly factions lend more
    if (standing.publicStanding > 50) {
        maxFromTreasury *= 1.5;
    } else if (standing.publicStanding > 20) {
        maxFromTreasury *= 1.2;
    } else if (standing.publicStanding < 0) {
        maxFromTreasury *= 0.5;
    }

    // Criminal syndicates lend aggressively (they want you in debt)
    if (faction.type === 'CRIMINAL_SYNDICATE') {
        maxFromTreasury *= 1.5;
    }

    // Cap at 5x player's current gold (risk management)
    const maxFromPlayerWealth = playerGold * 5;

    return Math.round(Math.min(maxFromTreasury, maxFromPlayerWealth));
};

/**
 * Calculates maximum loan duration in days.
 */
const calculateMaxDuration = (
    faction: Faction,
    standing: PlayerFactionStanding
): number => {
    let baseDuration = 30; // Default 30 days

    // Guilds offer longer terms
    if (faction.type === 'GUILD') baseDuration = 60;
    // Criminal syndicates want quick repayment
    if (faction.type === 'CRIMINAL_SYNDICATE') baseDuration = 14;

    // Better standing = longer allowed duration
    if (standing.publicStanding > 50) baseDuration = Math.round(baseDuration * 1.5);
    else if (standing.publicStanding > 20) baseDuration = Math.round(baseDuration * 1.2);

    return baseDuration;
};

/**
 * Calculates reputation consequences for defaulting on a loan.
 * Returns the standing penalty amount.
 */
export const calculateDefaultPenalty = (
    _investment: { principalGold: number; currentValue: number },
    faction: Faction
): number => {
    // Base penalty: -30 reputation
    let penalty = -30;

    // Criminal syndicates are harsher
    if (faction.type === 'CRIMINAL_SYNDICATE') penalty = -50;

    // Noble houses take personal offense
    if (faction.type === 'NOBLE_HOUSE') penalty = -40;

    return penalty;
};
