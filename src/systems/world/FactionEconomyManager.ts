/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/world/FactionEconomyManager.ts
 * Static utility class managing faction economics:
 * treasury, tax collection, trade route competition, and player trade bonuses.
 */

import { Faction, PlayerFactionStanding } from '../../types/factions';
import { EconomyState, TradeRoute } from '../../types/economy';
import { SeededRandom } from '@/utils/random';

export interface FactionEconomyResult {
    factions: Record<string, Faction>;
    logs: string[];
}

/**
 * Calculates daily passive income for a faction based on controlled routes
 * and regions. Factions with `mercantile` policy earn more from routes,
 * `exploitative` factions squeeze more tax, and `protectionist` factions
 * spend gold on defending routes.
 */
const calculateFactionDailyIncome = (
    faction: Faction,
    tradeRoutes: TradeRoute[]
): number => {
    let income = 0;

    // Base income from controlled trade routes
    for (const routeId of faction.controlledRouteIds) {
        const route = tradeRoutes.find(r => r.id === routeId);
        if (!route || route.status !== 'active') continue;

        // Route profitability (0-100) contributes to daily income
        const routeIncome = route.profitability * 0.5;

        // Policy modifier
        switch (faction.economicPolicy) {
            case 'mercantile':
                income += routeIncome * 1.3; // +30% route income
                break;
            case 'exploitative':
                income += routeIncome * 1.5; // +50% but risks disruption
                break;
            case 'free_trade':
                income += routeIncome * 1.1; // +10% — low tax encourages volume
                break;
            case 'protectionist':
                income += routeIncome * 0.8; // -20% — heavy regulation
                break;
            default:
                income += routeIncome;
        }
    }

    // Base income from controlled regions (tax revenue)
    const regionTaxPerDay = faction.controlledRegionIds.length * (faction.taxRate * 2);
    income += regionTaxPerDay;

    return Math.round(income);
};

/**
 * Calculates daily expenses for a faction: military upkeep, route maintenance,
 * and policy-specific costs.
 */
const calculateFactionDailyExpenses = (
    faction: Faction,
    tradeRoutes: TradeRoute[]
): number => {
    let expenses = 0;

    // Military upkeep scales with power
    expenses += faction.power * 1.5;

    // Route maintenance
    for (const routeId of faction.controlledRouteIds) {
        const route = tradeRoutes.find(r => r.id === routeId);
        if (!route) continue;

        if (route.status === 'disrupted') {
            expenses += 50; // Extra cost to repair
        } else if (route.status === 'blockaded') {
            expenses += 100; // Heavy cost fighting blockade
        } else {
            expenses += 10; // Normal maintenance
        }
    }

    // Policy-specific overhead
    switch (faction.economicPolicy) {
        case 'protectionist':
            expenses += faction.controlledRegionIds.length * 20; // Garrison costs
            break;
        case 'exploitative':
            expenses += 10; // Minimal — they don't invest in maintenance
            break;
        case 'mercantile':
            expenses += faction.controlledRouteIds.length * 15; // Trade infrastructure
            break;
        case 'free_trade':
            expenses += 5; // Minimal bureaucracy
            break;
    }

    return Math.round(expenses);
};

/**
 * Process daily faction economics for all factions.
 * Updates treasuries, handles income/expenses, and triggers route competition.
 */
export const processFactionDailyEconomics = (
    factions: Record<string, Faction>,
    economy: EconomyState,
    rng: SeededRandom
): FactionEconomyResult => {
    const updatedFactions = { ...factions };
    const logs: string[] = [];
    const tradeRoutes = economy.tradeRoutes || [];

    for (const factionId of Object.keys(updatedFactions)) {
        const faction = updatedFactions[factionId];
        if (faction.treasury === undefined) continue; // Skip factions without economy data

        const income = calculateFactionDailyIncome(faction, tradeRoutes);
        const expenses = calculateFactionDailyExpenses(faction, tradeRoutes);
        const netChange = income - expenses;

        const newTreasury = Math.max(0, faction.treasury + netChange);

        updatedFactions[factionId] = {
            ...faction,
            treasury: newTreasury
        };

        // Log notable treasury changes
        if (newTreasury <= 0 && faction.treasury > 0) {
            logs.push(`${faction.name} has run out of gold. Their influence may soon wane.`);
        }
    }

    // Route competition: factions may attempt to seize uncontrolled or rival routes
    const competitionResult = processRouteCompetition(updatedFactions, tradeRoutes, rng);
    const finalFactions = competitionResult.factions;
    logs.push(...competitionResult.logs);

    return { factions: finalFactions, logs };
};

