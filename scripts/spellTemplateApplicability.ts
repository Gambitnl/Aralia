/**
 * This file names how spell-template values represent applicability.
 *
 * The long-term spell goal now requires a full template shape for every spell,
 * with a schema-safe explicit sentinel when a field truly does not apply. This
 * helper keeps that policy consistent so validators can distinguish deliberate
 * non-applicability from older blank-like placeholders that still need migration.
 *
 * Called by: validateSpellTemplateContracts.ts and focused Vitest coverage
 * Depends on: plain string field values supplied by template validators
 */

// ============================================================================
// Shared Sentinel Values
// ============================================================================
// `not_applicable` is the explicit sentinel the schema can carry forward.
// Older variants stay listed so the validator can surface them as migration debt.
// ============================================================================

export const EXPLICIT_NOT_APPLICABLE_VALUE = 'not_applicable';

const IMPLICIT_NOT_APPLICABLE_VALUES = new Set(['', 'none', 'n/a']);

export type ApplicabilityValueClassification =
  | 'explicit_not_applicable'
  | 'implicit_not_applicable'
  | 'specified';

// ============================================================================
// Public Classification Helper
// ============================================================================
// The validator uses this before ordinary enum checks. That keeps applicability
// policy separate from legitimate mechanical vocabulary such as `action` or `hour`.
// ============================================================================

export function classifyApplicabilityValue(value: string): ApplicabilityValueClassification {
  const normalized = value.trim().toLowerCase();

  if (normalized === EXPLICIT_NOT_APPLICABLE_VALUE) {
    return 'explicit_not_applicable';
  }

  if (IMPLICIT_NOT_APPLICABLE_VALUES.has(normalized)) {
    return 'implicit_not_applicable';
  }

  return 'specified';
}
