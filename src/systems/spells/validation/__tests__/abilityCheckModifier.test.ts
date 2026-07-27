import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AbilityCheckModifier } from "../abilityCheckModifierSchemas";

function loadModifier(level: string, fileName: string, effectIndex: number): Record<string, unknown> {
  // Read authored spell records so the proof covers the source-backed shapes
  // that previously failed validation, including partial metadata envelopes.
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  const spell = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
    effects: Array<Record<string, unknown>>;
  };
  return spell.effects[effectIndex].abilityCheckModifier as Record<string, unknown>;
}

describe("AbilityCheckModifier schema", () => {
  it("accepts executable and source-backed ability-check payloads", () => {
    // These records exercise Guidance-style dice, advantage/disadvantage,
    // fixed skill lists, and source-specific metadata used by later runtime
    // lanes such as Storm Sphere and Infernal Calling.
    for (const [level, fileName, effectIndex] of [
      ["level-2", "enhance-ability.json", 0],
      ["level-2", "ray-of-enfeeblement.json", 0],
      ["level-3", "bestow-curse.json", 0],
      ["level-4", "storm-sphere.json", 4],
      ["level-5", "infernal-calling.json", 0],
      ["level-5", "skill-empowerment.json", 0],
    ] as const) {
      expect(AbilityCheckModifier.safeParse(loadModifier(level, fileName, effectIndex)).success).toBe(true);
    }
  });

  it("rejects an empty ability-check payload", () => {
    // The metadata escape hatch preserves real authored fields but does not
    // turn an empty object into a silently accepted validator result.
    expect(AbilityCheckModifier.safeParse({}).success).toBe(false);
  });
});
