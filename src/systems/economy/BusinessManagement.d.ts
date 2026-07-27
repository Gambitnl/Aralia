/**
 * @file src/systems/economy/BusinessManagement.ts
 * Management simulation: decay mechanics, random business events,
 * NPC manager system, and ramp-up period for new businesses.
 */
import { WorldBusiness, BusinessEvent } from '../../types/business';
import { EconomyState } from '../../types/economy';
import { SeededRandom } from '@/utils/random';
/**
 * Processes management decay for a player-owned business.
 * Without a manager or player visits, metrics deteriorate over time.
 */
export declare const processManagementDecay: (business: WorldBusiness, _gameDay: number) => WorldBusiness;
interface MinimalNpcForManager {
    role: string;
    biography?: {
        level: number;
        classId?: string;
    };
}
/**
 * Calculates manager efficiency from an NPC's attributes.
 * Merchant NPCs are better managers than others.
 */
export declare const calculateManagerEfficiency: (npc: MinimalNpcForManager) => number;
/**
 * Calculates the daily wage cost for a manager based on their efficiency.
 */
export declare const calculateManagerWage: (efficiency: number) => number;
/**
 * Processes a potential random business event for the day.
 */
export declare const processBusinessEvent: (business: WorldBusiness, _economy: EconomyState, gameDay: number, rng: SeededRandom) => {
    business: WorldBusiness;
    event?: BusinessEvent;
};
/**
 * Applies customer caps for newly founded/acquired businesses.
 * First 30 days have progressively increasing customer caps.
 */
export declare const processNewBusinessRampUp: (business: WorldBusiness, gameDay: number) => WorldBusiness;
export interface ManagementDailyResult {
    worldBusinesses: Record<string, WorldBusiness>;
    events: BusinessEvent[];
}
/**
 * Processes management decay, events, and ramp-up for all player-owned worldBusinesses.
 */
export declare const processPlayerBusinessManagement: (worldBusinesses: Record<string, WorldBusiness>, economy: EconomyState, gameDay: number, rng: SeededRandom) => ManagementDailyResult;
export {};
