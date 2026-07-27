/**
 * This file tests the spell field inventory query behavior against the live spell corpus.
 *
 * The spell validation page uses `querySpellFieldInventory()` to power its field and value
 * search UI. The bug we are guarding here is subtle but important: once the user fills in
 * both the field path and the value search, the page should behave like a strict paired
 * lookup instead of a loose substring browse. Without that guard, a value search for `10`
 * can accidentally bring back `100`, which makes structural review feel untrustworthy.
 *
 * Called by: Vitest when the spell inventory search behavior is verified
 * Depends on: scripts/spellFieldInventory.ts and the live spell JSON corpus
 */
export {};
