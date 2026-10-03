import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { convertEntryToItem, inferAccessorySlot } from '../generateItemRegistry';

/**
 * Acceptance checks for the mechanical conversion seam in
 * generateItemRegistry.ts (item_categorization IC-G3).
 *
 * The gap: the type / damage / value / rarity heuristics that turn raw
 * glossary `itemMetadata` into simplified registry `Item` fields had no
 * acceptance coverage, so downstream gameplay parity could silently drift.
 *
 * These fixtures mirror the real source shapes found in
 * public/data/glossary/entries/equipment (e.g. longsword.json,
 * greataxe.json, 1_rod_of_the_pact_keeper.json) and assert the converted
 * outputs directly. The svg-icon lookup falls back to the heuristic icon
 * because no `<id>.svg` exists for these fixture ids.
 */

/** Build a glossary entry around a given itemMetadata block. */
function entry(itemMetadata: Record<string, unknown> | undefined, overrides: Record<string, unknown> = {}) {
  return {
    id: 'fixture_item',
    title: 'Fixture Item',
    excerpt: 'A fixture description.',
    markdown: '',
    itemMetadata,
    ...overrides,
  };
}

describe('convertEntryToItem — type mapping', () => {
  it('maps a melee weapon to weapon/MainHand', () => {
    const out = convertEntryToItem(entry(
      { type: 'Melee Weapon', rarity: 'None', cost: 15, weight: 3, damage: '1d8 S', properties: ['V|XPHB'] },
      { id: 'longsword', title: 'Longsword' },
    ));
    expect(out).not.toBeNull();
    expect(out!.item.type).toBe('weapon');
    expect(out!.item.slot).toBe('MainHand');
  });

  it('maps heavy armor to armor/Torso with a Heavy category', () => {
    const out = convertEntryToItem(entry({ type: 'Heavy Armor', rarity: 'Legendary', weight: 65, ac: 18 }));
    expect(out!.item.type).toBe('armor');
    expect(out!.item.slot).toBe('Torso');
    expect(out!.item.armorCategory).toBe('Heavy');
  });

  it('maps medium armor to a Medium category', () => {
    const out = convertEntryToItem(entry({ type: 'Medium Armor', rarity: 'Very rare', weight: 45, ac: 14 }));
    expect(out!.item.armorCategory).toBe('Medium');
  });

  it('maps a shield to armor/OffHand with a Shield category', () => {
    const out = convertEntryToItem(entry({ type: 'Shield', rarity: 'Rare', weight: 6, ac: 2 }));
    expect(out!.item.type).toBe('armor');
    expect(out!.item.slot).toBe('OffHand');
    expect(out!.item.armorCategory).toBe('Shield');
  });

  it('maps a ring to accessory/Ring', () => {
    const out = convertEntryToItem(entry({ type: 'Ring', rarity: 'Rare' }));
    expect(out!.item.type).toBe('accessory');
    expect(out!.item.slot).toBe('Ring');
  });

  it('maps a potion to consumable (no slot)', () => {
    const out = convertEntryToItem(entry({ type: 'Potion', rarity: 'Common' }));
    expect(out!.item.type).toBe('consumable');
    expect(out!.item.slot).toBeUndefined();
  });

  it('maps a staff/wand/rod to weapon/MainHand', () => {
    const out = convertEntryToItem(entry(
      { type: 'Rod', rarity: 'Uncommon', reqAttune: 'Required by a warlock', weight: 2 },
      { id: 'rod_of_the_pact_keeper', title: '+1 Rod of the Pact Keeper' },
    ));
    expect(out!.item.type).toBe('weapon');
    expect(out!.item.slot).toBe('MainHand');
  });

  it('maps a wondrous item to accessory (no slot)', () => {
    const out = convertEntryToItem(entry({ type: 'Wondrous Item', rarity: 'Rare' }));
    expect(out!.item.type).toBe('accessory');
    expect(out!.item.slot).toBeUndefined();
  });

  it('defaults an unrecognized type to treasure', () => {
    const out = convertEntryToItem(entry({ type: 'Trade Good', rarity: 'None' }));
    expect(out!.item.type).toBe('treasure');
    expect(out!.item.slot).toBeUndefined();
  });

  it('returns null for an entry without itemMetadata', () => {
    expect(convertEntryToItem(entry(undefined))).toBeNull();
  });
});

