/**
 * This file proves that composite source trigger labels retain their timing
 * payloads until an area-schedule adapter expands them into runtime events.
 *
 * Called by: Vitest
 * Depends on: spellValidator.ts and live spell JSON trigger packets
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

describe("source-backed effect triggers", () => {
  it("accepts live composite area and repeat-action trigger packets", () => {
    const tinyServant = loadSpell("level-3", "tiny-servant.json");
    const baseEffect = tinyServant.effects[0];
    const sourceTriggers = [
      ["level-3", "sleet-storm.json"],
      ["level-3", "spirit-guardians.json"],
      ["level-4", "conjure-woodland-beings.json"],
      ["level-4", "evards-black-tentacles.json"],
      ["level-4", "grasping-vine.json"],
      ["level-4", "storm-sphere.json"],
      ["level-5", "conjure-elemental.json"],
    ] as const;

    for (const [level, fileName] of sourceTriggers) {
      const sourceSpell = loadSpell(level, fileName);
      const trigger = sourceSpell.effects.find((effect) => {
        const candidate = effect.trigger as { type?: string } | undefined;
        return candidate?.type && !candidate.type.startsWith("on_") && candidate.type !== "immediate" && candidate.type !== "turn_start" && candidate.type !== "turn_end" && candidate.type !== "after_primary";
      })?.trigger;
      expect(trigger, `${level}/${fileName} should contain a composite trigger`).toBeDefined();

      const fixture = {
        ...tinyServant,
        effects: [{ ...baseEffect, trigger }],
      };
      expect(SpellValidator.safeParse(fixture).success, `${level}/${fileName}`).toBe(true);
    }
  });

  it("rejects an empty trigger label", () => {
    const tinyServant = loadSpell("level-3", "tiny-servant.json");
    const fixture = {
      ...tinyServant,
      effects: [{ ...tinyServant.effects[0], trigger: { type: "" } }],
    };

    expect(SpellValidator.safeParse(fixture).success).toBe(false);
  });
});
