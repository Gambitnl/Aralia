/**
 * This file tests the value-set comparison helper used by the spell template validator.
 *
 * The validator already knew whether structured fields and JSON paths were mapped,
 * but it could still miss a more dangerous failure: both templates referring to the
 * same field while allowing different vocabularies for that field. These tests keep
 * that coverage in place so "template contract is clean" means the two layers agree
 * on the non-prose values they allow.
 *
 * Called by: Vitest
 * Depends on: scripts/spellTemplateValueParity.ts
 */

import { describe, expect, it } from 'vitest';
import { compareAcceptedValueSets } from '../spellTemplateValueParity';

// ============================================================================
// Value-Set Alignment
// ============================================================================
// This section covers the small pure helper that tells the validator whether a
// mapped structured/runtime field pair agrees on its legal enum vocabulary.
// ============================================================================

describe('compareAcceptedValueSets', () => {
  it('treats the same values as aligned even when casing differs', () => {
    const comparison = compareAcceptedValueSets('Area Shape', ['Cube', 'Sphere'], ['cube', 'sphere']);

    expect(comparison).toBeNull();
  });

  it('reports values that exist in only one side of the mapped template pair', () => {
    const comparison = compareAcceptedValueSets(
      'Effect Type',
      ['DAMAGE', 'UTILITY', 'BUFF'],
      ['DAMAGE', 'UTILITY'],
    );

    expect(comparison).toEqual({
      fieldName: 'Effect Type',
      structuredOnly: ['BUFF'],
      runtimeOnly: [],
    });
  });
});
