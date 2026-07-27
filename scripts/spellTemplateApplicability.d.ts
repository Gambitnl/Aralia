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
export declare const EXPLICIT_NOT_APPLICABLE_VALUE = "not_applicable";
export type ApplicabilityValueClassification = 'explicit_not_applicable' | 'implicit_not_applicable' | 'specified';
export declare function classifyApplicabilityValue(value: string): ApplicabilityValueClassification;
