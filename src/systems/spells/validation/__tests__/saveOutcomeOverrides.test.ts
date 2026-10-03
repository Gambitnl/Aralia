import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SpellValidator } from "../spellValidator";

function loadSpell(level: string, fileName: string): Record<string, unknown> {
  // Use the real spell record so this proof follows the source-backed save
  // outcome payload through the same validator used by the corpus replay.
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

describe("save outcome override validation", () => {
  it("accepts source-backed auto-outcome rows in the live corpus", () => {
    // Sleep and Moonbeam exercise the canonical auto-success/auto-failure
    // condition rows that previously fell outside the strict enum.
    expect(SpellValidator.safeParse(loadSpell("level-1", "sleep.json")).success).toBe(true);
    expect(SpellValidator.safeParse(loadSpell("level-2", "moonbeam.json")).success).toBe(true);
  });

  it("rejects an empty save-outcome row", () => {
    // The source-backed metadata escape hatch still requires at least one
    // authored field, preventing an empty object from becoming valid evidence.
    const spell = loadSpell("level-1", "sleep.json");
    const effects = spell.effects as Array<Record<string, unknown>>;
    const condition = effects[0].condition as Record<string, unknown>;
    condition.saveOutcomeOverrides = [{}];

    expect(SpellValidator.safeParse(spell).success).toBe(false);
  });
});
