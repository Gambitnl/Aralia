/**
 * This file proves that source-backed recurring and saving-throw metadata is
 * accepted without changing the normalized runtime contracts.
 *
 * Called by: Vitest
 * Depends on: spellValidator.ts and representative public spell JSON
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SpellValidator } from "../spellValidator";

type SpellRecord = {
  effects: Array<Record<string, unknown>>;
};

const loadSpell = (level: string, fileName: string): SpellRecord => {
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as SpellRecord;
};

describe("source-backed recurring and save metadata", () => {
  it("accepts compact recurring records and prose-backed save modifiers", () => {
    const fixtures = [
      ["level-3", "fast-friends.json"],
      ["level-4", "control-water.json"],
      ["level-4", "summon-greater-demon.json"],
      ["level-5", "dominate-person.json"],
      ["level-5", "scrying.json"],
      ["level-5", "seeming.json"],
      ["level-6", "bones-of-the-earth.json"],
    ] as const;

    for (const [level, fileName] of fixtures) {
      const spell = loadSpell(level, fileName);
      expect(SpellValidator.safeParse(spell).success, `${level}/${fileName}`).toBe(true);
    }
  });

  it("rejects an empty recurring record and empty save modifier", () => {
    const spell = loadSpell("level-3", "fast-friends.json");
    const effect = spell.effects[0];

    expect(SpellValidator.safeParse({
      ...spell,
      effects: [{ ...effect, recurringMechanics: {} }],
    }).success).toBe(false);

    expect(SpellValidator.safeParse({
      ...spell,
      effects: [{
        ...effect,
        condition: { ...(effect.condition as Record<string, unknown>), saveModifiers: [{}] },
      }],
    }).success).toBe(false);
  });
});
