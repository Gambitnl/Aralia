#!/usr/bin/env tsx
/**
 * Checks whether "parent/base" races contain traits that are missing from their child races.
 * This is important before hiding/removing parent races from Character Creator.
 *
 * Parents checked (hardcoded to match current discussion):
 * - eladrin, elf, goliath, half_elf, halfling, human, tiefling
 *
 * Child relationship:
 * - child.baseRace === parent.id
 */
export {};
