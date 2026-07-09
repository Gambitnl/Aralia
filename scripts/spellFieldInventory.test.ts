import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildSpellFieldInventory,
  querySpellFieldInventory,
  type InventoryFieldSummary,
  type SpellFieldInventory,
} from './spellFieldInventory';

/**
 * This file proves the spell field inventory API against a fixed, hand-built spell
 * fixture instead of the live corpus.
 *
 * The live-corpus test in `scripts/__tests__/spellFieldInventory.test.ts` guards the
 * strict-vs-loose paired-query behavior on real data, but it cannot assert exact
 * counts because the corpus changes. This test writes two tiny spell files into a
 * temporary root, points `buildSpellFieldInventory()` at that root, and then asserts
 * fixed structural facts plus the strict (exact) and loose (substring) query modes.
 *
 * Called by: Vitest
 * Depends on: scripts/spellFieldInventory.ts (build + query) and a throwaway fixture root
 */

// ============================================================================
// Fixture spell corpus
// ============================================================================
// Building the inventory walks `level-*` folders under a root, so the fixture
// writes two deterministic spells (one per level) into a temp directory and hands
// that root to the build seam. Both files are pretty-printed so occurrence line
// numbers resolve just like they do for the real, pretty-printed spell JSON.
// ============================================================================

const FIXTURE_A = {
  id: 'fixture-alpha',
  name: 'Fixture Alpha',
  level: 0,
  school: 'evocation',
  range: { value: 10, unit: 'feet' },
  components: ['V', 'S'],
  description: 'A prose-heavy field the structural browser should hide by default.',
};

const FIXTURE_B = {
  id: 'fixture-beta',
  name: 'Fixture Beta',
  level: 1,
  school: 'evocation',
  range: { value: 100, unit: 'feet' },
  components: ['V'],
};

let fixtureRoot: string;
let inventory: SpellFieldInventory;

function fieldByPath(inv: SpellFieldInventory, fieldPath: string): InventoryFieldSummary | undefined {
  return inv.fields.find((field) => field.fieldPath === fieldPath);
}

beforeAll(() => {
  fixtureRoot = path.join(os.tmpdir(), `aralia-spell-inventory-${randomUUID()}`);
  fs.mkdirSync(path.join(fixtureRoot, 'level-0'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'level-1'), { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, 'level-0', 'fixture-alpha.json'), JSON.stringify(FIXTURE_A, null, 2), 'utf8');
  fs.writeFileSync(path.join(fixtureRoot, 'level-1', 'fixture-beta.json'), JSON.stringify(FIXTURE_B, null, 2), 'utf8');

  inventory = buildSpellFieldInventory({ spellsRoot: fixtureRoot, repoRoot: fixtureRoot });
});

afterAll(() => {
  if (fixtureRoot && fs.existsSync(fixtureRoot)) {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

// ============================================================================
// buildSpellFieldInventory
// ============================================================================
// This section proves the crawler turns the fixture into the expected normalized
// spell records, field summaries, and occurrence counts.
// ============================================================================

describe('buildSpellFieldInventory (fixed fixture)', () => {
  it('discovers both fixture spells and orders them by level then name', () => {
    expect(inventory.spellCount).toBe(2);
    expect(inventory.sourceRoot).toBe(fixtureRoot);
    expect(inventory.spells.map((spell) => spell.spellId)).toEqual(['fixture-alpha', 'fixture-beta']);
    expect(inventory.spells[0].level).toBe(0);
    expect(inventory.spells[1].level).toBe(1);
  });

  it('keeps the summary counters consistent with the collected arrays', () => {
    expect(inventory.fieldCount).toBe(inventory.fields.length);
    expect(inventory.occurrenceCount).toBe(inventory.occurrences.length);
    expect(inventory.occurrenceCount).toBeGreaterThan(0);
  });

  it('normalizes nested field paths and merges values across both spells', () => {
    const fieldPaths = inventory.fields.map((field) => field.fieldPath);
    // Field summaries are sorted by path, and nested/array leaves are normalized.
    expect(fieldPaths).toEqual([...fieldPaths].sort((a, b) => a.localeCompare(b)));
    expect(fieldPaths).toEqual(expect.arrayContaining(['components[]', 'range', 'range.value', 'range.unit', 'school']));

    const rangeValue = fieldByPath(inventory, 'range.value');
    expect(rangeValue).toBeDefined();
    expect(rangeValue?.containerKind).toBe('number');
    expect(rangeValue?.spellCount).toBe(2);
    expect(rangeValue?.distinctValueCount).toBe(2);

    const school = fieldByPath(inventory, 'school');
    expect(school?.sampleValues[0]).toMatchObject({ value: 'evocation', occurrenceCount: 2, spellCount: 2 });
  });

  it('flags free-text fields and attaches resolved line numbers to leaves', () => {
    const description = fieldByPath(inventory, 'description');
    expect(description?.containsFreeTextValues).toBe(true);

    const rangeValueOccurrence = inventory.occurrences.find(
      (occurrence) => occurrence.fieldPath === 'range.value' && occurrence.value === '10',
    );
    expect(rangeValueOccurrence).toBeDefined();
    expect(typeof rangeValueOccurrence?.lineNumber).toBe('number');
    expect(rangeValueOccurrence?.lineNumber as number).toBeGreaterThan(0);
  });
});

// ============================================================================
// querySpellFieldInventory
// ============================================================================
// This section proves the two search modes the validation page relies on:
// strict paired matching (both filters => exact) and loose browse matching
// (single filter => substring), plus the default free-text exclusion.
// ============================================================================

describe('querySpellFieldInventory (fixed fixture)', () => {
  it('uses exact field+value matching when both filters are filled in', () => {
    const result = querySpellFieldInventory(inventory, { fieldPath: 'range.value', value: '10', limit: 200 });

    expect(result.occurrences.length).toBe(1);
    expect(result.occurrences.every((occurrence) => occurrence.fieldPath === 'range.value')).toBe(true);
    expect(result.occurrences.every((occurrence) => occurrence.value === '10')).toBe(true);
    // Strict mode must not let the substring `10` drag in the sibling value `100`.
    expect(result.distinctValues.map((entry) => entry.value)).toEqual(['10']);
    expect(result.totalMatches).toBe(1);
  });

  it('keeps loose substring matching when only the value filter is filled in', () => {
    const result = querySpellFieldInventory(inventory, { value: '10', limit: 200 });

    // Browse mode stays broad, so the substring `10` surfaces both `10` and `100`.
    const values = result.distinctValues.map((entry) => entry.value).sort();
    expect(values).toEqual(['10', '100']);
  });

  it('excludes free-text lanes by default and includes them on request', () => {
    const defaultResult = querySpellFieldInventory(inventory, { limit: 200 });
    expect(defaultResult.fieldMatches.some((field) => field.fieldPath === 'description')).toBe(false);
    expect(defaultResult.occurrences.every((occurrence) => occurrence.isFreeText === false)).toBe(true);

    const withFreeText = querySpellFieldInventory(inventory, { fieldPath: 'description', includeFreeText: true, limit: 200 });
    expect(withFreeText.fieldMatches.some((field) => field.fieldPath === 'description')).toBe(true);
  });

  it('filters occurrences by spell level', () => {
    const level1 = querySpellFieldInventory(inventory, { fieldPath: 'range.value', level: 1, limit: 200 });
    expect(level1.occurrences.length).toBeGreaterThan(0);
    expect(level1.occurrences.every((occurrence) => occurrence.level === 1)).toBe(true);
    expect(level1.occurrences.every((occurrence) => occurrence.value === '100')).toBe(true);
  });
});
