
import { describe, it, expect } from 'vitest';
import { applyMovementCostModifiers } from '../physicsUtils';

describe('physicsUtils - Movement Cost', () => {
  it('calculates standard movement cost (1:1)', () => {
    // 5ft move = 5ft cost
    expect(applyMovementCostModifiers(5, {})).toBe(5);
    expect(applyMovementCostModifiers(30, {})).toBe(30);
  });

  it('calculates difficult terrain cost (x2)', () => {
    // 5ft move = 10ft cost
    expect(applyMovementCostModifiers(5, { isDifficultTerrain: true })).toBe(10);
  });

  it('calculates climbing cost without speed (x2)', () => {
    expect(applyMovementCostModifiers(10, { isClimbing: true })).toBe(20);
  });

  it('calculates climbing cost WITH speed (x1)', () => {
    expect(applyMovementCostModifiers(10, { isClimbing: true, hasClimbSpeed: true })).toBe(10);
  });

  it('calculates swimming cost without speed (x2)', () => {
    expect(applyMovementCostModifiers(10, { isSwimming: true })).toBe(20);
  });

  it('calculates swimming cost WITH speed (x1)', () => {
    expect(applyMovementCostModifiers(10, { isSwimming: true, hasSwimSpeed: true })).toBe(10);
  });

  it('calculates crawling cost (x2)', () => {
    expect(applyMovementCostModifiers(5, { isCrawling: true })).toBe(10);
  });

  it('stacks modifiers additively (Difficult Terrain + Climbing = x3)', () => {
    // Base 1 + Diff 1 + Climb 1 = 3x
    expect(applyMovementCostModifiers(5, { isDifficultTerrain: true, isClimbing: true })).toBe(15);
  });

  it('stacks modifiers additively (Difficult Terrain + Crawling = x3)', () => {
    // Base 1 + Diff 1 + Crawl 1 = 3x
    expect(applyMovementCostModifiers(5, { isDifficultTerrain: true, isCrawling: true })).toBe(15);
  });

  it('stacks modifiers additively (Climbing + Crawling = x3)', () => {
    // Base 1 + Climb 1 + Crawl 1 = 3x (e.g. prone on a wall?)
    expect(applyMovementCostModifiers(5, { isClimbing: true, isCrawling: true })).toBe(15);
  });

  it('handles speed negation correctly in stacked scenarios', () => {
    // Difficult Terrain (x2) + Climbing (x1 due to speed) = x2 total
    expect(applyMovementCostModifiers(5, {
      isDifficultTerrain: true,
      isClimbing: true,
      hasClimbSpeed: true
    })).toBe(10);
  });

  it('stacks everything (Difficult + Climbing + Swimming + Crawling)', () => {
    // Base 1 + Diff 1 + Climb 1 + Swim 1 + Crawl 1 = 5x
    // Extremely unlikely scenario, but mathematically correct per rules
    expect(applyMovementCostModifiers(10, {
      isDifficultTerrain: true,
      isClimbing: true,
      isSwimming: true,
      isCrawling: true
    })).toBe(50);
  });
});
