/**
 * @file planSize.test.ts — D&D size category + combat tile footprint derived
 * from a plan's dimensions (combat ground truth: 1 tile = 5 ft).
 */
import { describe, it, expect } from 'vitest';
import { sizeCategoryForPlan, footprintTiles } from '../textPlan/planSize';
import { PLAN_FIXTURES } from '../textPlan/fixtures';

describe('sizeCategoryForPlan', () => {
  it('derives from the larger of height and length', () => {
    expect(sizeCategoryForPlan(PLAN_FIXTURES.gelatinousCube)).toBe('Large'); // 9 ft cube
    expect(sizeCategoryForPlan(PLAN_FIXTURES.dragon)).toBe('Gargantuan'); // 22 ft long
    expect(sizeCategoryForPlan(PLAN_FIXTURES.centaur)).toBe('Large'); // 8 ft body
    expect(sizeCategoryForPlan(PLAN_FIXTURES.ghost)).toBe('Medium'); // 6 ft
  });

  it('splits Small vs Medium on height', () => {
    const small = { ...PLAN_FIXTURES.ghost, frame: { ...PLAN_FIXTURES.ghost.frame, heightFt: 3 } };
    expect(sizeCategoryForPlan(small)).toBe('Small');
    const tiny = { ...PLAN_FIXTURES.ghost, frame: { ...PLAN_FIXTURES.ghost.frame, heightFt: 2 } };
    expect(sizeCategoryForPlan(tiny)).toBe('Tiny');
  });

  it('maps categories onto combat tile footprints', () => {
    expect(footprintTiles('Tiny')).toBe(0.5);
    expect(footprintTiles('Medium')).toBe(1);
    expect(footprintTiles('Large')).toBe(2);
    expect(footprintTiles('Huge')).toBe(3);
    expect(footprintTiles('Gargantuan')).toBe(4);
  });
});
