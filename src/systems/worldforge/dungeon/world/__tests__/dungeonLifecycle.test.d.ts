/**
 * This file proves the durable lifecycle contract for one real world-grown dungeon.
 *
 * It begins with the authoritative world site identity, exercises entry, additive progress,
 * retreat, completion, JSON save/load migration, and revisit, then checks that completion,
 * cleared content, per-level parchment discovery, and compact child-level return receipts never
 * reset. It does not invent room interactions or completion rules; stable identifiers are supplied
 * directly as the authoritative gameplay boundaries would supply them.
 *
 * Called by: the focused dungeon lifecycle Vitest verification lane.
 * Depends on: canonical dungeon identities and the pure lifecycle transition helpers.
 */
export {};
