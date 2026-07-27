/**
 * @file src/services/lootService.ts
 * Service for generating loot based on defeated enemies.
 */
import { Item, Monster } from '../types';
interface LootResult {
    gold: number;
    items: Item[];
}
export declare function generateLoot(monsters: Monster[]): LootResult;
export {};
