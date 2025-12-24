
/**
 * @file src/services/lootService.ts
 * Service for generating loot based on defeated enemies.
 */
import { Item, Monster } from '../types';
import { ITEMS, WEAPONS_DATA } from '../constants';

interface LootResult {
  gold: number;
  items: Item[];
}

export function generateLoot(monsters: Monster[]): LootResult {
  let totalGold = 0;
  const droppedItems: Item[] = [];

  monsters.forEach(monster => {
    // 1. Gold generation based on CR (simplified)
    // CR 1/4 = ~1g, CR 1 = ~10g
    const baseGold = monster.cr === '1/4' || monster.cr === '1/8' ? 1 : 
                     monster.cr === '1/2' ? 5 : 
                     parseInt(monster.cr) * 10;
    
    // Random variance +/- 50%
    const variance = (Math.random() * 1.0) + 0.5; 
    totalGold += Math.floor(baseGold * variance);

    // 2. Item Drops
    // 15% chance for an item per monster
    if (Math.random() < 0.15) {
      const tags = monster.description.toLowerCase();
      
      // Logic to pick items based on monster tags
      if (tags.includes('goblin') || tags.includes('orc')) {
         // Humanoids drop weapons or potions
         const weaponKeys = Object.keys(WEAPONS_DATA);
         const randomWeapon = WEAPONS_DATA[weaponKeys[Math.floor(Math.random() * weaponKeys.length)]];
         droppedItems.push(randomWeapon);
      } else if (tags.includes('beast') || tags.includes('wolf') || tags.includes('spider')) {
         // Beasts might drop "trophies" (using generic items for now)
         // Future: Add specific crafting materials
      } else {
         // Fallback: Healing Potion
         droppedItems.push(ITEMS['healing_potion']);
      }
    }
  });

  // TODO(Recorder): Use generateLegendaryHistory for Rare/Legendary items so they have a backstory.

  return {
    gold: totalGold,
    items: droppedItems
  };
}
