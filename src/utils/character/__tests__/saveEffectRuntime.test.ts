/**
 * This file proves that source-backed save aliases resolve correctly in damage.
 *
 * Heat Metal currently stores `negates` rather than the normalized
 * `negates_condition` label. The shared save-damage utility must treat both as
 * a successful-save zero-damage outcome while leaving failed saves untouched.
 *
 * Called by: Vitest
 * Depends on: savingThrowUtils.ts
 */
import { describe, expect, it } from "vitest";
import { calculateSaveDamage, SavingThrowResult } from "../savingThrowUtils";

// ============================================================================
// Save-result fixtures
// ============================================================================
// Keep the roll details explicit so the test proves both success normalization
// and the preserved full-damage failure path.
// ============================================================================

const successfulSave: SavingThrowResult = {
  success: true,
  roll: 15,
  total: 20,
  dc: 15,
  natural20: false,
  natural1: false,
};

const failedSave: SavingThrowResult = {
  ...successfulSave,
  success: false,
  roll: 4,
  total: 9,
};

describe("source-backed save outcome runtime", () => {
  it("normalizes negates aliases to zero damage on a successful save", () => {
    expect(calculateSaveDamage(12, successfulSave, "negates")).toBe(0);
    expect(calculateSaveDamage(12, successfulSave, "negates_effect")).toBe(0);
  });

  it("keeps failed saves on the full-damage path", () => {
    expect(calculateSaveDamage(12, failedSave, "negates")).toBe(12);
  });
});
