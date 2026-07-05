import { describe, it, expect } from 'vitest';
import { buildStartingLoadout } from '../buildStartingLoadout';
import { CLASS_STARTING_EQUIPMENT } from '../../../data/classes/startingEquipment';
import { ALL_ITEMS } from '../../../data/items/index';
import { calculateArmorClass } from '../../../utils/character/statUtils';
import type { PlayerCharacter } from '../../../types/character';

const invId = (loadout: ReturnType<typeof buildStartingLoadout>, id: string) =>
  loadout.inventory.find(i => i.id === id);

describe('buildStartingLoadout', () => {
  it('every class package references only real catalog items', () => {
    for (const [classId, pkg] of Object.entries(CLASS_STARTING_EQUIPMENT)) {
      for (const entry of pkg.items) {
        expect(ALL_ITEMS[entry.id], `${classId} → ${entry.id}`).toBeTruthy();
      }
    }
  });

  it('no class starts weaponless or without a MainHand', () => {
    for (const classId of Object.keys(CLASS_STARTING_EQUIPMENT)) {
      const loadout = buildStartingLoadout({ classId });
      const hasWeapon =
        loadout.equippedItems.MainHand?.type === 'weapon' ||
        loadout.inventory.some(i => i.type === 'weapon');
      expect(hasWeapon, `${classId} has a weapon`).toBe(true);
    }
  });

  it('fighter starts in chain mail with a greatsword equipped', () => {
    const loadout = buildStartingLoadout({ classId: 'fighter' });
    expect(loadout.equippedItems.Torso?.id).toBe('chain_mail');
    expect(loadout.equippedItems.MainHand?.id).toBe('greatsword');
    expect(invId(loadout, 'javelin')?.quantity).toBe(8);
    expect(invId(loadout, 'dungeoneers_pack')).toBeTruthy();
    expect(loadout.gold).toBe(4);
  });

  it('wizard is armed with a focus and spellbook, not naked', () => {
    const loadout = buildStartingLoadout({ classId: 'wizard' });
    expect(loadout.equippedItems.Torso).toBeUndefined(); // no armor
    expect(loadout.equippedItems.MainHand?.id).toBe('quarterstaff');
    expect(invId(loadout, 'arcane_focus')).toBeTruthy();
    expect(invId(loadout, 'spellbook')).toBeTruthy();
    expect(invId(loadout, 'dagger')).toBeTruthy();
    expect(loadout.gold).toBe(5);
  });

  it('rogue starts in leather with thieves tools and arrows', () => {
    const loadout = buildStartingLoadout({ classId: 'rogue' });
    expect(loadout.equippedItems.Torso?.id).toBe('leather_armor');
    expect(loadout.equippedItems.MainHand?.id).toBe('shortsword');
    expect(invId(loadout, 'thieves-tools')).toBeTruthy();
    expect(invId(loadout, 'arrows')?.quantity).toBe(20);
    expect(invId(loadout, 'dagger')?.quantity).toBe(2);
  });

  it('cleric starts with chain shirt, shield, mace, and a holy symbol', () => {
    const loadout = buildStartingLoadout({ classId: 'cleric' });
    expect(loadout.equippedItems.Torso?.id).toBe('chain_shirt');
    expect(loadout.equippedItems.OffHand?.id).toBe('shield_std');
    expect(loadout.equippedItems.MainHand?.id).toBe('mace');
    expect(invId(loadout, 'holy_symbol')).toBeTruthy();
    expect(loadout.gold).toBe(7);
  });

  it('always includes 5 rations and 5 waterskins', () => {
    const loadout = buildStartingLoadout({ classId: 'monk' });
    expect(invId(loadout, 'rations')?.quantity).toBe(5);
    expect(invId(loadout, 'water-day')?.quantity).toBe(5);
  });

  it('adds a background\'s coin to gold and its equipment to inventory', () => {
    // Acolyte grants a holy_symbol, prayer_book, 5_candles, tinderbox, common_clothes, 15_gp.
    const loadout = buildStartingLoadout({ classId: 'cleric', background: 'acolyte' });
    expect(loadout.gold).toBe(7 + 15); // class 7 + background 15gp
    expect(invId(loadout, 'common_clothes')).toBeTruthy();
    // prayer_book has no catalog entry → surfaces as a named keepsake, not dropped.
    const prayer = invId(loadout, 'prayer_book');
    expect(prayer).toBeTruthy();
    expect(prayer?.name).toBe('Prayer Book');
  });

  it('carries a chosen mastery weapon that the package lacks', () => {
    const loadout = buildStartingLoadout({ classId: 'wizard', weaponMasteryIds: ['handaxe'] });
    expect(invId(loadout, 'handaxe')).toBeTruthy();
  });

  it('degrades honestly for an unknown class: provisions, no throw, zero package gold', () => {
    const loadout = buildStartingLoadout({ classId: 'no_such_class' });
    expect(invId(loadout, 'rations')?.quantity).toBe(5);
    expect(loadout.gold).toBe(0);
  });

  it('equipped armor produces a real AC via calculateArmorClass', () => {
    const fighter = buildStartingLoadout({ classId: 'fighter' });
    const dex14: PlayerCharacter = {
      id: 't', name: 'T', class: { id: 'fighter' } as PlayerCharacter['class'],
      race: {} as PlayerCharacter['race'],
      finalAbilityScores: { Strength: 16, Dexterity: 14, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      equippedItems: fighter.equippedItems,
    } as PlayerCharacter;
    // Chain mail is AC 16, no Dex, no shield (greatsword is two-handed).
    expect(calculateArmorClass(dex14)).toBe(16);

    const cleric = buildStartingLoadout({ classId: 'cleric' });
    const clericChar: PlayerCharacter = { ...dex14, class: { id: 'cleric' } as PlayerCharacter['class'], equippedItems: cleric.equippedItems } as PlayerCharacter;
    // Chain shirt 13 + Dex(+2, cap 2) + shield +2 = 17.
    expect(calculateArmorClass(clericChar)).toBe(17);
  });
});
