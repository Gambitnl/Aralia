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
export {};
