/**
 * This file proves that live spells can preserve turn-relative conditions.
 *
 * It validates Stinking Cloud and Holy Aura through the same complete spell
 * schema used by data audits, so a future schema change cannot silently turn
 * their named turn boundaries back into generic round counts.
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
// Read the authored records instead of copying fixtures. This keeps validation
// proof tied to the same data that SpellService and SpellContext load.
// ============================================================================

const loadSpell = (level: string, fileName: string): Record<string, unknown> => {
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
};

// ============================================================================
// Turn-relative duration contract
// ============================================================================
// These are the two live records that exposed the old one-round fallback.
// Both must pass without changing their source-backed duration wording.
// ============================================================================

describe("turn-relative effect duration validation", () => {
  it("accepts Stinking Cloud's end-of-current-turn condition", () => {
    expect(SpellValidator.safeParse(loadSpell("level-3", "stinking-cloud.json")).success).toBe(true);
  });

  it("accepts Holy Aura's end-of-next-turn condition", () => {
    expect(SpellValidator.safeParse(loadSpell("level-8", "holy-aura.json")).success).toBe(true);
  });
});
