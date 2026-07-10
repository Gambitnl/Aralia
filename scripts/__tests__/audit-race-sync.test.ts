/**
 * @file audit-race-sync.test.ts
 * Fixture-based tests for the race-sync audit's modernizationStatus drift report.
 *
 * IMPORTANT: These tests use SYNTHETIC data only. They must NOT assert against the
 * live race/glossary corpus (which changes as content is authored) — they exercise
 * the audit's pure report logic against small in-memory fixtures.
 */

import { describe, it, expect } from 'vitest';
import {
  extractRacesFromContent,
  buildGlossaryEntryMap,
  resolveGlossaryEntry,
  computeModernizationDrift,
} from '../audit-race-sync';

// A synthetic glossary entry shaped like the audit's GlossaryEntry.
type Entry = {
  id: string;
  hasModernizationStatus: boolean;
  modernizationStatus?: string;
  filePath: string;
};

function entry(
  id: string,
  hasModernizationStatus: boolean,
  value?: string
): Entry {
  return {
    id,
    hasModernizationStatus,
    modernizationStatus: value,
    filePath: `synthetic/${id}.json`,
  };
}

describe('extractRacesFromContent', () => {
  it('parses id, name, baseRace, and modernizationStatus from a race export', () => {
    const content = `
      import type { Race } from '../../types/character';
      export const MOUNTAIN_DWARF_DATA: Race = {
        id: 'mountain_dwarf',
        name: 'Mountain Dwarf',
        baseRace: 'dwarf',
        traits: ['Darkvision'],
        modernizationStatus: 'modified_legacy',
      };
    `;
    const races = extractRacesFromContent(content, 'mountain_dwarf.ts');
    expect(races).toHaveLength(1);
    expect(races[0]).toMatchObject({
      id: 'mountain_dwarf',
      name: 'Mountain Dwarf',
      baseRace: 'dwarf',
      filename: 'mountain_dwarf.ts',
      modernizationStatus: 'modified_legacy',
    });
  });

  it('leaves modernizationStatus undefined when the field is absent', () => {
    const content = `
      export const AARAKOCRA_DATA: Race = {
        id: 'aarakocra',
        name: 'Aarakocra',
        traits: ['Flight'],
      };
    `;
    const races = extractRacesFromContent(content, 'aarakocra.ts');
    expect(races).toHaveLength(1);
    expect(races[0].modernizationStatus).toBeUndefined();
  });

  it('ignores exports without a traits field (subrace/benefit helpers)', () => {
    const content = `
      export const SOME_BENEFIT_DATA: Race = {
        id: 'some_benefit',
        name: 'Some Benefit',
      };
    `;
    expect(extractRacesFromContent(content, 'benefit.ts')).toHaveLength(0);
  });

  it('skips non-selectable base race ids (e.g. elf, dragonborn)', () => {
    const content = `
      export const ELF_DATA: Race = {
        id: 'elf',
        name: 'Elf',
        traits: ['Fey Ancestry'],
        modernizationStatus: 'official_2024',
      };
    `;
    expect(extractRacesFromContent(content, 'elf.ts')).toHaveLength(0);
  });

  it('scopes fields per-export so values do not leak between two races in one file', () => {
    const content = `
      export const HILL_DWARF_DATA: Race = {
        id: 'hill_dwarf',
        name: 'Hill Dwarf',
        traits: ['Dwarven Toughness'],
        modernizationStatus: 'modified_legacy',
      };
      export const RUNEWARD_DWARF_DATA: Race = {
        id: 'runeward_dwarf',
        name: 'Runeward Dwarf',
        traits: ['Rune Magic'],
      };
    `;
    const races = extractRacesFromContent(content, 'dwarves.ts');
    const byId = Object.fromEntries(races.map((r) => [r.id, r]));
    expect(byId.hill_dwarf.modernizationStatus).toBe('modified_legacy');
    // Second race declares no status; the first race's value must not bleed into it.
    expect(byId.runeward_dwarf.modernizationStatus).toBeUndefined();
  });
});

