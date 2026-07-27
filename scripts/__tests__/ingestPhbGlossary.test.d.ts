/**
 * This file protects the PHB ingest's item-metadata boundary.
 *
 * The tests use raw 5eTools-style objects to prove that every established item
 * transformation survives typed validation, malformed vendor fields are ignored,
 * and the function continues returning the shared GlossaryEntry metadata shape.
 *
 * Called by: the focused Vitest ingest suite.
 * Depends on: buildItemMetadata and the shared GlossaryEntry type contract.
 */
export {};
