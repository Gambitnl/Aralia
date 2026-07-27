#!/usr/bin/env npx tsx
/**
 * @file sync-race-modernization-status.ts
 * Propagates the authoritative `modernizationStatus` value from character-creator
 * race definitions (src/data/races/*.ts) into the matching glossary race entries
 * (public/data/glossary/entries/races/**\/*.json).
 *
 * This is PURE data propagation (gap RM-043):
 *   - The TS race file is the source of truth and is READ-ONLY here.
 *   - Only races whose TS file ALREADY declares a `modernizationStatus` are synced.
 *     Races with no TS flag are left completely untouched (a judgment call reserved
 *     for a human).
 *   - The TS race is joined to a glossary JSON STRICTLY by matching the `id` field.
 *     No suffix-stripping / fuzzy mapping is performed. A flagged TS race with no
 *     glossary entry whose `id` equals it is skipped and reported.
 *   - The value written is byte-identical to the TS value.
 *
 * The script is idempotent / re-runnable: writing an already-correct value is a no-op.
 *
 * Usage:
 *   npx tsx scripts/sync-race-modernization-status.ts
 */
export {};
