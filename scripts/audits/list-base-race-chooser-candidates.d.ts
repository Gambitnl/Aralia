#!/usr/bin/env tsx
/**
 * Lists races that look like "base/parent" entries:
 * - They have at least one other race whose baseRace equals their id.
 * - Optionally they also contain "choice" fields (fiendishLegacies, elvenLineages, etc).
 *
 * This is meant to support decisions like:
 * - keep base race selectable
 * - make base race non-selectable and force variants
 * - keep base race for glossary-only, but hide from character creator
 */
export {};
