/**
 * This file tests the value-set comparison helper used by the spell template validator.
 *
 * The validator already knew whether structured fields and JSON paths were mapped,
 * but it could still miss a more dangerous failure: both templates referring to the
 * same field while allowing different vocabularies for that field. These tests keep
 * that coverage in place so "template contract is clean" means the two layers agree
 * on the non-prose values they allow.
 *
 * Called by: Vitest
 * Depends on: scripts/spellTemplateValueParity.ts
 */
export {};
