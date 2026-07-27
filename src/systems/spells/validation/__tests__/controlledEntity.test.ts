import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ControlledEntity } from "../controlledEntitySchemas";

function loadFirstControlledEntity(level: string, fileName: string): Record<string, unknown> {
  // Find the authored payload rather than rebuilding it so this proof covers
  // the source-backed labels that previously failed the strict helper schema.
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  const spell = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    effects: Array<Record<string, unknown>>;
  };
  const effect = spell.effects.find(candidate => candidate.controlledEntity);
  return effect?.controlledEntity as Record<string, unknown>;
}

describe("ControlledEntity schema", () => {
  it("accepts source-backed helper and emanation records", () => {
    // Mage Hand exercises the executable helper shape while Wrath of Nature
    // exercises the authored environmental-entity metadata shape.
    expect(ControlledEntity.safeParse(loadFirstControlledEntity("level-0", "mage-hand.json")).success).toBe(true);
    expect(ControlledEntity.safeParse(loadFirstControlledEntity("level-5", "wrath-of-nature.json")).success).toBe(true);
  });

  it("rejects an empty controlled-entity record", () => {
    // Source-backed extensibility must not turn an empty object into valid
    // entity evidence.
    expect(ControlledEntity.safeParse({}).success).toBe(false);
  });
});
