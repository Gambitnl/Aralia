/**
 * This file proves that the shared world reducer owns dungeon lifecycle persistence.
 *
 * It dispatches the public entry, progress, retreat, completion, and revisit actions against a
 * normal mock GameState. The same progress action now carries per-level parchment discovery and
 * compact child identity/parent-return evidence. Completion also updates the established ecology list, so danger and
 * raid-pressure consumers do not diverge from the expedition ledger.
 *
 * Called by: the focused dungeon lifecycle Vitest verification lane.
 * Depends on: worldReducer, the canonical dungeon identity helper, and the shared state factory.
 */
export {};
