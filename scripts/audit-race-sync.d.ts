#!/usr/bin/env npx tsx
/**
 * @file audit-race-sync.ts
 * CLI script to audit synchronization between character creator races and glossary entries.
 *
 * This script compares races defined in src/data/races/ against glossary entries
 * in public/data/glossary/entries/races/ and generates a detailed report.
 *
 * Usage:
 *   npx tsx scripts/audit-race-sync.ts
 *   npm run audit:races
 *
 * Output:
 *   - Total counts for both systems
 *   - List of missing glossary entries
 *   - Sync coverage percentage
 *   - Grouped by base race for easier review
 */
export {};
