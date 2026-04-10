/**
 * This file tests the spell field inventory query behavior against the live spell corpus.
 *
 * The spell validation page uses `querySpellFieldInventory()` to power its field and value
 * search UI. The bug we are guarding here is subtle but important: once the user fills in
 * both the field path and the value search, the page should behave like a strict paired
 * lookup instead of a loose substring browse. Without that guard, a value search for `10`
 * can accidentally bring back `100`, which makes structural review feel untrustworthy.
 *
 * Called by: Vitest when the spell inventory search behavior is verified
 * Depends on: scripts/spellFieldInventory.ts and the live spell JSON corpus
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { buildSpellFieldInventory, querySpellFieldInventory, type SpellFieldInventory } from '../spellFieldInventory';

// ============================================================================
// Shared live-inventory fixture
// ============================================================================
// Building the full spell inventory walks the whole spell corpus, so the test
// does it once up front and then reuses that snapshot for the paired-query and
// browse-mode checks below.
// ============================================================================

let inventory: SpellFieldInventory;

beforeAll(() => {
  inventory = buildSpellFieldInventory();
});

describe('querySpellFieldInventory', () => {
  it('uses exact field+value matching when both filters are filled in', () => {
    const result = querySpellFieldInventory(inventory, {
      fieldPath: 'targeting.spatialDetails.measuredDetails[].value',
      value: '10',
      limit: 200,
    });

    // In strict combined mode, every returned occurrence should satisfy the full
    // pair exactly. This is the behavior the spell validation UI needs when the
    // user is checking one concrete field/value claim.
    expect(result.occurrences.length).toBeGreaterThan(0);
    expect(result.occurrences.every((occurrence) => occurrence.fieldPath === 'targeting.spatialDetails.measuredDetails[].value')).toBe(true);
    expect(result.occurrences.every((occurrence) => occurrence.value === '10')).toBe(true);
    expect(result.distinctValues.map((entry) => entry.value)).toEqual(['10']);

    // The validation page now lets the user open the runtime JSON in-browser and
    // shows the exact line that matched the field/value pair. This assertion keeps
    // those result-row affordances from regressing back to opaque file-only output.
    expect(result.occurrences.every((occurrence) => occurrence.browserPath.startsWith('/Aralia/data/spells/'))).toBe(true);
    expect(result.occurrences.every((occurrence) => typeof occurrence.lineNumber === 'number' && occurrence.lineNumber > 0)).toBe(true);
    expect(result.occurrences.some((occurrence) => occurrence.semanticFieldPath === 'targeting.spatialDetails.measuredDetails[Container Water Volume].value')).toBe(true);
    expect(result.occurrences.some((occurrence) => occurrence.semanticFieldPath === 'targeting.spatialDetails.measuredDetails[Higher-Level Volume Increase].value')).toBe(true);
  });

  it('keeps loose substring matching when only the value filter is filled in', () => {
    const result = querySpellFieldInventory(inventory, {
      value: '10',
      limit: 200,
    });

    // Single-filter browse mode stays intentionally broad so the page still works
    // as a discovery tool when the user is not trying to confirm one exact lane.
    expect(result.occurrences.length).toBeGreaterThan(0);
    expect(result.distinctValues.some((entry) => entry.value === '100')).toBe(true);
  });
});
