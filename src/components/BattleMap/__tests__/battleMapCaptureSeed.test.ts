import { describe, expect, it } from "vitest";
import { resolveBattleMapCaptureSeed } from "../battleMapCaptureSeed";

describe("resolveBattleMapCaptureSeed", () => {
  it("keeps the existing init-script override ahead of the URL", () => {
    expect(resolveBattleMapCaptureSeed(20260920, "?seed=123")).toBe(20260920);
  });

  it("accepts a shareable numeric URL seed", () => {
    expect(resolveBattleMapCaptureSeed(undefined, "?step=battlemap&seed=20260920"))
      .toBe(20260920);
    expect(resolveBattleMapCaptureSeed(undefined, "?seed=0")).toBe(0);
  });

  it("rejects missing, blank, malformed, and unsafe URL seeds", () => {
    for (const search of ["", "?seed=", "?seed=nope", "?seed=1.5", "?seed=9007199254740992"]) {
      expect(resolveBattleMapCaptureSeed(undefined, search)).toBeNull();
    }
  });

  it("falls back to a valid URL seed when the init-script value is invalid", () => {
    expect(resolveBattleMapCaptureSeed(Number.NaN, "?seed=41")).toBe(41);
  });
});
