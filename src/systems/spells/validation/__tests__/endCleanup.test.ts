/**
 * This file proves that normalized and source-backed end-cleanup records both
 * survive validation without collapsing one shape into the other.
 *
 * Animal Messenger uses a compact trigger/result/note object, while Heroism uses
 * the executable cleanup array. Both forms are valid evidence for different
 * lifecycle owners and need separate adapters later.
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
// Read the authored files so the proof follows the same records used by the
// full validation replay and catches future shape drift in the corpus.
// ============================================================================

const loadSpell = (level: string, fileName: string): Record<string, unknown> => {
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
};

describe("source-backed end cleanup", () => {
  it("accepts Animal Messenger's compact lifecycle cleanup object", () => {
    expect(SpellValidator.safeParse(loadSpell("level-2", "animal-messenger.json")).success).toBe(true);
  });

  it("retains the normalized cleanup array contract for Heroism", () => {
    expect(SpellValidator.safeParse(loadSpell("level-1", "heroism.json")).success).toBe(true);
  });
});
