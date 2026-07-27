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
 * Process daily faction economics for all factions.
 * Updates treasuries, handles income/expenses, and triggers route competition.
 */
export declare const processFactionDailyEconomics: (factions: Record<string, Faction>, economy: EconomyState, rng: SeededRandom) => FactionEconomyResult;
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
export declare const factionCompeteForRoute: (attacker: Faction, defender: Faction, _route: TradeRoute, rng: SeededRandom) => RouteCompetitionResult;
/**
 * Calculates the tax a faction charges on player commerce in their controlled region.
 * Returns the gold amount to deduct from a transaction.
 */
export declare const calculateFactionTaxOnTransaction: (regionId: string, factions: Record<string, Faction>, transactionGold: number) => {
    taxAmount: number;
    factionId: string | null;
    factionName: string | null;
};
/**
 * Returns a price multiplier bonus/penalty based on the player's standing with
 * the faction that controls a region. Friendly = discounts, hostile = surcharge.
 *
 * @returns Multiplier adjustment (e.g., -0.1 means 10% cheaper, +0.15 means 15% more)
 */
export declare const getFactionTradeBonus: (regionId: string, factions: Record<string, Faction>, standings: Record<string, PlayerFactionStanding>) => number;
