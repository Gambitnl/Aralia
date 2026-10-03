/**
 * This file proves that source-shaped Arcane Lock access metadata and the
 * normalized object-access contract can coexist without accepting empty rows.
 *
 * Called by: Vitest
 * Depends on: spellValidator.ts and live spell JSON object-access packets
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

describe("source-backed object access metadata", () => {
  it("accepts the live Arcane Lock packet", () => {
    const tinyServant = loadSpell("level-3", "tiny-servant.json");
    const arcaneLock = loadSpell("level-2", "arcane-lock.json");
    const accessChange = arcaneLock.effects.find((effect) => effect.objectAccessChange)?.objectAccessChange;
    expect(accessChange).toBeDefined();

    const fixture = {
      ...tinyServant,
      effects: [{ ...tinyServant.effects[0], objectAccessChange: accessChange }],
    };
    expect(SpellValidator.safeParse(fixture).success).toBe(true);
  });

  it("still rejects an object-access packet without either contract discriminator", () => {
    const tinyServant = loadSpell("level-3", "tiny-servant.json");
    const fixture = {
      ...tinyServant,
      effects: [{ ...tinyServant.effects[0], objectAccessChange: {} }],
    };

    expect(SpellValidator.safeParse(fixture).success).toBe(false);
  });
});
