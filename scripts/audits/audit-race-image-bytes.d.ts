#!/usr/bin/env tsx
/**
 * Audits race illustration assets used by the Character Creator.
 *
 * Source of truth for Character Creator images:
 *   src/data/races/*.ts -> visual.maleIllustrationPath / visual.femaleIllustrationPath
 *
 * This script:
 * - lists placeholder usages
 * - lists missing files
 * - detects duplicate image bytes by sha256 across referenced images
 * - (also) detects duplicates across all files in public/assets/images/races
 *
 * Usage:
 *   npx tsx scripts/audits/audit-race-image-bytes.ts
 */
export {};
