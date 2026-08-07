import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { strip5eToolsMarkup } from '../src/data/adapters/5eTools/shared';

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

// Simple heuristic for icons
export function getIconForType(type: string): string {
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

export function mapWeaponProperties(props: string[]): string[] {
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

export function parseItemEffect(markdown: string): any {
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

/**
 * Infer the wear slot for a wondrous accessory from its name.
 * Order matters: the first match wins, so more specific words come first.
 * Returns undefined when no word matches; the item stays slotless.
 */
export function inferAccessorySlot(name: string): string | undefined {
  const n = name.toLowerCase();
  const slotWords: Array<[string[], string]> = [
    [['gauntlet', 'glove'], 'Hands'],
    [['belt', 'girdle'], 'Belt'],
    [['cloak', 'mantle', 'cape'], 'Cloak'],
    [['amulet', 'necklace', 'periapt', 'medallion', 'talisman', 'brooch', 'scarab'], 'Neck'],
    [['headband', 'circlet', 'helm', 'hat ', 'crown', 'diadem', 'mask', 'goggles'], 'Head'],
    [['boots', 'slippers'], 'Feet'],
    [['bracers', 'wraps', 'bracelet'], 'Wrists'],
    [['robe'], 'Torso'],
  ];
  for (const [words, slot] of slotWords) {
    if (words.some(w => n.includes(w))) return slot;
  }
  return undefined;
}

/**
 * Convert a single glossary entry into a simplified registry item.
 *
 * This is the mechanical conversion seam (type / slot / damage / value /
 * rarity / attunement heuristics) extracted from the generation loop so it
 * can be exercised directly by acceptance tests (item_categorization IC-G3).
 * Returns `null` for entries without `itemMetadata` (the same entries the
 * generation loop skips).
 */
export function convertEntryToItem(data: any): { id: string; item: Record<string, any> } | null {
  if (!data.itemMetadata) return null;

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

  // Wondrous accessories need a wear slot or EQUIP_ITEM cannot place them,
  // which would keep their boons unreachable. The item name is the only slot
  // signal 5eTools provides for these, so infer from it.
  if (itemType === 'accessory' && !slot) {
    slot = inferAccessorySlot(name);
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

  // Lazily create the nested magicProperties block shared by the mechanical
  // fields below, so items without any magic facts stay lean.
  const magicProps = (): Record<string, any> => {
    if (!item.magicProperties) item.magicProperties = { isIdentified: true };
    return item.magicProperties;
  };

  if (meta.reqAttune) {
    // The runtime (characterReducer, statUtils) reads the FLAT
    // requiresAttunement field; the nested attunement block feeds display.
    // Both come from the same source fact so they cannot drift.
    item.requiresAttunement = true;
    magicProps().attunement = {
      required: true,
      // reqAttune arrives with raw 5eTools tags (e.g.
      // "{@item Belt of Dwarvenkind|XDMG}"). requirements renders as plain
      // text in the inventory, so resolve the tags to their display text
      // here rather than leaking markup into the shipped registry.
      requirements: strip5eToolsMarkup(meta.reqAttune)
    };
  }

  // Magic attack/damage bonus ("+1 Wraps of Unarmed Power"). partyStatUtils
  // reads magicProperties.magicalBonus for the equipped main-hand weapon.
  if (meta.bonusWeapon) {
    const bonus = parseInt(meta.bonusWeapon, 10);
    if (Number.isInteger(bonus) && bonus > 0) magicProps().magicalBonus = bonus;
  }

  // Magic AC bonus (Ring/Cloak of Protection, magic shields, magic armor).
  // calculateArmorClass reads the flat armorClassBonus and gates it on
  // attunement, so the magic part stays out of baseArmorClass.
  if (meta.bonusAc) {
    const bonus = parseInt(meta.bonusAc, 10);
    if (Number.isInteger(bonus) && bonus > 0) {
      item.armorClassBonus = (item.armorClassBonus || 0) + bonus;
      magicProps().acBonus = bonus;
    }
  }

  // Ability score facts. "set" items (Gauntlets of Ogre Power) become
  // statOverrides; "add" items (Belt of Dwarvenkind) become statBonuses.
  // Both are read by calculateFinalAbilityScores, gated on attunement.
  const abilityNameMap: Record<string, string> = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
  };
  const mapAbilityKeys = (source: Record<string, number> | undefined): Record<string, number> | undefined => {
    if (!source) return undefined;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(source)) {
      const fullName = abilityNameMap[key];
      if (fullName) out[fullName] = value;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };
  const statOverrides = mapAbilityKeys(meta.abilitySet);
  if (statOverrides) item.statOverrides = statOverrides;
  const statBonuses = mapAbilityKeys(meta.abilityBonus);
  if (statBonuses) item.statBonuses = statBonuses;

  // Charges (wands, staffs). The vendor data only uses dawn recharge.
  if (typeof meta.charges === 'number' && meta.charges > 0) {
    magicProps().charges = {
      current: meta.charges,
      max: meta.charges,
      resetCondition: meta.recharge === 'dawn' ? 'dawn' : 'never',
      ...(meta.rechargeAmount ? { resetDice: meta.rechargeAmount } : {}),
    };
  }

  const parsedEffect = parseItemEffect(data.markdown || '');
  if (parsedEffect) {
    item.effect = parsedEffect;
  }

  return { id, item };
}

function main(): void {
  const allFiles = [
    ...getAllFiles(EQUIPMENT_DIR),
    ...getAllFiles(MAGIC_ITEMS_DIR)
  ];

  const generatedItems: Record<string, any> = {};

  for (const file of allFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const converted = convertEntryToItem(data);
      if (!converted) continue;
      generatedItems[converted.id] = converted.item;
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
}

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1]
  ? path.resolve(process.argv[1]) === SCRIPT_FILE
  : false;

if (isDirectRun) {
  main();
}
