#!/usr/bin/env npx tsx
/**
 * Build a clean slice-of-life ledger for race portraits.
 *
 * Sources:
 * - CC race data: src/data/races/*.ts
 * - Image status log: public/assets/images/races/race-image-status.json
 * - QA decisions: scripts/audits/slice-of-life-qa.json
 *
 * Outputs:
 * - scripts/audits/slice-of-life-settings.md
 * - scripts/audits/slice-of-life-settings.json
 * - public/data/dev/slice-of-life-settings.md
 * - public/data/dev/slice-of-life-settings.json
 *
 * Rules:
 * - Use only the latest status entry per (race, gender).
 * - Include every CC race/gender pair in the final ledger.
 * - Uniqueness is evaluated on targetActivity canonical when present; otherwise observedActivity canonical.
 * - Duplicate handling follows keeper rule + dual-state QA conflict routing.
 */
export {};
