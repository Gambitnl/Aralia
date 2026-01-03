
/**
 * @file src/services/lootService.ts
 * Service for generating loot based on defeated enemies.
 */
import { Item, Monster } from '../types';
import { ITEMS, WEAPONS_DATA } from '../constants';
import { logger } from '../utils/logger';

interface LootResult {
  gold: number;
  items: Item[];
}

export function generateLoot(monsters: Monster[]): LootResult {
  const defaultResult: LootResult = { gold: 0, items: [] };

  try {
    let totalGold = 0;
    const droppedItems: Item[] = [];

    if (!Array.isArray(monsters)) {
      logger.warn("generateLoot received invalid monsters array", { monsters });
      return defaultResult;
    }

    monsters.forEach(monster => {
      if (!monster) return;
      const monsterId = (monster as any).id ?? 'unknown_monster';
      // TODO(2026-01-03 Codex-CLI): Monster typings lack stable IDs; synthesize for logging until data/model carries identifiers.

      // 1. Gold generation based on CR
      let baseGold = 0;
      try {
        if (monster.cr === '1/4' || monster.cr === '1/8') {
          baseGold = 1;
        } else if (monster.cr === '1/2') {
          baseGold = 5;
        } else {
          // Parse integer, fallback to 0 if invalid (e.g. "Unknown" or "-")
          const parsedCr = parseInt(monster.cr, 10);
          baseGold = isNaN(parsedCr) ? 0 : parsedCr * 10;
        }
      // TODO(lint-intent): Capture and log the parsing error if we need richer loot diagnostics.
      // TODO(lint-intent): Consider validating CR upstream to avoid runtime fallbacks here.
      } catch {
        logger.warn("Error parsing monster CR for gold", { cr: monster.cr, id: monsterId });
        baseGold = 0;
      }
      
      // Random variance +/- 50%
      const variance = (Math.random() * 1.0) + 0.5;
      totalGold += Math.floor(baseGold * variance);

      // 2. Item Drops
      // 15% chance for an item per monster
      try {
        if (Math.random() < 0.15) {
          // Safely handle missing/undefined description
          const tags = (monster.description || "").toLowerCase();

          // Logic to pick items based on monster tags
          if (tags.includes('goblin') || tags.includes('orc')) {
             // Humanoids drop weapons or potions
             // Validate WEAPONS_DATA exists before keys access
             if (WEAPONS_DATA) {
               const weaponKeys = Object.keys(WEAPONS_DATA);
               if (weaponKeys.length > 0) {
                 const randomKey = weaponKeys[Math.floor(Math.random() * weaponKeys.length)];
                 const randomWeapon = WEAPONS_DATA[randomKey];
                 if (randomWeapon) droppedItems.push(randomWeapon);
               }
             }
          } else if (tags.includes('beast') || tags.includes('wolf') || tags.includes('spider')) {
             // Beasts might drop "trophies" (using generic items for now)
             // Future: Add specific crafting materials
          } else {
             // Fallback: Healing Potion
             if (ITEMS && ITEMS['healing_potion']) {
               droppedItems.push(ITEMS['healing_potion']);
             }
          }
        }
      } catch (itemError) {
        logger.warn("Error generating item drop for monster", { id: monsterId, error: itemError });
      }
    });

    return {
      gold: Math.max(0, totalGold), // Ensure non-negative
      items: droppedItems
    };

  } catch (error) {
    logger.error("Critical failure in generateLoot", { error });
    return defaultResult;
  }
}
