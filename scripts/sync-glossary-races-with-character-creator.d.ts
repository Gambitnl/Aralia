#!/usr/bin/env npx tsx
/**
 * Sync Glossary race grouping + images to match Character Creator.
 *
 * What it does:
 * - Normalizes glossary race IDs to match Character Creator IDs (underscores, goliath ancestry ids, etc).
 * - Removes legacy `imageUrl` from race glossary entries (renderer prefers male/female if present).
 * - Sets `maleImageUrl` / `femaleImageUrl` in glossary entries from Character Creator race visuals.
 * - Regenerates `public/data/glossary/index/character_races.json` so its grouping/membership matches
 *   Character Creator grouping (`baseRace || id`) + `src/data/races/raceGroups.ts` metadata.
 *
 * Usage:
 * - npx tsx scripts/sync-glossary-races-with-character-creator.ts
 */
export {};
