import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { strip5eToolsMarkup } from '../src/data/adapters/5eTools/shared';

const ENTRIES_BASE = path.join(process.cwd(), 'public/data/glossary/entries');
const EQUIPMENT_DIR = path.join(ENTRIES_BASE, 'equipment');
/**
 * GG-164: every folder the registry is built from. Magic items used to live in
 * a second folder, entries/magic_items/, which was merged into equipment/ and
 * no longer exists. The old scan skipped a missing folder in silence, so a
 * moved or renamed source would have shrunk the registry with no warning.
 * collectSourceFiles() now refuses a missing folder instead.
 */
export const ITEM_SOURCE_DIRS: readonly string[] = [EQUIPMENT_DIR];
const OUT_FILE = path.join(process.cwd(), 'src/data/items/generatedGlossaryItems.ts');


/** 5etools single-letter damage codes, plus the canonical names themselves. */
const DAMAGE_TYPE_BY_CODE: Record<string, string> = {
  a: 'Acid',
  b: 'Bludgeoning',
  c: 'Cold',
  f: 'Fire',
  o: 'Force',
  l: 'Lightning',
  n: 'Necrotic',
  p: 'Piercing',
  i: 'Poison',
  y: 'Psychic',
  r: 'Radiant',
  s: 'Slashing',
  t: 'Thunder',
};

const CANONICAL_DAMAGE_TYPES = Object.values(DAMAGE_TYPE_BY_CODE);

/**
 * Resolves a 5etools damage token to a canonical damage-type name. Returns
 * undefined when the token names no damage type, so the item is written with no
 * damage type rather than with a code the game cannot read.
 */
function resolveDamageType(token: string): string | undefined {
  const value = token.trim();
  const full = CANONICAL_DAMAGE_TYPES.find((name) => name.toLowerCase() === value.toLowerCase());
  if (full) return full;
  if (value.length === 1) return DAMAGE_TYPE_BY_CODE[value.toLowerCase()];
  return undefined;
}

/**
 * GG-164: every JSON file under the given source folders. A missing folder is
 * an error, not an empty list: the registry must never shrink quietly because
 * a source folder moved.
 */
export function collectSourceFiles(dirs: readonly string[] = ITEM_SOURCE_DIRS): string[] {
  const missing = dirs.filter((dir) => !fs.existsSync(dir) || !fs.statSync(dir).isDirectory());
  if (missing.length > 0) {
    throw new Error(
      `generateItemRegistry: item source folder not found: ${missing.join(', ')}. `
      + 'Update ITEM_SOURCE_DIRS in scripts/generateItemRegistry.ts to the folder that now holds these entries.',
    );
  }
  return dirs.flatMap((dir) => getAllFiles(dir));
}

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

/**
 * True when `word` occurs in `text` as a whole word, not inside another word.
 * GG-543: a substring test read "Adventuring Gear" as a ring, so all 92
 * Adventuring Gear items (Book, Torch, Rope...) became Ring accessories.
 */
export function hasWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, 'i').test(text);
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
  // Whole word only: "adventuring" contains "ring" (GG-543).
  if (hasWord(t, 'ring')) return 'ring';
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
 * GG-576: the game item type for each mundane 5eTools type. The key is the
 * WHOLE 5eTools type, compared exactly. Each value is an existing ItemType;
 * Adventuring Gear follows the hand-authored gear in adventuringGear.ts,
 * which types general gear (Backpack, Rope, Tinderbox) as tool.
 *
 * Treasure (Gemstone), Treasure (Art Object) and Trade Bar are not here: they
 * stay treasure, which is right for valuables.
 *
 * Mount, Vehicle and Spellcasting Focus use the types that Remy ruled on
 * 2026-11-02 (GG-576). The types carry data only; no riding or driving rules.
 */
const ITEM_TYPE_BY_SOURCE_TYPE: Record<string, string> = {
  'Adventuring Gear': 'tool',
  'Ammunition': 'ammunition',
  "Artisan's Tools": 'tool',
  'Tool': 'tool',
  'Gaming Set': 'tool',
  'Instrument': 'tool',
  'Food and Drink': 'food_drink',
  'Scroll': 'scroll',
  'Explosive': 'consumable',
  'Tack and Harness': 'tool',
  'Trade Good': 'crafting_material',
  'Mount': 'mount',
  'Vehicle (Land)': 'vehicle',
  'Vehicle (Water)': 'vehicle',
  'Vehicle (Air)': 'vehicle',
  'Spellcasting Focus': 'spellcasting_focus',
};

/**
 * GG-576: single items whose 5eTools type is too broad. "Adventuring Gear"
 * holds books, lights, clothes, poisons and food, and the glossary source
 * names no finer kind, so the item id is the only signal. Each value uses
 * an existing ItemType and, for clothes, the Torso slot that the hand-authored
 * Common Clothes use.
 */
