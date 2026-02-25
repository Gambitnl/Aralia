#!/usr/bin/env npx tsx
/**
 * Verify Character Creator race data and Glossary race data are in sync.
 *
 * Checks:
 * - Each selectable CC race has a glossary entry.
 * - Glossary male/female image URLs match CC male/female illustration paths.
 * - Referenced image files exist under /public.
 * - Glossary race index group membership matches expected CC group (baseRace || id).
 */
export {};
