import { GlossaryEntry } from '../types/ui.js';
import { Item, ItemType, ItemRarity } from '../types/items.js';

/**
 * Converts a 5etools ingested glossary entry into a fully functional
 * engine Item, complete with mechanical stats.
 */
export function convertGlossaryEntryToItem(entry: GlossaryEntry): Item | null {
    if (!entry.itemMetadata) return null;
    const meta = entry.itemMetadata;

    let type: ItemType = ItemType.Treasure;
    const rawType = meta.type?.toLowerCase() || '';
    
    if (rawType.includes('weapon') || rawType.includes('ammunition') || rawType.includes('explosive')) type = ItemType.Weapon;
    else if (rawType.includes('armor') || rawType.includes('shield')) type = ItemType.Armor;
    else if (rawType.includes('potion')) type = ItemType.Potion;
    else if (rawType.includes('scroll')) type = ItemType.Scroll;
    else if (rawType.includes('ring') || rawType.includes('wondrous') || rawType.includes('accessory')) type = ItemType.Accessory;
    else if (rawType.includes('tool') || rawType.includes('instrument') || rawType.includes('gaming') || rawType.includes('focus') || rawType.includes('rod') || rawType.includes('wand') || rawType.includes('staff')) type = ItemType.Tool;
    else if (rawType.includes('trade') || rawType.includes('material')) type = ItemType.CraftingMaterial;
    else if (rawType.includes('food') || rawType.includes('drink')) type = ItemType.FoodDrink;
    else if (rawType.includes('book') || rawType.includes('tome')) type = ItemType.Book;
    else if (rawType.includes('clothing') || rawType.includes('apparel')) type = ItemType.Clothing;
    else type = ItemType.Treasure;

    let rarity: ItemRarity = ItemRarity.Common;
    if (meta.rarity) {
        const matched = Object.values(ItemRarity).find(r => r.toLowerCase() === meta.rarity?.toLowerCase());
        if (matched) rarity = matched;
    }

    const item: Item = {
        id: entry.id,
        name: entry.title,
        description: entry.excerpt || '',
        type,
        rarity,
        weight: meta.weight,
        costInGp: meta.cost,
        properties: meta.properties,
        damageDice: meta.damage ? meta.damage.split(' ')[0] : undefined,
        damageType: meta.damage ? meta.damage.split(' ').slice(1).join(' ') : undefined,
    };

    if (meta.ac !== undefined) {
        if (type === ItemType.Armor || meta.type?.toLowerCase().includes('shield')) {
            item.baseArmorClass = meta.ac;
        } else {
            item.armorClassBonus = meta.ac;
        }
    }

    return item;
}