describe('resolveGlossaryEntry', () => {
  it('resolves a direct id match', () => {
    const map = buildGlossaryEntryMap([entry('aarakocra', false)]);
    expect(resolveGlossaryEntry('aarakocra', map)?.id).toBe('aarakocra');
  });

  it('resolves across hyphen/underscore normalization', () => {
    const map = buildGlossaryEntryMap([entry('deep-gnome', false)]);
    expect(resolveGlossaryEntry('deep_gnome', map)?.id).toBe('deep-gnome');
  });

  it('resolves suffix-stripped variants (e.g. fallen_aasimar -> fallen)', () => {
    const map = buildGlossaryEntryMap([entry('fallen', false)]);
    expect(resolveGlossaryEntry('fallen_aasimar', map)?.id).toBe('fallen');
  });

  it('resolves half_elf_ prefix variants (half_elf_aquatic -> aquatic)', () => {
    const map = buildGlossaryEntryMap([entry('aquatic', false)]);
    expect(resolveGlossaryEntry('half_elf_aquatic', map)?.id).toBe('aquatic');
  });

  it('returns undefined when nothing matches', () => {
    const map = buildGlossaryEntryMap([entry('aarakocra', false)]);
    expect(resolveGlossaryEntry('nonexistent_race', map)).toBeUndefined();
  });
});

describe('computeModernizationDrift', () => {
  const races = [
    { id: 'mountain_dwarf', name: 'Mountain Dwarf', filename: 'a.ts', modernizationStatus: 'modified_legacy' },
    { id: 'hill_dwarf', name: 'Hill Dwarf', filename: 'b.ts', modernizationStatus: 'modified_legacy' },
    { id: 'aarakocra', name: 'Aarakocra', filename: 'c.ts', modernizationStatus: 'official_2024' },
    // No modernizationStatus declared in TS — out of scope for drift entirely.
    { id: 'bugbear', name: 'Bugbear', filename: 'd.ts' },
  ];

  it('buckets TS-has / JSON-missing, TS-but-no-JSON, and in-sync', () => {
    const map = buildGlossaryEntryMap([
      // Matching JSON exists but MISSING the field -> drift.
      entry('mountain_dwarf', false),
      // Matching JSON exists AND has the field -> in sync.
      entry('hill_dwarf', true, 'modified_legacy'),
      // aarakocra: no glossary JSON at all -> TS-but-no-JSON.
      // bugbear: no glossary JSON, but also no TS status -> ignored.
    ]);

    const drift = computeModernizationDrift(races, map);

    expect(drift.inSync).toBe(1);

    expect(drift.tsHasJsonMissing).toHaveLength(1);
    expect(drift.tsHasJsonMissing[0].race.id).toBe('mountain_dwarf');
    expect(drift.tsHasJsonMissing[0].glossaryId).toBe('mountain_dwarf');

    expect(drift.tsButNoJson).toHaveLength(1);
    expect(drift.tsButNoJson[0].id).toBe('aarakocra');
  });

  it('ignores races that do not declare modernizationStatus in TS', () => {
    const map = buildGlossaryEntryMap([]);
    const onlyBugbear = races.filter((r) => r.id === 'bugbear');
    const drift = computeModernizationDrift(onlyBugbear, map);
    expect(drift.tsHasJsonMissing).toHaveLength(0);
    expect(drift.tsButNoJson).toHaveLength(0);
    expect(drift.inSync).toBe(0);
  });

  it('reports zero drift when every declared status is mirrored in JSON', () => {
    const map = buildGlossaryEntryMap([
      entry('mountain_dwarf', true, 'modified_legacy'),
      entry('hill_dwarf', true, 'modified_legacy'),
      entry('aarakocra', true, 'official_2024'),
    ]);
    const drift = computeModernizationDrift(races, map);
    expect(drift.tsHasJsonMissing).toHaveLength(0);
    expect(drift.tsButNoJson).toHaveLength(0);
    expect(drift.inSync).toBe(3);
  });
});
