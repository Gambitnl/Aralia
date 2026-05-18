/**
 * This file compares the legal value lists used by paired spell template fields.
 *
 * A field mapping is not actually trustworthy if the structured template allows
 * one vocabulary while the runtime JSON template allows another. The spell
 * validator uses this helper to detect that split directly, before downstream
 * reports have to rediscover it as corpus drift.
 *
 * Called by: validateSpellTemplateContracts.ts and its focused Vitest coverage
 * Depends on: plain string lists supplied by the template validator
 */

// ============================================================================
// Comparison Result Shape
// ============================================================================
// This small result object keeps the validator output specific. It records which
// values belong only to structured markdown and which belong only to runtime JSON.
// ============================================================================

export interface TemplateValueSetMismatch {
  fieldName: string;
  structuredOnly: string[];
  runtimeOnly: string[];
}

// ============================================================================
// Shared Normalization
// ============================================================================
// Template audits already treat casing differences such as `Cube` and `cube` as
// normalization debt rather than different mechanics. This helper mirrors that
// policy so value-set parity uses the same rule as the rest of the validator.
// ============================================================================

function normalizeValues(values: string[]): Map<string, string> {
  const normalized = new Map<string, string>();

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (!normalized.has(key)) {
      normalized.set(key, trimmed);
    }
  }

  return normalized;
}

// ============================================================================
// Public Comparison Helper
// ============================================================================
// The validator passes in the two value lists for one mapped template pair.
// Returning null means the lists agree. Returning a mismatch means the template
// contract needs review before completion claims can rely on it.
// ============================================================================

export function compareAcceptedValueSets(
  fieldName: string,
  structuredValues: string[],
  runtimeValues: string[],
): TemplateValueSetMismatch | null {
  const structured = normalizeValues(structuredValues);
  const runtime = normalizeValues(runtimeValues);

  const structuredOnly = [...structured.entries()]
    .filter(([key]) => !runtime.has(key))
    .map(([, value]) => value)
    .sort((left, right) => left.localeCompare(right));

  const runtimeOnly = [...runtime.entries()]
    .filter(([key]) => !structured.has(key))
    .map(([, value]) => value)
    .sort((left, right) => left.localeCompare(right));

  if (structuredOnly.length === 0 && runtimeOnly.length === 0) {
    return null;
  }

  return {
    fieldName,
    structuredOnly,
    runtimeOnly,
  };
}
