/**
 * This file tests how the spell template validator classifies applicability placeholders.
 *
 * The updated spell-completion goal requires every field to stay explicit. Empty
 * strings, `None`, and `N/A` are easy to overlook because they look harmless in
 * prose, but they do not give the schema one stable "this truly does not apply"
 * value. These tests protect the helper that separates explicit non-applicability
 * from older implicit placeholders.
 *
 * Called by: Vitest
 * Depends on: scripts/spellTemplateApplicability.ts
 */

import { describe, expect, it } from 'vitest';
import { classifyApplicabilityValue } from '../spellTemplateApplicability';

// ============================================================================
// Applicability Placeholder Classification
// ============================================================================
// The validator needs one consistent policy across fields: a deliberate sentinel
// is acceptable, while older empty-ish stand-ins must become visible migration debt.
// ============================================================================

describe('classifyApplicabilityValue', () => {
  it('recognizes the explicit not-applicable sentinel', () => {
    expect(classifyApplicabilityValue('not_applicable')).toBe('explicit_not_applicable');
  });

  it('treats legacy blank-like values as implicit placeholders that need migration', () => {
    expect(classifyApplicabilityValue('')).toBe('implicit_not_applicable');
    expect(classifyApplicabilityValue('None')).toBe('implicit_not_applicable');
    expect(classifyApplicabilityValue('N/A')).toBe('implicit_not_applicable');
  });

  it('leaves normal spell values alone', () => {
    expect(classifyApplicabilityValue('action')).toBe('specified');
  });
});
