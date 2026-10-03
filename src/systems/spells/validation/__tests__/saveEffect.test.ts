/**
 * This file proves that authored save-outcome labels survive spell validation.
 *
 * The live corpus uses `negates` in several older records, including Heat Metal,
 * Gust of Wind, and Zone of Truth. Keeping those source labels valid lets the
 * runtime adapters interpret them without dropping the spells from the corpus.
 *
 * Called by: Vitest
 * Depends on: spellValidator.ts and the public spell JSON corpus
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SpellValidator } from "../spellValidator";

// ============================================================================
// Live spell loader
// ============================================================================
// Read the authored records so this proof follows the same source data used by
// the validator replay instead of drifting into a copied test fixture.
// ============================================================================

const loadSpell = (level: string, fileName: string): Record<string, unknown> => {
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
};

describe("source-backed saveEffect labels", () => {
  it("accepts the live negates records across movement, damage, and utility effects", () => {
    for (const [level, fileName] of [
      ["level-2", "gust-of-wind.json"],
      ["level-2", "heat-metal.json"],
      ["level-2", "zone-of-truth.json"],
    ] as const) {
      expect(SpellValidator.safeParse(loadSpell(level, fileName)).success).toBe(true);
    }
  });
});
