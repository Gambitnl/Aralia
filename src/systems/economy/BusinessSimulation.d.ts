/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/economy/BusinessSimulation.ts
 * Static utility class for daily business simulation.
 * Processes revenue, supply chains, competition, staff efficiency,
 * and customer satisfaction for player-owned businesses.
 */
import { BusinessState, BusinessDailyReport } from '../../types/business';
import { EconomyState, TradeRoute } from '../../types/economy';
import { Faction } from '../../types/factions';
import { Stronghold } from '../../types/stronghold';
import { SeededRandom } from '@/utils/random';
export interface BusinessDailyResult {
    business: BusinessState;
    stronghold: Stronghold;
    report: BusinessDailyReport;
}
export interface AllBusinessesResult {
    businesses: Record<string, BusinessState>;
    strongholds: Record<string, Stronghold>;
    reports: BusinessDailyReport[];
}
/**
 * Processes daily simulation for a single business.
 */
export declare const processBusinessDaily: (business: BusinessState, stronghold: Stronghold, economy: EconomyState, factions: Record<string, Faction>, gameDay: number, rng: SeededRandom) => BusinessDailyResult;
/**
 * Process all player businesses for a daily tick.
 */
export declare const processAllBusinesses: (businesses: Record<string, BusinessState>, strongholds: Record<string, Stronghold>, economy: EconomyState, factions: Record<string, Faction>, gameDay: number, rng: SeededRandom) => AllBusinessesResult;
/**
 * Calculates supply chain health based on supply contracts and trade route status.
 * A business with disrupted supply routes suffers.
 */
export declare const calculateSupplyChainHealth: (business: BusinessState, tradeRoutes: TradeRoute[]) => number;
