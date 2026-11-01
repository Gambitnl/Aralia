/**
 * GG-495: weapon reach and range facts read the real item data (capitalized
 * properties, Simple/Martial Ranged categories) and the PHB range table.
 *
 * Exercises: src/utils/combat/weaponRange.ts
 */
import { describe, expect, it } from 'vitest';
import { WEAPONS_DATA } from '../../../data/items';
import {
  isRangedWeapon,
  isThrownMeleeWeapon,
  weaponNormalRangeTiles,
  weaponRangeFeet,
  weaponReachTiles,
} from '../weaponRange';

describe('weaponRange', () => {
  it('gives reach weapons 10 ft and plain melee weapons 5 ft', () => {
    expect(weaponReachTiles(WEAPONS_DATA.glaive)).toBe(2);
    expect(weaponReachTiles(WEAPONS_DATA.whip)).toBe(2);
    expect(weaponReachTiles(WEAPONS_DATA.longsword)).toBe(1);
  });

  it('classifies bows, crossbows and darts as ranged, and daggers as thrown melee', () => {
    expect(isRangedWeapon(WEAPONS_DATA.longbow)).toBe(true);
    expect(isRangedWeapon(WEAPONS_DATA.hand_crossbow)).toBe(true);
    expect(isRangedWeapon(WEAPONS_DATA.dart)).toBe(true);
    expect(isRangedWeapon(WEAPONS_DATA.glaive)).toBe(false);
    expect(isThrownMeleeWeapon(WEAPONS_DATA.dagger)).toBe(true);
    expect(isThrownMeleeWeapon(WEAPONS_DATA.javelin)).toBe(true);
    expect(isThrownMeleeWeapon(WEAPONS_DATA.dart)).toBe(false); // a ranged weapon already
  });

  it('reads PHB ranges by id and by a base name inside a variant name', () => {
    expect(weaponNormalRangeTiles(WEAPONS_DATA.longbow)).toBe(30); // 150 ft
    expect(weaponNormalRangeTiles(WEAPONS_DATA.javelin)).toBe(6); // 30 ft
    expect(weaponRangeFeet({ id: 'gen_magic_42', name: 'Longbow +1' })).toEqual([150, 600]);
    expect(weaponRangeFeet({ id: 'gen_magic_43', name: 'Light Crossbow of Speed' })).toEqual([80, 320]);
  });

  it('has a range for every ranged or thrown weapon in the item data', () => {
    const missing = Object.values(WEAPONS_DATA)
      .filter((w) => isRangedWeapon(w) || isThrownMeleeWeapon(w))
      .filter((w) => !weaponRangeFeet(w))
      .map((w) => w.id);
    expect(missing).toEqual([]);
  });
});

// GG-495: the combat abilities built for a player character use those facts.
import { createPlayerCombatCharacter } from '../combatUtils';
import { createMockPlayerCharacter } from '../../core/factories';

describe('weapon abilities on a player combatant (GG-495)', () => {
  const abilitiesWith = (mainHand: (typeof WEAPONS_DATA)[string]) =>
    createPlayerCombatCharacter(createMockPlayerCharacter({ equippedItems: { MainHand: mainHand } } as never)).abilities;

  it('gives a longbow its 150 ft normal range and a glaive 10 ft reach', () => {
    expect(abilitiesWith(WEAPONS_DATA.longbow).find((a) => a.id === 'attack_main')?.range).toBe(30);
    expect(abilitiesWith(WEAPONS_DATA.glaive).find((a) => a.id === 'attack_main')?.range).toBe(2);
  });

  it('gives a dagger a melee attack and a separate 20 ft Throw attack', () => {
    const abilities = abilitiesWith(WEAPONS_DATA.dagger);
    expect(abilities.find((a) => a.id === 'attack_main')?.range).toBe(1);
    const thrown = abilities.find((a) => a.id === 'attack_main_thrown');
    expect(thrown?.name).toBe('Throw Dagger');
    expect(thrown?.range).toBe(4);
  });
});

// GG-495 open part (2026-11-01): ranged and thrown attacks also carry their PHB
// long range. A target between the two ranges is legal, with Disadvantage.
import { isAtLongRange, maxAttackRangeTiles, weaponLongRangeTiles } from '../weaponRange';

describe('long range (GG-495)', () => {
  const abilitiesWith = (mainHand: (typeof WEAPONS_DATA)[string]) =>
    createPlayerCombatCharacter(createMockPlayerCharacter({ equippedItems: { MainHand: mainHand } } as never)).abilities;

  it('reads the long range from the PHB table in tiles', () => {
    expect(weaponLongRangeTiles(WEAPONS_DATA.spear)).toBe(12);
    expect(weaponLongRangeTiles(WEAPONS_DATA.longbow)).toBe(120);
    expect(weaponLongRangeTiles(WEAPONS_DATA.glaive)).toBeUndefined();
  });

  it('marks only the band past the normal range and within the long range', () => {
    const thrownSpear = { range: 4, longRange: 12 };
    expect(isAtLongRange(thrownSpear, 4)).toBe(false);
    expect(isAtLongRange(thrownSpear, 5)).toBe(true);
    expect(isAtLongRange(thrownSpear, 12)).toBe(true);
    expect(isAtLongRange(thrownSpear, 13)).toBe(false);
    expect(isAtLongRange({ range: 1 }, 5)).toBe(false);
    expect(maxAttackRangeTiles(thrownSpear)).toBe(12);
    expect(maxAttackRangeTiles({ range: 1 })).toBe(1);
  });

  it('gives a Throw attack and a bow a long range, and a melee swing none', () => {
    const dagger = abilitiesWith(WEAPONS_DATA.dagger);
    expect(dagger.find((a) => a.id === 'attack_main_thrown')?.longRange).toBe(12);
    expect(dagger.find((a) => a.id === 'attack_main')?.longRange).toBeUndefined();
    expect(abilitiesWith(WEAPONS_DATA.longbow).find((a) => a.id === 'attack_main')?.longRange).toBe(120);
    expect(abilitiesWith(WEAPONS_DATA.glaive).find((a) => a.id === 'attack_main')?.longRange).toBeUndefined();
  });
});
