/**
 * @file src/systems/economy/NpcBusinessManager.ts
 * Manages NPC-owned businesses: generation, daily simulation, valuation,
 * and bankruptcy tracking. NPC businesses exist independently of strongholds.
 */
import { WorldBusiness, BusinessType, BusinessValuation } from '../../types/business';
import { EconomyState } from '../../types/economy';
import { Faction } from '../../types/factions';
import { SeededRandom } from '@/utils/random';
/**
 * Generates a thematic business name.
 */
export declare const generateBusinessName: (businessType: BusinessType, rng: SeededRandom) => string;
/**
 * Picks a random business type weighted by commonality.
 */
export declare const pickBusinessTypeForMerchant: (rng: SeededRandom) => BusinessType;
/**
 * Derive a business type (which decides the shop's stock) from the building /
 * merchant type, so a blacksmith building sells weapons and armor rather than a
 * random grab-bag. Falls to a general store for unrecognized types (a sensible,
 * deterministic default — not a random pick). Keyword-matched and order-sensitive
 * (specific trades before the generic "shop"/"store").
 */
export declare const businessTypeForMerchantType: (merchantType: string) => BusinessType;
interface MinimalNpc {
    id: string;
    name: string;
    role: string;
    biography?: {
        level: number;
        classId?: string;
    };
}
/**
 * Generates a WorldBusiness for an NPC merchant.
 */
export declare const generateNpcBusiness: (npc: MinimalNpc, locationId: string, businessType: BusinessType, gameDay: number, rng: SeededRandom) => WorldBusiness;
/**
 * Processes daily simulation for a single NPC-owned business.
 * Simplified variant — no stronghold dependency, uses businessSkill as staff efficiency.
 */
export declare const processNpcBusinessDaily: (business: WorldBusiness, economy: EconomyState, factions: Record<string, Faction>, gameDay: number, rng: SeededRandom) => WorldBusiness;
/**
 * Processes all NPC-owned world businesses for a daily tick.
 * NPC businesses with financialPressure > 90 for 30+ unprofitable days close (removed from record).
 */
export declare const processAllNpcBusinesses: (worldBusinesses: Record<string, WorldBusiness>, economy: EconomyState, factions: Record<string, Faction>, gameDay: number, rng: SeededRandom) => {
    worldBusinesses: Record<string, WorldBusiness>;
    closedBusinessIds: string[];
};
/**
 * Calculates the market value of a business.
 */
export declare const calculateBusinessValuation: (business: WorldBusiness, economy: EconomyState, regionId: string) => BusinessValuation;
export {};