const ITEM_TYPE_BY_ID: Record<string, { type: string; slot?: string }> = {
  // Adventuring Gear
  book: { type: 'book' },
  map: { type: 'map' },
  torch: { type: 'light_source' },
  candle: { type: 'light_source' },
  lamp: { type: 'light_source' },
  bullseye_lantern: { type: 'light_source' },
  hooded_lantern: { type: 'light_source' },
  fine_clothes: { type: 'clothing', slot: 'Torso' },
  traveler_s_clothes: { type: 'clothing', slot: 'Torso' },
  costume: { type: 'clothing', slot: 'Torso' },
  robe: { type: 'clothing', slot: 'Torso' },
  rations: { type: 'food_drink' },
  acid: { type: 'consumable' },
  alchemist_s_fire: { type: 'consumable' },
  antitoxin: { type: 'consumable' },
  holy_water: { type: 'consumable' },
  oil: { type: 'consumable' },
  hunting_trap: { type: 'trap' },
  caltrops: { type: 'trap' },
  ball_bearings: { type: 'trap' },
  trinket: { type: 'treasure' },
  basic_poison: { type: 'poison_toxin' },
  assassin_s_blood: { type: 'poison_toxin' },
  burnt_othur_fumes: { type: 'poison_toxin' },
  carrion_crawler_mucus: { type: 'poison_toxin' },
  essence_of_ether: { type: 'poison_toxin' },
  lolth_s_sting: { type: 'poison_toxin' },
  malice: { type: 'poison_toxin' },
  midnight_tears: { type: 'poison_toxin' },
  oil_of_taggit: { type: 'poison_toxin' },
  pale_tincture: { type: 'poison_toxin' },
  purple_worm_poison: { type: 'poison_toxin' },
  serpent_venom: { type: 'poison_toxin' },
  torpor: { type: 'poison_toxin' },
  truth_serum: { type: 'poison_toxin' },
  wyvern_poison: { type: 'poison_toxin' },
  // Tack and Harness
  feed_per_day: { type: 'food_drink' },
  stabling_per_day: { type: 'service' },
  // Trade Good livestock (Remy ruling 2026-11-02, GG-576).
  chicken: { type: 'livestock' },
  cow: { type: 'livestock' },
  goat: { type: 'livestock' },
  ox: { type: 'livestock' },
  pig: { type: 'livestock' },
  sheep: { type: 'livestock' },
};

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

  // Determine Type and Slot. Each test matches a whole word of the 5eTools
  // type ("Melee Weapon", "Heavy Armor", "Ring", "Wondrous Item"), never a
  // substring (GG-543). Types that match no word stay treasure with no slot.
  if (hasWord(t, 'weapon')) {
    itemType = 'weapon';
    slot = 'MainHand';
  } else if (hasWord(t, 'armor')) {
    itemType = 'armor';
    slot = 'Torso';
    if (hasWord(t, 'light')) armorCategory = 'Light';
    else if (hasWord(t, 'medium')) armorCategory = 'Medium';
    else if (hasWord(t, 'heavy')) armorCategory = 'Heavy';
  } else if (hasWord(t, 'shield')) {
    itemType = 'armor';
    slot = 'OffHand';
    armorCategory = 'Shield';
  } else if (hasWord(t, 'ring')) {
    itemType = 'accessory';
    slot = 'Ring';
  } else if (hasWord(t, 'potion')) {
    itemType = 'consumable';
  } else if (hasWord(t, 'staff') || hasWord(t, 'wand') || hasWord(t, 'rod')) {
    itemType = 'weapon'; // Or accessory depending on mechanics, we default to weapon for staffs
    slot = 'MainHand';
  } else if (hasWord(t, 'wondrous') || hasWord(t, 'accessory')) {
    itemType = 'accessory';
  } else if (ITEM_TYPE_BY_ID[id]) {
    // GG-576: an item whose 5eTools type is too broad (see the table).
    itemType = ITEM_TYPE_BY_ID[id].type;
    slot = ITEM_TYPE_BY_ID[id].slot;
  } else if (ITEM_TYPE_BY_SOURCE_TYPE[meta.type]) {
    // GG-576: a mundane 5eTools type with a game item type.
    itemType = ITEM_TYPE_BY_SOURCE_TYPE[meta.type];
  }

  // GG-576 (Remy ruling 2026-11-02): a worn focus (Hat of Wizardry, Nature's
  // Mantle, Amulet) keeps its body slot, found from its name the same way as
  // a wondrous accessory. A held focus (Orb, Crystal, Wand) goes in MainHand,
  // the slot that held weapons use.
  if (itemType === 'spellcasting_focus') {
    slot = inferAccessorySlot(name) ?? 'MainHand';
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

  // Damage parsing: "1d8 S" -> damageDice: "1d8", damageType: "Slashing".
  // 5etools writes the damage type as a single-letter code; the whole table is
  // mapped here so no code leaks into the registry as a damage type of its own.
  if (meta.damage) {
    const parts = meta.damage.split(' ');
    if (parts.length > 0) item.damageDice = parts[0];
    if (parts.length > 1) {
      const canonical = resolveDamageType(parts[1]);
      if (canonical) item.damageType = canonical;
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
  // GG-164: one source list, and a missing folder stops the run (see
  // ITEM_SOURCE_DIRS). The old second scan of entries/magic_items/ is gone.
  const allFiles = collectSourceFiles();

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
 * Generated from public/data/glossary/entries/equipment.
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
