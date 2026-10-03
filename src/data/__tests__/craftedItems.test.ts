import { describe, it, expect } from 'vitest';
import { CRAFTED_ITEMS } from '../craftedItems';
import { ItemEffect, ItemRarity } from '../../types';

/**
 * Guards the crafted-item registry.
 *
 * Two jobs, added 2026-09-09 with the craftedItems mechanics pass (agora-117a.11):
 *
 * 1. Pin the one mechanic that has a live channel on the Item type. Potion of
 *    Fire Breath's "3 uses" is now real ItemCharges data on magicProperties,
 *    the same field the generated magic-item registry uses for wands. If a
 *    later edit drops it back to a bare damage roll, this fails loudly.
 * 2. Pin the placeholder profiles of the entries whose real mechanics are
 *    deferred to GG-218 and GG-219. Those entries look like ordinary damage or
 *    utility effects, so nothing else in the repo would notice if the preserved
 *    intent were quietly rewritten before the missing channel lands. The
 *    assertions below record what is being preserved and why.
 *
 * These are data assertions on purpose. CRAFTED_ITEMS has no importer yet
 * (GG-220), so a behavioral test would have nothing to drive.
 */

/** Narrows away the legacy `string` member of ItemEffect for assertions. */
const asEffect = (effect: ItemEffect | undefined): Exclude<ItemEffect, string> => {
  expect(effect, 'entry has no structured effect').toBeDefined();
  expect(typeof effect, 'entry still uses the legacy string effect').not.toBe('string');
  return effect as Exclude<ItemEffect, string>;
};

describe('crafted item registry — shape', () => {
  it('exports entries whose keys match their ids', () => {
    const entries = Object.entries(CRAFTED_ITEMS);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, item] of entries) {
      expect(item.id, `key ${key} disagrees with its id`).toBe(key);
    }
  });

  it('gives every entry a name, description, cost, rarity and effect', () => {
    for (const item of Object.values(CRAFTED_ITEMS)) {
      expect(item.name, `${item.id} has no name`).toBeTruthy();
      expect(item.description, `${item.id} has no description`).toBeTruthy();
      expect(item.cost, `${item.id} has no cost`).toBeTruthy();
      expect(Number(item.cost), `${item.id} has a non-numeric cost`).toBeGreaterThan(0);
      expect(item.rarity, `${item.id} has no rarity`).toBeDefined();
      expect(item.effect, `${item.id} has no effect`).toBeDefined();
    }
  });

  it('keeps damage effects paired with a damage type and dice', () => {
    for (const item of Object.values(CRAFTED_ITEMS)) {
      const effect = asEffect(item.effect);
      if (effect.type !== 'damage') continue;
      expect(effect.damageType, `${item.id} damage effect has no damage type`).toBeTruthy();
      expect(effect.dice, `${item.id} damage effect has no dice`).toMatch(/^\d+d\d+/);
    }
  });
});

describe('crafted item registry — wired mechanics', () => {
  it('Potion of Fire Breath carries its three uses as real charges', () => {
    const potion = CRAFTED_ITEMS['potion_of_fire_breath'];
    expect(potion.magicProperties?.charges).toEqual({
      current: 3,
      max: 3,
      // A consumed potion never recharges; the competing 1-hour window is a
      // duration, not a charge reset, and waits on GG-218.
      resetCondition: 'never',
    });
    expect(potion.magicProperties?.rarity).toBe('Uncommon');
    expect(potion.magicProperties?.category).toBe('Potion');
    // The charge count must not have swallowed the damage profile.
    expect(asEffect(potion.effect)).toEqual({ type: 'damage', damageType: 'fire', dice: '4d6' });
  });

  it('is the only entry claiming charges, so the wiring stays deliberate', () => {
    const withCharges = Object.values(CRAFTED_ITEMS).filter(i => i.magicProperties?.charges);
    expect(withCharges.map(i => i.id)).toEqual(['potion_of_fire_breath']);
  });
});

describe('crafted item registry — preserved intent behind deferred mechanics', () => {
  it("Alchemist's Fire keeps its 1d4 fire profile while the burn condition waits on GG-218", () => {
    const item = CRAFTED_ITEMS['alchemists_fire'];
    expect(asEffect(item.effect)).toEqual({ type: 'damage', damageType: 'fire', dice: '1d4' });
    // The per-turn burn and the Extinguish action live only in the description
    // until Item.effect can apply a condition.
    expect(item.description).toMatch(/start of each turn/i);
    expect(item.description).toMatch(/extinguished/i);
  });

  it('Blasting Powder keeps its DC and dice in the description while GG-218 is open', () => {
    const item = CRAFTED_ITEMS['blasting_powder'];
    expect(asEffect(item.effect)).toEqual({ type: 'damage', damageType: 'bludgeoning', dice: '3d6' });
    expect(item.description).toMatch(/DC 13 Dex save/);
    // "Charges can be combined" is an unanswered scaling question, not data.
    expect(item.description).toMatch(/combined/i);
  });

  it('Antitoxin still records its poison-save advantage as utility text', () => {
    const effect = asEffect(CRAFTED_ITEMS['antitoxin'].effect);
    expect(effect.type).toBe('utility');
    expect(effect.type === 'utility' && effect.description).toMatch(/poison saves/i);
  });

  it("Oil of Dragon's Bane still records its dragon bonus damage as utility text", () => {
    const item = CRAFTED_ITEMS['oil_of_dragons_bane'];
    const effect = asEffect(item.effect);
    expect(effect.type).toBe('utility');
    expect(effect.type === 'utility' && effect.description).toMatch(/Dragons/);
    // The number itself must survive somewhere until GG-219 gives it a rider.
    expect(item.description).toMatch(/\+6d6 damage against Dragons/);
  });

  it('Potion of Heroism preserves the temporary-HP half of its conflated buff', () => {
    const item = CRAFTED_ITEMS['potion_of_heroism'];
    const effect = asEffect(item.effect);
    expect(effect).toEqual({ type: 'buff', value: 10, duration: 60 });
    // The Bless half is invisible to mechanics until Item.effect accepts an
    // array of effects (GG-218); the description is its only record.
    expect(item.description).toMatch(/Bless/);
  });
});

describe('crafted item registry — cost curve is an unbalanced placeholder (GG-220)', () => {
  it('prices each rarity tier off a single flat default', () => {
    const tierDefaults: Partial<Record<ItemRarity, number>> = {
      [ItemRarity.Common]: 50,
      [ItemRarity.Uncommon]: 200,
      [ItemRarity.Rare]: 1000,
      [ItemRarity.VeryRare]: 5000,
    };
    // Recorded, not endorsed. This pins the placeholder shape so the owner's
    // balance pass shows up as an intentional, visible break of this test
    // rather than as silent drift.
    const offTier = Object.values(CRAFTED_ITEMS)
      .filter(item => item.rarity && tierDefaults[item.rarity] !== undefined)
      .filter(item => Number(item.cost) !== tierDefaults[item.rarity!])
      .map(item => `${item.id}=${item.cost}`);
    expect(offTier.sort()).toEqual([
      'basic_poison=100',
      'blasting_powder=75',
      'midnight_tears=1500',
      'smokebomb=25',
    ]);
  });
});
