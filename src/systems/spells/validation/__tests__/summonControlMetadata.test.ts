/**
 * This file proves that utility summon/control packets preserve the live
 * corpus vocabulary while still requiring a meaningful discriminator.
 *
 * Called by: Vitest
 * Depends on: spellValidator.ts and public spell JSON control packets
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

describe("source-backed summon control", () => {
  it("accepts executable and richer live control packets", () => {
    const tinyServant = loadSpell("level-3", "tiny-servant.json");
    const baseEffect = tinyServant.effects[0];
    const sourcePackets = [
      ["level-3", "animate-dead.json"],
      ["level-5", "dominate-person.json"],
      ["level-5", "geas.json"],
      ["level-5", "planar-binding.json"],
      ["level-6", "create-undead.json"],
      ["level-8", "dominate-monster.json"],
      ["level-9", "true-polymorph.json"],
      ["level-9", "wish.json"],
    ] as const;

    for (const [level, fileName] of sourcePackets) {
      const sourceSpell = loadSpell(level, fileName);
      const packet = sourceSpell.effects.find((effect) => effect.summonControl)?.summonControl;
      expect(packet, `${level}/${fileName} should contain summonControl`).toBeDefined();

      const fixture = {
        ...tinyServant,
        effects: [{ ...baseEffect, summonControl: packet }],
      };
      expect(SpellValidator.safeParse(fixture).success, `${level}/${fileName}`).toBe(true);
    }
  });

  it("rejects an empty control packet instead of accepting arbitrary metadata", () => {
    const tinyServant = loadSpell("level-3", "tiny-servant.json");
    const fixture = {
      ...tinyServant,
      effects: [{ ...tinyServant.effects[0], summonControl: {} }],
    };

    expect(SpellValidator.safeParse(fixture).success).toBe(false);
  });
});
