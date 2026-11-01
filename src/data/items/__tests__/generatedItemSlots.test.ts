import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { GENERATED_GLOSSARY_ITEMS } from '../generatedGlossaryItems';

/**
 * Guards the wear slot of every item in the generated item registry (GG-543).
 *
 * Before the fix, the generator matched the type text "Adventuring Gear"
 * as a ring, because the word contains "ring". All 92 Adventuring Gear items
 * (Book, Torch, Rope...) came out as accessories in the Ring slot, so a player
 * could wear a five-pound book as jewelry.
 *
 * This test reads the committed output, not the generator, so it also fails
 * when the generator is fixed but the registry is not regenerated.
 */

/** The slots that each item type can hold. A type that is not here has no slot. */
const SLOTS_BY_TYPE: Record<string, readonly string[]> = {
  weapon: ['MainHand', 'OffHand'],
  armor: ['Head', 'Torso', 'Legs', 'Hands', 'Feet', 'Wrists', 'OffHand'],
  accessory: ['Head', 'Neck', 'Torso', 'Cloak', 'Belt', 'Wrists', 'Hands', 'Feet', 'Ring'],
  clothing: ['Head', 'Torso', 'Cloak', 'Belt', 'Wrists', 'Hands', 'Feet', 'Legs'],
  // GG-576: worn foci keep a body slot; held foci use MainHand.
  spellcasting_focus: ['MainHand', 'Head', 'Neck', 'Cloak'],
};

const RING_SLOTS = new Set(['Ring', 'Ring1', 'Ring2']);
const EQUIPMENT_DIR = path.join(process.cwd(), 'public/data/glossary/entries/equipment');

/** The 5eTools item type of the glossary entry that the registry item came from. */
function sourceType(id: string): string | undefined {
  const file = path.join(EQUIPMENT_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')).itemMetadata?.type;
}

describe('generated item registry — wear slots fit item types', () => {
  const entries = Object.entries(GENERATED_GLOSSARY_ITEMS);

  it('gives every item a slot that its type can hold', () => {
    const misfits = entries
      .filter(([, item]) => item.slot !== undefined)
      .filter(([, item]) => !(SLOTS_BY_TYPE[item.type] ?? []).includes(item.slot as string))
      .map(([id, item]) => `${id}: ${item.type} in ${item.slot}`);
    expect(misfits).toEqual([]);
  });

  it('puts only source rings in a Ring slot', () => {
    const misfits = entries
      .filter(([, item]) => item.slot !== undefined && RING_SLOTS.has(item.slot))
      .filter(([id]) => sourceType(id) !== 'Ring')
      .map(([id]) => `${id}: source type ${sourceType(id)}`);
    expect(misfits).toEqual([]);
  });

  it('keeps the ordinary Book out of every equipment slot', () => {
    const book = GENERATED_GLOSSARY_ITEMS['book'];
    expect(book.name).toBe('Book');
    expect(book.slot).toBeUndefined();
    expect(book.type).not.toBe('accessory');
  });
});

/**
 * GG-576: mundane items get the game's existing item types instead of the
 * treasure fallback. Treasure stays only where it is right (gems, art, trade
 * bars, the Trinket). Mounts, vehicles, livestock and spellcasting foci use
 * the four types from Remy's 2026-11-02 ruling.
 */
describe('generated item registry — mundane item types', () => {
  const items = GENERATED_GLOSSARY_ITEMS;

  it('gives representative mundane items their game types', () => {
    const typeAndSlot = (id: string) => [items[id].type, items[id].slot];
    expect(typeAndSlot('book')).toEqual(['book', undefined]);
    expect(typeAndSlot('map')).toEqual(['map', undefined]);
    expect(typeAndSlot('torch')).toEqual(['light_source', undefined]);
    expect(typeAndSlot('traveler_s_clothes')).toEqual(['clothing', 'Torso']);
    expect(typeAndSlot('basic_poison')).toEqual(['poison_toxin', undefined]);
    expect(typeAndSlot('rations')).toEqual(['food_drink', undefined]);
    expect(typeAndSlot('rope')).toEqual(['tool', undefined]);
    expect(typeAndSlot('thieves_tools')).toEqual(['tool', undefined]);
    expect(typeAndSlot('arrows_20')).toEqual(['ammunition', undefined]);
    expect(typeAndSlot('spell_scroll_level_1')).toEqual(['scroll', undefined]);
    expect(typeAndSlot('iron')).toEqual(['crafting_material', undefined]);
    expect(typeAndSlot('stabling_per_day')).toEqual(['service', undefined]);
    // Remy ruling 2026-11-02: mount, vehicle, livestock and spellcasting_focus.
    expect(typeAndSlot('riding_horse')).toEqual(['mount', undefined]);
    expect(typeAndSlot('rowboat')).toEqual(['vehicle', undefined]);
    expect(typeAndSlot('airship')).toEqual(['vehicle', undefined]);
    expect(typeAndSlot('cow')).toEqual(['livestock', undefined]);
    expect(typeAndSlot('hat_of_wizardry')).toEqual(['spellcasting_focus', 'Head']);
    expect(typeAndSlot('nature_s_mantle')).toEqual(['spellcasting_focus', 'Cloak']);
    expect(typeAndSlot('amulet')).toEqual(['spellcasting_focus', 'Neck']);
    expect(typeAndSlot('orb')).toEqual(['spellcasting_focus', 'MainHand']);
    expect(typeAndSlot('wand')).toEqual(['spellcasting_focus', 'MainHand']);
  });

  it('keeps the treasure fallback only for valuables', () => {
    const allowed = new Set(['Treasure (Gemstone)', 'Treasure (Art Object)', 'Trade Bar']);
    const allowedIds = new Set(['trinket']);
    const misfits = Object.entries(items)
      .filter(([, item]) => item.type === 'treasure')
      .filter(([id]) => !allowedIds.has(id) && !allowed.has(sourceType(id) ?? ''))
      .map(([id]) => `${id}: source type ${sourceType(id)}`);
    expect(misfits).toEqual([]);
  });
});
