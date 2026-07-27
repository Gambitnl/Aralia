import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SpellValidator } from "../spellValidator";

function loadSpell(level: string, fileName: string): Record<string, unknown> {
  // Read the real spell records so this proof covers the data contract that
  // previously failed, rather than a hand-built object that can drift away
  // from the corpus.
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

describe("createdObjects validation", () => {
  it("accepts source-backed object labels already present in spell data", () => {
    // Druidcraft and Prestidigitation exercise sensory, plant, fire-state,
    // surface, target-object, and non-standard volume labels from the live
    // corpus without weakening the required object fields.
    expect(SpellValidator.safeParse(loadSpell("level-0", "druidcraft.json")).success).toBe(true);
    expect(SpellValidator.safeParse(loadSpell("level-0", "prestidigitation.json")).success).toBe(true);
  });

  it("still rejects a created object missing required identity fields", () => {
    // Source-backed labels are extensible, but each row must still identify
    // what was created, how many units exist, and where they appear.
    const spell = loadSpell("level-0", "druidcraft.json");
    const effects = spell.effects as Array<Record<string, unknown>>;
    const createdObjects = effects[0].createdObjects as Array<Record<string, unknown>>;
    delete createdObjects[0].count;

    expect(SpellValidator.safeParse(spell).success).toBe(false);
  });
});
