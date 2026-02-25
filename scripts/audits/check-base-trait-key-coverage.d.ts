#!/usr/bin/env tsx
/**
 * More semantic version of base-trait coverage:
 * - compares by "trait key" (text before the first ':')
 * - treats a parent trait as covered if the child has the same key (even if wording differs)
 * - for keyless traits (no ':'), falls back to exact-string normalized match
 *
 * This answers: "If we remove/hide the base race, do subchoices still include the same trait *types*?"
 */
export {};
