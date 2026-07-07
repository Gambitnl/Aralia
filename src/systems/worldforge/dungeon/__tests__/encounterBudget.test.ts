/**
 * @file encounterBudget.test.ts
 * @description Unit invariants for the 5e per-room encounter XP budget.
 */

import { describe, it, expect } from 'vitest';
import { roomBudget, encounterMultiplier, ASSUMED_PARTY_SIZE } from '../encounterBudget';

describe('encounterBudget', () => {
  it('anchors: easy at shallow, medium-hard at mid, deadly at boss (party of 4)', () => {
    // Level 5 per-character thresholds: easy 250, medium 500, hard 750, deadly 1100.
    const P = ASSUMED_PARTY_SIZE; // 4
    // difficulty 0.15 → easy.
    expect(roomBudget(5, 0.15)).toBeCloseTo(250 * P, 5);
    // difficulty 0.6 → halfway between medium and hard = (500+750)/2 = 625, ×4.
    expect(roomBudget(5, 0.6)).toBeCloseTo(625 * P, 5);
    // difficulty 1.0 → deadly.
    expect(roomBudget(5, 1.0)).toBeCloseTo(1100 * P, 5);
  });

  it('is monotonic non-decreasing in difficulty', () => {
    for (const lvl of [1, 2, 3, 6, 10]) {
      let prev = -1;
      for (let d = 0; d <= 1.0001; d += 0.05) {
        const b = roomBudget(lvl, d);
        expect(b).toBeGreaterThanOrEqual(prev - 1e-6);
        prev = b;
      }
    }
  });

  it('scales up with party level at fixed difficulty', () => {
    expect(roomBudget(6, 0.6)).toBeGreaterThan(roomBudget(2, 0.6));
  });

  it('clamps difficulty below 0.15 to easy and above 1 to deadly', () => {
    expect(roomBudget(4, 0)).toBeCloseTo(roomBudget(4, 0.15), 5);
    expect(roomBudget(4, 2)).toBeCloseTo(roomBudget(4, 1), 5);
  });

  it('clamps party level into the 0..10 band (levels >10 reuse level 10)', () => {
    expect(roomBudget(20, 1)).toBeCloseTo(roomBudget(10, 1), 5);
    expect(roomBudget(0, 1)).toBe(0);
  });

  it('applies the standard 5e mob multiplier table', () => {
    expect(encounterMultiplier(1)).toBe(1);
    expect(encounterMultiplier(2)).toBe(1.5);
    expect(encounterMultiplier(3)).toBe(2);
    expect(encounterMultiplier(6)).toBe(2);
    expect(encounterMultiplier(7)).toBe(2.5);
    expect(encounterMultiplier(10)).toBe(2.5);
    expect(encounterMultiplier(11)).toBe(3);
    expect(encounterMultiplier(14)).toBe(3);
    expect(encounterMultiplier(15)).toBe(4);
    expect(encounterMultiplier(37)).toBe(4);
  });

  it('multiplier honesty: 37 ghouls dwarf any level-2 budget', () => {
    // 37 ghouls (200 XP) × ×4 mob multiplier = 29600 adjusted XP.
    const adjusted = 37 * 200 * encounterMultiplier(37);
    // Even a deadly level-2 boss room budget is 200×4 = 800.
    expect(adjusted).toBeGreaterThan(roomBudget(2, 1) * 10);
  });
});
