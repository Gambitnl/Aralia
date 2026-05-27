import * as fs from 'fs';
import * as path from 'path';

const ENTRIES_BASE = path.join(process.cwd(), 'public/data/glossary/entries');
const EQUIPMENT_DIR = path.join(ENTRIES_BASE, 'equipment');
const MAGIC_ITEMS_DIR = path.join(ENTRIES_BASE, 'magic_items');
const OUT_FILE = path.join(process.cwd(), 'src/data/items/generatedGlossaryItems.ts');

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
    } else {
      if (file.endsWith('.json')) {
        arrayOfFiles.push(path.join(dirPath, file));
      }
    }
  });
  return arrayOfFiles;
}

const allFiles = [
  ...getAllFiles(EQUIPMENT_DIR),
  ...getAllFiles(MAGIC_ITEMS_DIR)
];

const generatedItems: Record<string, any> = {};

// Simple heuristic for icons
function getIconForType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('sword') || t.includes('blade') || t.includes('scimitar') || t.includes('rapier')) return 'sword';
  if (t.includes('axe') || t.includes('halberd')) return 'axe_battle';
  if (t.includes('bow') || t.includes('crossbow')) return 'bow_arrow';
  if (t.includes('hammer') || t.includes('mace') || t.includes('club')) return 'hammer';
  if (t.includes('spear') || t.includes('pike') || t.includes('lance')) return 'spear';
  if (t.includes('shield')) return 'shield';
  if (t.includes('armor') || t.includes('mail') || t.includes('plate') || t.includes('leather')) return 'shield';
  if (t.includes('potion')) return 'flask_mdi';
  if (t.includes('ring')) return 'ring';
  if (t.includes('staff')) return 'magic_staff';
  if (t.includes('wand')) return 'magic';
  if (t.includes('rod')) return 'magic_staff';
  if (t.includes('wondrous')) return 'sparkle';
  return 'package';
}

function mapWeaponProperties(props: string[]): string[] {
    const propertyMap: Record<string, string> = {
        'V|XPHB': 'Versatile',
        'L|XPHB': 'Light',
        'F|XPHB': 'Finesse',
        'T|XPHB': 'Thrown',
        'H|XPHB': 'Heavy',
        '2H|XPHB': 'Two-Handed',
        'R|XPHB': 'Reach',
        'A|XPHB': 'Ammunition',
        'LD|XPHB': 'Loading'
    };
    return props.map(p => {
      let uid = '';
      if (typeof p === 'string') {
        uid = p;
      } else if (typeof p === 'object' && p !== null && 'uid' in p) {
        uid = (p as any).uid;
      } else {
        return 'Special';
      }
      return propertyMap[uid] || uid.split('|')[0];
    });
}

