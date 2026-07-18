import { describe, expect, it } from "vitest";
import { ConditionalEnding } from "../effectLifecycleSchemas";

describe("ConditionalEnding schema", () => {
  it("accepts executable and source-backed lifecycle tokens", () => {
    // Existing runtime triggers and newer source-backed labels must share one
    // validated shape without forcing the latter into a false runtime alias.
    expect(ConditionalEnding.safeParse({
      trigger: "end_on_recast",
      scope: "spell",
    }).success).toBe(true);

    expect(ConditionalEnding.safeParse({
      trigger: "strong_wind",
      scope: "suppressed_arcane_lock",
      description: "The cloud disperses when strong wind reaches it.",
    }).success).toBe(true);
  });

  it("rejects prose and malformed lifecycle labels", () => {
    // Normalized tokens keep the data machine-readable even though the
    // runtime vocabulary remains intentionally extensible between lanes.
    expect(ConditionalEnding.safeParse({
      trigger: "Strong wind",
      scope: "spell",
    }).success).toBe(false);

    expect(ConditionalEnding.safeParse({
      trigger: "end_on_recast",
      scope: "",
    }).success).toBe(false);
  });
});
