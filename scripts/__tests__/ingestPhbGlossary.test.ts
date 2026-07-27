/**
 * This file protects the PHB ingest's item-metadata boundary.
 *
 * The tests use raw 5eTools-style objects to prove that every established item
 * transformation survives typed validation, malformed vendor fields are ignored,
 * and the function continues returning the shared GlossaryEntry metadata shape.
 *
 * Called by: the focused Vitest ingest suite.
 * Depends on: buildItemMetadata and the shared GlossaryEntry type contract.
 */

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { GlossaryEntry } from '../../src/types/ui';
import { buildItemMetadata } from '../ingestPhbGlossary';

describe('buildItemMetadata', () => {
  it('only includes allowed fields and preserves every standard transformation', () => {
    // This record mirrors a normal typed 5eTools weapon and includes unrelated
    // vendor fields that must never leak into the UI metadata contract.
    const item = {
      name: 'Test Item',
      source: 'XPHB',
      type: 'G|A',
      rarity: 'uncommon',
      tier: 'minor',
      reqAttune: true,
      value: 50000, // 500 gp in cp
      weight: 10,
      dmg1: '1d8',
      dmgType: 'slashing',
      property: ['V', 'H'],
      ac: 15,
      // Extra fields that should be stripped
      foo: 'bar',
      another: 'property',
      entries: ['description'],
    };

    const typeMap = {
        'G': 'Adventuring Gear',
        'A': 'Ammunition'
    };

    const metadata = buildItemMetadata(item, typeMap);

    expect(metadata).toEqual({
      type: 'Adventuring Gear',
      rarity: 'Uncommon',
      tier: 'Minor',
      reqAttune: 'Required',
      cost: 500,
      weight: 10,
      damage: '1d8 slashing',
      properties: ['V', 'H'],
      ac: 15,
    });
  });

  it('handles missing optional fields gracefully', () => {
    const item = {
      name: 'Simple Item',
      source: 'XPHB',
      rarity: 'none'
    };
    const typeMap = {};
    const metadata = buildItemMetadata(item, typeMap);

    expect(metadata).toEqual({
        rarity: 'None'
    });
  });

  it('preserves string-based attunement requirements', () => {
    const item = {
      name: 'Attunement Item',
      source: 'XPHB',
      rarity: 'rare',
      reqAttune: 'by a spellcaster',
    };
    const typeMap = {};
    const metadata = buildItemMetadata(item, typeMap);
    expect(metadata).toEqual({
        rarity: 'Rare',
        reqAttune: 'Required by a spellcaster'
    });
  });

  it.each([
    ['wondrous', 'Wondrous Item'],
    ['potion', 'Potion'],
    ['ring', 'Ring'],
    ['rod', 'Rod'],
    ['scroll', 'Scroll'],
    ['staff', 'Staff'],
    ['wand', 'Wand'],
  ] as const)('preserves the %s magical-item fallback', (flag, expectedType) => {
    // Magic-item records can omit `type`; the boolean category flags are the
    // authoritative fallback used by the existing generated glossary.
    expect(buildItemMetadata({ [flag]: true }, {})).toEqual({ type: expectedType });
  });

  it('ignores malformed unknown fields while retaining valid raw item facts', () => {
    // Each bad value represents a shape JSON can deliver but the shared UI type
    // cannot safely consume. Valid fields in the same record still survive.
    const metadata = buildItemMetadata({
      type: { abbreviation: 'G' },
      wondrous: 'true',
      rarity: 42,
      tier: 'major',
      reqAttune: { class: 'wizard' },
      value: '50000',
      weight: 2,
      dmg1: '1d6',
      dmgType: { code: 'P' },
      property: ['V', 7],
      ac: Number.POSITIVE_INFINITY,
    }, {});

    expect(metadata).toEqual({
      tier: 'Major',
      weight: 2,
      damage: '1d6',
    });
  });

  it('normalizes a conditional 5eTools property into the shared string contract', () => {
    // Lance-style records mix simple codes with a structured conditional code.
    // The note remains visible while the UI continues receiving only strings.
    expect(buildItemMetadata({
      property: [
        'H|XPHB',
        'R|XPHB',
        { uid: '2H|XPHB', note: 'unless mounted' },
      ],
    }, {})).toEqual({
      properties: ['H|XPHB', 'R|XPHB', '2H|XPHB (unless mounted)'],
    });
  });

  it.each([null, undefined, 'not-an-item', 42, []])('returns null for a non-object raw value: %j', (item) => {
    expect(buildItemMetadata(item, {})).toBeNull();
  });

  it('returns the existing GlossaryEntry itemMetadata contract', () => {
    // This compile-time assertion prevents the ingest from drifting into a
    // second UI metadata interface even when runtime fields are later extended.
    expectTypeOf(buildItemMetadata({}, {})).toEqualTypeOf<
      NonNullable<GlossaryEntry['itemMetadata']> | null
    >();
  });

  it('does not return a metadata object if no relevant fields are present', () => {
      const item = {
          name: 'Non-item thing',
          source: 'XPHB',
          entries: ['fluff'],
      };
      const typeMap = {};
      const metadata = buildItemMetadata(item, typeMap);
      expect(metadata).toBeNull();
  });
});