function parseItemEffect(markdown: string): any {
  if (!markdown) return undefined;
  // Match "regains XdY + Z [[hit_points" or "regains X [[hit_points"
  const healMatch = markdown.match(/regains\s+((?:\d+d\d+)(?:\s*\+\s*\d+)?|\d+)\s+\[\[hit_points/i);
  if (healMatch) {
    const amountStr = healMatch[1].replace(/\s/g, '');
    if (amountStr.includes('d')) {
      return { type: 'heal', value: 0, dice: amountStr };
    } else {
      return { type: 'heal', value: parseInt(amountStr, 10) };
    }
  }
  return undefined;
}


for (const file of allFiles) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data.itemMetadata) continue;

    const meta = data.itemMetadata;
    const id = data.id;
    const name = data.title;
    const description = data.excerpt || '';

    let itemType = 'treasure';
    let slot = undefined;
    let armorCategory = undefined;

    const t = (meta.type || '').toLowerCase();
    
    // Determine Type and Slot
    if (t.includes('weapon')) {
      itemType = 'weapon';
      slot = 'MainHand';
    } else if (t.includes('armor')) {
      itemType = 'armor';
      slot = 'Torso';
      if (t.includes('light')) armorCategory = 'Light';
      else if (t.includes('medium')) armorCategory = 'Medium';
      else if (t.includes('heavy')) armorCategory = 'Heavy';
    } else if (t.includes('shield')) {
      itemType = 'armor';
      slot = 'OffHand';
      armorCategory = 'Shield';
    } else if (t.includes('ring')) {
      itemType = 'accessory';
      slot = 'Ring';
    } else if (t.includes('potion')) {
      itemType = 'consumable';
    } else if (t.includes('staff') || t.includes('wand') || t.includes('rod')) {
      itemType = 'weapon'; // Or accessory depending on mechanics, we default to weapon for staffs
      slot = 'MainHand';
    } else if (t.includes('wondrous') || t.includes('accessory')) {
      itemType = 'accessory';
    }

    let iconString = getIconForType(name + ' ' + t);
    const svgPath = path.join(process.cwd(), 'public', 'assets', 'icons', 'items', `${id}.svg`);
    if (fs.existsSync(svgPath)) {
      iconString = `/assets/icons/items/${id}.svg`;
    }

    const item: any = {
      id,
      name,
      description,
      type: itemType,
      icon: iconString,
      weight: meta.weight,
    };

    if (meta.cost !== undefined) {
      item.cost = `${meta.cost} GP`;
      item.costInGp = meta.cost;
    }

    if (slot) item.slot = slot;
    if (armorCategory) item.armorCategory = armorCategory;

    // Damage parsing: "1d8 S" -> damageDice: "1d8", damageType: "Slashing"
    if (meta.damage) {
      const parts = meta.damage.split(' ');
      if (parts.length > 0) item.damageDice = parts[0];
      if (parts.length > 1) {
        const dType = parts[1].toLowerCase();
        if (dType.startsWith('s')) item.damageType = 'Slashing';
        else if (dType.startsWith('p')) item.damageType = 'Piercing';
        else if (dType.startsWith('b')) item.damageType = 'Bludgeoning';
        else item.damageType = parts[1]; // fallback
      }
    }

    if (meta.properties) {
      item.properties = mapWeaponProperties(meta.properties);
    }

    if (meta.ac) {
      if (itemType === 'armor' && armorCategory !== 'Shield') {
        item.baseArmorClass = meta.ac;
      } else {
        item.armorClassBonus = meta.ac;
      }
    }

    if (meta.rarity && meta.rarity !== 'None') {
      const r = meta.rarity.toLowerCase();
      if (r === 'common') item.rarity = 'ItemRarity.Common';
      else if (r === 'uncommon') item.rarity = 'ItemRarity.Uncommon';
      else if (r === 'rare') item.rarity = 'ItemRarity.Rare';
      else if (r === 'very rare') item.rarity = 'ItemRarity.VeryRare';
      else if (r === 'legendary') item.rarity = 'ItemRarity.Legendary';
      else if (r === 'artifact') item.rarity = 'ItemRarity.Artifact';
    }

    if (meta.reqAttune) {
      item.magicProperties = {
        isIdentified: true,
        attunement: {
          required: true,
          requirements: meta.reqAttune
        }
      };
    }

    const parsedEffect = parseItemEffect(data.markdown || '');
    if (parsedEffect) {
      item.effect = parsedEffect;
    }

    generatedItems[id] = item;
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err);
  }
}

let jsonString = JSON.stringify(generatedItems, null, 2);
// Replace stringified enums with actual enum references
jsonString = jsonString.replace(/"ItemRarity\.([^"]+)"/g, 'ItemRarity.$1');

const fileContent = `/**
 * @file generatedGlossaryItems.ts
 * AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
 * 
 * Generated from public/data/glossary/entries/equipment and magic_items.
 */

import { Item, ItemRarity } from '../../types/index.js';

export const GENERATED_GLOSSARY_ITEMS: Record<string, Item> = ${jsonString} as any;
`;

fs.writeFileSync(OUT_FILE, fileContent, 'utf8');
console.log(`Generated ${Object.keys(generatedItems).length} items into src/data/items/generatedGlossaryItems.ts`);
