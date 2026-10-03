/**
 * These tests guard the harvested culture vocabulary.
 *
 * The 24 names in cultureStructures.ts are the only surviving copy of content
 * that lived in the retired 2D village generator. The count test is therefore
 * a content test, not a style test: if a name disappears, authored settlement
 * flavor has been lost and there is nowhere left to read it back from.
 *
 * The rest prove the table is usable by the town engine — every name resolves
 * to a BuildingType the plot packer already places, every accent names only
 * known structures, and every architecture family reaches a vocabulary.
 */

import { describe, expect, it } from 'vitest';
import { STYLE_FAMILIES } from '../architectureStyle';
import { RESIDENTIAL_TYPES } from '../population';
import {
  BIOME_FAMILY_TO_BIOME_STYLE,
  BIOME_FAMILY_TO_CULTURE_ACCENT,
  CULTURE_ACCENTS,
  CULTURE_STRUCTURES,
  CULTURE_STRUCTURE_NAMES,
  RACE_TO_CULTURE_ACCENT,
  STYLE_FAMILY_ACCENTS,
  biomeStyleForFamily,
  cultureAccentFor,
  structuresForStyleFamily,
  type CultureAccent,
  type CultureStructureName,
} from '../cultureStructures';

const EXPECTED_NAMES: CultureStructureName[] = [
  'treehouse_small', 'treehouse_large', 'ancient_circle', 'weaver_hall',
  'stone_hall_small', 'stone_hall_large', 'forge_temple', 'underground_entrance',
  'hide_tent', 'longhouse', 'totem_pole', 'war_memorial',
  'dock', 'lighthouse', 'shipwright', 'fish_market',
  'magic_academy', 'arcane_tower', 'healers_hut', 'alchemist_shop',
  'caravan_stop', 'nomad_yurt', 'trading_post', 'shrine',
];

describe('harvested culture structures', () => {
  it('keeps all 24 culture-keyed names from the retired village generator', () => {
    expect(CULTURE_STRUCTURE_NAMES).toHaveLength(24);
    expect(new Set(CULTURE_STRUCTURE_NAMES)).toEqual(new Set(EXPECTED_NAMES));
  });

  it('records every name under its own key with a readable blurb', () => {
    for (const name of EXPECTED_NAMES) {
      const entry = CULTURE_STRUCTURES[name];
      expect(entry.name).toBe(name);
      expect(entry.blurb.length).toBeGreaterThan(10);
    }
  });

  it('covers all six authored culture groups', () => {
    const cultures = new Set(CULTURE_STRUCTURE_NAMES.map((n) => CULTURE_STRUCTURES[n].culture));
    expect([...cultures].sort()).toEqual(['dwarven', 'elven', 'exotic', 'magical', 'marine', 'orcish']);
  });

  it('marks residential structures with a residential BuildingType', () => {
    for (const name of EXPECTED_NAMES) {
      const entry = CULTURE_STRUCTURES[name];
      if (entry.role === 'residential') {
        expect(RESIDENTIAL_TYPES.has(entry.buildingType)).toBe(true);
      } else {
        expect(RESIDENTIAL_TYPES.has(entry.buildingType)).toBe(false);
      }
    }
  });

  it('gives a civic kind only to town-scale landmarks', () => {
    expect(CULTURE_STRUCTURES.dock.civicKind).toBe('dock');
    expect(CULTURE_STRUCTURES.shrine.civicKind).toBe('temple');
    expect(CULTURE_STRUCTURES.ancient_circle.civicKind).toBe('temple');
    expect(CULTURE_STRUCTURES.forge_temple.civicKind).toBe('temple');
    expect(CULTURE_STRUCTURES.nomad_yurt.civicKind).toBeUndefined();
  });
});

