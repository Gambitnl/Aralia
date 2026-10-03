/**
 * This file proves that the last source-shaped spell records remain valid
 * after their fields are routed through the normalized validator contracts.
 *
 * Called by: Vitest
 * Depends on: spellValidator.ts and live spell JSON under public/data/spells
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SpellValidator } from "../spellValidator";
import { ModeChoice } from "../modeChoiceSchemas";

type SpellRecord = {
  modeChoice?: Record<string, unknown>;
  effects: Array<Record<string, unknown>>;
};

const loadSpell = (level: string, fileName: string): SpellRecord => {
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as SpellRecord;
};

describe("remaining source-backed spell metadata", () => {
  it("accepts scalar labels, source escape checks, and healing packets", () => {
    const fixtures = [
      ["level-1", "thunderwave.json"],
      ["level-3", "leomunds-tiny-hut.json"],
      ["level-5", "telekinesis.json"],
      ["level-7", "whirlwind.json"],
      ["level-9", "mass-heal.json"],
      ["level-9", "power-word-heal.json"],
      ["level-9", "true-resurrection.json"],
    ] as const;

    for (const [level, fileName] of fixtures) {
      const spell = loadSpell(level, fileName);
      expect(SpellValidator.safeParse(spell).success, `${level}/${fileName}`).toBe(true);
    }
  });

  it("accepts complete mode menus after source options are materialized", () => {
    expect(ModeChoice.safeParse(loadSpell("level-5", "commune-with-nature.json").modeChoice).success).toBe(true);
    expect(ModeChoice.safeParse(loadSpell("level-7", "conjure-celestial.json").modeChoice).success).toBe(true);
  });
});