describe('convertEntryToItem — damage parsing', () => {
  it('splits dice from a single-letter damage type (Slashing)', () => {
    const out = convertEntryToItem(entry({ type: 'Melee Weapon', rarity: 'None', damage: '1d8 S' }));
    expect(out!.item.damageDice).toBe('1d8');
    expect(out!.item.damageType).toBe('Slashing');
  });

  it('maps P to Piercing and B to Bludgeoning', () => {
    const pierce = convertEntryToItem(entry({ type: 'Melee Weapon', rarity: 'None', damage: '1d6 P' }));
    expect(pierce!.item.damageType).toBe('Piercing');
    const blud = convertEntryToItem(entry({ type: 'Melee Weapon', rarity: 'None', damage: '1d4 B' }));
    expect(blud!.item.damageType).toBe('Bludgeoning');
  });

  it('falls back to the raw token for an unknown damage type', () => {
    const out = convertEntryToItem(entry({ type: 'Melee Weapon', rarity: 'None', damage: '2d6 Fire' }));
    expect(out!.item.damageDice).toBe('2d6');
    expect(out!.item.damageType).toBe('Fire');
  });

  it('sets no damage fields when metadata has no damage', () => {
    const out = convertEntryToItem(entry({ type: 'Shield', rarity: 'None', ac: 2 }));
    expect(out!.item.damageDice).toBeUndefined();
    expect(out!.item.damageType).toBeUndefined();
  });
});

describe('convertEntryToItem — value / weight', () => {
  it('formats cost as a GP string and preserves costInGp + weight', () => {
    const out = convertEntryToItem(entry({ type: 'Melee Weapon', rarity: 'None', cost: 15, weight: 3 }));
    expect(out!.item.cost).toBe('15 GP');
    expect(out!.item.costInGp).toBe(15);
    expect(out!.item.weight).toBe(3);
  });

  it('handles a zero cost (0 is a real value, not "missing")', () => {
    const out = convertEntryToItem(entry({ type: 'Trade Good', rarity: 'None', cost: 0 }));
    expect(out!.item.cost).toBe('0 GP');
    expect(out!.item.costInGp).toBe(0);
  });

  it('omits cost fields when cost is absent', () => {
    const out = convertEntryToItem(entry({ type: 'Wondrous Item', rarity: 'Rare' }));
    expect(out!.item.cost).toBeUndefined();
    expect(out!.item.costInGp).toBeUndefined();
  });
});

describe('convertEntryToItem — armor class routing', () => {
  it('routes body-armor AC to baseArmorClass', () => {
    const out = convertEntryToItem(entry({ type: 'Heavy Armor', rarity: 'Legendary', ac: 18 }));
    expect(out!.item.baseArmorClass).toBe(18);
    expect(out!.item.armorClassBonus).toBeUndefined();
  });

  it('routes shield AC to armorClassBonus', () => {
    const out = convertEntryToItem(entry({ type: 'Shield', rarity: 'Rare', ac: 2 }));
    expect(out!.item.armorClassBonus).toBe(2);
    expect(out!.item.baseArmorClass).toBeUndefined();
  });
});

