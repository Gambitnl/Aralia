/**
 * This file proves that defensive saving-throw metadata keeps both executable
 * ability names and richer source-backed protection packets without widening
 * the actual save resolver's ability contract.
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
// Read the authored records so this proof stays tied to the same defensive
// metadata that the full validator replay evaluates.
// ============================================================================

const loadSpell = (level: string, fileName: string): Record<string, unknown> => {
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
};

describe("source-backed defensive saving throws", () => {
  it("accepts live label and structured metadata rows", () => {
    for (const [level, fileName] of [
      ["level-1", "protection-from-evil-and-good.json"],
      ["level-2", "warding-bond.json"],
      ["level-4", "aura-of-purity.json"],
      ["level-5", "circle-of-power.json"],
    ] as const) {
      expect(SpellValidator.safeParse(loadSpell(level, fileName)).success).toBe(true);
    }
  });
});
