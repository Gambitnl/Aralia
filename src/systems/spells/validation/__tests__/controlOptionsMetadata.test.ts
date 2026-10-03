/**
 * This file proves that source-backed control-option packets remain lossless
 * without entering executable command selection as incomplete menu entries.
 *
 * Called by: Vitest
 * Depends on: spellValidator.ts, spellEffectTypes.ts, and live spell JSON
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isExecutableControlOption } from "../../../../types/spellEffectTypes";
import { SpellValidator } from "../spellValidator";

type SpellRecord = {
  effects: Array<Record<string, unknown>>;
};

const loadSpell = (level: string, fileName: string): SpellRecord => {
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as SpellRecord;
};

describe("source-backed control options", () => {
  it("accepts live mode and label packets alongside executable menus", () => {
    const tinyServant = loadSpell("level-3", "tiny-servant.json");
    const baseEffect = tinyServant.effects[0];
    const sourcePackets = [
      ["level-3", "animate-dead.json"],
      ["level-4", "mordenkainens-private-sanctum.json"],
      ["level-5", "bigbys-hand.json"],
    ] as const;

    for (const [level, fileName] of sourcePackets) {
      const sourceSpell = loadSpell(level, fileName);
      const options = sourceSpell.effects.find((effect) => effect.controlOptions)?.controlOptions;
      expect(options, `${level}/${fileName} should contain controlOptions`).toBeDefined();

      const fixture = {
        ...tinyServant,
        effects: [{ ...baseEffect, controlOptions: options }],
      };
      expect(SpellValidator.safeParse(fixture).success, `${level}/${fileName}`).toBe(true);
    }
  });

  it("keeps source metadata out of executable command selection", () => {
    expect(isExecutableControlOption({ mode: "animate_skeleton" })).toBe(false);
    expect(isExecutableControlOption({ label: "Block sound through the boundary" })).toBe(false);
    expect(isExecutableControlOption({ name: "Flee", effect: "flee" })).toBe(true);
    expect(isExecutableControlOption({})).toBe(false);
  });
});