describe('convertEntryToItem — rarity mapping', () => {
  it('maps each known rarity to its ItemRarity enum reference', () => {
    const cases: Array<[string, string]> = [
      ['Common', 'ItemRarity.Common'],
      ['Uncommon', 'ItemRarity.Uncommon'],
      ['Rare', 'ItemRarity.Rare'],
      ['Very rare', 'ItemRarity.VeryRare'],
      ['Legendary', 'ItemRarity.Legendary'],
      ['Artifact', 'ItemRarity.Artifact'],
    ];
    for (const [source, expected] of cases) {
      const out = convertEntryToItem(entry({ type: 'Wondrous Item', rarity: source }));
      expect(out!.item.rarity).toBe(expected);
    }
  });

  it('omits rarity for "None"', () => {
    const out = convertEntryToItem(entry({ type: 'Melee Weapon', rarity: 'None' }));
    expect(out!.item.rarity).toBeUndefined();
  });
});

describe('convertEntryToItem — weapon properties + attunement + effect', () => {
  it('maps 5eTools property uids to display names', () => {
    const out = convertEntryToItem(entry({ type: 'Melee Weapon', rarity: 'None', properties: ['H|XPHB', '2H|XPHB'] }));
    expect(out!.item.properties).toEqual(['Heavy', 'Two-Handed']);
  });

  it('records required attunement with plain-text requirements', () => {
    const out = convertEntryToItem(entry({ type: 'Heavy Armor', rarity: 'Legendary', reqAttune: 'Required by a warlock' }));
    expect(out!.item.magicProperties.attunement.required).toBe(true);
    expect(out!.item.magicProperties.attunement.requirements).toBe('Required by a warlock');
  });

  it('sets the flat requiresAttunement field the runtime reads', () => {
    const out = convertEntryToItem(entry({ type: 'Wondrous Item', rarity: 'Rare', reqAttune: 'Required' }));
    expect(out!.item.requiresAttunement).toBe(true);
  });

  it('omits requiresAttunement when the item needs none', () => {
    const out = convertEntryToItem(entry({ type: 'Wondrous Item', rarity: 'Rare' }));
    expect(out!.item.requiresAttunement).toBeUndefined();
  });

  it('strips 5eTools markup out of attunement requirements', () => {
    const out = convertEntryToItem(entry({ type: 'Wondrous Item', rarity: 'Rare', reqAttune: '{@item Belt of Dwarvenkind|XDMG}' }));
    expect(out!.item.magicProperties.attunement.requirements).toBe('Belt of Dwarvenkind');
  });

  it('parses a dice-based heal effect from the markdown', () => {
    const out = convertEntryToItem(entry(
      { type: 'Potion', rarity: 'Common' },
      { markdown: 'You drink it and regains 2d4 + 2 [[hit_points]].' },
    ));
    expect(out!.item.effect).toEqual({ type: 'heal', value: 0, dice: '2d4+2' });
  });

  it('parses a flat-value heal effect from the markdown', () => {
    const out = convertEntryToItem(entry(
      { type: 'Potion', rarity: 'Common' },
      { markdown: 'The imbiber regains 10 [[hit_points]].' },
    ));
    expect(out!.item.effect).toEqual({ type: 'heal', value: 10 });
  });
});