/**
 * Factions compete for control of trade routes.
 * Uncontrolled routes can be claimed. Controlled routes can be contested
 * by rival/enemy factions with sufficient power and treasury.
 */
const processRouteCompetition = (
    factions: Record<string, Faction>,
    tradeRoutes: TradeRoute[],
    rng: SeededRandom
): FactionEconomyResult => {
    const updatedFactions = { ...factions };
    const logs: string[] = [];

    // Only attempt route competition 10% of the time (once every ~10 days)
    if (rng.next() > 0.1) return { factions: updatedFactions, logs };

    for (const route of tradeRoutes) {
        if (route.status === 'blockaded') continue; // Can't compete for blockaded routes

        const controllerId = route.controllingFactionId;

        if (!controllerId) {
            // Uncontrolled route — strongest nearby faction claims it
            const claimant = findStrongestClaimant(updatedFactions, route);
            if (claimant) {
                updatedFactions[claimant.id] = {
                    ...updatedFactions[claimant.id],
                    controlledRouteIds: [...updatedFactions[claimant.id].controlledRouteIds, route.id]
                };
                logs.push(`${claimant.name} has established control over the ${route.name}.`);
            }
        } else if (updatedFactions[controllerId]) {
            // Controlled route — enemies may contest it
            const challenger = findChallenger(updatedFactions, controllerId, route, rng);
            if (challenger) {
                const result = factionCompeteForRoute(
                    updatedFactions[challenger.id],
                    updatedFactions[controllerId],
                    route,
                    rng
                );
                if (result.winner.id !== controllerId) {
                    // Route changed hands
                    updatedFactions[controllerId] = {
                        ...updatedFactions[controllerId],
                        controlledRouteIds: updatedFactions[controllerId].controlledRouteIds.filter(
                            id => id !== route.id
                        ),
                        treasury: updatedFactions[controllerId].treasury - result.defenderCost
                    };
                    updatedFactions[result.winner.id] = {
                        ...updatedFactions[result.winner.id],
                        controlledRouteIds: [...updatedFactions[result.winner.id].controlledRouteIds, route.id],
                        treasury: updatedFactions[result.winner.id].treasury - result.attackerCost
                    };
                    logs.push(
                        `${result.winner.name} has seized the ${route.name} from ${updatedFactions[controllerId].name}!`
                    );
                } else {
                    // Defender held — both sides pay costs
                    updatedFactions[controllerId] = {
                        ...updatedFactions[controllerId],
                        treasury: Math.max(0, updatedFactions[controllerId].treasury - result.defenderCost)
                    };
                    updatedFactions[challenger.id] = {
                        ...updatedFactions[challenger.id],
                        treasury: Math.max(0, updatedFactions[challenger.id].treasury - result.attackerCost)
                    };
                }
            }
        }
    }

    return { factions: updatedFactions, logs };
};

/**
 * Finds the strongest faction that could claim an uncontrolled route.
 * Considers factions whose trade priorities align with the route's goods.
 */
const findStrongestClaimant = (
    factions: Record<string, Faction>,
    route: TradeRoute
): Faction | null => {
    let best: Faction | null = null;
    let bestScore = 0;

    for (const faction of Object.values(factions)) {
        if (faction.treasury === undefined || faction.treasury < 500) continue;

        // Does this faction care about goods on this route?
        const routeGoods = route.goods || route.resources || [];
        const overlap = routeGoods.filter(g =>
            faction.tradeGoodPriorities?.some(p => g.toLowerCase().includes(p.toLowerCase()))
        ).length;

        if (overlap === 0 && routeGoods.length > 0) continue;

        const score = faction.power + overlap * 10 + (faction.treasury / 1000);
        if (score > bestScore) {
            bestScore = score;
            best = faction;
        }
    }

    return best;
};

