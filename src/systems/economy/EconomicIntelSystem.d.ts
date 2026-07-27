/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/economy/EconomicIntelSystem.ts
 * Medieval information delivery system.
 * Economic reports arrive via couriers with delay. Market intel is bought at taverns.
 * Investment results come as letters days after the event.
 * No instant data — information trickles through the world.
 */
import { EconomyState, PendingCourier, PlayerInvestment } from '../../types/economy';
import { SeededRandom } from '@/utils/random';
/**
 * Calculates courier delivery delay based on distance between regions.
 * Adjacent regions: 1 day. Far regions: up to 5 days.
 * This is a simplified distance model — could be enhanced with actual region graph.
 */
export declare const calculateIntelDelay: (sourceRegionId: string, playerRegionId: string) => number;
/**
 * Generates an economic rumor that a player might overhear at a tavern.
 * Rumors have varying accuracy — some are wrong or exaggerated.
 */
export declare const generateEconomicRumor: (economy: EconomyState, playerRegionId: string, targetRegionId: string, rng: SeededRandom) => PendingCourier | null;
/**
 * Generates a courier message for a completed/failed investment.
 */
export declare const generateInvestmentCourier: (investment: PlayerInvestment, playerRegionId: string, currentDay: number, rng: SeededRandom) => PendingCourier;
/**
 * Filters investment information based on what the player should know.
 * The player only learns about investment results after the courier delay.
 */
export declare const filterVisibleInvestmentInfo: (investments: PlayerInvestment[], _playerRegionId: string, gameDay: number) => PlayerInvestment[];
/**
 * Process courier delivery: find all couriers whose deliveryDay has arrived.
 * Returns messages to deliver and remaining pending couriers.
 */
export declare const processDeliveries: (couriers: PendingCourier[], currentDay: number) => {
    delivered: PendingCourier[];
    remaining: PendingCourier[];
};