describe('convertEntryToItem — mechanical boon fields', () => {
  it('emits magicalBonus from bonusWeapon', () => {
    const out = convertEntryToItem(entry({ type: 'Melee Weapon', rarity: 'Uncommon', bonusWeapon: '+1' }));
    expect(out!.item.magicProperties.magicalBonus).toBe(1);
  });

  it('emits armorClassBonus and magicProperties.acBonus from bonusAc', () => {
    const out = convertEntryToItem(entry({ type: 'Ring', rarity: 'Rare', reqAttune: 'Required', bonusAc: '+1' }));
    expect(out!.item.armorClassBonus).toBe(1);
    expect(out!.item.magicProperties.acBonus).toBe(1);
  });

  it('stacks bonusAc on top of a shield base armorClassBonus', () => {
    const out = convertEntryToItem(entry({ type: 'Shield', rarity: 'Rare', ac: 2, bonusAc: '+1' }));
    expect(out!.item.armorClassBonus).toBe(3);
  });

  it('keeps magic body-armor bonusAc out of baseArmorClass', () => {
    const out = convertEntryToItem(entry({ type: 'Heavy Armor', rarity: 'Very rare', ac: 18, reqAttune: 'Required', bonusAc: '+1' }));
    expect(out!.item.baseArmorClass).toBe(18);
    expect(out!.item.armorClassBonus).toBe(1);
  });

  it('maps abilitySet to statOverrides with full ability names', () => {
    const out = convertEntryToItem(entry({ type: 'Wondrous Item', rarity: 'Uncommon', reqAttune: 'Required', abilitySet: { str: 19 } }));
    expect(out!.item.statOverrides).toEqual({ Strength: 19 });
    expect(out!.item.statBonuses).toBeUndefined();
  });

  it('maps abilityBonus to statBonuses with full ability names', () => {
    const out = convertEntryToItem(entry({ type: 'Wondrous Item', rarity: 'Rare', reqAttune: 'Required', abilityBonus: { con: 2 } }));
    expect(out!.item.statBonuses).toEqual({ Constitution: 2 });
    expect(out!.item.statOverrides).toBeUndefined();
  });

  it('emits full charges with dawn recharge and reset dice', () => {
    const out = convertEntryToItem(entry({ type: 'Wand', rarity: 'Uncommon', charges: 7, recharge: 'dawn', rechargeAmount: '1d6 + 1' }));
    expect(out!.item.magicProperties.charges).toEqual({
      current: 7,
      max: 7,
      resetCondition: 'dawn',
      resetDice: '1d6 + 1',
    });
  });
});

describe('inferAccessorySlot', () => {
  it.each([
    ['Gauntlets of Ogre Power', 'Hands'],
    ['Belt of Dwarvenkind', 'Belt'],
    ['Cloak of Protection', 'Cloak'],
    ['Amulet of Health', 'Neck'],
    ['Headband of Intellect', 'Head'],
    ['Boots of Speed', 'Feet'],
    ['+1 Wraps of Unarmed Power', 'Wrists'],
    ['Robe of the Archmagi', 'Torso'],
  ] as const)('maps %s to the %s slot', (name, slot) => {
    expect(inferAccessorySlot(name)).toBe(slot);
  });

  it('returns undefined for a name without a wear-slot word', () => {
    expect(inferAccessorySlot('Bag of Holding')).toBeUndefined();
  });

  it('assigns the inferred slot to a converted wondrous item', () => {
    const out = convertEntryToItem(entry(
      { type: 'Wondrous Item', rarity: 'Uncommon', reqAttune: 'Required', abilitySet: { str: 19 } },
      { id: 'gauntlets_of_ogre_power', title: 'Gauntlets of Ogre Power' },
    ));
    expect(out!.item.slot).toBe('Hands');
  });
});

/**
 * Acceptance coverage for the actual generation run (agora-5024.3): does the
 * registry the script would emit today (a) match the expected Item shape for
 * every entry, and (b) contain no duplicate ids?
 *
 * This walks the live source directories with the same file-collection logic
 * as generateItemRegistry.ts's `main()` and feeds every entry through the
 * real `convertEntryToItem` seam, so it is exercising the same conversion the
 * generator uses rather than re-deriving expectations by hand. It reads
 * source JSON only; it never writes src/data/items/generatedGlossaryItems.ts,
 * so it can't go stale relative to a checked-in snapshot and can't race other
 * agents writing that file.
 */