/**
 * Finds a faction willing to challenge the current route controller.
 */
const findChallenger = (
    factions: Record<string, Faction>,
    controllerId: string,
    _route: TradeRoute,
    rng: SeededRandom
): Faction | null => {
    const candidates: Faction[] = [];

    for (const faction of Object.values(factions)) {
        if (faction.id === controllerId) continue;
        if (faction.treasury === undefined || faction.treasury < 2000) continue;

        // Only enemies or rivals challenge
        const isEnemy = faction.enemies.includes(controllerId);
        const isRival = faction.rivals.includes(controllerId);
        if (!isEnemy && !isRival) continue;

        // Must have meaningful power
        const controller = factions[controllerId];
        if (faction.power < controller.power * 0.6) continue;

        candidates.push(faction);
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(rng.next() * candidates.length)];
};

export interface RouteCompetitionResult {
    winner: Faction;
    attackerCost: number;
    defenderCost: number;
}

/**
 * Resolves a direct competition between two factions for a trade route.
 * Power + treasury + randomness determine outcome.
 * Both sides pay gold regardless of outcome.
 */
export const factionCompeteForRoute = (
    attacker: Faction,
    defender: Faction,
    _route: TradeRoute,
    rng: SeededRandom
): RouteCompetitionResult => {
    // Base combat strength from power
    const attackStrength = attacker.power + (rng.next() * 30 - 15);
    const defendStrength = defender.power + (rng.next() * 30 - 15) + 10; // Defender advantage

    // Treasury bonus — wealthier factions can hire mercenaries
    const attackBonus = Math.min(20, attacker.treasury / 2000);
    const defendBonus = Math.min(20, defender.treasury / 2000);

    const finalAttack = attackStrength + attackBonus;
    const finalDefend = defendStrength + defendBonus;

    // Costs: losers pay more
    const baseCost = 500;
    const attackerCost = finalAttack > finalDefend ? baseCost : baseCost * 2;
    const defenderCost = finalAttack > finalDefend ? baseCost * 2 : baseCost;

    return {
        winner: finalAttack > finalDefend ? attacker : defender,
        attackerCost,
        defenderCost
    };
};

/**
 * Calculates the tax a faction charges on player commerce in their controlled region.
 * Returns the gold amount to deduct from a transaction.
 */
export const calculateFactionTaxOnTransaction = (
    regionId: string,
    factions: Record<string, Faction>,
    transactionGold: number
): { taxAmount: number; factionId: string | null; factionName: string | null } => {
    // Find which faction controls this region
    for (const faction of Object.values(factions)) {
        if (faction.controlledRegionIds?.includes(regionId)) {
            const taxAmount = Math.round(transactionGold * (faction.taxRate / 100) * 100) / 100;
            return { taxAmount, factionId: faction.id, factionName: faction.name };
        }
    }
    return { taxAmount: 0, factionId: null, factionName: null };
};

/**
 * Returns a price multiplier bonus/penalty based on the player's standing with
 * the faction that controls a region. Friendly = discounts, hostile = surcharge.
 *
 * @returns Multiplier adjustment (e.g., -0.1 means 10% cheaper, +0.15 means 15% more)
 */
export const getFactionTradeBonus = (
    regionId: string,
    factions: Record<string, Faction>,
    standings: Record<string, PlayerFactionStanding>
): number => {
    // Find controlling faction
    for (const faction of Object.values(factions)) {
        if (!faction.controlledRegionIds?.includes(regionId)) continue;

        const standing = standings[faction.id];
        if (!standing) return 0;

        const rep = standing.publicStanding;

        // Friendly (>30): discount up to 15%
        // Neutral (-30 to 30): no change
        // Hostile (<-30): surcharge up to 20%
        if (rep > 30) {
            // Scale from 0% at 30 to -15% at 100
            return -(Math.min(rep - 30, 70) / 70) * 0.15;
        } else if (rep < -30) {
            // Scale from 0% at -30 to +20% at -100
            return (Math.min(Math.abs(rep) - 30, 70) / 70) * 0.20;
        }

        return 0;
    }

    return 0;
};
