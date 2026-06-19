
import { describe, it, expect } from 'vitest';
import { buildItemMetadata } from '../ingestPhbGlossary';

describe('buildItemMetadata', () => {
  it('should only include allowed fields and handle transformations', () => {
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

  it('should handle missing optional fields gracefully', () => {
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

  it('should handle string-based reqAttune', () => {
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

  it('should not return a metadata object if no relevant fields are present', () => {
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
