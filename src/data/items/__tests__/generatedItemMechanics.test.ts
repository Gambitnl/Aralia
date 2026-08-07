import { describe, it, expect } from 'vitest';
import { GENERATED_GLOSSARY_ITEMS } from '../generatedGlossaryItems';

/**
 * Guards the mechanical boon fields in the generated item registry.
 *
 * The magic-item machinery (characterReducer attunement, statUtils ability
 * scores and AC, partyStatUtils weapon bonus) reads these fields. Before
 * 2026-08-06 the registry emitted none of them, so every magic item was inert.
 * These tests pin representative items so a regeneration that drops the
 * fields fails loudly instead of silently reverting the game to inert items.
 */

describe('generated item registry — mechanical boon fields', () => {
  const items = GENERATED_GLOSSARY_ITEMS;

  it('Gauntlets of Ogre Power set Strength to 19 and require attunement', () => {
    const gauntlets = items['gauntlets_of_ogre_power'];
    expect(gauntlets.statOverrides).toEqual({ Strength: 19 });
    expect(gauntlets.requiresAttunement).toBe(true);
    expect(gauntlets.slot).toBe('Hands');
  });

  it('Belt of Dwarvenkind adds +2 Constitution', () => {
    const belt = items['belt_of_dwarvenkind'];
    expect(belt.statBonuses).toEqual({ Constitution: 2 });
    expect(belt.slot).toBe('Belt');
  });

  it('+1 Wraps of Unarmed Power carry a +1 magical bonus', () => {
    expect(items['1_wraps_of_unarmed_power'].magicProperties?.magicalBonus).toBe(1);
  });

  it('Ring of Protection grants an attunement-gated +1 AC', () => {
    const ring = items['ring_of_protection'];
    expect(ring.armorClassBonus).toBe(1);
    expect(ring.requiresAttunement).toBe(true);
    expect(ring.slot).toBe('Ring');
  });

  it('Wand of Magic Missiles carries 7 dawn-recharge charges', () => {
    expect(items['wand_of_magic_missiles'].magicProperties?.charges).toEqual({
      current: 7,
      max: 7,
      resetCondition: 'dawn',
      resetDice: '1d6 + 1',
    });
  });

  it('every item with the nested attunement flag also carries the flat field', () => {
    for (const item of Object.values(items)) {
      if (item.magicProperties?.attunement?.required) {
        expect(item.requiresAttunement, `${item.id} misses flat requiresAttunement`).toBe(true);
      }
    }
  });

  it('registry-wide: the boon fields are populated, not empty', () => {
    const all = Object.values(items);
    expect(all.filter(i => i.statOverrides).length).toBeGreaterThanOrEqual(10);
    expect(all.filter(i => i.statBonuses).length).toBeGreaterThanOrEqual(3);
    expect(all.filter(i => i.magicProperties?.magicalBonus).length).toBeGreaterThanOrEqual(15);
    expect(all.filter(i => i.magicProperties?.charges).length).toBeGreaterThanOrEqual(50);
    expect(all.filter(i => i.requiresAttunement).length).toBeGreaterThanOrEqual(150);
  });
});
