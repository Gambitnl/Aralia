import { describe, it, expect } from 'vitest';
import { convertEntryToItem } from '../generateItemRegistry';

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
