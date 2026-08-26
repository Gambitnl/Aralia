/**
 * @file itemTaxonomy.test.ts
 * Proof for agora-6820.2: the item registry is on the ItemType enum and the
 * canonical damage-type union, with no magic strings left in the data.
 *
 * The compiler already enforces this on hand-authored literals. These tests
 * guard the runtime surface too: the generated glossary items and anything
 * merged in through a cast still have to name a real ItemType, and every
 * weapon damage type has to be one of the canonical thirteen.
 */
import { describe, it, expect } from 'vitest';
import { ALL_ITEMS } from '../items/index';
import { ItemType, ItemTypeDefinitions } from '../../types/items';
import { DamageType, toCanonicalDamageType } from '../../types/spellDamageMetadata';

const ITEM_TYPE_VALUES = new Set<string>(Object.values(ItemType));
const DAMAGE_TYPE_VALUES = new Set<string>(Object.values(DamageType));

describe('item taxonomy (agora-6820.2)', () => {
  it('gives every ItemType member a trait definition', () => {
    for (const value of Object.values(ItemType)) {
      expect(ItemTypeDefinitions[value]).toBeDefined();
    }
  });

  it('types every registry item with an ItemType member', () => {
    const offenders = Object.values(ALL_ITEMS)
      .filter(item => !ITEM_TYPE_VALUES.has(item.type as string))
      .map(item => `${item.id}: ${String(item.type)}`);
    expect(offenders).toEqual([]);
  });

  it('gives every registry item a canonical damage type or none at all', () => {
    const offenders = Object.values(ALL_ITEMS)
      .filter(item => item.damageType !== undefined && !DAMAGE_TYPE_VALUES.has(item.damageType as string))
      .map(item => `${item.id}: ${String(item.damageType)}`);
    expect(offenders).toEqual([]);
  });

  it('resolves free-text damage labels to canonical names and rejects unknown ones', () => {
    expect(toCanonicalDamageType('bludgeoning')).toBe(DamageType.Bludgeoning);
    expect(toCanonicalDamageType('  SLASHING ')).toBe(DamageType.Slashing);
    expect(toCanonicalDamageType('kinetic')).toBeUndefined();
    expect(toCanonicalDamageType(undefined)).toBeUndefined();
  });
});
