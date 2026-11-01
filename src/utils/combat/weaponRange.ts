/**
 * @file src/utils/combat/weaponRange.ts
 * Weapon reach and range facts for the combat weapon abilities (GG-495,
 * audit 2026-10-25).
 *
 * Before this module, createWeaponAbility matched only a lowercase 'reach'
 * property (item data says 'Reach') and read range only from a 'range:N'
 * property that no item has, so every bow, crossbow, polearm and thrown
 * weapon attacked at 5 ft, and the attack code treated "range > 1" as ranged,
 * which would also have turned a reach glaive into a Dexterity weapon.
 *
 * Item data has no range fields, so the PHB range table lives here, keyed by
 * the base weapon id, with a name fallback for named variants ("Longbow +1").
 * One grid tile is 5 ft.
 */
import type { Item } from '../../types';

const FEET_PER_TILE = 5;

/** PHB weapon ranges in feet: [normal, long]. */
export const WEAPON_RANGES_FT: Readonly<Record<string, readonly [number, number]>> = {
  dagger: [20, 60],
  handaxe: [20, 60],
  javelin: [30, 120],
  light_hammer: [20, 60],
  spear: [20, 60],
  trident: [20, 60],
  dart: [20, 60],
  sling: [30, 120],
  blowgun: [25, 100],
  shortbow: [80, 320],
  longbow: [150, 600],
  light_crossbow: [80, 320],
  hand_crossbow: [30, 120],
  heavy_crossbow: [100, 400],
  net: [5, 15],
};

type WeaponLike = Pick<Item, 'id' | 'name'> & { properties?: string[]; category?: string };

/** True when the weapon has the named property, ignoring case ('Reach' or 'reach'). */
export function hasWeaponProperty(weapon: WeaponLike | undefined, property: string): boolean {
  const wanted = property.toLowerCase();
  return Boolean(weapon?.properties?.some((p) => p.toLowerCase() === wanted));
}

/** A ranged weapon: a Simple/Martial Ranged category, or the Ammunition property. */
export function isRangedWeapon(weapon: WeaponLike | undefined): boolean {
  if (!weapon) return false;
  return Boolean(weapon.category?.toLowerCase().includes('ranged')) || hasWeaponProperty(weapon, 'ammunition');
}

/** A melee weapon that can also be thrown (dagger, handaxe, javelin, spear...). */
export function isThrownMeleeWeapon(weapon: WeaponLike | undefined): boolean {
  return !isRangedWeapon(weapon) && hasWeaponProperty(weapon, 'thrown');
}

/** The PHB [normal, long] range in feet, by base id, then by a base name inside the item name. */
export function weaponRangeFeet(weapon: WeaponLike | undefined): readonly [number, number] | undefined {
  if (!weapon) return undefined;
  const byId = WEAPON_RANGES_FT[weapon.id];
  if (byId) return byId;
  const name = weapon.name.toLowerCase().replace(/\s+/g, '_');
  // Longest key first, so "light_crossbow" wins over a shorter key it contains.
  const key = Object.keys(WEAPON_RANGES_FT)
    .sort((a, b) => b.length - a.length)
    .find((k) => name.includes(k));
  return key ? WEAPON_RANGES_FT[key] : undefined;
}

/** Melee reach in tiles: 2 (10 ft) for the Reach property, else 1. */
export function weaponReachTiles(weapon: WeaponLike | undefined): number {
  return hasWeaponProperty(weapon, 'reach') ? 2 : 1;
}

/** Normal range in tiles for a ranged or thrown attack, or undefined when the table has no entry. */
export function weaponNormalRangeTiles(weapon: WeaponLike | undefined): number | undefined {
  const range = weaponRangeFeet(weapon);
  return range ? Math.max(1, Math.floor(range[0] / FEET_PER_TILE)) : undefined;
}

/** Long range in tiles for a ranged or thrown attack, or undefined when the table has no entry. */
export function weaponLongRangeTiles(weapon: WeaponLike | undefined): number | undefined {
  const range = weaponRangeFeet(weapon);
  return range ? Math.max(1, Math.floor(range[1] / FEET_PER_TILE)) : undefined;
}

/** The farthest a target may be for this ability: its long range when it has one, else its range. */
export function maxAttackRangeTiles(ability: { range: number; longRange?: number }): number {
  return Math.max(ability.range, ability.longRange ?? 0);
}

/**
 * True when the target sits past the normal range but within the long range,
 * where a ranged or thrown attack roll has Disadvantage (PHB). Abilities with
 * no long range never qualify.
 */
export function isAtLongRange(ability: { range: number; longRange?: number }, distanceTiles: number): boolean {
  return ability.longRange !== undefined && distanceTiles > ability.range && distanceTiles <= ability.longRange;
}

/** Log reason for the long-range Disadvantage. */
export const LONG_RANGE_REASON = 'Long range';

/** Ability id suffix of the extra "Throw" attack a thrown melee weapon gets. */
export const THROWN_ATTACK_ID_SUFFIX = '_thrown';

/** True for the "Throw" attack ability built from a thrown melee weapon. */
export function isThrownAttackAbilityId(abilityId: string | undefined): boolean {
  return Boolean(abilityId?.endsWith(THROWN_ATTACK_ID_SUFFIX));
}
