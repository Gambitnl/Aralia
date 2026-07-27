/**
 * This file proves that source-backed targeting labels remain valid while the
 * normalized targeting helpers continue to handle executable sentinels.
 *
 * Called by: Vitest
 * Depends on: targetingSchemas.ts, spellTargeting.ts, and live spell JSON
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Targeting } from "../targetingSchemas";
import { resolveScalableNumber } from "../../../../types/spellTargeting";

// ============================================================================
// Live targeting loader
// ============================================================================
// Keep this proof attached to authored records so a future schema change cannot
// silently pass only because a copied fixture was updated with it.
// ============================================================================

const loadTargeting = (level: string, fileName: string): Record<string, unknown> => {
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  const spell = JSON.parse(fs.readFileSync(filePath, "utf8")) as { targeting: Record<string, unknown> };
  return spell.targeting;
};

describe("source-backed targeting metadata", () => {
  it("accepts source target labels, consent metadata, and placement labels", () => {
    for (const [level, fileName] of [
      ["level-3", "dispel-magic.json"],
      ["level-3", "glyph-of-warding.json"],
      ["level-3", "meld-into-stone.json"],
      ["level-3", "speak-with-dead.json"],
      ["level-3", "incite-greed.json"],
      ["level-4", "compulsion.json"],
      ["level-3", "nondetection.json"],
      ["level-1", "tensers-floating-disk.json"],
      ["level-2", "flaming-sphere.json"],
      ["level-2", "find-steed.json"],
    ] as const) {
      const result = Targeting.safeParse(loadTargeting(level, fileName));
      expect(result.success, `${level}/${fileName}`).toBe(true);
    }
  });

  it("normalizes the source any-number sentinel without a fake cap", () => {
    expect(resolveScalableNumber("any_number", 1)).toBe(Number.POSITIVE_INFINITY);
  });
});
