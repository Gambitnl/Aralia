import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ModeChoice } from "../modeChoiceSchemas";

function loadModeChoice(level: string, fileName: string): Record<string, unknown> {
  // Read the authored menu so this proof follows source-backed timing, type,
  // and option-source labels through the live schema.
  const filePath = path.resolve(process.cwd(), "public", "data", "spells", level, fileName);
  return (JSON.parse(fs.readFileSync(filePath, "utf8")) as { modeChoice: Record<string, unknown> }).modeChoice;
}

describe("ModeChoice schema", () => {
  it("accepts executable menus with newer source-backed labels", () => {
    // Bigby's Hand and Bestow Curse retain complete executable option arrays
    // while using timing/source labels beyond the original narrow enum.
    expect(ModeChoice.safeParse(loadModeChoice("level-5", "bigbys-hand.json")).success).toBe(true);
    expect(ModeChoice.safeParse(loadModeChoice("level-3", "bestow-curse.json")).success).toBe(true);
  });

  it("accepts the materialized Commune with Nature menu", () => {
    // The five source control options now have explicit menu summaries and
    // control-option indexes, so the three-choice menu is executable data.
    expect(ModeChoice.safeParse(loadModeChoice("level-5", "commune-with-nature.json")).success).toBe(true);
  });
});