describe('generated registry — acceptance (shape + duplicate ids)', () => {
  const ENTRIES_BASE = path.join(process.cwd(), 'public/data/glossary/entries');
  // Mirrors generateItemRegistry.ts's EQUIPMENT_DIR / MAGIC_ITEMS_DIR. As of
  // 2026-09-09 magic_items/ no longer exists on disk (its contents live
  // under equipment/ now); getAllFiles tolerates a missing dir, so this list
  // stays accurate for both layouts without failing when one is absent.
  const SOURCE_DIRS = ['equipment', 'magic_items'].map((d) => path.join(ENTRIES_BASE, d));

  const ALLOWED_TYPES = new Set([
    'weapon', 'armor', 'accessory', 'clothing', 'consumable', 'potion',
    'food_drink', 'poison_toxin', 'tool', 'light_source', 'ammunition',
    'trap', 'note', 'book', 'map', 'scroll', 'key', 'spell_component',
    'reagent', 'crafting_material', 'treasure',
  ]);

  function getAllJsonFiles(dirPath: string, out: string[] = []): string[] {
    if (!fs.existsSync(dirPath)) return out;
    for (const file of fs.readdirSync(dirPath)) {
      const full = path.join(dirPath, file);
      if (fs.statSync(full).isDirectory()) {
        getAllJsonFiles(full, out);
      } else if (file.endsWith('.json')) {
        out.push(full);
      }
    }
    return out;
  }

  const sourceFiles = SOURCE_DIRS.flatMap((dir) => getAllJsonFiles(dir));

  // Same accumulation the generator does: convert every source file, skip
  // entries with no itemMetadata, key by id. Also keep the raw id sequence
  // (including any repeats) separately, since keying by id in a plain object
  // can never itself show a collision — a second entry with the same id
  // just silently clobbers the first.
  const registry: Record<string, any> = {};
  const idSequence: string[] = [];
  for (const file of sourceFiles) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const converted = convertEntryToItem(data);
    if (!converted) continue;
    idSequence.push(converted.id);
    registry[converted.id] = converted.item;
  }

  it('produces a non-trivial registry from the live glossary source', () => {
    // Sanity guard: if source layout changes again and both dirs come up
    // empty, the shape/duplicate checks below would pass vacuously.
    expect(sourceFiles.length).toBeGreaterThan(100);
    expect(idSequence.length).toBeGreaterThan(100);
  });

  it('every converted item matches the expected registry Item shape', () => {
    for (const [id, item] of Object.entries(registry)) {
      expect(item.id, `${id}: item.id must equal its registry key`).toBe(id);
      expect(typeof item.name, `${id}: name must be a string`).toBe('string');
      expect((item.name as string).length, `${id}: name must be non-empty`).toBeGreaterThan(0);
      expect(typeof item.description, `${id}: description must be a string`).toBe('string');
      expect(ALLOWED_TYPES.has(item.type), `${id}: unexpected type "${item.type}"`).toBe(true);
      expect(typeof item.icon, `${id}: icon must be a string`).toBe('string');
      if (item.weight !== undefined) {
        expect(typeof item.weight, `${id}: weight must be a number when present`).toBe('number');
      }
      if (item.cost !== undefined) {
        // costInGp can be fractional (e.g. a copper-priced ale mug is "0.04
        // GP"), so match any numeric token rather than assuming an integer.
        expect(item.cost, `${id}: cost must be formatted "<n> GP"`).toMatch(/^\d+(\.\d+)? GP$/);
        expect(typeof item.costInGp, `${id}: costInGp must accompany cost`).toBe('number');
      }
      if (item.slot !== undefined) {
        expect(typeof item.slot, `${id}: slot must be a string when present`).toBe('string');
      }
    }
  });

  it('contains no duplicate ids across the source glossary entries', () => {
    const counts = new Map<string, number>();
    for (const id of idSequence) counts.set(id, (counts.get(id) || 0) + 1);
    const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    expect(duplicates, `duplicate source ids collide in the registry: ${duplicates.join(', ')}`).toEqual([]);
    // And the registry's own key count should equal the number of converted
    // entries — if it doesn't, something clobbered a key despite no
    // duplicate ids being found above (a bug in this test, not the data).
    expect(Object.keys(registry).length).toBe(idSequence.length);
  });
});
