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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildItemMetadata, entryJson, vendorSourcesPresent } from '../ingestPhbGlossary';

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

  it('captures structured magic-item mechanics', () => {
    // These field shapes mirror Gauntlets of Ogre Power, Belt of Dwarvenkind,
    // and Wand of Magic Missiles in the XDMG vendor data.
    const metadata = buildItemMetadata({
      rarity: 'uncommon',
      reqAttune: true,
      bonusWeapon: '+1',
      bonusAc: '+2',
      ability: { static: { str: 19 }, con: 2 },
      charges: 7,
      recharge: 'dawn',
      rechargeAmount: '{@dice 1d6 + 1}',
    }, {});

    expect(metadata).toEqual({
      rarity: 'Uncommon',
      reqAttune: 'Required',
      bonusWeapon: '+1',
      bonusAc: '+2',
      abilitySet: { str: 19 },
      abilityBonus: { con: 2 },
      charges: 7,
      recharge: 'dawn',
      rechargeAmount: '1d6 + 1',
    });
  });

  it('rejects malformed mechanic fields while keeping valid ones', () => {
    const metadata = buildItemMetadata({
      bonusWeapon: 'unknown',
      bonusAc: 3,
      ability: { choose: [{ from: ['str'], amount: 2 }], luck: 5, str: 'high' },
      charges: -2,
      recharge: 7,
      rechargeAmount: 4,
    }, {});

    // Only the numeric recharge amount survives; every other shape is invalid.
    expect(metadata).toEqual({ rechargeAmount: '4' });
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

// A clean clone has no gitignored vendor/ folder. The ingest must then write
// nothing (the tracked entries and manifest stay), and a partial copy must stop.
describe('vendorSourcesPresent', () => {
  const files = ['feats.json', 'items-base.json', 'items-base.json'];

  it('reports an absent data folder, so the ingest leaves the tracked output alone', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'ingest-vendor-'));
    try {
      expect(vendorSourcesPresent(path.join(root, 'vendor/5etools-src/data'), files)).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('accepts a complete data folder', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'ingest-vendor-'));
    try {
      for (const file of files) writeFileSync(path.join(root, file), '{}');
      expect(vendorSourcesPresent(root, files)).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('stops on a partial data folder and names each missing file once', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'ingest-vendor-'));
    try {
      mkdirSync(root, { recursive: true });
      writeFileSync(path.join(root, 'feats.json'), '{}');
      expect(() => vendorSourcesPresent(root, files)).toThrow(/lacks items-base\.json\. /);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

// A local rebuild with the vendor data once wrote 5eTools dashes and signs into
// 25 tracked entries, and the strict charset check failed CI (commit 2bdbee28b).
describe('entryJson', () => {
  it('writes every string value as checker-clean ASCII and keeps the JSON valid', () => {
    const entry = {
      title: 'Carpet of Flying, 6 ft. × 9 ft.',
      markdown: 'flint—or tinder—holds 1½ pints; the “deck” says …',
      tags: ['source:xphb', 'en–dash'],
      itemMetadata: { weight: 1.5 },
    };
    const text = entryJson(entry);
    // Printable ASCII plus the newlines of the 2-space JSON layout.
    expect([...text].filter((ch) => ch !== '\n' && (ch < ' ' || ch > '~'))).toEqual([]);
    expect(JSON.parse(text)).toEqual({
      title: 'Carpet of Flying, 6 ft. x 9 ft.',
      markdown: 'flint-or tinder-holds 11/2 pints; the "deck" says ...',
      tags: ['source:xphb', 'en-dash'],
      itemMetadata: { weight: 1.5 },
    });
  });
});
