/**
 * This file proves that source-backed attack packets and normalized weapon
 * augments share one lossless validator boundary without accepting empties.
 *
 * Called by: Vitest
 * Depends on: attackAugmentSchemas.ts, spellValidator.ts, and live spell JSON
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

describe("source-backed attack augment metadata", () => {
  it("accepts live source packets across weapon, summon, control, and spell attacks", () => {
    const tinyServant = loadSpell("level-3", "tiny-servant.json");
    const baseEffect = tinyServant.effects[0];
    const sourcePackets = [
      ["level-2", "enlarge-reduce.json"],
      ["level-4", "giant-insect.json"],
      ["level-5", "animate-objects.json"],
      ["level-5", "bigbys-hand.json"],
      ["level-5", "control-winds.json"],
      ["level-5", "danse-macabre.json"],
      ["level-6", "tensers-transformation.json"],
      ["level-9", "blade-of-disaster.json"],
    ] as const;

    for (const [level, fileName] of sourcePackets) {
      const sourceSpell = loadSpell(level, fileName);
      const attackAugments = sourceSpell.effects.find((effect) => effect.attackAugments)?.attackAugments;
      expect(attackAugments, `${level}/${fileName} should contain attackAugments`).toBeDefined();

      const fixture = {
        ...tinyServant,
        effects: [{ ...baseEffect, attackAugments }],
      };
      expect(SpellValidator.safeParse(fixture).success, `${level}/${fileName}`).toBe(true);
    }
  });

  it("rejects an empty attack augment", () => {
    const tinyServant = loadSpell("level-3", "tiny-servant.json");
    const fixture = {
      ...tinyServant,
      effects: [{ ...tinyServant.effects[0], attackAugments: [{}] }],
    };

    expect(SpellValidator.safeParse(fixture).success).toBe(false);
  });
});