describe('culture accents', () => {
  it('names only known structures', () => {
    for (const vocab of Object.values(CULTURE_ACCENTS)) {
      for (const name of [...vocab.civic, ...vocab.commercial, ...vocab.residential]) {
        expect(CULTURE_STRUCTURES[name]).toBeDefined();
      }
    }
  });

  it('files each named structure under its own role', () => {
    for (const vocab of Object.values(CULTURE_ACCENTS)) {
      for (const name of vocab.civic) expect(CULTURE_STRUCTURES[name].role).toBe('civic');
      for (const name of vocab.commercial) expect(CULTURE_STRUCTURES[name].role).toBe('commercial');
      for (const name of vocab.residential) expect(CULTURE_STRUCTURES[name].role).toBe('residential');
    }
  });

  it('reaches every harvested name through at least one accent', () => {
    const reached = new Set<CultureStructureName>();
    for (const vocab of Object.values(CULTURE_ACCENTS)) {
      for (const name of [...vocab.civic, ...vocab.commercial, ...vocab.residential]) reached.add(name);
    }
    expect([...reached].sort()).toEqual([...EXPECTED_NAMES].sort());
  });
});

describe('style family bridge', () => {
  it('keys on exactly the five architecture style families', () => {
    expect(Object.keys(STYLE_FAMILY_ACCENTS).sort()).toEqual(Object.keys(STYLE_FAMILIES).sort());
    expect(Object.keys(STYLE_FAMILY_ACCENTS).sort()).toEqual([
      'coastalTimber', 'highlandStone', 'riverHalfTimber', 'roughLog', 'temperateFrame',
    ]);
  });

  it('gives every family a non-empty, de-duplicated vocabulary', () => {
    for (const familyId of Object.keys(STYLE_FAMILY_ACCENTS) as (keyof typeof STYLE_FAMILY_ACCENTS)[]) {
      const names = structuresForStyleFamily(familyId);
      expect(names.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('gives a coastal family its marine structures', () => {
    expect(structuresForStyleFamily('coastalTimber')).toContain('lighthouse');
    expect(structuresForStyleFamily('roughLog')).toContain('longhouse');
    expect(structuresForStyleFamily('highlandStone')).toContain('stone_hall_large');
  });

  it('throws on an unknown family rather than defaulting', () => {
    expect(() => structuresForStyleFamily('driftwoodShanty' as never)).toThrow(/culture accents/);
  });
});

describe('harvested biome and race rules', () => {
  it('maps every biome family of src/data/biomes.ts to a style and an accent', () => {
    const families = ['forest', 'plains', 'wetland', 'jungle', 'coastal', 'desert', 'mountain', 'tundra', 'volcanic', 'blight', 'special'];
    for (const family of families) {
      expect(BIOME_FAMILY_TO_BIOME_STYLE[family]).toBeDefined();
      expect(BIOME_FAMILY_TO_CULTURE_ACCENT[family]).toBeDefined();
    }
    expect(biomeStyleForFamily('desert')).toBe('arid');
    expect(biomeStyleForFamily('mountain')).toBe('highland');
  });

  it('lets race outrank biome', () => {
    expect(cultureAccentFor({ biomeFamily: 'desert', dominantRace: 'dwarf' })).toBe('industrial');
    expect(cultureAccentFor({ biomeFamily: 'desert' })).toBe('nomadic');
  });

  it('reads a magical biome as magical only when no race dominates', () => {
    expect(cultureAccentFor({ biomeFamily: 'plains', magicalBiome: true })).toBe('magical');
    expect(cultureAccentFor({ biomeFamily: 'plains', dominantRace: 'orc', magicalBiome: true })).toBe('tribal');
  });

  it('covers every race the VillagePersonality type allows', () => {
    const races = ['human', 'elf', 'dwarf', 'orc', 'halfling', 'gnome', 'dragonborn', 'tiefling', 'other'];
    for (const race of races) {
      const accent: CultureAccent = RACE_TO_CULTURE_ACCENT[race];
      expect(CULTURE_ACCENTS[accent]).toBeDefined();
    }
  });

  it('throws on an unknown biome family and an unknown race', () => {
    expect(() => biomeStyleForFamily('moonscape')).toThrow(/biome style/);
    expect(() => cultureAccentFor({ biomeFamily: 'moonscape' })).toThrow(/culture accent/);
    expect(() => cultureAccentFor({ biomeFamily: 'plains', dominantRace: 'kobold' })).toThrow(/race/);
  });
});
